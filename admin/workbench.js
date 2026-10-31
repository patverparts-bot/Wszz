(() => {
 const el=id=>document.getElementById(id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const labels={new:'Նոր',confirmed:'Հաստատված',in_progress:'Ընթացքում',completed:'Առաքված է',received:'Ստացված է',rejected:'Մերժված'};
 let epoch=0,lifecycle=0,rows=[],selected=null,timer,key='',orderTools=null,updatedAt=null,refreshing=false,pollTimer=null;
 const safe=fn=>async()=>{const generation=lifecycle;try{await fn();}catch(e){if(generation!==lifecycle)return;if(e.status===401){showLogin();return;}el('managerMessage').textContent=ZZWS.message(e);}};
 function mount(tab){
  const editor=el('adminOrderEditor'),message=el('adminOrderStatus');
  if(tab==='manager'){
   const manual=el('manualOrderLines').closest('details');if(manual)manual.open=true;
   if(!orderTools){const original=editor.querySelector('.original-order-panel'),confirmation=original.nextElementSibling;orderTools=node('details',null,'manager-order-tools');orderTools.append(node('summary','Սկզբնական կազմ, փոփոխությունների պատմություն և ֆայլով հաստատում'));original.before(orderTools);orderTools.append(original,confirmation);}
   el('managerEditorHost').append(message,editor);document.documentElement.dataset.managerOpen='true';
  }
  else{
   if(orderTools){while(orderTools.children.length>1)orderTools.before(orderTools.children[1]);orderTools.remove();orderTools=null;}
   el('ordersStatusHome').after(message);el('ordersEditorHome').after(editor);delete document.documentElement.dataset.managerOpen;
  }
 }
 function customer(order){
  selected=order;const root=el('managerCustomer');root.replaceChildren();el('managerEmpty').hidden=!!order;
  if(!order)return;
  root.append(node('h2',order.customer.client),node('p',order.customer.login+' · Պատվեր №'+order.number+' · '+labels[order.status],'help'));
  const details=node('div',null,'manager-customer-data');
  for(const [label,value] of [['Կազմակերպություն',order.delivery?.organization],['Կոնտակտ',order.delivery?.contact],['Հասցե',order.delivery?.address],['Առաքման օր',order.delivery?.date]])if(value)details.append(node('p',label+'՝ '+value));
  root.append(details);
  if(order.user_id){const templates=node('button','Պահպանված զամբյուղներ');templates.type='button';templates.onclick=safe(()=>ZZWS_ADMIN_TEMPLATES.openCustomer(order.user_id));root.append(templates);}
  if(rows.some(r=>r.id===order.id))rows=rows.map(r=>r.id===order.id?{...r,...order}:r);render();
 }
 function render(){
  const root=el('managerQueue');root.replaceChildren();
  for(const order of rows){const b=node('button',null,'manager-order'+(selected?.id===order.id?' is-selected':''));b.type='button';b.dataset.managerOrder=order.id;
   b.append(node('strong','№'+order.number+' · '+order.customer.client),node('span',labels[order.status],'order-status status-'+order.status),node('small',Number(order.total).toLocaleString('hy-AM')+' ֏ · '+new Date(order.created).toLocaleDateString('hy-AM',{timeZone:'Asia/Yerevan'})));
   b.onclick=safe(async()=>{const opened=await ZZWS_ADMIN_ORDERS.openNotice(order.id);if(opened)customer(opened);});root.append(b);
  }
  if(!rows.length)root.append(node('p','Ընտրված պայմաններով պատվերներ չկան։','help'));
  el('managerSummary').textContent='Բեռնված պատվերներ՝ '+rows.length+(updatedAt?' · Թարմացված՝ '+updatedAt.toLocaleTimeString('hy-AM',{timeZone:'Asia/Yerevan'}):'');
 }
 async function load(more=false,background=false){
  if(background&&refreshing)return;refreshing=true;
  const ticket=++epoch,params=new URLSearchParams(),status=el('managerStatusFilter').value,search=el('managerSearch').value.trim();if(status)params.set('status',status);if(search)params.set('search',search);
  const filterKey=params.toString(),previous=more&&key===filterKey?rows:[];
  if(previous.length)params.set('before',previous.at(-1).number);
  el('managerQueue').setAttribute('aria-busy','true');
  try{const data=await ZZWS.json('admin/orders?'+params);if(ticket!==epoch)return;key=filterKey;const incoming=data.orders;
   if(background){const known=new Set(incoming.map(r=>r.id)),oldest=incoming.length?Math.min(...incoming.map(r=>Number(r.number))):0;rows=[...incoming,...rows.filter(r=>!known.has(r.id)&&Number(r.number)<oldest&&(!status||r.status===status))];}else rows=[...previous,...incoming];
   updatedAt=new Date();render();el('managerMore').hidden=data.orders.length<100;el('managerMessage').textContent='';}
  catch(error){if(ticket===epoch)el('managerMessage').textContent='Չհաջողվեց թարմացնել հերթը։ '+ZZWS.message(error);if(!background)throw error;}
  finally{if(ticket===epoch){refreshing=false;el('managerQueue').setAttribute('aria-busy','false');}}
 }
 function reset(){clearInterval(pollTimer);pollTimer=null;++lifecycle;++epoch;clearTimeout(timer);rows=[];selected=null;key='';updatedAt=null;refreshing=false;el('managerMessage').textContent='';el('managerQueue').replaceChildren();customer(null);mount('orders');}
 el('managerRefresh').onclick=safe(()=>load());el('managerMore').onclick=safe(()=>load(true));el('managerStatusFilter').onchange=safe(()=>load());
 el('managerSearch').oninput=()=>{++epoch;clearTimeout(timer);timer=setTimeout(safe(()=>load()),300);};
 document.addEventListener('zzws:admin-order',e=>customer(e.detail));
 window.ZZWS_ADMIN_WORKBENCH={load,mount,reset,customer,start(){clearInterval(pollTimer);pollTimer=setInterval(()=>window.ZZWS_ADMIN_WORKBENCH.poll(),15000);},poll:()=>{if(!document.hidden&&!el('manager').hidden)return load(false,true);}};
})();
