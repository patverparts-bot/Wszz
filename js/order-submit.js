function buildEmailFormattedText() {
  const orgName = getSelectedOrganizationName();
  const delivDate = (document.getElementById('deliveryDateInput').value || '').trim();
  const deliveryMethod = getSelectedDeliveryMethod();
  const delivAddr = getDeliveryAddressValue();
  const contactPerson = (document.getElementById('contactPersonInput').value || '').trim();
  const comment = (document.getElementById('orderCommentInput').value || '').trim();

  let text = `ՊԱՏՎԵՐ ԿԱՏԱԼՈԳԻՑ (${authorizedClient}):\nԿազմակերպություն: ${orgName}\nԱռաքման եղանակ: ${deliveryMethod}\n`;
  if (isAdminUser()) text += `Գնային հաշվարկ: ${getOrderPriceLabel()}\n`;
  if (contactPerson) text += `Կոնտակտային անձ: ${contactPerson}\n`;
  if (delivDate) text += `Ցանկալի առաքման ամսաթիվ: ${delivDate}\n`;
  if (delivAddr) text += `Առաքման հասցե: ${delivAddr}\n`;
  if (comment) text += `Մեկնաբանություն: ${comment}\n\n`;

  let total = 0, i = 1;
  Object.entries(cart).forEach(([artKey, item]) => {
    const price = getItemWholesalePrice(item);
    const sum = price * item.qty;
    total += sum;
    text += `${i}. Արտիկուլ: ${getItemArticul(artKey, item)}\n   Անվանում: ${getItemName(item)}\n   Միավորի գին: ${price.toLocaleString('ru-RU')} ֏ | Քանակ: ${item.qty} հատ\n   Վճարում: ${item.paymentMethod || 'Բանկային փոխանցումով'}\n   Գումար: ${sum.toLocaleString('ru-RU')} ֏\n\n`;
    i++;
  });
  text += `ԸՆԴՀԱՆՈՒՐ ԳՈՒՄԱՐ՝ ${total.toLocaleString('ru-RU')} ֏\n`;
  text += `Գնացուցակի թարմացում՝ ${cachedPriceDateText || '—'}`;
  return text;
}

function buildViberFormattedText() {
  const orgName = getSelectedOrganizationName();
  const delivDate = (document.getElementById('deliveryDateInput').value || '').trim();
  const deliveryMethod = getSelectedDeliveryMethod();
  const delivAddr = getDeliveryAddressValue();
  const contactPerson = (document.getElementById('contactPersonInput').value || '').trim();
  const comment = (document.getElementById('orderCommentInput').value || '').trim();

  let total = 0;
  Object.values(cart).forEach(item => total += getItemWholesalePrice(item) * item.qty);

  let text = `Բարև ձեզ,\n\nԿից ներկայացնում եմ պատվերի Excel ֆայլը:\nԿազմակերպություն: ${orgName}\nԱռաքման եղանակ: ${deliveryMethod}\n`;
  if (isAdminUser()) text += `Գնային հաշվարկ: ${getOrderPriceLabel()}\n`;
  if (contactPerson) text += `Կոնտակտային անձ: ${contactPerson}\n`;
  if (delivDate) text += `Ցանկալի առաքման ամսաթիվ: ${delivDate}\n`;
  if (delivAddr) text += `Առաքման հասցե: ${delivAddr}\n`;
  if (comment) text += `Մեկնաբանություն: ${comment}\n`;
  text += `\nԸՆԴՀԱՆՈՒՐ ԳՈՒՄԱՐ՝ ${total.toLocaleString('ru-RU')} ֏\n`;
  text += `Գնացուցակի թարմացում՝ ${cachedPriceDateText || '—'}`;
  return text;
}

function sendViaViber() {
  if (!validateCartPrices()) return;
  const orgName = getSelectedOrganizationName();
  let totalSum = 0;
  Object.values(cart).forEach(item => totalSum += getItemWholesalePrice(item) * item.qty);
  
  saveOrderToHistory(cart, orgName, totalSum, 'Viber');

  const viberText = buildViberFormattedText();
  generateAndDownloadExcel(true);
  setTimeout(() => window.open(`viber://forward?text=${encodeURIComponent(viberText)}`, '_blank'), 800);
}

function sendViaEmail() {
  if (!validateCartPrices()) return;
  const orgName = getSelectedOrganizationName();
  let totalSum = 0;
  Object.values(cart).forEach(item => totalSum += getItemWholesalePrice(item) * item.qty);
  
  saveOrderToHistory(cart, orgName, totalSum, 'Email');

  const formattedText = buildEmailFormattedText();
  generateAndDownloadExcel(true); 
  setTimeout(() => {
    window.location.href = `mailto:${TARGET_EMAILS}?subject=${encodeURIComponent(`Պատվեր կատալոգից - ${authorizedClient}`)}&body=${encodeURIComponent(`Բարև ձեզ,\n\nԿից նե��կայացնում եմ պատվերի Excel ֆայլը:\n\n` + formattedText)}`;
  }, 800);
}

