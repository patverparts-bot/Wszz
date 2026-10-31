export const technicalControlKeys=['type','widthMax','heightMax','depthMax','installation','capacityMin','volumeMin','placeSettingsMin','spinMin','diagonalMin','drying','inverter','noFrost','resolution','screen','energy','connection'];
export const controlKeys=['search','brand','category','favorites','promo','stock','wholesale','sorting','popular','personalPopular',...technicalControlKeys.map(k=>'tech_'+k)];
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function validateControls(value){
 if(!object(value)||Object.keys(value).some(k=>!controlKeys.includes(k))||Object.values(value).some(v=>typeof v!=='boolean'))throw new Error('Ֆիլտրերի սխալ կարգավորում');
 return Object.fromEntries(Object.entries(value));
}
export function effectiveControls(config,userId){
 return Object.fromEntries(controlKeys.map(k=>[k,config?.users?.[userId]?.[k]??config?.global?.[k]??true]));
}
export const defaultPopularityRules={days:90,orders:5,customers:3,personalOrders:3};
export const popularityRules=config=>({...defaultPopularityRules,...config?.popularityRules});
export function validatePopularityRules(value){
 if(!object(value)||Object.keys(value).length!==4||Object.keys(defaultPopularityRules).some(k=>!Number.isInteger(value[k])||value[k]<1||value[k]>(k==='days'?365:1000))||value.customers>value.orders)throw new Error('Ստուգեք հաշվարկի օրերը և նվազագույն քանակները');
 return Object.fromEntries(Object.keys(defaultPopularityRules).map(k=>[k,value[k]]));
}
export function validatePopularityEdit(target,value){
 if(value===null)return null;
 const keys=target==='global'?['orders','customers']:['personal_orders'],all=[...keys,'days','reason'];
 if(!object(value)||Object.keys(value).some(k=>!all.includes(k))||keys.some(k=>!Number.isInteger(value[k])||Math.abs(value[k])>1000000)||!Number.isInteger(value.days)||value.days<1||value.days>365||typeof value.reason!=='string'||value.reason.trim().length<3||value.reason.trim().length>300)throw new Error('Նշեք գումարվող կամ հանվող քանակը, պատճառը և գործողության օրերը');
 return {...Object.fromEntries(keys.map(k=>[k,value[k]])),days:value.days,reason:value.reason.trim()};
}
export function activePopularityEdit(value,now=Date.now()){
 return value?.mode==='adjustment'&&typeof value.reason==='string'&&Number.isFinite(Date.parse(value.expiresAt))&&Date.parse(value.expiresAt)>now?value:null;
}
export function adjustedPopularity(calculated,global,personal){
 const orders=Math.max(0,calculated.orders+(global?.orders||0)),customers=Math.min(orders,Math.max(0,calculated.customers+(global?.customers||0)));
 return {orders,customers,personal_orders:Math.max(0,calculated.personal_orders+(personal?.personal_orders||0))};
}
export function popularityValues(rows,articul,config,userId,now=Date.now()){
 const row=rows.find(r=>r.articul===articul),calculated={orders:Number(row?.orders||0),customers:Number(row?.customers||0),personal_orders:Number(row?.personal_orders||0)};
 const global=activePopularityEdit(config?.popularityEdits?.global?.[articul],now),personal=activePopularityEdit(config?.popularityEdits?.users?.[userId]?.[articul],now);
 return {calculated,effective:adjustedPopularity(calculated,global,personal),global,personal};
}
export function visiblePopularity(rows,products,controls,config={},userId='',now=Date.now()){
 const rules=popularityRules(config),bySku=new Map(rows.map(r=>[r.articul,r])),result={};
 for(const p of products){
  const row=bySku.get(p.articul),global=activePopularityEdit(config?.popularityEdits?.global?.[p.articul],now),personal=activePopularityEdit(config?.popularityEdits?.users?.[userId]?.[p.articul],now);
  const counts=adjustedPopularity({orders:Number(row?.orders||0),customers:Number(row?.customers||0),personal_orders:Number(row?.personal_orders||0)},global,personal);
  const flags={popular:controls.popular&&counts.orders>=rules.orders&&counts.customers>=rules.customers,personalPopular:controls.personalPopular&&counts.personal_orders>=rules.personalOrders};
  if(flags.popular||flags.personalPopular)result[p.articul]={...flags,...(global&&flags.popular?{popularSource:'manual'}:{}),...(personal&&flags.personalPopular?{personalPopularSource:'manual'}:{})};
 }
 return result;
}
export async function catalogControlRoutes(c){
 const {path,req,user,table,query,body,json,fail,audit,service,current}=c;
 if(path!=='admin/catalog-controls')return null;
 if(user.role!=='admin'||user.adminScope!=='owner')fail(403,'Հասանելիությունն արգելված է');
 const state=await query(table('state').select('catalog_controls,catalog_controls_revision').eq('id',true).single());
 const targetExists=async(target)=>{
  if(target==='global')return;
  if(typeof target!=='string'||!/^[a-f0-9-]{36}$/i.test(target))fail(400,'Ընտրեք օգտատիրոջը');
  const found=await query(table('users').select('id').eq('id',target).maybeSingle());if(!found)fail(404,'Օգտատերը չի գտնվել');
 };
 const modelExists=async(articul)=>{
  if(typeof articul!=='string'||!articul.trim()||articul.length>100||['__proto__','constructor','prototype'].includes(articul))fail(400,'Նշեք ապրանքի արտիկուլը');
  const v=await current();if(!v.products.some(p=>p.articul===articul))fail(404,'Ապրանքը չի գտնվել');
 };
 if(req.method==='GET'){
  const params=new URL(req.url||'https://local/').searchParams,articul=params.get('articul');
  if(articul){
   const target=params.get('target')||'global';await targetExists(target);await modelExists(articul);
   const rows=await query(service.rpc('zzws_catalog_popularity',{p_user:target==='global'?user.id:target,p_days:popularityRules(state.catalog_controls).days,p_articul:articul}));
   return json({revision:state.catalog_controls_revision,articul,target,...popularityValues(rows,articul,state.catalog_controls,target==='global'?user.id:target)});
  }
  return json({config:state.catalog_controls,revision:state.catalog_controls_revision});
 }
 if(req.method!=='POST')fail(405,'Չթույլատրված գործողություն');
 const p=await body(req);let controls;
 if(p.revision!==state.catalog_controls_revision)fail(409,'Կարգավորումները փոխվել են։ Թարմացրեք և կրկնեք');
 const config=structuredClone(state.catalog_controls||{});
 if(p.kind==='popularityRules'){
  try{config.popularityRules=validatePopularityRules(p.rules);}catch(e){fail(400,e.message);}
 }else if(p.kind==='popularityEdit'){
  await targetExists(p.target);await modelExists(p.articul);
  let value;try{value=validatePopularityEdit(p.target,p.value);}catch(e){fail(400,e.message);}
  if(value){const {days,...delta}=value;value={...delta,mode:'adjustment',expiresAt:new Date(Date.now()+days*86400000).toISOString(),actor:user.id,createdAt:new Date().toISOString()};}
  const edits=config.popularityEdits||{};
  if(p.target==='global'){
   edits.global={...edits.global};if(value)edits.global[p.articul]=value;else delete edits.global[p.articul];
  }else{
   edits.users={...edits.users};const own={...edits.users[p.target]};if(value)own[p.articul]=value;else delete own[p.articul];
   if(Object.keys(own).length)edits.users[p.target]=own;else delete edits.users[p.target];
  }
  config.popularityEdits=edits;
 }else{
  if(p.kind!==undefined&&p.kind!=='controls')fail(400,'Անհայտ գործողություն');
  try{controls=validateControls(p.controls);}catch(e){fail(400,e.message);}
  if(p.target==='global')config.global=controls;
  else{
   await targetExists(p.target);
   config.users={...config.users};if(Object.keys(controls).length)config.users[p.target]=controls;else delete config.users[p.target];
  }
 }
 const revision=crypto.randomUUID();
 const saved=await query(table('state').update({catalog_controls:config,catalog_controls_revision:revision}).eq('id',true).eq('catalog_controls_revision',p.revision).select('id').maybeSingle());
 if(!saved)fail(409,'Կարգավորումները փոխվել են։ Թարմացրեք և կրկնեք');
 await audit(user.id,'catalog_controls',JSON.stringify({target:p.target||'global',kind:p.kind||'controls',controls,...(p.kind==='popularityRules'?{rules:config.popularityRules}:{}),...(p.kind==='popularityEdit'?{articul:p.articul,value:p.value}:{})}));
 return json({config,revision});
}
