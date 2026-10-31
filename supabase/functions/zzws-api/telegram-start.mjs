import {telegramTransport} from './telegram-transport.mjs';
// Pure /start processing boundary. No import-time network activity.
export const START_REPLIES=Object.freeze({welcome:'Բարի գալուստ ZZWS։ Ձեր Telegram հաշիվը հաստատված է, և դուք միացված եք ZZWS պատվերների ծանուցումներին։ Այստեղ կստանաք նոր պատվերների և դրանց փոփոխությունների մասին տեղեկություններ։ Պատվերների կառավարումն իրականացվում է ZZWS-ում։',denied:'Доступ запрещён'});
export function startCommand(update,botUsername){
 if(!Number.isSafeInteger(update?.update_id)||update.update_id<0)return null;
 const m=update.message;if(m?.chat?.type!=='private'||m.from?.is_bot!==false||!Number.isSafeInteger(m.chat.id)||!Number.isSafeInteger(m.from.id)||m.from.id!==m.chat.id||m.chat.id<=0||m.chat.id>4503599627370495||typeof m.text!=='string'||m.text.length>4096)return null;
 const match=m.text.trim().match(/^\/start(?:@([A-Za-z][A-Za-z0-9_]{4,31}))?(?:\s[^\r\n]*)?$/i);if(!match||match[1]&&match[1].toLowerCase()!==botUsername.toLowerCase())return null;
 return {updateId:update.update_id,chatId:String(m.chat.id)};
}
async function secretMatches(actual,expected){if(typeof actual!=='string')return false;const digest=s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));const [a,b]=await Promise.all([digest(actual),digest(expected)]);const x=new Uint8Array(a),y=new Uint8Array(b);let difference=0;for(let i=0;i<x.length;i++)difference|=x[i]^y[i];return difference===0;}
export async function handleStartWebhook(req,{enabled=false,secret,botUsername='zzws_orders_notify_bot',store,send}){
 const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(!enabled||typeof secret!=='string'||!/^[-_A-Za-z0-9]{32,256}$/.test(secret))return reply(503,{ok:false});
 if(req.method!=='POST')return reply(405,{ok:false});
 if(!await secretMatches(req.headers.get('X-Telegram-Bot-Api-Secret-Token'),secret))return reply(403,{ok:false});
 let update;
 try{const reader=req.body?.getReader();if(!reader)return reply(400,{ok:false});let size=0,chunks=[];while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>65536){await reader.cancel();return reply(413,{ok:false});}chunks.push(part.value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}update=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply(400,{ok:false});}
 const command=startCommand(update,botUsername);if(!command)return reply(200,{ok:true});
 try{
  const job=await store.rpc('zzws_prepare_start',{p_bot:botUsername,p_update:command.updateId,p_chat:command.chatId});
  if(job?.skip)return reply(200,{ok:true});if(job?.retryAfter)return reply(503,{ok:false});
  if(!job||!Object.hasOwn(START_REPLIES,job.kind)||job.chatId!==command.chatId)return reply(503,{ok:false});
  let result;try{result=await send(job);}catch{result={state:'uncertain'};}
  if(!['sent','retry','dead','uncertain'].includes(result?.state))result={state:'uncertain'};
  const saved=await store.rpc('zzws_finish_start',{p_id:job.id,p_token:job.leaseToken,p_result:result.state,p_message:result.messageId||null,p_retry_seconds:result.retrySeconds||30});
  return saved?reply(result.state==='retry'?503:200,{ok:result.state!=='retry'}):reply(503,{ok:false});
 }catch{return reply(503,{ok:false});}
}

// This boundary may reply to an unapproved PRIVATE user, but can send only two fixed texts.
// It is never used for order notifications or arbitrary content.
export function startReplyTransport({token,botUsername,enabled=false,fetchImpl=globalThis.fetch}){
 return async job=>{
  if(!enabled)return {state:'disabled'};
  if(!job||!Object.hasOwn(START_REPLIES,job.kind))return {state:'dead',code:'invalid_start_reply'};
  const send=telegramTransport({token,allowedIds:[job.chatId],expectedBotUsername:botUsername,enabled:true,fetchImpl});
  return send(job.chatId,START_REPLIES[job.kind]);
 };
}

