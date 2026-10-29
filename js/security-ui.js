(() => {
 const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
 window.completeSecureLogin=async result=>{
  if(!result.mfaRequired)return result;
  return new Promise((resolve,reject)=>{
   const dialog=node('dialog'),form=node('form'),title=node('h2','Երկփուլ հաստատում'),message=node('p','Մուտքագրեք ձեր նույնականացնող հավելվածի վեցանիշ կոդը։'),code=node('input'),error=node('p'),submit=node('button','Հաստատել'),cancel=node('button','Չեղարկել');
   code.name='code';code.autocomplete='one-time-code';code.inputMode='numeric';code.pattern='[0-9]{6}';code.required=true;code.maxLength=6;code.setAttribute('aria-label','Հաստատման կոդ');error.setAttribute('role','alert');cancel.type='button';
   form.append(title,message);
   if(result.qr){const img=node('img');img.alt='Սկանավորեք նույնականացնող հավելվածով';img.width=220;img.src=result.qr.startsWith('data:')?result.qr:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(result.qr);const secret=node('code',result.secret);form.append(img,secret);}
   form.append(code,error,submit,cancel);dialog.append(form);document.body.append(dialog);dialog.showModal();
   const close=()=>{dialog.close();dialog.remove();};cancel.onclick=()=>{close();reject(new Error('Հաստատումը չեղարկված է'));};dialog.addEventListener('cancel',e=>{e.preventDefault();cancel.click();});
   form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{const data=await ZZWS.json('login/mfa',{method:'POST',body:JSON.stringify({challengeToken:result.challengeToken,code:code.value})});close();resolve(data);}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}};
  });
 };
 window.showInvitation=(login,invitation,targetId)=>{
  const dialog=node('dialog'),title=node('h2','Մեկանգամյա հրավեր'),info=node('p','Փոխանցեք այս հղումը միայն հաշվի տիրոջը։ Գործում է 48 ժամ։ Նոր հրավերը անվավեր է դարձնում նախորդը։'),field=node('textarea'),copy=node('button','Պատճենել հղումը'),close=node('button','Փակել');
  const base=new URL(location.pathname.includes('/admin')?'../':'./',location.href);base.hash=new URLSearchParams({invite:invitation.code,login}).toString();field.value=base.href;field.readOnly=true;field.rows=4;field.setAttribute('aria-label','Հրավերի հղում');copy.type=close.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(field.value);copy.textContent='Պատճենված է';}catch{field.select();}};close.onclick=()=>{dialog.close();dialog.remove();};dialog.append(title,info,field,copy,close);window.ZZWS_INVITATION_EMAIL?.attach(dialog,{targetId,invitation});document.body.append(dialog);dialog.showModal();
 };
 window.requireReauthentication=()=>new Promise((resolve,reject)=>{
  const dialog=node('dialog'),form=node('form'),input=node('input'),submit=node('button','Հաստատել'),cancel=node('button','Չեղարկել'),error=node('p');input.type='password';input.autocomplete='current-password';input.required=true;input.setAttribute('aria-label','Ընթացիկ գաղտնաբառ');cancel.type='button';error.setAttribute('role','alert');form.append(node('h2','Հաստատեք գործողությունը'),node('p','Մուտքագրեք գաղտնաբառը՝ այս փոփոխությունը հաստատելու համար։ Օրինակ՝ եթե այն մուտքագրել եք 17:00-ին, մինչև 17:05-ը այլ կարևոր փոփոխությունների համար կրկին չի պահանջվի։ 17:05-ից հետո նոր փոփոխության ժամանակ գաղտնաբառը նորից կխնդրվի։ Պահպանված փոփոխությունները չեն չեղարկվի, և դուք հաշվից դուրս չեք գա։'),input,error,submit,cancel);dialog.append(form);document.body.append(dialog);dialog.showModal();cancel.onclick=()=>{dialog.close();dialog.remove();reject(new Error('Գործողությունը չեղարկված է'));};dialog.addEventListener('cancel',e=>{e.preventDefault();cancel.click();});form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await ZZWS.json('account/reauth',{method:'POST',body:JSON.stringify({password:input.value})});input.value='';dialog.close();dialog.remove();resolve();}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}};
 });
 const params=new URLSearchParams(location.hash.slice(1));if(params.has('invite')){const login=document.getElementById('loginInput'),password=document.getElementById('passwordInput');if(login&&password){login.value=params.get('login')||'';password.value=params.get('invite')||'';history.replaceState(null,'',location.pathname+location.search);}}
})();
