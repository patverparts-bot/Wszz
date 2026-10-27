import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import XLSX from './vendor/xlsx.mjs';
import { parsePrice, project, validateProfile, parseUsers } from './catalog.mjs';
import { defaultRules, effectiveRules, validateRules, validPassword } from './rules.mjs';

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
async function query(q:any){const {data,error}=await q;if(error){console.error('Database operation failed',error.code);fail(500,'Операция не выполнена. Повторите позже');}return data;}
const table=(name:string)=>service.from('zzws_'+name);
async function audit(actor:string|null,action:string,detail=''){await query(table('audit').insert({actor,action,detail}));}

function rowsFromBuffer(raw:ArrayBuffer){
  if(raw.byteLength>10_000_000)fail(413,'Допустим XLSX до 10 МБ');
  // Check ZIP central directory sizes before handing the file to the XLSX parser.
  const data=new DataView(raw);let end=-1;
  for(let i=raw.byteLength-22;i>=Math.max(0,raw.byteLength-65557);i--)if(data.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)fail(400,'Неверный XLSX');
  const count=data.getUint16(end+10,true);let offset=data.getUint32(end+16,true),total=0;
  if(count>3000||offset>=raw.byteLength)fail(400,'Слишком сложный XLSX');
  for(let i=0;i<count;i++){
    if(offset+46>raw.byteLength||data.getUint32(offset,true)!==0x02014b50)fail(400,'Повреждён ZIP');
    total+=data.getUint32(offset+24,true);if(total>60_000_000)fail(400,'Слишком большой распакованный XLSX');
    const nameLength=data.getUint16(offset+28,true);
    const name=new TextDecoder().decode(new Uint8Array(raw,offset+46,nameLength));
    if(/vbaProject|externalLinks/i.test(name))fail(400,'Макросы и внешние ссылки запрещены');
    offset+=46+nameLength+data.getUint16(offset+30,true)+data.getUint16(offset+32,true);
  }
  try{
    const book=XLSX.read(raw,{type:'array',cellFormula:true,cellDates:false});
    const sheet=book.Sheets[book.SheetNames[0]];
    const range=XLSX.utils.decode_range(sheet['!ref']||'A1');
    if(range.e.r>=50000||range.e.c>=150)fail(400,'Допустимо до 50 000 строк и 150 колонок');
    if(Object.entries(sheet).some(([k,v]:any)=>!k.startsWith('!')&&v.f))fail(400,'Замените формулы значениями перед загрузкой');
    return XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true}) as any[][];
  }catch(e:any){if(e.code)throw e;fail(400,'Не удалось прочитать XLSX');}
}
async function uploadRows(req:Request){
  if(Number(req.headers.get('content-length')||0)>10_100_000)fail(413,'Слишком большой файл');
  const file=(await req.formData()).get('file');
  if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx'))fail(400,'Выберите XLSX-файл');
  return rowsFromBuffer(await file.arrayBuffer());
}
const workbook=(rows:any[][])=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows.map(r=>r.map(v=>typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v))),'ZZWS');return XLSX.write(book,{type:'array',bookType:'xlsx'});};
const cleanUser=(row:any)=>({...row.profile,id:row.id,login:row.login,active:row.active});

async function identity(req:Request){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
  if(!/^[a-f0-9]{64}$/.test(token))fail(401,'Войдите в систему');
  const hash=await digest(token);
  const session=await query(table('sessions').select('user_id,expires').eq('hash',hash).gt('expires',new Date().toISOString()).maybeSingle());
  if(!session)fail(401,'Войдите в систему');
  const user=await query(table('users').select('*').eq('id',session.user_id).eq('active',true).maybeSingle());
  if(!user)fail(401,'Доступ отключён');
  return {user:cleanUser(user),hash};
}

