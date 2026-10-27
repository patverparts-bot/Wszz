console.log("ZIGZAG Catalog v2.55 loaded successfully");

let allProducts = [];
let filteredProducts = [];
let displayedCount = 0;
const PAGE_SIZE = 40;
const MAX_QTY = 9999;
let isLoadingMore = false;
let observer = null;
let catalogLoaded = false;
let productIndex = new Map();
let modalFieldsInitialized = false;
let pendingRestoreToast = false;
let favoritesSet = new Set();
let cachedPriceDateText = "";
let backgroundPollTimer = null;

const DEBOUNCE_MS = 280;
const desktopMQ = window.matchMedia('(min-width: 768px)');

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, delay) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

const debouncedResetAndRender = debounce(() => resetAndRender(), DEBOUNCE_MS);

function getProduct(articul) {
  return productIndex.get(articul) || null;
}

let copyToastTimer = null;
async function copyArticul(articul) {
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(String(articul));
      copied = true;
    }
  } catch (e) {}

  if (!copied) {
    const temporaryInput = document.createElement('textarea');
    temporaryInput.value = String(articul);
    temporaryInput.setAttribute('readonly', '');
    temporaryInput.style.position = 'fixed';
    temporaryInput.style.opacity = '0';
    temporaryInput.style.left = '-9999px';
    document.body.appendChild(temporaryInput);
    temporaryInput.focus({ preventScroll: true });
    temporaryInput.select();
    temporaryInput.setSelectionRange(0, temporaryInput.value.length);
    try { copied = document.execCommand('copy'); } catch (e) {}
    temporaryInput.remove();
  }

  const toast = document.getElementById('copyToast');
  if (toast) {
    toast.textContent = copied ? `Պատճենվեց՝ ${articul}` : 'Չհաջողվեց պատճենել արտիկուլը';
    toast.classList.remove('hidden');
    if (copyToastTimer) clearTimeout(copyToastTimer);
    copyToastTimer = setTimeout(() => toast.classList.add('hidden'), 1800);
  }
}

let cart = {};
let authorizedClient = '';
let userSheetType = '';
let adminOrderPriceMode = 'WS';

function isAdminUser() {
  return !!serverIdentity && serverIdentity.role === 'admin';
}
let clientRowsData = [];

let availableBrands = [];
let availableCategories = [];
let selectedBrands = [];
let selectedCategories = [];

const TARGET_EMAILS = "Levon.Grigoryan@zigzag.am,Ashot.Manukyan@zigzag.am";

const brandDomains = {
'wanbo': 'wanbo.cn', 'epson': 'epson.com', 'blaupunkt': 'blaupunkt.com', 'apple': 'apple.com',
'samsung': 'samsung.com', 'sony': 'sony.com', 'lg': 'lg.com', 'xiaomi': 'mi.com',
'jbl': 'jbl.com', 'marshall': 'marshallheadphones.com', 'haier': 'haier.com', 'philips': 'philips.com',
'bosch': 'bosch.com', 'dyson': 'dyson.com', 'midea': 'midea.com', 'tefal': 'tefal.com',
'moulinex': 'moulinex.com', 'delonghi': 'delonghi.com', 'braun': 'braun.com', 'canon': 'canon.com',
'nikon': 'nikon.com', 'asus': 'asus.com', 'acer': 'acer.com', 'lenovo': 'lenovo.com',
'hp': 'hp.com', 'dell': 'dell.com', 'huawei': 'huawei.com', 'babyliss': 'babyliss.com',
'elica': 'elica.com', 'indesit': 'indesit.com'
};

function hideVersionBadge() {
  setTimeout(() => {
    const badge = document.getElementById('version-badge');
    if (badge) {
      badge.style.opacity = '0';
      setTimeout(() => badge.remove(), 500);
    }
  }, 3000);
}



function loadFavorites() {
  if (!authorizedClient) return;
  try {
    const saved = localStorage.getItem('zigzag_favs_' + authorizedClient);
    favoritesSet = saved ? new Set(JSON.parse(saved)) : new Set();
  } catch(e) {
    favoritesSet = new Set();
  }
}

function saveFavorites() {
  if (!authorizedClient) return;
  try {
    localStorage.setItem('zigzag_favs_' + authorizedClient, JSON.stringify([...favoritesSet]));
  } catch(e) {}
}

function toggleFavorite(articul) {
  if (favoritesSet.has(articul)) {
    favoritesSet.delete(articul);
  } else {
    favoritesSet.add(articul);
  }
  saveFavorites();
  
  document.querySelectorAll('.star-btn').forEach(btn => {
    if (btn.dataset.art !== articul) return;
    const isFav = favoritesSet.has(articul);
    btn.innerText = isFav ? '⭐' : '☆';
    btn.title = isFav ? 'Հեռացնել ընտրվածներից' : 'Ավելացնել ընտրվածներում';
    btn.setAttribute('aria-label', isFav ? 'Հեռացնել ընտրվածներից' : 'Ավելացնել ընտրվածներում');
  });

  if (document.getElementById('favOnlyFilter').checked) {
    resetAndRender();
  }
}

