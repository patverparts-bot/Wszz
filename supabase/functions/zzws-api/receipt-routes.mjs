import {validateReceiptControl,publicReceiptState} from './receipt-policy.mjs';
export async function receiptRoutes(c){
 const {path,req,user,service,table,query,body,json,fail}=c;
 const rpc=async(name,args)=>{const r=await service.rpc(name,args);if(r.error){const code=r.error.code;if(code==='PT429')fail(409,'Նոր պատվերի համար նախ հաստատեք բոլոր չստացված պատվերների ստացումը');if(code==='PT409')fail(409,'Պատվերը կամ կարգավորումն արդեն փոխվել է։ Թարմացրեք տվյալները');if(code==='PT404')fail(404,'Պատվերը կամ հաշիվը չի գտնվել');if(code==='PT403')fail(403,'Հասանելիությունն արգելված է');if(code==='PT400')fail(400,'Ստուգեք ստացման հաստատումն ու ժամկետը');fail(500,'Չհաջողվեց պահպանել ստացման տվյալները');}return r.data;};
 const uuid=value=>{if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))fail(400,'Սխալ նույնացուցիչ');return value;};
 if(path==='orders/receipt-state'&&req.method==='GET')return json(publicReceiptState(await rpc('zzws_receipt_state',{p_user:user.id})));
 if(path==='orders/receipt'&&req.method==='POST'){
  const p=await body(req);uuid(p.id);if(p.intact!==true||!Number.isSafeInteger(p.revision)||p.revision<1)fail(400,'Հաստատեք ապրանքների ամբողջական և անվնաս ստացումը');
  const order=await rpc('zzws_confirm_receipt',{p_user:user.id,p_order:p.id,p_revision:p.revision,p_intact:true});return json({order,state:publicReceiptState(await rpc('zzws_receipt_state',{p_user:user.id}))});
 }
 if(path==='admin/receipt-control'&&req.method==='GET'){const setting=await query(table('receipt_settings').select('*').eq('id',true).single());return json({setting});}
 if(path==='admin/users/receipt-control'&&req.method==='GET'){const id=uuid(new URL(req.url).searchParams.get('id'));return json({state:await rpc('zzws_receipt_state',{p_user:id})});}
 if(['admin/receipt-control','admin/users/receipt-control'].includes(path)&&req.method==='POST'){
  const p=await body(req),global=path==='admin/receipt-control',id=global?null:uuid(p.id),control=validateReceiptControl(p,global);
  if(id){const target=await query(table('users').select('profile').eq('id',id).maybeSingle());if(!target||target.profile.role!=='client')fail(400,'Ընտրեք հաճախորդի հաշիվ');}
  const setting=await rpc('zzws_save_receipt_control',{p_actor:user.id,p_user:id,p_mode:control.mode,p_until:control.until,p_revision:control.revision});return json(global?{setting}:{setting,state:await rpc('zzws_receipt_state',{p_user:id})});
 }
 if(path==='admin/orders/receipt-notifications'&&req.method==='GET')return json(await rpc('zzws_admin_receipt_notices',{p_admin:user.id}));
 if(path==='admin/orders/receipt-notifications/read'&&req.method==='POST'){
  const p=await body(req),id=uuid(p.id);const notice=await query(table('receipt_notices').select('id').eq('id',id).maybeSingle());if(!notice)fail(404,'Ծանուցումը չի գտնվել');await query(table('admin_notice_reads').upsert({notice_id:id,user_id:user.id,read_at:new Date().toISOString()}));return json({ok:true});
 }
 return null;
}
