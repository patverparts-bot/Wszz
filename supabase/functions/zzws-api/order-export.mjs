import {statuses} from './orders.mjs';
export function orderExportData(order){
 const rows=[['Պատվեր',Number(order.number),null,'Կարգավիճակ',statuses[order.status]||'—',null],['Արտիկուլ','Անվանում',null,'Քանակ','Գին','Գումար'],...order.lines.map(line=>[line.articul,line.name,null,line.qty,line.unitPrice,Number((line.qty*line.unitPrice).toFixed(2))]),['Ընդամենը','',null,'','',Number(order.total)]];
 if(order.created_by)rows.push(['Լրացրել է ադմինիստրատոր',order.created_by.name+' ('+order.created_by.login+')',null,null,null,null]);
 return {id:order.id,number:order.number,revision:order.revision,status:order.status,statusLabel:statuses[order.status]||'—',rows,total:Number(order.total),columns:[{wch:16},{wch:44},{wch:3},{wch:12},{wch:18},{wch:20}]};
}

