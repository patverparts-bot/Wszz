function buildEmailFormattedText() {
  const orgName = getSelectedOrganizationName();
  const delivDate = (document.getElementById('deliveryDateInput').value || '').trim();
  const deliveryMethod = getSelectedDeliveryMethod();
  const delivAddr = getDeliveryAddressValue();
  const contactPerson = (document.getElementById('contactPersonInput').value || '').trim();
  const comment = (document.getElementById('orderCommentInput').value || '').trim();

  let text = `ՊԱՏՎԵՐ ԿԱՏԱԼՈԳԻՑ (${authorizedClient}):\nԿազմակերպություն: ${orgName}\nԱռաքման եղանակ: ${deliveryMethod}\n`;
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
  if (contactPerson) text += `Կոնտակտային անձ: ${contactPerson}\n`;
  if (delivDate) text += `Ցանկալի առաքման ամսաթիվ: ${delivDate}\n`;
  if (delivAddr) text += `Առաքման հասցե: ${delivAddr}\n`;
  if (comment) text += `Մեկնաբանություն: ${comment}\n`;
  text += `\nԸՆԴՀԱՆՈՒՐ ԳՈՒՄԱՐ՝ ${total.toLocaleString('ru-RU')} ֏\n`;
  text += `Գնացուցակի թարմացում՝ ${cachedPriceDateText || '—'}`;
  return text;
}

function sendViaViber() {
  const orgName = getSelectedOrganizationName();
  let totalSum = 0;
  Object.values(cart).forEach(item => totalSum += getItemWholesalePrice(item) * item.qty);
  
  saveOrderToHistory(cart, orgName, totalSum, 'Viber');

  const viberText = buildViberFormattedText();
  generateAndDownloadExcel(true);
  setTimeout(() => window.open(`viber://forward?text=${encodeURIComponent(viberText)}`, '_blank'), 800);
}

function sendViaEmail() {
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

function downloadOrderExcel() { generateAndDownloadExcel(false); }

function generateAndDownloadExcel(isFromExternal = false) {
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

  const sysData = [
    ['Articul', 'Qty', 'PaymentMethod']
  ];
  Object.entries(cart).forEach(([artKey, item]) => {
    sysData.push([getItemArticul(artKey, item), item.qty, item.paymentMethod || 'Բանկային փոխանցումով']);
  });
  const sysSheet = XLSX.utils.aoa_to_sheet(sysData);
  XLSX.utils.book_append_sheet(workbook, sysSheet, "_data");
  workbook.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };

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

function importPreviousOrder(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const newCart = {};
      let loadedCount = 0;

      if (workbook.SheetNames.includes('_data')) {
        const sysRows = XLSX.utils.sheet_to_json(workbook.Sheets['_data'], { header: 1 });
        sysRows.forEach((r, idx) => {
          if (idx === 0 || !r || r.length < 2) return;
          const articul = String(r[0] || '').trim();
          const qty = Number(r[1]) || 0;
          const payMethod = String(r[2] || '').trim() || 'Բանկային փոխանցումով';
          
          if (articul && qty > 0) {
            const product = getProduct(articul);
            if (product) {
              newCart[articul] = { 
                articul: articul, 
                qty: qty, 
                addedPrice: product.wholesale || 0,
                paymentMethod: payMethod 
              };
              loadedCount++;
            }
          }
        });
      } else {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        rows.forEach(r => {
          if (!r || r.length === 0) return;
          let articul = '', qty = 0, payMethod = 'Բանկային փոխանցումով';

          for (let j = 0; j < r.length; j++) {
            if (String(r[j] || '').includes('ԱՐՊԱՆՔՆԵՐԻ') || String(r[j] || '').includes('ՏԵՂԵԿՈՒԹՅՈՒՆՆԵՐ') || String(r[j] || '').trim() === 'Արտիկուլ') return;
          }

          const firstCell = String(r[0] || '').trim();
          if (firstCell && !firstCell.includes('Կոնտրագենտ') && !firstCell.includes('Մեկնաբանություն') && !firstCell.includes('Առաքման') && !firstCell.includes('ԸՆԴՀԱՆՈՒՐ') && !firstCell.includes('Կազմակերպություն') && !firstCell.includes('Կոնտակտային') && !firstCell.includes('Գնացուցակի')) {
            articul = firstCell;
            for (let j = 1; j < r.length; j++) {
              let num = Number(r[j]);
              if (!isNaN(num) && num > 0 && num < 10000 && (j === 2 || j === 3 || j === 4)) {
                qty = num;
                break;
              }
            }
            if (!qty && r.length >= 3) qty = Number(r[2]) || 1;
            for (let cell of r) {
              if (String(cell || '').includes('Կանխիկ')) payMethod = 'Կանխիկ';
            }
          }

          if (articul && qty > 0) {
            const product = getProduct(articul);
            if (product) {
              newCart[articul] = { 
                articul: articul, 
                qty: qty, 
                addedPrice: product.wholesale || 0,
                paymentMethod: payMethod 
              };
              loadedCount++;
            }
          }
        });
      }

      if (loadedCount > 0) {
        cart = newCart;
        saveCartToStorage();
        updateOrderPanel();
        refreshAllActions();
        alert(`Նախորդ պատվերը հաջողությամբ բեռնվեց: Վերականգնվել է ${loadedCount} ապրանք:`);
      } else {
        alert('Ֆայլում հնարավոր չեղավ գտնել ապրանքների ճիշտ տվյալներ։');
      }
    } catch (err) {}
    event.target.value = '';
  };
  reader.readAsArrayBuffer(file);
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