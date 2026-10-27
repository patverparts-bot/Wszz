(() => {
  let pending=null;
  window.requirePasswordSetup=user=>new Promise(resolve=>{
    pending=resolve;
    let dialog=document.getElementById('passwordSetup');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='passwordSetup';
      dialog.innerHTML='<form><h2>Установите пароль</h2><p>Для первого входа задайте свой пароль: минимум 6 цифр, только цифры.</p><label>Новый пароль<input name="password" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6,256}" minlength="6" maxlength="256" required></label><label>Повторите пароль<input name="confirm" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6,256}" minlength="6" maxlength="256" required></label><p role="alert"></p><button type="submit">Сохранить пароль и войти</button><button type="button" data-cancel>Выйти</button></form>';
      document.body.append(dialog);
      dialog.addEventListener('cancel',e=>e.preventDefault());
      dialog.querySelector('[data-cancel]').onclick=async()=>{try{await ZZWS.json('logout',{method:'POST'});}catch{}ZZWS.clearSession();dialog.close();pending(null);pending=null;};
      dialog.querySelector('form').onsubmit=async e=>{
        e.preventDefault();const f=e.target,msg=f.querySelector('[role=alert]'),b=f.querySelector('[type=submit]');msg.textContent='';
        if(f.elements.password.value!==f.elements.confirm.value){msg.textContent='Пароли не совпадают';return;}
        b.disabled=true;
        try{const result=await ZZWS.json('account/password',{method:'POST',body:JSON.stringify({password:f.elements.password.value})});f.reset();dialog.close();pending(result);pending=null;}
        catch(error){msg.textContent=error.message;}finally{b.disabled=false;}
      };
    }
    dialog.querySelector('form').reset();dialog.querySelector('[role=alert]').textContent='';dialog.showModal();
  });
})();
