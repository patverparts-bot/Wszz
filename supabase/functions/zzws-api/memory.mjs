const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function validateMemory(section,value){
 if(!['cart','favorites','history','filters','preferences','draft'].includes(section))throw new Error('Անհայտ բաժին');
 if(JSON.stringify(value).length>300000)throw new Error('Պահպանման տվյալները չափազանց շատ են');
 if(section==='favorites'){
  if(!Array.isArray(value)||value.length>10000||value.some(v=>typeof v!=='string'||v.length>100))throw new Error('Ընտրվածների սխալ ցանկ');
  return [...new Set(value)];
 }
 if(section==='history'){
  if(!Array.isArray(value)||value.length>20)throw new Error('Պատմությունում թույլատրվում է մինչև 20 պատվեր');
  return value.map(row=>{
   if(!object(row)||!object(row.cartSnapshot))throw new Error('Պատմության սխալ գրառում');
   const snapshot=Object.create(null);
   for(const [key,item] of Object.entries(row.cartSnapshot)){
    if(!object(item)||!Number.isInteger(item.qty)||item.qty<1||item.qty>1000000)throw new Error('Պատմության սխալ դիրք');
    snapshot[key]={articul:String(item.articul||key).slice(0,100),qty:item.qty,name:String(item.name||'').slice(0,500),price:Math.max(0,Number(item.price)||0)};
   }
   return {id:String(row.id||'').slice(0,100),date:String(row.date||'').slice(0,100),organization:String(row.organization||'').slice(0,300),totalSum:Math.max(0,Number(row.totalSum)||0),itemsCount:Object.keys(snapshot).length,actionType:String(row.actionType||'Excel').slice(0,40),cartSnapshot:snapshot};
  });
 }
 if(!object(value))throw new Error('Սխալ տվյալներ');
 if(section==='cart'){
  if(Object.keys(value).length>5000)throw new Error('Դիրքերը չափազանց շատ են');
  const result=Object.create(null);
  for(const [key,row] of Object.entries(value)){
   if(!object(row)||key.length>100||['__proto__','constructor','prototype'].includes(key)||!Number.isInteger(row.qty)||row.qty<1||row.qty>1000000)throw new Error('Զամբյուղի սխալ դիրք');
   result[key]={articul:String(row.articul||key).slice(0,100),qty:row.qty,addedPrice:Math.max(0,Number(row.addedPrice)||0),addedPriceMode:row.addedPriceMode==='KP'?'KP':'WS'};
  }return result;
 }
 if(section==='preferences'){
  const dealerOffers=value.dealerOffers??[];
  if(!Array.isArray(dealerOffers)||dealerOffers.length>10)throw Error('Թույլատրվում է մինչև 10 պահպանված առաջարկ։');
  const offers=dealerOffers.map(o=>{
   if(!object(o)||typeof o.id!=='string'||o.id.length>100||typeof o.title!=='string'||!o.title.trim()||o.title.length>80||!Array.isArray(o.items)||!o.items.length||o.items.length>20)throw Error('Առաջարկի սխալ ձևաչափ։');
   const items=o.items.map(i=>{
    if(!object(i)||typeof i.articul!=='string'||!i.articul||i.articul.length>100||!Number.isInteger(i.qty)||i.qty<1||i.qty>9999||typeof i.sale!=='number'||!Number.isFinite(i.sale)||i.sale<0||i.sale>1e9)throw Error('Առաջարկի սխալ ապրանք։');
    return {articul:i.articul,qty:i.qty,sale:i.sale};
   });
   if(new Set(items.map(i=>i.articul)).size!==items.length)throw Error('Կրկնվող ապրանք առաջարկում։');
   if(o.bundleSale!=null&&(typeof o.bundleSale!=='number'||!Number.isFinite(o.bundleSale)||o.bundleSale<=0||o.bundleSale>1e9))throw Error('Հավաքածուի սխալ վաճառքի գին։');
   return {id:o.id,title:o.title.trim(),created:String(o.created||'').slice(0,50),items,bundleSale:o.bundleSale??null};
  });
  return {theme:value.theme==='dark'?'dark':'light',filtersOpen:value.filtersOpen==='1'?'1':'0',priceMode:value.priceMode==='KP'?'KP':'WS',hiddenColumns:Array.isArray(value.hiddenColumns)?[...new Set(value.hiddenColumns.filter(k=>['brand','stockStatus','retail','marginVal','kpPrice','kpMarginVal','resaleWholesale'].includes(k)))]:[],dealerOffers:offers};
 }
 if(section==='draft'){
  const out={};for(const name of ['organizationSelect','deliveryMethodInput','deliveryDateInput','deliveryAddressInput','contactPersonInput','orderCommentInput'])if(Object.hasOwn(value,name))out[name]=String(value[name]).slice(0,3000);return out;
 }
 const list=items=>Array.isArray(items)?items.filter(v=>typeof v==='string').slice(0,2000).map(v=>v.slice(0,300)):[];
 return {brands:list(value.brands||(value.brand?[value.brand]:[])),categories:list(value.categories||(value.category?[value.category]:[])),search:String(value.search||'').slice(0,5000),sortBy:['default','priceAsc','priceDesc','marginDesc','columnAsc','columnDesc'].includes(value.sortBy)?value.sortBy:'default',sortPrice:['wholesale','retail','kpPrice','resaleWholesale'].includes(value.sortPrice)?value.sortPrice:'wholesale',sortColumn:['articul','brand','name','stockStatus','retail','wholesale','marginVal','kpPrice','kpMarginVal','resaleWholesale'].includes(value.sortColumn)?value.sortColumn:'wholesale',favOnly:value.favOnly===true,promoOnly:value.promoOnly===true,stockOnly:value.stockOnly===true,wholesaleOnly:value.wholesaleOnly===true};
}
