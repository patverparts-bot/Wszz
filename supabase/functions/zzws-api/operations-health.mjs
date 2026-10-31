export const operationCheckIds=['frontend','api','auth','backupIntegrity','backupAge','restoreRehearsal','scheduler'];
export function validateOperationsReport(value){
 if(!value||!Array.isArray(value.checks)||value.checks.length!==operationCheckIds.length||operationCheckIds.some(id=>value.checks.filter(c=>c?.id===id&&typeof c.ok==='boolean').length!==1))throw Error('Invalid operations report');
 return {checkedAt:new Date().toISOString(),scope:'application-data-only',checks:value.checks.map(({id,ok})=>({id,ok}))};
}
export function operationStatus(entry,now=Date.now()){
 if(!entry)return {status:'unknown',stale:true,report:null};
 let report;try{report=JSON.parse(entry.detail);validateOperationsReport(report);}catch{return {status:'unknown',stale:true,report:null};}
 const age=now-Date.parse(entry.created),stale=!Number.isFinite(age)||age<0||age>2*3600000;
 return {status:stale?'stale':report.checks?.every(c=>c.ok)?'ok':'attention',stale,report};
}