async function body(req:Request){const b=await req.json().catch(()=>null);if(!b||Array.isArray(b)||typeof b!=='object')fail(400,'Ожидается JSON-объект');return b;}
async function draft(id:string,actor:string,kind:string){
  const row=await query(table('drafts').select('*').eq('id',id).eq('actor',actor).eq('kind',kind).gt('expires',new Date().toISOString()).maybeSingle());
  if(!row)fail(404,'Проверка истекла. Загрузите файл заново');return row;
}
async function current(){
  const state=await query(table('state').select('*').eq('id',true).single());
  if(!state?.version)fail(409,'Администратор ещё не опубликовал прайс');
  const version=await query(table('versions').select('*').eq('id',state.version).single());
  return {...version,rules:effectiveRules(state.rules),rulesRevision:state.rules_revision};
}
async function saveUser(p:any,actor:string){
  const validated=validateProfile(p),{login,profile}=validated;
  const old=p.id?await query(table('users').select('*').eq('id',p.id).maybeSingle()):null;
  // An older admin client must not erase restrictions it does not understand.
  if(old&&Object.hasOwn(old.profile,'catalogAccess')&&!Object.hasOwn(p,'catalogAccess'))profile.catalogAccess=old.profile.catalogAccess;
  if(old&&!Object.hasOwn(p,'rowsList'))profile.rowsList=old.profile.rowsList;
  if(p.id&&!old)fail(404,'Пользователь не найден');
  if(old?.id===actor&&(!p.active||profile.role!=='admin'))fail(400,'Нельзя заблокировать себя или снять собственные права');
  if((!old||p.password)&&!goodPassword(p.password))fail(400,'Пароль должен содержать от 6 до 256 цифр; буквы, пробелы и другие символы запрещены');
  const duplicate=await query(table('users').select('id').eq('login',login).maybeSingle());
  if(duplicate&&duplicate.id!==old?.id)fail(400,'Логин уже используется');
  let uid=old?.id,newAuth=false;
  if(old){
    // Revoke application sessions before changing credentials; JWTs are never application credentials.
    await query(table('sessions').delete().eq('user_id',uid));
    const changes:any={email:email(login),email_confirm:true};if(p.password)changes.password=p.password;
    const result=await service.auth.admin.updateUserById(uid,changes);if(result.error)fail(400,'Не удалось обновить учётную запись');
  }else{
    const result=await service.auth.admin.createUser({email:email(login),password:p.password,email_confirm:true});
    if(result.error)fail(400,'Не удалось создать пользователя');uid=result.data.user.id;newAuth=true;
  }
  try{await query(service.rpc('zzws_save_user',{p_id:uid,p_login:login,p_profile:profile,p_active:p.active!==false,p_actor:actor}));}
  catch(e){if(newAuth)await service.auth.admin.deleteUser(uid);throw e;}
  return {id:uid};
}

