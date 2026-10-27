// Authentication and permissions are issued by the server, never restored from localStorage.
let serverIdentity = null;
function finishSessionLoading(){document.documentElement.removeAttribute('data-session-pending');}
function sessionLoadFailed(message){
  document.documentElement.setAttribute('data-session-pending','true');
  document.getElementById('sessionLoadingText').textContent=message||'Չհաջողվեց թարմացնել տվյալները։ Ստուգեք կապը։';
  document.getElementById('sessionSpinner').hidden=true;document.getElementById('sessionRetryActions').hidden=false;
}
async function secureApi(path, options = {}) {
  try { return await ZZWS.json(path, options); }
  catch(e) { if (e.status === 401) lockCatalog(); throw e; }
}
function lockCatalog() {
  finishSessionLoading();
  window.ZZWS_ORDERS?.stop();
  window.ZZWS_MEMORY?.capture();window.ZZWS_MEMORY?.stop();
  serverIdentity = null;
  authorizedClient = ''; userSheetType = ''; clientRowsData = []; allProducts = []; filteredProducts = [];
  productIndex = new Map(); catalogLoaded = false; cart = {}; favoritesSet.clear();
  if (backgroundPollTimer) clearTimeout(backgroundPollTimer);
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('tableBody').replaceChildren();
  document.getElementById('mobileCardsContainer').replaceChildren();
  for (const id of ['orderModal','cabinetModal','bulkAddModal']) document.getElementById(id)?.classList.add('hidden');
}
async function acceptIdentity(user) {
  if(user.needsPasswordSetup){user=await requirePasswordSetup(user);if(!user){finishSessionLoading();return;}}
  serverIdentity = user; authorizedClient = user.client; userSheetType = user.sheet; clientRowsData = user.rowsList;
  configureSortPrices();
  await ZZWS_MEMORY.start(user);
  ZZWS_ORDERS.start(user);
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('passwordInput').value = '';
  showPriceUpdatePopupAndStart();
}
async function checkPassword() {
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.classList.add('hidden');
  try {
    const user = await secureApi('login', {method:'POST',body:JSON.stringify({
      login:document.getElementById('loginInput').value.trim(),password:document.getElementById('passwordInput').value})});
    await acceptIdentity(await completeSecureLogin(user));
  } catch(e) { errorMsg.textContent = e.message; errorMsg.classList.remove('hidden'); }
}

function clearUserCartAndFilters(client) {
  if (client) {
    try {
      localStorage.removeItem('zigzag_cart_' + client);
      localStorage.removeItem('zigzag_filters_' + client);
      localStorage.removeItem('zigzag_filters_open_' + client);
      localStorage.removeItem('zigzag_admin_price_mode_' + client);
    } catch (e) {}
  }

  cart = {};
  allProducts = [];
  filteredProducts = [];
  productIndex = new Map();
  displayedCount = 0;
  catalogLoaded = false;
  selectedBrands = [];
  selectedCategories = [];
  adminOrderPriceMode = 'WS';
  pendingRestoreToast = false;

  const tableBody = document.getElementById('tableBody');
  if (tableBody) tableBody.innerHTML = '';
  const cards = document.getElementById('mobileCardsContainer');
  if (cards) cards.innerHTML = '';
  const productCount = document.getElementById('productCountInfo');
  if (productCount) productCount.textContent = 'Գտնվել է 0 ապրանք';
  const noResults = document.getElementById('noResults');
  if (noResults) noResults.classList.add('hidden');
  const bulkModal = document.getElementById('bulkAddModal');
  if (bulkModal) bulkModal.classList.add('hidden');

  ['brandInput', 'categoryInput', 'searchInput'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
  ['favOnlyFilter', 'promoOnlyFilter', 'stockOnlyFilter', 'wholesaleOnlyFilter'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.checked = false;
  });
  const sortBy = document.getElementById('sortBy');
  if (sortBy) sortBy.value = 'default';
  ['clearSearchBtn', 'clearBrandBtn', 'clearCategoryBtn'].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.classList.add('hidden');
  });
  ['brandDropdown', 'categoryDropdown'].forEach(id => {
    const dropdown = document.getElementById(id);
    if (dropdown) dropdown.classList.add('hidden');
  });
  ['brandSelectionSummary', 'categorySelectionSummary'].forEach(id => {
    const summary = document.getElementById(id);
    if (summary) {
      summary.textContent = '';
      summary.classList.add('hidden');
    }
  });
  const priceModeSelect = document.getElementById('adminOrderPriceMode');
  if (priceModeSelect) priceModeSelect.value = 'WS';
  updateOrderPanel();
  updateMobileFilterBadge();
}

