(() => {
  const sections=['cart','favorites','history','filters','preferences','draft'];
  const suffix={cart:'cart',favorites:'favs',history:'history',filters:'filters'};
  const fields=['organizationSelect','deliveryMethodInput','deliveryDateInput','deliveryAddressInput','contactPersonInput','orderCommentInput'];
  let owner=null,versions={},baseline={},pending={},timer=null,busy=false,ready=false,pollAt=0,suspended=false,clearedUntil=0;
  const copy=v=>JSON.parse(JSON.stringify(v));
  const key=()=>`zzws_pending_${owner}`;
  const cache=(section,fallback)=>{try{return JSON.parse(localStorage.getItem('zigzag_'+suffix[section]+'_'+userStorageId())||JSON.stringify(fallback));}catch{return fallback;}};
  const banner=(message,error=false)=>{let box=document.getElementById('memoryStatus');if(!box){box=document.createElement('p');box.id='memoryStatus';box.setAttribute('role','status');document.getElementById('welcomeMsg').after(box);}box.textContent=message;box.classList.toggle('sync-error',error);};
  const persist=()=>{if(!owner)return;try{localStorage.setItem(key(),JSON.stringify(pending));}catch{banner('Չհաջողվեց պահպանել տեղային պատճենը։ Մի փակեք էջը մինչև համաժամացումը։',true);}};
  function read(){
    const draft={};for(const id of fields)draft[id]=document.getElementById(id)?.value||'';
    return {cart:copy(cart),favorites:[...favoritesSet],history:cache('history',[]),filters:cache('filters',{}),preferences:{theme:localStorage.getItem('zigzag_theme')||'light',filtersOpen:localStorage.getItem('zigzag_filters_open_'+userStorageId())||'false',priceMode:adminOrderPriceMode},draft};
  }
  function apply(section,value,render=true){
    value=value??(['favorites','history'].includes(section)?[]:{});
    if(suffix[section])localStorage.setItem('zigzag_'+suffix[section]+'_'+userStorageId(),JSON.stringify(value));
    if(section==='cart'){cart=normalizeCart(value);if(render&&catalogLoaded){reconcileCart();updateOrderPanel();refreshAllActions();if(!document.getElementById('orderModal').classList.contains('hidden')){renderModalItems();savedList();}}}
    if(section==='favorites'){favoritesSet=new Set(value);if(render&&catalogLoaded)resetAndRender();}
    if(section==='filters'&&render&&catalogLoaded){
      for(const id of ['searchInput','brandInput','categoryInput'])document.getElementById(id).value='';
      selectedBrands=[];selectedCategories=[];
      document.getElementById('sortBy').value='default';document.getElementById('sortPrice').value='wholesale';
      for(const id of ['favOnlyFilter','promoOnlyFilter','stockOnlyFilter','wholesaleOnlyFilter'])document.getElementById(id).checked=false;
      loadSavedFilters();resetAndRender();
    }
    if(section==='history'&&render)renderOrderHistoryList();
    if(section==='preferences'){
      const theme=value.theme==='dark'?'dark':'light';localStorage.setItem('zigzag_theme',theme);document.documentElement.classList.toggle('dark',theme==='dark');
      localStorage.setItem('zigzag_filters_open_'+userStorageId(),value.filtersOpen||'false');
      if(render)toggleMobileFilters(value.filtersOpen==='1');
      adminOrderPriceMode=value.priceMode==='KP'&&isAdminUser()?'KP':'WS';localStorage.setItem('zigzag_admin_price_mode_'+userStorageId(),adminOrderPriceMode);
    }
    if(section==='draft'){for(const id of fields){const el=document.getElementById(id);if(el)el.value=Object.hasOwn(value,id)?value[id]:id==='organizationSelect'?'0':id==='deliveryMethodInput'?'Առաքում':'';}handleDeliveryMethodChange();checkDeliveryBadge();}
  }
  function capture(){
    if(!ready||suspended||!serverIdentity||owner!==serverIdentity.id)return;
    const values=read();
    for(const section of sections){
      if(JSON.stringify(values[section])===JSON.stringify(baseline[section]))continue;
      const version=pending[section]?.version??versions[section]??0;
      pending[section]={value:copy(values[section]),version};baseline[section]=copy(values[section]);
    }persist();
  }
  async function flush(){
    if(busy||!ready||!serverIdentity||owner!==serverIdentity.id)return;
    capture();busy=true;const activeOwner=owner;
    try{
      for(const section of sections){
        if(!pending[section])continue;
        const item=copy(pending[section]);
        try{
          const result=await ZZWS.json('me/state',{method:'POST',body:JSON.stringify({section,...item})});
          if(owner!==activeOwner)return;
          versions[section]=result.version;
          if(JSON.stringify(pending[section]?.value)===JSON.stringify(item.value))delete pending[section];
          else if(pending[section])pending[section].version=result.version;
        }catch(e){
          if(e.status===409){
            if(e.data.cleared){delete pending[section];versions[section]=e.data.version;suspended=true;apply(section,e.data.value);baseline[section]=read()[section];suspended=false;clearedUntil=Date.now()+30000;persist();continue;}
            const label={cart:'զամբյուղ',favorites:'ընտրվածներ',history:'պատմություն',filters:'ֆիլտրեր',preferences:'կարգավորումներ',draft:'պատվերի տվյալներ'}[section];
            suspended=true;
            const keep=confirm('Այլ սարքում փոփոխվել են՝ '+label+'։ Լավ՝ այս սարքի տվյալներով փոխարինել սերվերի տվյալները։ Չեղարկել՝ բեռնել սերվերի տվյալները։');
            if(keep)pending[section].version=e.data.version;
            else{delete pending[section];versions[section]=e.data.version;apply(section,e.data.value);baseline[section]=read()[section];}
            suspended=false;
          }else throw e;
        }persist();
      }
      banner(Object.keys(pending).length?'Փոփոխությունները համաժամացվում են…':clearedUntil>Date.now()?'Ադմինիստրատորը մաքրել է տվյալները։ Դրանք թարմացվել են այս սարքում':'Տվյալները պահպանվել են սերվերում');
      if(!Object.keys(pending).length&&Date.now()-pollAt>15000&&!document.hidden){
        pollAt=Date.now();const state=await ZZWS.json('me/state');capture();
        if(owner!==activeOwner)return;
        suspended=true;
        for(const section of sections){if(!pending[section]&&(state.versions[section]||0)!==(versions[section]||0)){apply(section,state.data[section]);versions[section]=state.versions[section]||0;baseline[section]=read()[section];}}
        suspended=false;
      }
    }catch(e){banner('Փոփոխությունները սպասում են սերվեր ուղարկելուն՝ '+e.message,true);}
    finally{busy=false;suspended=false;if(owner===activeOwner)persist();}
  }
  async function start(user){
    stop();owner=user.id;
    const state=await ZZWS.json('me/state');versions=state.versions||{};
    try{pending=JSON.parse(localStorage.getItem(key())||'{}');}catch{pending={};}
    for(const id of fields){const el=document.getElementById(id);if(el)el.value='';}
    populateOrderModalFields();modalFieldsInitialized=true;
    for(const section of sections){
      let value=state.data[section]??(['favorites','history'].includes(section)?[]:{});
      if(pending[section])value=pending[section].value;
      apply(section,value,false);
    }
    baseline=read();ready=true;pollAt=Date.now();timer=setInterval(flush,1200);persist();
  }
  function stop(){ready=false;if(timer)clearInterval(timer);timer=null;owner=null;pending={};versions={};baseline={};}
  async function savedList(){
    const root=document.getElementById('savedCartsList');if(!root)return;
    try{const data=await ZZWS.json('me/carts');root.replaceChildren();
      document.getElementById('savedCartsCount').textContent=`${data.carts.length} / 10`;
      if(!data.carts.length){const empty=document.createElement('p');empty.className='saved-empty';empty.textContent='Պահպանված զամբյուղներ դեռ չկան։ Ավելացրեք ապրանքներ և պահպանեք առաջին տարբերակը։';root.append(empty);}
      for(const row of data.carts){
        const box=document.createElement('article'),info=document.createElement('div'),title=document.createElement('h5'),meta=document.createElement('p'),actions=document.createElement('div');
        box.className='saved-cart-card';info.className='saved-cart-info';actions.className='saved-cart-actions';title.textContent=row.title;
        const count=Object.values(row.cart).reduce((n,item)=>n+(Number(item.qty)||0),0);
        meta.textContent=new Intl.DateTimeFormat('hy-AM',{timeZone:'Asia/Yerevan',dateStyle:'medium',timeStyle:'short'}).format(new Date(row.saved_at))+' · '+Object.keys(row.cart).length+' դիրք · '+count+' հատ';
        info.append(title,meta);box.append(info,actions);
        for(const [text,action] of [['Բեռնել',async()=>{if(Object.keys(cart).length&&!confirm('Ընթացիկ զամբյուղը փոխարինե՞լ պահպանվածով։'))return;apply('cart',row.cart);apply('draft',row.draft);capture();await flush();renderModalItems();document.getElementById('savedCartsPanel').open=false;}],['Ջնջել',async()=>{if(!confirm('Ջնջե՞լ «'+row.title+'»?'))return;await ZZWS.json('me/carts/delete',{method:'POST',body:JSON.stringify({id:row.id})});await savedList();}]]){const b=document.createElement('button');b.type='button';b.textContent=text;b.className=text==='Ջնջել'?'saved-delete':'saved-secondary';b.setAttribute('aria-label',text+' « զամբյուղը՝'+row.title+'»');b.onclick=()=>action().catch(e=>alert(e.message));actions.append(b);}root.append(box);}
    }catch(e){root.textContent=e.message;}
  }
  async function saveNamed(){
    const input=document.getElementById('savedCartTitle'),payload={title:input.value.trim(),cart:copy(cart),draft:read().draft,requestId:crypto.randomUUID()};
    try{let result;
      try{result=await ZZWS.json('me/carts',{method:'POST',body:JSON.stringify(payload)});}
      catch(e){if(e.status!==409||!e.data.limit)throw e;const oldest=e.data.oldest;
        if(!confirm('Արդեն պահպանված է 10 զամբյուղ։ Փոխարինե՞լ ամենահինը՝ «'+oldest.title+'», ամսաթիվ՝ '+new Date(oldest.saved_at).toLocaleString('hy-AM')+'?'))return;
        result=await ZZWS.json('me/carts',{method:'POST',body:JSON.stringify({...payload,replace:oldest.id})});
      }
      input.value='';await savedList();alert(result.replaced?'Զամբյուղը պահպանվել է։ Ամենահին զամբյուղը փոխարինվել է։':'Զամբյուղը պահպանվել է սերվերում։');
    }catch(e){alert(e.data?.limit?'Զամբյուղների ցանկը փոխվել է այլ սարքում։ Թարմացրեք ցանկը և կրկնեք պահպանումը։':e.message);}
  }
  window.ZZWS_MEMORY={start,stop,capture,flush,savedList,saveNamed,restoreDraft:()=>{if(ready)apply('draft',baseline.draft,false);}};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){capture();flush();}});
  window.addEventListener('focus',()=>{pollAt=0;flush();});
  window.addEventListener('beforeunload',e=>{capture();if(Object.keys(pending).length){e.preventDefault();e.returnValue='';}});
})();
