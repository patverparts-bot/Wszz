// Dealer workspace. No model provider, photo download, reservation or delivery API.
(() => {
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(text,action,cls='dealer-button')=>{const b=node('button',text,cls);b.type='button';b.onclick=action;return b;};
 const money=n=>Number(n).toLocaleString('hy-AM')+' ֏';
 const specLabel=name=>window.ZZWS_ARMENIAN_SPECS?.label(name)||name;
 const specValue=value=>window.ZZWS_ARMENIAN_SPECS?.value(value)||String(value);
 const labels={other:'Այլ ապրանքներ',washer:'Լվացքի մեքենա',dryer:'Չորանոց',fridge:'Սառնարան',dishwasher:'Սպասք լվացող մեքենա',oven:'Ջեռոց',hob:'Եփման վահանակ',hood:'Օդաքաշ',tv:'Հեռուստացույց',soundbar:'Սաունդբար',vacuum:'Փոշեկուլ',coffee:'Սրճեփ',kettle:'Թեյնիկ',iron:'Արդուկ',microwave:'Միկրոալիքային վառարան'};
 const recipes={kitchen:{label:'Խոհանոց',types:['oven','hob','hood']},laundry:{label:'Լվացք և չորացում',types:['washer','dryer']},entertainment:{label:'Հեռուստացույց և ձայն',types:['tv','soundbar']}};
 let facts={},factNames=new Map(),owner=null,revision=0,dialogId=0,view='table',selected=[],filters={},details=new Map(),loading=false;
 const dialogs=new Set();
 const toolbar=node('section',null,'dealer-workspace');toolbar.id='dealerWorkspace';toolbar.setAttribute('aria-label','Դիլերի գործիքներ');
 const title=node('div',null,'dealer-workspace-title');title.append(node('strong','Ձեր վաճառքի օգնականը'),node('span','Ընտրեք, համեմատեք և առաջարկեք գնորդին'));
 const actions=node('div',null,'dealer-workspace-actions');
 const tableButton=button('Աղյուսակ',()=>setView('table')),cardsButton=button('Քարտեր',()=>setView('cards'));
 tableButton.id='dealerTableView';cardsButton.id='dealerCardsView';
 const compareButton=button('Համեմատել · 0',()=>compare());compareButton.id='dealerCompare';
 const showroomButton=button('Ցույց տալ գնորդին',()=>showroom(), 'dealer-button dealer-primary');showroomButton.id='dealerShowroom';
 const bundlesButton=button('Հավաքածուներ',()=>bundles());bundlesButton.id='dealerBundles';
 const offersButton=button('Պահպանված առաջարկներ',()=>offers());offersButton.id='dealerOffers';
 const advanced=node('details',null,'dealer-advanced-tools');advanced.id='dealerAdvancedTools';advanced.append(node('summary','Վաճառողի լրացուցիչ գործիքներ'),bundlesButton,offersButton,showroomButton);actions.append(tableButton,cardsButton,compareButton,advanced);toolbar.append(title,actions);
 document.getElementById('catalogContent').before(toolbar);
 const filterBox=node('details',null,'dealer-tech-filters');filterBox.id='dealerTechFilters';
 filterBox.append(node('summary','Ընտրել ըստ բնութագրերի'));
 const filterFields=node('div',null,'dealer-filter-fields'),filterStatus=node('p','Բնութագրերը բեռնվում են…','dealer-muted');filterStatus.id='dealerFactsStatus';filterStatus.setAttribute('role','status');
 filterBox.append(filterFields,filterStatus);document.getElementById('filtersContainer').append(filterBox);
 const message=node('p',null,'dealer-notice');message.id='dealerNotice';message.setAttribute('role','status');toolbar.after(message);
 function notice(text){message.textContent=text;}
 function live(id){return serverIdentity?.id===id&&catalogLoaded;}
 function price(p){return p?getItemWholesalePrice({articul:p.articul}):0;}
 function photo(p){const box=node('div',null,'dealer-photo');box.innerHTML=getProductImageHtml(p.articul,p.name);return box;}
 function field(label,control){const l=node('label',null,'dealer-field');l.append(node('span',label),control);return l;}
 function select(options,current=''){const s=node('select');for(const [v,t] of options){const o=node('option',t);o.value=v;s.append(o);}s.value=current;return s;}
 function numeric(value,{min=0,max=1e9,step='any'}={}){const i=node('input');i.type='number';i.min=String(min);i.max=String(max);i.step=step;i.value=value==null?'':String(value);return i;}
 function dialog(titleText,cls=''){
  const d=node('dialog',null,'dealer-dialog '+cls),h=node('header',null,'dealer-dialog-header'),heading=node('h2',titleText),body=node('div',null,'dealer-dialog-body');
  heading.id='dealerDialogTitle'+(++dialogId);d.setAttribute('aria-labelledby',heading.id);
  const origin=document.activeElement;const close=()=>{d.close();d.remove();dialogs.delete(d);if(!dialogs.size)document.body.classList.remove('dealer-showroom-active');if(origin?.isConnected)origin.focus();};
  h.append(heading,button('Փակել',close,'dealer-button dealer-close'));d.append(h,body);document.body.append(d);dialogs.add(d);d.addEventListener('cancel',e=>{e.preventDefault();close();});
  d.showModal();h.querySelector('button').focus();return {d,body,close};
 }
 async function request(path,payload){return secureApi(path,{method:'POST',body:JSON.stringify(payload)});}
 function setView(value){view=value;document.documentElement.dataset.dealerView=value;tableButton.setAttribute('aria-pressed',String(value==='table'));cardsButton.setAttribute('aria-pressed',String(value==='cards'));if(catalogLoaded)rerenderVisible();}
 function updateSelection(){
  selected=selected.filter(id=>getProduct(id));compareButton.textContent='Համեմատել · '+selected.length;compareButton.disabled=selected.length<2;
  document.querySelectorAll('[data-dealer-compare]').forEach(b=>{b.setAttribute('aria-pressed',String(selected.includes(b.dataset.dealerCompare)));b.textContent=selected.includes(b.dataset.dealerCompare)?'✓':'⇄';b.title=selected.includes(b.dataset.dealerCompare)?'Համեմատության մեջ':'Համեմատել';});
 }
 function toggleCompare(articul){
  if(!getProduct(articul))return;
  if(selected.includes(articul))selected=selected.filter(id=>id!==articul);
  else if(selected.length<4)selected.push(articul);else notice('Կարող եք համեմատել առավելագույնը չորս ապրանք։');
  updateSelection();
 }
 function decorate(element,p){
  const target=element.tagName==='TR'?element.querySelector('[data-zigzag-art]')?.parentElement:element.querySelector('h4')?.parentElement;
  if(!target)return;
  const row=node('div',null,'dealer-product-actions'),open=button('Ապրանքի քարտ',()=>openProduct(p.articul),'dealer-text-button'),choose=button(selected.includes(p.articul)?'✓ Համեմատության մեջ':'Համեմատել',()=>toggleCompare(p.articul),'dealer-text-button');
  element.querySelectorAll('.zigzag-product-ask').forEach(b=>b.hidden=true);
  choose.textContent=selected.includes(p.articul)?'✓':'⇄';choose.title='Համեմատել';choose.setAttribute('aria-label','Համեմատել՝ '+p.name);
  open.dataset.dealerDetails=p.articul;choose.dataset.dealerCompare=p.articul;choose.setAttribute('aria-pressed',String(selected.includes(p.articul)));row.append(open,choose);target.append(row);
  const f=facts[p.articul];if(f){const brief=[];if(f.capacity)brief.push(f.capacity+' կգ');if(f.diagonal)brief.push(f.diagonal+'″');if(f.dimensions?.width)brief.push('Լ '+f.dimensions.width+' սմ');if(f.dimensions?.depth)brief.push('Խ '+f.dimensions.depth+' սմ');if(brief.length)target.append(node('p',brief.join(' · '),'dealer-product-brief'));}
 }
 function selectedType(){
  if(filters.type)return filters.type;
  const types=new Set(allProducts.filter(p=>!selectedCategories.length||selectedCategories.includes(p.category)).map(p=>facts[p.articul]?.type).filter(t=>t&&t!=='other'));
  return types.size===1?[...types][0]:'';
 }
 const specific={washer:['capacityMin','spinMin','drying','inverter'],dryer:['capacityMin'],fridge:['volumeMin','noFrost'],dishwasher:['placeSettingsMin'],tv:['diagonalMin','resolution','screen'],oven:['connection','energy'],hob:['connection'],hood:['energy']};
 const filterEnabled=key=>window.ZZWS_CATALOG_CONTROLS?.enabled('tech_'+key)!==false;
 function allowedFilters(){for(const key of Object.keys(filters))if(!filterEnabled(key))delete filters[key];return ['type','widthMax','heightMax','depthMax','installation',...(specific[selectedType()]||[])].filter(filterEnabled);}
 function renderFilters(){
  const allowed=allowedFilters();for(const k of Object.keys(filters))if(!allowed.includes(k))delete filters[k];
  filterFields.replaceChildren();filterBox.classList.toggle('catalog-control-hidden',allowed.length===0);
  const available=[...new Set(allProducts.map(p=>facts[p.articul]?.type).filter(t=>t&&t!=='other'))];
  const type=select([['','Բոլոր տեսակները'],...available.map(t=>[t,labels[t]||t])],filters.type||'');type.id='dealerFilterType';
  type.onchange=()=>{filters={type:type.value};renderFilters();resetAndRender();};if(allowed.includes('type'))filterFields.append(field('Տեխնիկայի տեսակ',type));
  const numericLabels={widthMax:'Լայնություն՝ առավելագույնը (սմ)',heightMax:'Բարձրություն՝ առավելագույնը (սմ)',depthMax:'Խորություն՝ առավելագույնը (սմ)',capacityMin:'Տարողություն՝ սկսած (կգ)',volumeMin:'Ծավալ՝ սկսած (լ)',placeSettingsMin:'Սպասքի հավաքածու՝ սկսած',spinMin:'Քամում՝ սկսած (պտ/րոպե)',diagonalMin:'Անկյունագիծ՝ սկսած (դյույմ)'};
  for(const key of allowed.filter(k=>numericLabels[k])){
   const i=numeric(filters[key],{min:.1,max:key==='spinMin'?10000:2000});i.dataset.techFilter=key;
   i.onchange=()=>{if(i.value&&!i.checkValidity()){i.reportValidity();return;}if(i.value)filters[key]=Number(i.value);else delete filters[key];resetAndRender();};filterFields.append(field(numericLabels[key],i));
  }
  for(const key of allowed.filter(k=>['drying','inverter','noFrost','resolution','screen','installation','energy','connection'].includes(k))){
   const binary=['drying','inverter','noFrost'].includes(key),typeKey=selectedType();
   const values=binary?[['true','Այո'],['false','Ոչ']]:[...new Set(allProducts.filter(p=>!typeKey||facts[p.articul]?.type===typeKey).map(p=>facts[p.articul]?.[key]).filter(Boolean))].sort().map(v=>[v,specValue(v)]);
   if(!values.length&&!filters[key])continue;
   const s=select([['','Բոլորը'],...values],filters[key]??'');s.dataset.techFilter=key;
   s.onchange=()=>{if(s.value)filters[key]=s.value;else delete filters[key];resetAndRender();};
   filterFields.append(field(({drying:'Չորացում',inverter:'Ինվերտոր',noFrost:'No Frost',resolution:'Թույլատրելիություն',screen:'Էկրանի տեսակ',installation:'Տեղադրման տեսակ',energy:'Էներգախնայողության դաս',connection:'Միացման տեսակ'})[key],s));
  }
  filterFields.append(button('Մաքրել բնութագրերը',()=>{filters={};renderFilters();resetAndRender();}));
  filterFields.querySelectorAll('input,select').forEach(e=>e.disabled=loading||!Object.keys(facts).length);
 }
 function matches(p){
  const entries=Object.entries(filters).filter(([key,v])=>filterEnabled(key)&&v!=='');const f=facts[p.articul];if(!entries.length)return true;if(!f)return false;
  return entries.every(([key,limit])=>{
   if(limit==='')return true;
   if(/Max$/.test(key)){const v=f.dimensions?.[key.slice(0,-3)];return Number.isFinite(v)&&v<=limit;}
   if(/Min$/.test(key)){const v=f[key.slice(0,-3)];return Number.isFinite(v)&&v>=limit;}
   if(['drying','inverter','noFrost'].includes(key))return f[key]!==null&&String(f[key])===limit;
   return f[key]===limit;
  });
 }
 async function refresh(){
  if(!serverIdentity||!catalogLoaded)return;const userId=serverIdentity.id,ticket=++revision;
  const sameOwner=owner===userId;
  facts=sameOwner?Object.fromEntries(allProducts.filter(p=>facts[p.articul]&&factNames.get(p.articul)===p.name).map(p=>[p.articul,facts[p.articul]])):{};
  if(!sameOwner)filters={};owner=userId;loading=true;details.clear();renderFilters();filterStatus.textContent='Բնութագրերը բեռնվում են…';
  try{
   const data=await request('dealer/facts',{});if(!live(userId)||ticket!==revision)return;
   facts=data.items||{};factNames=new Map(allProducts.map(p=>[p.articul,p.name]));filterStatus.textContent='Ֆիլտրերը գործում են միայն հաստատված բնութագրերով։ Չափերը՝ սարքի, ոչ փաթեթավորման։';
  }catch(e){if(!live(userId)||ticket!==revision)return;filterStatus.textContent='Բնութագրերը չբեռնվեցին։ '+(e.status===404?'Պահանջվում է սերվերի համապատասխան թարմացումը։':ZZWS.message(e));}
  finally{if(live(userId)&&ticket===revision){loading=false;renderFilters();updateSelection();resetAndRender();}}
 }
 async function fetchDetails(ids){
  const userId=serverIdentity?.id;if(!userId)return [];
  if(ids.some(id=>!getProduct(id)))throw Error('Ապրանքը հասանելի չէ։');
  const missing=ids.filter(id=>!details.has(id));
  if(missing.length){const data=await request('dealer/details',{articuls:missing});if(!live(userId))return [];
   for(const item of data.items||[])if(getProduct(item.articul))details.set(item.articul,item);}
  return ids.map(id=>details.get(id)).filter(Boolean);
 }
 function source(details,container){
  if(details.sourceUrl){const a=node('a','Բնութագրերի աղբյուրը՝ zigzag.am');a.href=details.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';container.append(a);}
  if(details.checkedAt)container.append(node('p','Ստուգված՝ '+new Date(details.checkedAt).toLocaleDateString('hy-AM'),'dealer-muted'));
 }
 function specTable(specs){const t=node('table',null,'dealer-spec-table');for(const s of specs){const tr=t.insertRow();tr.append(node('th',specLabel(s.name)),node('td',specValue(s.value)));}return t;}
 function dimensionsLine(d){return ['width','height','depth'].filter(k=>Number.isFinite(d?.[k])).map(k=>({width:'Լ',height:'Բ',depth:'Խ'})[k]+' '+d[k]+' սմ').join(' · ');}
 function cartControls(p,body){
  const userId=serverIdentity.id,shownPrice=price(p),shownMode=adminOrderPriceMode;
  const row=node('div',null,'dealer-buy-row'),qty=numeric(1,{min:1,max:MAX_QTY,step:1}),state=node('p',null,'dealer-muted');qty.setAttribute('aria-label','Քանակ');
  const add=button('Ավելացնել զամբյուղին',()=>{
   const current=getProduct(p.articul),amount=Number(qty.value),existing=cart[p.articul]?.qty||0;
   if(!live(userId)||!current||price(current)<=0||price(current)!==shownPrice||shownMode!==adminOrderPriceMode){state.textContent='Գինը կամ հասանելիությունը փոխվել է։ Նորից բացեք քարտը։';return;}
   if(!Number.isInteger(amount)||amount<1||existing+amount>MAX_QTY){state.textContent='Ստուգեք քանակը և զամբյուղի սահմանաչափը։';return;}
   setDirectQty(p.articul,existing+amount);window.ZZWS_MEMORY?.capture();state.textContent='Զամբյուղում՝ '+(existing+amount)+' հատ։';
  },'dealer-button dealer-primary');add.disabled=price(p)<=0;row.append(field('Քանակ',qty),add);body.append(row,state);
 }
 async function openProduct(articul){
  const p=getProduct(articul);if(!p)return;const userId=serverIdentity.id,{d,body}=dialog(p.name,'dealer-product-drawer');body.append(node('p','Բեռնվում է…'));
  try{
   const [info]=await fetchDetails([articul]);if(!info||!d.isConnected||!live(userId))return;
   body.replaceChildren();const top=node('div',null,'dealer-product-hero'),summary=node('div');summary.append(node('p',p.articul+' · '+p.brand,'dealer-muted'),node('strong',price(getProduct(articul))>0?money(price(getProduct(articul))):'Գինը ճշտել մենեջերի հետ','dealer-product-price'));
   top.append(photo(p),summary);body.append(top);
   if(info.highlights.length){body.append(node('h3','Ինչն առանձնացնել գնորդին'),specTable(info.highlights));}
   const sizes=node('section',null,'dealer-size-summary');sizes.append(node('h3','Չափեր'),node('p','Սարք՝ '+(dimensionsLine(info.facts.dimensions)||'չհաստատված')),node('p','Տեղադրման խորշ՝ '+(dimensionsLine(info.facts.niche)||'տվյալներ չկան')));body.append(sizes);
   cartControls(p,body);
   const tools=node('div',null,'dealer-inline-actions');tools.append(button('Ցույց տալ գնորդին',()=>showroom([articul])),button('Համեմատել',()=>{toggleCompare(articul);notice('Ընտրված է համեմատության համար։');}),button('Փոխարինող մոդելներ',()=>ZZWS_REPLACEMENTS.open(articul)));
   tools.append(button('Հարցնել ԶիգԶագին',()=>ZZWS_ASSISTANT.ask(articul)));
   const recipe=Object.entries(recipes).find(([,r])=>r.types.includes(info.facts.type))?.[0];if(recipe)tools.append(button('Հավաքածու կազմել',()=>bundles(recipe,articul)));body.append(tools);
   body.append(node('h3','Բոլոր բնութագրերը'));if(info.specifications.length)body.append(specTable(info.specifications));else body.append(node('p','Այս մոդելի հաստատված բնութագրերը դեռ չկան։'));
   source(info,body);
  }catch(e){if(d.isConnected)body.replaceChildren(node('p',ZZWS.message(e)));}
 }
 async function compare(ids=selected){
  ids=[...new Set(ids)].filter(id=>getProduct(id)).slice(0,4);if(ids.length<2)return;
  const userId=serverIdentity.id,{d,body}=dialog('Ապրանքների համեմատություն','dealer-comparison-dialog');body.append(node('p','Բեռնվում է…'));
  try{
   const items=await fetchDetails(ids);if(!d.isConnected||!live(userId)||items.length!==ids.length)return;
   body.replaceChildren();const difference=node('input');difference.type='checkbox';difference.id='dealerOnlyDifferences';body.append(field('Միայն տարբերությունները',difference));
   const wrap=node('div',null,'dealer-comparison-scroll'),table=node('table',null,'dealer-spec-table dealer-comparison-table'),head=table.createTHead().insertRow();head.append(node('th','Բնութագիր'));
   for(const item of items){const cell=node('th'),p=getProduct(item.articul);cell.append(photo(p),node('strong',p.name),node('p',p.articul),node('p',money(price(p))));head.append(cell);}
   const tbody=table.createTBody(),keys=[...new Set(items.flatMap(i=>i.specifications.map(s=>s.name)))];
   const show=()=>{tbody.replaceChildren();for(const name of keys){const values=items.map(i=>i.specifications.find(s=>s.name===name)?.value??'—');if(difference.checked&&new Set(values).size===1)continue;const tr=tbody.insertRow();tr.append(node('th',specLabel(name)));values.forEach(v=>tr.append(node('td',specValue(v))));}};
   difference.onchange=show;show();wrap.append(table);body.append(wrap,button('Ցույց տալ գնորդին',()=>showroom(ids),'dealer-button dealer-primary'));
  }catch(e){if(d.isConnected)body.replaceChildren(node('p',ZZWS.message(e)));}
 }
 function showroom(initial,{bundleSale=null,saved=null}={}){
  if(!serverIdentity||!catalogLoaded)return;
  const userId=serverIdentity.id,first=initial||selected.length&&selected||filteredProducts.slice(0,1).map(p=>p.articul);
  const ids=[...new Set(first)].filter(id=>getProduct(id));
  const {d,body}=dialog('ZIGZAG · Առաջարկ գնորդի համար','dealer-showroom');document.body.classList.add('dealer-showroom-active');
  const quote=new Map(ids.map(id=>[id,{sale:saved?.items.find(i=>i.articul===id)?.sale??Math.max(0,Number(getProduct(id).retail)||0),qty:saved?.items.find(i=>i.articul===id)?.qty??1}]));
  const bar=node('div',null,'dealer-showroom-toolbar'),search=node('input'),results=node('div',null,'dealer-showroom-search-results'),cards=node('div',null,'dealer-showroom-grid'),total=node('strong',null,'dealer-quote-total'),status=node('p',null,'dealer-muted');
  search.type='search';search.placeholder='Գտնել և ավելացնել մոդել կամ արտիկուլ';search.setAttribute('aria-label','Գտնել ապրանք առաջարկի համար');
  const bundlePrice=bundleSale==null?null:numeric(bundleSale,{min:.01});
  bar.append(search,button('Տպել առաջարկը',()=>{
   if(!live(userId))return;
   if(!quote.size||bundlePrice&&(!Number.isFinite(Number(bundlePrice.value))||Number(bundlePrice.value)<=0)||![...quote.values()].every(r=>(bundlePrice||Number.isFinite(r.sale)&&r.sale>0)&&Number.isInteger(r.qty)&&r.qty>0&&r.qty<=MAX_QTY)){status.textContent='Տպելուց առաջ նշեք վաճառքի գներն ու քանակները։';return;}
   window.print();
  },'dealer-button dealer-primary'));
  const saveRow=node('div',null,'dealer-offer-save'),offerTitle=node('input');offerTitle.type='text';offerTitle.maxLength=80;offerTitle.placeholder='Առաջարկի անվանում';offerTitle.setAttribute('aria-label','Առաջարկի անվանում');offerTitle.value=saved?.title||'';
  saveRow.append(offerTitle,button('Պահպանել առաջարկը',()=>{
   if(!live(userId))return;const title=offerTitle.value.trim();if(!title||!quote.size){status.textContent='Նշեք անվանումը և ավելացրեք ապրանքներ։';return;}
   const items=[...quote].map(([articul,r])=>({articul,qty:r.qty,sale:r.sale}));
   if(items.some(i=>!Number.isFinite(i.sale)||i.sale<0||i.sale>1e9||!Number.isInteger(i.qty)||i.qty<1||i.qty>MAX_QTY)||bundlePrice&&(!Number.isFinite(Number(bundlePrice.value))||Number(bundlePrice.value)<=0||Number(bundlePrice.value)>1e9)){status.textContent='Ստուգեք գներն ու քանակները։';return;}
   const savedOffers=readOffers(),id=saved?.id||crypto.randomUUID();if(savedOffers.length>=10&&!savedOffers.some(o=>o.id===id)){status.textContent='Արդեն պահպանված է 10 առաջարկ։ Հեռացրեք ավելորդը պահպանվածների ցանկից։';return;}
   const offer={id,title,created:new Date().toISOString(),items,bundleSale:bundlePrice?Number(bundlePrice.value):null};
   try{writeOffers([...savedOffers.filter(o=>o.id!==id),offer]);saved=offer;status.textContent='Առաջարկը պահպանված է։ Սարքերի միջև համաժամացման վիճակը՝ կատալոգի վերևում։';}catch{status.textContent='Պահպանումը չհաջողվեց։ Ստուգեք սարքի ազատ տարածքը։';}
  }));
  body.append(bar,results,saveRow);if(bundlePrice){bundlePrice.dataset.bundleSale='true';body.append(field('Հավաքածուի վաճառքի գին (֏)',bundlePrice));bundlePrice.oninput=()=>summary();}body.append(cards,total,status);
  function summary(){total.textContent=(bundlePrice?'Հավաքածուի ընդհանուր գինը՝ ':'Ընդհանուր՝ ')+money(bundlePrice?Number(bundlePrice.value)||0:[...quote.values()].reduce((sum,r)=>sum+(Number(r.sale)||0)*r.qty,0));}
  function render(){
   if(!live(userId))return;cards.replaceChildren();for(const [id,row] of quote){
    const p=getProduct(id);if(!p){quote.delete(id);continue;}
    const card=node('article',null,'dealer-showroom-card');card.dataset.showroomSku=id;
    card.append(photo(p),node('p',p.brand,'dealer-muted'),node('h3',p.name),node('p','Արտիկուլ՝ '+id,'dealer-muted'));
    const info=details.get(id),f=facts[id];if(info?.highlights.length)card.append(specTable(info.highlights));else if(f){const brief=[dimensionsLine(f.dimensions),f.capacity?f.capacity+' կգ':'',f.diagonal?f.diagonal+'″':''].filter(Boolean);card.append(node('p',brief.join(' · ')));}
    const sale=numeric(row.sale||'',{min:.01}),qty=numeric(row.qty,{min:1,max:MAX_QTY,step:1}),printed=node('p',null,'dealer-print-price');
    sale.dataset.saleSku=id;qty.dataset.saleQty=id;
    const update=()=>{row.sale=Number(sale.value);row.qty=Number(qty.value);printed.textContent=bundlePrice?'Քանակ՝ '+row.qty:money(row.sale)+' × '+row.qty+' = '+money(row.sale*row.qty);summary();};sale.oninput=qty.oninput=update;update();
    if(!bundlePrice)card.append(field('Վաճառքի գին (֏)',sale));card.append(field('Քանակ',qty),printed,button('Հեռացնել',()=>{quote.delete(id);render();}));cards.append(card);
   }summary();if(!quote.size)status.textContent='Գտեք և ավելացրեք ապրանքներ առաջարկին։';
  }
  function find(){results.replaceChildren();const q=search.value.trim().toLowerCase();if(!q)return;for(const p of allProducts.filter(p=>(p.articul+' '+p.name).toLowerCase().includes(q)&&!quote.has(p.articul)).slice(0,12))results.append(button(p.name+' · '+p.articul,()=>{if(quote.size>=20){status.textContent='Առաջարկում թույլատրվում է առավելագույնը 20 ապրանք։';return;}quote.set(p.articul,{sale:Number(p.retail)||0,qty:1});search.value='';find();render();hydrate([p.articul]);}));}
  async function hydrate(items){for(let i=0;i<items.length;i+=4){try{await fetchDetails(items.slice(i,i+4));if(!d.isConnected||!live(userId))return;}catch{}}if(d.isConnected)render();}
  search.oninput=find;render();hydrate(ids);
 }
 function readOffers(){try{const value=JSON.parse(localStorage.getItem('zigzag_dealer_offers_'+userStorageId())||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
 function writeOffers(value){localStorage.setItem('zigzag_dealer_offers_'+userStorageId(),JSON.stringify(value));window.ZZWS_MEMORY?.capture();window.ZZWS_MEMORY?.flush();}
 function offers(){
  if(!serverIdentity||!catalogLoaded)return;const userId=serverIdentity.id,{body,close}=dialog('Պահպանված առաջարկներ','dealer-offers-dialog');
  function render(){body.replaceChildren();const list=readOffers();if(!list.length)body.append(node('p','Պահպանված առաջարկներ դեռ չկան։ Գնորդի ցուցադրման ռեժիմում կազմեք և պահպանեք առաջարկ։'));
   for(const offer of list){const row=node('section',null,'dealer-saved-offer'),missing=offer.items.filter(i=>!getProduct(i.articul)),tools=node('div',null,'dealer-inline-actions');row.append(node('h3',offer.title),node('p',offer.items.length+' ապրանք · '+new Date(offer.created).toLocaleDateString('hy-AM'),'dealer-muted'));
    if(missing.length)row.append(node('p','Որոշ ապրանքներ այլևս հասանելի չեն։ Դրանք չեն ցուցադրվի։','dealer-muted'));
    const show=button('Բացել առաջարկը',()=>{if(!live(userId))return;const ids=offer.items.map(i=>i.articul).filter(id=>getProduct(id));if(!ids.length)return;close();showroom(ids,{bundleSale:offer.bundleSale,saved:offer});});show.disabled=missing.length===offer.items.length||!!offer.bundleSale&&missing.length>0;
    if(offer.bundleSale&&missing.length)row.append(node('p','Հավաքածուի ապրանքները փոխվել են։ Կազմեք նոր հավաքածու։','dealer-muted'));
    tools.append(show,button('Ջնջել',()=>{if(!live(userId))return;writeOffers(readOffers().filter(o=>o.id!==offer.id));render();}));row.append(tools);body.append(row);
   }
  }render();
 }
 function bundles(recipe='kitchen',seed=null){
  if(!serverIdentity||!catalogLoaded)return;const userId=serverIdentity.id,{d,body}=dialog('Հավաքածու կազմել','dealer-bundle-dialog');
  const recipeSelect=select(Object.entries(recipes).map(([key,r])=>[key,r.label]),recipe),suggestions=node('div',null,'dealer-bundle-suggestions'),builder=node('div',null,'dealer-bundle-builder'),status=node('p',null,'dealer-muted'),total=node('strong',null,'dealer-product-price'),sale=numeric(null,{min:.01}),chosen=new Map(),shownPrices=new Map();let turn=0,shownMode=adminOrderPriceMode;
  body.append(field('Հավաքածուի տեսակ',recipeSelect),node('p','Առաջարկները հիմնված են բոլոր հաճախորդների նախկին ավարտված գնումների անանուն համակցությունների վրա։ Տեղադրման կամ միացման համատեղելիությունը հաստատված չէ։','dealer-muted'),suggestions,node('h3','Ձեր հավաքածուն'),builder,field('Հավաքածուի վաճառքի գին (֏)',sale),total,status);
  const tools=node('div',null,'dealer-inline-actions');body.append(tools);
  function currentProducts(){return [...chosen.values()].map(id=>getProduct(id)).filter(Boolean);}
  function sum(){shownPrices.clear();shownMode=adminOrderPriceMode;const products=currentProducts();for(const p of products)shownPrices.set(p.articul,price(p));total.textContent='Ձեր գնման գումարը՝ '+money(products.reduce((n,p)=>n+price(p),0));}
  function build(prefill=[]){
   chosen.clear();builder.replaceChildren();for(const type of recipes[recipeSelect.value].types){
    const options=allProducts.filter(p=>facts[p.articul]?.type===type&&price(p)>0),initial=prefill.find(p=>p.type===type)?.articul||(seed&&options.some(p=>p.articul===seed)?seed:'');
    const s=select([['','Ընտրեք մոդելը'],...options.map(p=>[p.articul,p.name+' · '+money(price(p))])],initial);s.dataset.bundleType=type;if(initial)chosen.set(type,initial);
    s.onchange=()=>{if(s.value)chosen.set(type,s.value);else chosen.delete(type);sum();};builder.append(field(labels[type],s));
   }sum();
  }
  function validate(){const products=currentProducts();if(!live(userId)||products.length!==recipes[recipeSelect.value].types.length||products.some(p=>price(p)<=0)){status.textContent='Ընտրեք հասանելի մոդել յուրաքանչյուր բաժնից։';return null;}if(shownMode!==adminOrderPriceMode||products.some(p=>shownPrices.get(p.articul)!==price(p))){sum();status.textContent='Գները փոխվել են։ Ստուգեք թարմացված գումարը և կրկնեք գործողությունը։';return null;}return products;}
  tools.append(button('Ավելացնել հավաքածուն զամբյուղին',()=>{
   const products=validate();if(!products)return;
   if(products.some(p=>(cart[p.articul]?.qty||0)+1>MAX_QTY)){status.textContent='Զամբյուղի քանակի սահմանաչափը գերազանցվում է։';return;}
   for(const p of products)setDirectQty(p.articul,(cart[p.articul]?.qty||0)+1);window.ZZWS_MEMORY?.capture();status.textContent='Հավաքածուն ավելացվեց զամբյուղին։';
  },'dealer-button dealer-primary'),button('Ցույց տալ գնորդին',()=>{
   const products=validate();if(!products)return;const n=Number(sale.value);if(sale.value&&(!Number.isFinite(n)||n<=0)){sale.reportValidity();return;}
   showroom(products.map(p=>p.articul),{bundleSale:n>0?n:null});
  }));
  async function load(){
   const ticket=++turn;suggestions.replaceChildren(node('p','Համատեղ գնումները վերլուծվում են…'));build();
   try{const data=await request('dealer/bundles',{recipe:recipeSelect.value,seed,priceMode:adminOrderPriceMode});if(!d.isConnected||!live(userId)||ticket!==turn)return;
    suggestions.replaceChildren();if(!data.bundles?.length)suggestions.append(node('p','Բավարար համատեղ գնումներ չկան։ Կարող եք ինքնուրույն կազմել հավաքածուն։'));
    for(const bundle of data.bundles||[]){const card=node('section',null,'dealer-bundle-option');card.append(node('h3',bundle.items.map(p=>p.name).join(' + ')),node('p','Միասին գնվել են տարբեր հաճախորդների ավարտված պատվերներում։'),node('strong',money(bundle.total)),button('Ընտրել այս հավաքածուն',()=>build(bundle.items)));suggestions.append(card);}
   }catch(e){if(d.isConnected&&ticket===turn)suggestions.replaceChildren(node('p','Պատմության առաջարկները չբեռնվեցին։ '+ZZWS.message(e)));}
  }
  recipeSelect.onchange=()=>{seed=null;load();};load();
 }
 function reset(){
  revision++;owner=null;facts={};factNames.clear();details.clear();filters={};selected=[];loading=false;
  for(const d of dialogs){d.close();d.remove();}dialogs.clear();document.body.classList.remove('dealer-showroom-active');notice('');updateSelection();
 }
 window.ZZWS_DEALER={get view(){return view;},decorate,matches,renderFilters,refresh,reset,openProduct,compare,showroom,bundles,clearFilters(){filters={};renderFilters();},facts:()=>facts};
 setView('table');renderFilters();updateSelection();if(catalogLoaded)refresh();
})();