function downloadOrderExcel() {
  if (!validateCartPrices()) return;
  generateAndDownloadExcel(false);
}

function generateAndDownloadExcel(isFromExternal = false) {
  if (!validateCartPrices()) return false;
  const orgName = getSelectedOrganizationName();
  const delivDate = (document.getElementById('deliveryDateInput').value || '').trim();
  const deliveryMethod = getSelectedDeliveryMethod();
  const delivAddr = getDeliveryAddressValue();
  const contactPerson = (document.getElementById('contactPersonInput').value || '').trim();
  const comment = (document.getElementById('orderCommentInput').value || '').trim();

  let currentTotalSum = 0;
  Object.values(cart).forEach(item => currentTotalSum += getItemWholesalePrice(item) * item.qty);

  if (!isFromExternal) {
    saveOrderToHistory(cart, orgName, currentTotalSum, 'Excel');
  }

  const excelData = [];
  let cashTotal = 0, bankTotal = 0;
  const cashItems = [], bankItems = [];

  Object.entries(cart).forEach(([artKey, item]) => {
    if (item.paymentMethod === 'Կանխիկ') cashItems.push({ key: artKey, ...item });
    else bankItems.push({ key: artKey, ...item });
  });

  excelData.push({ 'Արտիկուլ': 'ԱՊՐԱՆՔՆԵՐԻ ՑԱՆԿ (ՊԱՏՎԵՐ)', 'Անվանում': '', 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });
  excelData.push({ 'Արտիկուլ': 'Արտիկուլ', 'Անվանում': 'Անվանում', 'Քանակ (հատ)': 'Քանակ', 'Մեծածախ գին (AMD)': 'Գին (միավոր)', 'Գումար (AMD)': 'Գումար', 'Վճարման եղանակ': 'Վճարման եղանակ' });

  if (bankItems.length > 0) {
    bankItems.forEach(item => {
      const price = getItemWholesalePrice(item);
      const sum = price * item.qty;
      bankTotal += sum;
      excelData.push({ 'Արտիկուլ': getItemArticul(item.key, item), 'Անվանում': getItemName(item), 'Քանակ (հատ)': item.qty, 'Մեծածախ գին (AMD)': price, 'Գումար (AMD)': sum, 'Վճարման եղանակ': 'Բանկային փոխանցումով' });
    });
    excelData.push({ 'Արտիկուլ': '', 'Անվանում': 'ԸՆԴՀԱՆՈՒՐ (ԲԱՆԿԱՅԻՆ)', 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': bankTotal, 'Վճարման եղանակ': 'Բանկային փոխանցումով' });
  }

  if (cashItems.length > 0) {
    cashItems.forEach(item => {
      const price = getItemWholesalePrice(item);
      const sum = price * item.qty;
      cashTotal += sum;
      excelData.push({ 'Արտիկուլ': getItemArticul(item.key, item), 'Անվանում': getItemName(item), 'Քանակ (հատ)': item.qty, 'Մեծածախ գին (AMD)': price, 'Գումար (AMD)': sum, 'Վճարման եղանակ': 'Կանխիկ' });
    });
    excelData.push({ 'Արտիկուլ': '', 'Անվանում': 'ԸՆԴՀԱՆՈՒՐ (ԿԱՆԽԻԿ)', 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': cashTotal, 'Վճարման եղանակ': 'Կանխիկ' });
  }

  excelData.push({ 'Արտիկուլ': '', 'Անվանում': '', 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });
  excelData.push({ 'Արտիկուլ': 'ԸՆԴՀԱՆՈՒՐ ԳՈՒՄԱՐ ԲՈԼՈՐԻ', 'Անվանում': '', 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': (cashTotal + bankTotal), 'Վճարման եղանակ': '' });

  excelData.push({ 'Արտիկուլ': '', 'Անվանում': '', 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });
  excelData.push({ 'Արտիկուլ': 'ՏԵՂԵԿՈՒԹՅՈՒՆՆԵՐ ՊԱՏՎԻՐԱՏՈՒԻ ԵՎ ԱՌԱՔՄԱՆ ՄԱՍԻՆ', 'Անվանում': '', 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });
  excelData.push({ 'Արտիկուլ': 'Կոնտրագենտ:', 'Անվանում': authorizedClient, 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });
  excelData.push({ 'Արտիկուլ': 'Կազմակերպություն:', 'Անվանում': orgName, 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });
  excelData.push({ 'Արտիկուլ': 'Առաքման եղանակ:', 'Անվանում': deliveryMethod, 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });
  if (isAdminUser()) excelData.push({ 'Արտիկուլ': 'Գնային հաշվարկ:', 'Անվանում': getOrderPriceLabel(), 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });

  if (contactPerson) excelData.push({ 'Արտիկուլ': 'Կոնտակտային անձ:', 'Անվանում': contactPerson, 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });
  if (delivDate) excelData.push({ 'Արտիկուլ': 'Ցանկալի առաքման ամսաթիվ:', 'Անվանում': delivDate, 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });
  if (delivAddr) excelData.push({ 'Արտիկուլ': 'Առաքման հասցե:', 'Անվանում': delivAddr, 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });
  if (comment) excelData.push({ 'Արտիկուլ': 'Մեկնաբանություն:', 'Անվանում': comment, 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });

  excelData.push({ 'Արտիկուլ': '', 'Անվանում': '', 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });
  excelData.push({ 'Արտիկուլ': 'Գնացուցակի թարմացում՝', 'Անվանում': cachedPriceDateText || '—', 'Քանակ (հատ)': '', 'Մեծածախ գին (AMD)': '', 'Գումար (AMD)': '', 'Վճարման եղանակ': '' });

  const worksheet = XLSX.utils.json_to_sheet(excelData, { skipHeader: true });
  
  const colWidths = [
    { wch: 22 },
    { wch: 45 },
    { wch: 15 },
    { wch: 20 },
    { wch: 20 },
    { wch: 25 }
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Պատվեր");

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const uniqueFileName = `Zakaz_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.xlsx`;

  XLSX.writeFile(workbook, uniqueFileName);
  closeOrderModal();
  document.getElementById('successOverlay').classList.remove('hidden');
  document.getElementById('successOverlay').classList.add('flex');
  startSuccessOverlayCountdown();
}

let successOverlayCountdownTimer = null;

function stopSuccessOverlayCountdown() {
  if (successOverlayCountdownTimer !== null) {
    clearInterval(successOverlayCountdownTimer);
    successOverlayCountdownTimer = null;
  }
}

function startSuccessOverlayCountdown() {
  stopSuccessOverlayCountdown();
  let remainingSeconds = 60;
  const message = document.getElementById('successAutoCloseText');

  const updateCountdown = () => {
    if (message) {
      message.innerText = remainingSeconds > 0
        ? `Պատուհանը կփակվի ավտոմատ ${remainingSeconds} վայրկյանից։ Կարող եք փակել ավելի շուտ։`
        : 'Պատուհանը փակվում է…';
    }
    if (remainingSeconds <= 0) {
      keepCartAndCloseSuccess();
      return;
    }
    remainingSeconds--;
  };

  updateCountdown();
  successOverlayCountdownTimer = setInterval(updateCountdown, 1000);
}

function keepCartAndCloseSuccess() {
  stopSuccessOverlayCountdown();
  document.getElementById('successOverlay').classList.add('hidden');
  document.getElementById('successOverlay').classList.remove('flex');
}

function clearCartAndCloseSuccess() {
  stopSuccessOverlayCountdown();
  clearOrder();
  document.getElementById('successOverlay').classList.add('hidden');
  document.getElementById('successOverlay').classList.remove('flex');
}

const searchInputEl = document.getElementById('searchInput');
searchInputEl.oninput = function () {
  document.getElementById('clearSearchBtn').classList.toggle('hidden', searchInputEl.value.trim().length === 0);
  debouncedResetAndRender();
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const art = el.dataset.art;
  switch (el.dataset.act) {
    case 'add':           addToCart(art); break;
    case 'qty':           changeQty(art, Number(el.dataset.delta)); break;
    case 'mqty':          changeQtyFromModal(art, Number(el.dataset.delta)); break;
    case 'toggle-fav':    toggleFavorite(art); break;
    case 'pick-brand':    e.preventDefault(); selectBrand(el.dataset.value); break;
    case 'pick-category': e.preventDefault(); selectCategory(el.dataset.value); break;
    case 'restore-org':   restoreOrgDefaults(); break;
    case 'restore-history': restoreOrderFromHistory(el.dataset.id); break;
    case 'ack-price':     if (cart[art]) { cart[art].addedPrice = getItemWholesalePrice(cart[art]); saveCartToStorage(); renderModalItems(); } break;
    case 'copy-articul':  e.preventDefault(); copyArticul(art); break;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-act="pay"]');
  if (el) updateItemPayment(el.dataset.art, el.value);

  const qInput = e.target.closest('[data-act="qty-input"], [data-act="mqty-input"]');
  if (qInput) {
    const art = qInput.dataset.art;
    setDirectQty(art, qInput.value);
    if (qInput.dataset.act === 'mqty-input') { if (Object.keys(cart).length === 0) closeOrderModal(); else renderModalItems(); }
  }
});

if (desktopMQ.addEventListener) desktopMQ.addEventListener('change', rerenderVisible);
else if (desktopMQ.addListener) desktopMQ.addListener(rerenderVisible);
