import {effectiveRules} from './rules.mjs';
export const receiptStatement='Հաստատում եմ, որ այս պատվերի ապրանքները ստացել եմ ամբողջությամբ և առանց վնասվածքների։';
export function clientCategory(profile,rules){
 if(profile.role==='admin')return null;
 const policy=effectiveRules(rules)[profile.sheet||'Dealers']?.pricing;
 return policy?.sources.some(source=>source==='kp'||source==='kpPromo')?'KP':'Dealers';
}
export function validateReceiptControl(value,global=false,now=Date.now()){
 if(!value||!['inherit','on','off','until'].includes(value.mode)||(global&&value.mode==='inherit'))throw new Error('Ընտրեք ստացման վերահսկման ռեժիմը');
 let until=null;if(value.mode==='until'){const time=Date.parse(value.disabledUntil);if(!Number.isFinite(time)||time<=now)throw new Error('Նշեք ապագա ամսաթիվն ու ժամը');until=new Date(time).toISOString();}
 if(value.revision!==null&&value.revision!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.revision))throw new Error('Կարգավորման սխալ տարբերակ');
 return {mode:value.mode,until,revision:value.revision||null};
}
export function publicReceiptState(state){return {statement:receiptStatement,...Object.fromEntries(['enabled','blocked','latched','pendingCount','remaining','limit','outstanding'].map(k=>[k,state[k]]))};}

