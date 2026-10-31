(() => {
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 let active=null,ticket=0;
 function reset(){ticket++;active?.remove();active=null;}
 async function open(articul,orderId=null){
  if(!serverIdentity)return;reset();const owner=serverIdentity,id=++ticket,dialog=node('dialog'),status=node('p','Փոխարինումները բեռնվում են…'),close=node('button','Փակել');dialog.className='replacement-dialog';close.type='button';close.onclick=reset;dialog.addEventListener('cancel',e=>{e.preventDefault();reset();});const heading=node('h2','Ընտրել այլ մոդել');heading.id='replacementHeading';dialog.setAttribute('aria-labelledby',heading.id);dialog.append(heading,node('p','Ընտրությունը կփոխի միայն ընթացիկ զամբյուղը։ Ուղարկված պատվերները չեն փոխվում։ Չափերի համեմատությունը տեղադրման համատեղելիության հաստատում չէ։'),close,status);document.body.append(dialog);active=dialog;dialog.showModal();
  try{
   const data=await secureApi('orders/replacements',{method:'POST',body:JSON.stringify({articul,orderId,priceMode:adminOrderPriceMode,inCart:Object.values(cart).map(r=>({articul:r.articul,qty:r.qty}))})});
   if(id!==ticket||serverIdentity!==owner)return;status.textContent=data.source.name+' · '+data.source.articul;const mode=adminOrderPriceMode;
   if(!data.candidates.length)dialog.append(node('p','Այս կատեգորիայի պատվիրելի այլ մոդելներ չկան։'));
   const groups={};for(const [key,label] of Object.entries({verified:'Համընկնում են ստուգված հիմնական բնութագրերը',differences:'Կան չափերի կամ հիմնական բնութագրերի տարբերություններ',insufficient:'Տվյալները բավարար չեն՝ միայն նույն կատեգորիայի տարբերակներ'})){
    const rows=data.candidates.filter(c=>(c.matchGroup||'insufficient')===key);if(!rows.length)continue;
    const group=node(key==='insufficient'?'details':'section');group.className='replacement-group';group.dataset.replacementGroup=key;group.append(node(key==='insufficient'?'summary':'h3',label+' · '+rows.length));dialog.append(group);groups[key]=group;
   }
   for(const candidate of data.candidates){
    const card=node('section'),photo=node('div'),name=node('h3',candidate.name+' · '+candidate.articul);photo.innerHTML=getProductImageHtml(candidate.articul,candidate.name);card.className='replacement-card';photo.className='replacement-photo';card.append(photo,name,node('p',candidate.price.toLocaleString('hy-AM')+' ֏'+(candidate.priceDifference!==null?' · տարբերություն՝ '+(candidate.priceDifference>0?'+':'')+candidate.priceDifference.toLocaleString('hy-AM')+' ֏':'')));
    if(candidate.previouslyOrdered)card.append(node('p','Դուք արդեն պատվիրել եք այս մոդելը (վերջին 200 պատվերներում)։'));
    const existing=node('p',(cart[candidate.articul]?.qty||0)?'Արդեն զամբյուղում՝ '+cart[candidate.articul].qty+' հատ':'');card.append(existing);
    card.append(node('p',candidate.sizeConfirmed?candidate.differences.map(d=>({width:'Լայնություն',height:'Բարձրություն',depth:'Խորություն'}[d.axis])+': '+d.before+' → '+d.after+' սմ ('+(d.difference>0?'+':'')+d.difference+')').join(' · '):'Տեխնիկական համապատասխանությունը հաստատված չէ։ Նույն կատեգորիայի տարբերակ է։'));
    const differences=node('ul');differences.className='replacement-differences';
    if(candidate.sameDimensions)differences.append(node('li','Հաստատված չափերը նույնն են։'));
    if(candidate.priceDifference<0)differences.append(node('li','Ավելի մատչելի է՝ '+Math.abs(candidate.priceDifference).toLocaleString('hy-AM')+' ֏։'));
    const featureLabels={capacity:'Տարողություն (կգ)',volume:'Ծավալ (լ)',placeSettings:'Սպասքի հավաքածու',spin:'Քամում (պտ/րոպե)',diagonal:'Անկյունագիծ (դյույմ)',drying:'Չորացում',inverter:'Ինվերտոր',noFrost:'No Frost',resolution:'Թույլատրելիություն',screen:'Էկրանի տեսակ',energy:'Էներգախնայողության դաս',connection:'Միացման տեսակ',installation:'Տեղադրման տեսակ'};
    const value=v=>typeof v==='boolean'?(v?'Այո':'Ոչ'):v;
    for(const change of candidate.featureDifferences||[])differences.append(node('li',featureLabels[change.key]+': '+value(change.before)+' → '+value(change.after)));
    if(!candidate.comparisonComplete)differences.append(node('li','Որոշ բնութագրեր հաստատված չեն։ Ստուգեք ապրանքի քարտը։'));
    card.append(differences);
    if(window.ZZWS_DEALER){const tools=node('div'),details=node('button','Ապրանքի քարտ'),compare=node('button','Համեմատել սկզբնականի հետ');details.type=compare.type='button';details.className=compare.className='dealer-button';details.onclick=()=>ZZWS_DEALER.openProduct(candidate.articul);compare.onclick=()=>ZZWS_DEALER.compare([articul,candidate.articul]);tools.append(details,compare);card.append(tools);}
    const qty=node('input');qty.type='number';qty.min='1';qty.max='9999';qty.step='1';qty.value=String(cart[articul]?.qty||1);qty.setAttribute('aria-label','Փոխարինվող քանակը');
    const choose=node('button',orderId?'Ավելացնել ընթացիկ զամբյուղին':'Փոխարինել զամբյուղում');choose.type='button';choose.dataset.replacementAction='choose';card.append(qty,choose);groups[candidate.matchGroup||'insufficient'].append(card);
    choose.onclick=()=>{
     const amount=Number(qty.value),product=getProduct(candidate.articul),sourceQty=cart[articul]?.qty||0,existingQty=cart[candidate.articul]?.qty||0,currentPrice=getItemWholesalePrice({articul:candidate.articul});
     if(serverIdentity!==owner||mode!==adminOrderPriceMode||!product||currentPrice!==candidate.price||currentPrice<=0){alert('Տվյալները փոխվել են։ Նորից բացեք ընտրությունը։');return;}
     if(!Number.isInteger(amount)||amount<1||amount>9999||existingQty+amount>9999||!orderId&&amount>sourceQty){alert('Ստուգեք քանակը և զամբյուղի սահմանաչափը։');return;}
     const question=(candidate.matchGroup==='verified'?'':'Ուշադրություն՝ կան տարբերություններ կամ չհաստատված բնութագրեր։ ')+(orderId?'Ավելացնե՞լ':'Փոխարինե՞լ')+' '+amount+' հատ «'+candidate.name+'» մոդելով։ '+(existingQty?'Նոր մոդելի քանակը զամբյուղում կդառնա '+(existingQty+amount)+'։':'')+' Ընթացիկ գինը՝ '+currentPrice.toLocaleString('hy-AM')+' ֏։';
     if(!confirm(question))return;
     if(!orderId){if(amount===sourceQty)delete cart[articul];else cart[articul].qty=sourceQty-amount;}
     cart[candidate.articul]={articul:candidate.articul,qty:existingQty+amount,addedPrice:currentPrice,addedPriceMode:isAdminUser()?mode:'WS'};
     saveCartToStorage();updateOrderPanel();resetAndRender();renderModalItems();window.ZZWS_MEMORY?.capture();reset();if(orderId){closePersonalCabinet();openOrderModal();}
    };
   }
  }catch(e){if(id===ticket)status.textContent=ZZWS.message(e);}
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-replace-art]');if(b)open(b.dataset.replaceArt,b.dataset.replaceOrder||null);});
 window.ZZWS_REPLACEMENTS={open,reset};
})();
