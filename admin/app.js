const el = id => document.getElementById(id);
let draft = null, userDraft = null, users = [];
function status(message, error = false) { el('status').textContent = message; el('status').className = error ? 'error' : ''; }
async function api(path, options = {}) {
  try { return await ZZWS.json(path, options); }
  catch(e) { if(e.status === 401) showLogin(); throw e; }
}
function showLogin() { el('workspace').hidden = true; el('login').hidden = false; el('logout').hidden = true; draft = null; userDraft = null; el('preview').hidden = true; el('usersPreview').hidden = true; el('userForm').reset(); }
function table(headers, rows) {
  const table = document.createElement('table'), head = table.createTHead().insertRow();
  headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; head.append(th); });
  const body = table.createTBody();
  rows.forEach(row => { const tr = body.insertRow(); row.forEach(v => { const td = tr.insertCell(); if (v instanceof Node) td.append(v); else td.textContent = String(v ?? ''); }); });
  return table;
}
function button(label, callback) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => run(callback); return b; }
async function run(fn) { try { await fn(); } catch(e) { status(e.message, true); } }
async function enter() {
  const user = await api('me');
  if (user.role !== 'admin') throw new Error('Нужна учётная запись администратора');
  el('login').hidden = true; el('workspace').hidden = false; el('logout').hidden = false;
  await Promise.all([loadVersions(), loadUsers()]); status('Вы вошли как ' + user.client);
}
el('loginForm').onsubmit = e => { e.preventDefault(); run(async () => { await api('login', {method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))}); e.target.reset(); await enter(); }); };
el('logout').onclick = () => run(async () => { await api('logout',{method:'POST'}); showLogin(); status('Вы вышли'); });
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => run(async () => {
  for (const name of ['price','users','audit']) el(name).hidden = name !== b.dataset.tab;
  if (b.dataset.tab === 'audit') { const d = await api('admin/audit'); el('events').replaceChildren(table(['Время','Пользователь','Действие','Объект'], d.events.map(r => [new Date(r.created*1000).toLocaleString(),r.actor,r.action,r.detail]))); }
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
  el('userList').replaceChildren(table(['Логин','Клиент','Цены','Доступ',''], users.map(u => [u.login,u.client,u.sheet,u.active?'Включён':'Заблокирован',button('Изменить', () => editUser(u))])));
}
function editUser(user = {}) {
  const f = el('userForm'); f.reset(); f.hidden = false;
  for (const key of ['id','login','client','role','sheet']) if (user[key]) f.elements[key].value = user[key];
  for (const key of ['active','allBrands','allowResale']) f.elements[key].checked = key === 'active' ? user.active !== false : !!user[key];
  f.elements.brands.value = (user.brands || []).join(', ');
  const row = (user.rowsList || [])[0] || {};
  for (const key of ['organization','address','contact']) f.elements[key].value = row[key] || '';
  f.elements.password.required = !user.id; f.scrollIntoView({behavior:'smooth'});
}
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
  el('usersPreview').hidden=true; await loadUsers(); status('Импорт завершён. Для новых пользователей задайте пароли и включите доступ.');
} finally { el('importUsers').disabled=false; } });
el('userForm').onsubmit = e => { e.preventDefault(); run(async () => {
  const f = e.target, p = Object.fromEntries(new FormData(f));
  for (const key of ['active','allBrands','allowResale']) p[key] = f.elements[key].checked;
  p.brands = p.brands.split(',').map(s=>s.trim()).filter(Boolean);
  // Preserve additional delivery addresses when editing the first address.
  const old = users.find(u=>u.id===p.id);
  p.rowsList = [{organization:p.organization||p.client,address:p.address,contact:p.contact},...(old?.rowsList||[]).slice(1)];
  for (const key of ['organization','address','contact']) delete p[key];
  await api('admin/users',{method:'POST',body:JSON.stringify(p)}); f.reset(); f.hidden = true;
  await loadUsers(); status('Пользователь сохранён. Его прежние сессии отозваны.');
}); };
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
