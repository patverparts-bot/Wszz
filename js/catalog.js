function renderFilterChips(root,values,remove){root.replaceChildren();for(const value of values){const button=document.createElement('button');button.type='button';button.className='filter-chip';button.textContent=value+' ×';button.setAttribute('aria-label','Հեռացնել '+value);button.onclick=e=>{e.stopPropagation();remove(value);};root.append(button);}}
function initFilters() {
availableBrands = [...new Set(allProducts.map(p => p.brand).filter(b => b))].sort();
availableCategories = [...new Set(allProducts.map(p => p.category).filter(c => c))].sort();
renderBrandDropdown(availableBrands);
renderCategoryDropdown(availableCategories);
}

function getCategoryOptionsForSelectedBrands() {
  const matchingCategories = new Set(allProducts
    .filter(p => !selectedBrands.length || selectedBrands.some(b => String(p.brand || '').toLowerCase() === b.toLowerCase()))
    .map(p => String(p.category || ''))
    .filter(Boolean));
  return availableCategories.filter(category => matchingCategories.has(category));
}

function getBrandOptionsForSelectedCategories() {
  const matchingBrands = new Set(allProducts
    .filter(p => !selectedCategories.length || selectedCategories.some(c => String(p.category || '').toLowerCase() === c.toLowerCase()))
    .map(p => String(p.brand || ''))
    .filter(Boolean));
  return availableBrands.filter(brand => matchingBrands.has(brand));
}

function reconcileFilterSelections() {
  const categoryOptions = new Set(getCategoryOptionsForSelectedBrands().map(c => c.toLowerCase()));
  selectedCategories = selectedCategories.filter(c => categoryOptions.has(c.toLowerCase()));

  const brandOptions = new Set(getBrandOptionsForSelectedCategories().map(b => b.toLowerCase()));
  selectedBrands = selectedBrands.filter(b => brandOptions.has(b.toLowerCase()));
}

function renderDependentFilterOptions() {
  const brandQuery = document.getElementById('brandInput').value.trim().toLowerCase();
  const categoryQuery = document.getElementById('categoryInput').value.trim().toLowerCase();
  renderBrandDropdown(getBrandOptionsForSelectedCategories().filter(b => b.toLowerCase().includes(brandQuery)));
  renderCategoryDropdown(getCategoryOptionsForSelectedBrands().filter(c => c.toLowerCase().includes(categoryQuery)));
}

function renderBrandDropdown(brands) {
  const dropdown = document.getElementById('brandDropdown');
  if (!brands || brands.length === 0) {
    dropdown.innerHTML = '<div class="p-2.5 text-gray-400 dark:text-gray-500 text-xs text-center">Ոչինչ չի գտնվել</div>';
    return;
  }
  dropdown.innerHTML = brands.map(b => {
    const checked = selectedBrands.includes(b) ? 'checked' : '';
    return `<label data-act="pick-brand" data-value="${escapeHtml(b)}" class="${checked?'filter-option-selected ':''}flex items-center gap-2 px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer font-medium text-gray-800 dark:text-gray-200 transition border-b border-gray-50 dark:border-gray-700 last:border-none"><input type="checkbox" ${checked} tabindex="-1" class="w-4 h-4 rounded text-blue-600"><span>${escapeHtml(b)}</span></label>`;
  }).join('');
}

function showBrandDropdown() { document.getElementById('brandDropdown').classList.remove('hidden'); }

function filterBrandOptions() {
  const query = document.getElementById('brandInput').value.trim().toLowerCase();
  document.getElementById('clearBrandBtn').classList.toggle('hidden', !query && !selectedBrands.length);
  renderBrandDropdown(getBrandOptionsForSelectedCategories().filter(b => b.toLowerCase().includes(query)));
  showBrandDropdown();
}

function selectBrand(brand) {
  if (selectedBrands.includes(brand)) selectedBrands = selectedBrands.filter(b => b !== brand);
  else selectedBrands.push(brand);
  reconcileFilterSelections();
  updateBrandSelectionSummary();
  updateCategorySelectionSummary();
  renderDependentFilterOptions();
  showBrandDropdown();
  resetAndRender();
}

