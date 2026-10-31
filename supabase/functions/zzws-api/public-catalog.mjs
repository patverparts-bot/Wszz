// Only canonical appliance types and already verified public knowledge are used.
// Never pass a raw/unprojected customer catalogue to this module.
const categoryNames = Object.freeze({
  washer:'Լվացքի մեքենաներ',washerDryer:'Լվացքի մեքենաներ չորանոցներով',
  dryer:'Չորանոց',dishwasher:'Սպասք լվացող մեքենաներ',fridge:'Սառնարաններ',
  tv:'Հեռուստացույց',laptop:'Նոթբուք',microwave:'Միկրոալիքային վառարան',
  kettle:'Թեյնիկ',coffee:'Սրճեփ',vacuum:'Փոշեկուլ',iron:'Արդուկ'
});
const cache=new WeakMap();
export function publicCatalogueProducts(knowledge,index){
  if(!knowledge?.products||!index?.products)return [];
  let byIndex=cache.get(knowledge);if(!byIndex){byIndex=new WeakMap();cache.set(knowledge,byIndex);}
  if(byIndex.has(index))return byIndex.get(index);
  const result=[];
  for(const [articul,kind] of Object.entries(index.products)){
    if(!Object.hasOwn(categoryNames,kind)||!articul||articul.length>100)continue;
    const row=knowledge.products[articul];if(!Array.isArray(row)||typeof row[0]!=='string'||!row[0]||row[0].length>300||!Array.isArray(row[3])||!Number.isFinite(Date.parse(row[2])))continue;
    try{const u=new URL(row[1]);if(u.protocol!=='https:'||u.hostname!=='www.zigzag.am'||u.username||u.password||u.port)continue;}catch{continue;}
    const brand=row[3].find(pair=>Array.isArray(pair)&&pair[0]==='Manufacturer')?.[1];
    result.push(Object.freeze({articul,name:row[0],brand:typeof brand==='string'?brand:'',category:categoryNames[kind],catalogScope:'public'}));
  }
  const products=Object.freeze(result);byIndex.set(index,products);return products;
}
