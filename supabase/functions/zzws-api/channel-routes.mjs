export async function channelFlags(table,query,user){
 const row=await query(table('user_channels').select('*').eq('user_id',user.id).maybeSingle());
 const admin=user.active!==false&&user.role==='admin'&&['owner','manager','viewer','price'].includes(user.adminScope);
 return {mobileAdminEnabled:admin&&row?.mobile_admin_enabled===true,telegramEnabled:admin&&row?.telegram_enabled===true,channelRevision:row?.revision??0};
}
export async function channelRoutes(c){
 const {path,req,user,service,table,query,body,json,fail}=c;
 const flags={mobileAdminEnabled:user.mobileAdminEnabled===true,telegramEnabled:user.telegramEnabled===true,channelRevision:user.channelRevision??0};
 if(req.method==='GET'&&['me/resources','admin/resources'].includes(path)){
  const bucket=Deno.env.get('ZZWS_APK_BUCKET'),asset=Deno.env.get('ZZWS_APK_PATH'),offline=Deno.env.get('ZZWS_OFFLINE_MODE')==='true';
  const connections=await query(service.rpc('zzws_telegram_destinations',{}));
  const connection=connections?.find(c=>c.userId===user.id);
  const bot=connection?.botUsername||Deno.env.get('ZZWS_TELEGRAM_BOT_USERNAME')||'zzws_orders_notify_bot';
  return json({...flags,apk:{available:flags.mobileAdminEnabled&&!!bucket&&!!asset,version:Deno.env.get('ZZWS_APK_VERSION')||'6.0.0',filename:'ZZWS-Admin.apk',path:'me/resources/apk'},telegram:{canSimulateStart:offline&&user.adminScope==='owner',recipientConfigured:flags.telegramEnabled&&connection?.userId===user.id,mode:flags.telegramEnabled?(offline?'offline':bot?'configured':'disabled'):'disabled',instructions:offline?'Ինքնավար ստուգում․ Telegram հաղորդագրությունները ցուցադրվում են տեղական ստուգման պատուհանում։ Իրական հաղորդագրություններ չեն ուղարկվում։':'Telegram ծանուցումները միացնում է սեփականատերը միայն հաստատված օգտատիրոջ ID-ի համար։ Բացեք կազմակերպության բոտը և սեղմեք Start։ Մի փոխանցեք գաղտնաբառերը կամ բոտի գաղտնի բանալին։',...(flags.telegramEnabled&&/^[a-zA-Z0-9_]{5,32}$/.test(bot)?{botUsername:bot}:{})}});
 }
 if(req.method==='GET'&&path==='me/resources/apk'){
  if(!flags.mobileAdminEnabled)fail(403,'APK հասանելիությունը թույլատրված չէ');
  const bucket=Deno.env.get('ZZWS_APK_BUCKET'),asset=Deno.env.get('ZZWS_APK_PATH');if(!bucket||!asset)fail(503,'APK դեռ չի հրապարակվել');
  const result=await service.storage.from(bucket).download(asset);if(result.error||!result.data)fail(503,'APK դեռ հասանելի չէ');
  return new Response(result.data,{headers:{'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="ZZWS-Admin.apk"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(req.method==='POST'&&path==='admin/users/channels'){
  const p=await body(req);if(user.adminScope!=='owner')fail(403,'Անհրաժեշտ է սեփականատիրոջ իրավունք');
  if(typeof p.mobileAdminEnabled!=='boolean'||typeof p.telegramEnabled!=='boolean'||typeof p.id!=='string'||!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<0)fail(400,'Ստուգեք ալիքների իրավունքները');
  const setId=Object.hasOwn(p,'telegramId'),setBot=Object.hasOwn(p,'telegramBotUsername');
  const id=setId?String(p.telegramId??'').trim():null;
  const bot=setBot?String(p.telegramBotUsername??'').trim().replace(/^https:\/\/t\.me\//i,'').replace(/^@/,'').replace(/\/$/,''):null;
  if(setId&&id&&(!/^[1-9][0-9]{0,15}$/.test(id)||BigInt(id)>4503599627370495n))fail(400,'Մուտքագրեք ստացողի անձնական թվային Telegram ID-ն');
  if(setBot&&bot&&(!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(bot)||['botfather','userinfobot'].includes(bot.toLowerCase())))fail(400,'Նշեք ZZWS ծանուցումների բոտը․ BotFather-ը և userinfobot-ը սպասարկող բոտեր են');
  const result=await service.rpc('zzws_save_channels_v2',{p_actor:user.id,p_user:p.id,p_mobile:p.mobileAdminEnabled,p_telegram:p.telegramEnabled,p_expected:p.expectedRevision,p_set_id:setId,p_telegram_id:id,p_set_bot:setBot,p_bot_username:bot});
  if(result.error)fail(result.error.code==='PT409'?409:result.error.code==='PT403'?403:400,'Տվյալները փոխվել են կամ Telegram ID-ն արդեն կցված է այլ ադմինիստրատորի։ Թարմացրեք քարտը և ստուգեք ID-ն։');
  return json({ok:true,channels:result.data,mobileAdminEnabled:result.data.mobile_admin_enabled,telegramEnabled:result.data.telegram_enabled,channelRevision:result.data.revision});
 }
 if(req.method==='POST'&&['admin/devices/register','admin/devices/revoke'].includes(path)){
  if(!flags.mobileAdminEnabled)fail(403,'Android հասանելիությունը թույլատրված չէ');
  const p=await body(req);if(typeof p.deviceId!=='string'||!/^[a-zA-Z0-9_.:-]{8,200}$/.test(p.deviceId))fail(400,'Սարքի սխալ նույնացուցիչ');
  const revoke=path.endsWith('/revoke');
  if(!revoke&&(typeof p.token!=='string'||p.token.length<20||p.token.length>4096||/\s/.test(p.token)))fail(400,'Սարքի սխալ կոդ');
  const result=await service.rpc('zzws_register_android_device',{p_user:user.id,p_device:p.deviceId,p_token:revoke?null:p.token,p_revoke:revoke});
  if(result.error)fail(result.error.code==='PT409'?409:result.error.code==='PT403'?403:400,'Սարքը չի գրանցվել։ Թարմացրեք մուտքը կամ ստուգեք հասանելիությունը');
  return json({ok:true});
 }
 return null;
}

