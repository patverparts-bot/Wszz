function saveCartToStorage() {
  if (!authorizedClient) return;
  try { localStorage.setItem('zigzag_cart_' + authorizedClient, JSON.stringify(cart)); } catch(e) {}
}

function normalizeCart(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.entries(raw).forEach(([key, v]) => {
    if (!v || typeof v !== 'object') return;
    const articul = String(v.articul || (v.product && v.product.articul) || key || '').trim();
    const qty = Math.floor(Number(v.qty));
    if (!articul || !(qty > 0)) return;
    out[articul] = {
      articul: articul,
      qty: qty,
      addedPrice: Number(v.addedPrice) || 0,
      addedPriceMode: v.addedPriceMode === 'KP' ? 'KP' : 'WS',
      paymentMethod: v.paymentMethod === 'Կանխիկ' ? 'Կանխիկ' : 'Բանկային փոխանցումով'
    };
  });
  return out;
}

function loadCartFromStorage(showToast = false) {
  if (!authorizedClient) return;
  pendingRestoreToast = showToast;
  try {
    const saved = localStorage.getItem('zigzag_cart_' + authorizedClient);
    cart = saved ? normalizeCart(JSON.parse(saved)) : {};
  } catch(e) {
    cart = {};
  }
}

function reconcileCart() {
  if (!catalogLoaded) return;
  let removed = 0;
  Object.keys(cart).forEach(art => {
    if (!getProduct(art)) { delete cart[art]; removed++; }
  });
  if (removed > 0) saveCartToStorage();
  updateOrderPanel();

  const kept = Object.keys(cart).length;
  if (pendingRestoreToast && (kept > 0 || removed > 0)) {
    showRestoredCartToast(kept, removed);
  }
  pendingRestoreToast = false;
}

function showRestoredCartToast(itemCount, removedCount = 0) {
  const toast = document.getElementById('restoredCartToast');
  const parts = [];
  if (itemCount > 0) parts.push(`Վերականգնվել է նախորդ պատվերի ${itemCount} ապրանք:`);
  if (removedCount > 0) parts.push(`Գնացուցակում այլևս չգտնվող ${removedCount} ապրանք հանվել է:`);
  document.getElementById('toastRestoredText').innerText = parts.join(' ');
  toast.classList.remove('hidden');
  setTimeout(() => closeCartToast(), removedCount > 0 ? 8000 : 5000);
}

function closeCartToast() { document.getElementById('restoredCartToast').classList.add('hidden'); }

function addToCart(articul) {
  const product = getProduct(articul);
  if (!product) return;

  const globalSel = document.getElementById('globalPaymentSelect');
  const globalMethod = globalSel ? globalSel.value : 'Բանկային փոխանցումով';

  if (!cart[articul]) {
    cart[articul] = { 
      articul: articul, 
      qty: 1, 
      addedPrice: getItemWholesalePrice({ articul: articul }),
      addedPriceMode: isAdminUser() ? adminOrderPriceMode : 'WS',
      paymentMethod: globalMethod 
    };
  } else {
    cart[articul].qty = Math.min(cart[articul].qty + 1, MAX_QTY);
  }

  afterCartChange(articul);
}

function setDirectQty(articul, newQty) {
  newQty = Math.min(Math.floor(Number(newQty)), MAX_QTY);
  if (isNaN(newQty) || newQty <= 0) {
    delete cart[articul];
  } else {
    if (!cart[articul]) {
      const p = getProduct(articul);
      if (!p) return;
      cart[articul] = { articul: articul, qty: newQty, addedPrice: getItemWholesalePrice({ articul: articul }), addedPriceMode: isAdminUser() ? adminOrderPriceMode : 'WS', paymentMethod: 'Բանկային փոխանցումով' };
    } else {
      cart[articul].qty = newQty;
    }
  }
  afterCartChange(articul);
}

