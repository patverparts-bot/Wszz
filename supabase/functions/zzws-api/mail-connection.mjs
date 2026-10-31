import {email} from './report-email.mjs';
import {smtpConfiguration} from './smtp-mail.mjs';

export async function mailConnection(c,settings,{withPassword=false}={}){
 const m=await c.query(c.table('mail_transport').select('host,port,username,secret_id,revision').eq('id',true).single());
 const connection={host:m.host,port:m.port,username:m.username,passwordSet:!!m.secret_id,revision:m.revision};
 const base=n=>Deno.env.get(n);
 if(!m.secret_id)return {connection,env:base};
 const from=settings.from_email||base('ZZWS_REPORT_FROM')||'';
 const password=withPassword?(await c.query(c.service.rpc('zzws_mail_transport_get',{p_actor:c.user.id}))).password:'configured';
 const values={ZZWS_REPORT_EMAIL_MODE:'smtp',ZZWS_SMTP_HOST:m.host,ZZWS_SMTP_PORT:String(m.port),ZZWS_SMTP_USER:m.username,ZZWS_SMTP_PASSWORD:password,ZZWS_SMTP_FROM:from,ZZWS_REPORT_FROM:from,ZZWS_EMAIL_ALLOWED_FROM_ADDRESSES:from};
 return {connection,env:n=>Object.hasOwn(values,n)?values[n]:base(n)};
}
export function connectionInput(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.host!=='string'||typeof value.username!=='string'||typeof value.password!=='string'||value.password.length>4096||typeof value.revision!=='string')throw Error('Ստուգեք փոստային կապի կարգավորումները');
 const host=value.host.trim().toLowerCase(),port=Number(value.port),username=value.username.trim();
 smtpConfiguration(n=>({ZZWS_SMTP_HOST:host,ZZWS_SMTP_PORT:String(port),ZZWS_SMTP_USER:username,ZZWS_SMTP_PASSWORD:value.password||'unchanged',ZZWS_SMTP_FROM:'validation@example.invalid'})[n]);
 return {host,port,username,password:value.password||null,revision:value.revision};
}
