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
  if(!Array.isArray(value)||value.length>3)throw Error('Թույլատրվում է գործընկերոջ, հասցեի և կոնտակտի մինչև երեք տարբերակ');
  const result=[];
  for(const row of value){
    if(!object(row))throw Error('Սխալ կոնտակտային տվյալներ');
    const normalized={};
    for(const field of ['organization','address','contact']){
      const text=row[field]??'';
      if(typeof text!=='string'||text.length>300)throw Error('Գործընկերոջ, հասցեի և կոնտակտի դաշտերը կարող են պարունակել մինչև 300 նիշ');
      normalized[field]=text.trim();
    }
    if(!Object.values(normalized).some(Boolean))continue;
    normalized.organization=normalized.organization||client;result.push(normalized);
  }
  return result.length?result:[{organization:client,address:'',contact:''}];
}
export function validateAccess(value){
  if(!object(value)||!['all','selected'].includes(value.mode))throw Error('Ընտրեք կատալոգի թույլտվությունների ռեժիմը');
  const read=(rows,label)=>{
    if(!Array.isArray(rows)||rows.length>100)throw Error(label+'․ թույլատրվում է մինչև 100 կապ');
    return rows.map(r=>{
      if(!object(r)||typeof r.brand!=='string'||typeof r.category!=='string')throw Error('Բրենդի և կատեգորիայի սխալ կապ');
      const brand=r.brand.trim(),category=r.category.trim(),categoryMatch=r.categoryMatch??'exact';
      if(brand.length>200||category.length>300||(!key(brand)&&!key(category))||!['exact','contains'].includes(categoryMatch))throw Error('Յուրաքանչյուր կապում նշեք բրենդը, կատեգորիան կամ երկուսը միասին');
      return {brand,category,categoryMatch};
    });
  };
  return {mode:value.mode,include:read(value.include??[],'Թույլտվություններ'),exclude:read(value.exclude??[],'Բացառություններ')};
}
export function validatePricing(value){
  if(!object(value)||!Array.isArray(value.sources)||!value.sources.length||value.sources.length>5||new Set(value.sources).size!==value.sources.length||value.sources.some(s=>!['ws','kp','kpPromo','retail','base'].includes(s)))throw Error('Ընտրեք գնի 1-ից 5 տարբեր սյունակ');
  if(!['first','min','max'].includes(value.mode))throw Error('Գնի ընտրության սխալ եղանակ');
  const adjustmentPercent=value.adjustmentPercent??0,roundTo=value.roundTo??0;
  if(typeof adjustmentPercent!=='number'||!Number.isFinite(adjustmentPercent)||adjustmentPercent< -90||adjustmentPercent>1000)throw Error('Գնի ճշգրտում՝ −90-ից 1000%');
  if(![0,1,10,100].includes(roundTo)||typeof value.hideAboveRetail!=='boolean')throw Error('Սխալ կլորացում կամ մանրածախ գնի սահմանափակում');
  return {sources:[...value.sources],mode:value.mode,adjustmentPercent,roundTo,hideAboveRetail:value.hideAboveRetail};
}
export function validateRules(value){
  if(!object(value)||!object(value.KP)||!object(value.Dealers))throw Error('Պահանջվում են երկու խմբերի կարգավորումները՝ KP և Dealers');
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