function animateCartPanel() {
  const panel = document.getElementById('orderPanel');
  if (panel && !panel.classList.contains('hidden')) {
    panel.classList.add('cart-updated-anim');
    setTimeout(() => panel.classList.remove('cart-updated-anim'), 300);
  }
}

function afterCartChange(articul) {
  saveCartToStorage();
  updateOrderPanel();
  refreshProductActions(articul);
  animateCartPanel();
}

function refreshProductActions(articul) {
  document.querySelectorAll('.js-action').forEach(el => {
    if (el.dataset.art === articul) {
      const isMobile = !desktopMQ.matches;
      el.innerHTML = getActionControlHtml(articul, cart[articul], isMobile);
    }
  });
}

function refreshAllActions() {
  const isMobile = !desktopMQ.matches;
  document.querySelectorAll('.js-action').forEach(el => {
    const art = el.dataset.art;
    el.innerHTML = getActionControlHtml(art, cart[art], isMobile);
  });
}

function getItemWholesalePrice(item) {
  const p = getProduct(item && item.articul);
  if (!p) return 0;
  const selectedPrice = isAdminUser() && adminOrderPriceMode === 'KP' ? p.kpPrice : p.wholesale;
  return selectedPrice > 0 ? selectedPrice : 0;
}

function getOrderPriceLabel() {
  return isAdminUser() && adminOrderPriceMode === 'KP' ? 'KP Price' : 'WS Price';
}

function loadAdminOrderPriceMode() {
  adminOrderPriceMode = 'WS';
  if (isAdminUser()) {
    try {
      adminOrderPriceMode = localStorage.getItem('zigzag_admin_price_mode_' + authorizedClient) === 'KP' ? 'KP' : 'WS';
    } catch (e) {}
  }
  document.querySelectorAll('[data-admin-price-mode-select]').forEach(select => { select.value = adminOrderPriceMode; });
  updateOrderPanel();
}

function setAdminOrderPriceMode(mode) {
  if (!isAdminUser()) return;
  adminOrderPriceMode = mode === 'KP' ? 'KP' : 'WS';
  Object.values(cart).forEach(item => {
    item.addedPrice = getItemWholesalePrice(item);
    item.addedPriceMode = adminOrderPriceMode;
  });
  try { localStorage.setItem('zigzag_admin_price_mode_' + authorizedClient, adminOrderPriceMode); } catch (e) {}
  document.querySelectorAll('[data-admin-price-mode-select]').forEach(select => { select.value = adminOrderPriceMode; });
  saveCartToStorage();
  updateOrderPanel();
  renderModalItems();
}

function validateCartPrices() {
  if (!isAdminUser()) return true;
  const missing = Object.keys(cart).filter(articul => getItemWholesalePrice(cart[articul]) <= 0);
  if (missing.length === 0) return true;
  const sample = missing.slice(0, 8).join(', ');
  const extra = missing.length > 8 ? ` և ևս ${missing.length - 8}` : '';
  alert(`${getOrderPriceLabel()} գին չկա ${missing.length} ապրանքի համար (${sample}${extra})։ Ընտրեք մյուս գինը կամ հանեք այդ ապրանքները զամբյուղից։`);
  return false;
}

function getItemName(item) {
  const p = getProduct(item && item.articul);
  return p && p.name ? p.name : '—';
}

function getItemArticul(artKey, item) { return (item && item.articul) || artKey; }

function updateOrderPanel() {
  const orderPanel = document.getElementById('orderPanel');
  let totalCount = 0, totalSum = 0;
  Object.values(cart).forEach(item => {
    totalCount += item.qty;
    totalSum += getItemWholesalePrice(item) * item.qty;
  });
  const badgeDesk = document.getElementById('headerCartBadgeDesktop');
  if (totalCount > 0) {
    orderPanel.classList.remove('hidden');
    document.getElementById('orderCount').innerText = `${totalCount} ապրանք`;
    document.getElementById('orderSum').innerText = totalSum.toLocaleString('ru-RU') + ' ֏';
    if (badgeDesk) { badgeDesk.innerText = totalCount; badgeDesk.classList.remove('hidden'); }
  } else {
    orderPanel.classList.add('hidden');
    if (badgeDesk) badgeDesk.classList.add('hidden');
  }
}

