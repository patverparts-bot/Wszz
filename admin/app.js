let categoryLabels={Dealers:'Մշտական Գորրընկեր',KP:'Խոշոր Գործընկեր'};
const categoryLabel=id=>categoryLabels[id]||id;
const el = id => document.getElementById(id);
function finishSessionLoading(){document.documentElement.removeAttribute('data-session-pending');}
function sessionLoadFailed(message){document.documentElement.setAttribute('data-session-pending','true');el('sessionLoadingText').textContent=message||'Չհաջողվեց թարմացնել տվյալները։ Ստուգեք կապը։';el('sessionSpinner').hidden=true;el('sessionRetryActions').hidden=false;}
let draft = null, userDraft = null, users = [];
let catalogPairs=[],userAccessEditor=null,groupEditors={},groupRevision=null;
let editingUserId=null,editingProfile=null,auditEntries=[],categoryByGroup={KP:'KP',Dealers:'Dealers'};
let categoryDefaults=null;
let pricingByGroup={Dealers:{sources:['ws'],mode:'first'},KP:{sources:['kpPromo','kp','ws'],mode:'first'}};
function status(message, error = false) { el('status').textContent = message; el('status').className = error ? 'error' : ''; }
async function api(path, options = {}) {
  try { return await ZZWS.json(path, options); }
  catch(e) { if(e.status === 401) showLogin(); throw e; }
}
function showLogin() {
  window.ZZWS_REOPEN_ALERTS?.reset();
  window.ZZWS_ENTRY?.reset();
  window.ZZWS_HELP_USER=null;
  document.getElementById('categoryManagerDialog')?.close();
  for(const key of ['orderRead','orderWrite','priceWrite'])document.documentElement.dataset[key]='false';
  finishSessionLoading();
  window.ZZWS_STORAGE?.reset();
  window.ZZWS_ADMIN_ORDERS?.reset();
  window.ZZWS_ADMIN_CHANNELS?.reset();
  el('workspace').hidden=true;el('login').hidden=false;el('logout').hidden=true;draft=null;userDraft=null;
  users=[];catalogPairs=[];groupEditors={};groupRevision=null;userAccessEditor=null;editingUserId=null;editingProfile=null;auditEntries=[];
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
async function run(fn) { try { await fn(); } catch(e) { if(!e.staleSession)status(ZZWS.message(e), true); } }
const adminTabs=['dashboard','orders','price','users','rules','audit','storage','email','offers'];
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
  if(name==='offers')await ZZWS_OFFERS.load();
  if(name==='email')await ZZWS_REPORT_EMAIL.loadSettings();
}
async function enter() {
  let user = await api('me');
  if(user.needsPasswordSetup){user=await requirePasswordSetup(user);if(!user){showLogin();return;}}
  if (user.role !== 'admin') { showLogin();const e=new Error('Անհրաժեշտ է ադմինիստրատորի հաշիվ');e.status=403;throw e; }
  if(!user.adminScope||!Array.isArray(user.permissions)||!user.permissions.length){showLogin();const e=new Error('Այս հաշվի ադմինիստրատորի իրավունքները դեռ նշանակված չեն։ Դիմեք սեփականատիրոջը։');e.status=403;throw e;}
  window.ZZWS_ENTRY?.navigation(user);window.ZZWS_HELP_USER=user;ZZWS_ADMIN_HOME.setUser(user);
  ZZWS_ADMIN_CHANNELS.start(user);
  window.ZZWS_REOPEN_ALERTS?.start(user);
  const activeTab=rememberedAdminTab();for(const section of adminTabs)el(section).hidden=section!==activeTab;
  el('login').hidden = true; el('workspace').hidden = false; el('logout').hidden = false;
  catalogPairs=(await api('admin/catalog-options')).pairs;
  ZZWS_ADMIN_RECEIPTS.start(user);
  ZZWS_ADMIN_ORDERS.start(user);
  const permissions=user.permissions||[];await Promise.all([...(permissions.includes('price:read')?[loadVersions()]:[]),...(permissions.includes('users')?[loadUsers()]:[]),...(permissions.includes('rules')?[loadGroupRules()]:[])]);await selectAdminTab(activeTab);finishSessionLoading(); status('Մուտք եք գործել որպես ' + user.client);
}
el('loginForm').onsubmit = e => { e.preventDefault(); run(async () => { await completeSecureLogin(await api('login', {method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))})); e.target.reset(); let identity=await api('me');if(identity.needsPasswordSetup){identity=await requirePasswordSetup(identity);if(!identity)return;}await ZZWS_ENTRY.choose(identity,enter); }); };
el('logout').onclick = () => run(async () => { await api('logout',{method:'POST'}); showLogin(); status('Դուք դուրս եք եկել'); });
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => run(()=>selectAdminTab(b.dataset.tab)));
el('priceForm').onsubmit = e => { e.preventDefault(); run(async () => {
  draft = null; el('preview').hidden = true; status('Ֆայլը ստուգվում է…');
  const d = await api('admin/price/preview',{method:'POST',body:new FormData(e.target)});
  draft = d.draft;const difference=d.difference;el('priceDifference').textContent=difference?'Ավելացված՝ '+difference.added+' · հեռացված՝ '+difference.removed+' · գինը փոխված՝ '+difference.changed+' · անփոփոխ՝ '+difference.unchanged:'';el('priceWarnings').replaceChildren(...(difference?.warnings||[]).map(w=>{const p=document.createElement('p');p.textContent=w.articul+' · '+w.name+' · '+({ws:'Մեծածախ գին',kp:'Խոշոր գործընկերոջ գին',kpPromo:'Խոշոր գործընկերոջ ակցիոն գին',retail:'Զեղչված մանրածախ գին',base:'Հիմնական մանրածախ գին'}[w.source]||'Գին')+': '+w.before+' → '+w.after+' ('+w.percent+'%)';return p;})); const counts=d.priceSummary;
  el('summary').textContent = `Ֆայլում ստուգված ապրանքներ՝ ${d.count}։ `+(counts?`Մեծածախ գին ունի՝ ${counts.ws}։ Խոշոր գործընկերոջ հիմնական գին՝ ${counts.kp}։ Խոշոր գործընկերոջ ակցիոն գին՝ ${counts.kpPromo}։ Առանց որևէ մեծածախ գնի՝ ${counts.withoutWholesale}։ `:'')+(d.sampleMode==='priced'?'Ստորև ցույց են տրված մինչև հինգ օրինակ՝ մեծածախ գնով։ Սա ամբողջ ցանկը չէ։':'Ստորև ֆայլի առաջին մինչև հինգ տողերի օրինակներն են։ Սա ամբողջ ցանկը չէ։')+' «—» նշանակում է՝ այս տեսակի գին ֆայլում նշված չէ կամ զրոյական է․ ապրանքը անվճար չէ։ Ցուցադրված են ֆայլի գները․ հաճախորդի վերջնական գինը որոշվում է նրա կատեգորիայի կանոններով։';
  const price=value=>value>0?Number(value).toLocaleString('hy-AM')+' ֏':'—';
  el('sample').replaceChildren(table(['Արտիկուլ','Բրենդ','Անվանում','Մանրածախ գին','Մեծածախ գին','Խոշոր գործընկերոջ հիմնական գին','Խոշոր գործընկերոջ ակցիոն գին'],d.sample.map(p => [p.articul,p.brand,p.name,price(p.retail),price(p.ws),price(p.kp),price(p.kpPromo)])));
  el('preview').hidden = false; status('Ֆայլը ստուգված է։ Գործող գնացուցակը դեռ չի փոխվել։');
}); };
el('publish').onclick = () => run(async () => { if (!draft) return; el('publish').disabled = true; try {
  await api('admin/price/publish',{method:'POST',body:JSON.stringify({draft})}); draft = null; el('preview').hidden = true;
  await loadVersions(); status('Նոր գնացուցակը հրապարակված է');
} finally { el('publish').disabled = false; } });
async function loadVersions() {
  const d = await api('admin/price/versions');
  el('versions').replaceChildren(table(['Ամսաթիվ','Տարբերակ','Գործողություն'],d.versions.map(v => [new Date(v.created*1000).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan'}),v.label?'№'+v.label:'Գնացուցակ · '+new Date(v.created*1000).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan'}),
    v.id === d.active ? 'Գործող' : button('Վերականգնել', async () => { if (!confirm('Վերադարձնե՞լ գնացուցակի այս տարբերակը։')) return; await api('admin/price/rollback',{method:'POST',body:JSON.stringify({version:v.id})}); await loadVersions(); status('Տարբերակը վերականգնված է'); })])));
}
async function loadUsers() {
  const d = await api('admin/users'); users = d.users;categoryLabels={...categoryLabels,...d.categoryLabels};categoryByGroup=d.categoryByGroup||categoryByGroup;
  el('userList').replaceChildren(table(['Մուտքանուն','Հաճախորդ','Դեր','Գներ','Կատեգորիա','Հասանելիություն',''], users.map(u => [u.login,u.client,u.role==='admin'?'Ադմինիստրատոր':'Հաճախորդ',categoryLabel(u.sheet),u.role==='client'?categoryLabel(u.sheet):'—',u.active?'Միացված է':'Անջատված է',button('Խմբագրել', () => editUser(u))])));
}
function editUser(user = {}) {
  const f = el('userForm'); f.reset(); f.hidden = false;
  f.elements.sheet.value='Dealers';
  editingUserId=user.id||null;f.elements.id.value=editingUserId||'';
  editingProfile=structuredClone(user);
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
  el('adminScopePanel').hidden=!user.id||user.role!=='admin';el('adminScope').value=user.adminScope||'';
  ZZWS_ADMIN_CHANNELS.edit(user);
  el('resetUserPassword').hidden=!user.id;el('issueInvitation').hidden=!user.id||!user.needsPasswordSetup;
  el('passwordSetupState').textContent=!user.id||user.needsPasswordSetup?'Առաջին մուտք՝ մուտքանունով և մեկանգամյա հրավերի կոդով։':'Օգտատերն արդեն սահմանել է գաղտնաբառը։';
  el('adminOrdersRefresh').value=user.ordersRefreshSeconds??5;el('saveAdminPolling').hidden=!user.id;el('adminPollingStatus').textContent='';
  ZZWS_REPORT_EMAIL.edit(user);updateClientCategory();ZZWS_ADMIN_RECEIPTS.loadClient(user);ZZWS_CARD_LAYOUT.edit(user,users);
  f.scrollIntoView({behavior:'smooth'});
}
el('resetUserPassword').onclick=()=>run(async()=>{
  if(!editingUserId)return;
  const target=users.find(u=>u.id===editingUserId);
  if(!confirm('Վերակայել գաղտնաբառը '+target.login+'։ Բոլոր աշխատաշրջանները կավարտվեն։ Կստեղծվի 48 ժամ գործող մեկանգամյա հրավեր։'))return;
  const reset=await api('admin/users/reset-password',{method:'POST',body:JSON.stringify({id:editingUserId})});showInvitation(target.login,reset.invitation,target.id);
  await loadUsers();editUser(users.find(u=>u.id===editingUserId));status('Գաղտնաբառը վերակայված է։ Փոխանցեք մեկանգամյա հրավերը օգտատիրոջը՝ նոր գաղտնաբառ սահմանելու համար։');
});
el('issueInvitation').onclick=()=>run(async()=>{const target=users.find(u=>u.id===editingUserId);if(!target)return;const data=await api('admin/users/invitation',{method:'POST',body:JSON.stringify({id:target.id})});showInvitation(target.login,data.invitation,target.id);});
el('newUser').onclick = () => editUser(); el('cancelUser').onclick = () => { el('userForm').hidden = true; };
el('usersImportForm').onsubmit = e => { e.preventDefault(); run(async () => {
  userDraft = null; el('usersPreview').hidden = true;
  const d = await api('admin/users/preview',{method:'POST',body:new FormData(e.target)});
  userDraft = d.draft;
  const scopeLabels={owner:'Սեփականատեր՝ ամբողջ հասանելիություն',manager:'Պատվերների մենեջեր',price:'Գնացուցակի օպերատոր',viewer:'Միայն դիտում'},receiptLabels={inherit:'Ընդհանուր կարգավորում',on:'Միացված է',off:'Անջատված է',until:'Ժամանակավորապես անջատված է'},yes=value=>value==null?'Պահպանել նախկինը':value?'Այո':'Ոչ';
  el('usersChanges').replaceChildren(table(['Մուտքանուն','Անվանում','Գործողություն','Դեր','Կատեգորիա','Հասանելիություն','Աշխատակցի իրավունքներ','Android','Telegram','Ստուգում (վրկ)','Ստացման վերահսկում','Ապրանքների կանոններ'],d.users.map(u=>[u.login,u.client,u.action==='create'?'Նոր հաշիվ':'Թարմացնել և ավարտել աշխատաշրջանները',u.role==='admin'?'Ադմինիստրատոր':'Հաճախորդ',categoryLabel(u.sheet),yes(u.active),u.role==='admin'?(scopeLabels[u.scope]||'Իրավունքները նշանակված չեն'):'Չի կիրառվում',yes(u.mobile),yes(u.telegram),u.refresh??'—',receiptLabels[u.receipt]||'Պահպանել նախկինը',u.accessChanged?'Փոխվում են':'Պահպանել նախկինը'])));
  el('usersPreview').hidden = false; status('Ստուգեք փոփոխությունները մինչև կիրառելը');
}); };
el('importUsers').onclick = () => run(async () => { if (!userDraft) return; el('importUsers').disabled=true; try {
  await api('admin/users/import',{method:'POST',body:JSON.stringify({draft:userDraft})}); userDraft=null;
  el('usersPreview').hidden=true; await loadUsers(); status('Ներմուծումն ավարտված է։ Կարգավորումները կիրառված են ըստ նախադիտման։ Նոր օգտատիրոջ քարտից տրամադրեք մեկանգամյա հրավերը՝ գաղտնաբառը սահմանելու համար։');
} finally { el('importUsers').disabled=false; } });
function userPayload(){
  const f = el('userForm'), p = Object.fromEntries(new FormData(f));
  Object.assign(p,ZZWS_REPORT_EMAIL.payload());
  p.intent=editingUserId?'update':'create';
  if(editingUserId)p.id=editingUserId;else delete p.id;
  for (const key of ['active','allowResale']) p[key] = f.elements[key].checked;
  p.catalogAccess=userAccessEditor.read();
  const old = editingUserId?editingProfile:null;
  if(old)p.expectedProfileRevision=old.profileRevision;
  p.brands=old?.brands||[];p.allBrands=old?.allBrands??p.sheet==='Dealers';
  p.rowsList=[1,2,3].map(i=>{const suffix=i===1?'':String(i),row={organization:p['organization'+suffix].trim(),address:p['address'+suffix].trim(),contact:p['contact'+suffix].trim()};return Object.values(row).some(Boolean)?{...row,...(old?.rowsList?.[i-1]?.id?{id:old.rowsList[i-1].id}:{})}:null;}).filter(Boolean);
  for(let i=1;i<=3;i++)for(const key of ['organization','address','contact'])delete p[key+(i===1?'':String(i))];
  return p;
}
function updateClientCategory(){
  ZZWS_REPORT_EMAIL.role(el('userForm').elements.role.value);
  const f=el('userForm'),pricing=pricingByGroup[f.elements.sheet.value],labels={ws:'Մեծածախ',kpPromo:'Խոշոր գործընկերոջ ակցիոն',kp:'Խոշոր գործընկերոջ',retail:'Զեղչված մանրածախ',base:'Հիմնական մանրածախ'};
  const staffRole=f.elements.role.value==='admin',savedStaff=staffRole&&!!editingUserId&&editingProfile?.role==='admin';el('adminRoleSetupNote').hidden=!staffRole||savedStaff;el('adminScopePanel').hidden=!savedStaff;el('adminChannelsPanel').hidden=!savedStaff||window.ZZWS_HELP_USER?.adminScope!=='owner';
  el('clientPricingFields').hidden=f.elements.role.value==='admin';el('adminPollingPanel').hidden=f.elements.role.value!=='admin';el('adminOrdersRefresh').disabled=f.elements.role.value!=='admin';
  el('clientPriceSequence').value=pricing.sources.map(source=>labels[source]).join(' → ');
  el('clientPriceSelection').textContent=({first:'Ընտրվում է առաջին հասանելի դրական գինը։ Դատարկ և զրոյական գները բաց են թողնվում։',min:'Ընտրվում է նշված աղբյուրների նվազագույն դրական գինը։',max:'Ընտրվում է նշված աղբյուրների առավելագույն դրական գինը։'}[pricing.mode]||'');
}
el('userForm').elements.role.addEventListener('change',()=>{updateClientCategory();ZZWS_ADMIN_RECEIPTS.loadClient({...editingProfile,id:editingUserId,role:el('userForm').elements.role.value});});
el('userForm').elements.sheet.onchange=()=>{
  updateClientCategory();
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
  const saved=await api('admin/users',{method:'POST',body:JSON.stringify(p)});if(saved.invitation)showInvitation(p.login,saved.invitation,saved.id); e.target.reset(); e.target.hidden = true;
  if(saved.sessionRevoked){ZZWS.clearSession();showLogin();status('Մուտքի տվյալները փոխված են։ Կրկին մուտք գործեք նոր տվյալներով։');return;}
  await loadUsers(); status(saved.sessionRetained?'Օգտատերը պահպանված է։ Ձեր ընթացիկ աշխատաշրջանը շարունակվում է։':'Օգտատերը պահպանված է։ Նախկին աշխատաշրջանները դադարեցված են։');
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
async function loadGroupRules(draftData=null){
  const data=draftData||await api('admin/rules');groupRevision=data.revision;categoryDefaults=data.defaults;groupEditors={};
  pricingByGroup=Object.fromEntries(Object.keys(data.rules).map(group=>[group,data.rules[group].pricing]));
  for(const [id,rule] of Object.entries(data.rules))if(rule.name)categoryLabels[id]=rule.name;
  const select=el('clientCategory'),selected=select.value;select.replaceChildren(...['Dealers','KP',...Object.keys(data.rules).filter(id=>!['Dealers','KP'].includes(id))].map(id=>{const option=document.createElement('option');option.value=id;option.textContent=categoryLabel(id);return option;}));select.value=pricingByGroup[selected]?selected:'Dealers';updateClientCategory();
  const container=el('groupRulesEditors');container.replaceChildren();el('groupRulesPreview').replaceChildren();
  for(const group of Object.keys(pricingByGroup)){
    const card=document.createElement('fieldset');card.dataset.groupRules=group;
    const title=document.createElement('legend');title.textContent=categoryLabel(group);const name=document.createElement('input');name.value=categoryLabel(group);name.maxLength=100;name.required=true;name.setAttribute('aria-label','Կատեգորիայի անվանումը');
    const priceTitle=document.createElement('h3');priceTitle.textContent='Գնի ընտրություն';
    const priceRoot=document.createElement('div'),accessRoot=document.createElement('div');
    const accessTitle=document.createElement('h3');accessTitle.textContent='Խմբի ընդհանուր հասանելիություն';
    const pricing=ZZWS_RULES_UI.pricingEditor(priceRoot,data.rules[group].pricing);
    const stockRoot=document.createElement('fieldset'),stockTitle=document.createElement('legend');stockTitle.textContent='Առկայության ցուցադրման սահմաններ';stockRoot.append(stockTitle);
    const stock={};for(const [key,title,fallback]of [['availableFrom','«Առկա է»՝ հիմնական առկայությունը սկսած (հատ)',3],['otherFrom','Հիմնական առկայություն չկա․ «Ճշտել»՝ լրացուցիչ առկայությունը սկսած (հատ)',5]]){const label=document.createElement('label'),input=document.createElement('input');input.type='number';input.min='1';input.max='999999';input.step='1';input.required=true;input.value=data.rules[group].stock?.[key]??fallback;input.dataset.stockField=key;label.textContent=title;label.append(input);stockRoot.append(label);stock[key]=input;}
    const explanation=document.createElement('p');explanation.className='help';explanation.textContent='Եթե հիմնական առկայությունը դրական է, բայց առաջին սահմանից փոքր՝ ցուցադրվում է «Ճշտել»։ Եթե հիմնական առկայություն չկա և լրացուցիչ քանակը երկրորդ սահմանից փոքր է՝ ապրանքը թաքցվում է հաճախորդից։ «Միայն առկա պահեստում» զտիչը թողնում է միայն հիմնական առկայությամբ ապրանքները՝ անկախ ցուցադրված պիտակից։ Այս կանոնները չեն սահմանափակում պատվերի քանակը։';stockRoot.append(explanation);
    const access=ZZWS_RULES_UI.accessEditor(accessRoot,data.rules[group].access,catalogPairs);
    const reset=button('Վերականգնել ստանդարտը՝ '+categoryLabel(group),()=>{
      for(const [key,input]of Object.entries(stock))input.value=(data.defaults[group]||data.defaults.Dealers).stock[key];pricing.reset((data.defaults[group]||data.defaults.Dealers).pricing);access.reset((data.defaults[group]||data.defaults.Dealers).access);el('groupRulesPreview').replaceChildren();status('Ստանդարտ կանոնները վերականգնված են ձևում։ Կիրառելու համար սեղմեք «Պահպանել խմբերի կանոնները»։');
    });
    card.append(title,name,priceTitle,priceRoot,stockRoot,accessTitle,accessRoot,reset);container.append(card);groupEditors[group]={pricing,access,name,stock};
  }
}
function groupPayload(){return Object.fromEntries(Object.keys(groupEditors).map(g=>[g,{name:groupEditors[g].name.value.trim(),pricing:groupEditors[g].pricing.read(),access:groupEditors[g].access.read(),stock:Object.fromEntries(Object.entries(groupEditors[g].stock).map(([key,input])=>[key,Number(input.value)]))}]));}
el('previewGroupRules').onclick=()=>run(async()=>{
  const data=await api('admin/rules/preview',{method:'POST',body:JSON.stringify({rules:groupPayload()})});
  const root=el('groupRulesPreview');root.replaceChildren();
  for(const group of Object.keys(pricingByGroup)){const title=document.createElement('h3');title.textContent=categoryLabel(group)+' — առանց անհատական սահմանափակումների';const box=document.createElement('div');showProductPreview(box,data.groups[group]);root.append(title,box);}
});
el('reloadGroupRules').onclick=()=>run(loadGroupRules);
el('groupRulesForm').onsubmit=e=>{e.preventDefault();run(async()=>{
  const submit=e.target.querySelector('[type=submit]');submit.disabled=true;
  try {
    const next=groupPayload(),data=await api('admin/rules',{method:'POST',body:JSON.stringify({rules:next,revision:groupRevision})});groupRevision=data.revision;pricingByGroup=Object.fromEntries(Object.keys(next).map(group=>[group,next[group].pricing]));await loadGroupRules();await loadUsers();
    status('Խմբերի կանոնները պահպանված են։ Նոր հարցումներն արդեն օգտագործում են դրանք, իսկ բաց կատալոգները կթարմացվեն հաջորդ ստուգման ժամանակ։');
  } finally { submit.disabled=false; }
});};
const setupToken = new URLSearchParams(location.hash.slice(1)).get('setup');
if (setupToken) {
  history.replaceState(null, '', location.pathname);
  finishSessionLoading();el('login').hidden = true; el('setup').hidden = false;
} else {
  run(async () => { try { await enter(); } catch(e) { if(e.staleSession)return;if(sessionStorage.getItem('zzws_session_v3')&&e.status!==403)sessionLoadFailed(e.message);else{showLogin();if (!e.message.includes('Մուտք գործեք'))status(e.message,true);} } });
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

// The category editor is a separate window; drafts only affect prices after explicit save.
const categoryDialog=document.createElement('dialog');categoryDialog.id='categoryManagerDialog';categoryDialog.setAttribute('aria-labelledby','categoryManagerTitle');
const categoryTitle=document.createElement('h2');categoryTitle.id='categoryManagerTitle';categoryTitle.textContent='Հաճախորդների կատեգորիաներ';
const categoryClose=button('Փակել',()=>categoryDialog.close());
const categoryAdd=button('Ստեղծել նոր կատեգորիա',async()=>{
 const name=prompt('Նոր կատեգորիայի անվանումը');if(!name?.trim())return;
 const rules=groupPayload(),id='cat_'+crypto.randomUUID().replaceAll('-','');
 rules[id]={name:name.trim(),...structuredClone(categoryDefaults.Dealers)};
 await loadGroupRules({rules,defaults:categoryDefaults,revision:groupRevision});
 status('Նոր կատեգորիան դեռ սևագիր է։ Պահպանեք՝ կիրառելու համար։');
});
const categoryOpen=button('Բացել կատեգորիաների կառավարումը',()=>categoryDialog.showModal());
const categoryHeader=document.createElement('div');categoryHeader.className='category-dialog-header';const categoryToolbar=document.createElement('div');categoryToolbar.className='category-dialog-toolbar';categoryToolbar.append(categoryClose,categoryAdd);categoryHeader.append(categoryTitle,categoryToolbar);el('rules').append(categoryOpen);categoryDialog.append(categoryHeader,el('groupRulesForm'));document.body.append(categoryDialog);

el('saveAdminPolling').onclick=()=>run(async()=>{
 if(!editingUserId||el('userForm').elements.role.value!=='admin')return;
 const seconds=Number(el('adminOrdersRefresh').value),id=editingUserId,data=await api('admin/users/polling',{method:'POST',body:JSON.stringify({id,seconds,expectedProfileRevision:editingProfile.profileRevision})});
 if(editingUserId!==id)return;editingProfile.profileRevision=data.profileRevision;editingProfile.ordersRefreshSeconds=data.seconds;const row=users.find(u=>u.id===id);if(row)Object.assign(row,{profileRevision:data.profileRevision,ordersRefreshSeconds:data.seconds});
 if(window.ZZWS_HELP_USER?.id===id)ZZWS_ADMIN_ORDERS.setRefreshSeconds(data.seconds);el('adminPollingStatus').textContent='Միջակայքը պահպանված է՝ '+data.seconds+' վայրկյան։';
});
