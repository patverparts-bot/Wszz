// Pure email validation: never accept display names, control characters or arbitrary headers.
const controls=/[\u0000-\u001f\u007f\u2028\u2029]/u;
export function email(value,{optional=false}={}){
 if(typeof value!=='string'||controls.test(value))throw Error('Էլ․ փոստի դաշտում անվավեր նիշեր կան');
 const s=value.trim();if(!s&&optional)return '';if(s.length>254||!s||!/^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(s))throw Error('Նշեք ճիշտ էլ․ փոստի հասցե');
 const [local,domain]=s.split('@');if(local.length>64||local.startsWith('.')||local.endsWith('.')||local.includes('..')||domain.split('.').some(p=>!p||p.length>63||p.startsWith('-')||p.endsWith('-')))throw Error('Նշեք ճիշտ էլ․ փոստի հասցե');return s.toLowerCase();
}
export function emailList(value,{max=50}={}){if(typeof value!=='string'||controls.test(value)||value.length>13000)throw Error('Էլ․ փոստի հասցեների սխալ ցանկ');const result=[...new Set(value.split(/[,;]/).map(s=>s.trim()).filter(Boolean).map(s=>email(s)))];if(result.length>max)throw Error('Էլ․ փոստի չափազանց շատ հասցեներ');return result;}
export function emailRows(value){if(!Array.isArray(value)||value.length>5)throw Error('Թույլատրվում է էլ․ փոստի մինչև հինգ տող');return Array.from({length:5},(_,i)=>emailList(value[i]??'',{max:20}).join(', '));}
export function reportRecipients(rows,selected,automatic,additional,replyTo){
 const normalized=emailRows(rows||[]);if(!Array.isArray(selected)||!selected.length||selected.length>5||new Set(selected).size!==selected.length||selected.some(i=>!Number.isInteger(i)||i<0||i>4||!normalized[i]))throw Error('Ընտրեք հաճախորդի էլ․ փոստի առնվազն մեկ տող');
 if(!Array.isArray(automatic)||automatic.length!==3)throw Error('Կարգավորեք երեք պարտադիր պատճենի հասցեները');
 const to=[...new Set(selected.flatMap(i=>emailList(normalized[i])))],cc=[...new Set([...automatic.map(s=>email(s)),...emailList(additional||'')])].filter(s=>!to.includes(s));if(to.length+cc.length>50)throw Error('Թույլատրվում է ընդհանուր մինչև 50 ստացող');return {to,cc,replyTo:email(replyTo||'')};
}