function showPriceUpdatePopupAndStart(isBackgroundUpdate = false) {
  if (!isBackgroundUpdate) { initAppAfterAuth(); startBackgroundPricePolling(); return; }
  const popup = document.getElementById('priceUpdatePopup');
  document.getElementById('popupDateText').innerText = `📅 Թարմացում՝ ${cachedPriceDateText || '—'}`;
  document.getElementById('popupTitle').innerText = 'Գնացուցակը թարմացված է!';
  document.getElementById('popupSubText').innerText = 'Նոր գները և տվյալները հաջողությամբ ներբեռնվեցին:';
  popup.classList.remove('hidden');
  popup.classList.add('flex');
  setTimeout(() => {
    popup.classList.add('opacity-0');
    setTimeout(() => { popup.classList.add('hidden'); popup.classList.remove('flex', 'opacity-0'); }, 400);
  }, 3000);
}

function notifyIfPriceChanged() {
  if (!cachedPriceDateText || !authorizedClient) return;
  const key = 'zigzag_seen_price_' + userStorageId();
  let prev = null;
  try { prev = localStorage.getItem(key); localStorage.setItem(key, cachedPriceDateText); } catch (e) {}
  if (prev && prev !== cachedPriceDateText) showPriceUpdatePopupAndStart(true);
}

let lastPriceStamp = '';
async function fetchPriceStamp() {
  const data = await secureApi('catalog/version');
  return data.version;
}

let loadedPriceFingerprint = '';
let pollDelay = 60000;

function fingerprintRows(rows) {
  const str = JSON.stringify(rows);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return str.length + ':' + (h >>> 0).toString(16);
}

async function reloadIfPriceChanged() {
  const result = await fetchPriceRows();
  const fp = fingerprintRows(result.rows);
  if (fp === loadedPriceFingerprint) return false;
  loadedPriceFingerprint = fp;
  applyPriceDate(result.dateText);
  parseExcelRows(result.rows, true);
  try { localStorage.setItem('zigzag_seen_price_' + userStorageId(), cachedPriceDateText); } catch (e) {}
  showPriceUpdatePopupAndStart(true);
  return true;
}

function startBackgroundPricePolling() {
  if (backgroundPollTimer) clearTimeout(backgroundPollTimer);
  pollDelay = 60000;
  const tick = async () => {
    try {
      if (authorizedClient && !document.hidden) {
        const stamp = await fetchPriceStamp();
        if (stamp) {
          if (!lastPriceStamp) {
            lastPriceStamp = stamp;
          } else if (stamp !== lastPriceStamp) {
            lastPriceStamp = stamp;
            const changed = await reloadIfPriceChanged();
            pollDelay = changed ? 60000 : Math.min(pollDelay * 2, 600000);
          }
        }
      }
    } catch (e) {}
    if (authorizedClient) backgroundPollTimer = setTimeout(tick, pollDelay);
  };
  backgroundPollTimer = setTimeout(tick, pollDelay);
}

async function logout() {
  await window.ZZWS_MEMORY?.flush();
  try { await secureApi("logout", {method:"POST"}); } catch(e) { lockCatalog(); return; }
  lockCatalog();
  if (backgroundPollTimer) clearTimeout(backgroundPollTimer);
  if (authorizedClient) {
    clearUserCartAndFilters(authorizedClient);
    try {
      localStorage.removeItem('zigzag_client');
      localStorage.removeItem('zigzag_sheet');
      localStorage.removeItem('zigzag_client_rows');
      localStorage.removeItem('zigzag_filters_' + userStorageId());
      localStorage.removeItem('zigzag_filters_open_' + userStorageId());
      localStorage.removeItem('zigzag_admin_price_mode_' + userStorageId());
    } catch(e) {}
  }
  authorizedClient = '';
  userSheetType = '';
  clientRowsData = [];
  cart = {};
  favoritesSet.clear();
  modalFieldsInitialized = false;
  catalogLoaded = false;
  pendingRestoreToast = false;

  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('flex');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('passwordInput').value = '';
}

