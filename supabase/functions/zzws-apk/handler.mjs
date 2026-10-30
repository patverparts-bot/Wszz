import {inspectApk,MAX_APK_BYTES} from './apk.mjs';
const BUCKET='zzws-android-releases',MIME='application/vnd.android.package-archive';
const fail=(status,message,extra={})=>{throw Object.assign(new Error(message),{status,...extra});};
const hash=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
const checked=async q=>{const result=await q;if(result.error)fail(503,'Չհաջողվեց կատարել գործողությունը։ Փորձեք կրկին։');return result.data;};
const releasePath=code=>'releases/'+String(code).padStart(10,'0')+'.json';
function validRelease(r){return r?.schemaVersion===1&&Number.isInteger(r.versionCode)&&r.versionCode>0&&r.versionCode<=2147483647&&r.package==='am.zzws.admin'&&/^[0-9][A-Za-z0-9.+_-]{0,79}$/.test(r.version)&&/^[a-f0-9]{64}$/.test(r.sha256)&&r.filename==='ZZWS-'+r.version+'-production.apk'&&r.objectPath==='files/'+r.sha256+'.apk'&&Number.isInteger(r.bytes)&&r.bytes>21&&r.bytes<=MAX_APK_BYTES&&typeof r.description==='string'&&r.description.length<=4000;}
export function createApkHandler({service,origins,baselineVersionCode=70008,now=()=>Date.now(),uploadReadTimeoutMs=90000}){
 const store=()=>service.storage.from(BUCKET);
 async function bucket(create=false){
  const result=await service.storage.getBucket(BUCKET);if(!result.error){if(result.data.public)fail(503,'APK պահոցը պետք է լինի փակ։');return true;}
  if(String(result.error.statusCode||result.error.status)!=='404')fail(503,'APK պահոցը ժամանակավորապես հասանելի չէ։');
  if(!create)return false;
  const made=await service.storage.createBucket(BUCKET,{public:false,fileSizeLimit:MAX_APK_BYTES,allowedMimeTypes:[MIME,'application/json']});
  if(made.error){const existing=await service.storage.getBucket(BUCKET);if(existing.error||existing.data.public)fail(503,'Չհաջողվեց պատրաստել APK պահոցը։');}return true;
 }
 async function release(code){const result=await store().download(releasePath(code));if(result.error)fail(503,'APK թողարկումը հասանելի չէ։');let r;try{r=JSON.parse(await result.data.text());}catch{fail(503,'APK թողարկման տվյալները վնասված են։');}if(!validRelease(r))fail(503,'APK թողարկման տվյալները սխալ են։');return r;}
 async function latest(){if(!await bucket())return null;const files=await checked(store().list('releases',{limit:1,sortBy:{column:'name',order:'desc'}}));if(!files.length)return null;const match=/^(\d{10})\.json$/.exec(files[0].name);if(!match)fail(503,'APK թողարկման տվյալները սխալ են։');return release(Number(match[1]));}
 async function pruneReleases(){
  // Delete only releases proven older than two published versions. New concurrent
  // publications can only move this boundary forward, never endanger the keepers.
  for(let batch=0;batch<8;batch++){
   const files=await checked(store().list('releases',{limit:22,sortBy:{column:'name',order:'desc'}}));
   if(files.length<=2)return;
   const versions=await Promise.all(files.map(async file=>{
    const match=/^(\d{10})\.json$/.exec(file.name);if(!match)fail(503,'APK թողարկման տվյալները սխալ են։');
    const r=await release(Number(match[1]));if(releasePath(r.versionCode)!=='releases/'+file.name)fail(503,'APK թողարկման տվյալները սխալ են։');
    return r;
   }));
   const protectedPaths=new Set(versions.slice(0,2).map(r=>r.objectPath));
   const older=versions.slice(2),paths=[...new Set(older.map(r=>r.objectPath))].filter(path=>!protectedPaths.has(path));
   // Keep old manifests until their files have been removed. A failed delete is
   // then discoverable and retryable; never touch unpublished/in-flight uploads.
   if(paths.length)await checked(store().remove(paths));
   await checked(store().remove(older.map(r=>releasePath(r.versionCode))));
  }
  fail(503,'APK մաքրումը կշարունակվի հաջորդ հրապարակման ժամանակ։');
 }
 async function retention(){
  // Publishing has already committed. Cleanup trouble must not claim it failed.
  for(let attempt=0;attempt<2;attempt++){
   try{await pruneReleases();return {keptVersions:2,cleanupPending:false};}catch{}
  }
  console.error('APK retention cleanup pending');return {keptVersions:2,cleanupPending:true};
 }
 async function identity(req,upload=false){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');if(!/^[a-f0-9]{64}$/.test(token))fail(401,'Մուտք գործեք համակարգ։');
  const session=await checked(service.from('zzws_sessions').select('user_id,expires,setup_only,confirmed_until').eq('hash',await hash(new TextEncoder().encode(token))).gt('expires',new Date(now()).toISOString()).maybeSingle());if(!session)fail(401,'Մուտք գործեք համակարգ։');
  const user=await checked(service.from('zzws_users').select('id,active,profile,needs_password_setup').eq('id',session.user_id).eq('active',true).maybeSingle());if(!user)fail(401,'Հասանելիությունն անջատված է։');
  if(user.profile?.role!=='admin'||user.needs_password_setup||session.setup_only)fail(403,'Անհրաժեշտ է ադմինիստրատորի իրավունք։');
  const scope=await checked(service.from('zzws_admin_scopes').select('scope').eq('user_id',user.id).maybeSingle());if(!['owner','manager','viewer','price'].includes(scope?.scope))fail(403,'Հասանելիությունն արգելված է։');
  const channels=await checked(service.from('zzws_user_channels').select('mobile_admin_enabled').eq('user_id',user.id).maybeSingle());
  if(upload&&scope.scope!=='owner')fail(403,'APK հրապարակում է միայն սեփականատերը։');
  if(!upload&&scope.scope!=='owner'&&!channels?.mobile_admin_enabled)fail(403,'APK հասանելիությունը թույլատրված չէ։');
  if(upload&&!(Date.parse(session.confirmed_until)>now()))fail(428,'Հաստատեք ձեր ընթացիկ գաղտնաբառը։',{reauthRequired:true});
  return {id:user.id,mobile:channels?.mobile_admin_enabled===true,owner:scope.scope==='owner'};
 }
 return async req=>{
  const origin=req.headers.get('origin'),headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,HEAD,POST,OPTIONS','Access-Control-Expose-Headers':'Content-Disposition,Content-Length','Vary':'Origin',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})};
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
  try{
   if(origin&&!origins.includes(origin))fail(403,'Հասանելիությունն արգելված է։');if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
   const url=new URL(req.url),path=url.pathname.split('/zzws-apk/')[1]||'';
   if(path==='health'&&req.method==='GET')return json({ok:true,service:'zzws-apk',version:3,retainedVersions:2});
   if(!['current','download','download-link','publish','upload-check'].includes(path))fail(404,'Չի գտնվել։');
   const uploading=['publish','upload-check'].includes(path);
   if(uploading&&req.method!=='POST'||!uploading&&!['GET','HEAD'].includes(req.method))fail(405,'Գործողությունը թույլատրված չէ։');
   const actor=await identity(req,uploading);
   if(path==='upload-check')return json({ok:true,maxBytes:MAX_APK_BYTES});
   if(path==='current')return json({release:await latest(),canPublish:actor.owner,maxBytes:MAX_APK_BYTES});
   if(path==='download'||path==='download-link'){
    if(!actor.mobile)fail(403,'APK հասանելիությունը թույլատրված չէ։');const code=Number(url.searchParams.get('versionCode'));if(!Number.isInteger(code)||code<1||code>2147483647)fail(400,'Ստուգեք APK տարբերակը։');
    const r=await release(code);
    if(path==='download-link'){const result=await checked(store().createSignedUrl(r.objectPath,120,{download:r.filename}));return json({url:result.signedUrl,expiresIn:120});}
    const h={...headers,'Content-Type':MIME,'Content-Disposition':'attachment; filename="'+r.filename+'"','Content-Length':String(r.bytes)};if(req.method==='HEAD')return new Response(null,{headers:h});
    const blob=await checked(store().download(r.objectPath));if(blob.size!==r.bytes)fail(503,'APK ֆայլը հասանելի չէ ամբողջությամբ։');return new Response(blob,{headers:h});
   }
   if(Number(req.headers.get('content-length')||0)>MAX_APK_BYTES+100000)fail(413,'APK ֆայլը չպետք է գերազանցի 50 ՄԲ-ը։');
   // Binary envelope: 4-byte big-endian JSON length, UTF-8 metadata, APK bytes.
   // Avoid multipart parsing/copying of a large APK inside the Edge runtime.
   if(req.headers.get('content-type')!=='application/octet-stream')fail(400,'Թարմացրեք էջը և կրկին ընտրեք APK ֆայլը։');
   const chunks=[],reader=req.body?.getReader();if(!reader)fail(400,'Ընտրեք APK ֆայլը։');let length=0,timer;
   const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Object.assign(new Error('APK-ի բեռնման ժամանակն ավարտվել է։ Կրկին փորձեք։'),{status:408}));void reader.cancel().catch(()=>{});},uploadReadTimeoutMs);});
   try{for(;;){const part=await Promise.race([reader.read(),deadline]);if(part.done)break;length+=part.value.length;if(length>MAX_APK_BYTES+100000){void reader.cancel().catch(()=>{});fail(413,'APK ֆայլը չպետք է գերազանցի 50 ՄԲ-ը։');}chunks.push(part.value);}}finally{clearTimeout(timer);reader.releaseLock();}
   const input=new Uint8Array(length);let offset=0;for(const chunk of chunks){input.set(chunk,offset);offset+=chunk.length;}chunks.length=0;
   let info,headerLength=length>=4?new DataView(input.buffer).getUint32(0):0;
   try{if(!headerLength||headerLength>20000||headerLength+4>=length)throw Error();info=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(input.subarray(4,4+headerLength)));}catch{fail(400,'Ստուգեք APK ֆայլը և նկարագրությունը։');}
   const description=typeof info.description==='string'?info.description.trim():'';
   if(typeof info.filename!=='string'||!info.filename.toLowerCase().endsWith('.apk')||description.length>4000)fail(400,'Ստուգեք APK ֆայլը և նկարագրությունը։');
   const bytes=input.subarray(4+headerLength);if(bytes.length>MAX_APK_BYTES)fail(413,'APK ֆայլը չպետք է գերազանցի 50 ՄԲ-ը։');
   const metadata=inspectApk(bytes),sha256=await hash(bytes);
   const previous=await latest();if(metadata.versionCode<baselineVersionCode||previous&&metadata.versionCode<=previous.versionCode){if(previous?.sha256===sha256&&previous.description===description)return json({ok:true,release:previous,unchanged:true,retention:await retention()});fail(409,'Ընտրեք ավելի նոր APK տարբերակ։ Ընթացիկ թողարկումը պահպանված է։');}
   // Recheck the actor after reading/validating a potentially slow upload.
   await identity(req,true);await bucket(true);
   const r={schemaVersion:1,...metadata,filename:'ZZWS-'+metadata.version+'-production.apk',bytes:bytes.length,sha256,description,objectPath:'files/'+sha256+'.apk',publishedAt:new Date(now()).toISOString(),publisher:actor.id};
   const uploaded=await store().upload(r.objectPath,bytes,{contentType:MIME,upsert:false,cacheControl:'0'});if(uploaded.error&&String(uploaded.error.statusCode||uploaded.error.status)!=='409')fail(503,'Չհաջողվեց բեռնել APK-ը։ Նախորդ տարբերակը պահպանված է։');
   const stored=await checked(store().download(r.objectPath));if(stored.size!==r.bytes||await hash(await stored.arrayBuffer())!==sha256)fail(503,'Բեռնված APK-ը չի անցել ստուգումը։ Նախորդ տարբերակը պահպանված է։');
   await identity(req,true);
   // Immutable, zero-padded version manifests: publish last; concurrent releases cannot downgrade latest.
   const published=await store().upload(releasePath(r.versionCode),JSON.stringify(r),{contentType:'application/json',upsert:false,cacheControl:'0'});if(published.error)fail(String(published.error.statusCode||published.error.status)==='409'?409:503,'Թողարկումը չի հրապարակվել։ Թարմացրեք ընթացիկ տարբերակը և կրկին փորձեք։');
   const audit=await service.from('zzws_audit').insert({actor:actor.id,action:'apk_publish',detail:'ZZWS Android '+r.version+'; versionCode='+r.versionCode+'; SHA-256='+sha256});if(audit.error)console.error('APK audit write failed');
   return json({ok:true,release:r,retention:await retention()});
  }catch(error){if(!error.status)console.error('APK operation failed');return json({error:error.status?error.message:'Չհաջողվեց կատարել գործողությունը։ Փորձեք կրկին։',...(error.reauthRequired?{reauthRequired:true}:{})},error.status||500);}
 };
}