function updateMobileFilterBadge() {
  let count = 0;
  if (selectedBrands.length) count++;
  if (selectedCategories.length) count++;
  if ((document.getElementById('searchInput').value || '').trim()) count++;
  if (document.getElementById('sortBy').value !== 'default') count++;
  if (document.getElementById('favOnlyFilter').checked) count++;
  if (document.getElementById('promoOnlyFilter').checked) count++;
  if (document.getElementById('stockOnlyFilter').checked) count++;
  const wholesaleFilter = document.getElementById('wholesaleOnlyFilter');
  if (wholesaleFilter && wholesaleFilter.checked) count++;

  const btnText = document.getElementById('mobileFilterBtnText');
  if (btnText) {
    btnText.innerText = count > 0 ? `⚙️ Ֆիլտրեր · ${count}` : '⚙️ Ֆիլտրեր';
  }
}

function toggleMobileFilters(forcedState) {
  const container = document.getElementById('filtersContainer');
  const icon = document.getElementById('filterToggleIcon');
  if (!container || !icon) return;

  const shouldHide = forcedState !== undefined ? !forcedState : !container.classList.contains('hidden');
  
  if (shouldHide) {
    container.classList.add('hidden');
    icon.style.transform = 'rotate(0deg)';
  } else {
    container.classList.remove('hidden');
    icon.style.transform = 'rotate(180deg)';
  }

  if (authorizedClient) {
    try { localStorage.setItem('zigzag_filters_open_' + authorizedClient, shouldHide ? '0' : '1'); } catch(e) {}
  }
}

function toggleDeliveryDetails() {
  const content = document.getElementById('deliveryDetailsContent');
  const icon = document.getElementById('deliveryToggleIcon');
  content.classList.toggle('hidden');
  icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
}

function getSelectedDeliveryMethod() {
  const methodInput = document.getElementById('deliveryMethodInput');
  return methodInput && methodInput.value ? methodInput.value : 'Առաքում';
}

function getDeliveryAddressValue() {
  return getSelectedDeliveryMethod() === 'Ինքնաառաքում'
    ? ''
    : (document.getElementById('deliveryAddressInput').value || '').trim();
}

function handleDeliveryMethodChange() {
  const addressField = document.getElementById('deliveryAddressField');
  if (addressField) addressField.classList.toggle('hidden', getSelectedDeliveryMethod() === 'Ինքնաառաքում');
  checkDeliveryBadge();
}

