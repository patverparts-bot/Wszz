// Authentication secrets are encrypted before short-lived challenge storage.
export async function securityTools(c){
 const {service,table,query,digest,random,fail,authClient,cleanUser,audit}=c;
 const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);
 const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))),un64=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
 async function seal(value){const iv=crypto.getRandomValues(new Uint8Array(12));return {iv:b64(iv),data:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(value))))};}
 async function open(value){return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(value.iv)},key,un64(value.data))));}
 async function session(user,mfa=false){const token=random();await query(table('sessions').insert({hash:await digest(token),user_id:user.id,mfa_verified:mfa,expires:new Date(Date.now()+8*3600000).toISOString()}));return {...cleanUser(user),sessionToken:token};}
 async function invite(id,actor){const code=random(),expires=new Date(Date.now()+48*3600000).toISOString();await query(table('invitations').upsert({user_id:id,actor,hash:await digest(code),expires}));return {code,expires};}
 async function stage(user,auth,kind,factor,attemptId=null){await query(table('auth_challenges').delete().lt('expires',new Date().toISOString()));const token=random(),client=authClient();await client.auth.setSession(auth);let enrollment=null;
  if(kind==='enroll'){const r=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'ZZWS administrator'});if(r.error)fail(400,'Չհաջողվեց սկսել երկփուլ պաշտպանությունը');factor=r.data.id;enrollment=r.data.totp;}
  const r=await client.auth.mfa.challenge({factorId:factor});if(r.error)fail(400,'Չհաջողվեց ստանալ հաստատման հարցումը');
  await query(table('auth_challenges').insert({hash:await digest(token),user_id:user.id,expires:new Date(Date.now()+5*60000).toISOString(),payload:await seal({auth,factor,challenge:r.data.id,kind,attemptId:kind==='login'?attemptId:null})}));
  return {mfaRequired:true,challengeToken:token,...(enrollment?{qr:enrollment.qr_code,secret:enrollment.secret}:{})};
 }
 async function verify(token,code){if(!/^[a-f0-9]{64}$/.test(token||'')||!/^\d{6}$/.test(code||''))fail(400,'Մուտքագրեք վեցանիշ հաստատման կոդը');const hash=await digest(token),r=await service.rpc('zzws_take_auth_challenge',{p_hash:hash});if(r.error||!r.data)fail(401,'Հաստատման ժամկետը լրացել է։ Կրկին մուտք գործեք');
  const info=await open(r.data.payload),client=authClient();await client.auth.setSession(info.auth);const checked=await client.auth.mfa.verify({factorId:info.factor,challengeId:info.challenge,code});if(checked.error)fail(401,'Հաստատման կոդը սխալ է կամ ժամկետանց');
  const consumed=await query(table('auth_challenges').delete().eq('hash',hash).select('hash'));if(!consumed.length)fail(401,'Այս հաստատումն արդեն օգտագործված է');
  const user=await query(table('users').select('*').eq('id',r.data.user_id).eq('active',true).single());if(user.profile.role!=='admin'||user.needs_password_setup)fail(403,'Հասանելիությունն արգելված է');
  if(info.kind==='enroll')await query(table('sessions').delete().eq('user_id',user.id));
  if(info.kind==='login'&&info.attemptId)await query(table('attempts').delete().eq('id',info.attemptId));
  await client.auth.signOut({scope:'local'});await audit(user.id,info.kind==='enroll'?'mfa_enroll':'login');return session(user,true);
 }
 return {session,invite,stage,verify};
}
