/* DOM-based editors: customer-controlled names are never interpolated into HTML. */
(() => {
  let nextId=0;const localizedCategories=new WeakMap();window.addEventListener('zzws:languagechange',()=>{for(const input of document.querySelectorAll('[data-rule-field=category]'))localizedCategories.get(input)?.();});
  const normalized=v=>String(v||'').normalize('NFKC').toLowerCase().trim();
  const node=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
  const option=(value,text)=>{const n=node('option',text);n.value=value;return n;};
  const label=(text,control)=>{const n=node('label');n.append(node('span',text),control);return n;};
  const button=(text,fn)=>{const n=node('button',text);n.type='button';n.onclick=fn;return n;};
  const unique=values=>[...new Set(values)].sort((a,b)=>a.localeCompare(b,'ru'));
  function accessEditor(root,initial,pairs){
    let include=[],exclude=[];
    const all=node('input');all.type='checkbox';all.dataset.accessAll='';
    const includes=node('div',null,'pair-list'),excludes=node('div',null,'pair-list'),includeArea=node('div');
    function row(value,kind){
      const wrap=node('div',null,'pair-row');wrap.dataset.pairKind=kind;
      const brand=node('input'),category=node('input'),match=node('select');
      brand.value=value.brand||'';category.value=ZZWS_I18N.t(value.category||'');const canonicalCategories=[...new Set(pairs.map(p=>p.category))];let canonicalCategory=value.category||'',lastDisplay=category.value;const readCategory=()=>category.value===lastDisplay?canonicalCategory:ZZWS_I18N.canonical(category.value,canonicalCategories);localizedCategories.set(category,()=>{canonicalCategory=readCategory();category.value=ZZWS_I18N.t(canonicalCategory);lastDisplay=category.value;refresh();});
      brand.placeholder='Ցանկացած բրենդ';category.placeholder='Ցանկացած կատեգորիա';
      brand.dataset.ruleField='brand';category.dataset.ruleField='category';match.dataset.ruleField='match';
      match.append(option('exact','Ճշգրիտ կատեգորիա'),option('contains','Անվանումը պարունակում է'));
      match.value=value.categoryMatch||'exact';
      const id='rule-options-'+(++nextId),brands=node('datalist'),categories=node('datalist');brands.id=id+'-brands';categories.id=id+'-categories';
      brand.setAttribute('list',brands.id);category.setAttribute('list',categories.id);
      const hint=node('small',null,'pair-hint');
      function refresh(){
        const b=normalized(brand.value),c=normalized(readCategory());
        const hasCategory=p=>!c||(match.value==='contains'?normalized(p.category).includes(c):normalized(p.category)===c);
        brands.replaceChildren(...unique(pairs.filter(hasCategory).map(p=>p.brand)).map(b=>option(b,b)));
        categories.replaceChildren(...unique(pairs.filter(p=>!b||normalized(p.brand)===b).map(p=>p.category)).map(c=>option(ZZWS_I18N.t(c),ZZWS_I18N.t(c))));
        const exists=pairs.some(p=>(!b||normalized(p.brand)===b)&&hasCategory(p));
        hint.textContent=(!b&&!c)?'Ընտրեք բրենդը կամ կատեգորիան։':exists?'':'Գործող գնացուցակում նման կապ չկա։ Կանոնը կպահպանվի ապագա ապրանքների համար։';
      }
      brand.oninput=category.oninput=match.onchange=refresh;
      const item={element:wrap,read:()=>{
        const b=brand.value.trim(),c=readCategory().trim();
        if(!b&&!c)throw new Error('Յուրաքանչյուր ավելացված կապում լրացրեք բրենդը կամ կատեգորիան կամ ջնջեք դատարկ տողը։');
        return {brand:b,category:c,categoryMatch:match.value};
      }};
      wrap.append(label('Բրենդ',brand),label('Կատեգորիա',category),label('Կատեգորիայի համեմատում',match),button('Ջնջել',()=>{
        if(kind==='include')include=include.filter(r=>r!==item);else exclude=exclude.filter(r=>r!==item);wrap.remove();
      }),brands,categories,hint);refresh();return item;
    }
    function add(kind,value={}){const item=row(value,kind);if(kind==='include'){include.push(item);includes.append(item.element);}else{exclude.push(item);excludes.append(item.element);}}
    root.replaceChildren();root.classList.add('access-editor');
    const explanation=node('p','Տողում բրենդն ու կատեգորիան պետք է համապատասխանեն միասին։ Տողերի միջև գործում է «կամ» պայմանը։ Դատարկ դաշտը նշանակում է ցանկացած բրենդ կամ կատեգորիա։ Բացառությունը միշտ գերակայում է թույլտվությանը։','help');
    includeArea.append(node('h4','Թույլատրված կապեր'),node('p','Թույլտվությունների դատարկ ցանկը նշանակում է հասանելիության բացակայություն։','help'),includes,button('+ Թույլատրել կապ',()=>add('include')));
    root.append(explanation,label('Ցուցադրել բոլոր բրենդներն ու կատեգորիաները',all),includeArea,node('h4','Բացառություններ'),excludes,button('+ Բացառել կապ',()=>add('exclude')));
    all.onchange=()=>{includeArea.hidden=all.checked;root.dispatchEvent(new Event('rules-change'));};
    function reset(value){
      include=[];exclude=[];includes.replaceChildren();excludes.replaceChildren();all.checked=value.mode==='all';includeArea.hidden=all.checked;
      (value.include||[]).forEach(r=>add('include',r));(value.exclude||[]).forEach(r=>add('exclude',r));
    }
    reset(initial);
    return {read:()=>({mode:all.checked?'all':'selected',include:all.checked?[]:include.map(r=>r.read()),exclude:exclude.map(r=>r.read())}),reset};
  }
  const sourceLabels={ws:'Մեծածախ գին (դրամ)',kp:'Խոշոր գործընկերոջ գին (դրամ)',kpPromo:'Խոշոր գործընկերոջ ակցիոն գին (դրամ)',retail:'Զեղչված մանրածախ գին',base:'Հիմնական մանրածախ գին'};
  function pricingEditor(root,initial){
    let rows=[];
    const mode=node('select');mode.dataset.pricingField='mode';
    mode.append(option('first','Առաջին դրականը՝ ըստ հերթականության'),option('min','Նվազագույն դրականը'),option('max','Առավելագույն դրականը'));
    const sources=node('div',null,'price-sources'),adjustment=node('input'),round=node('select'),ceiling=node('input');
    adjustment.type='number';adjustment.min='-90';adjustment.max='1000';adjustment.step='0.01';adjustment.dataset.pricingField='adjustment';
    round.dataset.pricingField='round';for(const [v,text] of [[0,'Առանց կլորացման'],[1,'Մինչև 1 դրամ'],[10,'Մինչև 10 դրամ'],[100,'Մինչև 100 դրամ']])round.append(option(String(v),text));
    ceiling.type='checkbox';ceiling.dataset.pricingField='ceiling';
    function render(){
      sources.replaceChildren();rows.forEach((source,index)=>{
        const line=node('div',null,'price-source'),select=node('select');select.dataset.priceSource='';
        for(const [v,text] of Object.entries(sourceLabels))select.append(option(v,text));select.value=source;select.onchange=()=>{rows[index]=select.value;};
        const up=button('↑',()=>{[rows[index-1],rows[index]]=[rows[index],rows[index-1]];render();});up.disabled=index===0;up.setAttribute('aria-label','Բարձրացնել առաջնահերթությունը');
        const down=button('↓',()=>{[rows[index+1],rows[index]]=[rows[index],rows[index+1]];render();});down.disabled=index===rows.length-1;down.setAttribute('aria-label','Նվազեցնել առաջնահերթությունը');
        line.append(node('span',String(index+1)+'.'),select,up,down,button('Ջնջել',()=>{rows.splice(index,1);render();}));sources.append(line);
      });
    }
    root.replaceChildren(label('Ինչպես ընտրել գինը',mode),node('p','Զրոյական և դատարկ գները բաց են թողնվում։ «Առաջին» ռեժիմում կարևոր է սյունակների հերթականությունը։ Եթե համապատասխան գին չկա, ապրանքը չի ցուցադրվում։','help'),sources,
      button('+ Ավելացնել սյունակ',()=>{const next=Object.keys(sourceLabels).find(s=>!rows.includes(s));if(next){rows.push(next);render();}}),
      label('Ընտրված գնի ճշգրտում, %',adjustment),label('Կլորացում՝ ճշգրտումից հետո',round),label('Թաքցնել ապրանքը, եթե հաճախորդի գինը բարձր է մանրածախից',ceiling));
    function reset(p){rows=[...p.sources];mode.value=p.mode;adjustment.value=p.adjustmentPercent;round.value=String(p.roundTo);ceiling.checked=p.hideAboveRetail;render();}
    reset(initial);
    return {read:()=>({sources:[...rows],mode:mode.value,adjustmentPercent:Number(adjustment.value),roundTo:Number(round.value),hideAboveRetail:ceiling.checked}),reset};
  }
  function legacyAccess(user={}){
    if(user.catalogAccess)return structuredClone(user.catalogAccess);
    return {mode:user.sheet==='KP'&&!user.allBrands?'selected':'all',include:(user.sheet==='KP'?(user.brands||[]):[]).map(brand=>({brand,category:'',categoryMatch:'exact'})),exclude:[]};
  }
  window.ZZWS_RULES_UI={accessEditor,pricingEditor,legacyAccess};
})();
