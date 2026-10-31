(() => {
 const labels={search:'Ապրանքի որոնում',brand:'Բրենդ',category:'Կատեգորիա',favorites:'Միայն ընտրվածները',promo:'Միայն ակցիաները',stock:'Միայն առկա ապրանքները',wholesale:'Միայն մեծածախ գնով',sorting:'Դասավորում',popular:'«Հաճախ են գնում» նշում',personalPopular:'«Դուք հաճախ եք գնում» նշում'};
 const technical={type:'Տեխնիկայի տեսակ',widthMax:'Լայնություն',heightMax:'Բարձրություն',depthMax:'Խորություն',installation:'Տեղադրման տեսակ',capacityMin:'Տարողություն (կգ)',volumeMin:'Ծավալ (լ)',placeSettingsMin:'Սպասքի հավաքածու',spinMin:'Քամում',diagonalMin:'Անկյունագիծ',drying:'Չորացում',inverter:'Ինվերտոր',noFrost:'No Frost',resolution:'Թույլատրելիություն',screen:'Էկրանի տեսակ',energy:'Էներգախնայողության դաս',connection:'Միացման տեսակ'};
 for(const [key,label] of Object.entries(technical))labels['tech_'+key]=label;
 let config={},revision=null,loading=false,generation=0,lookupGeneration=0,modelData=null;
 const el=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const defaults={days:90,orders:5,customers:3,personalOrders:3};
 const rulesForm=node('form'),rulesFields=node('div'),rulesSave=node('button','Պահպանել հաշվարկի կանոնները');rulesForm.id='popularityRulesForm';rulesFields.id='popularityRulesFields';rulesForm.append(node('h2','Ինքնաշխատ հաշվարկ'),node('p','Հաշվարկը թարմացվում է պատվերների հիման վրա։ Կանոնները ընդհանուր են բոլոր օգտատերերի համար։'),rulesFields,rulesSave);
 const ruleLabels={days:'Հաշվարկի ժամանակահատվածը՝ օր',orders:'Ընդհանուր՝ պատվերների նվազագույն թիվ',customers:'Ընդհանուր՝ տարբեր հաճախորդների նվազագույն թիվ',personalOrders:'Անհատական՝ պատվերների նվազագույն թիվ'};
 function numberInput(label,key,parent){const row=node('label',label),input=node('input');input.type='number';input.step='1';input.min='0';input.max='1000000';input.required=true;input.dataset.popularityCount=key;row.append(input);parent.append(row);return input;}
 for(const [key,label] of Object.entries(ruleLabels)){const input=numberInput(label,key,rulesFields);input.min='1';input.max=key==='days'?'365':'1000';}
 const modelRoot=node('fieldset'),lookup=node('form'),skuLabel=node('label','Ապրանքի ճշգրիտ արտիկուլը'),sku=node('input'),find=node('button','Ցույց տալ հաշվարկը'),stats=node('p'),edit=node('form'),editFields=node('div'),saveEdit=node('button','Պահպանել ձեռքով ճշգրտումը'),auto=node('button','Վերադարձնել ինքնաշխատ հաշվարկը');
 lookup.id='popularityModelForm';edit.id='popularityEditForm';sku.id='popularitySku';sku.required=true;sku.maxLength=100;sku.autocomplete='off';skuLabel.append(sku);lookup.append(skuLabel,find);stats.id='popularityStats';stats.setAttribute('role','status');auto.type='button';editFields.id='popularityEditFields';edit.append(editFields,saveEdit,auto);modelRoot.append(node('legend','Մոդելի գնումների ցուցանիշներ'),node('p','Վերևում ընտրեք «Բոլոր օգտատերերի համար» կամ կոնկրետ օգտատիրոջը։ Ձեռքով ճշգրտումը պահպանվում է առանձին և չի փոխում պատվերների պատմությունը։'),lookup,stats,edit);el('catalogControls').append(rulesForm,modelRoot);
 function resetModel(){lookupGeneration++;modelData=null;stats.textContent='';editFields.replaceChildren();saveEdit.disabled=true;auto.disabled=true;}
 sku.oninput=()=>resetModel();
 function renderRules(){for(const input of rulesFields.querySelectorAll('input'))input.value=config.popularityRules?.[input.dataset.popularityCount]??defaults[input.dataset.popularityCount];}
 const accountLabel=el('catalogControlsTarget').closest('label'),accountOptions=node('details'),accountSummary=node('summary','Ընդհանուր կարգավորումներ · անհատական բացառություններ');accountOptions.id='catalogAccountOptions';accountLabel.before(accountOptions);accountOptions.append(accountSummary,accountLabel);
 const correctionOptions=node('details'),correctionSummary=node('summary','Գնումների հաշվարկի առաջադեմ կարգավորումներ');correctionOptions.id='popularityAdvanced';modelRoot.before(correctionOptions);correctionOptions.append(correctionSummary,rulesForm,modelRoot);
 function render(){
  const target=el('catalogControlsTarget').value,values=target==='global'?config.global:config.users?.[target],root=el('catalogControlFields');root.replaceChildren();
  const techOptions=node('details'),techSummary=node('summary','Տեխնիկական ֆիլտրեր'),techFields=node('div');techOptions.id='technicalControlOptions';techFields.className='technical-control-fields';techOptions.append(techSummary,techFields);
  for(const [key,label] of Object.entries(labels)){
   const row=node('label',label),select=node('select');select.dataset.control=key;
   const options=target==='global'?[['true','Միացված'],['false','Անջատված']]:[['inherit','Բոլորի կարգավորմամբ՝ '+((config.global?.[key]??true)?'միացված':'անջատված')],['true','Միացված'],['false','Անջատված']];
   for(const [value,text] of options){const o=node('option',text);o.value=value;select.append(o);}select.value=values?.[key]===undefined?(target==='global'?'true':'inherit'):String(values[key]);row.append(select);(key.startsWith('tech_')?techFields:root).append(row);
  }
  root.append(techOptions);accountSummary.textContent=target==='global'?'Ընդհանուր կարգավորումներ · անհատական բացառություններ':'Անհատական՝ '+(el('catalogControlsTarget').selectedOptions[0]?.textContent||'');
  renderRules();resetModel();
 }
 function busy(value){loading=value;for(const input of el('catalogControls').querySelectorAll('button,select,input'))input.disabled=value;saveEdit.disabled=value||!modelData;auto.disabled=value||!modelData;}
 async function savePopularity(payload){
  if(loading||!revision)return;const ticket=generation;busy(true);
  try{const data=await api('admin/catalog-controls',{method:'POST',body:JSON.stringify({...payload,revision})});if(ticket!==generation)return;config=data.config;revision=data.revision;render();status('Գնումների հաշվարկի կարգավորումները պահպանված են։');}finally{if(ticket===generation)busy(false);}
 }
 rulesForm.onsubmit=e=>{e.preventDefault();const rules={};for(const input of rulesFields.querySelectorAll('input'))rules[input.dataset.popularityCount]=Number(input.value);run(()=>savePopularity({kind:'popularityRules',rules}));};
 lookup.onsubmit=e=>{e.preventDefault();if(loading||!revision)return;run(async()=>{
  const target=el('catalogControlsTarget').value,articul=sku.value.trim(),ticket=generation,look=++lookupGeneration;busy(true);modelData=null;stats.textContent='Հաշվարկը բեռնվում է…';
  try{
   const data=await api('admin/catalog-controls?'+new URLSearchParams({target,articul}));if(ticket!==generation||look!==lookupGeneration)return;
   if(data.revision!==revision)throw new Error('Կարգավորումները փոխվել են։ Սեղմեք «Թարմացնել պահպանվածը»։');
   modelData=data;const keys=target==='global'?['orders','customers']:['personal_orders'],override=target==='global'?data.global:data.personal;
   const names={orders:'Պատվերների թիվ',customers:'Տարբեր հաճախորդների թիվ',personal_orders:'Այս օգտատիրոջ պատվերների թիվ'};
   stats.textContent='Արտիկուլ՝ '+data.articul+'. Ինքնաշխատ՝ '+keys.map(k=>names[k]+'՝ '+data.calculated[k]).join(' · ')+'. '+(override?'Ճշգրտմամբ՝ '+keys.map(k=>data.effective[k]).join(' / ')+' · մինչև '+new Date(override.expiresAt).toLocaleDateString('hy-AM'):'Գործում է ինքնաշխատ հաշվարկը։');
   editFields.replaceChildren();for(const key of keys){const input=numberInput(names[key]+' · ավելացնել (+) / հանել (−)',key,editFields);input.min='-1000000';input.value=override?.[key]??0;}
   const days=numberInput('Գործողության ժամկետը՝ օր','days',editFields);days.min='1';days.max='365';days.value=override?Math.max(1,Math.ceil((Date.parse(override.expiresAt)-Date.now())/86400000)):30;
   const reasonLabel=node('label','Ճշգրտման պատճառը'),reason=node('input');reason.id='popularityEditReason';reason.required=true;reason.minLength=3;reason.maxLength=300;reason.value=override?.reason||'';reasonLabel.append(reason);editFields.append(reasonLabel,node('p','Սա ժամկետային գումարում կամ հանում է։ Նոր գնումները շարունակում են ավելանալ ինքնաշխատ։ Պատվերների պատմությունը չի փոփոխվում։'));
  }catch(e){if(ticket===generation&&look===lookupGeneration){stats.textContent='Չհաջողվեց ստանալ հաշվարկը։';editFields.replaceChildren();}throw e;}finally{if(ticket===generation)busy(false);}
 });};
 edit.onsubmit=e=>{e.preventDefault();if(!modelData||loading)return;const value={reason:el('popularityEditReason').value};for(const input of editFields.querySelectorAll('input[data-popularity-count]'))value[input.dataset.popularityCount]=Number(input.value);run(()=>savePopularity({kind:'popularityEdit',target:modelData.target,articul:modelData.articul,value}));};
 auto.onclick=()=>{if(modelData&&!loading)run(()=>savePopularity({kind:'popularityEdit',target:modelData.target,articul:modelData.articul,value:null}));};
 async function load(){
  if(loading)return;const ticket=generation;busy(true);
  try{
   const [data,result]=await Promise.all([api('admin/catalog-controls'),api('admin/users')]);if(ticket!==generation)return;config=data.config||{};revision=data.revision;
   const target=el('catalogControlsTarget'),previous=target.value;target.replaceChildren();const all=node('option','Բոլոր օգտատերերի համար');all.value='global';target.append(all);
   for(const user of result.users){const option=node('option',(user.client||user.login)+' — '+user.login);option.value=user.id;target.append(option);}target.value=[...target.options].some(o=>o.value===previous)?previous:'global';render();
  }finally{if(ticket===generation)busy(false);}
 }
 el('catalogControlsTarget').onchange=render;
 el('catalogControlsReload').onclick=()=>run(load);
 el('catalogControlsForm').onsubmit=e=>{e.preventDefault();if(loading||!revision)return;run(async()=>{
  const controls={};for(const s of el('catalogControlFields').querySelectorAll('select'))if(s.value!=='inherit')controls[s.dataset.control]=s.value==='true';
  const target=el('catalogControlsTarget').value,ticket=generation;busy(true);
  try{const data=await api('admin/catalog-controls',{method:'POST',body:JSON.stringify({target,controls,revision})});if(ticket!==generation)return;config=data.config;revision=data.revision;render();status('Կարգավորումները պահպանված են։ Բաց կատալոգները կթարմացվեն հաջորդ ստուգման ժամանակ։');}finally{if(ticket===generation)busy(false);}
 });};
 window.ZZWS_ADMIN_CATALOG_CONTROLS={load,reset(){generation++;config={};revision=null;resetModel();rulesForm.reset();sku.value='';el('catalogControlFields').replaceChildren();el('catalogControlsTarget').replaceChildren();busy(false);}};
})();
