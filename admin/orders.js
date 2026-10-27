(() => {
 const statuses={new:'Նոր',confirmed:'Հաստատված',in_progress:'Ընթացքում',completed:'Ավարտված',rejected:'Մերժված'},cash='Կանխիկ',bank='Բանկային փոխանցումով';
 const el=id=>document.getElementById(id),money=v=>Number(v||0).toLocaleString('hy-AM')+' ֏',date=v=>new Date(v).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan'});
 let list=[],selected=null,manualRows=[],preview=null,dirty=false,busy=false,timer=null;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const btn=(text,fn,cls)=>{const b=node('button',text,cls);b.type='button';b.onclick=()=>run(fn);return b;};
 const request=(path,p)=>ZZWS.json(path,p instanceof FormData?{method:'POST',body:p}:p?{method:'POST',body:JSON.stringify(p)}:{});
 async function run(fn){try{await fn();}catch(e){el('adminOrderStatus').textContent=e.message;if(e.status===401){if(typeof showLogin==='function')showLogin();else reset();}}}
 async function load(more=false){
  const params=new URLSearchParams();if(el('orderStatusFilter').value)params.set('status',el('orderStatusFilter').value);if(more&&list.length)params.set('before',list.at(-1).number);
  const data=await request('admin/orders?'+params);list=more?[...list,...data.orders]:data.orders;renderList();el('moreAdminOrders').hidden=data.orders.length<100;
 }
 function renderList(){const root=el('adminOrderList'),search=el('orderSearch').value.trim().toLowerCase();root.replaceChildren();
  const shown=list.filter(o=>[o.number,o.customer.client,o.customer.login,o.delivery.organization].join(' ').toLowerCase().includes(search));el('adminOrderCount').textContent='Ցուցադրված է՝ '+shown.length;
  if(!shown.length){root.append(node('p','Ընտրված պայմաններով պատվերներ չկան։'));return;}
  const table=node('table'),head=table.createTHead().insertRow();for(const h of ['№ / ամսաթիվ','Հաճախորդ','Կարգավիճակ','Գումար',''])head.append(node('th',h));
  for(const o of shown){const row=table.insertRow();row.insertCell().append(node('strong','№'+o.number),node('small',date(o.created),'admin-order-date'));row.insertCell().append(node('strong',o.customer.client),node('small',o.customer.login,'admin-order-date'));row.insertCell().append(node('span',statuses[o.status],'order-status status-'+o.status));row.insertCell().textContent=money(o.total);row.insertCell().append(btn('Բացել',()=>open(o.id)));}root.append(table);
 }
 async function open(id){if(dirty&&!confirm('Վերաբացե՞լ պատվերը և չեղարկե՞լ չպահպանված ձեռքով փոփոխությունները։'))return;
  const o=await request('admin/orders/detail',{id});selected=o;manualRows=o.lines.map(row=>({...row}));dirty=false;preview=null;
  el('adminOrderEditor').hidden=false;el('confirmationPreview').hidden=true;el('manualOrderSave').disabled=false;el('confirmationPaste').value='';el('finalOrderFile').value='';
  el('selectedOrderTitle').textContent='Պատվեր №'+o.number+' · '+o.customer.client;
  el('selectedOrderMeta').textContent=o.customer.login+' · Ստացվել է '+date(o.created)+' · Տարբերակ '+o.revision;
  el('selectedOrderDelivery').textContent=Object.entries(o.delivery).filter(([,value])=>value).map(([key,value])=>({organization:'Կազմակերպություն',contact:'Կոնտակտ',address:'Հասցե',method:'Առաքում',date:'Առաքման ամսաթիվ',paymentDeadline:'Վճարման վերջնաժամկետ',comment:'Մեկնաբանություն'}[key]||key)+': '+value).join(' · ');
  renderOrderHistory(o.events||[]);
  el('editOrderStatus').value=o.status;el('editOrderComment').value=o.comment;renderManual();el('adminOrderStatus').textContent='';el('adminOrderEditor').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function renderManual(){const root=el('manualOrderLines');root.replaceChildren();const table=node('table'),head=table.createTHead().insertRow();for(const h of ['Ապրանք','Քանակ','Միավորի գին','Վճարում',''])head.append(node('th',h));
  for(const row of manualRows){const tr=table.insertRow();tr.insertCell().append(node('strong',row.name),node('small',row.articul,'admin-order-date'));
   for(const key of ['qty','unitPrice']){const input=node('input');input.type='number';input.min=key==='qty'?'1':'0.01';input.step=key==='qty'?'1':'any';if(key==='qty')input.max='9999';input.value=row[key];input.setAttribute('aria-label',(key==='qty'?'Քանակ ':'Գին ')+row.articul);input.oninput=()=>{row[key]=Number(input.value);dirty=true;manualTotal();};tr.insertCell().append(input);}
   const pay=node('select');for(const method of [bank,cash]){const op=node('option',method);op.value=method;pay.append(op);}pay.value=row.paymentMethod;pay.onchange=()=>{row.paymentMethod=pay.value;dirty=true;};tr.insertCell().append(pay);
   tr.insertCell().append(btn('Ջնջել տողը',()=>{manualRows=manualRows.filter(r=>r!==row);dirty=true;renderManual();},'storage-danger'));}
  root.append(table);manualTotal();
 }
 function manualTotal(){el('manualOrderTotal').textContent='Ընդամենը՝ '+money(manualRows.reduce((sum,row)=>sum+row.qty*row.unitPrice,0));const root=el('adminOriginalOrder');root.replaceChildren();root.append(ZZWS_ORDER_COMPARE.render(selected.original_lines?.length?selected.original_lines:selected.lines,manualRows));}
 function renderOrderHistory(events){const root=el('adminOrderHistory');root.replaceChildren();for(const event of events){const details=node('details',null,'order-event');details.append(node('summary',date(event.created)+' · '+statuses[event.detail.status]));for(const c of event.detail.changes||[]){details.append(node('p',c.articul+' · '+({removed:'Ջնջված',added:'Ավելացված',changed:'Փոփոխված'}[c.kind])+(c.before?' · նախկինում՝ '+c.before.qty+' × '+money(c.before.unitPrice):'')+(c.after?' → '+c.after.qty+' × '+money(c.after.unitPrice):'')));}root.append(details);}}
 async function saveManual(){if(!selected||busy)return;if(!confirm('Պահպանե՞լ պատվեր №'+selected.number+'-ի փոփոխությունները։ Օգտատերը կստանա ծանուցում։'))return;
  busy=true;el('manualOrderSave').disabled=true;
  try{const result=await request('admin/orders/update',{id:selected.id,revision:selected.revision,lines:manualRows,status:el('editOrderStatus').value,comment:el('editOrderComment').value});dirty=false;await open(result.id);await load();el('adminOrderStatus').textContent='Պատվերը պահպանված է։ Օգտատիրոջը հասանելի է ծանուցումը։';}
  finally{busy=false;el('manualOrderSave').disabled=false;}
 }
 async function makePreview(kind){if(!selected||busy)return;
  if(dirty&&!confirm('Նախադիտումը կազմվում է պահպանված պատվերի հիման վրա։ Կիրառելիս այն կփոխարինի չպահպանված ձեռքով փոփոխությունները։ Շարունակե՞լ։'))return;
  let body;if(kind==='file'){const file=el('finalOrderFile').files[0];if(!file)throw new Error('Ընտրեք XLSX');body=new FormData();body.set('file',file);body.set('orderId',selected.id);body.set('revision',selected.revision);}else body={orderId:selected.id,revision:selected.revision,text:el('confirmationPaste').value};
  busy=true;el('adminOrderStatus').textContent='Հաստատումը ստուգվում է…';try{preview=await request('admin/orders/preview',body);renderPreview();el('adminOrderStatus').textContent='Մինչև կիրառելը ստուգեք հաճախորդին, ընդհանուր գումարը և փոփոխությունները։';}finally{busy=false;}
 }
 function renderPreview(){const root=el('confirmationPreviewContent');root.replaceChildren();const meta=preview.metadata||{};
  root.append(node('h3','Վերջնական կազմ · '+preview.lines.length+' դիրք · '+money(preview.total)));
  root.append(node('p','Ընտրված պատվեր՝ №'+selected.number+' · '+selected.customer.client+' ('+selected.customer.login+')','order-info'));
  root.append(node('p',meta.customer||meta.organization?'Հաստատման հաճախորդը՝ '+[meta.customer,meta.organization].filter(Boolean).join(' · '):'Աղյուսակում հաճախորդն ու պատվերի համարը նշված չեն։ Անպայման ստուգեք համապատասխանությունն ընտրված պատվերին։','confirmation-warning'));
  if(meta.format==='zigzag_sales_report')root.append(node('p',meta.totalProvided?'Փաստաթղթի ընդհանուր գումարը համընկնում է տողերի գումարին։ Գինը հաշվարկված է զեղչված գումարից։':'Ստուգիչ ընդհանուր գումարը նշված չէ։ Գումարը հաշվարկված է զեղչված տողերից։','order-info'));
  if(Object.keys(preview.delivery||{}).length)root.append(node('p','Հաստատման ամսաթվերն ու առաքումը՝ '+Object.entries(preview.delivery).map(([k,v])=>k+': '+v).join(' · ')));
  const changes=node('div',null,'confirmation-changes');if(!preview.changes.length)changes.append(node('p','Կազմը, գներն ու քանակը չեն փոխվել։ Պատվերը կհաստատվի։'));
  for(const change of preview.changes){const before=change.before,after=change.after;changes.append(node('p',({removed:'Ջնջված',added:'Ավելացված',changed:'Փոփոխված'}[change.kind])+' · '+change.articul+' · '+change.name+(before?' · նախկինում՝ '+before.qty+' × '+money(before.unitPrice):'')+(after?' → '+after.qty+' × '+money(after.unitPrice):''),'change-'+change.kind));}root.append(changes);
  const table=node('table'),head=table.createTHead().insertRow();for(const h of ['Արտիկուլ / ապրանք','Քանակ','Գին՝ զեղչից հետո','Գումար'])head.append(node('th',h));for(const row of preview.lines){const tr=table.insertRow();tr.insertCell().textContent=row.articul+' · '+row.name;tr.insertCell().textContent=row.qty;tr.insertCell().textContent=money(row.unitPrice);tr.insertCell().textContent=money(row.qty*row.unitPrice);}const wrap=node('div',null,'order-lines-scroll');wrap.append(table);root.append(wrap);
  el('confirmOrderCustomer').checked=false;el('applyConfirmation').disabled=true;el('applyOrderDelivery').checked=false;el('applyOrderDelivery').disabled=!Object.keys(preview.delivery||{}).length;el('confirmationPreview').hidden=false;el('manualOrderSave').disabled=true;
 }
 async function apply(){if(!preview||busy)return;busy=true;el('applyConfirmation').disabled=true;
  try{const result=await request('admin/orders/apply',{draft:preview.draft,confirmCustomer:el('confirmOrderCustomer').checked,applyDelivery:el('applyOrderDelivery').checked,comment:el('editOrderComment').value});dirty=false;await open(result.id);await load();el('adminOrderStatus').textContent='Վերջնական պատվերը կիրառված և հաստատված է։ Օգտատիրոջը կայքում հասանելի է ծանուցումը։';}
  finally{busy=false;el('applyConfirmation').disabled=!el('confirmOrderCustomer').checked;}
 }
 async function download(path,filename,body){const r=await ZZWS.request(path,body?{method:'POST',body:JSON.stringify(body)}:{});if(!r.ok)throw new Error('Չհաջողվեց ներբեռնել ֆայլը');const url=URL.createObjectURL(await r.blob()),a=node('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function reset(){if(timer)clearInterval(timer);timer=null;list=[];selected=null;manualRows=[];preview=null;dirty=false;el('adminOrderList').replaceChildren();el('adminOrderEditor').hidden=true;}
 function start(){if(timer)clearInterval(timer);timer=setInterval(()=>{if(!document.hidden&&!el('orders').hidden&&el('adminOrderEditor').hidden)run(load);},15000);}
 el('refreshAdminOrders').onclick=()=>run(load);el('orderStatusFilter').onchange=()=>run(load);el('orderSearch').oninput=renderList;el('moreAdminOrders').onclick=()=>run(()=>load(true));el('manualOrderSave').onclick=()=>run(saveManual);
 el('editOrderStatus').onchange=()=>{dirty=true;};el('editOrderComment').oninput=()=>{dirty=true;};el('previewFinalFile').onclick=()=>run(()=>makePreview('file'));el('previewFinalPaste').onclick=()=>run(()=>makePreview('paste'));
 el('confirmOrderCustomer').onchange=()=>{el('applyConfirmation').disabled=!el('confirmOrderCustomer').checked;};el('applyConfirmation').onclick=()=>run(apply);el('cancelConfirmation').onclick=()=>{preview=null;el('confirmationPreview').hidden=true;el('manualOrderSave').disabled=false;};
 el('closeAdminOrder').onclick=()=>{if(!dirty||confirm('Փակե՞լ առանց ձեռքով փոփոխությունները պահպանելու։')){dirty=false;el('adminOrderEditor').hidden=true;}};
 el('downloadFinalTemplate').onclick=()=>run(()=>download('admin/orders/template','Final-order-template.xlsx'));el('exportServerOrder').onclick=()=>run(()=>download('admin/orders/export','Order-'+selected.number+'.xlsx',{id:selected.id}));
 window.ZZWS_ADMIN_ORDERS={load,start,reset};
})();