export async function handle(req:Request){
  const origin=req.headers.get('origin')||'';
  const headers:any={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(allowed.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-zzws-request','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Expose-Headers':'Content-Disposition'});
  const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers});
  const file=(rows:any[][],name:string)=>new Response(workbook(rows),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${name}"`}});
  try{
    if(origin&&!allowed.has(origin))return json({error:'Недопустимый источник запроса'},403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(!['GET','POST'].includes(req.method))fail(405,'Метод не поддерживается');
    const path=new URL(req.url).pathname.split('/zzws-api/')[1]||'';
    if(req.method==='GET'&&path==='health')return json({ok:true});
    if(req.method==='POST'&&path==='bootstrap'){
      const p=await body(req),{login,profile}=validateProfile({...p,client:'Администратор',role:'admin',sheet:'Dealers',allBrands:true});
      if(!goodPassword(p.password)||typeof p.setupToken!=='string'||p.setupToken.length!==64)fail(400,'Проверьте код настройки: пароль должен содержать минимум 6 цифр и только цифры');
      const consumed=await query(service.rpc('zzws_consume_setup',{p_hash:await digest(p.setupToken)}));
      if(!consumed)fail(403,'Код настройки недействителен или уже использован');
      const auth=await service.auth.admin.createUser({email:email(login),password:p.password,email_confirm:true});
      if(auth.error)fail(400,'Не удалось создать администратора. Потребуется новый код настройки');
      const inserted=await table('users').insert({id:auth.data.user.id,login,profile,active:true});
      if(inserted.error){await service.auth.admin.deleteUser(auth.data.user.id);fail(500,'Не удалось завершить настройку');}
      await audit(auth.data.user.id,'bootstrap');return json({ok:true});
    }
    if(req.method==='POST'&&path==='login'){
      const p=await body(req),login=String(p.login||'').trim().toLowerCase(),password=String(p.password||'');
      if(!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(login)||password.length>256)fail(401,'Неверный логин или пароль');
      const ip=await digest((req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim());
      const attempt=await query(service.rpc('zzws_login_gate',{p_login:login,p_ip:ip}));if(!attempt)fail(429,'Слишком много попыток. Повторите через 15 минут');
      const client=authClient();const auth=await client.auth.signInWithPassword({email:email(login),password});
      if(auth.error||!auth.data.user){await audit(null,'login_failed');fail(401,'Неверный логин или пароль');}
      // Immediately discard the Auth session. All subsequent access uses independently revocable opaque tokens.
      await client.auth.signOut({scope:'local'});
      const row=await query(table('users').select('*').eq('id',auth.data.user.id).eq('active',true).maybeSingle());
      if(!row)fail(401,'Неверный логин или пароль');
      const token=random();await query(table('sessions').insert({hash:await digest(token),user_id:row.id,expires:new Date(Date.now()+8*3600000).toISOString()}));
      await query(table('attempts').delete().eq('id',attempt));await audit(row.id,'login');
      return json({...cleanUser(row),sessionToken:token});
    }
    const {user,hash}=await identity(req);
    if(req.method==='GET'&&path==='me')return json(user);
    if(req.method==='POST'&&path==='logout'){await query(table('sessions').delete().eq('hash',hash));await audit(user.id,'logout');return json({ok:true});}
    if(req.method==='GET'&&['catalog','catalog/version','catalog/export'].includes(path)){
      const v=await current(),updated=new Date(v.created).toLocaleDateString('en-GB',{timeZone:'Asia/Yerevan'});
      const version=v.id+':'+v.rulesRevision;
      if(path==='catalog/version')return json({version,updated});
      const products=project(v.products,user,v.rules);
      if(path==='catalog')return json({products,version,updated});
      const rows=[['Получатель',user.client,'Версия',version],['Артикул','Бренд','Категория','Название','Розница','Ваша цена','Наличие',...(user.role==='admin'?['KP']:[])],
        ...products.map((p:any)=>[p.articul,p.brand,p.category,p.name,p.retail,p.wholesale,p.stockStatus,...(user.role==='admin'?[p.kpPrice]:[])])];
      await audit(user.id,'export',version);return file(rows,'PriceList.xlsx');
    }
    if(!path.startsWith('admin/'))fail(404,'Не найдено');
    if(user.role!=='admin')fail(403,'Доступ запрещён');
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
      if(['PT409','40001'].includes(result.error?.code))fail(409,'Правила уже изменены в другом окне. Загрузите их заново перед сохранением');
      if(result.error)fail(500,'Не удалось сохранить правила');
      return json({rules,revision:result.data});
    }
    if(req.method==='POST'&&path==='admin/rules/preview'){
      const p=await body(req),rules=validateRules(p.rules),v=await current();
      return json({groups:Object.fromEntries(['KP','Dealers'].map(sheet=>{
        const profile={role:'client',sheet,client:'Предпросмотр',allBrands:true,brands:[],catalogAccess:{mode:'all',include:[],exclude:[]}};
        const products=project(v.products,profile,rules);
        return [sheet,{count:products.length,sample:products.slice(0,5)}];
      }))});
    }
    if(req.method==='POST'&&path==='admin/access/preview'){
      const p=await body(req),{profile}=validateProfile({...p,login:p.login||'preview',client:p.client||'Предпросмотр'}),v=await current();
      const products=project(v.products,profile,v.rules);
      return json({count:products.length,sample:products.slice(0,10),adminBypass:profile.role==='admin'});
    }
    if(req.method==='GET'&&path==='admin/users'){const rows=await query(table('users').select('*').order('login'));return json({users:rows.map(cleanUser)});}
    if(req.method==='POST'&&path==='admin/users')return json(await saveUser(await body(req),user.id));
    if(req.method==='POST'&&path==='admin/users/delete'){
      const p=await body(req),target=await query(table('users').select('id,profile').eq('id',p.id).maybeSingle());
      if(!target)fail(404,'Пользователь не найден');
      if(target.id===user.id||target.profile.role==='admin')fail(403,'Администратора можно только заблокировать другим администратором');
      await query(table('sessions').delete().eq('user_id',target.id));
      const deleted=await service.auth.admin.deleteUser(target.id);if(deleted.error)fail(400,'Не удалось удалить пользователя');
      await audit(user.id,'user_delete',target.id);return json({ok:true});
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
      const products=parsePrice(await uploadRows(req));
      const d=await query(table('drafts').insert({actor:user.id,kind:'price',payload:products}).select('id').single());
      await audit(user.id,'price_preview',String(products.length));return json({draft:d.id,count:products.length,sample:products.slice(0,5)});
    }
    if(req.method==='POST'&&path==='admin/price/publish'){
      const p=await body(req);await draft(p.draft,user.id,'price');
      const version=await query(service.rpc('zzws_publish',{p_draft:p.draft,p_actor:user.id}));return json({version});
    }
    if(req.method==='POST'&&path==='admin/price/rollback'){
      const p=await body(req),v=await query(table('versions').select('id').eq('id',p.version).maybeSingle());if(!v)fail(404,'Версия не найдена');
      await query(table('state').update({version:p.version}).eq('id',true));await audit(user.id,'price_rollback',p.version);return json({ok:true});
    }
    if(req.method==='GET'&&path==='admin/users/template')return file([['login','client','sheet','brands','allBrands','organization','address','contact','organization2','address2','contact2','organization3','address3','contact3'],['client-example','Название клиента','Dealers','','no','','','','','','','','','']],'Users-template.xlsx');
    if(req.method==='POST'&&path==='admin/users/preview'){
      const users=parseUsers(await uploadRows(req));
      const old=await query(table('users').select('id,login,profile'));
      for(const u of users){const record=old.find((r:any)=>r.login===u.login);if(record?.profile.role==='admin')fail(400,'Импорт не может менять администратора');u.action=record?'update':'create';}
      const d=await query(table('drafts').insert({actor:user.id,kind:'users',payload:users}).select('id').single());
      return json({draft:d.id,users:users.map((u:any)=>({login:u.login,client:u.profile.client,action:u.action}))});
    }
    if(req.method==='POST'&&path==='admin/users/import'){
      const p=await body(req),d=await draft(p.draft,user.id,'users');
      const ids:string[]=[];
      try{
        const existing=await query(table('users').select('id,login,profile'));
        const prepared=[];
        for(const u of d.payload){const record=existing.find((r:any)=>r.login===u.login);if(record?.profile.role==='admin')fail(400,'Импорт не может менять администратора');
          if(record){prepared.push({...u,id:record.id});continue;}
          const auth=await service.auth.admin.createUser({email:email(u.login),password:randomPassword(),email_confirm:true});
          if(auth.error)fail(400,'Не удалось подготовить пользователя: '+u.login);ids.push(auth.data.user.id);prepared.push({...u,id:auth.data.user.id});
        }
        await query(service.rpc('zzws_import_users',{p_draft:p.draft,p_actor:user.id,p_users:prepared}));
      }catch(e){for(const id of ids)await service.auth.admin.deleteUser(id);throw e;}
      return json({ok:true});
    }
    fail(404,'Не найдено');
  }catch(e:any){const status=e.code&&Number.isInteger(e.code)?e.code:400;return json({error:status===500?'Операция не выполнена. Повторите позже':(e.message||'Неверный запрос')},status);}
}
Deno.serve(handle);