function initAppAfterAuth() {
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('flex');
  document.getElementById('welcomeMsg').innerText = `Բարև ձեզ, ${authorizedClient}։`;

  const wholesaleFilterLabel = document.getElementById('wholesaleOnlyFilterLabel');
  if (wholesaleFilterLabel) wholesaleFilterLabel.classList.toggle('hidden', !isAdminUser());
  document.querySelectorAll('.admin-price-mode-wrap').forEach(el => el.classList.toggle('hidden', !isAdminUser()));
  loadAdminOrderPriceMode();

  loadFavorites();
  setupTableHeader();
  loadPriceData();
  loadCartFromStorage(true);
}

function setupTableHeader() {
const headerRow = document.getElementById('tableHeaderRow');
const catalogTable = document.getElementById('catalogTable');
catalogTable.classList.remove('layout-standard', 'layout-resale', 'layout-admin');
catalogTable.classList.add(isAdminUser() ? 'layout-admin' : (serverIdentity?.allowResale ? 'layout-resale' : 'layout-standard'));
const thClass = "font-semibold text-gray-700 dark:text-gray-300 tracking-normal break-words border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 whitespace-normal";

let cols = [
  { name: '⭐', align: 'text-center' },
  { name: 'Արտիկուլ / Որոնում', sort: 'articul', align: 'text-left' },
  { name: 'Բրենդ', sort: 'brand', align: 'text-left' },
  { name: 'Անվանում', sort: 'name', align: 'text-left' },
  { name: 'Առկայու&shy;թյուն', sort: 'stockStatus', align: 'text-left' },
  { name: 'Մանրա&shy;ծախ', sort: 'retail', align: 'text-right' }
];

if (serverIdentity?.allowResale) {
  cols.push({ name: 'Վերա&shy;վաճառքի մեծա&shy;ծախ գին', sort: 'resaleWholesale', align: 'text-right' });
}

if (isAdminUser()) {
  cols.push({ name: 'KP գին', sort: 'kpPrice', align: 'text-right' });
  cols.push({ name: 'KP եկամտա&shy;բերություն', sort: 'kpMarginVal', align: 'text-center' });
  cols.push({ name: 'Մեծածախ գին', sort: 'wholesale', align: 'text-right' });
  cols.push({ name: 'Մեծածախ եկամտա&shy;բերություն', sort: 'marginVal', align: 'text-center' });
} else {
  cols.push({ name: '<span class="catalog-margin-heading">Եկամտա&shy;բերություն</span>', sort: 'marginVal', align: 'text-center' });
  cols.push({ name: 'Մեծա&shy;ծախ', sort: 'wholesale', align: 'text-right' });
}
cols.push({ name: 'Գործո&shy;ղություն', align: 'text-center' });

headerRow.innerHTML = cols.map(c => `<th style="height:48px;max-height:48px;padding:6px 8px;line-height:1.15;vertical-align:middle" class="${thClass} ${c.align}">${c.sort ? `<button type="button" class="column-sort-button" data-sort-column="${c.sort}" title="Սեղմեք՝ փոխելու դասավորությունը"><span>${c.name}</span><span class="sort-arrow" aria-hidden="true">↕</span></button>` : c.name}</th>`).join('');
document.getElementById('mobileColumnSort').innerHTML='<span class="mobile-sort-label">Սորտավորել՝</span>'+cols.filter(c=>c.sort).map(c=>`<button type="button" data-sort-column="${c.sort}"><span>${c.name}</span><span class="sort-arrow" aria-hidden="true">↕</span></button>`).join('');
updateColumnSortIndicators();
requestAnimationFrame(fitCatalogHeadings);
headerRow.style.setProperty('height', '48px', 'important');
headerRow.querySelectorAll('th').forEach(th => {
  th.style.setProperty('height', '48px', 'important');
  th.style.setProperty('max-height', '48px', 'important');
  th.style.setProperty('padding-block', '6px', 'important');
  th.style.setProperty('line-height', '1.15', 'important');
});
updateStickyOffsets();
}

document.addEventListener('DOMContentLoaded', async () => {
hideVersionBadge();
try { await acceptIdentity(await secureApi('me')); } catch(e) {
  if(sessionStorage.getItem('zzws_session_v3'))sessionLoadFailed(e.message);
  else{finishSessionLoading();if (!e.message.includes('Մուտք գործեք')) document.getElementById('auth-status').textContent = 'Սերվերը հասանելի չէ։';}
}

const pwdInput = document.getElementById('passwordInput');
if (pwdInput) {
  pwdInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkPassword(); });
}

window.onscroll = function() { checkScrollPosition(); };

setupIntersectionObserver();

