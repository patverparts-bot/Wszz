import {knowledgeProduct} from './assistant.mjs';
import {technicalFacts} from './dealer.mjs';
import {canAccess} from './operations.mjs';
const normalized=v=>String(v||'').normalize('NFKC').toLowerCase().trim();
const critical={washer:['capacity','drying','installation'],dryer:['capacity','installation'],fridge:['volume','noFrost','installation'],dishwasher:['placeSettings','installation'],tv:['diagonal','resolution','screen'],oven:['volume','connection','installation'],hob:['connection','installation']};
export function replacementGroup(source,target){
 if(!source.type||source.type==='other'||source.type!==target.type)return {matchGroup:'insufficient',missingFacts:['type']};
 const required=critical[source.type]||[];
 const missing=required.filter(key=>source[key]==null||target[key]==null);
 const axes=['width','height','depth'],known=axes.filter(key=>Number.isFinite(source.dimensions?.[key]));
 if(!source.verified||!target.verified||!known.length||known.some(key=>!Number.isFinite(target.dimensions?.[key]))||missing.length)return {matchGroup:'insufficient',missingFacts:missing};
 const changed=known.some(key=>Math.abs(source.dimensions[key]-target.dimensions[key])>.01)||required.some(key=>normalized(source[key])!==normalized(target[key]));
 return {matchGroup:changed?'differences':'verified',missingFacts:[]};
}
export function suggestReplacements(source,products,knowledge,{priceMode='WS',inCart=[],history=[]}={}){
 const price=p=>Number(p[priceMode==='KP'?'kpPrice':'wholesale'])||0;
 const sourceFacts=technicalFacts(source,knowledge),sourceDimensions=sourceFacts.dimensions,previous=new Set(history.flatMap(o=>(o.lines||[]).map(l=>l.articul))),quantities=new Map(inCart.map(r=>[r.articul,r.qty]));
 return products.filter(p=>p.articul!==source.articul&&normalized(p.category)===normalized(source.category)&&price(p)>0).map(p=>{
  const details=knowledgeProduct(p,knowledge),facts=technicalFacts(p,knowledge),sizes=facts.dimensions,differences=[];
  for(const axis of ['width','height','depth'])if(sourceDimensions[axis]&&sizes[axis])differences.push({axis,before:sourceDimensions[axis],after:sizes[axis],difference:Math.round((sizes[axis]-sourceDimensions[axis])*100)/100});
  const knownAxes=Object.keys(sourceDimensions).filter(k=>['width','height','depth'].includes(k)),sizeConfirmed=knownAxes.length>0&&knownAxes.every(k=>Number.isFinite(sizes[k]));
  const distance=sizeConfirmed?differences.reduce((n,d)=>n+Math.abs(d.difference)/Math.max(d.before,1),0):100;
  const featureDifferences=['capacity','volume','placeSettings','spin','diagonal','drying','inverter','noFrost','resolution','screen','energy','connection','installation'].filter(key=>sourceFacts[key]!=null&&facts[key]!=null&&sourceFacts[key]!==facts[key]).map(key=>({key,before:sourceFacts[key],after:facts[key]}));
  const sameDimensions=sizeConfirmed&&differences.every(d=>Math.abs(d.difference)<=.01);
  return {articul:p.articul,name:p.name,price:price(p),priceDifference:price(source)>0?price(p)-price(source):null,brand:p.brand,dimensions:sizes,differences,sizeConfirmed,sameDimensions,featureDifferences,...replacementGroup(sourceFacts,facts),comparisonComplete:sourceFacts.verified&&facts.verified,previouslyOrdered:previous.has(p.articul),inCartQty:quantities.get(p.articul)||0,sourceUrl:details.sourceUrl||null,checkedAt:details.checkedAt||null,_distance:distance};
 }).sort((a,b)=>({verified:0,differences:1,insufficient:2}[a.matchGroup]-{verified:0,differences:1,insufficient:2}[b.matchGroup])||a._distance-b._distance||Math.abs(a.priceDifference??a.price)-Math.abs(b.priceDifference??b.price)||Number(b.previouslyOrdered)-Number(a.previouslyOrdered)||a.articul.localeCompare(b.articul)).slice(0,6).map(({_distance,...p})=>p);
}
export async function replacementRoutes(c){
 const {path,req,user,body,current,project,table,query,json,fail,knowledge}=c;
 if(path==='admin/orders/replacements'&&req.method==='POST'){
  if(user.role!=='admin'||!canAccess(user.adminScope,path,'POST'))fail(403,'Այս գործողության իրավունքը չունեք');
  const p=await body(req);
  if(typeof p.orderId!=='string'||!Number.isInteger(p.revision)||typeof p.articul!=='string'||!p.articul||p.articul.length>100||!Array.isArray(p.inCart)||p.inCart.length>500||p.inCart.some(r=>!r||typeof r.articul!=='string'||!r.articul||r.articul.length>100||!Number.isInteger(r.qty)||r.qty<1||r.qty>9999)||new Set(p.inCart.map(r=>r.articul)).size!==p.inCart.length||!p.inCart.some(r=>r.articul===p.articul))fail(400,'Ստուգեք պատվերն ու քանակները');
  const order=await query(table('orders').select('*').eq('id',p.orderId).maybeSingle());
  if(!order)fail(404,'Պատվերը չի գտնվել');
  if(order.revision!==p.revision||order.received_at||['received','completed','rejected'].includes(order.status))fail(409,'Պատվերն արդեն փոխվել է կամ ստացված է։ Վերաբացեք այն');
  const account=await query(table('users').select('id,profile,active,login').eq('id',order.user_id).maybeSingle());
  if(!account?.active||account.profile.role!=='client')fail(409,'Հաճախորդի հաշիվը հասանելի չէ');
  const v=await current(),products=project(v.products,{...account.profile,id:account.id},v.rules);
  const previous=order.lines.find(r=>r.articul===p.articul);
  let source=products.find(r=>r.articul===p.articul);
  if(!source&&previous)source={...previous,wholesale:0};
  if(!source)fail(404,'Ապրանքը հասանելի չէ այս հաճախորդին');
  const history=await query(table('orders').select('lines').eq('user_id',account.id).neq('status','rejected').order('created',{ascending:false}).limit(200));
  return json({orderId:order.id,revision:order.revision,customer:{id:account.id,client:account.profile.client,login:account.login},catalogueVersion:v.id,source:{articul:source.articul,name:source.name},candidates:suggestReplacements(source,products,knowledge,{inCart:p.inCart,history}),historyScope:200});
 }
 if(path!=='orders/replacements'||req.method!=='POST')return null;
 const p=await body(req);if(typeof p.articul!=='string'||p.articul.length>100||!Array.isArray(p.inCart)||p.inCart.length>5000||p.inCart.some(r=>!r||typeof r.articul!=='string'||r.articul.length>100||!Number.isInteger(r.qty)||r.qty<1||r.qty>9999))fail(400,'Ստուգեք ապրանքն ու քանակները');
 const v=await current(),products=project(v.products,user,v.rules),mode=user.role==='admin'&&p.priceMode==='KP'?'KP':'WS';let source=products.find(r=>r.articul===p.articul),order;
 if(p.orderId){order=await query(table('orders').select('id,lines').eq('id',p.orderId).eq('user_id',user.id).maybeSingle());if(!order?.lines.some(l=>l.articul===p.articul))fail(404,'Պատվերի ապրանքը չի գտնվել');}
 if(!source&&order){const line=order.lines.find(l=>l.articul===p.articul),raw=v.products.find(r=>r.articul===p.articul);if(raw)source={articul:line.articul,name:line.name,category:raw.category,wholesale:0};}
 if(!source)fail(404,'Ապրանքը հասանելի չէ։ Փորձեք փոխարինում փնտրել ձեր պատվերի պատմությունից։');
 const history=await query(table('orders').select('lines').eq('user_id',user.id).neq('status','rejected').order('created',{ascending:false}).limit(200));
 return json({source:{articul:source.articul,name:source.name},candidates:suggestReplacements(source,products,knowledge,{priceMode:mode,inCart:p.inCart,history}),historyScope:200});
}
