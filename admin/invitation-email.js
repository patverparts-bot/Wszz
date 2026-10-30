(() => {
 'use strict';
 const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 window.ZZWS_INVITATION_EMAIL=Object.freeze({async attach(dialog,{targetId,invitation}){
  if(!targetId)return;
  const panel=node('fieldset'),legend=node('legend','Հրավերն ուղարկել էլ․ փոստով'),status=node('p'),send=node('button','Ուղարկել էլ․ փոստով');panel.id='invitationEmailPanel';send.type='button';send.disabled=true;status.setAttribute('role','status');panel.append(legend,status,send);dialog.append(panel);
  const choices=[];
  try{
   const options=await ZZWS.json('admin/users/invitation-email/options',{method:'POST',body:JSON.stringify({id:targetId})});
   if(!dialog.isConnected)return;
   options.rows.forEach((row,index)=>{if(!row)return;const label=node('label',row),check=node('input');check.type='checkbox';check.value=index;label.prepend(check);panel.insertBefore(label,status);choices.push(check);check.onchange=()=>{send.disabled=!choices.some(c=>c.checked);};});
   status.textContent=choices.length?'Ընտրեք քարտում պահպանված հասցեների տողերը։ Նամակը կստանան ընտրված տողերի բոլոր հասցեները։':'Քարտում էլ․ փոստ չկա։ Լրացրեք և պահպանեք այն, ապա նորից բացեք հրավերը։';
  }catch(e){status.textContent=ZZWS.message(e);return;}
  send.onclick=async()=>{
   send.disabled=true;choices.forEach(c=>c.disabled=true);status.textContent='Ուղարկվում է…';
   try{
    const payload={id:targetId,code:invitation.code,selectedRows:choices.filter(c=>c.checked).map(c=>Number(c.value))};
    const attempt=()=>ZZWS.json('admin/users/invitation-email/send',{method:'POST',body:JSON.stringify(payload)});
    let result;try{result=await attempt();}catch(e){if(!e.reauthRequired)throw e;await requireReauthentication();result=await attempt();}
    status.textContent=result.accepted?'Փոստային ծառայությունն ընդունել է հրավերը՝ ուղարկման համար։':result.error;
    if(result.accepted){send.textContent='Ուղարկված է';return;}
    if(!result.retryable)return;
    send.textContent='Կրկին փորձել';
   }catch(e){status.textContent=ZZWS.message(e);}
   choices.forEach(c=>c.disabled=false);send.disabled=!choices.some(c=>c.checked);
  };
 }});
})();