function clearOrder() {
  cart = {};
  modalFieldsInitialized = false;
  ['deliveryDateInput', 'deliveryAddressInput', 'orderCommentInput', 'contactPersonInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const deliveryMethodInput = document.getElementById('deliveryMethodInput');
  if (deliveryMethodInput) deliveryMethodInput.value = 'Առաքում';
  handleDeliveryMethodChange();
  saveCartToStorage();
  updateOrderPanel();
  refreshAllActions();
}

function applyGlobalPayment(method) {
  Object.values(cart).forEach(item => item.paymentMethod = method);
  saveCartToStorage();
  renderModalItems();
}

function populateOrderModalFields() {
  const orgSelect = document.getElementById('organizationSelect');
  orgSelect.innerHTML = '';
  if (!clientRowsData || clientRowsData.length === 0) clientRowsData = [{ organization: authorizedClient, address: '', contact: '' }];

  clientRowsData.forEach((row, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.text = row.organization || authorizedClient;
    orgSelect.appendChild(opt);
  });

  if (clientRowsData.length > 0) {
    document.getElementById('deliveryAddressInput').value = clientRowsData[0].address || '';
    document.getElementById('contactPersonInput').value = clientRowsData[0].contact || '';
  }

  handleDeliveryMethodChange();
  orgSelect.onchange = restoreOrgDefaults;
}

function restoreOrgDefaults() {
  const orgSelect = document.getElementById('organizationSelect');
  const idx = parseInt(orgSelect.value);
  if (isNaN(idx) || !clientRowsData[idx]) return;
  document.getElementById('deliveryAddressInput').value = clientRowsData[idx].address || '';
  document.getElementById('contactPersonInput').value = clientRowsData[idx].contact || '';
  checkDeliveryBadge();
}

function renderModalItems() {
  const listContainer = document.getElementById('modalItemsList');
  const bodyEl = document.getElementById('modalBody');
  const prevScroll = bodyEl ? bodyEl.scrollTop : 0;
  listContainer.innerHTML = '';
  let totalSum = 0;

  Object.entries(cart).forEach(([artKey, item]) => {
    const currentPrice = getItemWholesalePrice(item);
    const articul = getItemArticul(artKey, item);
    const name = getItemName(item);
    const sum = currentPrice * item.qty;
    totalSum += sum;

    if (!item.paymentMethod) {
      item.paymentMethod = 'Բանկային փոխանցումով';
    }

    const prod = getProduct(item.articul);
    const stockStatus = (prod && prod.stockStatus) ? prod.stockStatus : 'Առկա է';
    const isUtochnit = stockStatus.includes('Ճշտել');
    const stockBadgeClass = isAdminUser() ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-mono text-[10px]' : (isUtochnit ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800');

    let priceDiffNotice = '';
    if (item.addedPrice && item.addedPrice !== currentPrice && currentPrice > 0) {
      const wasPriceStr = item.addedPrice.toLocaleString('ru-RU');
      const isPriceStr = currentPrice.toLocaleString('ru-RU');
      const diffColor = currentPrice > item.addedPrice ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900' : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900';
      priceDiffNotice = `<button type="button" data-act="ack-price" data-art="${escapeHtml(articul)}" class="px-2 py-0.5 text-[10px] font-bold rounded border ${diffColor} whitespace-nowrap">Գինը փոխվել է: ${wasPriceStr} ֏ → ${isPriceStr} ֏ ✕</button>`;
    }

    const div = document.createElement('div');
    div.className = 'p-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-blue-50/30 dark:hover:bg-gray-700/40 rounded-xl border border-gray-200/80 dark:border-gray-700 flex flex-col gap-2.5 transition overflow-hidden';
    div.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="flex-grow min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">${escapeHtml(articul)}</span>
            <span class="px-2 py-0.5 rounded-md font-semibold ${stockBadgeClass}">${escapeHtml(stockStatus)}</span>
            ${priceDiffNotice}
          </div>
          <div class="text-gray-900 dark:text-white font-semibold text-xs sm:text-sm leading-snug break-words">${escapeHtml(name)}</div>
          <div class="print-only text-xs">Քանակ՝ ${item.qty} հատ | Վճարում՝ ${escapeHtml(item.paymentMethod)}</div>
        </div>
      </div>

      <div class="flex flex-col gap-2 pt-2 border-t border-gray-200/60 dark:border-gray-700">
        <div class="flex items-center justify-between text-xs flex-wrap gap-1">
          <span class="text-gray-500 dark:text-gray-400 font-medium">Միավորի գին${isAdminUser() ? ` (${escapeHtml(getOrderPriceLabel())})` : ''}՝ <span class="text-gray-900 dark:text-gray-200 font-bold">${currentPrice > 0 ? currentPrice.toLocaleString('ru-RU') + ' ֏' : 'Գին չկա'}</span></span>
          <span class="font-black text-green-600 dark:text-green-400 text-sm">${sum.toLocaleString('ru-RU')} ֏</span>
        </div>

        <div class="flex items-center justify-between gap-2 pt-1 flex-wrap print-hidden">
          <select data-act="pay" data-art="${escapeHtml(articul)}" aria-label="Վճարման եղանակ ապրանքի համար" class="w-full sm:w-auto flex-grow px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs">
            <option value="Բանկային փոխանցումով" ${item.paymentMethod === 'Բանկային փոխանցումով' ? 'selected' : ''}>🏦 Բանկային փոխանցումով</option>
            <option value="Կանխիկ" ${item.paymentMethod === 'Կանխիկ' ? 'selected' : ''}>�� Կանխիկ</option>
          </select>

          <div class="inline-flex items-center border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-xs flex-shrink-0 ml-auto">
            <button data-act="mqty" data-delta="-1" data-art="${escapeHtml(articul)}" aria-label="Նվազեցնել քանակը" class="px-2.5 sm:px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-xs text-gray-700 dark:text-gray-200">-</button>
            <input type="number" data-act="mqty-input" data-art="${escapeHtml(articul)}" value="${item.qty}" min="1" max="9999" aria-label="Ապրանքի քանակ" class="w-10 sm:w-12 text-center text-xs font-bold text-blue-900 dark:text-blue-200 bg-transparent focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:ring-1 focus:ring-blue-500 py-1.5">
            <button data-act="mqty" data-delta="1" data-art="${escapeHtml(articul)}" aria-label="Ավելացնել քանակը" class="px-2.5 sm:px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-xs text-gray-700 dark:text-gray-200">+</button>
          </div>
        </div>
      </div>`;
    listContainer.appendChild(div);
  });

  if (bodyEl) bodyEl.scrollTop = prevScroll;
  document.getElementById('modalTotalSum').innerText = totalSum.toLocaleString('ru-RU') + ' ֏';
}

function openOrderModal() {
  document.querySelectorAll('[data-admin-price-mode-select]').forEach(select => { select.value = adminOrderPriceMode; });
  renderModalItems();
  if (!modalFieldsInitialized) {
    populateOrderModalFields();
    modalFieldsInitialized = true;
  }
  const details = document.getElementById('deliveryDetailsContent');
  const detailsIcon = document.getElementById('deliveryToggleIcon');
  if (details && window.matchMedia('(min-width: 1024px)').matches) {
    details.classList.remove('hidden');
    if (detailsIcon) detailsIcon.style.transform = 'rotate(180deg)';
  }
  checkDeliveryBadge();
  document.getElementById('orderModal').classList.remove('hidden');
}

function updateItemPayment(articul, method) {
  if (cart[articul]) {
    cart[articul].paymentMethod = method;
    saveCartToStorage();
  }
}

function changeQty(articul, delta) {
  if (!cart[articul]) return;
  cart[articul].qty = Math.min(cart[articul].qty + delta, MAX_QTY);
  if (cart[articul].qty <= 0) delete cart[articul];
  afterCartChange(articul);

  if (Object.keys(cart).length === 0) closeOrderModal();
}

function changeQtyFromModal(articul, delta) {
  if (!cart[articul]) return;
  cart[articul].qty = Math.min(cart[articul].qty + delta, MAX_QTY);
  if (cart[articul].qty <= 0) delete cart[articul];
  afterCartChange(articul);

  if (Object.keys(cart).length === 0) {
    closeOrderModal();
  } else {
    renderModalItems();
  }
}

function printOrder() {
  if (!validateCartPrices()) return;
  const v = id => (document.getElementById(id).value || '').trim();
  const lines = [`Կազմակերպություն՝ ${getSelectedOrganizationName()}`];
  lines.push(`Առաքման եղանակ՝ ${getSelectedDeliveryMethod()}`);
  if (isAdminUser()) lines.push(`Գնային հաշվարկ՝ ${getOrderPriceLabel()}`);
  if (v('contactPersonInput')) lines.push(`Կոնտակտային անձ՝ ${v('contactPersonInput')}`);
  if (v('deliveryDateInput')) lines.push(`Ցանկալի առաքման ամսաթիվ՝ ${v('deliveryDateInput')}`);
  const deliveryAddress = getDeliveryAddressValue();
  if (deliveryAddress) lines.push(`Առաքման հասցե՝ ${deliveryAddress}`);
  if (v('orderCommentInput')) lines.push(`Մեկնաբանություն՝ ${v('orderCommentInput')}`);
  document.getElementById('printMeta').innerText = lines.join('\n');
  window.print();
}

function toggleTheme() {
  const dark = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', dark);
  try { localStorage.setItem('zigzag_theme', dark ? 'dark' : 'light'); } catch (e) {}
}

function closeOrderModal() { document.getElementById('orderModal').classList.add('hidden'); }

function getSelectedOrganizationName() {
  const sel = document.getElementById('organizationSelect');
  return (sel && sel.options.length > 0 && sel.selectedIndex >= 0) ? sel.options[sel.selectedIndex].text : authorizedClient;
}

function buildHistorySnapshot(cartItems) {
  const snap = {};
  Object.entries(cartItems).forEach(([k, it]) => {
    snap[k] = { articul: it.articul, qty: it.qty, paymentMethod: it.paymentMethod, name: getItemName(it), price: getItemWholesalePrice(it) };
  });
  return snap;
}

function saveOrderToHistory(cartItems, orgName, totalSum, actionType = 'Excel') {
  if (!authorizedClient) return;
  try {
    const historyKey = 'zigzag_history_' + authorizedClient;
    let history = JSON.parse(localStorage.getItem(historyKey) || '[]');

    const newOrder = {
      id: 'ORD-' + Date.now(),
      date: new Date().toLocaleString('ru-RU'),
      organization: orgName || authorizedClient,
      totalSum: totalSum,
      itemsCount: Object.keys(cartItems).length,
      actionType: actionType,
      cartSnapshot: buildHistorySnapshot(cartItems)
    };

    history.unshift(newOrder);
    if (history.length > 20) history = history.slice(0, 20);

    localStorage.setItem(historyKey, JSON.stringify(history));
  } catch (e) {}
}

function openPersonalCabinet() {
  if (!authorizedClient) {
    alert('Մուտք գործեք համակարգ։');
    return;
  }
  document.getElementById('cabinetUserSubtitle').innerText = `Օգտատեր: ${authorizedClient} (${userSheetType})`;
  renderOrderHistoryList();
  document.getElementById('cabinetModal').classList.remove('hidden');
}

function closePersonalCabinet() {
  document.getElementById('cabinetModal').classList.add('hidden');
}

function renderOrderHistoryList() {
  const container = document.getElementById('cabinetHistoryList');
  if (!authorizedClient) return;

  const historyKey = 'zigzag_history_' + authorizedClient;
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(historyKey) || '[]');
  } catch (e) {}

  if (history.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-gray-400 dark:text-gray-500 text-xs sm:text-sm">
        Դուք դեռևս չունեք պահպանված պատվերների պատմություն:
      </div>`;
    return;
  }

  container.innerHTML = history.map((ord) => {
    let actionBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300';
    if (ord.actionType === 'Viber') actionBadgeClass = 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300';
    if (ord.actionType === 'Email') actionBadgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300';

    let itemsHtml = '';
    if (ord.cartSnapshot) {
      itemsHtml = Object.values(ord.cartSnapshot).map(item => {
        const prod = getProduct(item.articul);
        const name = item.name || (prod ? prod.name : 'Ապրանք');
        const price = item.price || (prod ? prod.wholesale : (item.addedPrice || 0));
        return `<div class="text-[11px] text-gray-600 dark:text-gray-300 flex justify-between gap-2 border-b border-gray-100 dark:border-gray-700/50 py-0.5">
          <span class="truncate">🔹 <strong class="font-mono">${escapeHtml(item.articul)}</strong> - ${escapeHtml(name)}</span>
          <span class="whitespace-nowrap font-medium">${item.qty} հատ × ${price.toLocaleString('ru-RU')} ֏</span>
        </div>`;
      }).join('');
    }

    return `
      <div class="p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col gap-2.5 transition">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200/60 dark:border-gray-700 pb-2">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">${escapeHtml(ord.id)}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">📅 ${escapeHtml(ord.date)}</span>
              <span class="px-2 py-0.5 text-[10px] font-bold rounded border ${actionBadgeClass}">📤 ${escapeHtml(ord.actionType || 'Excel')}</span>
            </div>
            <div class="text-xs font-semibold text-gray-800 dark:text-gray-200">
              🏢 ${escapeHtml(ord.organization)}
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs text-gray-500 dark:text-gray-400">Ընդհանուր՝</div>
            <div class="text-sm font-black text-green-600 dark:text-green-400">${Number(ord.totalSum).toLocaleString('ru-RU')} ֏</div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700 max-h-32 overflow-y-auto space-y-1">
          ${itemsHtml}
        </div>

        <div class="flex justify-end pt-1">
          <button data-act="restore-history" data-id="${escapeHtml(ord.id)}" aria-label="Կրկնել պատվերը" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition whitespace-nowrap">
            🛒 Կրկնել / Բեռնել զամբյուղ
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function restoreOrderFromHistory(orderId) {
  const historyKey = 'zigzag_history_' + authorizedClient;
  try {
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const order = history.find(o => o.id === orderId);
    if (!order || !order.cartSnapshot) {
      alert('Պատվերը չի գտնվել:');
      return;
    }

    let restoredCart = {};
    let count = 0;
    Object.entries(order.cartSnapshot).forEach(([art, item]) => {
      const prod = getProduct(art);
      if (prod) {
        restoredCart[art] = {
          articul: art,
          qty: item.qty || 1,
          addedPrice: getItemWholesalePrice({ articul: art }),
          addedPriceMode: isAdminUser() ? adminOrderPriceMode : 'WS',
          paymentMethod: item.paymentMethod || 'Բանկային փոխանցումով'
        };
        count++;
      }
    });

    if (count > 0) {
      cart = restoredCart;
      saveCartToStorage();
      updateOrderPanel();
      refreshAllActions();
      closePersonalCabinet();
      alert(`Պատվերը (${orderId}) հաջողությամբ վերականգնվել է զամբյուղում (${count} ապրանք)։`);
    } else {
      alert('Այս պատվերից ոչ մի ապրանք չի գտնվել ընթացիկ գնացուցակում։');
    }
  } catch (e) {}
}

function clearOrderHistory() {
  if (!confirm('Հաստատու՞մ եք, որ ցանկանում եք մաքրել պատվերների ամբողջ պատմությունը։')) return;
  try {
    localStorage.removeItem('zigzag_history_' + authorizedClient);
    renderOrderHistoryList();
  } catch (e) {}
}

function exportFullUserSession() {
  if (!authorizedClient) {
    alert('Մուտք գործեք համակարգ։');
    return;
  }

  try {
    const historyKey = 'zigzag_history_' + authorizedClient;
    const historyData = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const filtersData = JSON.parse(localStorage.getItem('zigzag_filters_' + authorizedClient) || '{}');
    const favsData = JSON.parse(localStorage.getItem('zigzag_favs_' + authorizedClient) || '[]');

    const fullSession = {
      client: authorizedClient,
      sheet: userSheetType,
      adminPriceMode: adminOrderPriceMode,
      clientRows: clientRowsData,
      cart: cart,
      favorites: favsData,
      history: historyData,
      filters: filtersData,
      exportDate: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullSession, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const safeName = authorizedClient.replace(/[\s"']/g, '_');
    downloadAnchor.setAttribute("download", `ZIGZAG_Backup_${safeName}_${Date.now()}.json`);
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } catch (err) {}
}

function importFullUserSession(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      if (!data.client || !data.cart) {
        throw new Error('Ֆայլի սխալ ձևաչափ։');
      }

      if (authorizedClient && data.client.toLowerCase() !== authorizedClient.toLowerCase()) {
        alert(`❌ Սխալ: Այս ֆայլը պատկանում է "${data.client}" օգտատիրոջը, իսկ դուք մուտք եք գործել որպես "${authorizedClient}":\nՏվյալների ներմուծումն արգելված է.`);
        event.target.value = '';
        return;
      }

      let foundUserRecord = null;
      Object.values(passMap).forEach(record => {
        if (record.client.toLowerCase() === data.client.toLowerCase()) {
          foundUserRecord = record;
        }
      });

      authorizedClient = data.client;
      userSheetType = foundUserRecord ? foundUserRecord.sheet : (data.sheet || 'Dealers');
      adminOrderPriceMode = isAdminUser() && data.adminPriceMode === 'KP' ? 'KP' : 'WS';
      if (isAdminUser()) {
        try { localStorage.setItem('zigzag_admin_price_mode_' + authorizedClient, adminOrderPriceMode); } catch (e) {}
      }
      
      if (foundUserRecord && foundUserRecord.rowsList && foundUserRecord.rowsList.length > 0) {
        clientRowsData = foundUserRecord.rowsList;
      } else {
        clientRowsData = data.clientRows || [{ organization: authorizedClient, address: '', contact: '' }];
      }

      cart = normalizeCart(data.cart);

      localStorage.setItem('zigzag_client', authorizedClient);
      localStorage.setItem('zigzag_sheet', userSheetType);
      localStorage.setItem('zigzag_client_rows', JSON.stringify(clientRowsData));
      saveCartToStorage();

      if (Array.isArray(data.favorites)) {
        localStorage.setItem('zigzag_favs_' + authorizedClient, JSON.stringify(data.favorites));
        favoritesSet = new Set(data.favorites);
      }

      if (Array.isArray(data.history)) {
        localStorage.setItem('zigzag_history_' + authorizedClient, JSON.stringify(data.history));
      }

      if (data.filters) {
        localStorage.setItem('zigzag_filters_' + authorizedClient, JSON.stringify(data.filters));
      }

      closePersonalCabinet();
      document.getElementById('authScreen').classList.add('hidden');
      
      Promise.resolve().then(() => {
        initAppAfterAuth();
        alert(`Տվյալները հաջողությամբ ներմուծվեցին!\nԲարև ձեզ, ${authorizedClient}։`);
      });

    } catch (err) {}
    event.target.value = '';
  };
  reader.readAsText(file);
}

