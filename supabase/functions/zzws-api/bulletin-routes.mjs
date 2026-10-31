import {orderPublic} from './order-public.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export async function bulletinRoutes({path,req,user,table,query,service,body,json,current,project,fail}){
 const rpc=async(name,args)=>{const r=await service.rpc(name,args);if(r.error)fail(r.error.code==='PT403'?403:r.error.code==='PT409'?409:400,'Ստուգեք տվյալները կամ թարմացրեք էջը');return r.data;};
 if(path==='admin/offers'){
  if(user.role!=='admin'||!['owner','price'].includes(user.adminScope))fail(403,'Հասանելիությունն արգելված է');
  if(req.method==='GET')return json({offers:await query(table('catalog_bulletins').select('id,title,articles,active,created').eq('kind','offers').order('created',{ascending:false}).limit(20))});
  if(req.method==='POST'){
   const p=await body(req);if(!uuid(p.requestId)||typeof p.title!=='string'||typeof p.active!=='boolean'||!Array.isArray(p.articles)||!p.articles.length||p.articles.length>200||p.articles.some(a=>typeof a!=='string'))fail(400,'Նշեք վերնագիրը և մինչև 200 արտիկուլ');
   const v=await current(),available=new Set(v.products.map(p=>p.articul)),articles=[...new Set(p.articles.map(a=>a.trim()))];
   if(articles.some(a=>!available.has(a)))fail(400,'Որոշ արտիկուլներ չեն գտնվել գործող գնացուցակում');
   return json(await rpc('zzws_publish_offer',{p_actor:user.id,p_request:p.requestId,p_title:p.title,p_articles:articles,p_active:p.active}));
  }
 }
 if(path==='admin/orders/reopen'&&req.method==='POST'){
  const p=await body(req);if(user.role!=='admin'||!user.permissions?.includes('orders:write'))fail(403,'Հասանելիությունն արգելված է');
  if(!uuid(p.id)||!Number.isSafeInteger(p.revision)||!['new','confirmed','in_progress'].includes(p.status)||typeof p.reason!=='string'||p.reason.trim().length<5||p.reason.length>2000)fail(400,'Ընտրեք նոր կարգավիճակը և գրեք պատճառը՝ առնվազն 5 նիշ');
  return json(orderPublic(await rpc('zzws_reopen_order',{p_actor:user.id,p_order:p.id,p_revision:p.revision,p_status:p.status,p_reason:p.reason})));
 }
 if(path==='admin/orders/reopens'&&req.method==='GET'){
  if(user.adminScope!=='owner')fail(403,'Հասանելիությունն արգելված է');
  const events=await query(table('order_activity').select('id,order_id,order_number,revision,actor,occurred_at,snapshot').eq('source','closed_order_reopened').order('sequence',{ascending:false}).limit(20));
  const reads=events.length?await query(table('admin_order_reads').select('order_id,revision').eq('user_id',user.id).in('order_id',events.map(e=>e.order_id))):[];
  return json({events:events.filter(e=>!reads.some(r=>r.order_id===e.order_id&&r.revision>=e.revision)).map(e=>({id:e.id,orderId:e.order_id,number:e.order_number,actor:e.actor,created:e.occurred_at,reason:e.snapshot.comment,status:e.snapshot.status}))});
 }
 if(!['me/bulletins','me/bulletins/read'].includes(path))return null;
 const rows=await query(table('catalog_bulletins').select('*').eq('active',true).order('created',{ascending:false}).limit(20));
 const reads=rows.length?await query(table('bulletin_reads').select('bulletin_id').eq('user_id',user.id).in('bulletin_id',rows.map(r=>r.id))):[];
 const state=await query(table('state').select('version,rules_revision').eq('id',true).single());
 const stamp=JSON.stringify([user.id,user.profileRevision,user.role,user.sheet,state.version,state.rules_revision,rows.map(r=>r.id),reads.map(r=>r.bulletin_id).sort()]);
 const cursor=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stamp)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 if(path==='me/bulletins'&&req.method==='GET'&&new URL(req.url).searchParams.get('cursor')===cursor)return json({unchanged:true,cursor});
 if(!rows.length&&path==='me/bulletins'&&req.method==='GET')return json({bulletins:[],cursor});
 const v=await current(),available=new Map(project(v.products,user,v.rules).map(p=>[p.articul,p]));
 const seen=new Set(reads.map(r=>r.bulletin_id)),versions=new Map(),result=[];
 async function version(id){if(!versions.has(id))versions.set(id,await query(table('versions').select('products').eq('id',id).maybeSingle()));return versions.get(id);}
 for(const row of rows){let products=[];
  if(row.kind==='offers')products=row.articles.filter(a=>available.has(a)).map(a=>available.get(a));
  else{const before=await version(row.before_version),after=await version(row.after_version);if(!before||!after)continue;
   const old=new Map(project(before.products,user,v.rules).map(p=>[p.articul,p]));
   products=project(after.products,user,v.rules).filter(p=>available.has(p.articul)&&old.has(p.articul)&&old.get(p.articul).wholesale!==p.wholesale).map(p=>({...p,previousPrice:old.get(p.articul).wholesale}));
  }
  if(!products.length)continue;
  result.push({id:row.id,kind:row.kind,title:row.kind==='prices'?'Գների փոփոխություններ':row.title,created:row.created,seen:seen.has(row.id),products:products.map(p=>({articul:p.articul,name:p.name,brand:p.brand,price:p.wholesale,...(p.previousPrice!=null?{previousPrice:p.previousPrice}:{})}))});
 }
 if(path==='me/bulletins'&&req.method==='GET')return json({bulletins:result,cursor});
 if(path==='me/bulletins/read'&&req.method==='POST'){const p=await body(req);if(!uuid(p.id)||!result.some(b=>b.id===p.id))fail(404,'Ծանուցումը չի գտնվել');await query(table('bulletin_reads').upsert({user_id:user.id,bulletin_id:p.id},{onConflict:'user_id,bulletin_id'}));return json({ok:true});}
 return null;
}

