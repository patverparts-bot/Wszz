(() => {
 const el=id=>document.getElementById(id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const money=n=>Number(n||0).toLocaleString('hy-AM')+' ֏',write=()=>document.documentElement.dataset.orderWrite==='true';
 let epoch=0,searchEpoch=0,lifecycle=0,customers=[],templates=[],customer=null,editing=null,lines=[],dirty=false,busy=false,requestId=null;
 const action=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=()=>safe(fn);return b;};
 async function safe(fn){const generation=lifecycle;try{await fn();}catch(e){if(generation!==lifecycle)return;if(e.status===401){showLogin();return;}el('templateStatus').textContent=ZZWS.message(e);}}
 const request=(path,data)=>ZZWS.json(path,{method:'POST',body:JSON.stringify(data)});
 function abandon(){return !dirty||confirm('Չեղարկե՞լ զամբյուղի չպահպանված փոփոխությունները։');}
 function close(){editing=null;lines=[];dirty=false;requestId=null;++searchEpoch;el('templateEditor').hidden=true;el('templateProductResults').replaceChildren();}
 function changed(){dirty=true;requestId=crypto.randomUUID();}
 function render(){
  const root=el('templateList');root.replaceChildren();el('templateNew').hidden=!write();el('templateNew').disabled=busy||!customer?.active;el('templateCount').textContent=templates.length+' / 10 զամբյուղ';
  for(const saved of templates){const card=node('article',null,'admin-template-card'),heading=node('div',null,'template-card-heading');heading.append(node('h2',saved.title),node('small',new Date(saved.saved_at).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan'})));card.append(heading);
   const table=node('table'),head=table.createTHead().insertRow();for(const h of ['Մոդել','Քանակ','Ընթացիկ գին'])head.append(node('th',h));
   for(const row of saved.rows){const tr=table.insertRow();tr.insertCell().append(node('strong',row.name),node('small',row.articul));tr.insertCell().textContent=row.qty;tr.insertCell().textContent=row.available?money(row.price):'Հասանելի չէ';}
   const wrap=node('div',null,'order-lines-scroll');wrap.append(table);card.append(wrap,node('p','Ընթացիկ հասանելի գումար՝ '+money(saved.rows.reduce((n,r)=>n+(r.available?r.qty*r.price:0),0)),'help'));
   if(write()){
    card.append(action('Խմբագրել',()=>edit(saved)),action('Պատճենել',()=>edit({...saved,id:null,title:saved.title+' · պատճեն'})));
    const context=window.ZZWS_ADMIN_ORDERS.context();if(context?.user_id===customer?.id&&!context.received_at&&context.status!=='received')card.append(action('Ավելացնել բացված պատվերին',()=>ZZWS_ADMIN_ORDERS.previewTemplate(saved.id)));
    const remove=action('Ջնջել',async()=>{if(busy||!abandon()||!confirm('Ջնջե՞լ «'+saved.title+'» պահպանված զամբյուղը հաճախորդի հաշվից։'))return;const target=customer.id,ticket=epoch,generation=lifecycle;busy=true;render();try{await request('admin/templates/delete',{userId:target,id:saved.id,savedAt:saved.saved_at});if(ticket!==epoch)return;close();await load(target);}finally{if(generation===lifecycle){busy=false;render();}}});remove.className='storage-danger';card.append(remove);
   }
   root.append(card);
  }
  if(!templates.length)root.append(node('p','Այս հաճախորդը դեռ պահպանված զամբյուղներ չունի։','help'));
  for(const b of root.querySelectorAll('button'))b.disabled=busy;
 }
 async function load(userId=el('templateCustomer').value){
  if(dirty)return;
  const ticket=++epoch;++searchEpoch;customer=null;templates=[];el('templateList').replaceChildren();el('templateCount').textContent='';el('templateNew').disabled=true;el('templateStatus').textContent='Տվյալները բեռնվում են…';
  if(!customers.length){const data=await ZZWS.json('admin/templates/customers');if(ticket!==epoch)return;customers=data.customers;const select=el('templateCustomer');select.replaceChildren(node('option','Ընտրեք հաճախորդին'));select.firstChild.value='';for(const row of customers){const option=node('option',row.client+' · '+row.login+(row.active?'':' · անջատված'));option.value=row.id;select.append(option);}}
  if(!userId){el('templateStatus').textContent='Ընտրեք հաճախորդին՝ նրա պահպանված զամբյուղներն ու պահպանված զամբյուղները կառավարելու համար։';return;}
  el('templateCustomer').value=userId;
  const data=await ZZWS.json('admin/templates?userId='+encodeURIComponent(userId));if(ticket!==epoch)return;customer=data.customer;templates=data.templates;render();el('templateStatus').textContent=customer.client+' · Փոփոխությունները հասանելի կլինեն հաճախորդի պահպանված զամբյուղներում։';
 }
 async function openCustomer(id){if(busy||!abandon())return;const generation=lifecycle;close();el('templateCustomer').value=id;await selectAdminTab('templates');if(generation!==lifecycle)return;if(customer?.id!==id)await load(id);}
 function edit(saved=null){
  if(busy||!write()||!abandon())return;close();editing=saved?.id?saved:null;requestId=crypto.randomUUID();lines=(saved?.rows||[]).map(r=>({...r}));el('templateTitle').value=(saved?.title||'').slice(0,80);el('templateEditor').hidden=false;el('templateEditorTitle').textContent=editing?'Խմբագրել պահպանված զամբյուղը':'Նոր զամբյուղ';renderLines();el('templateEditor').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function renderLines(){
  const root=el('templateEditLines');root.replaceChildren();
  for(const row of lines){const item=node('div',null,'template-edit-row'),name=node('div');name.append(node('strong',row.name),node('small',row.articul+' · '+(row.available?money(row.price):'Հասանելի չէ՝ հեռացրեք կամ փոխարինեք')));const qty=node('input');qty.type='number';qty.min='1';qty.max='9999';qty.value=row.qty;qty.setAttribute('aria-label','Քանակ '+row.articul);qty.oninput=()=>{row.qty=Number(qty.value);changed();};item.append(name,qty,action('Հեռացնել',()=>{if(busy)return;lines=lines.filter(r=>r!==row);changed();renderLines();}));root.append(item);}
 }
 el('templateCustomer').onchange=()=>safe(async()=>{if(busy||!abandon()){el('templateCustomer').value=customer?.id||'';return;}close();await load();});
 el('templateRefresh').onclick=()=>safe(async()=>{if(!busy&&abandon()){close();await load();}});el('templateNew').onclick=()=>edit();el('templateCancel').onclick=()=>{if(!busy&&abandon())close();};el('templateTitle').oninput=changed;
 el('templateProductSearchForm').onsubmit=e=>{e.preventDefault();safe(async()=>{const ticket=++searchEpoch,target=customer?.id;if(!target||busy)return;const data=await ZZWS.json('admin/templates/catalog?userId='+encodeURIComponent(target)+'&search='+encodeURIComponent(el('templateProductSearch').value));if(ticket!==searchEpoch||target!==customer?.id||el('templateEditor').hidden)return;const root=el('templateProductResults');root.replaceChildren();for(const p of data.products)root.append(action(p.articul+' · '+p.name+' · '+money(p.price),()=>{if(busy)return;const old=lines.find(r=>r.articul===p.articul);if(old)old.qty=Math.min(9999,old.qty+1);else lines.push({...p,qty:1,available:true});changed();renderLines();}));if(!data.products.length)root.append(node('p','Հասանելի ապրանք չի գտնվել։'));});};
 el('templateSaveForm').onsubmit=e=>{e.preventDefault();safe(async()=>{
  if(busy||!customer||!write())return;
  if(!lines.length||lines.some(r=>!r.available||!Number.isInteger(r.qty)||r.qty<1||r.qty>9999))throw Error('Ստուգեք քանակները և հեռացրեք անհասանելի դիրքերը։');
  if(!confirm('Պահպանե՞լ պահպանված զամբյուղը «'+customer.client+'» հաճախորդի հաշվին։'))return;
  const target=customer.id,ticket=epoch,generation=lifecycle,payload={userId:target,id:editing?.id||null,savedAt:editing?.saved_at,title:el('templateTitle').value,lines:lines.map(r=>({articul:r.articul,qty:r.qty})),requestId};busy=true;el('templateSave').disabled=true;for(const field of el('templateEditor').querySelectorAll('input,button'))field.disabled=true;render();
  try{await request('admin/templates/save',payload);if(ticket!==epoch)return;close();await load(target);el('templateStatus').textContent='Պահպանված զամբյուղը պահպանված է հաճախորդի հաշվին։';}
  finally{if(generation===lifecycle){busy=false;for(const field of el('templateEditor').querySelectorAll('input,button'))field.disabled=false;render();}}
 });};
 function reset(){++lifecycle;++epoch;++searchEpoch;customers=[];customer=null;templates=[];busy=false;close();el('templateCustomer').replaceChildren();el('templateList').replaceChildren();el('templateEditLines').replaceChildren();el('templateTitle').value='';el('templateProductSearch').value='';for(const field of el('templateEditor').querySelectorAll('input,button'))field.disabled=false;el('templateStatus').textContent='';}
 window.ZZWS_ADMIN_TEMPLATES={load,openCustomer,reset};
})();
