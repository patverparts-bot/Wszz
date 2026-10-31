export const deliveryId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const conflict=()=>{throw Object.assign(Error('Առաքման տարբերակները միանշանակ չեն համընկնում։ Ստուգեք հաճախորդի քարտը և կրկին բեռնեք տվյալները'),{code:409});};
const key=row=>JSON.stringify(['organization','address','contact'].map(k=>String(row?.[k]??'')));
export function reconcileDeliveryVariants(previous,incoming,{mode='manual',preserveExtra=false,makeId=()=>crypto.randomUUID()}={}){
 if(!Array.isArray(previous)||!Array.isArray(incoming)||incoming.length>3)conflict();
 if(previous.some(r=>!deliveryId(r.id))||new Set(previous.map(r=>r.id)).size!==previous.length)conflict();
 if(!['manual','import'].includes(mode))conflict();
 const assigned=new Set(),oldById=new Map(previous.map(r=>[r.id,r]));let result=[];
 const create=row=>{const id=makeId();if(!deliveryId(id)||assigned.has(id)||oldById.has(id))conflict();assigned.add(id);return {...row,id};};
 if(mode==='manual'){
  result=incoming.map(row=>{if(!row.id)return create(row);if(!oldById.has(row.id)||assigned.has(row.id))conflict();assigned.add(row.id);return {...row,id:row.id};});
 }else{
  if(incoming.some(row=>row.id))conflict();
  if(preserveExtra&&previous.length){
   if(incoming.length!==1||key(incoming[0])!==key(previous[0])||previous.filter(r=>key(r)===key(incoming[0])).length!==1)conflict();
   return [{...incoming[0],id:previous[0].id},...previous.slice(1).map(r=>({...r}))];
  }
  const pending=[];
  result=incoming.map((row,index)=>{const matches=previous.filter(old=>key(old)===key(row));if(matches.length>1)conflict();if(matches.length===1){if(assigned.has(matches[0].id))conflict();assigned.add(matches[0].id);return {...row,id:matches[0].id};}pending.push(index);return {...row};});
  if(pending.length&&previous.some(r=>!assigned.has(r.id)))conflict();
  for(const index of pending)result[index]=create(result[index]);
 }
 return result;
}
export function ownedDeliverySnapshot(user,input,expectedRevision){
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==user.profileRevision)throw Object.assign(Error('Հաճախորդի տվյալները փոխվել են։ Թարմացրեք առաքման տարբերակները'),{code:409});
 const row=(user.rowsList||[]).find(r=>r.id===input?.variantId);
 if(!deliveryId(input?.variantId)||!row)throw Object.assign(Error('Առաքման ընտրված տարբերակը հասանելի չէ'),{code:403});
 const text=(value,limit=300)=>String(value??'').trim().slice(0,limit),out={organization:row.organization||user.client};
 for(const k of ['address','contact'])out[k]=text(Object.hasOwn(input,k)?input[k]:row[k]);
 for(const k of ['method','date','comment'])out[k]=text(input[k],k==='comment'?2000:300);
 return {variantId:row.id,delivery:out};
}

