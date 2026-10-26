async function loadPasswordsFile() {
passMap["d5c33d07c18e87a43d93fc607e4acc15caab0f59048a60bc034fe1737d428964"] = { 
  client: "Администратор", 
  sheet: "Dealers",
  rowsList: [{ organization: "Администрация", address: "Ереван", contact: "Админ" }]
};
passMap["4968b9f57008b3923fa706160108da7ab27ddecaf7a5d2b70503c1b3ee0207af"] = {
  client: ADDITIONAL_ADMIN_NAME,
  sheet: "Dealers",
  rowsList: [{ organization: ADDITIONAL_ADMIN_NAME, address: "", contact: "" }]
};

try {
const response = await fetch('pass.xlsx', { cache: 'no-cache' });
if (!response.ok) throw new Error('pass.xlsx ֆայլը չի գտնվել');
const arrayBuffer = await response.arrayBuffer();
const workbook = XLSX.read(arrayBuffer, { type: 'array' });

workbook.SheetNames.forEach(sheetName => {
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

let headerIdx = 0;
let headers = [];
let brandColIdx = -1;
if (rows.length > 0) {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    let rStr = (rows[i] || []).map(c => String(c || '').toLowerCase()).join(' ');
    if (rStr.includes('pass') || rStr.includes('пароль') || rStr.includes('контрагент') || rStr.includes('գաղտնաբառ')) {
      headerIdx = i;
      headers = rows[i].map(h => String(h || '').trim());
      break;
    }
  }
}

let passColIdx = 0;
let clientColIdx = 1;

headers.forEach((h, idx) => {
  let hL = h.toLowerCase().replace(/\s+/g, ' ').trim();
  if (hL.includes('pass') || hL.includes('пароль') || hL.includes('գաղտնաբառ')) passColIdx = idx;
  if (hL.includes('контрагент') || hL.includes('клиент') || hL.includes('կոնտրագենտ')) clientColIdx = idx;
  if (hL.includes('марка') && hL.includes('бренд') || hL === 'brand') brandColIdx = idx;
});

for (let i = headerIdx + 1; i < rows.length; i++) {
  let r = rows[i];
  if (!r || r.length === 0) continue;
  let pRaw = r[passColIdx];
  let pHash = pRaw !== null && pRaw !== undefined ? String(pRaw).trim().toLowerCase() : '';
  let client = r[clientColIdx] !== null && r[clientColIdx] !== undefined ? String(r[clientColIdx]).trim() : '';
  
  if (pHash) {
    let rowDataObj = {
      client: client,
      sheet: sheetName,
      rowsList: [],
      allowedBrands: sheetName === 'KP' ? parseAllowedBrands(brandColIdx === -1 ? '' : r[brandColIdx]) : null
    };
    let orgs = [], addrs = [], contacts = [];

    for (let k = 1; k <= 5; k++) {
      let orgVal = '', addrVal = '', contVal = '';
      headers.forEach((h, idx) => {
        let hClean = h.replace(/\s+/g, ' ').trim().toLowerCase();
        let val = r[idx] !== undefined && r[idx] !== null ? String(r[idx]).trim() : '';
        if (!val) return;
        if (hClean === `կազմակերպություն ${k}` || hClean === `organization ${k}` || (k === 1 && (hClean === 'կազ��ակերպություն' || hClean === 'контрагент'))) orgVal = val;
        if (hClean === `առաքման հացսե ${k}` || hClean === `առաքման հասցե ${k}` || hClean === `address ${k}` || (k === 1 && (hClean === 'առաքման հացսե' || hClean === 'առաքման հասցե'))) addrVal = val;
        if (hClean === `կոնտակտային անձ ${k}` || hClean === `contact ${k}` || (k === 1 && (hClean === 'կոնտակտային անձ' || hClean === 'contact'))) contVal = val;
      });
      if (orgVal || addrVal || contVal) {
        orgs.push(orgVal || client);
        addrs.push(addrVal);
        contacts.push(contVal);
      }
    }

    if (orgs.length === 0) {
      let singleOrg = client, singleAddr = '', singleCont = '';
      headers.forEach((h, idx) => {
        let hL = h.toLowerCase();
        let val = r[idx] !== undefined && r[idx] !== null ? String(r[idx]).trim() : '';
        if (!val) return;
        if (hL.includes('контрагент') || hL.includes('клиент') || hL.includes('կոնտրագենտ') || hL.includes('կազմակերպություն')) singleOrg = val;
        if (hL.includes('адрес') || hL.includes('հասցե')) singleAddr = val;
        if (hL.includes('контакт') || hL.includes('կոնտակտ') || hL.includes('contact')) singleCont = val;
      });
      orgs.push(singleOrg);
      addrs.push(singleAddr);
      contacts.push(singleCont);
    }

    let maxLen = Math.max(orgs.length, addrs.length, contacts.length);
    for (let k = 0; k < maxLen; k++) {
      let oName = orgs[k] || orgs[0] || client;
      let aName = addrs[k] || addrs[0] || '';
      let cName = contacts[k] || contacts[0] || '';
      if (oName || aName || cName) {
        rowDataObj.rowsList.push({ organization: oName, address: aName, contact: cName });
      }
    }

    if (rowDataObj.rowsList.length === 0) {
      rowDataObj.rowsList.push({ organization: client, address: '', contact: '' });
    }
    passMap[pHash] = rowDataObj;
  }
}
});
} catch (e) {
  console.error("Ошибка чтения pass.xlsx:", e);
}
}

