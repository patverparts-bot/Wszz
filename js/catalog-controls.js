(() => {
 let controls={},popularity={},rules={days:90,orders:5,customers:3,personalOrders:3};
 const enabled=key=>controls[key]!==false;
 const checkboxes={favorites:'favOnlyFilter',promo:'promoOnlyFilter',stock:'stockOnlyFilter',wholesale:'wholesaleOnlyFilter'};
 function enforce(){
  if(!enabled('brand')){selectedBrands=[];document.getElementById('brandInput').value='';}
  if(!enabled('category')){selectedCategories=[];document.getElementById('categoryInput').value='';}
  if(!enabled('search'))document.getElementById('searchInput').value='';
  for(const [key,id] of Object.entries(checkboxes))if(!enabled(key))document.getElementById(id).checked=false;
  if(!enabled('sorting'))document.getElementById('sortBy').value='default';
 }
 function apply(data){
  controls=data.controls||{};popularity=data.popularity||{};rules=data.popularityRules||{days:90,orders:5,customers:3,personalOrders:3};
  const roots={brand:document.getElementById('brandInput').parentElement.parentElement,category:document.getElementById('categoryInput').parentElement.parentElement,search:document.getElementById('searchInput').parentElement};
  for(const [key,id] of Object.entries(checkboxes))roots[key]=document.getElementById(id).closest('label');
  for(const [key,root] of Object.entries(roots))root?.classList.toggle('catalog-control-hidden',!enabled(key));
  for(const b of document.querySelectorAll('[data-sort-column]')){b.disabled=!enabled('sorting');b.classList.toggle('catalog-control-hidden',!enabled('sorting'));}
  enforce();
  if(catalogLoaded)resetAndRender();
 }
 function badges(articul){
  const row=popularity[articul];if(!row)return '';
  const safe=k=>Math.max(1,Math.min(1000,Number(rules[k])||1));
  const globalTitle=row.popularSource==='manual'?'Գնումների ցուցանիշը ճշգրտված է ադմինիստրատորի կողմից':'Վերջին '+safe('days')+' օրում՝ առնվազն '+safe('orders')+' ավարտված պատվեր, '+safe('customers')+' հաճախորդից';
  const personalTitle=row.personalPopularSource==='manual'?'Ձեր գնումների ցուցանիշը ճշգրտված է ադմինիստրատորի կողմից':'Վերջին '+safe('days')+' օրում՝ ձեր առնվազն '+safe('personalOrders')+' ավարտված պատվերներում';
  return '<div class="purchase-badges">'+(enabled('popular')&&row.popular?'<span class="purchase-badge" title="'+globalTitle+'">Հաճախ են գնում</span>':'')+(enabled('personalPopular')&&row.personalPopular?'<span class="purchase-badge purchase-badge-personal" title="'+personalTitle+'">Դուք հաճախ եք գնում</span>':'')+'</div>';
 }
 window.ZZWS_CATALOG_CONTROLS={apply,enforce,enabled,badges,reset(){controls={};popularity={};rules={days:90,orders:5,customers:3,personalOrders:3};}};
})();
