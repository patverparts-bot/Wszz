(() => {
 const labels={new:'Նոր',confirmed:'Հաստատված',in_progress:'Ընթացքում',completed:'Առաքված է',rejected:'Մերժված',received:'Ստացված է'};
 let owner=null,timer=null,events=[],orders=[],busy=false,loadTicket=0,noticeSeen=new Set(),polling=false;
 const el=id=>document.getElementById(id),money=v=>Number(v||0).toLocaleString('hy-AM')+' ֏';
 const date=v=>new Date(v).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan'});
 const shortDate=v=>new Date(v).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan',dateStyle:'short',timeStyle:'short'});
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 function setNotice(text){const box=el('orderNotificationNotice');box.textContent=text;box.hidden=!text;}
 async function poll(){
  if(!owner||document.hidden||polling)return;polling=true;
  window.ZZWS_RECEIPTS?.refresh().catch(()=>{});
  const activeOwner=owner;
  try{const result=await ZZWS.json('orders/notifications');if(owner!==activeOwner)return;events=result.events;
   const badge=el('orderNotificationsCount');badge.textContent=events.length>=50?'50+':String(events.length);badge.hidden=!events.length;
   const cabinetBadge=el('cabinetNotificationCount');if(cabinetBadge){cabinetBadge.textContent=badge.textContent;cabinetBadge.hidden=!events.length;}
   const fresh=events.filter(e=>!noticeSeen.has(e.id));for(const event of events)noticeSeen.add(event.id);
   if(fresh.length)setNotice('Ձեր պատվերներում կան փոփոխություններ՝ '+fresh.length+'։ Բացեք ծանուցումները կամ անձնական հաշիվը։');
   if(!events.length)setNotice('');
   if(fresh.length&&!el('cabinetModal').classList.contains('hidden'))await load();
  }catch(e){if(e.status===401)lockCatalog();}finally{if(owner===activeOwner)polling=false;}
 }
 function start(user){stop();owner=user.id;window.ZZWS_RECEIPTS?.start(user);poll();timer=setInterval(poll,30000);}
 function stop(){polling=false;++loadTicket;window.ZZWS_RECEIPTS?.stop();document.body.classList.remove('cabinet-open');if(timer)clearInterval(timer);timer=null;owner=null;events=[];orders=[];noticeSeen=new Set();for(const id of ['serverOrderSearch','serverOrderFrom','serverOrderTo'])if(el(id))el(id).value='';el('orderNotificationsCount')?.setAttribute('hidden','');el('cabinetNotificationCount')?.setAttribute('hidden','');if(el('serverOrdersList'))el('serverOrdersList').replaceChildren();if(el('orderNotificationList')){el('orderNotificationList').replaceChildren();el('orderNotificationList').hidden=true;}if(el('orderNotificationNotice'))setNotice('');}
 async function load(more=false){
  if(!owner)return;const root=el('serverOrdersList');
  const activeOwner=owner;
  const ticket=++loadTicket,params=new URLSearchParams(),pending=el('pendingReceiptOnly').checked;if(pending)params.set('receiptPending','true');for(const [key,id]of [['search','serverOrderSearch'],['from','serverOrderFrom'],['to','serverOrderTo']])if(el(id).value.trim())params.set(key,el(id).value.trim());if(more&&orders.length)params.set('before',orders.at(-1).number);
  try{const data=await ZZWS.json('orders'+(params.size?'?'+params:''));if(owner!==activeOwner||ticket!==loadTicket||pending!==el('pendingReceiptOnly').checked)return;orders=more?[...orders,...data.orders]:data.orders;render();el('moreServerOrders').hidden=data.orders.length<50;}
  catch(e){if(owner===activeOwner&&ticket===loadTicket)root.textContent=ZZWS.message(e);}
 }
 function render(){
  const root=el('serverOrdersList'),opened=new Set([...root.querySelectorAll('details[open][data-order-id]')].map(n=>n.dataset.orderId));root.replaceChildren();
  if(!orders.length){const pending=el('pendingReceiptOnly').checked;root.append(node('p',pending?'Չփակված պատվերներ չկան։':'Ընտրված պայմաններով պատվերներ չկան։','orders-empty'));if(pending){const all=node('button','Ցույց տալ բոլոր պատվերները');all.type='button';all.className='orders-show-all';all.onclick=()=>{el('pendingReceiptOnly').checked=false;load();};root.append(all);}return;}
  for(const order of orders){const card=node('details',null,'server-order-card'),summary=node('summary'),identity=node('div'),total=node('div');
   identity.append(node('strong','Պատվեր №'+order.number),node('span',shortDate(order.created),'server-order-date'));
   total.append(node('span',labels[order.status]||order.status,'order-status status-'+order.status),node('strong',money(order.total)));
   if(events.some(e=>e.order_id===order.id))identity.append(node('span','Կան փոփոխություններ','order-unread'));
   summary.append(identity,total);card.append(summary);const content=node('div',null,'server-order-content');card.append(content);card.dataset.orderId=order.id;
   card.ontoggle=async()=>{if(card.open&&matchMedia('(max-width:640px)').matches)for(const other of root.querySelectorAll('.server-order-card[open]'))if(other!==card)other.open=false;if(card.open&&!content.dataset.loaded){content.textContent='Պատվերը բեռնվում է…';const activeOwner=owner;try{const revision=await details(order.id,content);if(owner!==activeOwner||!card.open||!card.isConnected||el('cabinetModal').classList.contains('hidden')||revision==null)return;content.dataset.loaded='true';await ZZWS.json('orders/read',{method:'POST',body:JSON.stringify({orderId:order.id,revision})});events=events.filter(e=>e.order_id!==order.id||e.revision>revision);poll();}catch(e){if(owner===activeOwner&&content.isConnected)content.textContent=ZZWS.message(e);}}};root.append(card);if(opened.has(order.id))card.open=true;
  }
 }
 function linesTable(lines){const wrap=node('div',null,'order-lines-scroll'),table=node('table');const head=table.createTHead().insertRow();for(const h of ['Ապրանք','Քանակ','Գին','Գումար'])head.append(node('th',h));
  for(const line of lines){const row=table.insertRow();const product=row.insertCell();product.append(node('strong',line.name),node('small',line.articul));row.insertCell().textContent=line.qty;row.insertCell().textContent=money(line.unitPrice);row.insertCell().textContent=money(line.qty*line.unitPrice);}wrap.append(table);return wrap;}
 async function details(id,root){const who=owner,result=await ZZWS.json('orders/detail',{method:'POST',body:JSON.stringify({id})}),order=result.order;if(owner!==who||!root.isConnected)return null;root.replaceChildren();
  root.append(node('p',(order.status==='new'?'Պատվերը ստացվել է։ Սպասում է ադմինիստրատորի հաստատմանը։':'Կարգավիճակ՝ '+labels[order.status])+ ' · Թարմացվել է '+date(order.updated),'order-info'));
  if(order.comment)root.append(node('p','Ադմինիստրատորի մեկնաբանությունը՝ '+order.comment,'order-admin-comment'));
  root.append(node('h4','Պատվերի կազմը','order-content-heading'),node('p','Ջնջագծված են նախկին արժեքներն ու չհաստատված ապրանքները։','order-info order-comparison-hint'));
  root.append(ZZWS_ORDER_COMPARE.render(order.original_lines?.length?order.original_lines:order.lines,order.lines));
  window.ZZWS_RECEIPTS?.render(order,root);
  const delivery=order.delivery||{},deliveryBox=node('details',null,'order-delivery-details'),deliveryList=node('dl');deliveryBox.append(node('summary','Առաքման տվյալներ'));
  for(const [key,label] of Object.entries({organization:'Կազմակերպություն',contact:'Կոնտակտ',address:'Հասցե',method:'Առաքման եղանակ',date:'Առաքման օր',paymentDeadline:'Վճարման վերջնաժամկետ',comment:'Ձեր մեկնաբանությունը'}))if(delivery[key])deliveryList.append(node('dt',label),node('dd',delivery[key]));deliveryBox.append(deliveryList);root.append(deliveryBox);
  const tools=node('details',null,'order-secondary-tools');tools.append(node('summary','Կրկնել պատվերը կամ գտնել փոխարինում'));
  const repeat=node('button','Կրկնել պատվերը ընթացիկ գներով','order-repeat-button');repeat.type='button';repeat.onclick=()=>{
   const allowed=order.lines.filter(line=>productIndex.has(line.articul)),missing=order.lines.length-allowed.length;
   if(!allowed.length){alert('Այս պատվերի ապրանքներն այլևս հասանելի չեն');return;}
   if(!confirm('Ավելացնե՞լ '+allowed.length+' դիրք ընթացիկ զամբյուղին։ Անհասանելի՝ '+missing+'։ Գները կլինեն ընթացիկ։'))return;
   for(const line of allowed){const product=productIndex.get(line.articul);cart[line.articul]={articul:line.articul,qty:Math.min(9999,(cart[line.articul]?.qty||0)+line.qty),addedPrice:getItemWholesalePrice({articul:line.articul}),addedPriceMode:isAdminUser()?adminOrderPriceMode:'WS'};}
   saveCartToStorage();updateOrderPanel();resetAndRender();window.ZZWS_MEMORY?.capture();closePersonalCabinet();openOrderModal();};tools.append(repeat);
  const alternatives=node('details'),heading=node('summary','Փոխարինող մոդելներ՝ նոր զամբյուղի համար');alternatives.append(heading);for(const line of order.lines){const b=node('button',line.name+' · '+line.articul);b.type='button';b.dataset.replaceArt=line.articul;b.dataset.replaceOrder=order.id;alternatives.append(b);}tools.append(alternatives);root.append(tools);
  const history=node('details',null,'order-change-history');history.append(node('summary','Փոփոխությունների պատմություն · '+result.events.length));
  for(const event of result.events){const box=node('details',null,'order-event'),summary=node('summary',date(event.created)+' · '+labels[event.detail.status]);box.append(summary);
   for(const change of event.detail.changes||[]){const before=change.before,after=change.after;box.append(node('p',change.articul+' · '+({removed:'Ջնջված',added:'Ավելացված',changed:'Փոփոխված'}[change.kind])+(before?' · նախկինում՝ '+before.qty+' × '+money(before.unitPrice):'')+(after?' · հաստատված՝ '+after.qty+' × '+money(after.unitPrice):'')));}history.append(box);}if(result.events.length)root.append(history);
  return order.revision;
 }
 async function notifications(){const who=owner;openPersonalCabinet();await load();if(owner!==who)return;const root=el('orderNotificationList');root.replaceChildren();root.hidden=false;document.querySelector('.cabinet-notifications-link').setAttribute('aria-expanded','true');const heading=node('div',null,'order-notification-heading'),back=node('button','Դեպի պատվերներ');back.type='button';back.onclick=()=>{root.hidden=true;document.querySelector('.cabinet-notifications-link').setAttribute('aria-expanded','false');el('serverOrdersList').scrollIntoView({block:'start'});};heading.append(node('strong','Պատվերների փոփոխություններ'),back);root.append(heading);el('cabinetScroll').scrollTop=0;
  if(!events.length){root.append(node('p','Չընթերցված փոփոխություններ չկան։'));return;}
  for(const event of events){const b=node('button','Պատվեր №'+event.detail.number+' · '+labels[event.detail.status]+' · '+shortDate(event.created));b.type='button';b.onclick=async()=>{const box=node('div',null,'server-order-content');root.replaceChildren(heading,box);try{const activeOwner=owner,revision=await details(event.order_id,box);if(owner!==activeOwner||!box.isConnected||el('cabinetModal').classList.contains('hidden')||revision==null)return;await ZZWS.json('orders/read',{method:'POST',body:JSON.stringify({orderId:event.order_id,revision})});await poll();}catch(e){if(box.isConnected)box.textContent=ZZWS.message(e);}};root.append(b);}
 }
 async function submit(){
  if(window.ZZWS_ASSISTED?.active()){if(window.ZZWS_CHECKOUT&&!ZZWS_CHECKOUT.ready())return;return ZZWS_ASSISTED.submit();}
  if(busy)return;busy=true;
  try{await prepareAndSubmit();}catch(e){alert(ZZWS.message(e));}finally{busy=false;ZZWS_RECEIPTS.setSubmitting(false);}
 }
 async function prepareAndSubmit(){
  if(window.ZZWS_CHECKOUT&&!window.ZZWS_CHECKOUT.ready())return;
  if(!serverIdentity)return;if(!Object.keys(cart).length){alert('Զամբյուղը դատարկ է');return;}if(!validateCartPrices())return;
  const activeOwner=serverIdentity.id;let receiptState;try{receiptState=await ZZWS_RECEIPTS.refresh(true);}catch(e){alert(ZZWS.message(e));return;}if(serverIdentity?.id!==activeOwner||!receiptState)return;if(ZZWS_RECEIPTS.blocked()&&!ZZWS_RECEIPTS.pendingRequest()){ZZWS_RECEIPTS.showPending();return;}
  if(window.ZZWS_CHECKOUT&&!window.ZZWS_CHECKOUT.ready())return;
  const requestKey='zzws_order_request_'+activeOwner;let previous;try{previous=JSON.parse(sessionStorage.getItem(requestKey)||'null');}catch{}
  if(!previous&&Number.isSafeInteger(serverIdentity.profileRevision)){
   const before=JSON.stringify(cart),quote=await secureApi('orders/quote',{method:'POST',body:JSON.stringify({articuls:Object.keys(window.ZZWS_CHECKOUT?.activeCart()||cart)})});if(serverIdentity?.id!==activeOwner||JSON.stringify(cart)!==before)return;
   if(quote.unavailable?.length){alert('Հասանելի գին չկա՝ '+quote.unavailable.join(', ')+'։ Դիրքերը պահպանված են զամբյուղում։');return;}
   const changed=quote.products.some(p=>getItemWholesalePrice({articul:p.articul})!==(isAdminUser()&&adminOrderPriceMode==='KP'?p.kpPrice:p.wholesale));for(const p of quote.products)productIndex.set(p.articul,p);if(changed){updateOrderPanel();renderModalItems();ZZWS_CHECKOUT?.changed();alert('Գները թարմացվել են։ Կրկին ստուգեք պատվերը։');return;}
  }
  if(window.ZZWS_CHECKOUT&&!window.ZZWS_CHECKOUT.ready())return;
  const snapshot=JSON.stringify(cart),lines=Object.values(window.ZZWS_CHECKOUT?.activeCart()||cart).map(item=>({articul:item.articul,qty:item.qty,unitPrice:getItemWholesalePrice(item)})).sort((a,b)=>a.articul.localeCompare(b.articul));
  const delivery={organization:getSelectedOrganizationName(),address:getDeliveryAddressValue(),contact:el('contactPersonInput').value,method:getSelectedDeliveryMethod(),date:el('deliveryDateInput').value,comment:el('orderCommentInput').value};
  const payload={lines,delivery,...(Number.isSafeInteger(serverIdentity.profileRevision)?{profileRevision:serverIdentity.profileRevision,deliveryVariantId:el('organizationSelect').value}:{}),priceMode:adminOrderPriceMode},fingerprint=JSON.stringify(payload),key='zzws_order_request_'+serverIdentity.id;let pending;try{pending=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
  if(!pending)pending={fingerprint,payload,snapshot,requestId:crypto.randomUUID()};
  if(pending.fingerprint!==fingerprint&&!confirm('Նախորդ ուղարկման փորձը դեռ չի հաստատվել։ Կրկնե՞լ այն սկզբնական կազմով։ Զամբյուղի նոր փոփոխությունները կպահպանվեն։'))return;
  sessionStorage.setItem(key,JSON.stringify(pending));
  busy=true;ZZWS_RECEIPTS.setSubmitting(true);
  try{const result=await secureApi('orders',{method:'POST',body:JSON.stringify({...pending.payload,requestId:pending.requestId})});sessionStorage.removeItem(key);if(serverIdentity?.id!==activeOwner)return;if(window.ZZWS_CHECKOUT)window.ZZWS_CHECKOUT.complete(pending.payload.lines,pending.snapshot);else if(JSON.stringify(cart)===pending.snapshot)clearOrder();await ZZWS_MEMORY.flush().catch(()=>{});if(serverIdentity?.id!==activeOwner)return;closeOrderModal();openPersonalCabinet();await load();alert('Պատվեր №'+result.number+' ուղարկվել է։ Սպասեք ադմինիստրատորի հաստատմանը։');}
  catch(e){if(e.status===400||e.status===409)sessionStorage.removeItem(key);alert(e.message);if(e.status===409){await loadPriceDataSilent();renderModalItems();}}
  finally{busy=false;ZZWS_RECEIPTS.setSubmitting(false);ZZWS_RECEIPTS.refresh().catch(()=>{});}
 }
 el('serverOrderSearchForm').onsubmit=e=>{e.preventDefault();load();};el('serverOrderSearchForm').onreset=()=>setTimeout(()=>load(),0);
 window.ZZWS_ORDERS={start,stop,load,notifications,submit};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
})();