async function checkPassword() {
let inputVal = document.getElementById('passwordInput').value.trim();
const errorMsg = document.getElementById('errorMsg');
if (!inputVal) return;

if (inputVal.length < 6 && /^\d+$/.test(inputVal)) {
  inputVal = inputVal.padStart(6, '0');
}

const inputHash = await sha256(inputVal);
if (passMap[inputHash]) {
  authorizedClient = passMap[inputHash].client;
  userSheetType = passMap[inputHash].sheet;
  clearUserCartAndFilters(authorizedClient);
  const wholesaleFilterLabel = document.getElementById('wholesaleOnlyFilterLabel');
  if (wholesaleFilterLabel) wholesaleFilterLabel.classList.toggle('hidden', !isAdminUser());
  clientRowsData = passMap[inputHash].rowsList || [];
  try {
    localStorage.setItem('zigzag_client', authorizedClient);
    localStorage.setItem('zigzag_sheet', userSheetType);
    localStorage.setItem('zigzag_client_rows', JSON.stringify(clientRowsData));
  } catch(e) {}
  
  document.getElementById('authScreen').classList.add('hidden');
  showPriceUpdatePopupAndStart();
} else {
  errorMsg.innerText = 'Սխալ գաղտնաբառ։ Փորձեք կրկին։';
  errorMsg.classList.remove('hidden');
}
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
  const key = 'zigzag_seen_price_' + authorizedClient;
  let prev = null;
  try { prev = localStorage.getItem(key); localStorage.setItem(key, cachedPriceDateText); } catch (e) {}
  if (prev && prev !== cachedPriceDateText) showPriceUpdatePopupAndStart(true);
}

let lastPriceStamp = '';
async function fetchPriceStamp() {
  for (const url of ['PriceList_3.json', 'PriceList_3.xlsx']) {
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
      if (r.ok) return url + '|' + (r.headers.get('ETag') || r.headers.get('Last-Modified') || r.headers.get('Content-Length') || '');
    } catch (e) {}
  }
  return '';
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
  try { localStorage.setItem('zigzag_seen_price_' + authorizedClient, cachedPriceDateText); } catch (e) {}
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

