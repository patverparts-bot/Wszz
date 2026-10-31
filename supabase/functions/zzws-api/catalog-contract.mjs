// Canonical internal product format. No client category, price selection or stock allocation here.
export const CATALOG_CONTRACT_VERSION=1;
export const catalogNumber=value=>{const n=Number(value||0);if(!Number.isFinite(n)||n<0)throw Error('Սխալ գին կամ մնացորդ');return n;};
export function validateCatalogProducts(products){
 if(!Array.isArray(products)||!products.length)throw Error('Գնացուցակում ապրանքներ չկան');
 const seen=new Set();
 for(const p of products){
  if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.articul!=='string'||!p.articul||p.articul.length>30||seen.has(p.articul))throw Error('Կրկնվող կամ սխալ արտիկուլ՝ '+String(p?.articul??''));
  seen.add(p.articul);
  for(const field of ['brand','category','name'])if(typeof p[field]!=='string'||p[field].length>1000)throw Error('Անվանումը չափազանց երկար է');
  for(const field of ['retail','base','ws','kp','kpPromo'])if(typeof p[field]!=='number'||!Number.isFinite(p[field])||p[field]<0)throw Error('Սխալ գին կամ մնացորդ');
  if(!p.stocks||typeof p.stocks!=='object'||Array.isArray(p.stocks)||!Object.keys(p.stocks).length||Object.entries(p.stocks).some(([key,value])=>!/^\d{3}$/.test(key)||typeof value!=='number'||!Number.isFinite(value)||value<0))throw Error('Սխալ գին կամ մնացորդ');
 }
 return products;
}

