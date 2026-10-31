import {knowledgeProduct} from './assistant.mjs';
import {dimensions} from './advisor.mjs';

// All technical facts come from the existing exact-model verified snapshot.
const types=[
 ['dishwasher',/dishwash|посудомо|սպասք.*լվա/i],['dryer',/tumble dryer|drying machine|сушильн|չորանոց/i],
 ['washer',/washing machine|\bwasher\b|стиральн|լվացք/i],['fridge',/fridge|refrigerator|холодильн|սառնարան/i],
 ['hood',/cooker hood|kitchen hood|вытяж|օդաքաշ|քարշիչ/i],['hob',/\bhobs?\b|варочн|եփման վահանակ|եփող մակերես|եփման մակերես/i],
 ['microwave',/microwave|микроволн|միկրոալիք/i],['oven',/\bovens?\b|духов|ջեռոց|վառարան/i],['tv',/television|\btv\b|телевиз|հեռուստացույց/i],
 ['soundbar',/soundbar|саундбар|սաունդբար/i],['vacuum',/vacuum|пылесос|փոշեկուլ/i],
 ['coffee',/coffee|кофем|սրճեփ/i],['kettle',/kettle|чайник|թեյնիկ/i],['iron',/\biron\b|утюг|արդուկ/i]
];
export const recipes={kitchen:['oven','hob','hood'],laundry:['washer','dryer'],entertainment:['tv','soundbar']};
export function applianceType(p){
 const text=String(p.category||'');
 if(/accessor|параг|պարագա|аксессуар|cleaning product|մաքրող նյութ/i.test(text))return 'other';
 return types.find(([,pattern])=>pattern.test(text))?.[0]||'other';
}
const value=(specs,pattern)=>specs.find(s=>pattern.test(s.name))?.value??null;
function scalar(raw){
 if(raw==null)return null;
 const match=String(raw).trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:kg|кг|կգ|l|լ|л|rpm|պտ\/րոպե|inch|inches|["″])?$/i);
 return match?Number(match[1].replace(',','.')):null;
}
const bool=raw=>raw==null?null:/^(yes|այո|да|true|1)$/i.test(String(raw).trim())?true:/^(no|ոչ|нет|false|0)$/i.test(String(raw).trim())?false:null;
export function technicalFacts(p,knowledge){
 const details=knowledgeProduct(p,knowledge),specs=details.specifications;
 // Packaging and installation openings must never become appliance dimensions.
 const physical=specs.filter(s=>!/(pack|shipping|carton|box|niche|cut.?out|opening|installation|монтаж|упаков|ниш|խորշ)/i.test(s.name)&&(/^(?:width|height|depth|ширина|высота|глубина|լայնություն|բարձրություն|խորություն)(?:\s*\([^)]*\))?$/i.test(s.name)||/^dimensions\s*\(/i.test(s.name)));
 const niche=specs.filter(s=>/(niche|embedding dimensions|cut.?out|opening|монтаж|ниш|խորշ|installation dimensions)/i.test(s.name));
 const type=applianceType(p),motor=value(specs,/^[mм]otor type$|^compressor type$/i);
 const dryingLoad=scalar(value(specs,/maximum loading for drying|drying capacity/i));
 const drying=bool(value(specs,/^drying$|^dryer$|^drying function$/i));
 const defrost=value(specs,/^defrosting system$|^cooling system$|^no frost$/i);
 const compartments=specs.filter(s=>/^(refrigerator|freezer)$/i.test(s.name));
 const zoneNoFrost=compartments.length===2&&compartments.every(s=>/no\s*frost/i.test(s.value))?true:null;
 const installation=value(specs,/^installation type$/i)||specs.find(s=>/^type$/i.test(s.name)&&/^(built[ -]?in|free[ -]?standing|ներկառուցվող|առանձին կանգնած|встраиваемый|отдельностоящий)$/i.test(s.value))?.value||null;
 const diagonalRaw=value(specs,/^diagonal$|^screen size(?: \(inch\))?$/i);
 const diagonal=scalar(diagonalRaw)??(String(diagonalRaw||'').match(/^(\d+(?:[.,]\d+)?)\s*["″]/)?.[1]?Number(String(diagonalRaw).match(/^[\d.,]+/)[0].replace(',','.')):null);
 return {type,verified:details.status==='verified',dimensions:dimensions(physical),niche:dimensions(niche),
  capacity:scalar(value(specs,/^load capacity \(kg\)$|^capacity \(kg\)$/i)),
  volume:scalar(value(specs,/^total (?:volume|capacity)\s*\(l\)$|^volume\s*\(l\)$|^oven capacity\s*\(l\)$|^capacity\s*\(l\)$/i)),
  placeSettings:scalar(value(specs,/^maximum capacity \(set\)$|^place settings$/i)),
  spin:scalar(value(specs,/^spin speed \(rpm\)$/i)),diagonal,
  drying:dryingLoad>0?true:drying,inverter:bool(value(specs,/^motor type inverter$/i))??(motor?/\binverter\b|ինվերտոր|инвертор/i.test(motor)?true:null:null),
  noFrost:defrost?/no\s*frost/i.test(defrost)?true:bool(defrost):zoneNoFrost,
  resolution:value(specs,/^resolution(?: \(px\))?$/i),screen:value(specs,/^screen type$|^panel type$/i),
  energy:value(specs,/^energy rating$/i),installation,
  connection:value(specs,/^hob type$|^oven type$|^type of connection$/i),
  warranty:value(specs,/^warranty$/i),sourceUrl:details.sourceUrl||null,checkedAt:details.checkedAt||null};
}
export function productDetails(p,knowledge){
 const details=knowledgeProduct(p,knowledge),facts=technicalFacts(p,knowledge);
 const wanted=[/^load capacity/i,/^total (volume|capacity)/i,/^maximum capacity \(set\)/i,/^spin speed/i,/^diagonal$|^screen size/i,/^resolution/i,/^defrosting system/i,/^[mм]otor type$|^compressor type$/i,/^hob type$|^oven type$/i,/^energy rating/i];
 const highlights=wanted.map(pattern=>details.specifications.find(s=>pattern.test(s.name))).filter(Boolean).slice(0,5);
 return {...details,facts,highlights};
}

// Candidate sets are supported by actual co-purchases, never fabricated from popularity.
export function suggestBundles(products,history,{recipe='kitchen',seed=null,priceMode='WS'}={}){
 const slots=Object.hasOwn(recipes,recipe)?recipes[recipe]:null;if(!slots)throw Object.assign(Error('Անհայտ հավաքածու։'),{code:400});
 const price=p=>Number(p[priceMode==='KP'?'kpPrice':'wholesale'])||0;
 const permitted=products.filter(p=>price(p)>0),bySku=new Map(permitted.map(p=>[p.articul,p]));
 if(seed&&(!bySku.has(seed)||!slots.includes(applianceType(bySku.get(seed)))))throw Object.assign(Error('Ապրանքը հասանելի չէ այս հավաքածուի համար։'),{code:404});
 const index=new Map(),buyers=new Map();
 for(const o of history){
  if(!['completed','received'].includes(o.status)||o.role!=='client')continue;
  const codes=new Set((o.lines||[]).filter(l=>Number(l.qty)>0&&bySku.has(String(l.articul))).map(l=>String(l.articul)));
  if(!codes.size)continue;buyers.set(String(o.id),o.user_id);
  for(const code of codes){if(!index.has(code))index.set(code,new Set());index.get(code).add(String(o.id));}
 }
 const choices=slots.map(type=>{
  if(seed&&applianceType(bySku.get(seed))===type)return [bySku.get(seed)];
  return permitted.filter(p=>applianceType(p)===type&&index.has(p.articul)).sort((a,b)=>index.get(b.articul).size-index.get(a.articul).size||a.articul.localeCompare(b.articul)).slice(0,8);
 });
 let tuples=[[]];for(const group of choices)tuples=tuples.flatMap(tuple=>group.map(p=>[...tuple,p]));
 return tuples.map(items=>{
  const sets=items.map(p=>index.get(p.articul)||new Set()).sort((a,b)=>a.size-b.size);
  const common=[...sets[0]].filter(id=>sets.every(s=>s.has(id))),customers=new Set(common.map(id=>buyers.get(id)));
  return {items:items.map(p=>({articul:p.articul,name:p.name,price:price(p),type:applianceType(p)})),total:items.reduce((sum,p)=>sum+price(p),0),_orders:common.length,_buyers:customers.size};
 }).filter(b=>b._orders>=3&&b._buyers>=3).sort((a,b)=>b._orders-a._orders||b._buyers-a._buyers||a.total-b.total)
  .slice(0,4).map(({_orders,_buyers,...b})=>({...b,basis:'anonymous_completed_purchases',compatibility:'unconfirmed'}));
}

let historyCache=null,historyPromise=null;
export function resetDealerHistoryCache(){historyCache=null;historyPromise=null;}
export async function loadPurchaseHistory(table,query,now=Date.now()){
 if(historyCache&&now-historyCache.at<300000)return historyCache.rows;
 if(historyPromise)return historyPromise;
 historyPromise=(async()=>{
  const rows=[];let cursor=null;
  for(;;){
   let q=table('orders').select('id,user_id,lines,status,zzws_users!inner(profile)').in('status',['completed','received']).eq('zzws_users.profile->>role','client').order('id',{ascending:true}).limit(500);
   if(cursor!==null)q=q.gt('id',cursor);
   const batch=await query(q);
   for(const o of batch)rows.push({id:o.id,user_id:o.user_id,status:o.status,role:'client',lines:(o.lines||[]).filter(l=>Number(l.qty)>0).map(l=>({articul:String(l.articul),qty:1}))});
   if(batch.length<500)break;
   const next=batch.at(-1).id;if(next===cursor)throw Error('history_pagination');cursor=next;
  }
  historyCache={at:Date.now(),rows};return rows;
 })();
 try{return await historyPromise;}finally{historyPromise=null;}
}
export async function dealerRoutes(c){
 const {path,req,user,body,current,project,json,fail,knowledge,table,query}=c;
 if(!['dealer/facts','dealer/details','dealer/bundles'].includes(path)||req.method!=='POST')return null;
 const input=await body(req);if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Հարցման սխալ ձևաչափ։');
 const version=await current(),products=project(version.products,user,version.rules);
 if(path==='dealer/facts')return json({version:version.id||null,items:Object.fromEntries(products.map(p=>[p.articul,technicalFacts(p,knowledge)]))});
 if(path==='dealer/details'){
  if(!Array.isArray(input.articuls)||!input.articuls.length||input.articuls.length>4||input.articuls.some(a=>typeof a!=='string'||a.length>100))fail(400,'Ընտրեք մեկից չորս ապրանք։');
  const selected=[...new Set(input.articuls)].map(a=>products.find(p=>p.articul===a));
  if(selected.some(p=>!p))fail(404,'Ապրանքը հասանելի չէ։');
  return json({items:selected.map(p=>productDetails(p,knowledge))});
 }
 if(!Object.hasOwn(recipes,input.recipe)||input.seed!=null&&(typeof input.seed!=='string'||input.seed.length>100))fail(400,'Ստուգեք հավաքածուի պայմանները։');
 const mode=user.role==='admin'&&input.priceMode==='KP'?'KP':'WS';
 if(input.seed&&!products.some(p=>p.articul===input.seed))fail(404,'Ապրանքը հասանելի չէ։');
 const history=await (c.loadHistory?c.loadHistory():loadPurchaseHistory(table,query));
 return json({bundles:suggestBundles(products,history,{recipe:input.recipe,seed:input.seed,priceMode:mode}),history:'all_completed_client_orders',minimumCustomers:3});
}
