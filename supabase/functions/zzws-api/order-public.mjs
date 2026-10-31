// Shared public boundary: internal calculation evidence and 1C routing never leave through order APIs.
const privateKeys=new Set(['integration_snapshot','integrationSnapshot','integration','order_calculation_contexts','checkedProducts','rulesStorageSnapshot','accessSnapshot','rulesSnapshot']);
export function orderPublic(value){
 if(Array.isArray(value))return value.map(orderPublic);
 if(value&&typeof value==='object'){
  if(value instanceof Date)return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>!privateKeys.has(key)).map(([key,v])=>[key,orderPublic(v)]));
 }
 return value;
}

