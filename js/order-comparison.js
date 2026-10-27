(() => {
 const money=value=>Number(value||0).toLocaleString('ru-RU')+' ֏';
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 function model(original,current){
  const now=new Map(current.map(row=>[row.articul,row])),old=new Set(original.map(row=>row.articul));
  return [...original.map(before=>({before,after:now.get(before.articul)||null})),...current.filter(row=>!old.has(row.articul)).map(after=>({before:null,after}))];
 }
 function value(cell,before,after,format=String,removed=false){
  if(removed){cell.append(node('del',format(before)),node('span','Не подтверждено','comparison-missing'));return;}
  if(before!=null&&before!==after)cell.append(node('del',format(before)));
  cell.append(node('strong',format(after),before!=null&&before!==after?'comparison-new':''));
 }
 function render(original,current){
  const root=node('div',null,'order-lines-scroll order-comparison'),table=node('table');
  const header=table.createTHead().insertRow();for(const label of ['Товар из заказа','Количество','Цена за единицу','Сумма','Оплата'])header.append(node('th',label));
  for(const {before,after} of model(original,current)){
   const row=table.insertRow(),product=before||after;row.dataset.articul=product.articul;if(!after)row.className='comparison-removed';if(!before)row.className='comparison-added';
   const title=row.insertCell(),name=node(after?'strong':'del',product.name);title.append(name,node('small',product.articul));
   if(!before)title.append(node('span','Добавлено при подтверждении','comparison-added-label'));
   value(row.insertCell(),before?.qty,after?.qty,v=>String(v),!after);
   value(row.insertCell(),before?.unitPrice,after?.unitPrice,money,!after);
   value(row.insertCell(),before?before.qty*before.unitPrice:null,after?after.qty*after.unitPrice:null,money,!after);
   value(row.insertCell(),before?.paymentMethod,after?.paymentMethod,v=>String(v||''),!after);
  }
  root.append(table);return root;
 }
 window.ZZWS_ORDER_COMPARE={model,render};
})();
