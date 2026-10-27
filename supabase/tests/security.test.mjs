import test from 'node:test';import assert from 'node:assert/strict';import {securityTools} from '../functions/zzws-api/security.ts';
globalThis.Deno={env:{get:name=>name==='SUPABASE_SERVICE_ROLE_KEY'?'synthetic-test-secret':undefined}};
const digest=async text=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');
function setup(){
 let challenge=null,consumed=false;const writes=[];
 const table=name=>({
  insert:async value=>{writes.push({name,value});if(name==='auth_challenges')challenge=value;return {data:[]};},
  upsert:async value=>{writes.push({name,value});return {data:[]};},
  select(){return this;},eq(){return this;},
  single:async()=>({data:{id:'user',active:true,profile:{role:'admin'}}}),
  delete(){return {lt:async()=>({data:[]}),eq(){return {
   select:async()=>({data:consumed?[]:(consumed=true,[{hash:'h'}])}),
   then(resolve){resolve({data:[]});}
  };}};}
 });
 const query=async p=>(await p).data;
 const authClient=()=>({auth:{setSession:async()=>({}),signOut:async()=>({}),mfa:{
  enroll:async()=>({data:{id:'factor',totp:{qr_code:'data:image/svg+xml,test',secret:'synthetic'}}}),
  challenge:async()=>({data:{id:'challenge'}}),verify:async()=>({data:{}})
 }}});
 const service={rpc:async()=>({data:challenge?{user_id:'user',payload:challenge.payload}:null})};
 return {writes,tools:securityTools({service,table,query,digest,random:()=>crypto.randomUUID().replaceAll('-','').repeat(2),fail:(code,message)=>{throw Object.assign(new Error(message),{code});},authClient,cleanUser:u=>({id:u.id,...u.profile}),audit:async()=>{}})};
}
test('invitation storage contains a hash and expires in 48 hours',async()=>{const t=setup(),s=await t.tools,r=await s.invite('user','actor');assert.equal(t.writes[0].value.hash,await digest(r.code));assert.notEqual(t.writes[0].value.hash,r.code);assert.ok(new Date(r.expires)-Date.now()>47*3600000);});
test('MFA challenge encrypts Auth tokens; verification consumes the challenge',async()=>{const t=setup(),s=await t.tools,r=await s.stage({id:'user'},{access_token:'private-test-jwt',refresh_token:'private-refresh'},'enroll');assert.equal(r.mfaRequired,true);const stored=t.writes.find(w=>w.name==='auth_challenges');assert.ok(!JSON.stringify(stored).includes('private-test-jwt'));const result=await s.verify(r.challengeToken,'123456');assert.equal(result.role,'admin');assert.equal(t.writes.find(w=>w.name==='sessions').value.mfa_verified,true);await assert.rejects(()=>s.verify(r.challengeToken,'123456'));});
