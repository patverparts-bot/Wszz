import { publicError } from './public-error.mjs';
import { assertXlsxArchive } from './xlsx-validation.mjs';
import { priceDifference,scopePermissions,canAccess } from './operations.mjs';
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import XLSX from './vendor/xlsx.mjs';
import { parsePrice, project, validateProfile, parseUsers } from './catalog.mjs';
import { defaultRules, effectiveRules, validateRules, validPassword } from './rules.mjs';
import { validateMemory } from './memory.mjs';
import { securityTools } from './security.ts';
import { orderRoutes } from './order-routes.mjs';

const PROJECT_URL = Deno.env.get('SUPABASE_URL')!;
const envKey=(name:string,legacy:string)=>JSON.parse(Deno.env.get(name)||'{}').default||Deno.env.get(legacy)!;
const publicKey=envKey('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY');
const service=createClient(PROJECT_URL,envKey('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
const allowed=new Set(['https://patverparts-bot.github.io','http://127.0.0.1:8080']);
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
const authClient=()=>createClient(PROJECT_URL,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
const email=(login:string)=>login+'@users.zzws.invalid';
const goodPassword=validPassword;
const randomPassword=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>String(b%10)).join('');
function fail(code:number,message:string):never{throw {code,message};}
async function query(q:any){const {data,error}=await q;if(error){console.error('Database operation failed',error.code);fail(500,'Գործողությունը չի կատարվել։ Փորձեք ավելի ուշ');}return data;}
const table=(name:string)=>service.from('zzws_'+name);
async function audit(actor:string|null,action:string,detail=''){await query(table('audit').insert({actor,action,detail}));}

function rowsFromBuffer(raw:ArrayBuffer){
  assertXlsxArchive(raw);
  try{
    const book=XLSX.read(raw,{type:'array',cellFormula:true,cellDates:false});
    const sheet=book.Sheets[book.SheetNames[0]];
    const range=XLSX.utils.decode_range(sheet['!ref']||'A1');
    if(range.e.r>=50000||range.e.c>=150)fail(400,'Թույլատրվում է մինչև 50 000 տող և 150 սյունակ');
    if(Object.entries(sheet).some(([k,v]:any)=>!k.startsWith('!')&&v.f))fail(400,'Բեռնելուց առաջ բանաձևերը փոխարինեք արժեքներով');
    return XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true}) as any[][];
  }catch(e:any){if(e.code)throw e;fail(400,'Չհաջողվեց կարդալ XLSX-ը');}
}
async function uploadRows(req:Request){
  if(Number(req.headers.get('content-length')||0)>10_100_000)fail(413,'Ֆայլը չափազանց մեծ է');
  const file=(await req.formData()).get('file');
  if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx'))fail(400,'Ընտրեք XLSX ֆայլ');
  return rowsFromBuffer(await file.arrayBuffer());
}
const workbook=(rows:any[][])=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows.map(r=>r.map(v=>typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v))),'ZZWS');return XLSX.write(book,{type:'array',bookType:'xlsx'});};
const cleanUser=(row:any)=>({...row.profile,id:row.id,login:row.login,active:row.active,needsPasswordSetup:row.needs_password_setup===true});

async function identity(req:Request){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
  if(!/^[a-f0-9]{64}$/.test(token))fail(401,'Մուտք գործեք համակարգ');
  const hash=await digest(token);
  const session=await query(table('sessions').select('user_id,expires,setup_only,invitation_hash,mfa_verified,confirmed_until').eq('hash',hash).gt('expires',new Date().toISOString()).maybeSingle());
  if(!session)fail(401,'Մուտք գործեք համակարգ');
  const user=await query(table('users').select('*').eq('id',session.user_id).eq('active',true).maybeSingle());
  if(!user)fail(401,'Հասանելիությունն անջատված է');
  return {user:cleanUser(user),hash,setupOnly:session.setup_only,invitationHash:session.invitation_hash,mfaVerified:session.mfa_verified,confirmedUntil:session.confirmed_until};
}

