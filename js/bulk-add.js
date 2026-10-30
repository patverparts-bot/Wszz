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
  return allProducts.filter(product => ZZWS_I18N.search(String(product.name || '').replace(/\s+/g,' '),normalizedQuery));
}

function resolveBulkAddInput(value) {
  const lines=String(value||'').normalize('NFKC').split(/[;\n\r]+/);
  const chunks=lines.flatMap(line=>/^[^,]*\s[-–—]\s*[+-]?\d+,\d+\s*(?:hat|հատ|шт\.?|pcs?\.?)?\s*$/iu.test(line)?[line]:line.split(',')).map(part=>part.trim()).filter(Boolean);
  const matches=new Map(),unmatched=[],invalid=[];
  const addMatchesFor=(query,qty=1,explicit=false)=>{
    const found=findBulkAddProduct(query);
    found.forEach(product=>{const previous=matches.get(product.articul);if(!previous)matches.set(product.articul,{product,qty,explicit});else if(explicit){previous.qty=previous.explicit?previous.qty+qty:qty;previous.explicit=true;}});
    return found.length>0;
  };
  for(const chunk of chunks){
    const exact=allProducts.some(p=>String(p.articul).trim().toLowerCase()===chunk.toLowerCase()||String(p.name||'').trim().toLowerCase()===chunk.toLowerCase());
    const quantity=exact?null:(chunk.match(/^(.+?)\s+[-–—]\s*([+-]?\d+(?:[.,]\d+)?)\s*(?:hat|հատ|шт\.?|pcs?\.?)?\s*$/iu)||chunk.match(/^(.+?)[-–—]\s*(\d+)\s*(?:hat|հատ|шт\.?|pcs?\.?)\s*$/iu));
    if(quantity){const qty=Number(quantity[2].replace(',','.'));if(!Number.isInteger(qty)||qty<1||qty>MAX_QTY){invalid.push({input:chunk,reason:'Քանակը պետք է լինի ամբողջ թիվ՝ 1-ից '+MAX_QTY});continue;}if(!addMatchesFor(quantity[1].trim(),qty,true))unmatched.push(chunk);continue;}
    if(addMatchesFor(chunk))continue;
    const tokens=chunk.split(/\s+/).filter(Boolean);for(const token of tokens)if(!addMatchesFor(token))unmatched.push(token);
  }
  const items=[...matches.values()].map(({product,qty})=>({product,qty}));
  return {products:items.map(item=>item.product),items,unmatched:[...new Set(unmatched)],invalid};
}

function previewBulkAdd() {
  const result = resolveBulkAddInput(document.getElementById('bulkAddInput').value);
  bulkAddPreviewItems = result.items;
  const preview = document.getElementById('bulkAddPreview');
  const summary = document.getElementById('bulkAddPreviewSummary');
  const list = document.getElementById('bulkAddPreviewList');
  const confirmButton = document.getElementById('bulkAddConfirmBtn');

  summary.textContent = `Գտնվել է ${result.products.length} ապրանք։` +
    ` Ընդհանուր քանակ՝ ${result.items.reduce((sum,item)=>sum+item.qty,0)} հատ։` +
    (result.unmatched.length ? ` Չգտնված մուտքեր՝ ${result.unmatched.join(', ')}։` : '') +
    (result.invalid.length ? ' Սխալ քանակ՝ '+result.invalid.map(row=>row.input+' ('+row.reason+')').join('; ')+'։' : '');

  const visibleProducts = result.items.slice(0, 30).map(({product,qty}) =>
    `<li><strong>${escapeHtml(product.articul)}</strong> — ${escapeHtml(product.name || '—')} · <strong>${qty} հատ</strong></li>`
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

  bulkAddPreviewItems.forEach(({product,qty}) => {
    const articul = product.articul;
    if (cart[articul]) {
      if (cart[articul].qty >= MAX_QTY) {
        capped++;
        return;
      }
      if(cart[articul].qty+qty>MAX_QTY)capped++;
      cart[articul].qty=Math.min(MAX_QTY,cart[articul].qty+qty);
    } else {
      if(qty>MAX_QTY)capped++;
      cart[articul] = {
        articul,
        qty: Math.min(MAX_QTY,qty),
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
  if (capped) alert(`${added} ապրանք ավելացվել է։ ${capped} ապրանքի քանակը սահմանափակվել է առավելագույնով՝ ${MAX_QTY} հատ։`);
}

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeBulkAddModal();
});
