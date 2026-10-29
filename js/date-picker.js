(() => {
 for(const input of document.querySelectorAll('input[type="date"]'))if(input.id&&input.previousElementSibling?.tagName==='LABEL')input.previousElementSibling.htmlFor=input.id;
 document.addEventListener('click',event=>{
  const target=event.target;if(!(target instanceof Element))return;
  const label=target.closest('label');const associated=label?.htmlFor?document.getElementById(label.htmlFor):null;
  const field=target.closest('input[type="date"]')||label?.querySelector('input[type="date"]')||(associated?.type==='date'?associated:null);
  if(!field||field.disabled||field.readOnly)return;
  field.focus({preventScroll:true});
  try{field.showPicker?.();}catch{/* Older browsers retain their native focus-based picker. */}
 });
})();
