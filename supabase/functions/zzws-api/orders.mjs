export const statuses={new:'Նոր',confirmed:'Հաստատված',in_progress:'Ընթացքում',completed:'Ավարտված',rejected:'Մերժված'};
const text=(v,n=300)=>String(v??'').trim().slice(0,n);
export function deliverySnapshot(p,user){
 const out={};for(const key of ['organization','address','contact','method','date','comment'])out[key]=text(p?.[key],key==='comment'?2000:300);
 out.organization=out.organization||user.client;return out;
}
export function normalizeLines(raw,products,old=[],admin=false,mode='WS'){
 if(!Array.isArray(raw)||raw.length>500)throw new Error('Թույլատրվում է մինչև 500 դիրք');
 const permitted=new Map(products.map(p=>[p.articul,p])),previous=new Map(old.map(p=>[p.articul,p])),seen=new Set();
 return raw.map(input=>{
  const articul=text(input.articul,100);if(!articul||seen.has(articul))throw new Error('Դատարկ կամ կրկնվող արտիկուլ՝ '+articul);seen.add(articul);
  const qty=Number(input.qty);if(!Number.isInteger(qty)||qty<1||qty>9999)throw new Error('Քանակը՝ 1-ից 9999, արտիկուլ՝ '+articul);
  const product=permitted.get(articul),prior=previous.get(articul);if(!product&&!(admin&&prior))throw new Error('Ապրանքը հասանելի չէ՝ '+articul);
  const source=product||prior,serverPrice=mode==='KP'&&source.kpPrice!==undefined?source.kpPrice:source.wholesale;
  const unitPrice=admin?Number(input.unitPrice??prior?.unitPrice??serverPrice):Number(serverPrice);
  if(!Number.isFinite(unitPrice)||unitPrice<=0||unitPrice>1e10)throw new Error('Հասանելի գին չկա՝ '+articul);
  return {articul,name:text(source.name,500),brand:text(source.brand),category:text(source.category),qty,unitPrice};
 });
}
export const totalOf=lines=>{const total=Number(lines.reduce((sum,p)=>sum+p.qty*p.unitPrice,0).toFixed(2));if(!Number.isFinite(total)||total>1e14)throw new Error('Պատվերի գումարը չափազանց մեծ է');return total;};
export function changesBetween(before,after){
 const a=new Map(before.map(p=>[p.articul,p])),b=new Map(after.map(p=>[p.articul,p])),changes=[];
 for(const row of before)if(!b.has(row.articul))changes.push({articul:row.articul,name:row.name,kind:'removed',before:row,after:null});
 for(const row of after){const prev=a.get(row.articul);if(!prev)changes.push({articul:row.articul,name:row.name,kind:'added',before:null,after:row});else if(['qty','unitPrice'].some(key=>prev[key]!==row[key]))changes.push({articul:row.articul,name:row.name,kind:'changed',before:prev,after:row});}
 return changes;
}
const header=v=>text(v).toLowerCase().replace(/[\s_().:՝-]/g,'');
function parseSimpleFinalOrder(rows){
 const names={articul:['артикул','articul','sku','код','արտիկուլ'],qty:['количество','колво','qty','քանակհատ','քանակ'],unitPrice:['цена','ценазаединицу','unitprice','մեծածախգինamd','միավորիգին','գին']};
 let start=-1,columns={};
 for(let i=0;i<Math.min(rows.length,40);i++){const normalized=rows[i].map(header),mapping={};for(const [key,variants] of Object.entries(names))mapping[key]=normalized.findIndex(v=>variants.includes(v));if(mapping.articul>=0&&mapping.qty>=0){start=i;columns=mapping;break;}}
 if(start<0)throw new Error('«Արտիկուլ» և «Քանակ» սյունակները չեն գտնվել։ Օգտագործեք ձևանմուշը');
 const result=[],seen=new Set();
 for(const row of rows.slice(start+1)){
  const articul=text(row[columns.articul],100);if(!articul)continue;
  if(/^(итого|всего|total|ընդհանուր|ընդամենը|գնացուցակի|կազմակերպություն|կոնտրագենտ|առաքման|մեկնաբանություն|կոնտակտային)/i.test(articul))continue;
  if(seen.has(articul))throw new Error('Ֆայլում կրկնվող արտիկուլ՝ '+articul);seen.add(articul);
  const qty=reportNumber(row[columns.qty]);if(qty===0)continue;if(!Number.isInteger(qty)||qty<1||qty>9999)throw new Error('Սխալ քանակ՝ '+articul);
  const input={articul,qty};if(columns.unitPrice>=0&&row[columns.unitPrice]!=null&&String(row[columns.unitPrice]).trim()!=='')input.unitPrice=reportNumber(row[columns.unitPrice]);
  result.push(input);
 }
 if(!result.length)throw new Error('Վերջնական պատվերում դիրքեր չկան');if(result.length>500)throw new Error('Թույլատրվում է մինչև 500 դիրք');return result;
}
export function reportNumber(value){
 if(typeof value==='number')return value;
 let s=String(value??'').replace(/[\s\u00a0%]/g,'');
 if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf('.')>s.lastIndexOf(',')?s.replace(/,/g,''):s.replace(/\./g,'').replace(',','.');
 else if(s.includes(','))s=/^[+-]?\d{1,3}(,\d{3})+$/.test(s)?s.replace(/,/g,''):s.replace(',','.');
 if(!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s))return NaN;return Number(s);
}
const reportDate=value=>{const s=text(value),match=s.match(/^(\d{2})[/.](\d{2})[/.](\d{4})$/);return match?`${match[3]}-${match[2]}-${match[1]}`:s;};
export function parseConfirmation(rows){
 const top=rows.findIndex(row=>row.some(v=>header(v)==='կոդ')&&row.some(v=>header(v)==='մոդել')&&row.some(v=>header(v).startsWith('արժեքըստգնացուցակի')));
 if(top<0)return {lines:parseSimpleFinalOrder(rows),metadata:{format:'table'},delivery:{}};
 const first=rows[top].map(header),code=first.indexOf('կոդ');let sub=-1,qty=-1,amount=-1;
 for(let i=top;i<=Math.min(top+3,rows.length-1);i++){const row=rows[i].map(header),q=row.indexOf('քանակ'),a=row.findIndex(v=>v.startsWith('ընդհանուրարժեքզեղչով'));if(q>=0&&a>=0){sub=i;qty=q;amount=a;break;}}
 if(sub<0)throw new Error('Հաշվետվությունում քանակն ու զեղչված ընդհանուր գումարը չեն գտնվել');
 if(code===1&&first.indexOf('մոդել')===2&&first.findIndex(v=>v.startsWith('արժեքըստգնացուցակի'))===3){qty=5;amount=6;}
 const metadata={format:'zigzag_sales_report'},labels={customer:'պատվիրատու',organization:'իրավաբանականանձ',total:'պատվերիընդհանուրգումարդրամ',currency:'տարադրամ',deliveryMethod:'առաքմանտեսակ',deliveryDate:'առաքմանօր',paymentDeadline:'վճարմանվերջնաժամկետ'};
 for(let i=0;i<top;i++){const labelsRow=rows[i].map(header);for(const [key,label] of Object.entries(labels)){const col=labelsRow.indexOf(label);if(col>=0&&rows[i+1])metadata[key]=key==='total'?reportNumber(rows[i+1][col]):text(rows[i+1][col]);}}
 if(metadata.currency&&metadata.currency!=='AMD')throw new Error('Հաստատումները պետք է լինեն միայն ՀՀ դրամով');
 const lines=[],seen=new Set();let sum=0;
 for(const row of rows.slice(sub+1)){
  if(row.some(v=>header(v).startsWith('երաշխիքայինքարտի')))break;
  const articul=text(row[code],100);if(!articul)continue;
  if(/^(итого|total|ընդհանուր)/i.test(articul))continue;
  if(seen.has(articul))throw new Error('Հիմնական աղյուսակում կրկնվող կոդ՝ '+articul);seen.add(articul);
  const quantity=reportNumber(row[qty]),net=reportNumber(row[amount]);if(quantity===0)continue;
  if(!Number.isInteger(quantity)||quantity<1||quantity>9999||!Number.isFinite(net)||net<=0)throw new Error('Սխալ քանակ կամ գումար՝ '+articul);
  lines.push({articul,qty:quantity,unitPrice:net/quantity});sum+=net;
 }
 if(!lines.length||lines.length>500)throw new Error('Հաշվետվությունում պետք է լինի 1-ից 500 դիրք');
 metadata.totalProvided=Object.hasOwn(metadata,'total');
 if(metadata.totalProvided&&(!Number.isFinite(metadata.total)||Math.abs(sum-metadata.total)>0.01))throw new Error('Փաստաթղթի ընդհանուր գումարը չի համընկնում ապրանքային տողերի գումարին');
 if(!metadata.totalProvided)metadata.total=Number(sum.toFixed(2));
 return {lines,metadata,delivery:{...(metadata.deliveryDate?{date:reportDate(metadata.deliveryDate)}:{}),...(metadata.deliveryMethod?{method:metadata.deliveryMethod}:{}),...(metadata.paymentDeadline?{paymentDeadline:reportDate(metadata.paymentDeadline)}:{})}};
}
export const parseFinalOrder=rows=>parseConfirmation(rows).lines;
export function parsePastedConfirmation(value){
 if(typeof value!=='string'||value.length>500000)throw new Error('Թույլատրվում է մինչև 500 000 նիշ պարունակող աղյուսակ');
 const rows=value.split(/\r?\n/).filter(line=>line.trim()).filter(line=>!/^\s*\|?[\s:|-]+\|?\s*$/.test(line)).map(line=>{
  const cells=line.includes('\t')?line.split('\t'):line.trim().startsWith('|')?line.trim().replace(/^\||\|$/g,'').split('|'):null;
  if(!cells)throw new Error('Տեղադրեք Excel-ի աղյուսակ կամ | բաժանիչներով Markdown աղյուսակ');
  return cells.map(cell=>cell.trim().replace(/\*\*/g,''));
 });return parseConfirmation(rows);
}
