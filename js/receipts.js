(() => {
 const el=id=>document.getElementById(id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 let owner=null,state=null,submitting=false,ticket=0,pending=null,checkedAt=0;
 function pendingRequest(){try{const p=JSON.parse(sessionStorage.getItem('zzws_order_request_'+owner)||'null');return typeof p?.requestId==='string'&&/^[a-f0-9-]{36}$/.test(p.requestId);}catch{return false;}}
 function update(){
  const blocked=!!state?.blocked,waiting=Number(state?.pendingCount||0);let text='';
  if(state?.enabled&&waiting){text=blocked?'Նոր պատվերը փակված է, մինչև հաստատեք բոլոր '+waiting+' պատվերների ստացումը։':'Ստացման հաստատման սպասող պատվերներ՝ '+waiting+'։ Կարող եք ուղարկել ևս '+state.remaining+' նոր պատվեր։';}
  for(const id of ['receiptLimitNotice','receiptCartNotice']){const root=el(id);if(!root)continue;root.replaceChildren();root.hidden=!text;root.classList.toggle('receipt-blocked',blocked);if(text){root.append(node('span',text));const button=node('button','Դիտել չփակված պատվերները');button.type='button';button.onclick=showPending;root.append(button);}}
  const button=el('submitServerOrder');if(button){button.disabled=submitting||(blocked&&!pendingRequest());button.textContent=blocked&&pendingRequest()?'Կրկին ստուգել ուղարկումը':'Ուղարկել պատվերը';}
  window.ZZWS_CHECKOUT?.syncSubmitButton();
 }
 async function refresh(force=false){if(!owner)return null;if(pending)return pending;if(!force&&state&&Date.now()-checkedAt<3000)return state;const who=owner,id=++ticket;const work=(async()=>{const data=await ZZWS.json('orders/receipt-state');if(owner!==who||ticket!==id)return null;state=data;checkedAt=Date.now();update();return data;})();pending=work;try{return await work;}finally{if(pending===work)pending=null;}}
 function start(user){stop();owner=user.id;refresh().catch(()=>{});}
 function stop(){owner=null;state=null;submitting=false;pending=null;checkedAt=0;++ticket;el('receiptConfirmationDialog')?.remove();for(const id of ['receiptLimitNotice','receiptCartNotice','receiptResultNotice'])if(el(id)){el(id).replaceChildren();el(id).hidden=true;}}
 function showPending(){closeOrderModal();el('pendingReceiptOnly').checked=true;openPersonalCabinet();ZZWS_ORDERS.load();}
 function render(order,root){
  if(order.received_at){const proof=node('div',null,'receipt-proof');proof.append(node('strong','Ստացումն արդեն հաստատված է'),node('p',order.receipt?.statement||'Ապրանքներն ամբողջությամբ և առանց վնասվածքների ստացված են։'),node('small',new Date(order.received_at).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan'})));root.append(proof);return;}
  if(!['confirmed','in_progress','completed'].includes(order.status)){root.append(node('p',order.status==='new'?'Ստացումը կարող եք հաստատել ադմինիստրատորի կողմից պատվերը հաստատելուց հետո։':order.status==='rejected'?'Մերժված պատվերի ստացումը չի հաստատվում։':'Այս կարգավիճակով ստացման հաստատումը հասանելի չէ։','order-info'));return;}
  const action=node('div',null,'receipt-order-action'),button=node('button','Հաստատել ապրանքների ստացումը','confirm-receipt-button');button.type='button';button.onclick=()=>confirmReceipt(order).catch(e=>alert(ZZWS.message(e)));action.append(button);root.append(action);
 }
 async function confirmReceipt(order){
  const who=owner,opener=document.activeElement;if(!who||!['confirmed','in_progress','completed'].includes(order.status)||el('receiptConfirmationDialog'))return;const current=await refresh(true)||state;if(owner!==who||!current||el('receiptConfirmationDialog'))return;
  let confirming=false;
  const dialog=node('dialog'),form=node('form'),title=node('h2','Հաստատո՞ւմ եք ստացումը · պատվեր №'+order.number),question=node('p','Վստա՞հ եք, որ այս պատվերի բոլոր ապրանքները ստացել եք ամբողջությամբ և առանց վնասվածքների։'),statement=node('p',current.statement,'receipt-confirmation-statement'),actions=node('div',null,'receipt-confirmation-actions'),submit=node('button','Այո, հաստատում եմ'),cancel=node('button','Ոչ, չեղարկել'),error=node('p');
  dialog.id='receiptConfirmationDialog';title.id='receiptConfirmationTitle';question.id='receiptConfirmationQuestion';statement.id='receiptConfirmationStatement';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',question.id+' '+statement.id);submit.type='submit';cancel.type='button';cancel.autofocus=true;error.setAttribute('role','alert');
  actions.append(cancel,submit);form.append(title,question,statement,node('p','Վնասվածքի կամ պակասի դեպքում մի հաստատեք․ կապվեք ձեր մենեջերի հետ։'),error,actions);dialog.append(form);document.body.append(dialog);dialog.showModal();cancel.focus();cancel.onclick=()=>dialog.close();dialog.oncancel=e=>{if(confirming)e.preventDefault();};dialog.onclose=()=>{dialog.remove();if(opener?.isConnected)opener.focus();};
  form.onsubmit=async e=>{e.preventDefault();if(confirming||owner!==who)return;confirming=true;submit.disabled=true;cancel.disabled=true;submit.textContent='Հաստատվում է…';
   try{const result=await ZZWS.json('orders/receipt',{method:'POST',body:JSON.stringify({id:order.id,revision:order.revision,intact:true})});dialog.close();dialog.remove();if(owner!==who)return;state=result.state;update();const notice=el('receiptResultNotice');notice.hidden=false;notice.textContent='Դուք հաստատել եք, որ պատվեր №'+result.order.number+'-ի ապրանքներն ամբողջությամբ և առանց վնասվածքների ստացել եք։ Պատվերը փակված է։';await ZZWS_ORDERS.load();}
   catch(e){error.textContent=ZZWS.message(e);refresh().catch(()=>{});}finally{confirming=false;submit.disabled=false;cancel.disabled=false;submit.textContent='Այո, հաստատում եմ';}
  };
 }
 window.ZZWS_RECEIPTS={start,stop,refresh,render,showPending,pendingRequest,update,setSubmitting:value=>{submitting=value;window.ZZWS_CHECKOUT?.setSubmitting(value);update();},blocked:()=>!!state?.blocked};
 el('pendingReceiptOnly').onchange=()=>ZZWS_ORDERS.load();
})();
