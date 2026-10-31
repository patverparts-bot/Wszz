import {email} from './report-email.mjs';

export function smtpConfiguration(env){
 const host=env('ZZWS_SMTP_HOST')||'',port=Number(env('ZZWS_SMTP_PORT')||'587'),user=env('ZZWS_SMTP_USER')||'',pass=env('ZZWS_SMTP_PASSWORD')||'';
 if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host)||![465,587].includes(port)||!user||user.length>320||/[\u0000-\u001f\u007f]/.test(user)||!pass||pass.length>4096)throw Error('Փոստային ծառայությունը կարգավորված չէ');
 return {host,port,user,pass,from:email(env('ZZWS_SMTP_FROM')||env('ZZWS_REPORT_FROM')||'')};
}
export function smtpReady(env){try{smtpConfiguration(env);return true;}catch{return false;}}

export async function verifySmtp({env,createTransport}){
 const config=smtpConfiguration(env),make=createTransport||(await import('npm:nodemailer@10.3.1')).default.createTransport;
 const transport=make({host:config.host,port:config.port,secure:config.port===465,requireTLS:true,authMethod:'LOGIN',auth:{user:config.user,pass:config.pass},connectionTimeout:12000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false,tls:{minVersion:'TLSv1.2',rejectUnauthorized:true,servername:config.host}});
 try{await transport.verify();return {ok:true};}catch(e){return {ok:false,reason:e.code==='EAUTH'?'authentication_failed':'connection_failed'};}finally{transport.close();}
}

// Authenticated submission only; TLS is required before transmitting credentials.
export async function sendSmtp({job,message,env,createTransport}){
 const config=smtpConfiguration(env),from=email(message.from);
 if(from!==config.from)throw Error('Ուղարկողի հասցեն չի համապատասխանում միացված փոստային հաշվին');
 const to=[...new Set((message.to||[]).map(v=>email(v)))],cc=[...new Set((message.cc||[]).map(v=>email(v)))].filter(v=>!to.includes(v));
 if(!to.length||to.length+cc.length>50)throw Error('Ստացողների սխալ ցանկ');
 if(env('ZZWS_ENVIRONMENT')!=='production'){
  const allowed=new Set((env('ZZWS_REPORT_TEST_RECIPIENTS')||'').split(',').map(v=>v.trim()).filter(Boolean).map(v=>email(v)));
  if([...to,...cc].some(v=>!allowed.has(v)))throw Error('Փորձարկման հասցեն թույլատրված չէ');
 }
 const replyTo=message.reply_to?email(message.reply_to):undefined;
 const make=createTransport||(await import('npm:nodemailer@10.3.1')).default.createTransport;
 const transport=make({host:config.host,port:config.port,secure:config.port===465,requireTLS:true,authMethod:'LOGIN',auth:{user:config.user,pass:config.pass},connectionTimeout:12000,greetingTimeout:10000,socketTimeout:20000,logger:false,debug:false,tls:{minVersion:'TLSv1.2',rejectUnauthorized:true,servername:config.host}});
 const messageId='<zzws-'+String(job.id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100)+'@'+from.split('@')[1]+'>';
 try{
  const result=await transport.sendMail({from,to,cc,replyTo,subject:message.subject,text:message.text,messageId,attachments:(message.attachments||[]).map(a=>({filename:a.filename,content:a.content,encoding:'base64'})),disableFileAccess:true,disableUrlAccess:true});
  const accepted=new Set((result.accepted||[]).map(v=>email(v)));
  if(result.rejected?.length||accepted.size!==to.length+cc.length||[...to,...cc].some(v=>!accepted.has(v)))return {result:'unknown'};
  return {result:'accepted',id:messageId.slice(0,200)};
 }catch(e){
  const beforeData=['CONN','EHLO','HELO','STARTTLS','MAIL FROM','RCPT TO'].includes(e.command)||String(e.command||'').startsWith('AUTH');
  const explicitRejection=Number(e.responseCode)>=400&&Number(e.responseCode)<600;
  return {result:beforeData||explicitRejection?'rejected':'unknown'};
 }finally{transport.close();}
}
