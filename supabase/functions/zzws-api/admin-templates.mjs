import {normalizeLines,totalOf} from './orders.mjs';
import {canAccess} from './operations.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function templateCart(lines,products){
 const checked=normalizeLines(lines,products),cart=Object.create(null);
 if(!checked.length)throw Error('Ձևանմուշը դատարկ է');
 if(checked.some(row=>['__proto__','constructor','prototype'].includes(row.articul)))throw Error('Սխալ արտիկուլ');
 for(const row of checked)cart[row.articul]={articul:row.articul,qty:row.qty,addedPrice:row.unitPrice,addedPriceMode:'WS'};
 return cart;
}
export function mergeTemplateLines(saved,existing,products){
 const allowed=new Map(products.map(p=>[p.articul,p])),next=existing.map(r=>({...r})),missing=[],changes=[];
 for(const [key,row] of Object.entries(saved||{})){
  const articul=String(row.articul||key),product=allowed.get(articul),price=Number(product?.wholesale),qty=Number(row.qty);
  if(!product||!Number.isFinite(price)||price<=0||!Number.isInteger(qty)||qty<1||['__proto__','constructor','prototype'].includes(articul)){missing.push(articul);continue;}
  const prior=next.find(r=>r.articul===articul),before=prior?.qty||0,after=Math.min(9999,before+qty),added=after-before;
  // Existing lines retain a manager's negotiated price. New lines use the client's current catalogue price.
  if(prior)prior.qty=after;else next.push({articul,name:product.name,brand:product.brand||'',category:product.category||'',qty:after,unitPrice:price});
  changes.push({articul,name:product.name,before,after,added,capped:added<qty,unitPrice:prior?.unitPrice||price});
 }
 if(next.length>500)throw Error('Թույլատրվում է մինչև 500 դիրք');
 return {lines:next,missing,changes,total:totalOf(next)};
}
export async function adminTemplateRoutes(c){
 const {path,req,user,body,table,query,current,project,json,fail,service,audit}=c;
 const preview=path==='admin/orders/template-preview';
 if(!path.startsWith('admin/templates')&&!preview)return null;
 if(user.role!=='admin'||!canAccess(user.adminScope,path,req.method))fail(403,'Այս գործողության իրավունքը չունեք');
 const account=async id=>{
  if(!uuid(id))fail(400,'Ընտրեք հաճախորդին');
  const row=await query(table('users').select('id,login,profile,active').eq('id',id).maybeSingle());
  if(!row||row.profile.role!=='client')fail(404,'Հաճախորդը չի գտնվել');
  return row;
 };
 const permitted=async row=>{const v=await current();return project(v.products,{...row.profile,id:row.id},v.rules);};
 if(path==='admin/templates/customers'&&req.method==='GET'){
  const rows=await query(table('users').select('id,login,profile,active').eq('profile->>role','client').order('login').limit(5000));
  return json({customers:rows.map(r=>({id:r.id,login:r.login,client:r.profile.client,active:r.active}))});
 }
 if(req.method==='GET'&&['admin/templates','admin/templates/catalog'].includes(path)){
  const params=new URL(req.url).searchParams,row=await account(params.get('userId')),products=await permitted(row);
  if(path.endsWith('/catalog')){
   const search=String(params.get('search')||'').normalize('NFKC').trim().toLowerCase().slice(0,100);
   return json({products:products.filter(p=>Number(p.wholesale)>0&&(!search||(p.articul+' '+p.name+' '+p.brand).toLowerCase().includes(search))).slice(0,40).map(p=>({articul:p.articul,name:p.name,price:p.wholesale}))});
  }
  const carts=await query(table('saved_carts').select('id,title,cart,saved_at').eq('user_id',row.id).order('saved_at',{ascending:false}));
  const visible=new Map(products.map(p=>[p.articul,p]));
  return json({customer:{id:row.id,client:row.profile.client,login:row.login,active:row.active},templates:carts.map(cart=>({...cart,rows:Object.entries(cart.cart).map(([key,r])=>{const p=visible.get(r.articul||key);return {articul:r.articul||key,name:p?.name||r.articul||key,qty:r.qty,price:Number(p?.wholesale)||0,available:!!p&&Number(p.wholesale)>0};})}))});
 }
 if(preview&&req.method==='POST'){
  const p=await body(req),order=uuid(p.orderId)?await query(table('orders').select('*').eq('id',p.orderId).maybeSingle()):null;
  if(!order)fail(404,'Պատվերը չի գտնվել');
  if(order.revision!==p.revision||order.received_at||['received','completed','rejected'].includes(order.status))fail(409,'Պատվերն արդեն փոխվել է կամ ստացված է։ Վերաբացեք այն');
  const customer=await account(order.user_id);if(!customer.active)fail(409,'Հաճախորդի հասանելիությունն անջատված է');
  const saved=uuid(p.templateId)?await query(table('saved_carts').select('*').eq('user_id',customer.id).eq('id',p.templateId).maybeSingle()):null;
  if(!saved)fail(404,'Այս հաճախորդի ձևանմուշը չի գտնվել');
  const products=await permitted(customer),existing=normalizeLines(p.lines,products,order.lines,true);
  return json({orderId:order.id,revision:order.revision,templateId:saved.id,savedAt:saved.saved_at,title:saved.title,...mergeTemplateLines(saved.cart,existing,products)});
 }
 if(req.method==='POST'&&['admin/templates/save','admin/templates/delete'].includes(path)){
  const p=await body(req),customer=await account(p.userId);
  if(p.id&&!uuid(p.id))fail(400,'Սխալ ձևանմուշ');
  const old=p.id?await query(table('saved_carts').select('*').eq('user_id',customer.id).eq('id',p.id).maybeSingle()):null;
  if(p.id&&!old)fail(404,'Ձևանմուշը չի գտնվել');
  if(old&&p.savedAt!==old.saved_at)fail(409,'Ձևանմուշն արդեն փոխվել է։ Թարմացրեք ցանկը');
  if(path.endsWith('/delete')){
   if(!old)fail(400,'Ընտրեք ձևանմուշը');
   const removed=await query(table('saved_carts').delete().eq('id',old.id).eq('user_id',customer.id).eq('saved_at',p.savedAt).select('id').maybeSingle());
   if(!removed)fail(409,'Ձևանմուշն արդեն փոխվել է։ Թարմացրեք ցանկը');
   await audit(user.id,'template_delete',JSON.stringify({target:{id:customer.id,client:customer.profile.client,login:customer.login},title:old.title,templateId:old.id}));return json({ok:true});
  }
  if(!customer.active)fail(409,'Հաճախորդի հասանելիությունն անջատված է');
  if(typeof p.title!=='string'||!p.title.trim()||p.title.trim().length>80)fail(400,'Նշեք մինչև 80 նիշանոց անվանում');
  const cart=templateCart(p.lines,await permitted(customer));let result;
  if(old){
   result=await query(table('saved_carts').update({title:p.title.trim(),cart,saved_at:new Date(Math.max(Date.now(),Date.parse(old.saved_at)+1)).toISOString()}).eq('id',old.id).eq('user_id',customer.id).eq('saved_at',p.savedAt).select('id,saved_at').maybeSingle());
   if(!result)fail(409,'Ձևանմուշն արդեն փոխվել է։ Թարմացրեք ցանկը');
  }else{
   if(!uuid(p.requestId))fail(400,'Պահպանման սխալ կոդ');
   result=await query(service.rpc('zzws_save_cart',{p_user:customer.id,p_title:p.title.trim(),p_cart:cart,p_draft:{},p_request:p.requestId,p_replace:null}));
   if(result.limit)fail(409,'Հաճախորդն արդեն ունի 10 ձևանմուշ։ Խմբագրեք կամ ջնջեք եղածներից մեկը');
  }
  await audit(user.id,'template_save',JSON.stringify({target:{id:customer.id,client:customer.profile.client,login:customer.login},title:p.title.trim(),templateId:result.id,created:!old}));return json({id:result.id,saved_at:result.saved_at});
 }
 return null;
}