document.addEventListener('click', (e) => {
  if (e.target.closest && e.target.closest(
    '#brandDropdown, #brandInput, #clearBrandBtn, [data-act="pick-brand"], ' +
    '#categoryDropdown, #categoryInput, #clearCategoryBtn, [data-act="pick-category"]'
  )) return;

  const brandDropdown = document.getElementById('brandDropdown');
  if (brandDropdown) brandDropdown.classList.add('hidden');

  const categoryDropdown = document.getElementById('categoryDropdown');
  if (categoryDropdown) categoryDropdown.classList.add('hidden');
});
});

function checkScrollPosition() {
  const btn = document.getElementById('scrollTopBtn');
  const app = document.getElementById('mainApp');
  if (!btn || !app || app.classList.contains('hidden')) {
    if (btn) btn.classList.add('hidden');
    return;
  }

  const isScrolled = document.body.scrollTop > 300 || document.documentElement.scrollTop > 300;
  btn.classList.toggle('hidden', !isScrolled);
}

function setupIntersectionObserver() {
  const sentinel = document.getElementById('scrollSentinel');
  if (!sentinel) return;

  if (observer) observer.disconnect();

  const options = {
    root: null,
    rootMargin: '600px',
    threshold: 0.01
  };

  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && displayedCount < filteredProducts.length && !isLoadingMore) {
        loadMoreProducts();
      }
    });
  }, options);

  observer.observe(sentinel);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatExcelDateText(rawText) {
  if (!rawText) return '';
  let cleanStr = String(rawText).trim();
  if (cleanStr.toLowerCase().includes('на ')) {
    cleanStr = cleanStr.split(/на\s+/i)[1] || cleanStr;
  }
  
  const parsedDate = new Date(cleanStr);
  if (!isNaN(parsedDate.getTime())) {
    const pad = n => String(n).padStart(2, '0');
    const dd = pad(parsedDate.getDate());
    const mm = pad(parsedDate.getMonth() + 1);
    const yy = String(parsedDate.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }
  return cleanStr;
}

function priceDateFromRows(rows) {
  return rows && rows[0] && rows[0][0] ? formatExcelDateText(rows[0][0]) : '';
}

async function fetchPriceRows() {
  const data = await secureApi('catalog');
  return {rows:data.products, dateText:data.updated};
}

function applyPriceDate(dateText) {
  if (!dateText) return;
  cachedPriceDateText = dateText;
  document.getElementById('priceDateBadge').innerText = `📅 Թարմացում ${dateText}`;
}

async function loadPriceData() {
  const skeleton = document.getElementById('skeletonLoader');
  const errorBox = document.getElementById('dataErrorBox');
  const content = document.getElementById('catalogContent');
  errorBox.classList.add('hidden');
  skeleton.classList.remove('hidden');
  content.classList.add('opacity-40');
  try {
    const result = await fetchPriceRows();
    loadedPriceFingerprint = fingerprintRows(result.rows);
    applyPriceDate(result.dateText);
    parseExcelRows(result.rows);
    notifyIfPriceChanged();
    fetchPriceStamp().then(st => { lastPriceStamp = st; });
  } catch (error) {
    finishSessionLoading();
    console.error(error);
    skeleton.classList.add('hidden');
    errorBox.classList.remove('hidden');
    document.getElementById('dataErrorText').innerText = error.message || 'Չհաջողվեց կարդալ տվյալների ֆայլը:';
  }
}

async function loadPriceDataSilent() {
  try {
    const result = await fetchPriceRows();
    applyPriceDate(result.dateText);
    parseExcelRows(result.rows, true);
  } catch (e) {}
}

function finalizeDataLoad() {
  productIndex = new Map();
  allProducts.forEach(p => { if (!productIndex.has(p.articul)) productIndex.set(p.articul, p); });
  catalogLoaded = true;
  finishSessionLoading();
  reconcileCart();

  initFilters();
  loadSavedFilters();
  resetAndRender();

  document.getElementById('skeletonLoader').classList.add('hidden');
  document.getElementById('catalogContent').classList.remove('opacity-40');
}

function parseExcelRows(products, isSilent = false) {
  allProducts = products;
  finalizeDataLoad();
  if (isSilent && !document.getElementById('orderModal').classList.contains('hidden')) renderModalItems();
}

async function downloadFullPriceList() {
  try {
    const response = await ZZWS.request('catalog/export');
    if (!response.ok) { if (response.status === 401) lockCatalog(); throw new Error('Չհաջողվեց արտահանել գնացուցակը'); }
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement('a'); a.href=url; a.download='PriceList.xlsx'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  } catch(e) { alert(e.message); }
}