function logout() {
  if (backgroundPollTimer) clearTimeout(backgroundPollTimer);
  if (authorizedClient) {
    clearUserCartAndFilters(authorizedClient);
    try {
      localStorage.removeItem('zigzag_client');
      localStorage.removeItem('zigzag_sheet');
      localStorage.removeItem('zigzag_client_rows');
      localStorage.removeItem('zigzag_filters_' + authorizedClient);
      localStorage.removeItem('zigzag_filters_open_' + authorizedClient);
      localStorage.removeItem('zigzag_admin_price_mode_' + authorizedClient);
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
  const adminPriceModeWrap = document.getElementById('adminPriceModeWrap');
  if (adminPriceModeWrap) adminPriceModeWrap.classList.toggle('hidden', !isAdminUser());
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
catalogTable.classList.add(isAdminUser() ? 'layout-admin' : (authorizedClient === 'ՓՐԻԹԻ ՈՒԵՅ ՍՊԸ' ? 'layout-resale' : 'layout-standard'));
const thClass = "font-semibold text-gray-700 dark:text-gray-300 tracking-normal break-words border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 whitespace-normal";

let cols = [
  { name: '⭐', align: 'text-center' },
  { name: 'Արտիկուլ / Որոնում', align: 'text-left' },
  { name: 'Բրենդ', align: 'text-left' },
  { name: 'Անվանում', align: 'text-left' },
  { name: 'Առկայություն', align: 'text-left' },
  { name: 'Մանրածախ', align: 'text-right' }
];

if (authorizedClient === "ՓՐԻԹԻ ՈՒԵՅ ՍՊԸ") {
  cols.push({ name: 'Վերավաճառքի մեծածախ գին', align: 'text-right' });
}

if (isAdminUser()) {
  cols.push({ name: 'KP Price', align: 'text-right' });
  cols.push({ name: 'KP Margin', align: 'text-center' });
  cols.push({ name: 'WS Price', align: 'text-right' });
  cols.push({ name: 'WS Margin', align: 'text-center' });
} else {
  cols.push({ name: 'Եկամտաբերություն', align: 'text-center' });
  cols.push({ name: 'Մեծածախ (Wholesale)', align: 'text-right' });
}
cols.push({ name: 'Գործողություն', align: 'text-center' });

headerRow.innerHTML = cols.map(c => `<th style="height:48px;max-height:48px;padding:6px 8px;line-height:1.15;vertical-align:middle" class="${thClass} ${c.align}">${c.name}</th>`).join('');
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
await loadPasswordsFile();
try {
  const savedClient = localStorage.getItem('zigzag_client');
  const savedSheet = localStorage.getItem('zigzag_sheet');
  const savedRows = localStorage.getItem('zigzag_client_rows');
  if (savedClient && savedSheet) {
    authorizedClient = savedClient;
    userSheetType = savedSheet;
    if (savedRows) {
      try { clientRowsData = JSON.parse(savedRows); } catch(e) {}
    }
    if (!clientRowsData || clientRowsData.length === 0) {
      clientRowsData = [{ organization: authorizedClient, address: '', contact: '' }];
    }
    document.getElementById('authScreen').classList.add('hidden');
    showPriceUpdatePopupAndStart();
  }
} catch(e) {}

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
  let isScrolled = document.body.scrollTop > 300 || document.documentElement.scrollTop > 300;

  if (isScrolled) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
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
  try {
    const r = await fetch('PriceList_3.json', { cache: 'no-cache' });
    if (r.ok) {
      const d = await r.json();
      const rows = Array.isArray(d) ? d : (d && d.rows);
      if (Array.isArray(rows) && rows.length > 0) {
        return { rows: rows, dateText: priceDateFromRows(rows) || (d && d.updated ? formatExcelDateText(d.updated) : '') };
      }
    }
  } catch (e) {}
  const response = await fetch('PriceList_3.xlsx', { cache: 'no-cache' });
  if (!response.ok) throw new Error('PriceList_3.xlsx ֆայլը չի գտնվել սերվերում');
  const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  return { rows: rows, dateText: priceDateFromRows(rows) };
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
  reconcileCart();

  initFilters();
  loadSavedFilters();
  resetAndRender();

  document.getElementById('skeletonLoader').classList.add('hidden');
  document.getElementById('catalogContent').classList.remove('opacity-40');
}

function parseExcelRows(rows, isSilent = false) {
try {
catalogLoaded = false;
allProducts = [];
let headerRowIdx = 0;
for (let i = 0; i < Math.min(rows.length, 25); i++) {
  const row = rows[i];
  if (!row || !Array.isArray(row)) continue;
  const rowStr = row.map(c => (c !== null && c !== undefined ? String(c) : '').toLowerCase()).join(' ');
  if (rowStr.includes('artikul') || rowStr.includes('brand') || rowStr.includes('wholesale') || rowStr.includes('գին') || rowStr.includes('артикул') || rowStr.includes('արտիկուլ')) {
    headerRowIdx = i;
    break;
  }
}

const headerRow = (rows[headerRowIdx] && Array.isArray(rows[headerRowIdx])) ? rows[headerRowIdx] : [];
const headers = headerRow.map(c => (c !== null && c !== undefined ? String(c).trim() : ''));

const colMap = {
  art: headers.findIndex(h => h && (h.toLowerCase().includes('art') || h.toLowerCase().includes('артикул') || h.toLowerCase().includes('արտիկուլ'))),
  brand: headers.findIndex(h => h && (h.toLowerCase().includes('brand') || h.toLowerCase().includes('бренд') || h.toLowerCase().includes('բրենդ'))),
  category: headers.findIndex(h => h && (h.toLowerCase().includes('group') || h.toLowerCase().includes('kategoriya') || h.toLowerCase().includes('группа') || h.toLowerCase().includes('категория') || h.toLowerCase().includes('խումբ') || h.toLowerCase().includes('կատեգորիա'))),
  name: headers.findIndex(h => h && (h.toLowerCase().includes('name') || h.toLowerCase().includes('naimenovanie') || h.toLowerCase().includes('наименование') || h.toLowerCase().includes('товар') || h.toLowerCase().includes('անվանում'))),
  retail: headers.findIndex(h => h && (h.includes('Զեղչված') || h.toLowerCase().includes('roznich') || h.toLowerCase().includes('discount') || h.toLowerCase().includes('մանրածախ'))),
  baseRetail: headers.findIndex(h => h && (h.toLowerCase().includes('roznich') || h.toLowerCase().includes('մանրածախ') || h.toLowerCase().includes('розница'))),
  wholesale: headers.findIndex(h => h && (h.includes('Wholesale') || h.toLowerCase().includes('wholesale') || h.toLowerCase().includes('опт') || h.toLowerCase().includes('մեծածախ'))),
  kpPromo: headers.findIndex(h => h && h.includes("Key Partner's promo AMD")),
  kpNormal: headers.findIndex(h => h && h.includes("Key Partner's AMD")),
  wsAmd: headers.findIndex(h => h && h.trim().toLowerCase() === 'wholesale amd')
};

if (colMap.art === -1) colMap.art = 0;
if (colMap.brand === -1) colMap.brand = 1;
if (colMap.category === -1) colMap.category = 2;
if (colMap.name === -1) colMap.name = 4;
if (colMap.retail === -1) colMap.retail = 5;
if (colMap.wholesale === -1) colMap.wholesale = 6;

const warehouseCols = [];
for (let j = 0; j < headers.length; j++) {
  if (j !== colMap.art && j !== colMap.brand && j !== colMap.category && j !== colMap.name && j !== colMap.retail && j !== colMap.baseRetail && j !== colMap.wholesale && j !== colMap.kpPromo && j !== colMap.kpNormal && j !== colMap.wsAmd) {
    let hName = headers[j];
    if (hName) warehouseCols.push({ index: j, name: hName });
  }
}

const isDomusUser = authorizedClient.toUpperCase().includes('ԴՈՄՈՒՍ') || authorizedClient.toUpperCase().includes('ДОМУՍ') || authorizedClient.toUpperCase().includes('DOMUS');

for (let i = headerRowIdx + 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !Array.isArray(r) || r.length === 0) continue;

  const artVal = r[colMap.art];
  const art = (artVal !== null && artVal !== undefined) ? String(artVal).trim() : '';
  if (!art || art.toLowerCase().includes('artikul') || art.length > 30) continue;

  const defaultWholesale = Number(r[colMap.wholesale]) || 0;
  let wholesale = 0, isWholesalePromo = false, resaleWholesale = defaultWholesale;

  if (userSheetType === 'KP' && !isAdminUser()) {
    const promoVal = colMap.kpPromo !== -1 ? Number(r[colMap.kpPromo]) : 0;
    const normalVal = colMap.kpNormal !== -1 ? Number(r[colMap.kpNormal]) : 0;
    if (promoVal && promoVal > 0) {
      wholesale = promoVal;
      isWholesalePromo = true;
    } else if (normalVal && normalVal > 0) {
      wholesale = normalVal;
    } else {
      wholesale = defaultWholesale;
    }
  } else {
    wholesale = defaultWholesale;
  }

  let kpPrice = 0, kpIsPromo = false;
  if (isAdminUser()) {
    const wsCol = colMap.wsAmd !== -1 ? colMap.wsAmd : colMap.wholesale;
    wholesale = Number(r[wsCol]) || 0;
    isWholesalePromo = false;
    const kpPromoV = colMap.kpPromo !== -1 ? Number(r[colMap.kpPromo]) : 0;
    const kpNormV = colMap.kpNormal !== -1 ? Number(r[colMap.kpNormal]) : 0;
    if (kpPromoV > 0) { kpPrice = kpPromoV; kpIsPromo = true; }
    else if (kpNormV > 0) { kpPrice = kpNormV; }
  }

  // Наличие оптовой цены: для Администратора проверяются обе цены (KP или WS), а для остальных клиентов — обычная оптовая цена
  const hasWsPrice = Number.isFinite(wholesale) && wholesale > 0;
  const hasKpPrice = Number.isFinite(kpPrice) && kpPrice > 0;
  const isEligibleWholesale = hasWsPrice || hasKpPrice;

  if (!isEligibleWholesale && !isAdminUser()) continue;

  const brandVal = r[colMap.brand];
  const brand = (brandVal !== null && brandVal !== undefined) ? String(brandVal).trim() : 'Այլ';
  const brandKey = normalizeAccessBrand(brand);

  const catVal = r[colMap.category];
  const category = (catVal !== null && catVal !== undefined) ? String(catVal).trim() : 'Ընդհանուր';

  if (userSheetType === 'KP' && !isAdminUser()) {
    const partnerRecord = getAuthorizedPartnerRecord();
    const brandRule = partnerRecord && partnerRecord.allowedBrands;
    if (!brandRule || (!brandRule.all && !brandRule.brands.includes(brandKey))) continue;

    if (brandKey === 'miele') continue;
    if (brandKey === 'sony' && normalizeAccessBrand(category).includes(normalizeAccessBrand('Հեռուստացույց'))) continue;
  }

  let name = '';
  if (r[colMap.name] !== undefined && r[colMap.name] !== null) {
    name = String(r[colMap.name]).trim();
  } else {
    for (let cell of r) {
      if (typeof cell === 'string' && cell.length > 3 && cell !== art && cell !== brand && cell !== category) {
        name = cell.trim();
        break;
      }
    }
  }

  const retail = Number(r[colMap.retail]) || 0;
  const baseRetail = colMap.baseRetail !== -1 ? (Number(r[colMap.baseRetail]) || retail) : retail;
  const isPromo = retail > 0 && baseRetail > 0 && retail < baseRetail;

  let marginVal = 0;
  if (retail > 0 && wholesale > 0) {
    marginVal = isDomusUser ? (retail / wholesale) : ((1 - (wholesale / retail)) * 100);
  }

  // Отдельная маржа для KP Price у Администратора
  let kpMarginVal = 0;
  if (isAdminUser() && retail > 0 && kpPrice > 0) {
    kpMarginVal = isDomusUser ? (retail / kpPrice) : ((1 - (kpPrice / retail)) * 100);
  }

  if (!isAdminUser() && retail > 0 && wholesale > 0) {
    if (userSheetType === 'KP') {
      if (wholesale > retail) continue;
    } else {
      if (isDomusUser && marginVal < 1.0) continue;
      if (!isDomusUser && marginVal < 0) continue;
    }
  }

  let adminStockDetails = [], targetWarehousesStock = 0, otherWarehousesSum = 0, baseSum = 0, otherStockList = [];

  warehouseCols.forEach(wh => {
    const qty = Number(r[wh.index]) || 0;
    if (qty > 0) {
      const wName = wh.name.trim();
      if (['003', '023', '026', '031'].includes(wName)) {
        baseSum += qty;
        targetWarehousesStock += qty;
      } else {
        otherStockList.push({ name: wName, qty: qty });
        otherWarehousesSum += qty;
      }
    }
  });

  if (baseSum > 0) adminStockDetails.push({ name: 'База', qty: baseSum });
  otherStockList.forEach(item => adminStockDetails.push(item));

  let stockStatus = '', isValidStock = false;
  if (isAdminUser()) {
    if (adminStockDetails.length > 0) {
      isValidStock = true;
      stockStatus = adminStockDetails.map(s => `${s.name}: ${s.qty}`).join(', ');
    }
  } else {
    if (targetWarehousesStock >= 3) {
      isValidStock = true;
      stockStatus = 'Առկա է';
    } else if (targetWarehousesStock === 0 && otherWarehousesSum < 5) {
      isValidStock = false;
    } else {
      isValidStock = true;
      stockStatus = 'Ճշտել';
    }
  }

  if (isValidStock) {
    allProducts.push({
      articul: art, brand: brand, category: category, name: name,
      retail: retail, isPromo: isPromo, wholesale: wholesale,
      isWholesalePromo: isWholesalePromo, resaleWholesale: resaleWholesale, 
      hasWholesale: isEligibleWholesale, // Флаг наличия хотя бы одной из двух цен (KP или WS)
      kpPrice: kpPrice, kpIsPromo: kpIsPromo,
      marginVal: marginVal, kpMarginVal: kpMarginVal, stockStatus: stockStatus,
      targetWarehousesStock: targetWarehousesStock
    });
  }
}

finalizeDataLoad();
if (isSilent) {
  const modalEl = document.getElementById('orderModal');
  if (modalEl && !modalEl.classList.contains('hidden')) {
    renderModalItems();
  }
}
} catch (err) {
  console.error(err);
  if (!isSilent) {
    document.getElementById('skeletonLoader').classList.add('hidden');
    document.getElementById('dataErrorBox').classList.remove('hidden');
    document.getElementById('dataErrorText').innerText = 'Սխալ Excel ֆայլի մշակման ընթացքում:';
  }
}
}

function downloadFullPriceList() {
  if (allProducts.length === 0) {
    alert('Տվյալները դեռ չեն բեռնվել կամ ապրանքներ չկան:');
    return;
  }

  const isDomusUser = authorizedClient.toUpperCase().includes('ԴՈՄՈՒՍ') || authorizedClient.toUpperCase().includes('ДОМУՍ') || authorizedClient.toUpperCase().includes('DOMUS');

  const exportRows = allProducts.map(p => {
    let rowObj = {
      'Արտիկուլ': p.articul,
      'Բրենդ': p.brand,
      'Կատեգորիա': p.category,
      'Անվանում': p.name,
      'Առկայություն': p.stockStatus,
      'Մանրածախ գին (AMD)': p.retail || 0
    };

    if (authorizedClient === "ՓՐԻԹԻ ՈՒԵՅ ՍՊԸ") {
      rowObj['Վերավաճառքի մեծածախ գին'] = p.resaleWholesale || 0;
    }

    if (isAdminUser()) {
      rowObj['KP Price (AMD)'] = p.kpPrice > 0 ? p.kpPrice : '';
      rowObj['KP Margin'] = p.retail > 0 && p.kpPrice > 0 ? (isDomusUser ? Number(p.kpMarginVal.toFixed(2)) : Number(p.kpMarginVal.toFixed(1))) : 0;
      rowObj['WS Price (AMD)'] = p.wholesale || 0;
      rowObj['WS Margin'] = p.retail > 0 && p.wholesale > 0 ? (isDomusUser ? Number(p.marginVal.toFixed(2)) : Number(p.marginVal.toFixed(1))) : 0;
    } else {
      rowObj['Եկամտաբերություն'] = p.retail > 0 ? (isDomusUser ? Number(p.marginVal.toFixed(2)) : Number(p.marginVal.toFixed(1))) : 0;
      rowObj['Մեծածախ գին (AMD)'] = p.wholesale || 0;
    }
    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Գնացուցակ");

  const colKeys = Object.keys(exportRows[0] || {});
  const colWidths = colKeys.map(key => {
    let maxLen = key ? String(key).length : 10;
    exportRows.forEach(row => {
      const val = row[key];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    });
    return { wch: maxLen + 4 };
  });
  worksheet['!cols'] = colWidths;

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fileName = `Full_PriceList_${authorizedClient.replace(/[\s"']/g, '_')}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}