async function body(req:Request){const b=await req.json().catch(()=>null);if(!b||Array.isArray(b)||typeof b!=='object')fail(400,'Սպասվում է JSON օբյեկտ');return b;}
async function draft(id:string,actor:string,kind:string){
  const row=await query(table('drafts').select('*').eq('id',id).eq('actor',actor).eq('kind',kind).gt('expires',new Date().toISOString()).maybeSingle());
  if(!row)fail(404,'Ստուգման ժամկետը լրացել է։ Կրկին բեռնեք ֆայլը');return row;
}
async function current(){
  const state=await query(table('state').select('*').eq('id',true).single());
  if(!state?.version)fail(409,'Ադմինիստրատորը դեռ չի հրապարակել գնացուցակը');
  const version=await query(table('versions').select('*').eq('id',state.version).single());
  return {...version,rules:effectiveRules(state.rules),rulesRevision:state.rules_revision};
}
async function saveUser(p:any,actor:string){
  if(!['create','update'].includes(p.intent))fail(400,'Օգտատիրոջը պահպանելուց առաջ թարմացրեք կաբինետի էջը');
  if(p.intent==='create'&&p.id)fail(400,'Նոր հաշիվը չպետք է պարունակի գոյություն ունեցող օգտատիրոջ ID-ն');
  if(p.intent==='update'&&!p.id)fail(400,'Փոփոխման ենթակա հաշիվը ընտրված չէ');
  const validated=validateProfile(p),{login,profile}=validated;
  const old=p.id?await query(table('users').select('*').eq('id',p.id).maybeSingle()):null;
  // An older admin client must not erase restrictions it does not understand.
  if(old&&Object.hasOwn(old.profile,'catalogAccess')&&!Object.hasOwn(p,'catalogAccess'))profile.catalogAccess=old.profile.catalogAccess;
  if(old&&!Object.hasOwn(p,'rowsList'))profile.rowsList=old.profile.rowsList;
  if(p.id&&!old)fail(404,'Օգտատերը չի գտնվել');
  if(old?.id===actor&&(!p.active||profile.role!=='admin'))fail(400,'Չեք կարող արգելափակել ձեզ կամ հեռացնել սեփական իրավունքները');
  if(p.password&&!goodPassword(p.password))fail(400,'Գաղտնաբառը պետք է պարունակի 6-ից 256 թվանշան․ տառերը, բացատներն ու այլ նշաններն արգելված են');
  const duplicate=await query(table('users').select('id').eq('login',login).maybeSingle());
  if(duplicate&&duplicate.id!==old?.id)fail(400,'Մուտքանունն արդեն օգտագործվում է');
  let uid=old?.id,newAuth=false;
  if(old){
    // Revoke application sessions before changing credentials; JWTs are never application credentials.
    await query(table('sessions').delete().eq('user_id',uid));
    const changes:any={email:email(login),email_confirm:true};if(p.password)changes.password=p.password;
    const result=await service.auth.admin.updateUserById(uid,changes);if(result.error)fail(400,'Չհաջողվեց թարմացնել հաշիվը');
  }else{
    const result=await service.auth.admin.createUser({email:email(login),password:randomPassword(),email_confirm:true});
    if(result.error)fail(400,'Չհաջողվեց ստեղծել օգտատիրոջը');uid=result.data.user.id;newAuth=true;
  }
  try{await query(service.rpc('zzws_save_user',{p_id:uid,p_login:login,p_profile:profile,p_active:p.active!==false,p_actor:actor}));}
  catch(e){if(newAuth)await service.auth.admin.deleteUser(uid);throw e;}
  if(old&&p.password)await audit(actor,'password_reset',JSON.stringify({target:{id:uid,login,client:profile.client}}));
  return {id:uid,...(!old?{invitation:await (await securityTools({service,table,query,digest,random,fail,authClient,cleanUser,audit})).invite(uid,actor)}:{})};
}

