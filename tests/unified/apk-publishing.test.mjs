import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {deflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {inspectApk} from '../../supabase/functions/zzws-apk/apk.mjs';
import {createApkHandler} from '../../supabase/functions/zzws-apk/handler.mjs';
const fixture=Buffer.from(JSON.parse(await readFile(new URL('../fixtures/zzws-apk-manifest.json',import.meta.url),'utf8')).base64,'base64');
const token='a'.repeat(64),origin='https://patverparts-bot.github.io';
const digest=b=>createHash('sha256').update(b).digest('hex');
function zip(entries){let offset=0;const locals=[],central=[];for(const [name,raw]of entries){const filename=Buffer.from(name),packed=deflateRawSync(raw),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(filename.length,26);const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50);cd.writeUInt16LE(8,10);cd.writeUInt32LE(packed.length,20);cd.writeUInt32LE(raw.length,24);cd.writeUInt16LE(filename.length,28);cd.writeUInt32LE(offset,42);locals.push(local,filename,packed);central.push(cd,filename);offset+=local.length+filename.length+packed.length;}const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,directory,end]);}
function apk(code=70008,version='7.0.8',manifest=fixture){const b=Buffer.from(manifest),needle=Buffer.alloc(4);needle.writeUInt32LE(70008);const at=b.indexOf(needle);assert.ok(at>=0);b.writeUInt32LE(code,at);if(version!=='7.0.8'){const old=Buffer.from('7.0.8','utf16le'),at=b.indexOf(old);assert.ok(at>=0);Buffer.from(version,'utf16le').copy(b,at);}return zip([['AndroidManifest.xml',b],['classes.dex',Buffer.from('dex\n035\0')]]);}
function envelope(bytes,description='New APK',filename='update.apk'){const info=Buffer.from(JSON.stringify({filename,description})),size=Buffer.alloc(4);size.writeUInt32BE(info.length);return Buffer.concat([size,info,bytes]);}
function fake(options={}){
 const objects=new Map(),audits=[],state={exists:false,public:false,scope:'owner',mobile:true,active:true,setup:false,confirmed:true,expired:false,revoked:false,failFile:false,failManifest:false,failRemove:false,failRemoveManifest:false,removals:[],revokeAfterFile:false,options:null};
 const service={from(name){const filters={};const builder={select(){return this;},eq(k,v){filters[k]=v;return this;},gt(){return this;},async maybeSingle(){let data=name==='zzws_sessions'?!state.expired&&!state.revoked&&filters.hash===digest(token)?{user_id:'owner',setup_only:state.setup,confirmed_until:state.confirmed?new Date(Date.now()+300000).toISOString():null}:null:name==='zzws_users'?state.active?{id:'owner',profile:{role:'admin'},needs_password_setup:false}:null:name==='zzws_admin_scopes'?{scope:state.scope}:name==='zzws_user_channels'?{mobile_admin_enabled:state.mobile}:null;return {data,error:null};},async insert(row){audits.push(row);return {data:null,error:null};}};return builder;},storage:{async getBucket(){return state.exists?{data:{public:state.public},error:null}:{error:{statusCode:404}};},async createBucket(name,options){state.options=options;state.exists=true;return {data:{name},error:null};},from(){return {async list(prefix,{limit=100,offset=0,sortBy}={}){let names=[...objects.keys()].filter(p=>p.startsWith(prefix+'/')).map(p=>p.slice(prefix.length+1)).sort();if(sortBy?.order==='desc')names.reverse();return {data:names.slice(offset,offset+limit).map(name=>({name})),error:null};},async remove(paths){state.removals.push([...paths]);if(state.failRemove||state.failRemoveManifest&&paths.some(p=>p.startsWith('releases/')))return {error:{statusCode:503}};for(const path of paths)objects.delete(path);return {data:[],error:null};},async download(path){return objects.has(path)?{data:new Blob([objects.get(path)]),error:null}:{error:{statusCode:404}};},async upload(path,body){if(path.startsWith('files/')&&state.failFile||path.startsWith('releases/')&&state.failManifest)return {error:{statusCode:503}};if(objects.has(path))return {error:{statusCode:409}};objects.set(path,typeof body==='string'?Buffer.from(body):Buffer.from(body));if(path.startsWith('files/')&&state.revokeAfterFile)state.revoked=true;return {data:{path},error:null};}};}}};
 const handle=createApkHandler({service,origins:[origin],...options});
 async function request(path,{method='GET',body,auth=token,requestOrigin=origin,headers={}}={}){return handle(new Request('https://example.invalid/functions/v1/zzws-apk/'+path,{method,headers:{...headers,...(body?{'Content-Type':'application/octet-stream'}:{}),...(auth?{Authorization:'Bearer '+auth}:{}),...(requestOrigin?{Origin:requestOrigin}:{})},...(body?{body,duplex:'half'}:{})}));}
 const publish=async(bytes=apk(),description='New APK')=>{return request('publish',{method:'POST',body:envelope(bytes,description)});};
 return {objects,audits,state,request,publish,service};
}
test('reads Android package/version from compiled manifest; rejects wrong packages and broken ZIPs',()=>{
 assert.deepEqual(inspectApk(apk()),{package:'am.zzws.admin',version:'7.0.8',versionCode:70008});assert.equal(inspectApk(apk(70009,'7.0.9')).version,'7.0.9');
 const other=Buffer.from(fixture),at=other.indexOf(Buffer.from('am.zzws.admin','utf16le'));assert.ok(at>=0);Buffer.from('xx.zzws.admin','utf16le').copy(other,at);
 for(const bytes of [Buffer.from('not an apk'),apk().subarray(0,100),zip([['AndroidManifest.xml',fixture]]),apk(70008,'7.0.8',other)])assert.throws(()=>inspectApk(bytes),e=>e.status===400);
});
test('authentication, scope, origin and fresh password confirmation are enforced',async()=>{
 const f=fake();assert.equal((await f.request('current',{auth:null})).status,401);assert.equal((await f.request('current',{requestOrigin:'https://evil.invalid'})).status,403);
 f.state.scope='manager';assert.equal((await f.publish()).status,403);f.state.scope='owner';f.state.confirmed=false;const r=await f.publish();assert.equal(r.status,428);assert.equal((await r.json()).reauthRequired,true);
 f.state.confirmed=true;f.state.setup=true;assert.equal((await f.publish()).status,403);f.state.setup=false;f.state.expired=true;assert.equal((await f.publish()).status,401);assert.equal(f.objects.size,0);
});
test('publishes complete verified APK before its immutable manifest, and serves the exact file',async()=>{
 const f=fake();assert.equal((await(await f.request('current')).json()).release,null);const bytes=apk(),response=await f.publish(bytes);assert.equal(response.status,200);const r=(await response.json()).release;
 assert.equal(r.version,'7.0.8');assert.equal(r.versionCode,70008);assert.equal(r.sha256,digest(bytes));assert.equal(r.bytes,bytes.length);assert.equal(f.state.options.public,false);assert.equal(f.state.options.fileSizeLimit,50_000_000);assert.equal(f.audits[0].action,'apk_publish');
 const active=(await(await f.request('current')).json()).release;assert.deepEqual(active,r);const file=await f.request('download?versionCode=70008');assert.equal(file.status,200);assert.equal(digest(Buffer.from(await file.arrayBuffer())),r.sha256);
 f.state.mobile=false;assert.equal((await f.request('download?versionCode=70008')).status,403);f.state.scope='viewer';assert.equal((await f.request('current')).status,403);
});
test('older releases, partial writes and lost sessions leave the current release intact',async()=>{
 const f=fake();await f.publish();let response=await f.publish(apk(70007,'7.0.7'));assert.equal(response.status,409);
 f.state.failManifest=true;response=await f.publish(apk(70009,'7.0.9'));assert.equal(response.status,503);assert.equal((await(await f.request('current')).json()).release.versionCode,70008);
 f.state.failManifest=false;f.state.revokeAfterFile=true;response=await f.publish(apk(70010,'7.1.0'));assert.equal(response.status,401);f.state.revoked=false;assert.equal((await(await f.request('current')).json()).release.versionCode,70008);
});
test('concurrent publishers cannot replace an existing version or downgrade the latest release',async()=>{
 const f=fake();const responses=await Promise.all([f.publish(apk(70009,'7.0.9')),f.publish(apk(70010,'7.1.0'))]);assert.ok(responses.every(r=>[200,409].includes(r.status)));assert.equal((await(await f.request('current')).json()).release.versionCode,70010);
 assert.equal((await f.publish(apk(70009,'7.0.9'))).status,409);
});
test('update download links require current APK permission and expire after two minutes',async()=>{
 const f=fake();await f.publish();let signed=null;const original=f.service.storage.from;
 f.service.storage.from=()=>({...original(),async createSignedUrl(path,expires,options){signed={path,expires,options};return {data:{signedUrl:'https://example.invalid/storage/v1/object/sign/temporary?token=synthetic'},error:null};}});
 const response=await f.request('download-link?versionCode=70008');assert.equal(response.status,200);assert.equal((await response.json()).expiresIn,120);assert.equal(signed.expires,120);assert.equal(signed.options.download,'ZZWS-7.0.8-production.apk');assert.ok(signed.path.startsWith('files/'));
 f.state.mobile=false;assert.equal((await f.request('download-link?versionCode=70008')).status,403);assert.equal((await f.request('download-link?versionCode=70008',{auth:null})).status,401);f.state.mobile=true;assert.equal((await f.request('download-link?versionCode=../private')).status,400);
});


