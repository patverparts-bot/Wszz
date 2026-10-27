const el = id => document.getElementById(id);
let draft = null, userDraft = null, users = [];
let catalogPairs=[],userAccessEditor=null,groupEditors={},groupRevision=null;
let editingUserId=null,auditEntries=[];
function status(message, error = false) { el('status').textContent = message; el('status').className = error ? 'error' : ''; }
async function api(path, options = {}) {
  try { return await ZZWS.json(path, options); }
  catch(e) { if(e.status === 401) showLogin(); throw e; }
}
function showLogin() {
  window.ZZWS_STORAGE?.reset();
  el('workspace').hidden=true;el('login').hidden=false;el('logout').hidden=true;draft=null;userDraft=null;
  users=[];catalogPairs=[];groupEditors={};groupRevision=null;userAccessEditor=null;editingUserId=null;auditEntries=[];
  for(const id of ['userList','groupRulesEditors','events','userAccessEditor','userAccessPreview','groupRulesPreview','sample','usersChanges','versions'])el(id).replaceChildren();
  el('preview').hidden=true;el('usersPreview').hidden=true;el('userForm').reset();
}
function table(headers, rows) {
  const table = document.createElement('table'), head = table.createTHead().insertRow();
  headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; head.append(th); });
  const body = table.createTBody();
  rows.forEach(row => { const tr = body.insertRow(); row.forEach(v => { const td = tr.insertCell(); if (v instanceof Node) td.append(v); else td.textContent = String(v ?? ''); }); });
  return table;
}
function button(label, callback) { const b = document.createElement('button'); b.type='button'; b.textContent = label; b.onclick = () => run(callback); return b; }
async function run(fn) { try { await fn(); } catch(e) { status(e.message, true); } }
async function enter() {
  let user = await api('me');
  if(user.needsPasswordSetup){user=await requirePasswordSetup(user);if(!user){showLogin();return;}}
  if (user.role !== 'admin') { showLogin();throw new Error('Нужна учётная запись администратора'); }
  el('login').hidden = true; el('workspace').hidden = false; el('logout').hidden = false;
  catalogPairs=(await api('admin/catalog-options')).pairs;
  await Promise.all([loadVersions(), loadUsers(),loadGroupRules()]); status('Вы вошли как ' + user.client);
}
el('loginForm').onsubmit = e => { e.preventDefault(); run(async () => { await api('login', {method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))}); e.target.reset(); await enter(); }); };
el('logout').onclick = () => run(async () => { await api('logout',{method:'POST'}); showLogin(); status('Вы вышли'); });
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => run(async () => {
  for (const name of ['price','users','rules','audit','storage']) el(name).hidden = name !== b.dataset.tab;
  if (b.dataset.tab === 'audit') await loadAudit();
  if (b.dataset.tab === 'storage') await ZZWS_STORAGE.load();
}));
el('priceForm').onsubmit = e => { e.preventDefault(); run(async () => {
  draft = null; el('preview').hidden = true; status('Проверяю файл…');
  const d = await api('admin/price/preview',{method:'POST',body:new FormData(e.target)});
  draft = d.draft; el('summary').textContent = `Проверено товаров: ${d.count}. Первые пять строк:`;
  el('sample').replaceChildren(table(['Артикул','Бренд','Название','WS','KP'],d.sample.map(p => [p.articul,p.brand,p.name,p.ws,p.kpPromo||p.kp])));
  el('preview').hidden = false; status('Файл прошёл проверку. Действующий прайс ещё не изменён.');
}); };
el('publish').onclick = () => run(async () => { if (!draft) return; el('publish').disabled = true; try {
  await api('admin/price/publish',{method:'POST',body:JSON.stringify({draft})}); draft = null; el('preview').hidden = true;
  await loadVersions(); status('Новый прайс опубликован');
} finally { el('publish').disabled = false; } });
async function loadVersions() {
  const d = await api('admin/price/versions');
  el('versions').replaceChildren(table(['Дата','Версия','Действие'],d.versions.map(v => [new Date(v.created*1000).toLocaleString(),v.id,
    v.id === d.active ? 'Действующая' : button('Восстановить', async () => { if (!confirm('Вернуть эту версию прайса?')) return; await api('admin/price/rollback',{method:'POST',body:JSON.stringify({version:v.id})}); await loadVersions(); status('Версия восстановлена'); })])));
}
async function loadUsers() {
  const d = await api('admin/users'); users = d.users;
  el('userList').replaceChildren(table(['Логин','Клиент','Роль','Цены','Доступ',''], users.map(u => [u.login,u.client,u.role==='admin'?'Администратор':'Клиент',u.sheet,u.active?'Включён':'Выключен',button('Изменить', () => editUser(u))])));
}
function editUser(user = {}) {
  const f = el('userForm'); f.reset(); f.hidden = false;
  editingUserId=user.id||null;f.elements.id.value=editingUserId||'';
  el('userTitle').textContent=editingUserId?'Изменение пользователя: '+user.login:'Новый пользователь';
  for (const key of ['login','client','role','sheet']) if (user[key]) f.elements[key].value = user[key];
  for (const key of ['active','allowResale']) f.elements[key].checked = key === 'active' ? user.active !== false : !!user[key];
  userAccessEditor=ZZWS_RULES_UI.accessEditor(el('userAccessEditor'),ZZWS_RULES_UI.legacyAccess({...user,sheet:user.sheet||'Dealers'}),catalogPairs);
  el('userAccessPreview').replaceChildren();
  for(let i=1;i<=3;i++){
    const row=(user.rowsList||[])[i-1]||{},suffix=i===1?'':String(i);
    for(const key of ['organization','address','contact'])f.elements[key+suffix].value=row[key]||'';
  }
  f.elements.password.required = false;
  f.elements.password.disabled=!user.id||user.needsPasswordSetup;
  f.elements.password.placeholder=!user.id||user.needsPasswordSetup?'Пользователь задаст пароль при первом входе':'Оставьте пустым, чтобы сохранить текущий';
  el('resetUserPassword').hidden=!user.id;
  el('passwordSetupState').textContent=!user.id||user.needsPasswordSetup?'Первый вход: только логин, затем установка своего пароля.':'Пароль уже установлен пользователем.';
  f.scrollIntoView({behavior:'smooth'});
}
el('resetUserPassword').onclick=()=>run(async()=>{
  if(!editingUserId)return;
  const target=users.find(u=>u.id===editingUserId);
  if(!confirm('Сбросить пароль '+target.login+'? Все его сессии завершатся. Следующий вход — только по логину с обязательной установкой нового пароля. До настройки любой знающий логин сможет задать пароль.'))return;
  await api('admin/users/reset-password',{method:'POST',body:JSON.stringify({id:editingUserId})});
  await loadUsers();editUser(users.find(u=>u.id===editingUserId));status('Пароль сброшен. Пользователь должен сразу войти по логину и установить новый пароль.');
});
el('newUser').onclick = () => editUser(); el('cancelUser').onclick = () => { el('userForm').hidden = true; };
el('usersImportForm').onsubmit = e => { e.preventDefault(); run(async () => {
  userDraft = null; el('usersPreview').hidden = true;
  const d = await api('admin/users/preview',{method:'POST',body:new FormData(e.target)});
  userDraft = d.draft;
  el('usersChanges').replaceChildren(table(['Логин','Клиент','Изменение'],d.users.map(u=>[u.login,u.client,u.action==='create'?'Создать с выключенным доступом':'Обновить данные и отозвать сессии'])));
  el('usersPreview').hidden = false; status('Проверьте изменения перед применением');
}); };
el('importUsers').onclick = () => run(async () => { if (!userDraft) return; el('importUsers').disabled=true; try {
  await api('admin/users/import',{method:'POST',body:JSON.stringify({draft:userDraft})}); userDraft=null;
  el('usersPreview').hidden=true; await loadUsers(); status('Импорт завершён. Включите доступ новым пользователям: первый вход по логину с установкой своего пароля.');
} finally { el('importUsers').disabled=false; } });
function userPayload(){
  const f = el('userForm'), p = Object.fromEntries(new FormData(f));
  p.intent=editingUserId?'update':'create';
  if(editingUserId)p.id=editingUserId;else delete p.id;
  for (const key of ['active','allowResale']) p[key] = f.elements[key].checked;
  p.catalogAccess=userAccessEditor.read();
  const old = users.find(u=>u.id===p.id);
  p.brands=old?.brands||[];p.allBrands=old?.allBrands??p.sheet==='Dealers';
  p.rowsList=[1,2,3].map(i=>{const suffix=i===1?'':String(i);return {organization:p['organization'+suffix].trim(),address:p['address'+suffix].trim(),contact:p['contact'+suffix].trim()};}).filter(row=>Object.values(row).some(Boolean));
  for(let i=1;i<=3;i++)for(const key of ['organization','address','contact'])delete p[key+(i===1?'':String(i))];
  return p;
}
el('userForm').elements.sheet.onchange=()=>{
  const f=el('userForm');
  if(!f.elements.id.value)userAccessEditor.reset(ZZWS_RULES_UI.legacyAccess({sheet:f.elements.sheet.value,allBrands:false,brands:[]}));
  el('userAccessPreview').replaceChildren();
};
function showProductPreview(root,data){
  const summary=document.createElement('p');summary.className='preview-count';summary.textContent=`Доступно товаров: ${data.count}`+(data.adminBypass?' (администратор: ограничения не применяются)':'');
  root.replaceChildren(summary,table(['Бренд','Категория','Товар','Цена клиента'],data.sample.map(p=>[p.brand,p.category,p.name,p.wholesale])));
}
el('previewUserAccess').onclick=()=>run(async()=>{
  const p=userPayload();delete p.password;
  const data=await api('admin/access/preview',{method:'POST',body:JSON.stringify(p)});showProductPreview(el('userAccessPreview'),data);
});
el('userForm').onsubmit = e => { e.preventDefault(); run(async () => {
  const p=userPayload();
  await api('admin/users',{method:'POST',body:JSON.stringify(p)}); e.target.reset(); e.target.hidden = true;
  await loadUsers(); status('Пользователь сохранён. Его прежние сессии отозваны.');
}); };
async function loadAudit(){
  await loadUsers();
  const [data,versions]=await Promise.all([api('admin/audit'),api('admin/price/versions')]);
  auditEntries=ZZWS_AUDIT.describe(data.events,users,versions.versions);renderAudit();
}
function renderAudit(){
  const search=el('auditSearch').value.trim().toLocaleLowerCase('ru'),group=el('auditGroup').value;
  const entries=auditEntries.filter(e=>(!group||e.group===group)&&(!search||[e.actor,e.action,e.description].join(' ').toLocaleLowerCase('ru').includes(search)));
  el('auditCount').textContent=`Показано событий: ${entries.length} из ${auditEntries.length}`;
  if(!entries.length){const empty=document.createElement('p');empty.textContent='По выбранным условиям событий нет.';el('events').replaceChildren(empty);return;}
  el('events').replaceChildren(table(['Когда · Ереван','Кто','Что сделал','Подробности'],entries.map(e=>{
    const details=document.createElement('div'),text=document.createElement('p');text.textContent=e.description;details.append(text);
    const disclosure=document.createElement('details'),title=document.createElement('summary'),code=document.createElement('pre');
    title.textContent='Технические сведения';code.textContent=JSON.stringify(e.raw,null,2);disclosure.append(title,code);details.append(disclosure);
    return [e.time,e.actor,e.action,details];
  })));
}
el('refreshAudit').onclick=()=>run(loadAudit);el('auditSearch').oninput=renderAudit;el('auditGroup').onchange=renderAudit;
async function loadGroupRules(){
  const data=await api('admin/rules');groupRevision=data.revision;groupEditors={};
  const container=el('groupRulesEditors');container.replaceChildren();el('groupRulesPreview').replaceChildren();
  for(const group of ['KP','Dealers']){
    const card=document.createElement('fieldset');card.dataset.groupRules=group;
    const title=document.createElement('legend');title.textContent=group;
    const priceTitle=document.createElement('h3');priceTitle.textContent='Выбор цены';
    const priceRoot=document.createElement('div'),accessRoot=document.createElement('div');
    const accessTitle=document.createElement('h3');accessTitle.textContent='Общий доступ группы';
    const pricing=ZZWS_RULES_UI.pricingEditor(priceRoot,data.rules[group].pricing);
    const access=ZZWS_RULES_UI.accessEditor(accessRoot,data.rules[group].access,catalogPairs);
    const reset=button('Восстановить стандарт '+group,()=>{
      pricing.reset(data.defaults[group].pricing);access.reset(data.defaults[group].access);el('groupRulesPreview').replaceChildren();status('Стандартные правила восстановлены в форме. Для применения нажмите «Сохранить правила групп».');
    });
    card.append(title,priceTitle,priceRoot,accessTitle,accessRoot,reset);container.append(card);groupEditors[group]={pricing,access};
  }
}
function groupPayload(){return Object.fromEntries(['KP','Dealers'].map(g=>[g,{pricing:groupEditors[g].pricing.read(),access:groupEditors[g].access.read()}]));}
el('previewGroupRules').onclick=()=>run(async()=>{
  const data=await api('admin/rules/preview',{method:'POST',body:JSON.stringify({rules:groupPayload()})});
  const root=el('groupRulesPreview');root.replaceChildren();
  for(const group of ['KP','Dealers']){const title=document.createElement('h3');title.textContent=group+' — без персональных ограничений';const box=document.createElement('div');showProductPreview(box,data.groups[group]);root.append(title,box);}
});
el('reloadGroupRules').onclick=()=>run(loadGroupRules);
el('groupRulesForm').onsubmit=e=>{e.preventDefault();run(async()=>{
  const submit=e.target.querySelector('[type=submit]');submit.disabled=true;
  try {
    const data=await api('admin/rules',{method:'POST',body:JSON.stringify({rules:groupPayload(),revision:groupRevision})});groupRevision=data.revision;
    status('Правила групп сохранены. Новые запросы используют их сразу; открытые каталоги обновятся при следующей проверке.');
  } finally { submit.disabled=false; }
});};
const setupToken = new URLSearchParams(location.hash.slice(1)).get('setup');
if (setupToken) {
  history.replaceState(null, '', location.pathname);
  el('login').hidden = true; el('setup').hidden = false;
} else {
  run(async () => { try { await enter(); } catch(e) { showLogin(); if (!e.message.includes('Войдите')) status(e.message,true); } });
}
el('setupForm').onsubmit = e => { e.preventDefault(); run(async () => {
  const p = Object.fromEntries(new FormData(e.target));
  if(p.password !== p.confirm) throw new Error('Пароли не совпадают');
  const button=e.target.querySelector('button'); button.disabled=true;
  try { await api('bootstrap',{method:'POST',body:JSON.stringify({...p,setupToken})});
    e.target.reset(); el('setup').hidden=true; showLogin(); status('Администратор создан. Войдите с выбранными логином и паролем.');
  } finally { button.disabled=false; }
}); };
el('userTemplate').onclick = () => run(async () => {
  const response=await ZZWS.request('admin/users/template'); if(!response.ok)throw new Error('Войдите как администратор');
  const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download='Users-template.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
