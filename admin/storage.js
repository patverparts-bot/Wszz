(() => {
 const labels={cart:'Текущая корзина',savedCarts:'Сохранённые корзины',favorites:'Избранное',history:'История заказов',filters:'Фильтры и сортировка',preferences:'Настройки вида',draft:'Данные доставки'};
 let report=null,working=false;
 const el=id=>document.getElementById(id);
 function bytes(n){n=Number(n)||0;if(n<1024)return n+' Б';if(n<1048576)return (n/1024).toLocaleString('ru-RU',{maximumFractionDigits:2})+' КиБ';return (n/1048576).toLocaleString('ru-RU',{maximumFractionDigits:2})+' МиБ';}
 const total=user=>Object.values(user.sections).reduce((sum,s)=>sum+Number(s.bytes||0),Number(user.accountBytes||0));
 function node(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
 function action(text,fn,cls=''){const b=node('button',text,cls);b.type='button';b.disabled=working;b.onclick=()=>fn().catch(e=>{el('storageStatus').textContent=e.message;});return b;}
 async function load(){
  el('storageStatus').textContent='Измеряю объём данных…';
  try{report=await ZZWS.json('admin/storage');render();el('storageStatus').textContent='Измерено '+new Date(report.measuredAt).toLocaleString('ru-RU',{timeZone:'Asia/Yerevan'});}
  catch(e){el('storageStatus').textContent=e.message;throw e;}
 }
 function render(){
  if(!report)return;
  const summary=el('storageSummary');summary.replaceChildren();
  for(const [label,value,description] of [
   ['Всего данных проекта',Number(report.databaseBytes)+Number(report.storageBytes),'База PostgreSQL + файлы Storage'],
   ['База PostgreSQL',report.databaseBytes,'С данными, индексами и выделенными страницами'],
   ['Пользовательские таблицы',report.userTablesBytes,'Аккаунты, сессии, память и корзины, включая Auth'],
   ['Система и каталог',report.systemDatabaseBytes,'Остальная часть базы, включая прайсы и журнал'],
   ['Файлы Storage',report.storageBytes,report.storageObjects+' объектов'],
   ['Содержимое пользователей',report.users.reduce((n,u)=>n+total(u),0),'JSON и профиль, без индексов и служебного места']
  ]){const card=node('div',null,'storage-metric');card.append(node('span',label),node('strong',bytes(value)),node('small',description));summary.append(card);}
  renderUsers();
 }
 function renderUsers(){
  if(!report)return;
  const root=el('storageUsers'),q=el('storageSearch').value.trim().toLocaleLowerCase('ru');root.replaceChildren();
  const people=report.users.filter(u=>[u.login,u.client].join(' ').toLocaleLowerCase('ru').includes(q)).sort((a,b)=>total(b)-total(a));
  el('storageUserCount').textContent='Пользователей: '+people.length;
  if(!people.length){root.append(node('p','Пользователи не найдены'));return;}
  for(const user of people){
   const card=node('article',null,'storage-user'),heading=node('div',null,'storage-user-heading'),identity=node('div');
   identity.append(node('h2',user.client||user.login),node('p',user.login+' · '+(user.active?'Доступ включён':'Доступ выключен')+' · активных сессий: '+user.sessions));
   const summary=node('div',null,'storage-user-total');summary.append(node('strong',bytes(total(user))),action('Очистить все данные',()=>clear(user,'all'),'storage-danger'));
   heading.append(identity,summary);card.append(heading);
   const table=node('table'),thead=table.createTHead().insertRow();for(const name of ['Раздел','Объём','Записей',''])thead.append(node('th',name));
   const body=table.createTBody();
   for(const [key,label] of Object.entries(labels)){const section=user.sections[key]||{bytes:0,count:0},row=body.insertRow();row.insertCell().textContent=label;const size=row.insertCell();size.textContent=bytes(section.bytes);size.title=Number(section.bytes).toLocaleString('ru-RU')+' байт';row.insertCell().textContent=section.count;const b=action('Очистить',()=>clear(user,key),'storage-clear');b.disabled=working||!section.bytes;row.insertCell().append(b);}
   for(const [key,label] of [['orders','Заказы на сервере'],['orderNotifications','История изменений заказов']]){const section=user.sections[key]||{bytes:0,count:0},row=body.insertRow();row.insertCell().textContent=label;row.insertCell().textContent=bytes(section.bytes);row.insertCell().textContent=section.count;row.insertCell().textContent='Учётные записи заказов сохраняются';}
   const row=body.insertRow();row.insertCell().textContent='Профиль и права доступа';row.insertCell().textContent=bytes(user.accountBytes);row.insertCell().textContent='1';row.insertCell().textContent='Сохраняются при очистке';
   const wrap=node('div',null,'storage-user-table');wrap.append(table);
   const details=node('details',null,'storage-user-details');details.open=!!q||Object.values(user.sections).some(s=>s.bytes>0);details.append(node('summary','Данные по разделам'),wrap);card.append(details);root.append(card);
  }
 }
 async function clear(user,section){
  const name=section==='all'?'все рабочие данные (включая сохранённые корзины)':labels[section].toLocaleLowerCase('ru');
  if(!confirm('Очистить '+name+' пользователя «'+user.login+'»? Действие необратимо. Профиль, пароль, права доступа и отправленные заказы сохранятся.'))return;
  working=true;renderUsers();el('storageRefresh').disabled=true;
  try{await ZZWS.json('admin/storage/clear',{method:'POST',body:JSON.stringify({targetId:user.id,section,revision:user.revision,confirm:true})});await load();el('storageStatus').textContent='Данные очищены: '+user.login+'. Размеры обновлены.';}
  finally{working=false;el('storageRefresh').disabled=false;renderUsers();}
 }
 document.getElementById('storageRefresh').onclick=()=>load().catch(()=>{});document.getElementById('storageSearch').oninput=renderUsers;
 window.ZZWS_STORAGE={load,reset:()=>{report=null;el('storageSummary').replaceChildren();el('storageUsers').replaceChildren();},bytes};
})();
