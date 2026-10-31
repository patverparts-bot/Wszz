// Internal calculation evidence. Never spread this object into a public order DTO.
import {effectiveRules,selectPrice} from './rules.mjs';
import {project} from './catalog.mjs';
import {totalOf} from './orders.mjs';
const clone=value=>structuredClone(value);
export function buildOrderContext({catalog,user,lines,priceMode='WS',previousOrder=null,previousContext=null,source='submit'}){
 const rules=effectiveRules(catalog.rules),group=user?.sheet||'Dealers';
 const available=new Map((user?project(catalog.products,user,rules,{forOrder:true}):[]).map(p=>[p.articul,p]));
 const raw=new Map(catalog.products.map(p=>[p.articul,p])),before=new Map((previousOrder?.lines||[]).map(p=>[p.articul,p]));
 const prior=new Map((previousContext?.lines||[]).map(p=>[p.articul,p])),original=new Map((previousOrder?.original_lines||[]).map(p=>[p.articul,p]));
 return {
  schemaVersion:1,orderTotal:totalOf(lines),catalogVersion:catalog.id,rulesRevision:catalog.rulesRevision,profileRevision:user?.profileRevision??null,
  clientCategory:user?group:null,actorRole:user?.role??null,priceMode:user?.role==='admin'?priceMode:'client',operation:source,
  rulesSnapshot:clone(rules),rulesStorageSnapshot:clone(catalog.storedRules??catalog.rules),accessSnapshot:user?clone({role:user.role,sheet:user.sheet,brands:user.brands||[],allBrands:!!user.allBrands,catalogAccess:user.catalogAccess??null}):null,
  checkedProducts:lines.map(line=>({articul:line.articul,product:clone(raw.get(line.articul)||null)})),
  lines:lines.map(line=>{
   const prev=before.get(line.articul),evidence=prior.get(line.articul),product=raw.get(line.articul),permitted=available.has(line.articul);
   const quantity={articul:line.articul,requestedQty:previousOrder?(original.get(line.articul)?.qty??null):line.qty,qty:line.qty,chargedUnitPrice:line.unitPrice};
   if(prev&&prev.unitPrice===line.unitPrice){
    if(evidence)return {...clone(evidence),...quantity,basisRevision:evidence.basisRevision??previousContext.orderRevision};
    // Observed legacy prices are not evidence of a historical catalogue calculation.
    return {...quantity,priceOrigin:'legacy_unknown',catalogUnitPrice:null,priceSource:null,calculation:null,basisRevision:null};
   }
   let selected={price:0,source:null};
   if(product&&permitted){
    selected=user.role==='admin'?(priceMode==='KP'?{price:product.kpPromo||product.kp,source:product.kpPromo?'kpPromo':product.kp?'kp':null}:{price:product.ws,source:product.ws?'ws':null}):selectPrice(product,rules[group].pricing);
   }
   const catalogUnitPrice=selected.price>0?selected.price:null;
   if(source==='submit'&&catalogUnitPrice!==line.unitPrice)throw Error('Հաշվարկված գինը չի համընկնում պատվերի գնին');
   const changed=prev?prev.unitPrice!==line.unitPrice:catalogUnitPrice!==line.unitPrice;
   return {...quantity,catalogUnitPrice,priceSource:selected.source,priceOrigin:source==='submit'||!changed?'catalogue':source==='confirmation'?'confirmation_file':'manager_manual',basisRevision:null,
    calculation:{catalogVersion:catalog.id,rulesRevision:catalog.rulesRevision,clientCategory:user?group:null,sourceValue:selected.source?product[selected.source]:null,policy:user?.role==='admin'?{mode:priceMode}:clone(rules[group].pricing)}};
  })
 };
}
export const calculationRetry=error=>['PT412','40001','40P01'].includes(error?.code);