export async function handle(req:Request){
  const origin=req.headers.get('origin')||'';
  const headers:any={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(allowed.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-zzws-request','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Expose-Headers':'Content-Disposition'});
  const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers});
  const file=(rows:any[][],name:string)=>new Response(workbook(rows),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${name}"`}});
  try{
    if(origin&&!allowed.has(origin))return json({error:'Հարցման աղբյուրը թույլատրված չէ'},403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(!['GET','POST'].includes(req.method))fail(405,'Մեթոդը չի աջակցվում');
    const path=new URL(req.url).pathname.split('/zzws-api/')[1]||'';
    if(req.method==='GET'&&path==='health')return json({ok:true});
    if(req.method==='POST'&&path==='bootstrap'){
      const p=await body(req),{login,profile}=validateProfile({...p,client:'Ադմինիստրատոր',role:'admin',sheet:'Dealers',allBrands:true});
      if(!goodPassword(p.password)||typeof p.setupToken!=='string'||p.setupToken.length!==64)fail(400,'Ստուգեք կարգավորման կոդը․ գաղտնաբառը պետք է պարունակի առնվազն 6 թվանշան և միայն թվեր');
      const consumed=await query(service.rpc('zzws_consume_setup',{p_hash:await digest(p.setupToken)}));
      if(!consumed)fail(403,'Կարգավորման կոդը սխալ է կամ արդեն օգտագործված է');
      const auth=await service.auth.admin.createUser({email:email(login),password:p.password,email_confirm:true});
      if(auth.error)fail(400,'Չհաջողվեց ստեղծել ադմինիստրատորին։ Պահանջվում է նոր կարգավորման կոդ');
      const inserted=await table('users').insert({id:auth.data.user.id,login,profile,active:true,needs_password_setup:false});
      if(inserted.error){await service.auth.admin.deleteUser(auth.data.user.id);fail(500,'Չհաջողվեց ավարտել կարգավորումը');}
      await audit(auth.data.user.id,'bootstrap');return json({ok:true});
    }
    if(req.method==='POST'&&path==='maintenance/backup'){
      const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');if(!/^[a-f0-9]{64}$/.test(token))fail(401,'Հասանելիությունն արգելված է');
      const key=await query(table('backup_keys').select('hash').eq('hash',await digest(token)).gt('expires',new Date().toISOString()).maybeSingle());if(!key)fail(401,'Հասանելիությունն արգելված է');
      const snapshot=await query(service.rpc('zzws_application_snapshot'));return json(snapshot);
    }
    const security=await securityTools({service,table,query,digest,random,fail,authClient,cleanUser,audit});
    if(req.method==='POST'&&path==='login/mfa'){const p=await body(req);return json(await security.verify(p.challengeToken,p.code));}
    if(req.method==='POST'&&path==='login'){
      const p=await body(req),login=String(p.login||'').trim().toLowerCase(),password=String(p.password||'');
      if(!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(login)||password.length>256)fail(401,'Սխալ մուտքանուն կամ գաղտնաբառ');
      const ip=await digest((req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim());
      const attempt=await query(service.rpc('zzws_login_gate',{p_login:login,p_ip:ip}));if(!attempt)fail(429,'Չափազանց շատ փորձեր։ Կրկնեք 15 րոպեից');
      const candidate=await query(table('users').select('*').eq('login',login).eq('active',true).maybeSingle());
      if(candidate?.needs_password_setup){
        const invitation=await query(table('invitations').select('hash').eq('user_id',candidate.id).eq('hash',await digest(password)).gt('expires',new Date().toISOString()).maybeSingle());
        if(!invitation)fail(401,'Սխալ մուտքանուն, գաղտնաբառ կամ հրավերի կոդ');
        const token=random();await query(table('sessions').insert({hash:await digest(token),user_id:candidate.id,invitation_hash:invitation.hash,setup_only:true,expires:new Date(Date.now()+10*60000).toISOString()}));
        await query(table('attempts').delete().eq('id',attempt));
        return json({id:candidate.id,login:candidate.login,role:candidate.profile.role,needsPasswordSetup:true,sessionToken:token});
      }
      const client=authClient();const auth=await client.auth.signInWithPassword({email:email(login),password});
      if(auth.error||!auth.data.user){await audit(null,'login_failed');fail(401,'Սխալ մուտքանուն կամ գաղտնաբառ');}
      const row=await query(table('users').select('*').eq('id',auth.data.user.id).eq('active',true).maybeSingle());
      if(!row)fail(401,'Սխալ մուտքանուն կամ գաղտնաբառ');
      let factor=null;if(row.profile.role==='admin'){const factors=await client.auth.mfa.listFactors();if(factors.error)fail(500,'Չհաջողվեց ստուգել երկրորդ գործոնը');factor=factors.data.totp.find((f:any)=>f.status==='verified');}
      if(row.profile.role==='admin'&&factor)return json(await security.stage(row,auth.data.session,'login',factor.id,attempt));
      await client.auth.signOut({scope:'local'});
      const result=await security.session(row);
      await query(table('attempts').delete().eq('id',attempt));await audit(row.id,'login');
      return json(result);
    }
    const {user,hash,setupOnly,invitationHash,mfaVerified,confirmedUntil}=await identity(req);
    if(user.role==='admin'){const scope=await query(table('admin_scopes').select('scope').eq('user_id',user.id).maybeSingle());user.adminScope=scope?.scope||'owner';user.permissions=scopePermissions[user.adminScope]||[];}
    if(req.method==='GET'&&path==='me')return json({...user,mfaVerified});
    if(req.method==='POST'&&path==='logout'){await query(table('sessions').delete().eq('hash',hash));await audit(user.id,'logout');return json({ok:true});}
    if(req.method==='POST'&&path==='account/password'){
      if(!user.needsPasswordSetup||!setupOnly)fail(403,'Գաղտնաբառի կարգավորումը հասանելի չէ։ Կրկին մուտք գործեք');
      const validInvite=await query(table('invitations').select('hash').eq('user_id',user.id).eq('hash',invitationHash||'').gt('expires',new Date().toISOString()).maybeSingle());if(!validInvite)fail(403,'Հրավերի ժամկետը լրացել է։ Դիմեք ադմինիստրատորին');
      const p=await body(req);if(!goodPassword(p.password))fail(400,'Գաղտնաբառը պետք է պարունակի առնվազն 6 թվանշան և միայն թվեր');
      const claimed=await query(table('users').update({password_setup_claim:hash}).eq('id',user.id).eq('needs_password_setup',true).is('password_setup_claim',null).select('id'));
      if(!claimed.length)fail(409,'Գաղտնաբառն արդեն սահմանվում է այլ պատուհանում։ Կրկին մուտք գործեք');
      const result=await service.auth.admin.updateUserById(user.id,{password:p.password});
      if(result.error){await query(table('users').update({password_setup_claim:null}).eq('id',user.id).eq('password_setup_claim',hash));fail(400,'Չհաջողվեց սահմանել գաղտնաբառը։ Կրկին փորձեք');}
      await query(table('sessions').delete().eq('user_id',user.id));
      await query(table('users').update({needs_password_setup:false,password_setup_claim:null}).eq('id',user.id).eq('password_setup_claim',hash));
      const account=await service.auth.admin.getUserById(user.id);if(account.error||!account.data.user)fail(500,'Չհաջողվեց ստուգել հաշվի պաշտպանությունը');const factor=account.data.user.factors?.find((f:any)=>f.factor_type==='totp'&&f.status==='verified');
      if(user.role==='admin'&&factor){await query(table('invitations').delete().eq('user_id',user.id));await audit(user.id,'password_setup');const client=authClient(),auth=await client.auth.signInWithPassword({email:email(user.login),password:p.password});if(auth.error)fail(401,'Կրկին մուտք գործեք');return json(await security.stage({id:user.id},auth.data.session,'login',factor.id));}
      const token=random();await query(table('sessions').insert({hash:await digest(token),user_id:user.id,expires:new Date(Date.now()+8*3600000).toISOString()}));
      await query(table('invitations').delete().eq('user_id',user.id));
      await audit(user.id,'password_setup');return json({...user,needsPasswordSetup:false,sessionToken:token});
    }
    if(user.needsPasswordSetup||setupOnly)fail(403,'Նախ սահմանեք նոր գաղտնաբառը');
    if(path.startsWith('admin/')&&(user.role!=='admin'||!canAccess(user.adminScope,path,req.method)))fail(403,'Այս գործողության իրավունքը չունեք');
    if(req.method==='POST'&&path==='account/reauth'){
      const p=await body(req),ip=await digest((req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim());
      const attempt=await query(service.rpc('zzws_login_gate',{p_login:user.login,p_ip:ip}));if(!attempt)fail(429,'Չափազանց շատ փորձեր։ Կրկնեք 15 րոպեից');
      const client=authClient(),r=await client.auth.signInWithPassword({email:email(user.login),password:String(p.password||'')});if(r.error||r.data.user?.id!==user.id)fail(400,'Գաղտնաբառը սխալ է');
      const factors=await client.auth.mfa.listFactors();if(factors.error)fail(500,'Չհաջողվեց ստուգել երկրորդ գործոնը');const factor=factors.data.totp.find((f:any)=>f.status==='verified');await client.auth.signOut({scope:'local'});if(factor&&!mfaVerified)fail(403,'Կրկին մուտք գործեք երկրորդ գործոնով');
      await query(table('sessions').update({confirmed_until:new Date(Date.now()+5*60000).toISOString()}).eq('hash',hash));await query(table('attempts').delete().eq('id',attempt));return json({ok:true});
    }
    if(req.method==='POST'&&['admin/users','admin/users/scope','admin/users/reset-password','admin/users/delete','admin/storage/clear','admin/price/publish','admin/price/rollback','admin/rules','admin/users/import'].includes(path)&&!(confirmedUntil&&Date.parse(confirmedUntil)>Date.now()))return json({error:'Հաստատեք ձեր ընթացիկ գաղտնաբառը',reauthRequired:true},428);

    const orderResponse=await orderRoutes({path,req,user,service,table,query,body,json,file,current,project,rowsFromBuffer,draft,fail});
    if(orderResponse)return orderResponse;
    if(req.method==='GET'&&path==='me/state'){
      const row=await query(table('user_memory').select('data,versions').eq('user_id',user.id).maybeSingle());return json(row||{data:{},versions:{}});
    }
    if(req.method==='POST'&&path==='me/state'){
      const p=await body(req),value=validateMemory(p.section,p.value);
      if(!Number.isInteger(p.version)||p.version<0)fail(400,'Տվյալների սխալ տարբերակ');
      const result=await query(service.rpc('zzws_save_memory',{p_user:user.id,p_section:p.section,p_value:value,p_version:p.version}));
      return json(result,result.conflict?409:200);
    }
    if(req.method==='GET'&&path==='me/carts')return json({carts:await query(table('saved_carts').select('*').eq('user_id',user.id).order('saved_at',{ascending:false}))});
    if(req.method==='POST'&&path==='me/carts'){
      const p=await body(req),cart=validateMemory('cart',p.cart),draft=validateMemory('draft',p.draft||{});
      if(typeof p.title!=='string'||!p.title.trim()||p.title.trim().length>80)fail(400,'Նշեք մինչև 80 նիշանոց անվանում');
      if(!Object.keys(cart).length)fail(400,'Զամբյուղը դատարկ է');
      if(!/^[a-f0-9-]{36}$/.test(p.requestId))fail(400,'Պահպանման սխալ կոդ');
      const result=await query(service.rpc('zzws_save_cart',{p_user:user.id,p_title:p.title.trim(),p_cart:cart,p_draft:draft,p_request:p.requestId,p_replace:p.replace||null}));
      return json(result,result.limit?409:200);
    }
    if(req.method==='POST'&&path==='me/carts/delete'){
      const p=await body(req);await query(table('saved_carts').delete().eq('user_id',user.id).eq('id',p.id));return json({ok:true});
    }
    if(req.method==='GET'&&['catalog','catalog/version','catalog/export'].includes(path)){
      const v=await current(),updated=new Date(v.created).toLocaleDateString('en-GB',{timeZone:'Asia/Yerevan'});
      const version=v.id+':'+v.rulesRevision;
      if(path==='catalog/version')return json({version,updated});
      const products=project(v.products,user,v.rules);
      if(path==='catalog')return json({products,version,updated});
      const rows=[['Ստացող',user.client,'Տարբերակ',version],['Արտիկուլ','Բրենդ','Կատեգորիա','Անվանում','Մանրածախ','Ձեր գինը','Առկայություն',...(user.role==='admin'?['KP']:[])],
        ...products.map((p:any)=>[p.articul,p.brand,p.category,p.name,p.retail,p.wholesale,p.stockStatus,...(user.role==='admin'?[p.kpPrice]:[])])];
      await audit(user.id,'export',version);return file(rows,'PriceList.xlsx');
    }
    if(!path.startsWith('admin/'))fail(404,'Չի գտնվել');
    if(user.role!=='admin')fail(403,'Հասանելիությունն արգելված է');
    if(req.method==='GET'&&path==='admin/storage')return json(await query(service.rpc('zzws_storage_report')));
    if(req.method==='POST'&&path==='admin/storage/clear'){
      const p=await body(req);
      if(p.confirm!==true||!['cart','favorites','history','filters','preferences','draft','savedCarts','all'].includes(p.section)||typeof p.revision!=='string')fail(400,'Հաստատեք տվյալների ընտրված մաքրումը');
      const result=await service.rpc('zzws_clear_user_data',{p_user:p.targetId,p_section:p.section,p_revision:p.revision,p_actor:user.id});
      if(result.error?.code==='PT409')fail(409,'Օգտատիրոջ տվյալները փոխվել են։ Թարմացրեք հաշվետվությունը և կրկնեք մաքրումը');
      if(result.error?.code==='PT404')fail(404,'Օգտատերը չի գտնվել');
      if(result.error)fail(500,'Չհաջողվեց մաքրել տվյալները');return json(result.data);
    }
    if(req.method==='GET'&&path==='admin/catalog-options'){
      const v=await current();
      const pairs=[...new Map(v.products.map((p:any)=>[JSON.stringify([p.brand,p.category]),{brand:p.brand,category:p.category}])).values()];
      return json({pairs});
    }
    if(req.method==='GET'&&path==='admin/rules'){
      const state=await query(table('state').select('rules,rules_revision').eq('id',true).single());
      return json({rules:effectiveRules(state.rules),defaults:defaultRules(),revision:state.rules_revision});
    }
    if(req.method==='POST'&&path==='admin/rules'){
      const p=await body(req),rules=validateRules(p.rules);
      const result=await service.rpc('zzws_update_rules',{p_rules:rules,p_expected:p.revision,p_actor:user.id});
      if(['PT409','40001'].includes(result.error?.code))fail(409,'Կանոններն արդեն փոխվել են այլ պատուհանում։ Պահպանելուց առաջ կրկին բեռնեք դրանք');
      if(result.error)fail(500,'Չհաջողվեց պահպանել կանոնները');
      return json({rules,revision:result.data});
    }
    if(req.method==='POST'&&path==='admin/rules/preview'){
      const p=await body(req),rules=validateRules(p.rules),v=await current();
      return json({groups:Object.fromEntries(['KP','Dealers'].map(sheet=>{
        const profile={role:'client',sheet,client:'Նախադիտում',allBrands:true,brands:[],catalogAccess:{mode:'all',include:[],exclude:[]}};
        const products=project(v.products,profile,rules);
        return [sheet,{count:products.length,sample:products.slice(0,5),difference}];
      }))});
    }
    if(req.method==='POST'&&path==='admin/access/preview'){
      const p=await body(req),{profile}=validateProfile({...p,login:p.login||'preview',client:p.client||'Նախադիտում'}),v=await current();
      const products=project(v.products,profile,v.rules);
      return json({count:products.length,sample:products.slice(0,10),adminBypass:profile.role==='admin'});
    }
    if(req.method==='GET'&&path==='admin/dashboard'){
      const counts:any={};if(user.permissions.includes('orders:read'))for(const state of ['new','confirmed','in_progress','completed','rejected']){const r=await table('orders').select('id',{count:'exact',head:true}).eq('status',state);if(r.error)fail(500,'Չհաջողվեց հաշվել պատվերները');counts[state]=r.count;}
      const state=await query(table('state').select('version').eq('id',true).single());
      return json({counts,priceVersion:state.version,scope:user.adminScope,mfaVerified});
    }
    if(req.method==='POST'&&path==='admin/users/scope'){
      const p=await body(req);if(p.id===user.id||!scopePermissions[p.scope])fail(400,'Սեփական իրավունքը կամ անհայտ դերը փոխել չի կարելի');
      const target=await query(table('users').select('id,profile').eq('id',p.id).single());if(target.profile.role!=='admin')fail(400,'Ընտրեք ադմինիստրատոր');
      await query(table('admin_scopes').upsert({user_id:p.id,scope:p.scope}));await query(table('sessions').delete().eq('user_id',p.id));await audit(user.id,'admin_scope_update',JSON.stringify({target:{id:p.id},scope:p.scope}));return json({ok:true});
    }
    if(req.method==='POST'&&path==='admin/security/enroll'){
      const p=await body(req),client=authClient(),r=await client.auth.signInWithPassword({email:email(user.login),password:String(p.password||'')});
      if(r.error||r.data.user?.id!==user.id)fail(401,'Գաղտնաբառը սխալ է');
      const factors=await client.auth.mfa.listFactors();if(factors.error)fail(500,'Չհաջողվեց ստուգել երկրորդ գործոնը');const factor=factors.data.totp.find((f:any)=>f.status==='verified');
      if(factor){await client.auth.signOut({scope:'local'});fail(409,'Երկփուլ պաշտպանությունն արդեն միացված է');}
      return json(await security.stage({id:user.id},r.data.session,'enroll'));
    }
    if(req.method==='POST'&&path==='admin/users/invitation'){
      const p=await body(req),target=await query(table('users').select('id,needs_password_setup').eq('id',p.id).single());
      if(!target.needs_password_setup)fail(409,'Հաշիվն արդեն ակտիվացված է․ անհրաժեշտության դեպքում վերակայեք գաղտնաբառը');
      await query(table('sessions').delete().eq('user_id',target.id));return json({invitation:await security.invite(target.id,user.id)});
    }
    if(req.method==='GET'&&path==='admin/users'){const rows=await query(table('users').select('*').order('login'));const scopes=await query(table('admin_scopes').select('*'));return json({users:rows.map((r:any)=>({...cleanUser(r),adminScope:scopes.find((x:any)=>x.user_id===r.id)?.scope||'owner'}))});}
    if(req.method==='POST'&&path==='admin/users')return json(await saveUser(await body(req),user.id));
    if(req.method==='POST'&&path==='admin/users/reset-password'){
      const p=await body(req),target=await query(table('users').select('*').eq('id',p.id).maybeSingle());
      if(!target)fail(404,'Օգտատերը չի գտնվել');
      if(target.id===user.id)fail(400,'Այս ձևից չեք կարող վերակայել ձեր սեփական գաղտնաբառը');
      await query(table('sessions').delete().eq('user_id',target.id));
      const result=await service.auth.admin.updateUserById(target.id,{password:randomPassword()});
      if(result.error)fail(400,'Չհաջողվեց վերակայել գաղտնաբառը');
      await query(table('users').update({needs_password_setup:true,password_setup_claim:null}).eq('id',target.id));
      await audit(user.id,'password_setup_reset',JSON.stringify({target:{id:target.id,login:target.login,client:target.profile.client}}));return json({ok:true,invitation:await security.invite(target.id,user.id)});
    }
    if(req.method==='POST'&&path==='admin/users/delete'){
      const p=await body(req),target=await query(table('users').select('id,login,profile').eq('id',p.id).maybeSingle());
      if(!target)fail(404,'Օգտատերը չի գտնվել');
      if(target.id===user.id||target.profile.role==='admin')fail(403,'Ադմինիստրատորին կարող է միայն արգելափակել մեկ այլ ադմինիստրատոր');
      await query(table('sessions').delete().eq('user_id',target.id));
      const deleted=await service.auth.admin.deleteUser(target.id);if(deleted.error)fail(400,'Չհաջողվեց ջնջել օգտատիրոջը');
      await audit(user.id,'user_delete',JSON.stringify({target:{id:target.id,login:target.login,client:target.profile.client}}));return json({ok:true});
    }
    if(req.method==='GET'&&path==='admin/audit'){
      const rows=await query(table('audit').select('*').order('id',{ascending:false}).limit(200));
      return json({events:rows.map((r:any)=>({...r,created:Date.parse(r.created)/1000}))});
    }
    if(req.method==='GET'&&path==='admin/price/versions'){
      const versions=await query(table('versions').select('id,created,actor').order('created',{ascending:false}).limit(100));
      const state=await query(table('state').select('version').eq('id',true).single());
      return json({active:state?.version,versions:versions.map((v:any)=>({...v,created:Date.parse(v.created)/1000}))});
    }
    if(req.method==='POST'&&path==='admin/price/preview'){
      const products=parsePrice(await uploadRows(req));let prior:any[]=[];try{prior=(await current()).products;}catch(e:any){if(e.code!==409)throw e;}const difference=priceDifference(prior,products);
      const d=await query(table('drafts').insert({actor:user.id,kind:'price',payload:products}).select('id').single());
      await audit(user.id,'price_preview',String(products.length));return json({draft:d.id,count:products.length,sample:products.slice(0,5),difference});
    }
    if(req.method==='POST'&&path==='admin/price/publish'){
      const p=await body(req);await draft(p.draft,user.id,'price');
      const version=await query(service.rpc('zzws_publish',{p_draft:p.draft,p_actor:user.id}));return json({version});
    }
    if(req.method==='POST'&&path==='admin/price/rollback'){
      const p=await body(req),v=await query(table('versions').select('id').eq('id',p.version).maybeSingle());if(!v)fail(404,'Տարբերակը չի գտնվել');
      await query(table('state').update({version:p.version}).eq('id',true));await audit(user.id,'price_rollback',p.version);return json({ok:true});
    }
    if(req.method==='GET'&&path==='admin/users/template')return file([['login','client','sheet','brands','allBrands','organization','address','contact','organization2','address2','contact2','organization3','address3','contact3'],['client-example','Հաճախորդի անվանում','Dealers','','no','','','','','','','','','']],'Users-template.xlsx');
    if(req.method==='POST'&&path==='admin/users/preview'){
      const users=parseUsers(await uploadRows(req));
      const old=await query(table('users').select('id,login,profile'));
      for(const u of users){const record=old.find((r:any)=>r.login===u.login);if(record?.profile.role==='admin')fail(400,'Ներմուծումը չի կարող փոփոխել ադմինիստրատորին');u.action=record?'update':'create';}
      const d=await query(table('drafts').insert({actor:user.id,kind:'users',payload:users}).select('id').single());
      return json({draft:d.id,users:users.map((u:any)=>({login:u.login,client:u.profile.client,action:u.action}))});
    }
    if(req.method==='POST'&&path==='admin/users/import'){
      const p=await body(req),d=await draft(p.draft,user.id,'users');
      const ids:string[]=[];
      try{
        const existing=await query(table('users').select('id,login,profile'));
        const prepared=[];
        for(const u of d.payload){const record=existing.find((r:any)=>r.login===u.login);if(record?.profile.role==='admin')fail(400,'Ներմուծումը չի կարող փոփոխել ադմինիստրատորին');
          if(record){prepared.push({...u,id:record.id});continue;}
          const auth=await service.auth.admin.createUser({email:email(u.login),password:randomPassword(),email_confirm:true});
          if(auth.error)fail(400,'Չհաջողվեց պատրաստել օգտատիրոջը՝ '+u.login);ids.push(auth.data.user.id);prepared.push({...u,id:auth.data.user.id});
        }
        await query(service.rpc('zzws_import_users',{p_draft:p.draft,p_actor:user.id,p_users:prepared}));
      }catch(e){for(const id of ids)await service.auth.admin.deleteUser(id);throw e;}
      return json({ok:true});
    }
    fail(404,'Չի գտնվել');
  }catch(e:any){const error=publicError(e);return json({error:error.message},error.status);}
}
Deno.serve(handle);
