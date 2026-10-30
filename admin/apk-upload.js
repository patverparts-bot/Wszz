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
  field.append(node('p','Ընտրեք նոր APK-ը և գրեք՝ ինչ է փոխվել։ Տարբերակը կկարդացվի ֆայլից։ Հրապարակումից հետո այն հասանելի կլինի APK թույլտվություն ունեցող հաշիվներին։'));
  const current=node('p','Ընթացիկ տարբերակը բեռնվում է…');current.dataset.apkCurrent='';field.append(current);
  const form=node('form'),label=node('label','Նոր APK ֆայլ'),file=node('input');form.style.cssText='display:grid;gap:12px;min-width:0';label.style.cssText='display:grid;gap:6px;min-width:0';file.type='file';file.accept='.apk,application/vnd.android.package-archive';file.required=true;file.name='file';file.style.cssText='display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box';label.append(file);form.append(label);
  const notesLabel=node('label','Ինչ է փոխվել'),notes=node('textarea');notesLabel.style.cssText='display:grid;gap:6px;min-width:0';notes.name='description';notes.maxLength=4000;notes.rows=3;notes.style.cssText='display:block;width:100%;min-width:0;box-sizing:border-box;resize:vertical;padding:10px;border:1px solid #94a3b8;border-radius:8px;font:inherit';notesLabel.append(notes);form.append(notesLabel);
  const button=node('button','Հրապարակել նոր APK-ը');button.type='submit';button.style.cssText='justify-self:start;max-width:100%;white-space:normal';form.append(button);
  const status=node('p');status.setAttribute('role','status');status.dataset.apkUploadStatus='';form.append(status);field.append(form);panel.append(field);panel.hidden=false;
  const valid=()=>actor===who&&ticket===serial;
  async function load(){try{const data=await ZZWS.json(endpoint('current'));if(valid())current.textContent=data.release?'Ընթացիկ տարբերակ՝ '+data.release.version+' · '+(data.release.bytes/1000000).toFixed(1)+' ՄԲ':'Ընթացիկ ներբեռնումը՝ GitHub-ից։ Նոր APK-ը կարող եք հրապարակել այստեղ։';}catch(error){if(valid())current.textContent=ZZWS.message(error);}}
  file.onchange=()=>{if(valid())status.textContent=file.files[0]?'Ընտրված է՝ '+file.files[0].name:'';};
  form.onsubmit=async event=>{
   event.preventDefault();if(!valid()||busy)return;const apk=file.files[0];if(!apk)return;
   if(!apk.name.toLowerCase().endsWith('.apk')||apk.size>50_000_000){status.textContent='Ընտրեք մինչև 50 ՄԲ APK ֆայլ։';return;}
   const data=new FormData();data.set('file',apk);data.set('description',notes.value.trim());busy=true;button.disabled=true;file.disabled=true;notes.disabled=true;status.textContent='APK-ը բեռնվում և ստուգվում է։ Սպասեք հրապարակման ավարտին…';
   try{const result=await ZZWS.json(endpoint('publish'),{method:'POST',body:data});if(!valid())return;status.textContent='APK '+result.release.version+' հրապարակված է։ Ներբեռնումը թարմացվել է անձնական կաբինետում։';form.reset();await load();await window.ZZWS_ADMIN_RESOURCES?.refresh();}
   catch(error){if(valid())status.textContent=ZZWS.message(error);}
   finally{if(valid()){busy=false;button.disabled=false;file.disabled=false;notes.disabled=false;}}
  };
  load();
 }
 window.ZZWS_APK_UPLOAD=Object.freeze({start,reset});
})();
