(() => {
 const root=document.getElementById('offers'),node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const title=node('input'),codes=node('textarea'),active=node('input'),status=node('p'),history=node('div'),save=node('button','Պահպանել հատուկ առաջարկը'),label=node('label','Առաջարկը միացված է');title.maxLength=200;codes.rows=5;active.type='checkbox';active.checked=true;label.prepend(active);save.type='button';
 const name=node('label','Վերնագիր'),products=node('label','Արտիկուլներ՝ ստորակետով կամ նոր տողով');name.append(title);products.append(codes);root.append(name,products,label,save,status,history);let requestId=crypto.randomUUID(),busy=false;
 for(const input of [title,codes,active])input.addEventListener('input',()=>{requestId=crypto.randomUUID();});
 async function load(){const data=await ZZWS.json('admin/offers');history.replaceChildren();for(const o of data.offers){const entry=node('button',o.title+' · '+(o.active?'Միացված':'Անջատված'));entry.type='button';entry.onclick=()=>{title.value=o.title;codes.value=o.articles.join(', ');active.checked=o.active;requestId=crypto.randomUUID();};history.append(entry);}}
 save.onclick=async()=>{if(busy)return;busy=true;save.disabled=true;status.textContent='Պահպանվում է…';try{await ZZWS.json('admin/offers',{method:'POST',body:JSON.stringify({title:title.value,articles:codes.value.split(/[,;\n\s]+/).filter(Boolean),active:active.checked,requestId})});status.textContent='Հատուկ առաջարկը պահպանված է։ Հաճախորդը կտեսնի միայն իրեն հասանելի ապրանքները՝ մուտքից մոտ երկու րոպե անց։';await load();}catch(e){status.textContent=ZZWS.message(e);}finally{busy=false;save.disabled=false;}};
 window.ZZWS_OFFERS={load};
})();
