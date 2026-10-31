export const mobileDefaults=Object.freeze({enabled:false,orders:true,comments:true,prices:false,offers:false,system:true,revision:0});
export async function mobileRoutes(c){
 const {path,req,user,table,query,service,body,json,fail}=c;
 const canOrderPush=user.role==='admin'&&user.mobileAdminEnabled===true&&user.permissions?.includes('orders:read');
 const preferences=row=>{const value={...mobileDefaults,...row};if(canOrderPush){value.admin_new_orders=row?.admin_new_orders??true;value.admin_status_changes=row?.admin_status_changes??true;}else{delete value.admin_new_orders;delete value.admin_status_changes;}return value;};
 const rpc=async(name,args)=>{const r=await service.rpc(name,args);if(r.error)fail(r.error.code==='PT409'?409:r.error.code==='PT403'?403:400,'Չհաջողվեց պահպանել ծանուցումների տվյալները։ Թարմացրեք կարգավորումները');return r.data;};
 if(path==='me/mobile/preferences'&&req.method==='GET')return json(preferences(await query(table('mobile_preferences').select('enabled,orders,comments,prices,offers,system,revision,admin_new_orders,admin_status_changes').eq('user_id',user.id).maybeSingle())));
 if(path==='me/mobile/preferences'&&req.method==='POST'){
  const p=await body(req),value={};for(const key of ['enabled','orders','comments','prices','offers','system']){if(typeof p[key]!=='boolean')fail(400,'Ստուգեք բաժանորդագրությունները');value[key]=p[key];}
  for(const key of ['admin_new_orders','admin_status_changes'])if(Object.hasOwn(p,key)){if(!canOrderPush)fail(403,'Պատվերները դիտելու իրավունք է պահանջվում');if(typeof p[key]!=='boolean')fail(400,'Ստուգեք բաժանորդագրությունները');value[key]=p[key];}
  if(!Number.isSafeInteger(p.revision)||p.revision<0)fail(400,'Ստուգեք կարգավորումների տարբերակը');
  return json(preferences(await rpc('zzws_save_mobile_preferences',{p_user:user.id,p_value:value,p_expected:p.revision})));
 }
 if(['me/mobile/register','me/mobile/revoke'].includes(path)&&req.method==='POST'){
  const p=await body(req),revoke=path.endsWith('/revoke');
  if(typeof p.deviceId!=='string'||!/^[a-zA-Z0-9_.:-]{8,200}$/.test(p.deviceId)||!revoke&&(typeof p.token!=='string'||p.token.length<20||p.token.length>4096||/[\s\x00-\x1f\x7f]/.test(p.token)))fail(400,'Ստուգեք սարքի տվյալները');
  return json(await rpc('zzws_register_mobile_device',{p_user:user.id,p_device:p.deviceId,p_token:revoke?null:p.token,p_revoke:revoke}));
 }
 if(path==='admin/mobile/notices'&&req.method==='POST'){
  if(user.role!=='admin'||user.adminScope!=='owner')fail(403,'Սեփականատիրոջ իրավունք է պահանջվում');
  const p=await body(req);if(!['catalog.offers','system'].includes(p.kind)||typeof p.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(p.requestId))fail(400,'Ստուգեք ծանուցումը');
  return json({id:await rpc('zzws_mobile_notice',{p_kind:p.kind,p_source:'notice:'+user.id+':'+p.requestId})});
 }
 return null;
}

