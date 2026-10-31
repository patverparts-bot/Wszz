// Three-step checkout. Selection never changes catalogue permissions or prices.
(() => {
 const el=id=>document.getElementById(id),node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(text,action,cls='checkout-button')=>{const b=node('button',text,cls);b.type='button';b.onclick=action;return b;};
 const money=n=>Number(n).toLocaleString('hy-AM')+' ֏';
 const modal=el('orderModal'),body=el('modalBody'),shell=modal.querySelector('.order-modal-shell'),header=shell.firstElementChild,footer=shell.lastElementChild;
 let step=1,excluded=new Set(),review=null,busy=false,identity=null,errorField=null,rowsVersion=null;
 const titles=['Նախապատրաստում','Ձևակերպում','Պատվերի ուղարկում'];
 modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','checkoutTitle');
 const heading=header.querySelector('h3');heading.id='checkoutTitle';heading.textContent='Զամբյուղ և պատվեր';
 const nav=node('nav',null,'checkout-steps');nav.setAttribute('aria-label','Պատվերի քայլերը');header.after(nav);
 const navButtons=titles.map((title,index)=>{const b=button('',()=>go(index+1),'checkout-step');b.dataset.checkoutStep=String(index+1);b.append(node('span',String(index+1),'checkout-step-number'),node('span',title));nav.append(b);return b;});
 const panels=titles.map((title,index)=>{const p=node('section',null,'checkout-stage');p.id='checkoutStage'+(index+1);p.setAttribute('aria-labelledby','checkoutStageTitle'+(index+1));const h=node('h4',title,'checkout-stage-title');h.id='checkoutStageTitle'+(index+1);h.tabIndex=-1;p.append(h);return p;});
 const saved=el('savedCartsPanel'),items=body.querySelector('.order-modal-items-column'),buyer=body.querySelector('.order-modal-details-column'),oldGrid=body.querySelector('.order-modal-body-grid');
 const addTools=node('div',null,'checkout-preparation-actions');addTools.append(button('Ավելացնել կատալոգից',()=>{closeOrderModal();el('searchInput').focus();}),button('Ավելացնել ցանկից',()=>openBulkAddModal()));
 const selectionTools=node('div',null,'checkout-selection-tools'),all=node('input'),allLabel=node('label'),selectionCount=node('span');all.type='checkbox';all.id='checkoutSelectAll';allLabel.append(all,node('span','Ընտրել բոլորը'));selectionCount.id='checkoutSelectionCount';selectionTools.append(allLabel,selectionCount);
 all.onchange=()=>{if(busy)return;excluded=all.checked?new Set():new Set(Object.keys(cart));changed();renderModalItems();};
 panels[0].append(node('p','Ավելացրեք ապրանքներ, փոփոխեք քանակները և նշեք՝ որոնք ուղարկել այս պատվերով։ Չնշված ապրանքները կմնան զամբյուղում։','checkout-description'),addTools,saved,selectionTools,items);
 panels[1].append(node('p','Ստուգեք կազմակերպությունը և լրացրեք պատվիրատուի տվյալները։','checkout-description'),buyer);
 const buyerToggle=buyer.querySelector('button[onclick="toggleDeliveryDetails()"]');if(buyerToggle)buyerToggle.hidden=true;
 buyer.querySelector('#deliveryDetailsContent').classList.remove('hidden');
 const reviewBox=node('div');reviewBox.id='checkoutReview';panels[2].append(node('p','Ստուգեք ընտրված ապրանքները, գումարը և պատվիրատուի տվյալները, ապա ուղարկեք պատվերը։','checkout-description'),reviewBox);
 for(const p of panels)body.append(p);oldGrid.remove();
 const notice=node('p',null,'checkout-notice');notice.id='checkoutNotice';notice.setAttribute('role','status');body.before(notice);
 footer.classList.add('checkout-footer');const total=footer.firstElementChild,oldActions=footer.lastElementChild,close=oldActions.querySelector('[onclick="closeOrderModal()"]');
 const sendActions=node('div',null,'checkout-send-actions');sendActions.id='checkoutSendActions';
 for(const child of [...oldActions.children])if(child!==close)sendActions.append(child);
 const controls=node('div',null,'checkout-navigation'),back=button('Նախորդ քայլը',()=>go(step-1)),next=button('Շարունակել',()=>go(step+1),'checkout-button checkout-primary');back.id='checkoutBack';next.id='checkoutNext';
 if(close)controls.append(close);controls.append(back,next,sendActions);oldActions.remove();footer.append(controls);total.classList.add('checkout-selected-total');
 const quickReview=button('Անցնել վերջնական ստուգմանը',()=>go(3),'checkout-button');quickReview.id='checkoutQuickReview';controls.insertBefore(quickReview,next);quickReview.title='Պահպանված տվյալները կստուգվեն, ապա կբացվի պատվերի ամփոփումը';
 function activeCart(){return Object.fromEntries(Object.entries(cart).filter(([id])=>!excluded.has(id)));}
 function delivery(){return {organization:getSelectedOrganizationName().trim(),address:getDeliveryAddressValue().trim(),contact:el('contactPersonInput').value.trim(),method:getSelectedDeliveryMethod(),date:el('deliveryDateInput').value,comment:el('orderCommentInput').value.trim()};}
 function payload(){return {lines:Object.values(activeCart()).map(i=>({articul:i.articul,qty:i.qty,unitPrice:getItemWholesalePrice(i)})).sort((a,b)=>a.articul.localeCompare(b.articul)),delivery:delivery(),priceMode:adminOrderPriceMode};}
 function fingerprint(){return JSON.stringify(payload());}
 function tell(text,field){notice.textContent=text;if(field){errorField=field;const input=el(field);input?.setAttribute('aria-invalid','true');input?.focus();}}
 function validateSelection(){
  const selected=activeCart();if(!Object.keys(selected).length){tell('Ընտրեք առնվազն մեկ ապրանք։');return false;}
  const bad=Object.values(selected).find(i=>!getProduct(i.articul)||!Number.isInteger(i.qty)||i.qty<1||i.qty>MAX_QTY||getItemWholesalePrice(i)<=0);
  if(bad){tell('Ստուգեք ընտրված ապրանքների հասանելի գներն ու քանակները։');return false;}return true;
 }
 function validateBuyer(){
  const d=delivery();if(!d.organization){tell('Նշեք կազմակերպությունը։','organizationSelect');return false;}
  if(!d.contact){tell('Լրացրեք կոնտակտային անձի անունը և հեռախոսը։','contactPersonInput');return false;}
  if(d.method==='Առաքում'&&!d.address){tell('Լրացրեք առաքման հասցեն։','deliveryAddressInput');return false;}
  const limits={organizationSelect:300,contactPersonInput:300,deliveryAddressInput:300,orderCommentInput:2000};
  for(const [id,max] of Object.entries(limits)){const value=id==='organizationSelect'?d.organization:el(id).value;if(value.length>max){tell('Տվյալը չափազանց երկար է։ Առավելագույնը՝ '+max+' նիշ։',id);return false;}}
  if(el('deliveryDateInput').validity.badInput||el('deliveryDateInput').value&&!el('deliveryDateInput').checkValidity()){tell('Ստուգեք առաքման ամսաթիվը։','deliveryDateInput');return false;}
  return true;
 }
 function drawReview(){
  const data=payload();reviewBox.replaceChildren();const info=node('dl',null,'checkout-buyer-summary');
  const rows=[['Կազմակերպություն',data.delivery.organization],['Կոնտակտային անձ',data.delivery.contact],['Առաքման եղանակ',data.delivery.method],['Հասցե',data.delivery.address],['Ցանկալի ամսաթիվ',data.delivery.date],['Մեկնաբանություն',data.delivery.comment]];
  for(const [key,value] of rows)if(value)info.append(node('dt',key),node('dd',value));reviewBox.append(info);
  const wrap=node('div',null,'checkout-review-scroll'),table=node('table',null,'checkout-review-table'),head=table.createTHead().insertRow();for(const label of ['Ապրանք','Քանակ','Միավորի գին','Գումար'])head.append(node('th',label));
  const tableBody=table.createTBody();for(const line of data.lines){const tr=tableBody.insertRow(),name=node('td'),p=getProduct(line.articul);name.append(node('strong',p?.name||line.articul),node('small',line.articul));tr.append(name,node('td',line.qty),node('td',money(line.unitPrice)),node('td',money(line.unitPrice*line.qty)));}
  const foot=table.createTFoot().insertRow(),caption=node('th','Ընդհանուր գումար');caption.colSpan=3;foot.append(caption,node('td',money(data.lines.reduce((sum,line)=>sum+line.qty*line.unitPrice,0))));
  wrap.append(table);reviewBox.append(wrap);
  const left=Object.keys(cart).length-data.lines.length;if(left)reviewBox.append(node('p','Զամբյուղում կմնան չընտրված '+left+' դիրք։','checkout-description'));
  review=fingerprint();
 }
 function syncSubmitButton(){
  const send=el('submitServerOrder');send.disabled=step!==3||busy||!!window.ZZWS_RECEIPTS?.blocked()&&!window.ZZWS_RECEIPTS?.pendingRequest();
 }
 function render(){
  const keys=Object.keys(cart);for(const id of excluded)if(!keys.includes(id))excluded.delete(id);
  const selected=activeCart(),count=Object.keys(selected).length;selectionCount.textContent='Ընտրված է '+count+' / '+keys.length+' դիրք';
  all.checked=keys.length>0&&count===keys.length;all.indeterminate=count>0&&count<keys.length;all.disabled=busy||!keys.length;
  for(const checkbox of el('modalItemsList').querySelectorAll('[data-checkout-art]'))checkbox.disabled=busy;
  el('modalTotalSum').textContent=money(Object.values(selected).reduce((sum,i)=>sum+getItemWholesalePrice(i)*i.qty,0));
  for(let i=0;i<3;i++){panels[i].hidden=step!==i+1;navButtons[i].disabled=busy||i+1>step;navButtons[i].setAttribute('aria-current',step===i+1?'step':'false');navButtons[i].classList.toggle('checkout-step-complete',i+1<step);}
  back.hidden=step===1;back.disabled=busy;next.hidden=step===3;next.disabled=busy;next.textContent=step===1?'Շարունակել ձևակերպումը':'Ստուգել պատվերը';sendActions.hidden=step!==3;quickReview.hidden=step!==1;quickReview.disabled=busy;
  modal.dataset.checkoutStep=String(step);syncSubmitButton();
  if(errorField&&el(errorField)?.offsetParent){el(errorField).focus();errorField=null;}
 }
 function go(target){
  if(busy||target<1||target>3)return false;
  notice.textContent='';errorField=null;el('deliveryDetailsContent').classList.remove('hidden');
  if(target>1&&!validateSelection()){step=1;render();return false;}
  if(target===3&&!validateBuyer()){step=2;render();return false;}
  step=target;if(step===3)drawReview();else review=null;render();body.scrollTop=0;el('checkoutStageTitle'+step).focus();window.ZZWS_MEMORY?.capture();return true;
 }
 function changed(){
  if(step===3&&!busy&&review!==fingerprint()){step=1;review=null;tell('Զամբյուղը կամ տվյալները փոխվել են։ Կրկին ստուգեք պատվերը։');}
  if(!busy&&step===1&&!modal.classList.contains('hidden')&&rowsVersion!==cartVersion()){renderModalItems();return;}
  render();
 }
 function cartVersion(){return JSON.stringify(cart)+'|'+adminOrderPriceMode+'|'+Object.values(cart).map(i=>getItemWholesalePrice(i)).join(',');}
 function decorateRows(){
  rowsVersion=cartVersion();
  for(const row of el('modalItemsList').querySelectorAll('.basket-item')){
   const id=row.querySelector('[data-art]')?.dataset.art;if(!id)continue;
   const label=node('label',null,'checkout-line-select'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=!excluded.has(id);checkbox.dataset.checkoutArt=id;checkbox.setAttribute('aria-label','Ընտրել '+getItemName({articul:id}));checkbox.disabled=busy;
   checkbox.onchange=()=>{if(checkbox.checked)excluded.delete(id);else excluded.add(id);row.classList.toggle('checkout-line-unselected',!checkbox.checked);changed();};label.append(checkbox,node('span','Ընտրել'));row.querySelector('.basket-item-heading').prepend(label);row.classList.toggle('checkout-line-unselected',!checkbox.checked);
  }
  if(!Object.keys(cart).length){const empty=node('p','Զամբյուղը դատարկ է։ Ավելացրեք ապրանքներ կատալոգից կամ ցանկով։','checkout-empty');el('modalItemsList').append(empty);}
  changed();
 }
 function open(){
  if(identity!==serverIdentity?.id){identity=serverIdentity?.id;excluded.clear();step=1;review=null;}
  el('deliveryDetailsContent').classList.remove('hidden');render();el('checkoutStageTitle'+step).focus();
 }
 function ready(){
  if(step!==3){go(step===1?2:3);return false;}
  if(!validateSelection()){step=1;review=null;render();return false;}
  if(!validateBuyer()){step=2;review=null;render();return false;}
  if(review!==fingerprint()){go(3);tell('Պատվերի կազմը, գինը կամ տվյալները փոխվել են։ Ստուգեք թարմացված ամփոփումը և կրկին ուղարկեք։');return false;}
  return true;
 }
 function setSubmitting(value){
  busy=value;for(const root of [nav,...panels,sendActions])for(const input of root.querySelectorAll('button,input,select,textarea')){if(value){input.dataset.checkoutWasDisabled=String(input.disabled);input.disabled=true;}else if(input.dataset.checkoutWasDisabled!=null){input.disabled=input.dataset.checkoutWasDisabled==='true';delete input.dataset.checkoutWasDisabled;}}
  for(const b of modal.querySelectorAll('button[onclick="closeOrderModal()"]'))b.disabled=value;
  render();
 }
 function complete(lines,snapshot){
  let original;try{original=JSON.parse(snapshot);}catch{return;}
  for(const line of lines){const id=line.articul;if(cart[id]&&JSON.stringify(cart[id])===JSON.stringify(original[id]))delete cart[id];}
  step=1;review=null;
  if(!Object.keys(cart).length)clearOrder();else{saveCartToStorage();updateOrderPanel();refreshAllActions();}
  renderModalItems();window.ZZWS_MEMORY?.capture();
 }
 function reset(){if(busy)setSubmitting(false);busy=false;identity=null;step=1;excluded.clear();review=null;notice.textContent='';render();}
 for(const id of ['organizationSelect','contactPersonInput','deliveryAddressInput','deliveryMethodInput','deliveryDateInput','orderCommentInput']){
  const input=el(id);input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');if(step===3&&!busy)changed();});input.addEventListener('change',()=>{input.removeAttribute('aria-invalid');if(step===3&&!busy)changed();});
 }
 window.ZZWS_CHECKOUT={activeCart,payload,ready,go,open,changed,decorateRows,syncSubmitButton,setSubmitting,complete,reset,get busy(){return busy;}};
 render();
})();
