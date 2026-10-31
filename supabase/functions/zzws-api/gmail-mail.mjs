import {email} from './report-email.mjs';
import {smtpReady} from './smtp-mail.mjs';

export function mailReady(env){
 const mode=env('ZZWS_REPORT_EMAIL_MODE');
 return mode==='offline'&&env('ZZWS_OFFLINE_MODE')==='true'||mode==='resend'&&!!env('RESEND_API_KEY')||mode==='gmail'&&!!env('ZZWS_GMAIL_APP_PASSWORD')&&!!env('ZZWS_GMAIL_USER')||mode==='smtp'&&smtpReady(env);
}

// SMTP has no idempotency API. Unknown outcomes must be quarantined by the delivery ledger.
export async function sendGmail({job,message,env,createTransport}){
 const user=email(env('ZZWS_GMAIL_USER')||'');
 if(email(message.from)!==user)throw Error('Ուղարկողի հասցեն չի համապատասխանում միացված Gmail հաշվին');
 const to=[...new Set((message.to||[]).map(v=>email(v)))];
 const cc=[...new Set((message.cc||[]).map(v=>email(v)))].filter(v=>!to.includes(v));
 if(!to.length||to.length+cc.length>50)throw Error('Ստացողների սխալ ցանկ');
 if(env('ZZWS_ENVIRONMENT')!=='production'){
  const allowed=new Set((env('ZZWS_REPORT_TEST_RECIPIENTS')||'').split(',').filter(Boolean).map(v=>email(v)));
  if([...to,...cc].some(v=>!allowed.has(v)))throw Error('Փորձարկման հասցեն թույլատրված չէ');
 }
 const replyTo=message.reply_to?email(message.reply_to):undefined;
 const make=createTransport||(await import('npm:nodemailer@10.3.1')).default.createTransport;
 const transport=make({host:'smtp.gmail.com',port:465,secure:true,auth:{user,pass:(env('ZZWS_GMAIL_APP_PASSWORD')||'').replace(/\s/g,'')},connectionTimeout:12000,greetingTimeout:10000,socketTimeout:20000,logger:false,debug:false,tls:{minVersion:'TLSv1.2',rejectUnauthorized:true}});
 try{
  const result=await transport.sendMail({from:user,to,cc,replyTo,subject:message.subject,text:message.text,messageId:'<zzws-'+String(job.id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100)+'@gmail.com>',attachments:(message.attachments||[]).map(a=>({filename:a.filename,content:a.content,encoding:'base64'})),disableFileAccess:true,disableUrlAccess:true});
  // Partial acceptance cannot safely be retried; do not alter the order automatically.
  if(result.rejected?.length||result.accepted?.length!==to.length+cc.length)return {result:'unknown'};
  return {result:'accepted',id:String(result.messageId).slice(0,200)};
 }catch(e){
  const beforeData=['CONN','EHLO','HELO','STARTTLS','MAIL FROM','RCPT TO'].includes(e.command)||String(e.command||'').startsWith('AUTH');
  const explicitRejection=Number(e.responseCode)>=400&&Number(e.responseCode)<600;
  return {result:beforeData||explicitRejection?'rejected':'unknown'};
 }finally{transport.close();}
}

