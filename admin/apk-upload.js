(() => {
 'use strict';
 const endpoint=path=>new URL('../zzws-apk/'+path,ZZWS_CONFIG.api).href;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 let actor=null,serial=0,panel=null,busy=false;
 function reset(){actor=null;++serial;busy=false;if(panel){panel.replaceChildren();panel.hidden=true;}}
 function start(user){
  reset();if(user?.role!=='admin'||user.adminScope!=='owner'||!user.id)return;actor=user.id;const who=actor,ticket=++serial;
  panel=document.getElementById('apkUploadPanel');if(!panel){panel=node('section');panel.id='apkUploadPanel';document.getElementById('adminResourcesPanel').after(panel);}
  const field=node('fieldset');field.style.minWidth='0';field.append(node('legend','Android հավելվածի թարմացում'));
  field.append(node('p','Ընտրեք նոր APK-ը և գրեք՝ ինչ է փոխվել։ Տարբերակը կկարդացվի ֆայլից։ Հրապարակումից հետո այն հասանելի կլինի APK թույլտվություն ունեցող հաշիվներին։ Պահվում են վերջին 2 հրապարակված տարբերակները․ ավելի հները ջնջվում են ինքնաշխատ։'));
  const current=node('p','Ընթացիկ տարբերակը բեռնվում է…');current.dataset.apkCurrent='';field.append(current);
  const form=node('form'),label=node('label','Նոր APK ֆայլ'),file=node('input');form.style.cssText='display:grid;gap:12px;min-width:0';label.style.cssText='display:grid;gap:6px;min-width:0';file.type='file';file.accept='.apk,application/vnd.android.package-archive';file.required=true;file.name='file';file.style.cssText='display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box';label.append(file);form.append(label);
  const notesLabel=node('label','Ինչ է փոխվել'),notes=node('textarea');notesLabel.style.cssText='display:grid;gap:6px;min-width:0';notes.name='description';notes.maxLength=4000;notes.rows=3;notes.style.cssText='display:block;width:100%;min-width:0;box-sizing:border-box;resize:vertical;padding:10px;border:1px solid #94a3b8;border-radius:8px;font:inherit';notesLabel.append(notes);form.append(notesLabel);
  const button=node('button','Հրապարակել նոր APK-ը');button.type='submit';button.style.cssText='justify-self:start;max-width:100%;white-space:normal';form.append(button);
  const progress=node('progress');progress.max=100;progress.hidden=true;progress.style.width='100%';progress.setAttribute('aria-label','APK-ի բեռնման ընթացքը');form.append(progress);
  const status=node('p');status.setAttribute('role','status');status.dataset.apkUploadStatus='';form.append(status);field.append(form);panel.append(field);panel.hidden=false;
  const valid=()=>actor===who&&ticket===serial;
  function showCurrent(release){current.textContent=release?'Ընթացիկ տարբերակ՝ '+release.version+' · '+(release.bytes/1000000).toFixed(1)+' ՄԲ':'Ընթացիկ ներբեռնումը՝ GitHub-ից։ Նոր APK-ը կարող եք հրապարակել այստեղ։';}
  async function load(){try{const data=await ZZWS.json(endpoint('current'),{timeoutMs:15000});if(valid())showCurrent(data.release);}catch(error){if(valid())current.textContent=ZZWS.message(error);}}
  function published(release,retention){showCurrent(release);status.dataset.state='success';status.style.color=retention?.cleanupPending?'#92400e':'#166534';status.textContent='APK '+release.version+' հրապարակված է։ Ներբեռնումը թարմացվել է անձնական կաբինետում։'+(retention?.cleanupPending?' Հին տարբերակների մաքրումը հետաձգվել է։ Այն կկրկնվի հաջորդ հրապարակման կամ նույն ֆայլի կրկնակի ուղարկման ժամանակ։':'');form.reset();void Promise.resolve().then(()=>window.ZZWS_ADMIN_RESOURCES?.refresh()).catch(()=>{});}
  file.onchange=()=>{if(valid())status.textContent=file.files[0]?'Ընտրված է՝ '+file.files[0].name:'';};
  form.onsubmit=async event=>{
   event.preventDefault();if(!valid()||busy)return;const apk=file.files[0];if(!apk)return;
   if(!apk.name.toLowerCase().endsWith('.apk')||apk.size>50_000_000){status.textContent='Ընտրեք մինչև 50 ՄԲ APK ֆայլ։';return;}
   const description=notes.value.trim();let sha256=null,sent=false;
   busy=true;button.disabled=true;file.disabled=true;notes.disabled=true;status.style.color='';status.dataset.state='working';status.textContent='Ստուգվում է հրապարակման թույլտվությունը։ Անհրաժեշտության դեպքում հաստատեք գաղտնաբառը։';
   try{
    await ZZWS.json(endpoint('upload-check'),{method:'POST',timeoutMs:15000});if(!valid())return;
    status.textContent='Պատրաստվում է APK ֆայլը…';
    sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await apk.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');if(!valid())return;
    const metadata=new TextEncoder().encode(JSON.stringify({filename:apk.name,description})),size=new Uint8Array(4);new DataView(size.buffer).setUint32(0,metadata.length);
    const body=new Blob([size,metadata,apk],{type:'application/octet-stream'});progress.value=0;progress.hidden=false;status.textContent='APK-ը բեռնվում է՝ 0%';sent=true;
    const result=await ZZWS.json(endpoint('publish'),{method:'POST',body,headers:{'Content-Type':'application/octet-stream'},timeoutMs:120000,onUploadProgress:({loaded,total})=>{if(!valid())return;const percent=total?Math.min(100,Math.floor(loaded/total*100)):0;progress.value=percent;status.textContent=total&&loaded>=total?'Ֆայլն ուղարկված է։ Սերվերը ստուգում և հրապարակում է APK-ը…':'APK-ը բեռնվում է՝ '+percent+'% · '+(loaded/1000000).toFixed(1)+' ՄԲ';}});
    if(valid())published(result.release,result.retention);
   }catch(error){
    if(!valid())return;
    // A lost response does not prove failure: reconcile the exact file and notes.
    if(sent&&!error.staleSession&&error.status!==401&&error.status!==403){
     status.textContent='Ստուգվում է՝ արդյոք APK-ը հրապարակվել է…';
     try{const data=await ZZWS.json(endpoint('current'),{timeoutMs:15000});if(!valid())return;showCurrent(data.release);if(data.release?.sha256===sha256&&data.release.bytes===apk.size&&data.release.description===description){published(data.release);return;}}catch{}
    }
    if(valid()){status.dataset.state='error';status.style.color='#b91c1c';status.textContent=sent&&(!error.status||error.status>=500||error.status===408)?'Հրապարակման ավարտը չի հաստատվել։ Ստուգեք ընթացիկ տարբերակը և կրկին փորձեք նույն APK-ով։':ZZWS.message(error);}
   }finally{if(valid()){busy=false;button.disabled=false;file.disabled=false;notes.disabled=false;progress.hidden=true;}}
  };
  load();
 }
 window.ZZWS_APK_UPLOAD=Object.freeze({start,reset});
})();
