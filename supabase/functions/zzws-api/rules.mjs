// Persisted policy is evaluated only by the server. Empty selected permissions deny access.
const key=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function defaultRules(){
  return {
    KP:{pricing:{sources:['kpPromo','kp','ws'],mode:'first',adjustmentPercent:0,roundTo:0,hideAboveRetail:true},
      access:{mode:'all',include:[],exclude:[{brand:'Miele',category:'',categoryMatch:'exact'},{brand:'Sony',category:'Հեռուստացույց',categoryMatch:'contains'}]}},
    Dealers:{pricing:{sources:['ws'],mode:'first',adjustmentPercent:0,roundTo:0,hideAboveRetail:true},access:{mode:'all',include:[],exclude:[]}}
  };
}
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const validPassword=value=>typeof value==='string'&&/^[0-9]{6,256}$/.test(value);
export function validateContacts(value,client){
  if(!Array.isArray(value)||value.length>3)throw Error('Допустимо до трёх вариантов контрагента, адреса и контакта');
  const result=[];
  for(const row of value){
    if(!object(row))throw Error('Неверные контактные данные');
    const normalized={};
    for(const field of ['organization','address','contact']){
      const text=row[field]??'';
      if(typeof text!=='string'||text.length>300)throw Error('Контрагент, адрес и контакт должны содержать до 300 символов');
      normalized[field]=text.trim();
    }
    if(!Object.values(normalized).some(Boolean))continue;
    normalized.organization=normalized.organization||client;result.push(normalized);
  }
  return result.length?result:[{organization:client,address:'',contact:''}];
}
export function validateAccess(value){
  if(!object(value)||!['all','selected'].includes(value.mode))throw Error('Выберите режим разрешений каталога');
  const read=(rows,label)=>{
    if(!Array.isArray(rows)||rows.length>100)throw Error(label+': допустимо до 100 связок');
    return rows.map(r=>{
      if(!object(r)||typeof r.brand!=='string'||typeof r.category!=='string')throw Error('Неверная связка бренда и категории');
      const brand=r.brand.trim(),category=r.category.trim(),categoryMatch=r.categoryMatch??'exact';
      if(brand.length>200||category.length>300||(!key(brand)&&!key(category))||!['exact','contains'].includes(categoryMatch))throw Error('Укажите бренд, категорию или оба значения в каждой связке');
      return {brand,category,categoryMatch};
    });
  };
  return {mode:value.mode,include:read(value.include??[],'Разрешения'),exclude:read(value.exclude??[],'Исключения')};
}
export function validatePricing(value){
  if(!object(value)||!Array.isArray(value.sources)||!value.sources.length||value.sources.length>5||new Set(value.sources).size!==value.sources.length||value.sources.some(s=>!['ws','kp','kpPromo','retail','base'].includes(s)))throw Error('Выберите от 1 до 5 разных колонок цены');
  if(!['first','min','max'].includes(value.mode))throw Error('Неверный способ выбора цены');
  const adjustmentPercent=value.adjustmentPercent??0,roundTo=value.roundTo??0;
  if(typeof adjustmentPercent!=='number'||!Number.isFinite(adjustmentPercent)||adjustmentPercent< -90||adjustmentPercent>1000)throw Error('Корректировка цены: от −90 до 1000%');
  if(![0,1,10,100].includes(roundTo)||typeof value.hideAboveRetail!=='boolean')throw Error('Неверное округление или ограничение по розничной цене');
  return {sources:[...value.sources],mode:value.mode,adjustmentPercent,roundTo,hideAboveRetail:value.hideAboveRetail};
}
export function validateRules(value){
  if(!object(value)||!object(value.KP)||!object(value.Dealers))throw Error('Нужны настройки обеих групп: KP и Dealers');
  return Object.fromEntries(['KP','Dealers'].map(g=>[g,{pricing:validatePricing(value[g].pricing),access:validateAccess(value[g].access)}]));
}
export function effectiveRules(value){
  const defaults=defaultRules();
  return validateRules({...defaults,...(value||{})});
}
export function matchesPair(product,rule){
  const brand=!rule.brand||key(product.brand)===key(rule.brand);
  const category=!rule.category||(rule.categoryMatch==='contains'?key(product.category).includes(key(rule.category)):key(product.category)===key(rule.category));
  return brand&&category;
}
export function permits(product,access){
  return (access.mode==='all'||access.include.some(r=>matchesPair(product,r)))&&!access.exclude.some(r=>matchesPair(product,r));
}
export function selectPrice(product,pricing){
  const choices=pricing.sources.map(source=>({source,value:Number(product[source])})).filter(p=>Number.isFinite(p.value)&&p.value>0);
  if(!choices.length)return {price:0,source:null};
  const selected=choices.reduce((a,b)=>pricing.mode==='min'&&b.value<a.value||pricing.mode==='max'&&b.value>a.value?b:a);
  if(!pricing.adjustmentPercent&&!pricing.roundTo)return {price:selected.value,source:selected.source};
  let price=selected.value*(1+pricing.adjustmentPercent/100);
  if(pricing.roundTo)price=Math.round(price/pricing.roundTo)*pricing.roundTo;
  // Currency precision, without changing legacy defaults' integer values.
  price=Math.round((price+Number.EPSILON)*100)/100;
  return {price,source:selected.source};
}
