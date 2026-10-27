const el = id => document.getElementById(id);
function finishSessionLoading(){document.documentElement.removeAttribute('data-session-pending');}
function sessionLoadFailed(message){document.documentElement.setAttribute('data-session-pending','true');el('sessionLoadingText').textContent=message||'Չհաջողվեց թարմացնել տվյալները։ Ստուգեք կապը։';el('sessionSpinner').hidden=true;el('sessionRetryActions').hidden=false;}
let draft = null, userDraft = null, users = [];
let catalogPairs=[],userAccessEditor=null,groupEditors={},groupRevision=null;
let editingUserId=null,auditEntries=[];
function status(message, error = false) { el('status').textContent = message; el('status').className = error ? 'error' : ''; }
async function api(path, options = {}) {
  try { return await ZZWS.json(path, options); }
  catch(e) { if(e.status === 401) showLogin(); throw e; }
}
function showLogin() {
  finishSessionLoading();
  window.ZZWS_STORAGE?.reset();
  window.ZZWS_ADMIN_ORDERS?.reset();
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
async function run(fn) { try { await fn(); } catch(e) { status(ZZWS.message(e), true); } }
const adminTabs=['dashboard','orders','price','users','rules','audit','storage'];
function rememberedAdminTab(){
  const linked=new URLSearchParams(location.hash.slice(1)).get('tab');if(adminTabs.includes(linked))return linked;
  try{const saved=sessionStorage.getItem('zzws_admin_tab_v1');if(adminTabs.includes(saved))return saved;}catch{}
  return 'dashboard';
}
async function selectAdminTab(name){
  if(!adminTabs.includes(name)||!ZZWS_ADMIN_HOME.can(name))name='dashboard';
  for(const section of adminTabs)el(section).hidden=section!==name;
  document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('admin-tab-active',b.dataset.tab===name);b.setAttribute('aria-current',b.dataset.tab===name?'page':'false');});
  try{sessionStorage.setItem('zzws_admin_tab_v1',name);}catch{}
  history.replaceState(null,'',location.pathname+location.search+'#tab='+name);
  if(name==='dashboard')await ZZWS_ADMIN_HOME.load();
  if(name==='audit')await loadAudit();
  if(name==='storage')await ZZWS_STORAGE.load();
  if(name==='orders')await ZZWS_ADMIN_ORDERS.load();
}
async function enter() {
  let user = await api('me');
  if(user.needsPasswordSetup){user=await requirePasswordSetup(user);if(!user){showLogin();return;}}
  if (user.role !== 'admin') { showLogin();const e=new Error('Անհրաժեշտ է ադմինիստրատորի հաշիվ');e.status=403;throw e; }
  ZZWS_ADMIN_HOME.setUser(user);
  const activeTab=rememberedAdminTab();for(const section of adminTabs)el(section).hidden=section!==activeTab;
  el('login').hidden = true; el('workspace').hidden = false; el('logout').hidden = false;
  catalogPairs=(await api('admin/catalog-options')).pairs;
  ZZWS_ADMIN_ORDERS.start();
  const permissions=user.permissions||['price:read','users','rules'];await Promise.all([...(permissions.includes('price:read')?[loadVersions()]:[]),...(permissions.includes('users')?[loadUsers()]:[]),...(permissions.includes('rules')?[loadGroupRules()]:[])]);await selectAdminTab(activeTab);finishSessionLoading(); status('Մուտք եք գործել որպես ' + user.client);
}
el('loginForm').onsubmit = e => { e.preventDefault(); run(async () => { await completeSecureLogin(await api('login', {method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))})); e.target.reset(); await enter(); }); };
el('logout').onclick = () => run(async () => { await api('logout',{method:'POST'}); showLogin(); status('Դուք դուրս եք եկել'); });
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => run(()=>selectAdminTab(b.dataset.tab)));
el('priceForm').onsubmit = e => { e.preventDefault(); run(async () => {
  draft = null; el('preview').hidden = true; status('Ֆայլը ստուգվում է…');
  const d = await api('admin/price/preview',{method:'POST',body:new FormData(e.target)});
  draft = d.draft;const difference=d.difference;el('priceDifference').textContent=difference?'Ավելացված՝ '+difference.added+' · հեռացված՝ '+difference.removed+' · գինը փոխված՝ '+difference.changed+' · անփոփոխ՝ '+difference.unchanged:'';el('priceWarnings').replaceChildren(...(difference?.warnings||[]).map(w=>{const p=document.createElement('p');p.textContent=w.articul+' · '+w.name+' · '+({ws:'Մեծածախ գին',kp:'KP գին',kpPromo:'KP ակցիոն գին',retail:'Զեղչված մանրածախ գին',base:'Հիմնական մանրածախ գին'}[w.source]||'Գին')+': '+w.before+' → '+w.after+' ('+w.percent+'%)';return p;})); el('summary').textContent = `Ստուգված ապրանքներ՝ ${d.count}։ Առաջին հինգ տողերը՝`;
  el('sample').replaceChildren(table(['Արտիկուլ','Բրենդ','Անվանում','WS','KP'],d.sample.map(p => [p.articul,p.brand,p.name,p.ws,p.kpPromo||p.kp])));
  el('preview').hidden = false; status('Ֆայլը ստուգված է։ Գործող գնացուցակը դեռ չի փոխվել։');
}); };
el('publish').onclick = () => run(async () => { if (!draft) return; el('publish').disabled = true; try {
  await api('admin/price/publish',{method:'POST',body:JSON.stringify({draft})}); draft = null; el('preview').hidden = true;
  await loadVersions(); status('Նոր գնացուցակը հրապարակված է');
} finally { el('publish').disabled = false; } });
async function loadVersions() {
  const d = await api('admin/price/versions');
  el('versions').replaceChildren(table(['Ամսաթիվ','Տարբերակ','Գործողություն'],d.versions.map(v => [new Date(v.created*1000).toLocaleString(),v.id,
    v.id === d.active ? 'Գործող' : button('Վերականգնել', async () => { if (!confirm('Վերադարձնե՞լ գնացուցակի այս տարբերակը։')) return; await api('admin/price/rollback',{method:'POST',body:JSON.stringify({version:v.id})}); await loadVersions(); status('Տարբերակը վերականգնված է'); })])));
}
async function loadUsers() {
  const d = await api('admin/users'); users = d.users;
  el('userList').replaceChildren(table(['Մուտքանուն','Հաճախորդ','Դեր','Գներ','Հասանելիություն',''], users.map(u => [u.login,u.client,u.role==='admin'?'Ադմինիստրատոր':'Հաճախորդ',u.sheet,u.active?'Միացված է':'Անջատված է',button('Խմբագրել', () => editUser(u))])));
}
function editUser(user = {}) {
  const f = el('userForm'); f.reset(); f.hidden = false;
  editingUserId=user.id||null;f.elements.id.value=editingUserId||'';
  el('userTitle').textContent=editingUserId?'Օգտատիրոջ խմբագրում՝ '+user.login:'Նոր օգտատեր';
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
  f.elements.password.placeholder=!user.id||user.needsPasswordSetup?'Օգտատերը գաղտնաբառը կսահմանի առաջին մուտքի ժամանակ':'Թողեք դատարկ՝ ընթացիկը պահպանելու համար';
  el('adminScopePanel').hidden=!user.id||user.role!=='admin';el('adminScope').value=user.adminScope||'owner';
  el('resetUserPassword').hidden=!user.id;el('issueInvitation').hidden=!user.id||!user.needsPasswordSetup;
  el('passwordSetupState').textContent=!user.id||user.needsPasswordSetup?'Առաջին մուտք՝ մուտքանունով և մեկանգամյա հրավերի կոդով։':'Օգտատերն արդեն սահմանել է գաղտնաբառը։';
  f.scrollIntoView({behavior:'smooth'});
}
el('resetUserPassword').onclick=()=>run(async()=>{
  if(!editingUserId)return;
  const target=users.find(u=>u.id===editingUserId);
  if(!confirm('Վերակայել գաղտնաբառը '+target.login+'։ Բոլոր աշխատաշրջանները կավարտվեն։ Կստեղծվի 48 ժամ գործող մեկանգամյա հրավեր։'))return;
  const reset=await api('admin/users/reset-password',{method:'POST',body:JSON.stringify({id:editingUserId})});showInvitation(target.login,reset.invitation);
  await loadUsers();editUser(users.find(u=>u.id===editingUserId));status('Գաղտնաբառը վերակայված է։ Փոխանցեք մեկանգամյա հրավերը օգտատիրոջը՝ նոր գաղտնաբառ սահմանելու համար։');
});
el('issueInvitation').onclick=()=>run(async()=>{const target=users.find(u=>u.id===editingUserId);if(!target)return;const data=await api('admin/users/invitation',{method:'POST',body:JSON.stringify({id:target.id})});showInvitation(target.login,data.invitation);});
el('newUser').onclick = () => editUser(); el('cancelUser').onclick = () => { el('userForm').hidden = true; };
el('usersImportForm').onsubmit = e => { e.preventDefault(); run(async () => {
  userDraft = null; el('usersPreview').hidden = true;
  const d = await api('admin/users/preview',{method:'POST',body:new FormData(e.target)});
  userDraft = d.draft;
  el('usersChanges').replaceChildren(table(['Մուտքանուն','Հաճախորդ','Փոփոխություն'],d.users.map(u=>[u.login,u.client,u.action==='create'?'Ստեղծել անջատված հասանելիությամբ':'Թարմացնել տվյալները և դադարեցնել աշխատաշրջանները'])));
  el('usersPreview').hidden = false; status('Ստուգեք փոփոխությունները մինչև կիրառելը');
}); };
el('importUsers').onclick = () => run(async () => { if (!userDraft) return; el('importUsers').disabled=true; try {
  await api('admin/users/import',{method:'POST',body:JSON.stringify({draft:userDraft})}); userDraft=null;
  el('usersPreview').hidden=true; await loadUsers(); status('Ներմուծումն ավարտված է։ Միացրեք նոր օգտատերերի հասանելիությունը․ առաջին մուտքը մուտքանունով է՝ գաղտնաբառի սահմանմամբ։');
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
  const summary=document.createElement('p');summary.className='preview-count';summary.textContent=`Հասանելի ապրանքներ՝ ${data.count}`+(data.adminBypass?' (ադմինիստրատոր․ սահմանափակումները չեն կիրառվում)':'');
  root.replaceChildren(summary,table(['Բրենդ','Կատեգորիա','Ապրանք','Հաճախորդի գին'],data.sample.map(p=>[p.brand,p.category,p.name,p.wholesale])));
}
el('previewUserAccess').onclick=()=>run(async()=>{
  const p=userPayload();delete p.password;
  const data=await api('admin/access/preview',{method:'POST',body:JSON.stringify(p)});showProductPreview(el('userAccessPreview'),data);
});
el('userForm').onsubmit = e => { e.preventDefault(); run(async () => {
  const p=userPayload();
  const saved=await api('admin/users',{method:'POST',body:JSON.stringify(p)});if(saved.invitation)showInvitation(p.login,saved.invitation); e.target.reset(); e.target.hidden = true;
  await loadUsers(); status('Օգտատերը պահպանված է։ Նախկին աշխատաշրջանները դադարեցված են։');
}); };
async function loadAudit(){
  await loadUsers();
  const [data,versions]=await Promise.all([api('admin/audit'),api('admin/price/versions')]);
  auditEntries=ZZWS_AUDIT.describe(data.events,users,versions.versions);renderAudit();
}
function renderAudit(){
  const search=el('auditSearch').value.trim().toLocaleLowerCase('ru'),group=el('auditGroup').value;
  const entries=auditEntries.filter(e=>(!group||e.group===group)&&(!search||[e.actor,e.action,e.description].join(' ').toLocaleLowerCase('ru').includes(search)));
  el('auditCount').textContent=`Ցուցադրված իրադարձություններ՝ ${entries.length} / ${auditEntries.length}`;
  if(!entries.length){const empty=document.createElement('p');empty.textContent='Ընտրված պայմաններով իրադարձություններ չկան։';el('events').replaceChildren(empty);return;}
  el('events').replaceChildren(table(['Երբ · Երևան','Ով','Գործողություն','Մանրամասներ'],entries.map(e=>{
    const details=document.createElement('div'),text=document.createElement('p');text.textContent=e.description;details.append(text);
    const disclosure=document.createElement('details'),title=document.createElement('summary'),code=document.createElement('pre');
    title.textContent='Տեխնիկական տվյալներ';code.textContent=JSON.stringify(e.raw,null,2);disclosure.append(title,code);details.append(disclosure);
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
    const priceTitle=document.createElement('h3');priceTitle.textContent='Գնի ընտրություն';
    const priceRoot=document.createElement('div'),accessRoot=document.createElement('div');
    const accessTitle=document.createElement('h3');accessTitle.textContent='Խմբի ընդհանուր հասանելիություն';
    const pricing=ZZWS_RULES_UI.pricingEditor(priceRoot,data.rules[group].pricing);
    const access=ZZWS_RULES_UI.accessEditor(accessRoot,data.rules[group].access,catalogPairs);
    const reset=button('Վերականգնել ստանդարտը '+group,()=>{
      pricing.reset(data.defaults[group].pricing);access.reset(data.defaults[group].access);el('groupRulesPreview').replaceChildren();status('Ստանդարտ կանոնները վերականգնված են ձևում։ Կիրառելու համար սեղմեք «Պահպանել խմբերի կանոնները»։');
    });
    card.append(title,priceTitle,priceRoot,accessTitle,accessRoot,reset);container.append(card);groupEditors[group]={pricing,access};
  }
}
function groupPayload(){return Object.fromEntries(['KP','Dealers'].map(g=>[g,{pricing:groupEditors[g].pricing.read(),access:groupEditors[g].access.read()}]));}
el('previewGroupRules').onclick=()=>run(async()=>{
  const data=await api('admin/rules/preview',{method:'POST',body:JSON.stringify({rules:groupPayload()})});
  const root=el('groupRulesPreview');root.replaceChildren();
  for(const group of ['KP','Dealers']){const title=document.createElement('h3');title.textContent=group+' — առանց անհատական սահմանափակումների';const box=document.createElement('div');showProductPreview(box,data.groups[group]);root.append(title,box);}
});
el('reloadGroupRules').onclick=()=>run(loadGroupRules);
el('groupRulesForm').onsubmit=e=>{e.preventDefault();run(async()=>{
  const submit=e.target.querySelector('[type=submit]');submit.disabled=true;
  try {
    const data=await api('admin/rules',{method:'POST',body:JSON.stringify({rules:groupPayload(),revision:groupRevision})});groupRevision=data.revision;
    status('Խմբերի կանոնները պահպանված են։ Նոր հարցումներն արդեն օգտագործում են դրանք, իսկ բաց կատալոգները կթարմացվեն հաջորդ ստուգման ժամանակ։');
  } finally { submit.disabled=false; }
});};
const setupToken = new URLSearchParams(location.hash.slice(1)).get('setup');
if (setupToken) {
  history.replaceState(null, '', location.pathname);
  finishSessionLoading();el('login').hidden = true; el('setup').hidden = false;
} else {
  run(async () => { try { await enter(); } catch(e) { if(sessionStorage.getItem('zzws_session_v3')&&e.status!==403)sessionLoadFailed(e.message);else{showLogin();if (!e.message.includes('Մուտք գործեք'))status(e.message,true);} } });
}
el('setupForm').onsubmit = e => { e.preventDefault(); run(async () => {
  const p = Object.fromEntries(new FormData(e.target));
  if(p.password !== p.confirm) throw new Error('Գաղտնաբառերը չեն համընկնում');
  const button=e.target.querySelector('button'); button.disabled=true;
  try { await api('bootstrap',{method:'POST',body:JSON.stringify({...p,setupToken})});
    e.target.reset(); el('setup').hidden=true; showLogin(); status('Ադմինիստրատորը ստեղծված է։ Մուտք գործեք ընտրված մուտքանունով և գաղտնաբառով։');
  } finally { button.disabled=false; }
}); };
el('userTemplate').onclick = () => run(async () => {
  const response=await ZZWS.request('admin/users/template'); if(!response.ok)throw new Error('Մուտք գործեք որպես ադմինիստրատոր');
  const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download='Users-template.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
