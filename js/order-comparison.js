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
 function hasLineChanges(before,after){return model(before,after).some(row=>!row.before||!row.after||['qty','unitPrice'].some(key=>Number(row.before[key])!==Number(row.after[key])));}
 const normalized=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('hy-AM').replace(/\s+/gu,' ').trim();
 function confirmationCustomer(metadata,customer,delivery={}){
  const login=normalized(customer?.login),reported=normalized(metadata?.customer),organization=normalized(metadata?.organization);
  const code=metadata?.format==='zigzag_sales_report'?reported.match(/^(\d+)(?:\s|$)/)?.[1]:null;
  if(code&&/^\d+$/.test(login))return code===login?{status:'match',text:'Հաճախորդի կոդը համընկնում է ընտրված պատվերին՝ '+customer.login+'։'}:{status:'mismatch',text:'Հաճախորդի կոդը չի համընկնում․ ֆայլում՝ '+code+', պատվերում՝ '+customer.login+'։ Ստուգեք ընտրված պատվերն ու ֆայլը։'};
  if(reported&&login&&reported===login)return {status:'match',text:'Հաճախորդի մուտքանունը համընկնում է ընտրված պատվերին։'};
  const names=[customer?.client,delivery?.organization].map(normalized).filter(Boolean);
  if(organization&&names.includes(organization))return {status:'match',text:'Իրավաբանական անձը համընկնում է ընտրված պատվերին։'};
  if(reported&&names.includes(reported))return {status:'match',text:'Հաճախորդի անվանումը համընկնում է ընտրված պատվերին։'};
  return {status:'review',text:reported||organization?'Ստուգեք ֆայլի պատվիրատուին և իրավաբանական անձին՝ համեմատելով ընտրված պատվերի տվյալների հետ։':'Աղյուսակում հաճախորդը նշված չէ։ Ստուգեք համապատասխանությունն ընտրված պատվերին։'};
 }
 function eventNotice(event){
  const d=event?.detail||{};
  if(d.changes?.length)return {text:'Կան ապրանքների փոփոխություններ',changed:true};
  if(d.deliveryChanged)return {text:'Առաքման տվյալները փոխվել են',changed:true};
  if(d.kind==='closed_order_reopened')return {text:'Պատվերը վերաբացվել է',changed:false};
  if(d.kind==='created_by_admin')return {text:'Նոր պատվեր՝ ադմինիստրատորից',changed:false};
  return {text:({confirmed:'Պատվերը հաստատված է',in_progress:'Պատվերը մշակվում է',completed:'Պատվերը առաքված է',rejected:'Պատվերը մերժված է',received:'Ստացումը հաստատված է',new:'Պատվերը ստացված է'})[d.status]||'Նոր ծանուցում պատվերի մասին',changed:false};
 }
 window.ZZWS_ORDER_COMPARE={model,render,totals,renderTotal,hasLineChanges,confirmationCustomer,eventNotice};
})();
