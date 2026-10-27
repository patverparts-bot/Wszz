(() => {
  let pending=null;
  window.requirePasswordSetup=user=>new Promise(resolve=>{
    pending=resolve;
    let dialog=document.getElementById('passwordSetup');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='passwordSetup';
      dialog.innerHTML='<form><h2>Սահմանեք գաղտնաբառը</h2><p>Առաջին մուտքի համար սահմանեք ձեր գաղտնաբառը՝ առնվազն 6 թվանշան, միայն թվեր։</p><label>Նոր գաղտնաբառ<input name="password" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6,256}" minlength="6" maxlength="256" required></label><label>Կրկնեք գաղտնաբառը<input name="confirm" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6,256}" minlength="6" maxlength="256" required></label><p role="alert"></p><button type="submit">Պահպանել գաղտնաբառը և մուտք գործել</button><button type="button" data-cancel>Ելք</button></form>';
      document.body.append(dialog);
      dialog.addEventListener('cancel',e=>e.preventDefault());
      dialog.querySelector('[data-cancel]').onclick=async()=>{try{await ZZWS.json('logout',{method:'POST'});}catch{}ZZWS.clearSession();dialog.close();pending(null);pending=null;};
      dialog.querySelector('form').onsubmit=async e=>{
        e.preventDefault();const f=e.target,msg=f.querySelector('[role=alert]'),b=f.querySelector('[type=submit]');msg.textContent='';
        if(f.elements.password.value!==f.elements.confirm.value){msg.textContent='Գաղտնաբառերը չեն համընկնում';return;}
        b.disabled=true;
        try{const response=await ZZWS.json('account/password',{method:'POST',body:JSON.stringify({password:f.elements.password.value})});const result=await completeSecureLogin(response);f.reset();dialog.close();pending(result);pending=null;}
        catch(error){msg.textContent=error.message;}finally{b.disabled=false;}
      };
    }
    dialog.querySelector('form').reset();dialog.querySelector('[role=alert]').textContent='';dialog.showModal();
  });
})();
