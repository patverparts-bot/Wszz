import {catalogNumber as number,validateCatalogProducts} from '../catalog-contract.mjs';
// Header mapping is an Excel concern; canonical products remain source-independent.
// XLSX archive/formula checks stay in the existing upload reader.
export function parseExcelCatalog(rows){
 const hi=rows.slice(0,25).findIndex(r=>r.some(c=>/artikul|артикул|արտիկուլ/i.test(String(c??''))));
 if(hi<0)throw Error('Վերնագրերի տողը չի գտնվել');
 const headers=rows[hi].map(c=>String(c??'').trim());
 const find=(...words)=>headers.findIndex(h=>words.some(w=>h.toLowerCase().includes(w.toLowerCase())));
 const c={art:find('art','артикул','արտիկուլ'),brand:find('brand','бренд','բրենդ'),category:find('group','группа','категория','խումբ','կատեգորիա'),
  name:find('name','наименование','номенклатура','անվանում'),retail:find('Զեղչված','discount'),base:find('roznich','розница','մանրածախ'),
  ws:find('wholesale','опт','մեծածախ'),kp:find("Key Partner's AMD"),kpPromo:find("Key Partner's promo AMD")};
 if(c.retail<0)c.retail=c.base;
 for(const key of ['art','brand','category','name','retail','ws'])if(c[key]<0)throw Error('Բացակայում է պարտադիր սյունակը՝ '+({art:'Արտիկուլ',brand:'Բրենդ',category:'Կատեգորիա',name:'Անվանում',retail:'Մանրածախ գին',ws:'Մեծածախ գին'}[key]));
 const stocks=headers.map((h,i)=>({h,i})).filter(v=>/^\d{3}$/.test(v.h));
 if(!stocks.length)throw Error('Պահեստների սյունակները չեն գտնվել');
 const result=[],seen=new Set();
 for(const row of rows.slice(hi+1)){
  const get=k=>row[c[k]],articul=String(get('art')??'').trim();if(!articul)continue;
  if(articul.length>30||seen.has(articul))throw Error('Կրկնվող կամ սխալ արտիկուլ՝ '+articul);seen.add(articul);
  const p={articul,stocks:{}};
  for(const k of ['brand','category','name']){p[k]=String(get(k)??'').trim();if(p[k].length>1000)throw Error('Անվանումը չափազանց երկար է');}
  for(const k of ['retail','base','ws','kp','kpPromo'])p[k]=number(get(k));
  for(const {h,i}of stocks)p.stocks[h]=number(row[i]);result.push(p);
 }
 return validateCatalogProducts(result);
}

