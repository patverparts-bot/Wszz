import XLSX from './vendor/xlsx.mjs';
import {validateProfile} from './catalog.mjs';
import {effectiveRules,validateAccess} from './rules.mjs';
const yes=['Այո','Ոչ'];
export const SHEET_COLUMNS=[
 ['login','Մուտքանուն'],['client','Հաճախորդ'],['sheet','Հաճախորդի կատեգորիա','category'],['role','Դեր',['Հաճախորդ','Ադմինիստրատոր']],['active','Հասանելիությունը միացված է',yes],['scope','Աշխատակցի իրավունքներ',['Չնշանակել','Սեփականատեր','Պատվերների մենեջեր','Գնացուցակի օպերատոր','Միայն դիտում']],
 ['mobile','Android հավելված',yes],['telegram','Telegram ծանուցումներ',yes],['telegramId','Ստացողի Telegram ID'],['bot','Telegram բոտի օգտանուն'],['refresh','Պատվերների ստուգման միջակայք (վրկ)'],
 ['receipt','Ստացման վերահսկում',['Ընդհանուր կարգավորում','Միացված է','Անջատված է','Ժամանակավորապես անջատված է']],['until','Անջատված է մինչև (Երևան)'],
 ['allBrands','Բոլոր բրենդները',yes],['brands','Թույլատրված բրենդներ'],['allowResale','Վերավաճառքի գին',yes],['accessMode','Անհատական հասանելիություն',['Բոլոր ապրանքները','Ընտրված ապրանքները']],['match','Կատեգորիայի համընկնում',['Ճշգրիտ','Պարունակում է']],['include','Թույլտվությունների կապեր (JSON)'],['exclude','Բացառությունների կապեր (JSON)'],
 ...[1,2,3].flatMap(i=>[['organization','Կազմակերպություն'],['address','Հասցե'],['contact','Կոնտակտային անձ']].map(([key,label])=>[key+(i===1?'':i),label+' '+i]))
];
const scopeLabels={'Չնշանակել':null,'Սեփականատեր':'owner','Պատվերների մենեջեր':'manager','Գնացուցակի օպերատոր':'price','Միայն դիտում':'viewer'};
const xml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function categoryChoices(rules){return Object.entries(effectiveRules(rules)).map(([id,rule])=>({id,label:rule.name||({Dealers:'Մշտական Գորրընկեր',KP:'Խոշոր Գործընկեր'}[id]||id)}));}
export function userTemplate(rules){
 const categories=categoryChoices(rules),book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([SHEET_COLUMNS.map(c=>c[1])]);sheet['!cols']=SHEET_COLUMNS.map(c=>({wch:['include','exclude'].includes(c[0])?45:['client','organization','address','contact'].some(k=>c[0].startsWith(k))?32:26}));sheet['!autofilter']={ref:'A1:'+XLSX.utils.encode_col(SHEET_COLUMNS.length-1)+'1001'};
 XLSX.utils.book_append_sheet(book,sheet,'Օգտատերեր');
 const lists=[],validations=[],names=[];
 for(let i=0;i<SHEET_COLUMNS.length;i++){const [key,,source]=SHEET_COLUMNS[i];if(!source)continue;const values=source==='category'?categories.map(c=>c.label):source,col=lists.length;lists.push(values);const range="'_ZZWS_Choices'!$"+XLSX.utils.encode_col(col)+'$1:$'+XLSX.utils.encode_col(col)+'$'+values.length;names.push({Name:'ZZWS_'+key,Ref:range});validations.push('<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="'+xml('Սխալ ընտրություն')+'" error="'+xml('Ընտրեք ցանկի արժեքներից մեկը')+'" sqref="'+XLSX.utils.encode_col(i)+'2:'+XLSX.utils.encode_col(i)+'1001"><formula1>ZZWS_'+key+'</formula1></dataValidation>');}
 const choices=XLSX.utils.aoa_to_sheet(Array.from({length:Math.max(...lists.map(l=>l.length))},(_,i)=>lists.map(l=>l[i]??'')));XLSX.utils.book_append_sheet(book,choices,'_ZZWS_Choices');book.Workbook={Sheets:[{Hidden:0},{Hidden:2}],Names:names};
 const help=[['ZZWS — զանգվածային ներմուծում'],['Լրացրեք մինչև 1000 օգտատիրոջ տվյալները երկրորդ տողից։ Պահպանեք սյունակների վերնագրերը։'],['Դատարկ ընտրությունը պահպանում է գոյություն ունեցող կարգավորումը։ Նոր հաշիվը լռելյայն Հաճախորդ է, կատեգորիան՝ Մշտական Գորրընկեր, հասանելիությունն անջատված։'],['Աշխատակցի իրավունքները նշանակվում են միայն բացահայտ ընտրությամբ։ Ձեր սեփական քարտը այս ֆայլով չի փոխվում։'],['Գաղտնաբառերը չեն ներմուծվում։ Նոր օգտատիրոջը փոխանցեք մեկանգամյա հրավերը նրա քարտից։'],['Ստացման վերահսկումը միայն հաճախորդների համար է։ Android և Telegram՝ միայն համապատասխան իրավունքով ադմինիստրատորի համար։'],['Կապերի ձևաչափ՝ [{"brand":"LG","category":"Հեռուստացույց","categoryMatch":"contains"}]։ match արժեքները՝ exact կամ contains։'],['Դատարկ կապերը պահպանում են նախկին կանոնները։ [] արժեքը բացահայտ մաքրում է տվյալ կապերի ցանկը։'],['Ժամանակավորապես անջատելու ամսաթիվը՝ YYYY-MM-DDTHH:mm:ss+04:00։ Մուտքագրեք որպես տեքստ։'],['Նախ դիտեք ստուգման արդյունքը, ապա կիրառեք։ Ներմուծումը դադարեցնում է փոփոխված օգտատերերի աշխատաշրջանները։']];
 const instruction=XLSX.utils.aoa_to_sheet(help);instruction['!cols']=[{wch:125}];XLSX.utils.book_append_sheet(book,instruction,'Ուղեցույց');
 const zip=XLSX.CFB.read(new Uint8Array(XLSX.write(book,{type:'array',bookType:'xlsx'})),{type:'buffer'}),part=XLSX.CFB.find(zip,'/xl/worksheets/sheet1.xml');let body=new TextDecoder().decode(part.content);const validationXml='<dataValidations count="'+validations.length+'">'+validations.join('')+'</dataValidations>';const tail=body.search(/<(?:hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|drawing|legacyDrawing|ignoredErrors|extLst)\b/);const insertAt=tail<0?body.lastIndexOf('</worksheet>'):tail;body=body.slice(0,insertAt)+validationXml+body.slice(insertAt);XLSX.CFB.utils.cfb_add(zip,'/xl/worksheets/sheet1.xml',new TextEncoder().encode(body));return new Uint8Array(XLSX.CFB.write(zip,{type:'buffer',fileType:'zip'}));
}
export function parseUserSheet(rows,{rules,existing=[],actor,scopes=[],channels=[],receipts=[]}={}){
 const headers=rows[0];if(!Array.isArray(headers)||headers[0]!==SHEET_COLUMNS[0][1])return null;
 const mapping=new Map(SHEET_COLUMNS.map(c=>[c[1],c[0]]));if(new Set(headers).size!==headers.length||headers.some(h=>!mapping.has(h)))throw Error('Օգտագործեք նոր ձևանմուշի անփոփոխ վերնագրերը');
 if(!headers.includes('Հաճախորդ'))throw Error('Բացակայում է հաճախորդի սյունակը');
 const categories=categoryChoices(rules),seen=new Set(),result=[];
 for(let rowIndex=1;rowIndex<rows.length;rowIndex++){
  const row=rows[rowIndex];if(!row?.some(v=>v!==''&&v!=null))continue;const p=Object.fromEntries(headers.map((h,i)=>[mapping.get(h),String(row[i]??'').trim()]));
  try{
   const login=p.login?.toLowerCase(),old=existing.find(u=>u.login===login),prior=old?.profile||{};if(actor&&old?.id===actor)throw Error('Ձեր սեփական քարտը խմբագրեք առանձին');
   const pick=(key,options,fallback)=>{if(!p[key])return fallback;if(!Object.hasOwn(options,p[key]))throw Error('Սխալ ընտրություն՝ '+key);return options[p[key]];};
   const boolean=(key,fallback)=>pick(key,{'Այո':true,'Ոչ':false},fallback);
   let sheet=prior.sheet||'Dealers';if(p.sheet){const matches=categories.filter(c=>c.label===p.sheet||c.id===p.sheet);if(matches.length!==1)throw Error('Կատեգորիան չի գտնվել կամ անվանումը կրկնվում է');sheet=matches[0].id;}
   const role=pick('role',{'Հաճախորդ':'client','Ադմինիստրատոր':'admin'},prior.role||'client');
   const raw={...prior,login,client:p.client,role,sheet,brands:p.brands?p.brands.split(',').map(v=>v.trim()).filter(Boolean):prior.brands||[],allBrands:boolean('allBrands',prior.allBrands??sheet==='Dealers'),allowResale:boolean('allowResale',prior.allowResale??false)};
   const hasContacts=headers.some(h=>/^((Կազմակերպություն)|(Հասցե)|(Կոնտակտային անձ)) /.test(h));
   if(hasContacts&&[1,2,3].some(i=>['organization','address','contact'].some(k=>p[k+(i===1?'':i)])))raw.rowsList=[1,2,3].map(i=>Object.fromEntries(['organization','address','contact'].map(k=>[k,p[k+(i===1?'':i)]||''])));else raw.rowsList=(prior.rowsList||[]).map(({id,...value})=>value);
   const pairMatch=pick('match',{'Ճշգրիտ':'exact','Պարունակում է':'contains'},'exact');
   if(p.accessMode||p.include||p.exclude){const access=structuredClone(prior.catalogAccess||{mode:'all',include:[],exclude:[]});access.mode=pick('accessMode',{'Բոլոր ապրանքները':'all','Ընտրված ապրանքները':'selected'},access.mode);for(const key of ['include','exclude'])if(p[key]){let pairs;try{pairs=JSON.parse(p[key]);}catch{throw Error('Կապերը նշեք JSON ձևաչափով');}if(!Array.isArray(pairs))throw Error('Կապերը պետք է լինեն ցանկ');access[key]=pairs.map(r=>({...r,categoryMatch:r.categoryMatch||pairMatch}));}raw.catalogAccess=validateAccess(access);}
   if(p.refresh)raw.ordersRefreshSeconds=Number(p.refresh);
   const {profile}=validateProfile(raw),scope=pick('scope',scopeLabels,scopes.find(s=>s.user_id===old?.id)?.scope??null),active=boolean('active',old?.active??false);
   const channel=channels.find(c=>c.user_id===old?.id),receipt=receipts.find(c=>c.user_id===old?.id);let mobile=boolean('mobile',channel?.mobile_admin_enabled??false),telegram=boolean('telegram',channel?.telegram_enabled??false);
   if(role==='client'&&(p.scope&&scope||p.mobile&&mobile||p.telegram&&telegram||p.refresh||p.telegramId||p.bot))throw Error('Աշխատակցի իրավունքներն ու կապերը միայն ադմինիստրատորի համար են');
   if(role==='client'){mobile=false;telegram=false;}
   if(role==='admin'&&p.receipt)throw Error('Ստացման վերահսկումը միայն հաճախորդների համար է');
   const telegramId=p.telegramId||channel?.telegram_id||null,bot=(p.bot||channel?.telegram_bot_username||'zzws_orders_notify_bot').replace(/^@/,'');
   if(telegramId&&(!/^[1-9][0-9]{0,15}$/.test(telegramId)||BigInt(telegramId)>4503599627370495n))throw Error('Սխալ Telegram ID');
   if(!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(bot)||['botfather','userinfobot'].includes(bot.toLowerCase()))throw Error('Նշեք ZZWS բոտի օգտանունը');
   if((mobile||telegram)&&!['owner','manager','viewer'].includes(scope))throw Error('Ծանուցումների և APK-ի համար անհրաժեշտ է պատվերների դիտման իրավունք');
   if(telegram&&!telegramId)throw Error('Նշեք Telegram ստացողի ID-ն');
   const mode=pick('receipt',{'Ընդհանուր կարգավորում':'inherit','Միացված է':'on','Անջատված է':'off','Ժամանակավորապես անջատված է':'until'},null);let until=null;if(mode==='until'){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+04:00$/.test(p.until||'')||!Number.isFinite(Date.parse(p.until))||Date.parse(p.until)<=Date.now())throw Error('Նշեք ապագա ժամկետը Երևանի ժամով');until=new Date(p.until).toISOString();}
   if(seen.has(login))throw Error('Կրկնվող մուտքանուն');seen.add(login);
   result.push({format:2,login,profile,active,scope:role==='admin'?scope:null,setScope:!!p.scope||prior.role!==role,setChannels:role==='admin'&&!!(p.mobile||p.telegram||p.telegramId||p.bot),channels:{mobile,telegram,telegramId,bot},receipt:mode?{mode,until}:null,expectedUserId:old?.id||null,expectedProfileRevision:old?.profile_revision||null,expectedScope:scopes.find(s=>s.user_id===old?.id)?.scope??null,expectedChannelRevision:channel?.revision??0,expectedReceiptRevision:receipt?.revision??null,action:old?'update':'create'});
  }catch(e){throw Error('Տող '+(rowIndex+1)+'․ '+e.message);}
 }
 if(!result.length||result.length>1000)throw Error('Թույլատրվում է 1-ից 1000 օգտատեր');
 if(result.filter(u=>u.channels.telegram&&u.profile.role==='admin'&&u.active).length>1)throw Error('Թույլատրվում է միայն մեկ Telegram ստացող');return result;
}

