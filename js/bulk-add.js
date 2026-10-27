let bulkAddPreviewItems = [];

function openBulkAddModal() {
  if (!authorizedClient) return;
  if (!catalogLoaded) {
    alert('Սպասեք մինչև գնացուցակը ամբողջությամբ բեռնվի։');
    return;
  }
  bulkAddPreviewItems = [];
  document.getElementById('bulkAddInput').value = '';
  document.getElementById('bulkAddPreview').classList.add('hidden');
  document.getElementById('bulkAddPreviewSummary').textContent = '';
  document.getElementById('bulkAddPreviewList').innerHTML = '';
  document.getElementById('bulkAddConfirmBtn').disabled = true;
  document.getElementById('bulkAddModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('bulkAddInput').focus(), 0);
}

function closeBulkAddModal() {
  document.getElementById('bulkAddModal').classList.add('hidden');
}

function clearBulkAddPreview() {
  bulkAddPreviewItems = [];
  document.getElementById('bulkAddPreview').classList.add('hidden');
  document.getElementById('bulkAddPreviewSummary').textContent = '';
  document.getElementById('bulkAddPreviewList').innerHTML = '';
  document.getElementById('bulkAddConfirmBtn').disabled = true;
}

function findBulkAddProduct(query) {
  const exactArticul = allProducts.find(product => String(product.articul).trim().toLowerCase() === query.toLowerCase());
  if (exactArticul) return [exactArticul];

  const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalizedQuery) return [];
  return allProducts.filter(product => String(product.name || '').toLowerCase().replace(/\s+/g, ' ').includes(normalizedQuery));
}

function resolveBulkAddInput(value) {
  const chunks = String(value || '').split(/[,;\n\r]+/).map(part => part.trim()).filter(Boolean);
  const matches = new Map();
  const unmatched = [];

  const addMatchesFor = query => {
    const found = findBulkAddProduct(query);
    found.forEach(product => matches.set(product.articul, product));
    return found.length > 0;
  };

  chunks.forEach(chunk => {
    if (addMatchesFor(chunk)) return;
    const tokens = chunk.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      const tokenMisses = [];
      tokens.forEach(token => {
        if (!addMatchesFor(token)) tokenMisses.push(token);
      });
      unmatched.push(...tokenMisses);
    } else {
      unmatched.push(chunk);
    }
  });

  return { products: [...matches.values()], unmatched: [...new Set(unmatched)] };
}

function previewBulkAdd() {
  const result = resolveBulkAddInput(document.getElementById('bulkAddInput').value);
  bulkAddPreviewItems = result.products;
  const preview = document.getElementById('bulkAddPreview');
  const summary = document.getElementById('bulkAddPreviewSummary');
  const list = document.getElementById('bulkAddPreviewList');
  const confirmButton = document.getElementById('bulkAddConfirmBtn');

  summary.textContent = `Գտնվել է ${result.products.length} ապրանք։` +
    (result.unmatched.length ? ` Չգտնված մուտքեր՝ ${result.unmatched.join(', ')}։` : '');

  const visibleProducts = result.products.slice(0, 30).map(product =>
    `<li><strong>${escapeHtml(product.articul)}</strong> — ${escapeHtml(product.name || '—')}</li>`
  );
  if (result.products.length > 30) visibleProducts.push(`<li>…և ևս ${result.products.length - 30}</li>`);
  list.innerHTML = visibleProducts.join('');
  preview.classList.remove('hidden');
  confirmButton.disabled = result.products.length === 0;
}

function confirmBulkAdd() {
  if (bulkAddPreviewItems.length === 0) return;
  let added = 0;
  let capped = 0;

  bulkAddPreviewItems.forEach(product => {
    const articul = product.articul;
    if (cart[articul]) {
      if (cart[articul].qty >= MAX_QTY) {
        capped++;
        return;
      }
      cart[articul].qty++;
    } else {
      cart[articul] = {
        articul,
        qty: 1,
        addedPrice: getItemWholesalePrice({ articul }),
        addedPriceMode: isAdminUser() ? adminOrderPriceMode : 'WS',
      };
    }
    added++;
  });

  saveCartToStorage();
  updateOrderPanel();
  refreshAllActions();
  closeBulkAddModal();
  if (capped) alert(`${added} ապրանք ավելացվել է։ ${capped} ապրանքի քանակը չի փոխվել՝ հասել է առավելագույնին։`);
}

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeBulkAddModal();
});