function updateBrandSelectionSummary() {
  const summary = document.getElementById('brandSelectionSummary');
  const clearBtn = document.getElementById('clearBrandBtn');
  if (!summary) return;
  renderFilterChips(summary,selectedBrands,brand=>{selectedBrands=selectedBrands.filter(v=>v!==brand);reconcileFilterSelections();updateBrandSelectionSummary();updateCategorySelectionSummary();renderDependentFilterOptions();resetAndRender();});
  summary.classList.toggle('hidden', selectedBrands.length === 0);
  clearBtn.classList.toggle('hidden', selectedBrands.length === 0 && !document.getElementById('brandInput').value);
}

function clearBrandSelection() {
  selectedBrands = [];
  document.getElementById('brandInput').value = '';
  document.getElementById('clearBrandBtn').classList.add('hidden');
  updateBrandSelectionSummary();
  reconcileFilterSelections();
  updateCategorySelectionSummary();
  renderDependentFilterOptions();
  resetAndRender();
}

function renderCategoryDropdown(categories) {
  const dropdown = document.getElementById('categoryDropdown');
  if (!categories || categories.length === 0) {
    dropdown.innerHTML = '<div class="p-2.5 text-gray-400 dark:text-gray-500 text-xs text-center">Ոչինչ չի գտնվել</div>';
    return;
  }
  dropdown.innerHTML = categories.map(c => {
    const checked = selectedCategories.includes(c) ? 'checked' : '';
    return `<label data-act="pick-category" data-value="${escapeHtml(c)}" class="${checked?'filter-option-selected ':''}flex items-center gap-2 px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer font-medium text-gray-800 dark:text-gray-200 transition border-b border-gray-50 dark:border-gray-700 last:border-none"><input type="checkbox" ${checked} tabindex="-1" class="w-4 h-4 rounded text-blue-600"><span>${escapeHtml(c)}</span></label>`;
  }).join('');
}

function showCategoryDropdown() { document.getElementById('categoryDropdown').classList.remove('hidden'); }

function filterCategoryOptions() {
  const query = document.getElementById('categoryInput').value.trim().toLowerCase();
  document.getElementById('clearCategoryBtn').classList.toggle('hidden', !query && !selectedCategories.length);
  renderCategoryDropdown(getCategoryOptionsForSelectedBrands().filter(c => c.toLowerCase().includes(query)));
  showCategoryDropdown();
}

function selectCategory(category) {
  if (selectedCategories.includes(category)) selectedCategories = selectedCategories.filter(c => c !== category);
  else selectedCategories.push(category);
  reconcileFilterSelections();
  updateCategorySelectionSummary();
  updateBrandSelectionSummary();
  renderDependentFilterOptions();
  showCategoryDropdown();
  resetAndRender();
}

function updateCategorySelectionSummary() {
  const summary = document.getElementById('categorySelectionSummary');
  const clearBtn = document.getElementById('clearCategoryBtn');
  if (!summary) return;
  renderFilterChips(summary,selectedCategories,category=>{selectedCategories=selectedCategories.filter(v=>v!==category);reconcileFilterSelections();updateCategorySelectionSummary();updateBrandSelectionSummary();renderDependentFilterOptions();resetAndRender();});
  summary.classList.toggle('hidden', selectedCategories.length === 0);
  clearBtn.classList.toggle('hidden', selectedCategories.length === 0 && !document.getElementById('categoryInput').value);
}

function clearCategorySelection() {
  selectedCategories = [];
  document.getElementById('categoryInput').value = '';
  document.getElementById('clearCategoryBtn').classList.add('hidden');
  updateCategorySelectionSummary();
  reconcileFilterSelections();
  updateBrandSelectionSummary();
  renderDependentFilterOptions();
  resetAndRender();
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').classList.add('hidden');
  resetAndRender();
}

