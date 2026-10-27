function configureSortPrices(){
 const select=document.getElementById('sortPrice');select.replaceChildren();
 const options=[['wholesale',isAdminUser()?'WS Price':'Ваша цена'],['retail','Розничная цена']];
 if(isAdminUser())options.push(['kpPrice','KP Price']);
 if(serverIdentity?.allowResale)options.push(['resaleWholesale','Цена перепродажи']);
 for(const [value,text] of options){const opt=document.createElement('option');opt.value=value;opt.textContent=text;select.append(opt);}
}
function compareProductPrices(a,b,field,direction){
 const av=Number(a[field]),bv=Number(b[field]),validA=Number.isFinite(av)&&av>0,validB=Number.isFinite(bv)&&bv>0;
 if(validA!==validB)return validA?-1:1;
 return (validA?(av-bv)*direction:0)||String(a.articul).localeCompare(String(b.articul));
}
