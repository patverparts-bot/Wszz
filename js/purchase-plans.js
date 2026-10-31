(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZWS_PURCHASE_PLANS=api;})(globalThis,()=>{
 let active=null;
 function reset(){active?.remove();active=null;}
 function plan(saved,current,products,priceFor,max=9999){
  const allowed=new Map(products.map(p=>[p.articul,p])),next=JSON.parse(JSON.stringify(current)),changes=[],missing=[];
  for(const [key,item] of Object.entries(saved||{})){
   const articul=String(item.articul||key),product=allowed.get(articul),qty=Number(item.qty),price=Number(product&&priceFor(product));
   if(['__proto__','constructor','prototype'].includes(articul)){missing.push(articul);continue;}
   if(!product||!Number.isFinite(price)||price<=0||!Number.isInteger(qty)||qty<1){missing.push(articul);continue;}
   const before=Number(next[articul]?.qty)||0,after=Math.min(max,before+qty),added=after-before;
   next[articul]={articul,qty:after,addedPrice:price,addedPriceMode:current[articul]?.addedPriceMode||item.addedPriceMode||'WS'};
   changes.push({articul,name:product.name,before,requested:qty,after,added,price,oldPrice:Number(item.addedPrice)||0,capped:added<qty});
  }
  return {cart:next,changes,missing,total:changes.reduce((sum,row)=>sum+row.added*row.price,0)};
 }
 async function preview(saved,title){
  const owner=serverIdentity;if(!owner)return;reset();const original=JSON.stringify(cart),mode=adminOrderPriceMode;
  const build=()=>plan(saved,cart,allProducts,p=>getItemWholesalePrice({articul:p.articul}));let proposal=build();
  const dialog=document.createElement('dialog'),heading=document.createElement('h2'),description=document.createElement('p'),body=document.createElement('div'),submit=document.createElement('button'),cancel=document.createElement('button');
  dialog.className='purchase-plan-dialog';heading.id='purchasePlanTitle';dialog.setAttribute('aria-labelledby',heading.id);heading.textContent='Պահպանված զամբյուղ՝ '+title;description.textContent='Ավելացում ընթացիկ զամբյուղին՝ ընթացիկ գներով։ Առկա մոդելների քանակները կմիավորվեն։';body.className='purchase-plan-review';
  const table=document.createElement('table'),head=table.createTHead().insertRow();for(const text of ['Արտիկուլ / մոդել','Զամբյուղում','Ավելացնել','Վերջնական','Ընթացիկ գին']){const th=document.createElement('th');th.textContent=text;head.append(th);}
  for(const row of proposal.changes){const tr=table.insertRow();for(const value of [row.articul+' · '+row.name,row.before,row.added+(row.capped?' (սահմանաչափ)':''),row.after,row.price.toLocaleString('hy-AM')+' ֏'+(row.oldPrice&&row.oldPrice!==row.price?' · նախկին՝ '+row.oldPrice+' ֏':'')])tr.insertCell().textContent=value;}body.append(table);
  const notice=document.createElement('p');notice.textContent='Ավելացվող գումար՝ '+proposal.total.toLocaleString('hy-AM')+' ֏'+(proposal.missing.length?' · Չեն ավելացվի՝ '+proposal.missing.join(', '):'');
  submit.type=cancel.type='button';submit.textContent='Ավելացնել զամբյուղին';cancel.textContent='Չեղարկել';submit.disabled=!proposal.changes.some(r=>r.added>0);dialog.append(heading,description,body,notice,cancel,submit);document.body.append(dialog);active=dialog;dialog.showModal();cancel.focus();
  const close=reset;cancel.onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  submit.onclick=()=>{
   if(serverIdentity!==owner||mode!==adminOrderPriceMode||JSON.stringify(cart)!==original||JSON.stringify(build())!==JSON.stringify(proposal)){notice.textContent='Զամբյուղը կամ գները փոխվել են։ Փակեք և նորից բացեք նախադիտումը։';submit.disabled=true;return;}
   cart=proposal.cart;for(const row of proposal.changes)cart[row.articul].addedPriceMode=isAdminUser()?mode:'WS';saveCartToStorage();updateOrderPanel();resetAndRender();renderModalItems();window.ZZWS_MEMORY?.capture();close();
  };
 }
 return {plan,preview,reset};
});
