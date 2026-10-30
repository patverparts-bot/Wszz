(() => {
 'use strict';
 const releaseUrl=new URL('../apk-release.json',document.currentScript.src);
 const assetOptions={credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error'};
 const maxApkBytes=150*1024*1024;
 let owner=null,ticket=0,mount=null,loading=false;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 function root(){
  if(mount?.isConnected)return mount;
  mount=document.getElementById('adminResourcesPanel')||document.getElementById('catalogAdminResources');
  if(!mount){const cabinet=document.getElementById('cabinetModal');if(!cabinet)return null;mount=node('section');mount.id='catalogAdminResources';mount.hidden=true;const subtitle=document.getElementById('cabinetUserSubtitle');(subtitle?.parentElement||cabinet).append(mount);}
  return mount;
 }
 function reset(){owner=null;++ticket;loading=false;const box=root();if(box){box.replaceChildren();box.hidden=true;}}
 function textError(error){return window.ZZWS?.message(error)||'Չհաջողվեց կատարել գործողությունը։';}
 async function readRelease(){
  // Only a filename beside the manifest is accepted; account credentials never leave the API.
  const response=await fetch(releaseUrl,assetOptions);
  if(!response.ok)throw Error('APK-ի թողարկման տվյալները դեռ հասանելի չեն։ Փորձեք ավելի ուշ։');
  const text=await response.text();if(text.length>16384)throw Error('APK-ի թողարկման տվյալները սխալ են։');
  let data;try{data=JSON.parse(text);}catch{throw Error('APK-ի թողարկման տվյալները սխալ են։');}
  if(data?.schemaVersion!==1||typeof data.version!=='string'||!/^[0-9][A-Za-z0-9.+_-]{0,79}$/.test(data.version)||
   typeof data.filename!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}\.apk$/.test(data.filename)||
   typeof data.sha256!=='string'||!/^[a-f0-9]{64}$/.test(data.sha256)||!Number.isSafeInteger(data.bytes)||data.bytes<4||data.bytes>maxApkBytes||
   typeof data.description!=='string'||data.description.length>4000)throw Error('APK-ի թողարկման տվյալները սխալ են։');
  return {...data,url:new URL(data.filename,releaseUrl).href};
 }
 function showRelease(card,release){
  card.querySelector('[data-apk-version]').textContent='Տարբերակ՝ '+release.version;
  card.querySelector('[data-apk-description]').textContent=release.description;
 }
 async function availability(button,notice,card,who,requestTicket){
  button.disabled=true;button.textContent='Ստուգվում է APK-ի հասանելիությունը…';
  try{
   const release=await readRelease();
   const response=await fetch(release.url,{...assetOptions,method:'HEAD'});
   const length=response.headers.get('content-length');
   if(!response.ok||!/^(application\/vnd\.android\.package-archive|application\/octet-stream)(;|$)/i.test(response.headers.get('content-type')||'')||length!==null&&Number(length)!==release.bytes)throw Error('APK-ը դեռ հասանելի չէ։ Փորձեք ավելի ուշ։');
   if(owner!==who||requestTicket!==ticket)return;
   showRelease(card,release);button.textContent='Ներբեռնել ZZWS Android հավելվածը';button.onclick=()=>download(button,notice,card,who,requestTicket);button.disabled=false;notice.textContent='';
  }catch(error){if(owner===who&&requestTicket===ticket){notice.textContent=textError(error);button.textContent='Կրկին ստուգել APK-ը';button.onclick=()=>availability(button,notice,card,who,requestTicket);button.disabled=false;}}
 }
 async function download(button,notice,card,who,requestTicket){
  if(loading||owner!==who||requestTicket!==ticket)return;loading=true;button.disabled=true;notice.textContent='Ֆայլը բեռնվում է…';
  try{
   const permission=await ZZWS.json('me/resources');
   if(owner!==who||requestTicket!==ticket)return;
   if(permission.mobileAdminEnabled!==true)throw Error('Ներբեռնման թույլտվությունը փոխվել է։');
   const release=await readRelease();
   if(owner!==who||requestTicket!==ticket)return;
   showRelease(card,release);
   // Public GitHub asset: never send the ZZWS session or API key to this URL.
   const response=await fetch(release.url,assetOptions);
   if(!response.ok){const e=new Error('APK-ի ներբեռնումը հասանելի չէ։ Թարմացրեք մուտքը կամ դիմեք սեփականատիրոջը։');e.status=response.status;throw e;}
   if(!/^(application\/vnd\.android\.package-archive|application\/octet-stream)(;|$)/i.test(response.headers.get('content-type')||''))throw Error('Սերվերը վերադարձրել է ոչ ճիշտ APK ֆայլ։');
   const blob=await response.blob();if(blob.size!==release.bytes)throw Error('APK ֆայլի ստուգումը ձախողվել է։ Թարմացրեք էջը կամ դիմեք սեփականատիրոջը։');
   const signature=new Uint8Array(await blob.slice(0,4).arrayBuffer());if(signature[0]!==80||signature[1]!==75||signature[2]!==3||signature[3]!==4)throw Error('APK ֆայլը չի ստուգվել։');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
   if(digest!==release.sha256)throw Error('APK ֆայլի ստուգումը ձախողվել է։ Թարմացրեք էջը կամ դիմեք սեփականատիրոջը։');
   if(owner!==who||requestTicket!==ticket)return;
   const current=await ZZWS.json('me/resources');
   if(owner!==who||requestTicket!==ticket)return;
   if(current.mobileAdminEnabled!==true)throw Error('Ներբեռնման թույլտվությունը փոխվել է։');
   const link=node('a'),url=URL.createObjectURL(blob);link.href=url;link.download=release.filename;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   notice.textContent='APK ֆայլը ներբեռնված է։ Տեղադրեք այն ձեր Android սարքում։';
  }catch(error){if(owner===who&&requestTicket===ticket)notice.textContent=textError(error);}
  finally{if(owner===who&&requestTicket===ticket){loading=false;if(button.isConnected)button.disabled=false;}}
 }
 function render(data,who,requestTicket){
  const box=root();if(!box)return;box.replaceChildren();box.hidden=true;
  const mobile=data.mobileAdminEnabled===true,telegram=data.telegramEnabled===true;
  if(!mobile&&!telegram)return;
  box.style.cssText='padding:16px;margin:16px 0;border:1px solid #94a3b8;border-radius:12px;line-height:1.6';
  if(box.id==='catalogAdminResources')box.style.cssText+='max-height:34vh;overflow:auto;flex-shrink:0;';
  box.append(node('h3','ZZWS Admin և Telegram'));const notice=node('p');notice.setAttribute('role','status');notice.style.fontSize='13px';
  if(mobile){
   const card=node('div');card.append(node('h4','ZZWS Admin՝ Android հավելված'));
   const button=node('button');button.type='button';button.dataset.resource='apk';button.style.cssText='padding:10px 14px;border:1px solid #2563eb;border-radius:8px;background:#1d4ed8;color:white;cursor:pointer';card.append(button);
   const version=node('p');version.dataset.apkVersion='';card.append(version);const description=node('p');description.dataset.apkDescription='';description.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';card.append(description);availability(button,notice,card,who,requestTicket);
   card.append(node('p','Մուտք գործեք ձեր ZZWS ադմինիստրատորի հաշվով։ Հավելվածը չի ընդլայնում հաշվի իրավունքները։'));box.append(card);
  }
  if(telegram){
   const card=node('div');card.dataset.resource='telegram';card.append(node('h4','Telegram ծանուցումների միացում'));
   card.append(node('p',data.telegram?.mode==='offline'?'Անցանց փորձարկման ռեժիմ․ իրական Telegram հաղորդագրություններ չեն ուղարկվում։':'Ծանուցումները նախատեսված են միայն սեփականատիրոջ կողմից հաստատված ստացողի համար։'));
   const username=data.telegram?.botUsername,validBot=typeof username==='string'&&/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)&&!['botfather','userinfobot'].includes(username.toLowerCase());
   card.append(node('p',validBot?'ZZWS ծանուցումների բոտ՝ @'+username:'ZZWS ծանուցումների բոտը դեռ նշված չէ։ Սեփականատերը պետք է այն լրացնի ադմինիստրատորի քարտում։'));
   const list=node('ol');for(const step of [
    validBot?'Telegram-ում բացեք @'+username+' բոտը ստորև նշված հղումով։':'Սեփականատիրոջից ստացեք հենց ZZWS ծանուցումների բոտի անունը կամ հղումը։',
    'Ձեր անձնական թվային Telegram ID-ն իմանալու համար առանձին բացեք @userinfobot-ը և սեղմեք Start։ Պատճենեք պատասխանի «Id» թվային արժեքը։ Սա ստացողի ID-ն է, ոչ թե բոտի անունը։',
    'Փոխանցեք անձնական ID-ն ZZWS-ի սեփականատիրոջը։ Նա այն պահպանում է ձեր ադմինիստրատորի քարտի «Ստացողի անձնական Telegram ID» դաշտում և միացնում ծանուցումները։',
    'ID-ն քարտում պահպանելուց հետո սեղմեք ZZWS բոտի «Սկսել» (Start) կոճակը կամ կրկին ուղարկեք /start։ Սերվերային միացումը գործարկված լինելու դեպքում կստանաք միացման հաստատում։ «Доступ запрещён» պատասխանը նշանակում է, որ տվյալ անձնական ID-ն դեռ թույլատրված չէ։',
    'Յուրաքանչյուր ադմինիստրատոր ստանում է ծանուցումները իր քարտում նշված Telegram ID-ով, եթե հասանելիությունը միացված է և ունի պատվերները դիտելու իրավունք։ Միացումից հետո ծանուցումները վերաբերում են նոր պատվերներին և հետագա փոփոխություններին։ Հին իրադարձությունները կրկին չեն ուղարկվում։',
    'Բոտը միայն տեղեկացնում է․ պատվերների կառավարումն իրականացվում է ZZWS-ում։ Գաղտնաբառ կամ բոտի գաղտնի բանալի Telegram-ով մի ուղարկեք։'
   ])list.append(node('li',step));card.append(list);
   if(validBot){const link=node('a','Բացել ZZWS ծանուցումների բոտը՝ @'+username);link.href='https://t.me/'+username;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}
   const idHelp=node('a','Իմանալ իմ անձնական ID-ն՝ @userinfobot');idHelp.href='https://t.me/userinfobot';idHelp.target='_blank';idHelp.rel='noopener noreferrer';idHelp.style.display='block';card.append(idHelp);
   if(data.telegram?.canSimulateStart===true){const simulator=node('a','Փորձարկել /start-ը անցանց՝ առանց Telegram ուղարկելու');simulator.href='/offline-console';simulator.style.display='block';card.append(simulator);}
   card.append(node('p',data.telegram?.recipientConfigured?'Ձեր անձնական ID-ն պահպանված է սերվերում։ Իրական ուղարկումը կախված է սերվերի միացված ծառայությունից։':'Ձեր ստացողի ID-ն դեռ հաստատված չէ այս հաշվի համար։ Դիմեք սեփականատիրոջը։'));
   if(typeof data.telegram?.instructions==='string'&&data.telegram.instructions.length<=2000)card.append(node('p',data.telegram.instructions));box.append(card);
  }
  box.append(notice);box.hidden=false;
 }
 async function start(user,options={}){
  reset();if(options.root)mount=options.root;
  if(user?.role!=='admin'||!user.id||(user.mobileAdminEnabled!==true&&user.telegramEnabled!==true))return;
  owner=user.id;const who=owner,requestTicket=++ticket;
  try{const data=await ZZWS.json('me/resources');if(who!==owner||requestTicket!==ticket)return;render(data,who,requestTicket);}
  catch{if(who===owner&&requestTicket===ticket){const box=root();if(box){box.replaceChildren();box.hidden=true;}}}
 }
 async function refresh(){try{await start(await ZZWS.json('me'));}catch{reset();}}
 window.ZZWS_ADMIN_RESOURCES=Object.freeze({start,reset,refresh});
 window.addEventListener('zzws:session-changed',event=>event.detail?.user?start(event.detail.user):reset());
})();
