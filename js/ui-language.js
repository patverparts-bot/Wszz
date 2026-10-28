(() => {
  for(const input of document.querySelectorAll('input[type="file"]')){
    const box=document.createElement('span'),button=document.createElement('button'),status=document.createElement('span');
    box.style.cssText='display:flex;align-items:center;gap:10px;position:relative;flex-wrap:wrap';
    button.type='button';button.textContent='Ընտրել ֆայլը';status.textContent='Ֆայլ ընտրված չէ';status.setAttribute('aria-live','polite');
    input.before(box);box.append(input,button,status);input.style.cssText='position:absolute;width:1px;height:1px;opacity:0;padding:0';
    button.onclick=()=>input.click();input.addEventListener('change',()=>status.textContent=Array.from(input.files||[]).map(f=>f.name).join(', ')||'Ֆայլ ընտրված չէ');
    input.addEventListener('focus',()=>button.focus());
    input.form?.addEventListener('reset',()=>status.textContent='Ֆայլ ընտրված չէ');
  }
  document.addEventListener('invalid',event=>{
    const input=event.target;if(!input.validity||!input.setCustomValidity)return;
    const v=input.validity;
    input.setCustomValidity(v.valueMissing?'Լրացրեք այս դաշտը։':v.patternMismatch?'Մուտքագրեք պահանջվող ձևաչափով։':v.tooShort?'Մուտքագրված արժեքը չափազանց կարճ է։':v.rangeUnderflow?'Մուտքագրված արժեքը թույլատրելիից փոքր է։':v.rangeOverflow?'Մուտքագրված արժեքը թույլատրելիից մեծ է։':v.typeMismatch?'Ստուգեք մուտքագրված տվյալների ձևաչափը։':'Ստուգեք այս դաշտի արժեքը։');
  },true);
  for(const event of ['input','change'])document.addEventListener(event,e=>e.target.setCustomValidity?.(''));
})();
