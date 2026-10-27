import {statuses,normalizeLines,totalOf,deliverySnapshot,changesBetween,parseConfirmation,parsePastedConfirmation} from './orders.mjs';
export async function orderRoutes(c){
 const {path,req,user,service,table,query,body,json,file,current,project,rowsFromBuffer,draft,fail}=c;
 const rpc=async(name,args)=>{const r=await service.rpc(name,args);if(r.error){if(r.error.code==='PT409')fail(409,'Պատվերն արդեն փոխվել է կամ նախադիտման ժամկետը լրացել է։ Վերաբացեք պատվերը');if(r.error.code==='PT404')fail(404,'Պատվերը չի գտնվել');console.error('Order operation',r.error.code);fail(500,'Չհաջողվեց պահպանել պատվերը');}return r.data;};
 const order=async(id,admin=false)=>{let q=table('orders').select('*').eq('id',id);if(!admin)q=q.eq('user_id',user.id);const row=await query(q.maybeSingle());if(!row)fail(404,'Պատվերը չի գտնվել');return row;};
 if(path==='orders'&&req.method==='POST'){
  const p=await body(req);if(!/^[a-f0-9-]{36}$/.test(p.requestId))fail(400,'Ուղարկման սխալ նույնացուցիչ');
  const existing=await query(table('orders').select('*').eq('user_id',user.id).eq('request_id',p.requestId).maybeSingle());if(existing)return json(existing);
  const v=await current(),products=project(v.products,user,v.rules),lines=normalizeLines(p.lines,products,[],false,user.role==='admin'&&p.priceMode==='KP'?'KP':'WS');if(!lines.length)fail(400,'Զամբյուղը դատարկ է');
  if(lines.some((line,i)=>Number(p.lines[i].unitPrice)!==line.unitPrice))fail(409,'Գները փոխվել են։ Թարմացրեք զամբյուղը և ստուգեք գումարը մինչև ուղարկելը');
  return json(await rpc('zzws_submit_order',{p_user:user.id,p_request:p.requestId,p_customer:{id:user.id,login:user.login,client:user.client},p_delivery:deliverySnapshot(p.delivery,user),p_lines:lines,p_total:totalOf(lines)}));
 }
 if(path==='orders'&&req.method==='GET'){
  const before=new URL(req.url).searchParams.get('before');let q=table('orders').select('*').eq('user_id',user.id).order('number',{ascending:false}).limit(50);if(before&&/^\d+$/.test(before))q=q.lt('number',before);return json({orders:await query(q)});
 }
 if(path==='orders/notifications'&&req.method==='GET'){
  const events=await query(table('order_events').select('id,order_id,revision,detail,created').eq('user_id',user.id).is('read_at',null).order('created',{ascending:false}).limit(50));
  return json({events:events.map(e=>({...e,detail:{...e.detail,changesCount:e.detail.changes?.length||0,changes:(e.detail.changes||[]).slice(0,12)}}))});
 }
 if(path==='orders/detail'&&req.method==='POST'){
  const p=await body(req),o=await order(p.id);const events=await query(table('order_events').select('id,detail,created,revision').eq('order_id',o.id).eq('user_id',user.id).order('revision',{ascending:false}).limit(10));return json({order:o,events});
 }
 if(path==='orders/read'&&req.method==='POST'){
  const p=await body(req);await order(p.orderId);await query(table('order_events').update({read_at:new Date().toISOString()}).eq('user_id',user.id).eq('order_id',p.orderId).is('read_at',null));return json({ok:true});
 }
 if(!path.startsWith('admin/orders'))return null;
 if(user.role!=='admin')fail(403,'Հասանելիությունն արգելված է');
 if(path==='admin/orders'&&req.method==='GET'){
  const params=new URL(req.url).searchParams,status=params.get('status'),before=params.get('before');let q=table('orders').select('*').order('number',{ascending:false}).limit(100);if(status&&statuses[status])q=q.eq('status',status);
  const search=String(params.get('search')||'').replace(/[^\p{L}\p{N} ._-]/gu,'').trim().slice(0,100);if(search){const terms=['customer->>client.ilike.*'+search+'*','customer->>login.ilike.*'+search+'*','delivery->>organization.ilike.*'+search+'*'];if(/^\d+$/.test(search)&&search.length<16)terms.push('number.eq.'+search);q=q.or(terms.join(','));}
  for(const [param,column] of [['from','gte'],['to','lt']]){const date=params.get(param);if(date&&/^\d{4}-\d{2}-\d{2}$/.test(date)){const stamp=new Date(date+'T00:00:00+04:00');if(!Number.isNaN(stamp.valueOf()))q=q[column]('created',new Date(stamp.valueOf()+(param==='to'?86400000:0)).toISOString());}}
  if(before&&/^\d+$/.test(before))q=q.lt('number',before);return json({orders:await query(q)});
 }
 if(path==='admin/orders/template'&&req.method==='GET')return file([['Արտիկուլ','Քանակ','Գին'],['014676',1,'']],'Final-order-template.xlsx');
 if(path==='admin/orders/detail'&&req.method==='POST'){const p=await body(req),o=await order(p.id,true);return json({...o,events:await query(table('order_events').select('detail,created,revision').eq('order_id',o.id).order('revision',{ascending:false}).limit(50))});}
 if(path==='admin/orders/export'&&req.method==='POST'){
  const p=await body(req),o=await order(p.id,true);return file([['Պատվեր',o.number,'Կարգավիճակ',statuses[o.status]],['Արտիկուլ','Անվանում','Քանակ','Գին','Գումար'],...o.lines.map(row=>[row.articul,row.name,row.qty,row.unitPrice,row.qty*row.unitPrice]),['Ընդամենը','','','',o.total]],'Order-'+o.number+'.xlsx');
 }
 const prepare=async(o,raw)=>{
  const customer=o.user_id?await query(table('users').select('*').eq('id',o.user_id).maybeSingle()):null;
  const v=await current(),products=customer?project(v.products,{...customer.profile,id:customer.id},v.rules):[];
  return normalizeLines(raw,products,o.lines,true);
 };
 if(path==='admin/orders/preview'&&req.method==='POST'){
  let orderId,revision,parsed,filename;
  if((req.headers.get('content-type')||'').includes('application/json')){const p=await body(req);orderId=p.orderId;revision=p.revision;parsed=parsePastedConfirmation(p.text);filename='Տեղադրված աղյուսակ';}
  else{const form=await req.formData(),upload=form.get('file');orderId=form.get('orderId');revision=Number(form.get('revision'));if(!(upload instanceof File)||!upload.name.toLowerCase().endsWith('.xlsx'))fail(400,'Ընտրեք XLSX');parsed=parseConfirmation(rowsFromBuffer(await upload.arrayBuffer()));filename=upload.name.slice(0,300);}
  const o=await order(orderId,true);if(revision!==o.revision)fail(409,'Պատվերն արդեն փոխվել է։ Վերաբացեք այն');
  const lines=await prepare(o,parsed.lines),changes=changesBetween(o.lines,lines);
  const d=await query(table('drafts').insert({actor:user.id,kind:'order',payload:{orderId:o.id,revision:o.revision,lines,changes,filename,metadata:parsed.metadata,delivery:parsed.delivery}}).select('id').single());
  return json({draft:d.id,lines,changes,total:totalOf(lines),orderNumber:o.number,metadata:parsed.metadata,delivery:parsed.delivery});
 }
 if(req.method==='POST'&&['admin/orders/update','admin/orders/apply'].includes(path)){
  const p=await body(req),d=path.endsWith('/apply')?await draft(p.draft,user.id,'order'):null;
  const o=await order(d?.payload.orderId||p.id,true),revision=d?.payload.revision??p.revision;
  if(revision!==o.revision)fail(409,'Պատվերն արդեն փոխվել է։ Վերաբացեք պատվերը');
  const status=d?'confirmed':p.status;if(!statuses[status])fail(400,'Անհայտ կարգավիճակ');
  const lines=d?d.payload.lines:await prepare(o,p.lines);if(!lines.length&&status!=='rejected')fail(400,'Դատարկ պատվերը կարելի է միայն մերժել');
  const comment=String(p.comment||'').trim().slice(0,2000),changes=changesBetween(o.lines,lines);
  if(d&&p.confirmCustomer!==true)fail(400,'Հաստատեք, որ աղյուսակը վերաբերում է ընտրված պատվերին');
  const delivery=d&&p.applyDelivery?{...o.delivery,...d.payload.delivery}:null;
  return json(await rpc('zzws_update_order',{p_order:o.id,p_revision:revision,p_lines:lines,p_status:status,p_comment:comment,p_total:totalOf(lines),p_detail:{number:o.number,changes,source:d?'confirmation':'manual',deliveryChanged:!!delivery&&JSON.stringify(delivery)!==JSON.stringify(o.delivery)},p_actor:user.id,p_draft:d?.id||null,p_delivery:delivery,p_confirmation:d?{...d.payload.metadata,filename:d.payload.filename}:null}));
 }
 return null;
}
