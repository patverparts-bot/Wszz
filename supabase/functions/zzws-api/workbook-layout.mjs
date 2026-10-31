export function workbookColumns(rows){const count=Math.max(1,...rows.map(row=>row.length));return Array.from({length:count},(_,index)=>({wch:Math.min(72,Math.max(12,...rows.map(row=>row[index]==null?0:Array.from(String(row[index])).length))+3)}));}
export function catalogMetadataMerge(rows){return rows[0]?.[2]==='Տարբերակ'&&rows[1]?.length>4?[{s:{r:0,c:3},e:{r:0,c:rows[1].length-1}}]:[];}
// Human-facing revision label; opaque IDs remain internal for concurrency checks.
export function priceVersionLabel(created){const date=new Date(created);if(!Number.isFinite(date.valueOf()))return '—';const values=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Yerevan',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));return values.year+values.month+values.day+'-'+values.hour+values.minute+values.second;}

