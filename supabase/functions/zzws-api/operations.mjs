export function priceDifference(before,after){
 const old=new Map(before.map(p=>[p.articul,p])),next=new Map(after.map(p=>[p.articul,p]));let added=0,removed=0,changed=0;const warnings=[];
 for(const row of after){const prev=old.get(row.articul);if(!prev){added++;continue;}let different=false;for(const key of ['base','retail','ws','kp','kpPromo']){const a=Number(prev[key]||0),b=Number(row[key]||0);if(a!==b)different=true;if(a>0&&b>0&&Math.abs(b/a-1)>=.3&&warnings.length<30)warnings.push({articul:row.articul,name:row.name,source:key,before:a,after:b,percent:Math.round((b/a-1)*100)});}if(different)changed++;}
 for(const row of before)if(!next.has(row.articul))removed++;
 return {added,removed,changed,unchanged:after.length-added-changed,warnings};
}
export const scopePermissions={owner:['orders:read','orders:write','price:read','price:write','users','rules','storage','audit','security'],manager:['orders:read','orders:write'],price:['price:read','price:write'],viewer:['orders:read','price:read']};
export function canAccess(scope,path,method){const permissions=scopePermissions[scope]||[];if(path==='admin/dashboard'||path==='admin/catalog-options'||path==='admin/security/enroll')return true;if(path==='admin/receipt-control')return permissions.includes('users');const area=path.split('/')[1];let needed=area;if(area==='orders'||area==='price')needed=area+':'+(method==='GET'||path.endsWith('/detail')||path.endsWith('/export')||path==='admin/orders/receipt-notifications/read'?'read':'write');return permissions.includes(needed);}