function filterProducts() {
const searchQuery = (document.getElementById('searchInput').value || '').trim().toLowerCase();
const multiSearch=ZZWS_MULTI_SEARCH.compile(document.getElementById('searchInput').value,allProducts);ZZWS_MULTI_SEARCH.highlight(multiSearch);
const sortBy = document.getElementById('sortBy').value;
const favOnly = document.getElementById('favOnlyFilter').checked;
const promoOnly = document.getElementById('promoOnlyFilter').checked;
const stockOnly = document.getElementById('stockOnlyFilter').checked;
const wholesaleOnlyEl = document.getElementById('wholesaleOnlyFilter');
const wholesaleOnly = catalogIsAdmin() && wholesaleOnlyEl && wholesaleOnlyEl.checked;

document.getElementById('clearSearchBtn').classList.toggle('hidden', searchQuery.length === 0);

filteredProducts = allProducts.filter(p => {
  const matchBrand = !selectedBrands.length || selectedBrands.some(b => p.brand.toLowerCase() === b.toLowerCase());
  const matchCategory = !selectedCategories.length || selectedCategories.some(c => p.category.toLowerCase() === c.toLowerCase());
  const matchSearch = !searchQuery || multiSearch.matches.has(p.articul);
  const matchFav = !favOnly || favoritesSet.has(p.articul);
  const matchPromo = !promoOnly || (p.isPromo || p.isWholesalePromo || p.kpIsPromo);
  const matchStock = !stockOnly || p.stockAvailable === true || (p.stockAvailable == null && (String(p.stockStatus||'').trim()==='Առկա է'||catalogIsAdmin()&&p.targetWarehousesStock>=3));
  
  // Условие для Ադմինիստրատորа: проверяет наличие хотя бы одной из оптовых цен (KP price или WS price)
  const matchWholesale = !wholesaleOnly || p.hasWholesale;

  return matchBrand && matchCategory && matchSearch && matchFav && matchPromo && matchStock && matchWholesale;
});

const priceField=document.getElementById('sortPrice').value||'wholesale';
if (sortBy === 'columnAsc' || sortBy === 'columnDesc'){const selection=activeColumnSort();if(allowedSortColumns().includes(selection.key))filteredProducts.sort((a,b)=>compareByColumn(a,b,selection.key,selection.direction));}
else if (sortBy === 'priceAsc' || sortBy === 'priceDesc') filteredProducts.sort((a,b)=>compareProductPrices(a,b,priceField,sortBy==='priceAsc'?1:-1));
else if (sortBy === 'marginDesc') filteredProducts.sort((a, b) => b.marginVal - a.marginVal);
else {
  const order = new Map();
  allProducts.forEach(p => { if (!order.has(p.category)) order.set(p.category, order.size); });
  filteredProducts.sort((a, b) => order.get(a.category) - order.get(b.category));
}
groupByCategory = sortBy === 'default';
categoryCounts = new Map();
filteredProducts.forEach(p => categoryCounts.set(p.category, (categoryCounts.get(p.category) || 0) + 1));

updateColumnSortIndicators();
saveFiltersToStorage();
document.getElementById('productCountInfo').innerText = `Գտնվել է ${filteredProducts.length} ապրանք`;
}

let groupByCategory = true;
let categoryCounts = new Map();
let lastRenderedCategory = null;

function createCategoryRow(category) {
  const tr = document.createElement('tr');
  tr.className = 'category-row';
  const td = document.createElement('td');
  td.colSpan = document.querySelectorAll('#tableHeaderRow th').length || 10;
  td.className = 'bg-indigo-50 dark:bg-gray-700 border-y border-indigo-100 dark:border-gray-600';
  td.innerHTML = `<div class="flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">📂 <span>${escapeHtml(category)}</span><span class="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-gray-600 text-indigo-700 dark:text-indigo-200 text-[10px] font-semibold normal-case">${categoryCounts.get(category) || 0}</span></div>`;
  tr.appendChild(td);
  return tr;
}

function updateStickyOffsets() {
  const bar = document.getElementById('stickySearchBar');
  const thead = document.querySelector('#catalogTable thead');
  const root = document.documentElement.style;
  root.setProperty('--stick-top', (bar ? bar.offsetHeight : 58) + 'px');
  root.setProperty('--thead-h', (thead && thead.offsetHeight ? thead.offsetHeight : 40) + 'px');

  const wrap = document.getElementById('tableScrollWrapper');
  if (wrap) wrap.style.overflowX = 'clip';
}
window.addEventListener('resize', updateStickyOffsets);