test('small upload check confirms owner/password before sending a large file',async()=>{
 const f=fake();assert.equal((await f.request('upload-check',{method:'POST'})).status,200);
 f.state.confirmed=false;assert.equal((await f.request('upload-check',{method:'POST'})).status,428);
 f.state.confirmed=true;f.state.scope='manager';assert.equal((await f.request('upload-check',{method:'POST'})).status,403);assert.equal(f.objects.size,0);
});
test('stalled upload terminates with 408 and leaves published version intact',async()=>{
 const f=fake({uploadReadTimeoutMs:25});await f.publish();let cancelled=false;
 const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array([0,0,0,20]));},cancel(){cancelled=true;}});
 const response=await f.request('publish',{method:'POST',body});assert.equal(response.status,408);assert.ok(cancelled);
 assert.equal((await(await f.request('current')).json()).release.versionCode,70008);
});
test('malformed envelope and oversized chunked bodies do not publish',async()=>{
 const f=fake();for(const body of [Buffer.alloc(2),Buffer.from([255,255,255,255]),envelope(apk(),'x'.repeat(4001)),envelope(apk(),'ok','bad.txt')])assert.equal((await f.request('publish',{method:'POST',body})).status,400);
 let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(50_100_001));},cancel(){cancelled=true;}});
 assert.equal((await f.request('publish',{method:'POST',body})).status,413);assert.ok(cancelled);assert.equal(f.objects.size,0);
});
test('publishes actual production sized APK using binary transport with Armenian notes',{skip:!process.env.ZZWS_APK_TEST_FILE},async()=>{
 const f=fake(),bytes=await readFile(process.env.ZZWS_APK_TEST_FILE);
 const response=await f.publish(bytes,'Նոր տարբերակ');assert.equal(response.status,200);const r=(await response.json()).release;
 assert.equal(r.version,'7.0.10');assert.equal(r.sha256,digest(bytes));assert.equal(r.bytes,bytes.length);assert.equal(r.description,'Նոր տարբերակ');
 assert.equal((await f.publish(bytes,'Նոր տարբերակ')).status,200);
});

