(() => {
 const labels={cart:'Ընթացիկ զամբյուղ',savedCarts:'Պահպանված զամբյուղներ',favorites:'Ընտրվածներ',history:'Պատվերների պատմություն',filters:'Ֆիլտրեր և սորտավորում',preferences:'Տեսքի կարգավորումներ',draft:'Առաքման տվյալներ'};
 let report=null,working=false;
 const el=id=>document.getElementById(id);
 function bytes(n){n=Number(n);if(!Number.isFinite(n)||n<0)n=0;const units=['B','KiB','MiB','GiB'],index=n<1024?0:Math.min(3,Math.floor(Math.log(n)/Math.log(1024)));return (n/1024**index).toLocaleString((window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM'),{maximumFractionDigits:2})+' '+units[index];}
 const total=user=>Object.values(user.sections).reduce((sum,s)=>sum+Number(s.bytes||0),Number(user.accountBytes||0));
 function node(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
 function action(text,fn,cls=''){const b=node('button',text,cls);b.type='button';b.disabled=working;b.onclick=()=>fn().catch(e=>{el('storageStatus').textContent=e.message;});return b;}
 async function load(){
  el('storageStatus').textContent='Տվյալների ծավալը չափվում է…';
  try{report=await ZZWS.json('admin/storage');render();el('storageStatus').textContent='Չափված է՝ '+new Date(report.measuredAt).toLocaleString((window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM'),{timeZone:'Asia/Yerevan'});}
  catch(e){el('storageStatus').textContent=e.message;throw e;}
 }
 function render(){
  if(!report)return;
  const summary=el('storageSummary');summary.replaceChildren();
  for(const [label,value,description] of [
   ['Նախագծի բոլոր տվյալները',Number(report.databaseBytes)+Number(report.storageBytes),'PostgreSQL բազա + Storage ֆայլեր'],
   ['PostgreSQL բազա',report.databaseBytes,'Տվյալներով, ինդեքսներով և հատկացված էջերով'],
   ['Օգտատերերի աղյուսակներ',report.userTablesBytes,'Հաշիվներ, աշխատաշրջաններ, հիշողություն և զամբյուղներ՝ ներառյալ Auth-ը'],
   ['Համակարգ և կատալոգ',report.systemDatabaseBytes,'Բազայի մնացած մասը՝ ներառյալ գնացուցակն ու մատյանը'],
   ['Storage ֆայլեր',report.storageBytes,report.storageObjects+' օբյեկտ'],
   ['Օգտատերերի բովանդակություն',report.users.reduce((n,u)=>n+total(u),0),'JSON և պրոֆիլ՝ առանց ինդեքսների և ծառայողական տարածքի']
  ]){const card=node('div',null,'storage-metric');card.append(node('span',label),node('strong',bytes(value)),node('small',description));summary.append(card);}
  renderUsers();
 }
 function renderUsers(){
  if(!report)return;
  const root=el('storageUsers'),q=el('storageSearch').value.trim().toLocaleLowerCase('ru');root.replaceChildren();
  const people=report.users.filter(u=>[u.login,u.client].join(' ').toLocaleLowerCase('ru').includes(q)).sort((a,b)=>total(b)-total(a));
  el('storageUserCount').textContent='Օգտատերեր՝ '+people.length;
  if(!people.length){root.append(node('p','Օգտատերեր չեն գտնվել'));return;}
  for(const user of people){
   const card=node('article',null,'storage-user'),heading=node('div',null,'storage-user-heading'),identity=node('div');
   identity.append(node('h2',user.client||user.login),node('p',user.login+' · '+(user.active?'Հասանելիությունը միացված է':'Հասանելիությունն անջատված է')+' · ակտիվ աշխատաշրջաններ՝ '+user.sessions));
   const summary=node('div',null,'storage-user-total');summary.append(node('strong',bytes(total(user))),action('Մաքրել բոլոր տվյալները',()=>clear(user,'all'),'storage-danger'));
   heading.append(identity,summary);card.append(heading);
   const table=node('table'),thead=table.createTHead().insertRow();for(const name of ['Բաժին','Ծավալ','Գրառումներ',''])thead.append(node('th',name));
   const body=table.createTBody();
   for(const [key,label] of Object.entries(labels)){const section=user.sections[key]||{bytes:0,count:0},row=body.insertRow();row.insertCell().textContent=label;const size=row.insertCell();size.textContent=bytes(section.bytes);size.title=Number(section.bytes).toLocaleString((window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM'))+' բայթ';row.insertCell().textContent=section.count;const b=action('Մաքրել',()=>clear(user,key),'storage-clear');b.disabled=working||!section.bytes;row.insertCell().append(b);}
   for(const [key,label] of [['orders','Սերվերի պատվերներ'],['orderNotifications','Պատվերների փոփոխությունների պատմություն']]){const section=user.sections[key]||{bytes:0,count:0},row=body.insertRow();row.insertCell().textContent=label;row.insertCell().textContent=bytes(section.bytes);row.insertCell().textContent=section.count;row.insertCell().textContent='Պատվերների գրառումները պահպանվում են';}
   const row=body.insertRow();row.insertCell().textContent='Պրոֆիլ և հասանելիության իրավունքներ';row.insertCell().textContent=bytes(user.accountBytes);row.insertCell().textContent='1';row.insertCell().textContent='Պահպանվում են մաքրման ժամանակ';
   const wrap=node('div',null,'storage-user-table');wrap.append(table);
   const details=node('details',null,'storage-user-details');details.open=!!q||Object.values(user.sections).some(s=>s.bytes>0);details.append(node('summary','Տվյալներ ըստ բաժինների'),wrap);card.append(details);root.append(card);
  }
 }
 async function clear(user,section){
  const name=section==='all'?'բոլոր աշխատանքային տվյալները՝ ներառյալ պահպանված զամբյուղները':labels[section].toLocaleLowerCase('ru');
  if(!confirm('Մաքրել '+name+' օգտատիրոջ՝ «'+user.login+'»։ Գործողությունն անշրջելի է։ Պրոֆիլը, գաղտնաբառը, հասանելիության իրավունքներն ու ուղարկված պատվերները կպահպանվեն։'))return;
  working=true;renderUsers();el('storageRefresh').disabled=true;
  try{await ZZWS.json('admin/storage/clear',{method:'POST',body:JSON.stringify({targetId:user.id,section,revision:user.revision,confirm:true})});await load();el('storageStatus').textContent='Տվյալները մաքրված են՝ '+user.login+'։ Չափերը թարմացված են։';}
  finally{working=false;el('storageRefresh').disabled=false;renderUsers();}
 }
 document.getElementById('storageRefresh').onclick=()=>load().catch(()=>{});document.getElementById('storageSearch').oninput=renderUsers;
 window.ZZWS_STORAGE={load,reset:()=>{report=null;el('storageSummary').replaceChildren();el('storageUsers').replaceChildren();},bytes};
})();
