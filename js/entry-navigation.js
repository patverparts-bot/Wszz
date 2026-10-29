(() => {
 'use strict';
 const script=document.currentScript,base=new URL('../',script.src),site=new URL('./',base),admin=new URL('admin/',base);
 const allowed=user=>user?.role==='admin'&&!!user.adminScope&&Array.isArray(user.permissions)&&user.permissions.length>0;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function navigation(user){
  document.getElementById('zzwsWorkspaceSwitch')?.remove();if(!allowed(user))return;
  const inAdmin=location.pathname===admin.pathname||location.pathname.startsWith(admin.pathname),button=node('a',inAdmin?'Անցնել կայք':'Անցնել կառավարման վահանակ');button.id='zzwsWorkspaceSwitch';button.href=(inAdmin?site:admin).href;button.className='zzws-workspace-switch';
  const mount=inAdmin?document.querySelector('body>header'):document.querySelector('.catalog-header-utilities');mount?.append(button);
 }
 function reset(){document.getElementById('zzwsWorkspaceSwitch')?.remove();document.getElementById('workspaceChoiceDialog')?.remove();}
 async function choose(user,continueCurrent){
  if(!allowed(user)){await continueCurrent();return;}
  return new Promise((resolve,reject)=>{
   const dialog=node('dialog'),title=node('h2','Ընտրեք աշխատանքային միջավայրը'),info=node('p','Մուտքը հաստատված է։ Ընտրեք՝ որտեղ շարունակել աշխատանքը։'),error=node('p');dialog.id='workspaceChoiceDialog';dialog.className='zzws-workspace-choice';error.setAttribute('role','alert');dialog.append(title,info);
   const currentAdmin=location.pathname.startsWith(admin.pathname),current=currentAdmin?'admin':'site';let pending=false;
   const close=()=>{dialog.close();dialog.remove();};
   const add=(label,target)=>{const button=node('button',label);button.type='button';button.onclick=async()=>{
    if(pending)return;pending=true;let extra=null;
    try{
     if(target==='both'){
      // Create a same-origin blank tab during the click. Never put credentials in a URL or localStorage.
      extra=window.open('about:blank','_blank');if(!extra)throw Error('Բրաուզերը արգելափակել է նոր պատուհանը։ Թույլատրեք այն կամ ընտրեք մեկ միջավայր։');
      const token=sessionStorage.getItem('zzws_session_v3');if(!token)throw Error('Մուտքը ավարտվել է։ Կրկին մուտք գործեք։');
      extra.sessionStorage.setItem('zzws_session_v3',token);extra.opener=null;extra.location.replace((currentAdmin?site:admin).href);
      await continueCurrent();close();resolve();return;
     }
     if(target===current){await continueCurrent();close();resolve();}
     else{location.assign((target==='admin'?admin:site).href);close();resolve();}
    }catch(e){extra?.close();error.textContent=window.ZZWS.message(e);pending=false;}
   };dialog.append(button);};
   add('Բացել կայքը','site');add('Բացել կառավարման վահանակը','admin');add('Բացել երկուսն էլ','both');dialog.append(error);dialog.addEventListener('cancel',e=>e.preventDefault());document.body.append(dialog);dialog.showModal();
  });
 }
 window.ZZWS_ENTRY=Object.freeze({choose,navigation,reset});
})();
