// Explicit UTF-16 entities keep all user text literal: no HTML/Markdown parsing.
export function telegramEntities(text){
 const entities=[];let offset=0;
 for(const line of text.split('\n')){if(line.length&&(offset===0||line.startsWith('🔄 ')||line.startsWith('💰 ')||line==='📦 ԱՊՐԱՆՔՆԵՐ'))entities.push({type:'bold',offset,length:line.length});offset+=line.length+1;}
 return entities;
}
export function telegramIds(values){
 const ids=typeof values==='string'?values.split(',').map(s=>s.trim()).filter(Boolean):values;
 if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(x=>typeof x!=='string'||!/^\d{1,16}$/.test(x)||x[0]==='0'||BigInt(x)>4503599627370495n))throw new Error('invalid_telegram_allowlist');
 return [...new Set(ids)]; // Private numeric Telegram IDs only; never groups or @usernames.
}
export function telegramTransport({token,allowedIds,expectedBotUsername=null,enabled=false,fetchImpl=globalThis.fetch}){
 const allowed=new Set(telegramIds(allowedIds));
 if(typeof token!=='string'||!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token))throw new Error('invalid_bot_token');
 if(expectedBotUsername!==null&&(!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(expectedBotUsername)||['botfather','userinfobot'].includes(expectedBotUsername.toLowerCase())))throw Error('invalid_notification_bot');
 let verified=false;
 return async(destination,text)=>{
  if(!enabled)return {state:'disabled'};
  if(!allowed.has(destination))return {state:'dead',code:'not_allowlisted'};
  if(typeof text!=='string'||!text.length||text.length>4096)return {state:'dead',code:'invalid_message'};
  if(expectedBotUsername&&!verified){
   try{const response=await fetchImpl('https://api.telegram.org/bot'+token+'/getMe',{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000)});const data=await response.json();
    if(response.status===200&&data?.ok===true&&data.result?.is_bot===true){if(String(data.result.username).toLowerCase()!==expectedBotUsername.toLowerCase())return {state:'dead',code:'bot_identity_mismatch'};verified=true;}
    else return {state:[401,403].includes(response.status)?'dead':'retry',code:'bot_identity_unavailable',retrySeconds:30};
   }catch{return {state:'retry',code:'bot_identity_unavailable',retrySeconds:30};}
  }
  try{
   const response=await fetchImpl('https://api.telegram.org/bot'+token+'/sendMessage',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:destination,text,entities:telegramEntities(text),protect_content:true,link_preview_options:{is_disabled:true}})
   });
   const data=await response.json();
   if(response.status===200&&data?.ok===true&&Number.isSafeInteger(data.result?.message_id)&&data.result.message_id>0&&data.result.chat?.type==='private'&&String(data.result.chat.id)===destination)return {state:'sent',messageId:String(data.result.message_id)};
   if(data?.ok===false&&data.error_code===429&&response.status===429&&Number.isSafeInteger(data.parameters?.retry_after)&&data.parameters.retry_after>0&&data.parameters.retry_after<=604800)return {state:'retry',code:'rate_limit',retrySeconds:data.parameters.retry_after};
   if(data?.ok===false&&response.status===data.error_code&&[400,401,403,404].includes(data.error_code))return {state:'dead',code:data.error_code===401?'bot_unauthorized':data.error_code===403?'recipient_forbidden':'request_rejected'};
   // 5xx, invalid JSON/response, redirect and network failure may follow acceptance.
   return {state:'uncertain',code:'ambiguous_response'};
  }catch(error){
   // Failures before a connection exists cannot have delivered an HTTP request.
   if(['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','UND_ERR_CONNECT_TIMEOUT'].includes(error?.cause?.code))return {state:'retry',code:'connection_not_established',retrySeconds:30};
   return {state:'uncertain',code:'transport_failure'};
  }
 };
}

