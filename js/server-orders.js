(() => {
 const labels={new:'Նոր',confirmed:'Հաստատված',in_progress:'Ընթացքում',completed:'Առաքված է',rejected:'Մերժված',received:'Ստացված է'};
 let owner=null,timer=null,events=[],orders=[],busy=false,loadTicket=0,noticeSeen=new Set();
 const el=id=>document.getElementById(id),money=v=>Number(v||0).toLocaleString('hy-AM')+' ֏';
 const date=v=>new Date(v).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan'});
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 function setNotice(text){const box=el('orderNotificationNotice');box.textContent=text;box.hidden=!text;}
 async function poll(force=false,refreshList=true){
  window.ZZWS_RECEIPTS?.refresh().catch(()=>{});
  if(!owner||(!force&&document.hidden))return;
  const activeOwner=owner;
  try{const result=await ZZWS.json('orders/notifications');if(owner!==activeOwner)return;events=result.events;
   const badge=el('orderNotificationsCount');badge.textContent=events.length>=50?'50+':String(events.length);badge.hidden=!events.length;
   const fresh=events.filter(e=>!noticeSeen.has(e.id));for(const event of events)noticeSeen.add(event.id);
   if(fresh.length){const assisted=fresh.find(e=>e.detail.kind==='created_by_admin');setNotice(assisted&&fresh.length===1?'Ձեր անունից պատվեր №'+assisted.detail.number+' լրացրել է ադմինիստրատոր՝ '+assisted.detail.createdBy.name+' ('+assisted.detail.createdBy.login+')։ Բացեք ծանուցումները կամ անձնական հաշիվը։':'Ձեր պատվերներում կան փոփոխություններ՝ '+fresh.length+'։ Բացեք ծանուցումները կամ անձնական հաշիվը։');}
   if(!events.length)setNotice('');
   if(refreshList&&fresh.length&&!el('cabinetModal').classList.contains('hidden'))await load();
  }catch(e){if(e.status===401)lockCatalog();}
 }
 function start(user){stop();owner=user.id;window.ZZWS_RECEIPTS?.start(user);poll();timer=setInterval(poll,15000);}
 function stop(){++loadTicket;window.ZZWS_RECEIPTS?.stop();if(timer)clearInterval(timer);timer=null;owner=null;events=[];orders=[];noticeSeen=new Set();el('orderNotificationsCount')?.setAttribute('hidden','');if(el('serverOrdersList'))el('serverOrdersList').replaceChildren();if(el('orderNotificationNotice'))setNotice('');}
 async function load(more=false){
  if(!owner)return;const root=el('serverOrdersList');
  const activeOwner=owner;
  const ticket=++loadTicket,params=new URLSearchParams(),pending=el('pendingReceiptOnly').checked;if(pending)params.set('receiptPending','true');if(more&&orders.length)params.set('before',orders.at(-1).number);
  try{const data=await ZZWS.json('orders'+(params.size?'?'+params:''));if(owner!==activeOwner||ticket!==loadTicket||pending!==el('pendingReceiptOnly').checked)return;orders=more?[...orders,...data.orders]:data.orders;render();el('moreServerOrders').hidden=data.orders.length<50;}
  catch(e){if(owner===activeOwner&&ticket===loadTicket)root.textContent=ZZWS.message(e);}
 }
 function render(){
  const root=el('serverOrdersList'),opened=new Set([...root.querySelectorAll('details[open][data-order-id]')].map(n=>n.dataset.orderId));root.replaceChildren();
  if(!orders.length){root.append(node('p','Պատվերներ դեռ չկան։ Զամբյուղում սեղմեք «Ուղարկել պատվերը»։','orders-empty'));return;}
  for(const order of orders){const card=node('details',null,'server-order-card'),summary=node('summary'),identity=node('div'),total=node('div');
   identity.append(node('strong','Պատվեր №'+order.number),node('span',date(order.created),'server-order-date'));if(order.created_by)identity.append(node('span','Լրացրել է ադմինիստրատոր՝ '+order.created_by.name+' ('+order.created_by.login+')','order-info'));
   total.append(node('span',labels[order.status]||order.status,'order-status status-'+order.status),ZZWS_ORDER_COMPARE.renderTotal(order));
   if(events.some(e=>e.order_id===order.id))identity.append(node('span','Կան փոփոխություններ','order-unread'));
   summary.append(identity,total);card.append(summary);const content=node('div',null,'server-order-content');card.append(content);card.dataset.orderId=order.id;
   card.ontoggle=async()=>{if(card.open&&!content.dataset.loaded){content.textContent='Պատվերը բեռնվում է…';const activeOwner=owner;try{const revision=await details(order.id,content);if(owner!==activeOwner||!card.open||!card.isConnected||el('cabinetModal').classList.contains('hidden'))return;content.dataset.loaded='true';await ZZWS.json('orders/read',{method:'POST',body:JSON.stringify({orderId:order.id,revision})});events=events.filter(e=>e.order_id!==order.id||e.revision>revision);poll();}catch(e){content.textContent=e.message;}}};root.append(card);if(opened.has(order.id))card.open=true;
  }
 }
 function linesTable(lines){const wrap=node('div',null,'order-lines-scroll'),table=node('table');const head=table.createTHead().insertRow();for(const h of ['Ապրանք','Քանակ','Գին','Գումար'])head.append(node('th',h));
  for(const line of lines){const row=table.insertRow();const product=row.insertCell();product.append(node('strong',line.name),node('small',line.articul));row.insertCell().textContent=line.qty;row.insertCell().textContent=money(line.unitPrice);row.insertCell().textContent=money(line.qty*line.unitPrice);}wrap.append(table);return wrap;}
 async function details(id,root){const result=await ZZWS.json('orders/detail',{method:'POST',body:JSON.stringify({id})}),order=result.order;root.replaceChildren();
  root.append(node('p',(order.status==='new'?'Պատվերը ստացվել է։ Սպասում է ադմինիստրատորի հաստատմանը։':'Կարգավիճակ՝ '+labels[order.status])+ ' · Թարմացվել է '+date(order.updated),'order-info'));
  if(order.created_by)root.append(node('p','Պատվերը ձեր անունից լրացրել է ադմինիստրատոր՝ '+order.created_by.name+' ('+order.created_by.login+')','order-admin-comment'));
  const delivery=order.delivery||{};root.append(node('p',[delivery.organization,delivery.contact,delivery.address,delivery.method,delivery.date,delivery.paymentDeadline?'Վճարման վերջնաժամկետ՝ '+delivery.paymentDeadline:''].filter(Boolean).join(' · '),'order-info'));
  if(delivery.comment)root.append(node('p','Ձեր մեկնաբանությունը՝ '+delivery.comment));if(order.comment)root.append(node('p','Ադմինիստրատորի մեկնաբանությունը՝ '+order.comment,'order-admin-comment'));
  root.append(node('p','Սկզբնական պատվերն ու հաստատված կազմը։ Չհաստատված ապրանքներն ու արժեքները ջնջագծված են։','order-info'));
  root.append(ZZWS_ORDER_COMPARE.render(order.original_lines?.length?order.original_lines:order.lines,order.lines));
  const repeat=node('button','Կրկնել պատվերը ընթացիկ գներով');repeat.type='button';repeat.onclick=()=>{
   const allowed=order.lines.filter(line=>productIndex.has(line.articul)),missing=order.lines.length-allowed.length;
   if(!allowed.length){alert('Այս պատվերի ապրանքներն այլևս հասանելի չեն');return;}
   if(!confirm('Ավելացնե՞լ '+allowed.length+' դիրք ընթացիկ զամբյուղին։ Անհասանելի՝ '+missing+'։ Գները կլինեն ընթացիկ։'))return;
   for(const line of allowed){const product=productIndex.get(line.articul);cart[line.articul]={articul:line.articul,qty:Math.min(9999,(cart[line.articul]?.qty||0)+line.qty),addedPrice:getItemWholesalePrice({articul:line.articul}),addedPriceMode:isAdminUser()?adminOrderPriceMode:'WS'};}
   saveCartToStorage();updateOrderPanel();resetAndRender();window.ZZWS_MEMORY?.capture();closePersonalCabinet();openOrderModal();};root.append(repeat);
  for(const event of result.events){const box=node('details',null,'order-event'),summary=node('summary',date(event.created)+' · '+labels[event.detail.status]);box.append(summary);if(event.detail.kind==='closed_order_reopened')box.append(node('p','Փակված պատվերի կարգավիճակը փոխել է '+event.detail.actorLogin+' · Պատճառ՝ '+event.detail.comment));
   for(const change of event.detail.changes||[]){const before=change.before,after=change.after;box.append(node('p',change.articul+' · '+({removed:'Ջնջված',added:'Ավելացված',changed:'Փոփոխված'}[change.kind])+(before?' · նախկինում՝ '+before.qty+' × '+money(before.unitPrice):'')+(after?' · հաստատված՝ '+after.qty+' × '+money(after.unitPrice):'')));}root.append(box);}
  window.ZZWS_RECEIPTS?.render(order,root);
  return order.revision;
 }
 async function notifications(){const who=owner;openPersonalCabinet();await poll(true,false);await load();if(!who||owner!==who)return;const root=el('orderNotificationList');root.replaceChildren();root.hidden=false;
  if(!events.length){root.append(node('p','Չընթերցված փոփոխություններ չկան։'));return;}
  for(const event of events){const b=node('button','Պատվեր №'+event.detail.number+' · '+(event.detail.kind==='closed_order_reopened'?'Փակված պատվերը վերաբացել է '+event.detail.actorLogin+' · '+event.detail.comment:event.detail.kind==='created_by_admin'?'Ձեր անունից լրացրել է '+event.detail.createdBy.name+' ('+event.detail.createdBy.login+')':labels[event.detail.status])+' · '+date(event.created));b.type='button';b.onclick=async()=>{const box=node('div',null,'server-order-content');root.replaceChildren(box);try{const activeOwner=owner,revision=await details(event.order_id,box);if(owner!==activeOwner||!box.isConnected||el('cabinetModal').classList.contains('hidden'))return;await ZZWS.json('orders/read',{method:'POST',body:JSON.stringify({orderId:event.order_id,revision})});await poll();}catch(e){box.textContent=e.message;}};root.append(b);}
 }
 async function submit(){
  if(window.ZZWS_ASSISTED?.active())return ZZWS_ASSISTED.submit();
  if(busy)return;busy=true;try{await submitRequest();}finally{busy=false;}
 }
 async function submitRequest(){
  if(!serverIdentity)return;if(!Object.keys(cart).length){alert('Զամբյուղը դատարկ է');return;}
  const activeOwner=serverIdentity.id;let receiptState;try{receiptState=await ZZWS_RECEIPTS.refresh();}catch(e){alert(ZZWS.message(e));return;}if(serverIdentity?.id!==activeOwner||!receiptState)return;if(ZZWS_RECEIPTS.blocked()&&!ZZWS_RECEIPTS.pendingRequest()){ZZWS_RECEIPTS.showPending();return;}
  const key='zzws_order_request_'+serverIdentity.id;let pending;try{pending=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
  if(!pending){
   const before=JSON.stringify(cart);let quote;try{quote=await secureApi('orders/quote',{method:'POST',body:JSON.stringify({articuls:Object.keys(cart)})});}catch(e){alert(e.message);return;}
   if(serverIdentity?.id!==activeOwner||JSON.stringify(cart)!==before)return;
   if(quote.unavailable.length){alert('Այս ապրանքների համար հասանելի գին չկա՝ '+quote.unavailable.join(', ')+'։ Դրանք պահպանված են զամբյուղում։');return;}
   const changed=quote.products.some(p=>getItemWholesalePrice({articul:p.articul})!==(isAdminUser()&&adminOrderPriceMode==='KP'?p.kpPrice:p.wholesale));
   for(const product of quote.products)productIndex.set(product.articul,product);
   updateOrderPanel();renderModalItems();
   if(changed){alert('Զամբյուղի գները թարմացվել են։ Ստուգեք դրանք և կրկին սեղմեք ուղարկելու կոճակը։');return;}
   if(!validateCartPrices())return;
  }
  const snapshot=JSON.stringify(cart),lines=Object.values(cart).map(item=>({articul:item.articul,qty:item.qty,unitPrice:getItemWholesalePrice(item)})).sort((a,b)=>a.articul.localeCompare(b.articul));
  const delivery={organization:getSelectedOrganizationName(),address:getDeliveryAddressValue(),contact:el('contactPersonInput').value,method:getSelectedDeliveryMethod(),date:el('deliveryDateInput').value,comment:el('orderCommentInput').value};
  const payload={lines,delivery,deliveryVariantId:el('organizationSelect').value,profileRevision:serverIdentity.profileRevision,priceMode:adminOrderPriceMode},fingerprint=JSON.stringify(payload);
  if(!pending&&!payload.deliveryVariantId){alert('Ընտրեք առաքման տարբերակը։ Հասցեն և կոնտակտը պահպանված են։');return;}
  if(!pending)pending={fingerprint,payload,snapshot,requestId:crypto.randomUUID()};
  if(pending.fingerprint!==fingerprint&&!confirm('Նախորդ ուղարկման փորձը դեռ չի հաստատվել։ Կրկնե՞լ այն սկզբնական կազմով։ Զամբյուղի նոր փոփոխությունները կպահպանվեն։'))return;
  sessionStorage.setItem(key,JSON.stringify(pending));
  busy=true;ZZWS_RECEIPTS.setSubmitting(true);
  try{const result=await secureApi('orders',{method:'POST',body:JSON.stringify({...pending.payload,requestId:pending.requestId})});sessionStorage.removeItem(key);if(serverIdentity?.id!==activeOwner)return;if(JSON.stringify(cart)===pending.snapshot)clearOrder();closeOrderModal();await ZZWS_MEMORY.flush();openPersonalCabinet();await load();alert('Պատվեր №'+result.number+' ուղարկվել է։ Սպասեք ադմինիստրատորի հաստատմանը։');}
  catch(e){if([400,403,409].includes(e.status))sessionStorage.removeItem(key);alert(e.message);if(e.status===409){await loadPriceDataSilent();renderModalItems();}}
  finally{busy=false;ZZWS_RECEIPTS.setSubmitting(false);ZZWS_RECEIPTS.refresh().catch(()=>{});}
 }
 window.ZZWS_ORDERS={start,stop,load,notifications,submit};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
})();