function resetAndRender() {
  debouncedResetAndRender.cancel();
  lastRenderedCategory = null;
  filterProducts();
  displayedCount = 0;
  document.getElementById('tableBody').innerHTML = '';
  document.getElementById('mobileCardsContainer').innerHTML = '';
  loadMoreProducts();
  setupIntersectionObserver();
  updateStickyOffsets();
}

function appendProducts(list) {
  if (!list.length) return;
  const desktop = desktopMQ.matches;
  const frag = document.createDocumentFragment();
  list.forEach(p => {
    if (desktop && groupByCategory && p.category !== lastRenderedCategory) {
      frag.appendChild(createCategoryRow(p.category));
      lastRenderedCategory = p.category;
    }
    frag.appendChild(desktop ? createRowElement(p) : createCardElement(p));
  });
  document.getElementById(desktop ? 'tableBody' : 'mobileCardsContainer').appendChild(frag);
}

function rerenderVisible() {
  const keep = displayedCount;
  lastRenderedCategory = null;
  document.getElementById('tableBody').innerHTML = '';
  document.getElementById('mobileCardsContainer').innerHTML = '';
  appendProducts(filteredProducts.slice(0, keep));
}

function loadMoreProducts() {
  const spinner = document.getElementById('infiniteScrollSpinner');
  const textInfo = document.getElementById('infiniteScrollText');
  const noResults = document.getElementById('noResults');

  if (filteredProducts.length === 0) {
    noResults.classList.remove('hidden');
    spinner.classList.add('hidden');
    textInfo.innerText = '';
    isLoadingMore = false;
    return;
  }
  noResults.classList.add('hidden');

  if (isLoadingMore || displayedCount >= filteredProducts.length) return;

  isLoadingMore = true;
  spinner.classList.remove('hidden');
  textInfo.innerText = 'Բեռնվում են հաջորդ ապրանքները...';

  setTimeout(() => {
    const nextBatch = filteredProducts.slice(displayedCount, displayedCount + PAGE_SIZE);
    appendProducts(nextBatch);
    displayedCount += nextBatch.length;
    spinner.classList.add('hidden');
    updateStickyOffsets();

    if (filteredProducts.length > 0 && displayedCount >= filteredProducts.length) {
      textInfo.innerText = `Բեռնված է բոլոր ${filteredProducts.length} ապրանքը`;
    } else {
      textInfo.innerText = '';
    }

    isLoadingMore = false;
  }, 30);
}

function createRowElement(p) {
const tr = document.createElement('tr');
tr.dataset.art = p.articul;
tr.className = 'hover:bg-blue-50/40 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700';

const isUtochnit = p.stockStatus.includes('Ճշտել');
const stockBadgeClass = catalogIsAdmin() ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-mono text-xs' : (isUtochnit ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800');

const isDomusUser = authorizedClient.toUpperCase().includes('ԴՈՄՈՒՍ') || authorizedClient.toUpperCase().includes('ДОМУՍ') || authorizedClient.toUpperCase().includes('DOMUS');