function checkDeliveryBadge() {
  const dateVal = (document.getElementById('deliveryDateInput').value || '').trim();
  const addrVal = getDeliveryAddressValue();
  const commVal = (document.getElementById('orderCommentInput').value || '').trim();
  const contactVal = (document.getElementById('contactPersonInput').value || '').trim();
  const pickupSelected = getSelectedDeliveryMethod() === 'Ինքնաառաքում';
  const badge = document.getElementById('deliveryBadge');

  if (pickupSelected || dateVal || addrVal || commVal || contactVal) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function saveFiltersToStorage() {
  if (!authorizedClient) return;
  try {
    const filtersState = {
      brands: selectedBrands,
      categories: selectedCategories,
      brand: selectedBrands[0] || '',
      category: selectedCategories[0] || '', 
      search: document.getElementById('searchInput').value || '',
      sortBy: document.getElementById('sortBy').value || 'default',
      favOnly: document.getElementById('favOnlyFilter').checked || false,
      promoOnly: document.getElementById('promoOnlyFilter').checked || false,
      stockOnly: document.getElementById('stockOnlyFilter').checked || false,
      wholesaleOnly: document.getElementById('wholesaleOnlyFilter')?.checked || false
    };
    localStorage.setItem('zigzag_filters_' + authorizedClient, JSON.stringify(filtersState));
  } catch(e) {}
  updateMobileFilterBadge();
}

function loadSavedFilters() {
  if (!authorizedClient) return;
  try {
    const saved = localStorage.getItem('zigzag_filters_' + authorizedClient);
    if (saved) {
      const f = JSON.parse(saved);
      selectedBrands = Array.isArray(f.brands) ? f.brands : (f.brand ? [f.brand] : []);
      selectedCategories = Array.isArray(f.categories) ? f.categories : (f.category ? [f.category] : []);
      updateBrandSelectionSummary();
      updateCategorySelectionSummary();
      reconcileFilterSelections();
      updateBrandSelectionSummary();
      updateCategorySelectionSummary();
      renderDependentFilterOptions();
      if (f.search) {
        document.getElementById('searchInput').value = f.search;
        document.getElementById('clearSearchBtn').classList.remove('hidden');
      }
      if (f.sortBy) {
        document.getElementById('sortBy').value = f.sortBy;
      }
      if (f.favOnly !== undefined) {
        document.getElementById('favOnlyFilter').checked = f.favOnly;
      }
      if (f.promoOnly !== undefined) {
        document.getElementById('promoOnlyFilter').checked = f.promoOnly;
      }
      if (f.stockOnly !== undefined) {
        document.getElementById('stockOnlyFilter').checked = f.stockOnly;
      }
      if (f.wholesaleOnly !== undefined && document.getElementById('wholesaleOnlyFilter')) {
        document.getElementById('wholesaleOnlyFilter').checked = f.wholesaleOnly;
      }
    }

    const openState = localStorage.getItem('zigzag_filters_open_' + authorizedClient);
    if (openState === '1') {
      toggleMobileFilters(true);
    }
  } catch(e) {}
  updateMobileFilterBadge();
}

function clearAllFilters() {
  clearBrandSelection();
  clearCategorySelection();
  document.getElementById('sortBy').value = 'default';
  document.getElementById('favOnlyFilter').checked = false;
  document.getElementById('promoOnlyFilter').checked = false;
  document.getElementById('stockOnlyFilter').checked = false;
  if (document.getElementById('wholesaleOnlyFilter')) document.getElementById('wholesaleOnlyFilter').checked = false;
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').classList.add('hidden');
  
  if (authorizedClient) {
    try { localStorage.removeItem('zigzag_filters_' + authorizedClient); } catch(e) {}
  }
  resetAndRender();
}

function getBrandLogoHtml(brandName) {
  if (!brandName || brandName === 'Այլ' || brandName === '—') {
    return `<span class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">${escapeHtml(brandName || '—')}</span>`;
  }

  const cleanBrand = brandName.trim().toLowerCase();
  const domain = brandDomains[cleanBrand] || `${cleanBrand.replace(/\s+/g, '')}.com`;
  const logoUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  const safeBrand = escapeHtml(brandName);

  return `
<div class="flex items-center gap-1">
<img src="${escapeHtml(logoUrl)}" alt="${safeBrand}" class="h-4 w-4 object-contain rounded flex-shrink-0" loading="lazy" 
onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';">
<span class="font-semibold text-gray-800 dark:text-gray-200 text-xs whitespace-normal">${safeBrand}</span>
</div>
`;
}

function markProductImageLoaded(imgElement) {
  if (!imgElement) return;
  const width = Number(imgElement.naturalWidth) || 0;
  const height = Number(imgElement.naturalHeight) || 0;
  // Zigzag returns this same 2200x2200 PNG for a missing SKU and the checked sample SKU.
  const missingPhotoPlaceholder = width === 2200 && height === 2200;
  const hasRealPhoto = width >= 160 && height >= 160 && !missingPhotoPlaceholder;
  imgElement.classList.toggle("image-loaded", hasRealPhoto);
}

function handleImageError(imgElement) {
  imgElement.classList.remove("image-loaded");
  const container = imgElement.parentElement;
  if (!container) return;
  
  const step = Number(imgElement.dataset.step || 1);
  const cleanArt = imgElement.dataset.articul || '';
  
  if (step === 0) {
    imgElement.dataset.step = "1";
    imgElement.src = imgElement.dataset.fallbackUrl || `https://www.zigzag.am/media/catalog/product/${cleanArt.charAt(0)}/${cleanArt.charAt(1)}/${cleanArt}.jpg`;
  } else if (step === 1) {
    imgElement.dataset.step = "2";
    imgElement.src = `https://www.zigzag.am/pub/media/catalog/product/${cleanArt.charAt(0)}/${cleanArt.charAt(1)}/${cleanArt}.jpg`;
  } else if (step === 2) {
    imgElement.dataset.step = "3";
    imgElement.src = `https://www.zigzag.am/media/catalog/product/${cleanArt}.jpg`;
  } else {
    container.innerHTML = `
      <div class="w-full h-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center text-center p-0.5" title="Նկարը բացակայում է">
        <span class="text-[10px]">📦</span>
        <span class="text-[8px] font-bold text-gray-500 dark:text-gray-400">No photo</span>
      </div>`;
  }
}
function getProductImageHtml(articul, productName) {
  const cleanArt = String(articul).trim();
  const a1 = cleanArt.charAt(0) || '0';
  const a2 = cleanArt.charAt(1) || '0';
  const initialUrl = `https://www.zigzag.am/media/catalog/product/${encodeURIComponent(a1)}/${encodeURIComponent(a2)}/${encodeURIComponent(cleanArt)}.jpg`;
  const photoSuffix = window.ZZWS_PRODUCT_PHOTO_PATHS?.[cleanArt];
  const photoUrl = photoSuffix ? (photoSuffix.startsWith('https://www.zigzag.am/') ? photoSuffix : `https://www.zigzag.am${window.ZZWS_PRODUCT_PHOTO_PREFIX}${photoSuffix}`) : '';

  return `
    <div class="product-img-container">
      <img src="${escapeHtml(photoUrl || initialUrl)}" 
           data-articul="${escapeHtml(cleanArt)}"
           data-step="${photoUrl ? '0' : '1'}"
           data-fallback-url="${escapeHtml(initialUrl)}"
           alt="${escapeHtml(productName)}" 
           class="product-img dark:border-gray-700 dark:bg-gray-800" 
           loading="lazy"
           onload="markProductImageLoaded(this)"
           onerror="handleImageError(this)">
    </div>
  `;
}

