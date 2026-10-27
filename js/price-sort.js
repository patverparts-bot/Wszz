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
function allowedSortColumns(){return ['articul','brand','name','stockStatus','retail','wholesale','marginVal',...(isAdminUser()?['kpPrice','kpMarginVal']:[]),...(serverIdentity?.allowResale?['resaleWholesale']:[])];}
function activeColumnSort(){
 const mode=document.getElementById('sortBy').value;
 if(mode==='priceAsc'||mode==='priceDesc')return {key:document.getElementById('sortPrice').value,direction:mode==='priceAsc'?1:-1};
 if(mode==='marginDesc')return {key:'marginVal',direction:-1};
 return {key:document.getElementById('sortColumn').value,direction:mode==='columnAsc'?1:mode==='columnDesc'?-1:0};
}
function sortByColumn(key){
 if(!allowedSortColumns().includes(key))return;
 const current=activeColumnSort(),mode=current.key===key&&current.direction===1?'columnDesc':current.key===key&&current.direction===-1?'default':'columnAsc';
 document.getElementById('sortColumn').value=key;document.getElementById('sortBy').value=mode;resetAndRender();
}
function updateColumnSortIndicators(){
 const active=activeColumnSort();
 document.querySelectorAll('[data-sort-column]').forEach(button=>{
  const chosen=button.dataset.sortColumn===active.key&&active.direction!==0;
  button.classList.toggle('sort-active',chosen);button.querySelector('.sort-arrow').textContent=chosen?(active.direction===1?'↑':'↓'):'↕';
  const th=button.closest('th');if(th)th.setAttribute('aria-sort',chosen?(active.direction===1?'ascending':'descending'):'none');
 });
}
function compareByColumn(a,b,key,direction){
 if(['retail','wholesale','kpPrice','resaleWholesale'].includes(key))return compareProductPrices(a,b,key,direction);
 const result=['marginVal','kpMarginVal'].includes(key)?(Number(a[key])||0)-(Number(b[key])||0):String(a[key]||'').localeCompare(String(b[key]||''),'hy',{numeric:true,sensitivity:'base'});
 return result*direction||String(a.articul).localeCompare(String(b.articul));
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-sort-column]');if(b)sortByColumn(b.dataset.sortColumn);});
function fitCatalogHeadings(){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 document.querySelectorAll('#tableHeaderRow .column-sort-button').forEach(button=>{
  const label=button.firstElementChild,arrow=button.lastElementChild,style=getComputedStyle(button);
  if(!button.clientWidth)return;
  const available=button.clientWidth-arrow.getBoundingClientRect().width-6;
  const base=parseFloat(style.fontSize);ctx.font=style.fontWeight+' '+base+'px '+style.fontFamily;
  const words=label.textContent.split(/[\s\u00ad-]+/).filter(Boolean),longest=Math.max(1,...words.map(word=>ctx.measureText(word).width));
  label.style.fontSize=Math.max(10,Math.min(base,base*available/longest)).toFixed(2)+'px';
  button.title=label.textContent.replace(/\u00ad/g,'')+' · Սեղմեք՝ փոխելու դասավորությունը';
 });
}
window.addEventListener('resize',()=>requestAnimationFrame(fitCatalogHeadings));
document.fonts?.ready.then(fitCatalogHeadings);
