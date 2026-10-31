const names={base:'Հիմնական մանրածախ',retail:'Զեղչված մանրածախ',ws:'Մեծածախ',kp:'KP',kpPromo:'KP ակցիա'};
export function* priceReportRows(report,baseVersion){
 yield ['Գնացուցակի փոփոխություններ','Հիմնական տարբերակ',baseVersion||'Սկզբնական բեռնում'];
 yield ['Ավելացված',report.added,'Հեռացված',report.removed,'Գինը փոխված',report.changed];
 yield ['Փոփոխություն','Արտիկուլ','Մոդել','Գնի տեսակ','Նախկին գին','Նոր գին'];
 for(const row of report.details){
  const kind={added:'Ավելացված',removed:'Հեռացված',changed:'Փոփոխված'}[row.kind];
  const changes=row.changes||Object.keys(names).map(source=>({source,before:row.before?Number(row.before[source]||0):'',after:row.after?Number(row.after[source]||0):''}));
  for(const change of changes)yield [kind,row.articul,row.name,names[change.source],change.before,change.after];
 }
}
export function csvLine(row){return row.map(value=>{let text=String(value??'');if(typeof value==='string'&&/^\s*[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}).join(';')+'\r\n';}
export function priceReportResponse(report,baseVersion,headers={}){
 const rows=priceReportRows(report,baseVersion),encoder=new TextEncoder();
 const stream=new ReadableStream({start(controller){controller.enqueue(encoder.encode('\uFEFF'));},pull(controller){let text='';for(let i=0;i<64;i++){const next=rows.next();if(next.done){if(text)controller.enqueue(encoder.encode(text));controller.close();return;}text+=csvLine(next.value);}controller.enqueue(encoder.encode(text));}});
 return new Response(stream,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="Price-changes.csv"'}});
}