// Генерация баджей маржинальности для обычного пользователя
let marginBadge = '—';
if (p.retail > 0 && p.wholesale > 0) {
  if (isDomusUser) {
    marginBadge = `<span class="px-2 py-1 rounded-lg text-xs font-bold border bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 whitespace-nowrap">${p.marginVal.toFixed(2)}</span>`;
  } else {
    let colorClass = p.marginVal >= 20 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : (p.marginVal < 5 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800');
    marginBadge = `<span class="px-2 py-1 rounded-lg text-xs font-bold border ${colorClass} whitespace-nowrap">${p.marginVal.toFixed(1)}%</span>`;
  }
}

// Отдельная генерация маржинальности для KP и WS у Ադմինիստրատորа
let kpMarginBadge = '—';
if (catalogIsAdmin() && p.retail > 0 && p.kpPrice > 0) {
  if (isDomusUser) {
    kpMarginBadge = `<span class="px-2 py-1 rounded-lg text-xs font-bold border bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 whitespace-nowrap">${p.kpMarginVal.toFixed(2)}</span>`;
  } else {
    let cClass = p.kpMarginVal >= 20 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : (p.kpMarginVal < 5 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800');
    kpMarginBadge = `<span class="px-2 py-1 rounded-lg text-xs font-bold border ${cClass} whitespace-nowrap">${p.kpMarginVal.toFixed(1)}%</span>`;
  }
}

let wsMarginBadge = '—';
if (catalogIsAdmin() && p.retail > 0 && p.wholesale > 0) {
  if (isDomusUser) {
    wsMarginBadge = `<span class="px-2 py-1 rounded-lg text-xs font-bold border bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 whitespace-nowrap">${p.marginVal.toFixed(2)}</span>`;
  } else {
    let cClass = p.marginVal >= 20 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : (p.marginVal < 5 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800');
    wsMarginBadge = `<span class="px-2 py-1 rounded-lg text-xs font-bold border ${cClass} whitespace-nowrap">${p.marginVal.toFixed(1)}%</span>`;
  }
}

let retailCellHtml = p.retail > 0 ? (p.isPromo ? `<div class="flex flex-col items-end"><span class="text-gray-900 dark:text-white font-medium whitespace-nowrap">${p.retail.toLocaleString('hy-AM')} ֏</span><span class="px-1.5 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded text-[10px] font-bold mt-0.5 border border-red-200 dark:border-red-800 whitespace-nowrap">ԱԿՑԻԱ</span></div>` : `<span class="text-gray-600 dark:text-gray-400 whitespace-nowrap">${p.retail.toLocaleString('hy-AM')} ֏</span>`) : '—';
let wholesaleCellHtml = p.wholesale > 0 ? (p.isWholesalePromo ? `<div class="flex flex-col items-end"><span class="text-gray-900 dark:text-white font-semibold whitespace-nowrap">${p.wholesale.toLocaleString('hy-AM')} ֏</span><span class="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-bold mt-0.5 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">Ակցիա</span></div>` : `<span class="text-gray-900 dark:text-white font-semibold whitespace-nowrap">${p.wholesale.toLocaleString('hy-AM')} ֏</span>`) : '—';

let priceTdsHtml = `<td class="text-center">${marginBadge}</td><td class="text-right">${wholesaleCellHtml}</td>`;
if (catalogIsAdmin()) {
  const kpFmt = p.kpPrice > 0 ? p.kpPrice.toLocaleString('hy-AM') + ' ֏' : '';
  const kpHtml = !kpFmt ? '' : (p.kpIsPromo
    ? `<div class="flex flex-col items-end"><span class="text-gray-900 dark:text-white font-semibold whitespace-nowrap">${kpFmt}</span><span class="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-bold mt-0.5 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">Ակցիա</span></div>`
    : `<span class="text-gray-900 dark:text-white font-semibold whitespace-nowrap">${kpFmt}</span>`);
  priceTdsHtml = `<td class="text-right">${kpHtml}</td><td class="text-center">${kpMarginBadge}</td><td class="text-right">${wholesaleCellHtml}</td><td class="text-center">${wsMarginBadge}</td>`;
}

const searchUrl = `https://www.zigzag.am/am/catalogsearch/result/?q=${encodeURIComponent(p.articul)}`;
const cartItem = cart[p.articul];
const actionCellHtml = getActionControlHtml(p.articul, cartItem);
const resaleColHtml = catalogIdentity()?.allowResale ? `<td class="text-right text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">${p.resaleWholesale ? p.resaleWholesale.toLocaleString('hy-AM') + ' ֏' : '—'}</td>` : '';

const isFav = favoritesSet.has(p.articul);
const starIcon = isFav ? '⭐' : '☆';
const starTitle = isFav ? 'Հեռացնել ընտրվածներից' : 'Ավելացնել ընտրվածներում';

tr.innerHTML = `
<td class="text-center">
  <button data-act="toggle-fav" data-art="${escapeHtml(p.articul)}" class="star-btn" aria-label="${starTitle}" title="${starTitle}">${starIcon}</button>
</td>
<td class="font-mono font-medium">
  <div class="flex flex-col gap-1">
    <button type="button" data-act="copy-articul" data-art="${escapeHtml(p.articul)}" title="Պատճենել արտիկուլը" aria-label="Պատճենել արտիկուլը ${escapeHtml(p.articul)}" class="text-left text-blue-600 dark:text-blue-400 font-bold text-xs whitespace-nowrap hover:underline cursor-copy">${escapeHtml(p.articul)}</button>
    <a href="${escapeHtml(searchUrl)}" target="_blank" aria-label="Որոնել կայքում" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 text-[10px] font-semibold transition w-fit shadow-xs" title="Որոնել Zigzag.am կայքում">
      <span>🔍 Որոնել կայքում</span>
    </a>
  </div>
</td>
<td>${getBrandLogoHtml(p.brand)}</td>
<td>
<div class="flex items-center gap-3">
${getProductImageHtml(p.articul, p.name)}
<div class="min-w-0"><span class="text-gray-900 dark:text-white font-medium whitespace-normal">${escapeHtml(p.name || '—')}</span>${groupByCategory ? '' : `<div class="text-[11px] text-gray-500 dark:text-gray-400">${escapeHtml(p.category)}</div>`}<button type="button" class="zigzag-product-ask" data-zigzag-art="${escapeHtml(p.articul)}">ԶիգԶագ · Բնութագրեր</button></div>
</div>
</td>
<td><span class="inline-block px-2.5 py-1 rounded-md font-semibold break-words ${stockBadgeClass}">${escapeHtml(p.stockStatus)}</span></td>
<td class="text-right">${retailCellHtml}</td>
${resaleColHtml}
${priceTdsHtml}
<td class="text-center js-action" data-art="${escapeHtml(p.articul)}">${actionCellHtml}</td>
`;
return tr;
}

function createCardElement(p) {
const div = document.createElement('div');
div.className = 'bg-white dark:bg-gray-800 rounded-xl p-3.5 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between gap-3 relative transition-colors duration-200';

const isUtochnit = p.stockStatus.includes('Ճշտել');
const stockBadgeClass = catalogIsAdmin() ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-mono text-[11px]' : (isUtochnit ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800');
const searchUrl = `https://www.zigzag.am/am/catalogsearch/result/?q=${encodeURIComponent(p.articul)}`;
const cartItem = cart[p.articul];

const isDomusUser = authorizedClient.toUpperCase().includes('ԴՈՄՈՒՍ') || authorizedClient.toUpperCase().includes('ДОМУՍ') || authorizedClient.toUpperCase().includes('DOMUS');

let marginBadge = '';
if (p.retail > 0 && p.wholesale > 0) {
  if (isDomusUser) {
    marginBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold border bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">${p.marginVal.toFixed(2)}</span>`;
  } else {
    let colorClass = p.marginVal >= 20 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : (p.marginVal < 5 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800');
    marginBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold border ${colorClass}">${p.marginVal.toFixed(1)}%</span>`;
  }
}

let kpMarginBadge = '';
if (catalogIsAdmin() && p.retail > 0 && p.kpPrice > 0) {
  if (isDomusUser) {
    kpMarginBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold border bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">${p.kpMarginVal.toFixed(2)}</span>`;
  } else {
    let cClass = p.kpMarginVal >= 20 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : (p.kpMarginVal < 5 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800');
    kpMarginBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold border ${cClass}">${p.kpMarginVal.toFixed(1)}%</span>`;
  }
}

const isFav = favoritesSet.has(p.articul);
const starIcon = isFav ? '⭐' : '☆';
const starTitle = isFav ? 'Հեռացնել ընտրվածներից' : 'Ավելացնել ընտրվածներում';

div.innerHTML = `
<div>
  <div class="flex items-start gap-3">
    ${getProductImageHtml(p.articul, p.name)}
    <div class="flex-grow min-w-0 pr-6">
      <div class="flex items-center justify-between gap-2 mb-1">
        ${getBrandLogoHtml(p.brand)}
        <a href="${escapeHtml(searchUrl)}" target="_blank" aria-label="Որոնել կայքում" class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 text-[10px] font-semibold transition shadow-xs">
          <span>🔍 Որոնել</span>
        </a>
      </div>
      <button type="button" data-act="copy-articul" data-art="${escapeHtml(p.articul)}" title="Պատճենել արտիկուլը" aria-label="Պատճենել արտիկուլը ${escapeHtml(p.articul)}" class="block font-mono text-xs font-bold text-blue-600 dark:text-blue-400 mb-0.5 hover:underline cursor-copy">${escapeHtml(p.articul)}</button>
      <h4 class="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white leading-snug">${escapeHtml(p.name || '—')}</h4>
      <button type="button" class="zigzag-product-ask" data-zigzag-art="${escapeHtml(p.articul)}">ԶիգԶագ · Բնութագրեր</button>
    </div>
    <button data-act="toggle-fav" data-art="${escapeHtml(p.articul)}" class="star-btn absolute top-3 right-3 p-1" aria-label="${starTitle}" title="${starTitle}">${starIcon}</button>
  </div>

  <div class="flex items-center justify-between pt-2.5 mt-2.5 border-t border-gray-100 dark:border-gray-700 text-xs">
    <span class="px-2 py-0.5 rounded-md font-semibold ${stockBadgeClass}">${escapeHtml(p.stockStatus)}</span>
    <div class="flex items-center gap-1.5"><span class="text-gray-400 dark:text-gray-500">Եկամտաբերություն:</span>${catalogIsAdmin() ? marginBadge : marginBadge}</div>
  </div>
</div>

<div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 mt-auto">
  <div>
    <div class="text-[11px] text-gray-500 dark:text-gray-400">Մանրածախ: <span class="font-medium text-gray-700 dark:text-gray-300">${p.retail ? p.retail.toLocaleString('hy-AM') + ' ֏' : '—'}</span></div>
    ${catalogIsAdmin() ? `<div class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Խոշոր գործընկերոջ գին՝ <span class="font-bold text-gray-800 dark:text-gray-200">${p.kpPrice > 0 ? p.kpPrice.toLocaleString('hy-AM') + ' ֏' : ''}</span> (${kpMarginBadge})${p.kpIsPromo ? ' <span class="px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">Ակցիա</span>' : ''}</div>` : ''}
    <div class="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">${catalogIsAdmin() ? 'WS: ' : ''}${p.wholesale ? p.wholesale.toLocaleString('hy-AM') + ' ֏' : '—'} ${catalogIsAdmin() ? '(' + marginBadge + ')' : ''}</div>
  </div>
  <div class="js-action" data-art="${escapeHtml(p.articul)}">${getActionControlHtml(p.articul, cartItem, true)}</div>
</div>
`;
return div;
}

function getActionControlHtml(articul, cartItem, isMobile = false) {
  const a = escapeHtml(articul);
  if (!cartItem) {
    const mobileBtnClass = isMobile ? "px-4 py-2 text-xs font-bold" : "px-3.5 py-1.5 text-xs font-semibold";
    return `<button data-act="add" data-art="${a}" aria-label="Պատվիրել" class="${mobileBtnClass} bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition whitespace-nowrap active:scale-95">Պատվիրել</button>`;
  }

  const btnPadding = isMobile ? "px-3 py-2 text-sm" : "px-2 sm:px-2.5 py-1 text-xs";
  const inputWidth = isMobile ? "w-11 sm:w-12 py-1.5 text-xs" : "w-10 sm:w-12 py-1 text-xs";

  return `
<div class="inline-flex items-center border border-blue-500 dark:border-blue-700 rounded-lg overflow-hidden bg-blue-50 dark:bg-blue-950/60 flex-shrink-0">
<button data-act="qty" data-delta="-1" data-art="${a}" aria-label="Նվազեցնել քանակը" class="${btnPadding} bg-blue-100 dark:bg-blue-900/60 hover:bg-blue-200 dark:hover:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold active:bg-blue-300">-</button>
<input type="number" data-act="qty-input" data-art="${a}" value="${cartItem.qty}" min="1" max="9999" aria-label="Ապրանքի քանակ" class="${inputWidth} text-center font-bold text-blue-900 dark:text-blue-200 bg-transparent focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-blue-500">
<button data-act="qty" data-delta="1" data-art="${a}" aria-label="Ավելացնել քանակը" class="${btnPadding} bg-blue-100 dark:bg-blue-900/60 hover:bg-blue-200 dark:hover:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold active:bg-blue-300">+</button>
</div>`;
}

