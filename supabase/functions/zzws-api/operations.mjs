export function priceDifference(before,after,{detailLimit=300,warningLimit=30}={}){
 const details=[];let warningsCount=0;
 const old=new Map(before.map(p=>[p.articul,p])),next=new Map(after.map(p=>[p.articul,p]));let added=0,removed=0,changed=0;const warnings=[];
 for(const row of after){const prev=old.get(row.articul);if(!prev){added++;continue;}let different=false;for(const key of ['base','retail','ws','kp','kpPromo']){const a=Number(prev[key]||0),b=Number(row[key]||0);if(a!==b)different=true;if(a>0&&b>0&&Math.abs(b/a-1)>=.3){warningsCount++;if(warnings.length<warningLimit)warnings.push({articul:row.articul,name:row.name,source:key,before:a,after:b,percent:Math.round((b/a-1)*100)});}}if(different)changed++;}
 for(const row of before)if(!next.has(row.articul))removed++;
 for(const row of before){const afterRow=next.get(row.articul);if(!afterRow){if(details.length<detailLimit)details.push({kind:'removed',articul:row.articul,name:row.name,before:row});continue;}
  const changes=['base','retail','ws','kp','kpPromo'].filter(key=>Number(row[key]||0)!==Number(afterRow[key]||0)).map(source=>({source,before:Number(row[source]||0),after:Number(afterRow[source]||0)}));
  if(changes.length&&details.length<detailLimit)details.push({kind:'changed',articul:row.articul,name:afterRow.name,changes});
 }
 for(const row of after)if(!old.has(row.articul)&&details.length<detailLimit)details.push({kind:'added',articul:row.articul,name:row.name,after:row});
 return {added,removed,changed,unchanged:after.length-added-changed,warnings,warningsCount,details,detailsTruncated:added+removed+changed>details.length};
}
export const scopePermissions={owner:['orders:read','orders:write','price:read','price:write','users','rules','storage','audit','security'],manager:['orders:read','orders:write'],price:['price:read','price:write'],viewer:['orders:read','price:read']};
export function canAccess(scope,path,method){if(!Object.hasOwn(scopePermissions,scope))return false;const permissions=scopePermissions[scope];if(['admin/catalog-controls','admin/operations'].includes(path))return scope==='owner';if(path.split('/')[1]==='templates')return permissions.includes('orders:'+(method==='GET'?'read':'write'));if(path==='admin/offers')return ['owner','price'].includes(scope);if(['admin/devices/register','admin/devices/revoke'].includes(path)&&method==='POST')return permissions.includes('orders:read');if(path==='admin/dashboard'||path==='admin/catalog-options'||path==='admin/security/enroll')return true;if(path==='admin/email-settings'||path==='admin/mobile/notices')return scope==='owner';if(path==='admin/receipt-control')return permissions.includes('users');const area=path.split('/')[1];let needed=area;if(area==='orders'||area==='price')needed=area+':'+(method==='GET'||path.endsWith('/detail')||path.endsWith('/export')||path.endsWith('/export-preview')||['admin/orders/receipt-notifications/read','admin/orders/read'].includes(path)?'read':'write');return permissions.includes(needed);}

