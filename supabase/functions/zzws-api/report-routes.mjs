import {mailReady,sendGmail} from './gmail-mail.mjs';
import {senderAddress} from './mail-config.mjs';
import {buildOrderContext} from './order-context.mjs';
import {email,emailRows,reportRecipients} from './report-email.mjs';
import {parseConfirmation,normalizeLines,changesBetween,totalOf} from './orders.mjs';
const encoder=new TextEncoder(),limit=10*1024*1024;
export const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value))).map(b=>b.toString(16).padStart(2,'0')).join('');
const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
export async function attachmentBundle(req,rowsFromBuffer){
 // Read a bounded multipart stream into temporary memory; never create files or drafts.
 const reader=req.body?.getReader();if(!reader)throw Error('Ընտրեք ֆայլերը');let size=0;const chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit+200000){await reader.cancel();throw Error('Ֆայլերի ընդհանուր չափը պետք է լինի մինչև 10 ՄԲ');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 const form=await new Response(bytes,{headers:{'content-type':req.headers.get('content-type')||''}}).formData();
 const files=form.getAll('files');if(!files.length||files.length>10||files.some(f=>typeof f==='string'||!f.size))throw Error('Ընտրեք 1-ից 10 ոչ դատարկ ֆայլ');
 if(files.reduce((s,f)=>s+f.size,0)>limit)throw Error('Ֆայլերի ընդհանուր չափը պետք է լինի մինչև 10 ՄԲ');
 const attachments=[];for(const f of files){if(/[\u0000-\u001f\u007f\u2028\u2029\\/]/u.test(f.name)||f.name.length>200)throw Error('Ֆայլի անվանումը սխալ է');const data=new Uint8Array(await f.arrayBuffer());attachments.push({name:f.name,size:f.size,data,hash:await sha(data)});}
 const candidates=[];for(let i=0;i<attachments.length;i++){const f=attachments[i];if(!/\.xlsx$/i.test(f.name))continue;try{const parsed=parseConfirmation(rowsFromBuffer(f.data.buffer));if(parsed.metadata?.format==='zigzag_sales_report'||/վաճառքի[\s_-]*հաշվետվություն/iu.test(f.name)){f.parsed=parsed;candidates.push(i);}}catch{/* Supplementary attachments need not be spreadsheets. */}}
 return {form,attachments,candidates,bundleHash:await sha(JSON.stringify(attachments.map(f=>[f.name,f.size,f.hash])))};
}
export async function sendReportMail({job,message,env,fetchImpl=fetch}){
 const mode=env('ZZWS_REPORT_EMAIL_MODE');
 if(mode==='offline'&&env('ZZWS_OFFLINE_MODE')==='true'&&globalThis.__ZZWS_OFFLINE__?.reportEmailSend)return globalThis.__ZZWS_OFFLINE__.reportEmailSend(job,message);
 if(mode==='gmail')return sendGmail({job,message,env});
 if(mode!=='resend'||!env('RESEND_API_KEY'))throw Error('Էլ․ փոստի ծառայությունը կարգավորված չէ');
 const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+env('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':'zzws-report/'+job.id},body:JSON.stringify(message)});
 const data=await response.json().catch(()=>null);if(response.ok&&typeof data?.id==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(data.id))return {result:'accepted',id:data.id};return {result:response.status>=400&&response.status<500?'rejected':'unknown'};
}
export async function reportRoutes(c){
 const {path,req,user,table,query,body,json,service,fail,current,project,rowsFromBuffer}=c;
 if(path!=='admin/email-settings'&&!path.startsWith('admin/orders/report-'))return null;
 if(req.method!=='POST'&&!(path==='admin/email-settings'&&req.method==='GET'))fail(405,'Հարցման մեթոդը չի թույլատրվում');
 const settings=()=>query(table('report_email_settings').select('*').eq('id',true).single());
 if(path==='admin/email-settings'){
  if(user.role!=='admin'||user.adminScope!=='owner')fail(403,'Հասանելիությունն արգելված է');
  const state=s=>{
   const env=n=>Deno.env.get(n),effectiveFrom=s.from_email||env('ZZWS_REPORT_FROM')||'';let deliveryIssue='';
   if(!mailReady(env))deliveryIssue='Փոստային ծառայությունը դեռ միացված չէ։ Հասցեները կարող եք պահպանել հիմա։ Ուղարկելու համար դիմեք կայքի պատասխանատուին։';
   else try{senderAddress(s,env);}catch(e){deliveryIssue=e.message;}
   return {...s,effectiveFrom,deliveryReady:!deliveryIssue,deliveryIssue};
  };
  if(req.method==='GET')return json(state(await settings()));
  const p=await body(req);if(!Array.isArray(p.cc)||p.cc.length!==3)fail(400,'Լրացրեք երեք CC հասցեները');const cc=p.cc.map(v=>email(v,{optional:true}));
  if(!Object.hasOwn(p,'fromEmail'))return json(state(await query(service.rpc('zzws_report_settings_save',{p_actor:user.id,p_revision:p.revision,p_cc:cc}))));
  // Persist valid settings independently of transport setup; sending still validates the connected sender.
  const from=email(p.fromEmail,{optional:true});
  return json(state(await query(service.rpc('zzws_email_settings_save',{p_actor:user.id,p_revision:p.revision,p_cc:cc,p_from:from}))));
 }
 if(user.role!=='admin'||!user.permissions?.includes('orders:write'))fail(403,'Հասանելիությունն արգելված է');
 const rpc=(name,args)=>query(service.rpc(name,args));
 const getOrder=async id=>{const o=await query(table('orders').select('*').eq('id',id).maybeSingle());if(!o)fail(404,'Պատվերը չի գտնվել');return o;};
 const complete=async(o,j,prepared)=>{if(j.state==='completed')return {accepted:true,completed:true,duplicate:true,orderId:o.id};if(!prepared)return {accepted:true,completed:false,statusPending:true,needsFiles:true,jobId:j.id};try{return await rpc('zzws_report_complete',{p_actor:user.id,p_order:o.id,p_job:j.id,p_lines:prepared.lines,p_total:totalOf(prepared.lines),p_changes:prepared.changes,p_context:prepared.context});}catch{return {accepted:true,completed:false,statusPending:true,jobId:j.id};}};
 if(path==='admin/orders/report-status'){
  const p=await body(req),o=await getOrder(p.orderId);let q=table('report_deliveries').select('*').eq('order_id',o.id);q=p.jobId?q.eq('id',p.jobId):q.eq('request_id',p.requestId);const j=await query(q.maybeSingle());if(!j)return json({found:false});if(['accepted','completed'].includes(j.state))return json(await complete(o,j));return json({found:true,state:j.state,jobId:j.id,attempts:j.attempts,busy:j.state==='sending'&&Date.parse(j.lease_until)>Date.now()});
 }
 if(path==='admin/orders/report-options'){
  const p=await body(req),o=await getOrder(p.orderId),customer=await query(table('users').select('profile').eq('id',o.user_id).maybeSingle()),s=await settings();return json({rows:emailRows(customer?.profile.emailRows||[]),cc:s.cc,replyTo:user.replyToEmail||'',orderId:o.id,revision:o.revision});
 }
 const bundle=await attachmentBundle(req,rowsFromBuffer),{form,attachments,candidates,bundleHash}=bundle,o=await getOrder(form.get('orderId')),revision=Number(form.get('revision'));
 if(['received','completed','rejected'].includes(o.status))fail(409,'Փակված պատվերի համար նախ նշեք պատճառը և փոխեք կարգավիճակը հատուկ կոճակով');
 if(path==='admin/orders/report-inspect')return json({candidates,files:attachments.map(f=>({name:f.name,size:f.size}))});
 const rawIndex=form.get('reportIndex');if(typeof rawIndex!=='string'||!/^\d{1,2}$/.test(rawIndex))fail(400,'Ընտրեք հաշվետվության ֆայլը');const index=Number(rawIndex);if(!candidates.includes(index))fail(400,'Ընտրեք վաճառքի հաշվետվության ֆայլը');
 const parsed=attachments[index].parsed,customer=await query(table('users').select('*').eq('id',o.user_id).maybeSingle()),v=await current(),products=customer?project(v.products,{...customer.profile,id:customer.id},v.rules,{forOrder:true}):[],lines=normalizeLines(parsed.lines,products,o.lines,true),changes=changesBetween(o.lines,lines);
 const secret=Deno.env.get('SUPABASE_SECRET_KEYS')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!secret)fail(503,'Ծառայությունը կարգավորված չէ');
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 const proofData=expiry=>JSON.stringify([user.id,o.id,revision,index,bundleHash,expiry]);
 if(path==='admin/orders/report-preview'){
  if(revision!==o.revision||o.received_at)fail(409,'Պատվերն արդեն փոխվել է');const expiry=Date.now()+23*3600000,proof=b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(proofData(expiry)))));return json({lines,changes,total:totalOf(lines),orderId:o.id,revision:o.revision,expiry,proof});
 }
 if(!['admin/orders/report-send','admin/orders/report-complete'].includes(path))return null;
 const expiry=Number(form.get('expiry'));let valid=false;try{valid=expiry>Date.now()&&expiry<=Date.now()+23*3600000&&await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(String(form.get('proof'))),c=>c.charCodeAt(0)),encoder.encode(proofData(expiry)));}catch{}if(!valid&&path!=='admin/orders/report-complete')fail(400,'Կրկին կատարեք ֆայլի համեմատությունը');
 if(!lines.length)fail(400,'Դատարկ պատվերը չի կարող հաստատվել հաշվետվությամբ');
 const previous=await query(table('order_calculation_contexts').select('context').eq('order_id',o.id).order('order_revision',{ascending:false}).limit(1).maybeSingle());
 const context=buildOrderContext({catalog:v,user:customer?{...customer.profile,id:customer.id,profileRevision:customer.profile_revision}:null,lines,previousOrder:o,previousContext:previous?.context||null,source:'confirmation'}),prepared={lines,changes,context};
 if(path==='admin/orders/report-complete'){
  const j=await query(table('report_deliveries').select('*').eq('id',form.get('jobId')).eq('order_id',o.id).maybeSingle());
  if(!j||j.actor_id!==user.id||j.counts.bundleHash!==bundleHash||j.counts.reportIndex!==index||j.order_revision!==revision)fail(409,'Ֆայլերը չեն համապատասխանում ուղարկված հաշվետվությանը');
  if(!['accepted','completed'].includes(j.state))fail(409,'Նամակի ընդունումը հաստատված չէ');return json(await complete(o,j,prepared));
 }
 if(form.get('confirmCustomer')!=='true')fail(400,'Հաստատեք ընտրված հաճախորդին');
 const requestId=String(form.get('requestId'));if(!/^[a-f0-9-]{36}$/i.test(requestId))fail(400,'Ուղարկման սխալ նույնացուցիչ');
 const s=await settings(),recipients=reportRecipients(customer?.profile.emailRows||[],JSON.parse(String(form.get('selectedRows')||'[]')),s.cc,String(form.get('additionalCC')||''),user.replyToEmail),env=n=>Deno.env.get(n),mode=env('ZZWS_REPORT_EMAIL_MODE'),from=senderAddress(s,env);
 if(!mailReady(env))fail(503,'Էլ․ փոստի ծառայությունը կարգավորված չէ');
 if(env('ZZWS_ENVIRONMENT')!=='production'&&mode!=='offline'){const allowed=new Set(String(env('ZZWS_REPORT_TEST_RECIPIENTS')||'').split(',').filter(Boolean).map(v=>email(v)));if([...recipients.to,...recipients.cc].some(v=>!allowed.has(v)))fail(403,'Փորձարկման հասցեն թույլատրված չէ');}
 const fingerprint=await sha(JSON.stringify([o.id,bundleHash,index,recipients,from])),counts={transport:mode==='gmail'?'smtp':'idempotent',bundleHash,reportIndex:index,files:attachments.length,bytes:attachments.reduce((s,f)=>s+f.size,0),to:recipients.to.length,cc:recipients.cc.length};
 let j=await rpc('zzws_report_claim',{p_actor:user.id,p_order:o.id,p_revision:revision,p_request:requestId,p_fingerprint:fingerprint,p_counts:counts});
 if(['accepted','completed'].includes(j.state))return json(await complete(o,j,prepared));if(j.busy)return json({busy:true,jobId:j.id});if(j.state!=='sending')return json({manual:true,jobId:j.id,attempts:j.attempts});
 const message={from,to:recipients.to,cc:recipients.cc,reply_to:recipients.replyTo,subject:'Վաճառքի Հաշվետվություն',text:'Պատվեր №'+o.number+'։ Կցված է վաճառքի հաշվետվությունը՝ համեմատության համար։',attachments:attachments.map(f=>({filename:f.name,content:b64(f.data)}))};
 let outcome;try{outcome=await sendReportMail({job:j,message,env});}catch{outcome={result:'unknown'};}
 j=await rpc('zzws_report_result',{p_actor:user.id,p_job:j.id,p_lease:j.lease,p_result:outcome.result,p_provider:outcome.id||null});
 if(j.state==='accepted')return json(await complete(o,j,prepared));return json({accepted:false,retryable:j.state==='retry',manual:j.state!=='retry',jobId:j.id,attempts:j.attempts});
}

