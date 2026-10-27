(() => {
 const statuses={new:'Նոր',confirmed:'Հաստատված',in_progress:'Ընթացքում',completed:'Ավարտված',rejected:'Մերժված'};
 const el=id=>document.getElementById(id),money=v=>Number(v||0).toLocaleString('hy-AM')+' ֏',date=v=>new Date(v).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan'});
 let list=[],selected=null,manualRows=[],preview=null,dirty=false,busy=false,timer=null,listEpoch=0,listKey=null,editorEpoch=0,operation=0,searchTimer;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const btn=(text,fn,cls)=>{const b=node('button',text,cls);b.type='button';b.onclick=()=>run(fn);return b;};
 const request=(path,p)=>ZZWS.json(path,p instanceof FormData?{method:'POST',body:p}:p?{method:'POST',body:JSON.stringify(p)}:{});
 async function run(fn){try{await fn();}catch(e){el('adminOrderStatus').textContent=ZZWS.message(e);if(e.status===401){if(typeof showLogin==='function')showLogin();else reset();}}}

 const canWrite=()=>document.documentElement.dataset.orderWrite!=='false';
 const waitMessage=()=>{el('adminOrderStatus').textContent='Սպասեք ընթացիկ գործողության ավարտին։';};
 function controls(){
  const readOnly=!canWrite(),locked=readOnly||busy||!selected;
  for(const id of ['manualOrderSave','previewFinalFile','previewFinalPaste','applyConfirmation','cancelConfirmation'])el(id).hidden=readOnly;
  for(const field of el('adminOrderEditor').querySelectorAll('input,select,textarea'))field.disabled=locked;
  el('confirmationPaste').closest('fieldset').hidden=readOnly;
  el('manualOrderSave').disabled=locked||!!preview;
  for(const id of ['previewFinalFile','previewFinalPaste'])el(id).disabled=locked;
  el('applyOrderDelivery').disabled=locked||!Object.keys(preview?.delivery||{}).length;
  el('applyConfirmation').disabled=locked||!preview||!el('confirmOrderCustomer').checked;
  el('cancelConfirmation').disabled=busy;
  el('closeAdminOrder').disabled=busy;el('exportServerOrder').disabled=!selected||busy;
  for(const button of el('adminOrderList').querySelectorAll('button'))button.disabled=busy;
  for(const button of el('manualOrderLines').querySelectorAll('button'))button.disabled=locked;
 }
 function begin(){busy=true;const token=++operation;controls();return token;}
 function finish(token){if(token===operation){busy=false;controls();}}
 function filters(){const params=new URLSearchParams();if(el('orderSearch').value.trim())params.set('search',el('orderSearch').value.trim());for(const id of ['from','to'])if(el('orderDate'+id).value)params.set(id,el('orderDate'+id).value);if(el('orderStatusFilter').value)params.set('status',el('orderStatusFilter').value);return params;}
 async function load(more=false){
  const ticket=++listEpoch,params=filters(),filterKey=params.toString(),append=more&&listKey===filterKey,previous=append?[...list]:[];
  if(append&&previous.length)params.set('before',previous.at(-1).number);
  el('adminOrderList').setAttribute('aria-busy','true');el('moreAdminOrders').disabled=true;
  try{const data=await request('admin/orders?'+params);if(ticket!==listEpoch||filters().toString()!==filterKey)return;list=[...previous,...data.orders];listKey=filterKey;renderList();el('moreAdminOrders').hidden=data.orders.length<100;}
  catch(e){if(ticket===listEpoch)throw e;}
  finally{if(ticket===listEpoch){el('adminOrderList').setAttribute('aria-busy','false');el('moreAdminOrders').disabled=false;}}
 }
 function renderList(){const root=el('adminOrderList'),search=el('orderSearch').value.trim().toLowerCase();root.replaceChildren();
  const shown=list;el('adminOrderCount').textContent='Ցուցադրված է՝ '+shown.length;
  if(!shown.length){root.append(node('p','Ընտրված պայմաններով պատվերներ չկան։'));return;}
  const table=node('table'),head=table.createTHead().insertRow();for(const h of ['№ / ամսաթիվ','Հաճախորդ','Կարգավիճակ','Գումար',''])head.append(node('th',h));
  for(const o of shown){const row=table.insertRow();row.insertCell().append(node('strong','№'+o.number),node('small',date(o.created),'admin-order-date'));row.insertCell().append(node('strong',o.customer.client),node('small',o.customer.login,'admin-order-date'));row.insertCell().append(node('span',statuses[o.status],'order-status status-'+o.status));row.insertCell().textContent=money(o.total);row.insertCell().append(btn('Բացել',()=>open(o.id)));}root.append(table);controls();
 }
 async function open(id,internal=false){
  if(busy&&!internal){waitMessage();return;}
  if(dirty&&!internal&&!confirm('Վերաբացե՞լ պատվերը և չեղարկե՞լ չպահպանված ձեռքով փոփոխությունները։'))return;
  const ticket=++editorEpoch;selected=null;preview=null;manualRows=[];dirty=false;
  el('confirmationPreview').hidden=true;el('selectedOrderTitle').textContent='Պատվերը բեռնվում է…';
  for(const name of ['manualOrderLines','adminOriginalOrder','adminOrderHistory'])el(name).replaceChildren();controls();
  let o;try{o=await request('admin/orders/detail',{id});}catch(e){if(ticket===editorEpoch)throw e;return;}if(ticket!==editorEpoch)return;
  selected=o;manualRows=o.lines.map(row=>({...row}));
  el('adminOrderEditor').hidden=false;el('confirmationPaste').value='';el('finalOrderFile').value='';el('finalOrderFile').dispatchEvent(new Event('change',{bubbles:true}));
  el('selectedOrderTitle').textContent='Պատվեր №'+o.number+' · '+o.customer.client;
  el('selectedOrderMeta').textContent=o.customer.login+' · Ստացվել է '+date(o.created)+' · Տարբերակ '+o.revision;
  el('selectedOrderDelivery').textContent=Object.entries(o.delivery).filter(([,value])=>value).map(([key,value])=>({organization:'Կազմակերպություն',contact:'Կոնտակտ',address:'Հասցե',method:'Առաքում',date:'Առաքման ամսաթիվ',paymentDeadline:'Վճարման վերջնաժամկետ',comment:'Մեկնաբանություն'}[key]||'Լրացուցիչ տվյալ')+': '+value).join(' · ');
  renderOrderHistory(o.events||[]);el('editOrderStatus').value=o.status;el('editOrderComment').value=o.comment;renderManual();controls();
  el('adminOrderStatus').textContent='';el('adminOrderEditor').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function renderManual(){const root=el('manualOrderLines');root.replaceChildren();const table=node('table'),head=table.createTHead().insertRow();for(const h of ['Ապրանք','Քանակ','Միավորի գին',''])head.append(node('th',h));
  for(const row of manualRows){const tr=table.insertRow();tr.insertCell().append(node('strong',row.name),node('small',row.articul,'admin-order-date'));
   for(const key of ['qty','unitPrice']){const input=node('input');input.type='number';input.min=key==='qty'?'1':'0.01';input.step=key==='qty'?'1':'any';if(key==='qty')input.max='9999';input.value=row[key];input.disabled=!canWrite()||busy;input.setAttribute('aria-label',(key==='qty'?'Քանակ ':'Գին ')+row.articul);input.oninput=()=>{if(!canWrite()||busy)return;row[key]=Number(input.value);dirty=true;manualTotal();};tr.insertCell().append(input);}
   const actions=tr.insertCell();if(canWrite())actions.append(btn('Ջնջել տողը',()=>{if(busy)return;manualRows=manualRows.filter(r=>r!==row);dirty=true;renderManual();},'storage-danger'));}
  root.append(table);manualTotal();
 }
 function manualTotal(){el('manualOrderTotal').textContent='Ընդամենը՝ '+money(manualRows.reduce((sum,row)=>sum+row.qty*row.unitPrice,0));const root=el('adminOriginalOrder');root.replaceChildren();root.append(ZZWS_ORDER_COMPARE.render(selected.original_lines?.length?selected.original_lines:selected.lines,manualRows));}
 function renderOrderHistory(events){const root=el('adminOrderHistory');root.replaceChildren();for(const event of events){const details=node('details',null,'order-event');details.append(node('summary',date(event.created)+' · '+statuses[event.detail.status]));for(const c of event.detail.changes||[]){details.append(node('p',c.articul+' · '+({removed:'Ջնջված',added:'Ավելացված',changed:'Փոփոխված'}[c.kind])+(c.before?' · նախկինում՝ '+c.before.qty+' × '+money(c.before.unitPrice):'')+(c.after?' → '+c.after.qty+' × '+money(c.after.unitPrice):'')));}root.append(details);}}
 async function saveManual(){
  if(!selected||busy||!canWrite())return;if(!confirm('Պահպանե՞լ պատվեր №'+selected.number+'-ի փոփոխությունները։ Օգտատերը կստանա ծանուցում։'))return;
  const ticket=editorEpoch,id=selected.id,token=begin();
  const payload={id,revision:selected.revision,lines:manualRows.map(r=>({...r})),status:el('editOrderStatus').value,comment:el('editOrderComment').value};
  try{const result=await request('admin/orders/update',payload);if(token!==operation||ticket!==editorEpoch||selected?.id!==id)return;dirty=false;await open(result.id,true);await load();el('adminOrderStatus').textContent='Պատվերը պահպանված է։ Օգտատիրոջը հասանելի է ծանուցումը։';}finally{finish(token);}
 }
 async function makePreview(kind){
  if(!selected||busy||!canWrite())return;
  if(dirty&&!confirm('Նախադիտումը կազմվում է պահպանված պատվերի հիման վրա։ Կիրառելիս այն կփոխարինի չպահպանված ձեռքով փոփոխությունները։ Շարունակե՞լ։'))return;
  const context={id:selected.id,revision:selected.revision,number:selected.number,customer:{...selected.customer}},ticket=editorEpoch;
  let body;if(kind==='file'){const file=el('finalOrderFile').files[0];if(!file)throw new Error('Ընտրեք XLSX');body=new FormData();body.set('file',file);body.set('orderId',context.id);body.set('revision',context.revision);}else body={orderId:context.id,revision:context.revision,text:el('confirmationPaste').value};
  const token=begin();el('adminOrderStatus').textContent='Հաստատումը ստուգվում է…';
  try{const result=await request('admin/orders/preview',body);if(token!==operation||ticket!==editorEpoch||selected?.id!==context.id)return;
   if(result.orderId!==context.id||result.revision!==context.revision)throw new Error('Նախադիտումը չի համապատասխանում բացված պատվերին։ Կրկին ստուգեք ֆայլը');
   preview={...result,context};renderPreview();el('adminOrderStatus').textContent='Մինչև կիրառելը ստուգեք հաճախորդին, ընդհանուր գումարը և փոփոխությունները։';
  }finally{finish(token);}
 }
 function renderPreview(){const root=el('confirmationPreviewContent');root.replaceChildren();const meta=preview.metadata||{};
  root.append(node('h3','Վերջնական կազմ · '+preview.lines.length+' դիրք · '+money(preview.total)));
  root.append(node('p','Ընտրված պատվեր՝ №'+preview.context.number+' · '+preview.context.customer.client+' ('+preview.context.customer.login+')','order-info'));
  root.append(node('p',meta.customer||meta.organization?'Հաստատման հաճախորդը՝ '+[meta.customer,meta.organization].filter(Boolean).join(' · '):'Աղյուսակում հաճախորդն ու պատվերի համարը նշված չեն։ Անպայման ստուգեք համապատասխանությունն ընտրված պատվերին։','confirmation-warning'));
  if(meta.format==='zigzag_sales_report')root.append(node('p',meta.totalProvided?'Փաստաթղթի ընդհանուր գումարը համընկնում է տողերի գումարին։ Գինը հաշվարկված է զեղչված գումարից։':'Ստուգիչ ընդհանուր գումարը նշված չէ։ Գումարը հաշվարկված է զեղչված տողերից։','order-info'));
  if(Object.keys(preview.delivery||{}).length)root.append(node('p','Հաստատման ամսաթվերն ու առաքումը՝ '+Object.entries(preview.delivery).map(([k,v])=>({date:'Առաքման ամսաթիվ',method:'Առաքման եղանակ',paymentDeadline:'Վճարման վերջնաժամկետ'}[k]||'Լրացուցիչ տվյալ')+': '+v).join(' · ')));
  const changes=node('div',null,'confirmation-changes');if(!preview.changes.length)changes.append(node('p','Կազմը, գներն ու քանակը չեն փոխվել։ Պատվերը կհաստատվի։'));
  for(const change of preview.changes){const before=change.before,after=change.after;changes.append(node('p',({removed:'Ջնջված',added:'Ավելացված',changed:'Փոփոխված'}[change.kind])+' · '+change.articul+' · '+change.name+(before?' · նախկինում՝ '+before.qty+' × '+money(before.unitPrice):'')+(after?' → '+after.qty+' × '+money(after.unitPrice):''),'change-'+change.kind));}root.append(changes);
  const table=node('table'),head=table.createTHead().insertRow();for(const h of ['Արտիկուլ / ապրանք','Քանակ','Գին՝ զեղչից հետո','Գումար'])head.append(node('th',h));for(const row of preview.lines){const tr=table.insertRow();tr.insertCell().textContent=row.articul+' · '+row.name;tr.insertCell().textContent=row.qty;tr.insertCell().textContent=money(row.unitPrice);tr.insertCell().textContent=money(row.qty*row.unitPrice);}const wrap=node('div',null,'order-lines-scroll');wrap.append(table);root.append(wrap);
  el('confirmOrderCustomer').checked=false;el('applyConfirmation').disabled=true;el('applyOrderDelivery').checked=false;el('applyOrderDelivery').disabled=!Object.keys(preview.delivery||{}).length;el('confirmationPreview').hidden=false;el('manualOrderSave').disabled=true;
 }
 async function apply(){
  if(!preview||busy||!canWrite()||!selected)return;
  if(preview.context.id!==selected.id||preview.context.revision!==selected.revision)throw new Error('Վերաբացեք պատվերը և կրկին ստուգեք հաստատումը');
  const token=begin(),ticket=editorEpoch,id=selected.id,payload={draft:preview.draft,orderId:preview.context.id,revision:preview.context.revision,confirmCustomer:el('confirmOrderCustomer').checked,applyDelivery:el('applyOrderDelivery').checked,comment:el('editOrderComment').value};
  try{const result=await request('admin/orders/apply',payload);if(token!==operation||ticket!==editorEpoch||selected?.id!==id)return;dirty=false;await open(result.id,true);await load();el('adminOrderStatus').textContent='Վերջնական պատվերը կիրառված և հաստատված է։ Օգտատիրոջը կայքում հասանելի է ծանուցումը։';}finally{finish(token);}
 }
 async function download(path,filename,body){const r=await ZZWS.request(path,body?{method:'POST',body:JSON.stringify(body)}:{});if(!r.ok)throw new Error('Չհաջողվեց ներբեռնել ֆայլը');const url=URL.createObjectURL(await r.blob()),a=node('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function reset(){++listEpoch;++editorEpoch;++operation;clearTimeout(searchTimer);if(timer)clearInterval(timer);timer=null;list=[];listKey=null;selected=null;manualRows=[];preview=null;dirty=false;busy=false;el('adminOrderList').replaceChildren();el('adminOrderEditor').hidden=true;}
 function start(){if(timer)clearInterval(timer);timer=setInterval(()=>{if(!document.hidden&&!el('orders').hidden&&el('adminOrderEditor').hidden)run(load);},15000);}
 el('refreshAdminOrders').onclick=()=>run(load);el('orderStatusFilter').onchange=()=>run(load);el('orderSearch').oninput=()=>{++listEpoch;clearTimeout(searchTimer);searchTimer=setTimeout(()=>run(load),350);};for(const id of ['from','to'])el('orderDate'+id).onchange=()=>run(load);el('moreAdminOrders').onclick=()=>run(()=>load(true));el('manualOrderSave').onclick=()=>run(saveManual);
 el('editOrderStatus').onchange=()=>{dirty=true;};el('editOrderComment').oninput=()=>{dirty=true;};el('previewFinalFile').onclick=()=>run(()=>makePreview('file'));el('previewFinalPaste').onclick=()=>run(()=>makePreview('paste'));
 el('confirmOrderCustomer').onchange=controls;el('applyConfirmation').onclick=()=>run(apply);el('cancelConfirmation').onclick=()=>{if(busy)return;preview=null;el('confirmationPreview').hidden=true;controls();};
 el('closeAdminOrder').onclick=()=>{if(busy){waitMessage();return;}if(!dirty||confirm('Փակե՞լ առանց ձեռքով փոփոխությունները պահպանելու։')){++editorEpoch;selected=null;preview=null;dirty=false;el('adminOrderEditor').hidden=true;}};
 el('downloadFinalTemplate').onclick=()=>run(()=>download('admin/orders/template','Final-order-template.xlsx'));el('exportServerOrder').onclick=()=>run(()=>download('admin/orders/export','Order-'+selected.number+'.xlsx',{id:selected.id}));
 window.ZZWS_ADMIN_ORDERS={load,start,reset};
})();
