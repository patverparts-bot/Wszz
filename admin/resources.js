(() => {
 'use strict';
 const el=id=>document.getElementById(id);
 async function channelError(error,who,telegram){
  const fallback=ZZWS.message(error);if(error.status!==400||!telegram)return fallback;
  try{
   const data=await ZZWS.json('admin/users'),user=data.users?.find(u=>u.id===who.id);
   if(user?.role==='admin'&&!user.adminScope)return 'Նախ նշանակեք այս ադմինիստրատորի իրավունքները «Աշխատակցի իրավունքներ» բաժնում և սեղմեք «Պահպանել իրավունքները»։ Telegram-ի համար ընտրեք «Պատվերների մենեջեր» կամ «Միայն դիտում»։ Այնուհետև կրկին պահպանեք Telegram-ի տվյալները։';
   if(user?.role==='admin'&&user.adminScope==='price')return 'Գնացուցակի օպերատորը պատվերների Telegram ծանուցումներ ստանալու իրավունք չունի։ Եթե աշխատակիցը պետք է տեսնի պատվերները, ընտրեք համապատասխան դերը և սեղմեք «Պահպանել իրավունքները», ապա կրկին պահպանեք Telegram-ի տվյալները։';
  }catch{}
  return fallback;
 }
 let allowed=false,target=null,saving=false,serial=0;
 function reset(){allowed=false;target=null;++serial;const panel=el('adminChannelsPanel');if(panel)panel.hidden=true;window.ZZWS_ADMIN_RESOURCES?.reset();window.ZZWS_APK_UPLOAD?.reset();}
 function start(user){reset();allowed=user?.adminScope==='owner'&&Array.isArray(user.permissions)&&user.permissions.includes('users');window.ZZWS_ADMIN_RESOURCES?.start(user,{root:el('adminResourcesPanel')});window.ZZWS_APK_UPLOAD?.start(user);}
 function edit(user){
  ++serial;target=user?.id&&user.role==='admin'?{id:user.id,login:user.login,revision:user.channelRevision??0}:null;
  const panel=el('adminChannelsPanel');if(!panel)return;panel.hidden=!allowed||!target;
  el('mobileAdminEnabled').checked=user?.mobileAdminEnabled===true;el('telegramEnabled').checked=user?.telegramEnabled===true;el('telegramRecipientId').value=user?.telegramId||'';el('telegramBotUsername').value=user?.telegramBotUsername||'zzws_orders_notify_bot';el('adminChannelsStatus').textContent='';
 }
 el('saveAdminChannels').onclick=async()=>{
  if(!allowed||!target||saving)return;const who={...target},requestSerial=serial;let telegram=false;saving=true;el('saveAdminChannels').disabled=true;el('adminChannelsStatus').textContent='Պահպանվում է…';
  try{
   const flags={mobileAdminEnabled:el('mobileAdminEnabled').checked,telegramEnabled:el('telegramEnabled').checked,telegramId:el('telegramRecipientId').value.trim(),telegramBotUsername:el('telegramBotUsername').value.trim()};
   telegram=flags.telegramEnabled;
   if(flags.telegramEnabled&&!/^[1-9][0-9]{0,15}$/.test(flags.telegramId))throw Error('Մուտքագրեք ստացողի անձնական թվային Telegram ID-ն։ Այն ցույց է տալիս @userinfobot-ը։');
   const result=await ZZWS.json('admin/users/channels',{method:'POST',body:JSON.stringify({id:who.id,expectedRevision:who.revision,...flags})});
   if(requestSerial!==serial||target?.id!==who.id)return;
   target.revision=result.channels?.revision??target.revision;
   if(typeof users!=='undefined'){const row=users.find(u=>u.id===who.id);if(row)Object.assign(row,flags,{telegramBotUsername:result.channels?.telegram_bot_username||'',channelRevision:target.revision});}
   el('adminChannelsStatus').textContent=flags.telegramEnabled&&!flags.telegramBotUsername?'Տվյալները պահպանված են։ Նշեք նաև ZZWS բոտի անունը՝ միացման հրահանգները լրացնելու համար։':'Հավելվածի և Telegram-ի տվյալները պահպանված են։';
   await window.ZZWS_ADMIN_RESOURCES?.refresh();
  }catch(error){if(requestSerial===serial&&target?.id===who.id){const message=await channelError(error,who,telegram);if(requestSerial===serial&&target?.id===who.id)el('adminChannelsStatus').textContent=message;}}
  finally{saving=false;el('saveAdminChannels').disabled=false;}
 };
 window.ZZWS_ADMIN_CHANNELS=Object.freeze({start,edit,reset});
})();
