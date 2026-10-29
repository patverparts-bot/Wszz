(() => {
 const money=value=>Number(value||0).toLocaleString('hy-AM')+' ֏';
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 function model(original,current){
  const now=new Map(current.map(row=>[row.articul,row])),old=new Set(original.map(row=>row.articul));
  return [...original.map(before=>({before,after:now.get(before.articul)||null})),...current.filter(row=>!old.has(row.articul)).map(after=>({before:null,after}))];
 }
 function value(cell,before,after,format=String,removed=false){
  if(removed){cell.append(node('del',format(before)),node('span','Չի հաստատվել','comparison-missing'));return;}
  if(before!=null&&before!==after)cell.append(node('del',format(before)));
  cell.append(node('strong',format(after),before!=null&&before!==after?'comparison-new':''));
 }
 function render(original,current){
  const root=node('div',null,'order-lines-scroll order-comparison'),table=node('table');
  const header=table.createTHead().insertRow();for(const label of ['Պատվիրված ապրանք','Քանակ','Միավորի գին','Գումար'])header.append(node('th',label));
  for(const {before,after} of model(original,current)){
   const row=table.insertRow(),product=before||after;row.dataset.articul=product.articul;if(!after)row.className='comparison-removed';if(!before)row.className='comparison-added';
   const title=row.insertCell(),name=node(after?'strong':'del',product.name);title.append(name,node('small',product.articul));
   if(!before)title.append(node('span','Ավելացվել է հաստատման ժամանակ','comparison-added-label'));
   value(row.insertCell(),before?.qty,after?.qty,v=>String(v),!after);
   value(row.insertCell(),before?.unitPrice,after?.unitPrice,money,!after);
   value(row.insertCell(),before?before.qty*before.unitPrice:null,after?after.qty*after.unitPrice:null,money,!after);
  }
  root.append(table);return root;
 }
 function totals(order){
  const current=Number(order.total),rows=order.original_lines;
  const known=Array.isArray(rows)&&rows.length>0&&rows.every(r=>Number.isFinite(Number(r.qty))&&Number.isFinite(Number(r.unitPrice)));
  const original=known?Number(rows.reduce((sum,r)=>sum+Number(r.qty)*Number(r.unitPrice),0).toFixed(2)):null;
  return {current,original,changed:original!==null&&Math.abs(original-current)>=0.005};
 }
 function renderTotal(order){const values=totals(order),root=node('span',null,'order-total-comparison');
  if(values.changed){const old=node('del',money(values.original),'order-total-original');old.title='Սկզբնական ընդհանուր գումար';root.append(old);}
  const final=node('strong',money(values.current),'order-total-current');final.title='Վերջնական ընդհանուր գումար';root.append(final);if(values.changed)root.classList.add('order-total-changed');return root;
 }
 window.ZZWS_ORDER_COMPARE={model,render,totals,renderTotal};
})();
