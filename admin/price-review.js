(() => {
 let warnings=0,reportDraft=null;
 const labels={base:'Հիմնական մանրածախ',retail:'Զեղչված մանրածախ',ws:'Մեծածախ',kp:'KP',kpPromo:'KP ակցիա'};
 window.ZZWS_PRICE_REVIEW={
  show(data){
   warnings=data.difference?.warningsCount??data.difference?.warnings?.length??0;reportDraft=data.draft;
   if(reportDraft){const download=button('Ներբեռնել ամբողջական հաշվետվությունը (CSV)',async()=>{
    download.disabled=true;try{const response=await ZZWS.request('admin/price/report',{method:'POST',body:JSON.stringify({draft:reportDraft})});if(!response.ok){const error=await response.json();throw new Error(error.error||'Չհաջողվեց ստանալ հաշվետվությունը');}const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='Price-changes.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}finally{download.disabled=false;}
   });download.id='downloadPriceReport';el('sample').append(download);}
   if(warnings>(data.difference?.warnings?.length||0)){const note=document.createElement('p');note.textContent='Խոշոր գնային փոփոխություններ՝ '+warnings+'։ Նախադիտումը սահմանափակված է, ամբողջական ցանկը՝ ներբեռնվող հաշվետվությունում։';el('sample').append(note);}
   const details=data.difference?.details||[];if(!details.length)return;
   const box=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Փոփոխված ապրանքների ցանկը'+(data.difference.detailsTruncated?' · առաջին 300 դիրքերը':'');box.append(summary);
   box.append(table(['Փոփոխություն','Արտիկուլ','Մոդել','Գներ'],details.map(row=>[({added:'Ավելացվել է',removed:'Հեռացվել է',changed:'Գինը փոխվել է'})[row.kind],row.articul,row.name,(row.changes||[]).map(v=>(labels[v.source]||v.source)+': '+v.before+' → '+v.after).join(' · ')])));el('sample').append(box);
  },
  errors(error){warnings=0;el('preview').hidden=false;el('publish').disabled=true;el('priceDifference').textContent='';el('priceWarnings').replaceChildren();el('summary').textContent='Ֆայլը չի ընդունվել։ Շտկեք սխալները և կրկին բեռնեք։';el('sample').replaceChildren(table(['Տող','Արտիկուլ','Սխալ'],(error.data?.issues||[{row:'—',message:error.message}]).map(row=>[row.row??'—',row.articul||'',row.message])));},
  confirm(){return !warnings||confirm('Գնացուցակում կան առնվազն 30% գնային փոփոխություններ։ Ստուգե՞լ եք նախադիտման տարբերությունները և ցանկանո՞ւմ եք հրապարակել։');}
 };
})();
