(() => {
 const el=id=>document.getElementById(id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 let owner=null,state=null,submitting=false,ticket=0;
 function pendingRequest(){try{const p=JSON.parse(sessionStorage.getItem('zzws_order_request_'+owner)||'null');return typeof p?.requestId==='string'&&/^[a-f0-9-]{36}$/.test(p.requestId);}catch{return false;}}
 function update(){
  const blocked=!!state?.blocked,waiting=Number(state?.pendingCount||0);let text='';
  if(state?.enabled&&waiting){text=blocked?'Նոր պատվերը փակված է, մինչև հաստատեք բոլոր '+waiting+' պատվերների ստացումը։':'Ստացման հաստատման սպասող պատվերներ՝ '+waiting+'։ Կարող եք ուղարկել ևս '+state.remaining+' նոր պատվեր։';}
  for(const id of ['receiptLimitNotice','receiptCartNotice']){const root=el(id);if(!root)continue;root.replaceChildren();root.hidden=!text;root.classList.toggle('receipt-blocked',blocked);if(text){root.append(node('span',text));const button=node('button','Դիտել չփակված պատվերները');button.type='button';button.onclick=showPending;root.append(button);}}
  const button=el('submitServerOrder');if(button){button.disabled=submitting||(blocked&&!pendingRequest());button.textContent=blocked&&pendingRequest()?'Կրկին ստուգել ուղարկումը':'Ուղարկել պատվերը';}
 }
 async function refresh(){if(!owner)return null;const who=owner,id=++ticket;const data=await ZZWS.json('orders/receipt-state');if(owner!==who||ticket!==id)return null;state=data;update();return data;}
 function start(user){stop();owner=user.id;refresh().catch(()=>{});}
 function stop(){owner=null;state=null;submitting=false;++ticket;el('receiptConfirmationDialog')?.remove();for(const id of ['receiptLimitNotice','receiptCartNotice','receiptResultNotice'])if(el(id)){el(id).replaceChildren();el(id).hidden=true;}}
 function showPending(){closeOrderModal();el('pendingReceiptOnly').checked=true;openPersonalCabinet();ZZWS_ORDERS.load();}
 function render(order,root){
  if(order.received_at){const proof=node('div',null,'receipt-proof');proof.append(node('strong','Ստացումն արդեն հաստատված է'),node('p',order.receipt?.statement||'Ապրանքներն ամբողջությամբ և առանց վնասվածքների ստացված են։'),node('small',new Date(order.received_at).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan'})));root.append(proof);return;}
  if(order.status==='completed'){const button=node('button','Հաստատել ապրանքների ստացումը','confirm-receipt-button');button.type='button';button.onclick=()=>confirmReceipt(order).catch(e=>alert(ZZWS.message(e)));root.append(button);}else if(order.status!=='rejected')root.append(node('p','Ստացման հաստատումը հասանելի կլինի ադմինիստրատորի առաքման նշումից հետո։','order-info'));
 }
 async function confirmReceipt(order){
  const who=owner;if(!who||el('receiptConfirmationDialog'))return;const current=await refresh();if(owner!==who||!current||el('receiptConfirmationDialog'))return;
  const dialog=node('dialog'),form=node('form'),title=node('h2','Հաստատել ստացումը · պատվեր №'+order.number),statement=node('p',current.statement),label=node('label'),check=node('input'),submit=node('button','Հաստատում եմ ստացումը'),cancel=node('button','Չեղարկել'),error=node('p');
  dialog.id='receiptConfirmationDialog';check.type='checkbox';check.required=true;label.append(check,document.createTextNode(' Ապրանքները ստացել եմ ամբողջությամբ և առանց վնասվածքների։'));submit.type='submit';cancel.type='button';error.setAttribute('role','alert');
  form.append(title,statement,node('p','Վնասվածքի կամ պակասի դեպքում մի հաստատեք․ կապվեք ձեր մենեջերի հետ։'),label,error,submit,cancel);dialog.append(form);document.body.append(dialog);dialog.showModal();cancel.onclick=()=>{dialog.close();dialog.remove();};dialog.oncancel=e=>{if(submit.disabled)e.preventDefault();};dialog.onclose=()=>dialog.remove();
  form.onsubmit=async e=>{e.preventDefault();if(!check.checked)return;submit.disabled=true;cancel.disabled=true;
   try{const result=await ZZWS.json('orders/receipt',{method:'POST',body:JSON.stringify({id:order.id,revision:order.revision,intact:true})});dialog.close();dialog.remove();if(owner!==who)return;state=result.state;update();const notice=el('receiptResultNotice');notice.hidden=false;notice.textContent='Դուք հաստատել եք, որ պատվեր №'+result.order.number+'-ի ապրանքներն ամբողջությամբ և առանց վնասվածքների ստացել եք։ Պատվերը փակված է։';await ZZWS_ORDERS.load();}
   catch(e){error.textContent=ZZWS.message(e);refresh().catch(()=>{});}finally{submit.disabled=false;cancel.disabled=false;}
  };
 }
 window.ZZWS_RECEIPTS={start,stop,refresh,render,showPending,pendingRequest,update,setSubmitting:value=>{submitting=value;update();},blocked:()=>!!state?.blocked};
 el('pendingReceiptOnly').onchange=()=>ZZWS_ORDERS.load();
})();