function seedRelease(f,code,version,overrides={}){
 const bytes=apk(code,version),sha256=digest(bytes),r={schemaVersion:1,...inspectApk(bytes),filename:'ZZWS-'+version+'-production.apk',bytes:bytes.length,sha256,description:'New APK',objectPath:'files/'+sha256+'.apk',publishedAt:new Date().toISOString(),publisher:'owner',...overrides};
 f.state.exists=true;f.objects.set(r.objectPath,bytes);f.objects.set('releases/'+String(code).padStart(10,'0')+'.json',Buffer.from(JSON.stringify(r)));return r;
}
function releaseCodes(f){return [...f.objects.keys()].filter(p=>p.startsWith('releases/')).sort().map(p=>Number(p.slice(9,-5)));}

test('retention keeps two newest published releases and deletes APKs plus metadata',async()=>{
 const f=fake();for(let i=8;i<=12;i++)seedRelease(f,70000+i,'7.'+Math.floor(i/10)+'.'+i%10);
 const response=await f.publish(apk(70013,'7.1.3'));assert.equal(response.status,200);assert.deepEqual((await response.json()).retention,{keptVersions:2,cleanupPending:false});
 assert.deepEqual(releaseCodes(f),[70012,70013]);assert.equal(f.objects.size,4);
 for(const code of [70012,70013])assert.equal((await f.request('download?versionCode='+code)).status,200);
 assert.equal((await(await f.request('current')).json()).release.versionCode,70013);
});
test('failed publication never runs retention or removes either current release',async()=>{
 const f=fake();await f.publish();await f.publish(apk(70009,'7.0.9'));const before=new Map(f.objects);
 f.state.failManifest=true;assert.equal((await f.publish(apk(70010,'7.1.0'))).status,503);assert.deepEqual(releaseCodes(f),[70008,70009]);assert.equal(f.state.removals.length,0);
 for(const [path,bytes] of before)assert.deepEqual(f.objects.get(path),bytes);
});
test('concurrent publications and cleanup preserve the two greatest version codes',async()=>{
 const f=fake();for(let i=8;i<=10;i++)seedRelease(f,70000+i,'7.'+Math.floor(i/10)+'.'+i%10);
 const responses=await Promise.all([11,12,13].map(i=>f.publish(apk(70000+i,'7.'+Math.floor(i/10)+'.'+i%10))));assert.ok(responses.every(r=>[200,409].includes(r.status)));
 assert.deepEqual(releaseCodes(f),[70012,70013]);assert.equal(f.objects.size,4);
 for(const code of [70012,70013])assert.equal((await f.request('download?versionCode='+code)).status,200);
});
test('cleanup failure reports publication success and identical retry finishes cleanup',async()=>{
 const f=fake();seedRelease(f,70008,'7.0.8');seedRelease(f,70009,'7.0.9');f.state.failRemove=true;
 let response=await f.publish(apk(70010,'7.1.0'));assert.equal(response.status,200);assert.equal((await response.json()).retention.cleanupPending,true);assert.deepEqual(releaseCodes(f),[70008,70009,70010]);
 assert.equal((await f.request('download?versionCode=70010')).status,200);f.state.failRemove=false;
 response=await f.publish(apk(70010,'7.1.0'));assert.equal(response.status,200);assert.equal((await response.json()).retention.cleanupPending,false);assert.deepEqual(releaseCodes(f),[70009,70010]);assert.equal(f.objects.size,4);
});
test('failed metadata deletion remains discoverable, and orphan/in-flight uploads are untouched',async()=>{
 const f=fake();seedRelease(f,70008,'7.0.8');seedRelease(f,70009,'7.0.9');const orphan='files/'+'f'.repeat(64)+'.apk';f.objects.set(orphan,Buffer.from('pending upload'));
 f.state.failRemoveManifest=true;const response=await f.publish(apk(70010,'7.1.0'));assert.equal((await response.json()).retention.cleanupPending,true);assert.deepEqual(releaseCodes(f),[70008,70009,70010]);
 f.state.failRemoveManifest=false;await f.publish(apk(70010,'7.1.0'));assert.deepEqual(releaseCodes(f),[70009,70010]);assert.ok(f.objects.has(orphan));
});
test('cleanup protects retained paths and fails closed for corrupt version metadata',async()=>{
 const f=fake();const retained=seedRelease(f,70009,'7.0.9');seedRelease(f,70008,'7.0.8',{objectPath:retained.objectPath,sha256:retained.sha256});
 await f.publish(apk(70010,'7.1.0'));assert.deepEqual(releaseCodes(f),[70009,70010]);assert.ok(f.objects.has(retained.objectPath));
 const g=fake();seedRelease(g,70008,'7.0.8',{versionCode:123});seedRelease(g,70009,'7.0.9');const result=await g.publish(apk(70010,'7.1.0'));assert.equal((await result.json()).retention.cleanupPending,true);assert.equal(g.state.removals.length,0);
});

test('retention drains multiple listing batches without skipping historical releases',async()=>{
 const f=fake();for(let i=8;i<=34;i++)seedRelease(f,70000+i,'7.'+Math.floor(i/10)+'.'+i%10);
 const response=await f.publish(apk(70035,'7.3.5'));assert.equal(response.status,200);assert.equal((await response.json()).retention.cleanupPending,false);assert.deepEqual(releaseCodes(f),[70034,70035]);assert.equal(f.objects.size,4);
});
