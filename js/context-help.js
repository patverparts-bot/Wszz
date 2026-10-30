(() => {
 const admin=location.pathname.includes('/admin/'),base=admin?'../help/admin-guide.html':'help/user-guide.html';
 const topics={
  receipt:['#pendingReceiptOnly','.confirm-receipt-button'],
  'admin-receipt':['#receiptGlobalPanel legend','#clientReceiptControlPanel legend'],
  'receipt-notices':['#adminReceiptNotices h2'],'client-category':['#clientCategory','#clientPriceSequence'],
  backup:['#backupHelp'],login:['#loginHelp','#loginForm'],bootstrap:['#setupForm'],
  search:['#searchInput'],filters:['#brandInput','#categoryInput','#compactFiltersRow .compact-filters-label'],
  sort:['.catalog-columns','#mobileColumnSort'],favorites:['#favOnlyFilter'],bulk:['#bulkAddInput'],cart:['#modalItemsList'],
  'saved-carts':['#saveCartForm'],delivery:['#organizationSelect','#deliveryMethodInput'],submit:['#submitServerOrder'],
  orders:['#serverOrdersList'],notifications:['.header-notifications'],bulletins:['#catalogBulletinsButton'],sync:['#memoryStatus'],
  'admin-dashboard':['#dashboard h1'],'admin-orders':['#orders h1'],confirmation:['#confirmationPaste','#finalOrderFile'],
  'admin-price':['#priceForm'],'admin-users':['#newUser','#usersImportForm'],'admin-rules':['#groupRulesForm','#userAccessEditor'],
  mfa:['#activateMfa'],'admin-security':['#adminScopePanel legend'],'admin-storage':['#storage h1'],'admin-audit':['#audit h1'],
  'user-sessions':['#userForm .user-card-actions'],'user-emails':['#userEmailSettings legend'],
  channels:['#adminChannelsPanel legend'],resources:['details[data-resource-instructions]','[data-resource="apk"]','[data-resource="telegram"] h4'],
  'invitation-email':['#invitationEmailPanel legend'],'report-email':['.report-email-dialog h2'],
  'email-settings':['#email h1'],offers:['#offers h1'],'apk-publish':['#apkUploadPanel legend']
 };
 const labels={receipt:'Ապրանքների ստացման հաստատում','admin-receipt':'Ստացման վերահսկում և բացառություններ','receipt-notices':'Ստացման հաստատումների դիտում','client-category':'Հաճախորդի կատեգորիա',backup:'Պահուստային պատճեններ',login:'Մուտք և առաջին ակտիվացում',bootstrap:'Սկզբնական սեփականատիրոջ կարգավորում',search:'Ապրանքների որոնում',filters:'Ֆիլտրեր',sort:'Սյունակներ և դասավորում',favorites:'Ընտրվածներ և նկարներ',bulk:'Ավելացնել ցանկով',cart:'Զամբյուղ', 'saved-carts':'Պահպանված զամբյուղներ',delivery:'Առաքման տվյալներ',submit:'Պատվերի ուղարկում',orders:'Իմ պատվերները',notifications:'Պատվերների փոփոխություններ',bulletins:'Գներ և առաջարկներ',sync:'Համաժամացում','admin-dashboard':'Աշխատանքային սեղան','admin-orders':'Պատվերների մշակում',confirmation:'Վերջնական աղյուսակ','admin-price':'Գնացուցակ','admin-users':'Օգտատերեր','admin-rules':'Գների և հասանելիության կանոններ',mfa:'Երկփուլ պաշտպանություն','admin-security':'Աշխատակիցների իրավունքներ','admin-storage':'Տվյալների մաքրում','admin-audit':'Գործողությունների մատյան','user-sessions':'Պահպանում և աշխատաշրջաններ','user-emails':'Քարտի էլ․ փոստ',channels:'Android և Telegram',resources:'Հավելված և Telegram','invitation-email':'Հրավերի ուղարկում','report-email':'Հաշվետվության ուղարկում','email-settings':'Փոստի ընդհանուր կարգավորումներ',offers:'Հատուկ առաջարկներ','assisted-order':'Պատվեր հաճախորդի անունից','apk-publish':'Android հավելվածի թարմացում'};
 const permissionByTopic={'apk-publish':'users','assisted-order':'orders:write','admin-dashboard':null,'admin-orders':'orders:read',confirmation:'orders:write','admin-price':'price:read','admin-users':'users','admin-rules':'rules',mfa:null,'admin-security':'users','admin-storage':'storage','admin-audit':'audit',backup:null,'admin-receipt':'users','receipt-notices':'orders:read','client-category':'users','user-sessions':'users','user-emails':'users',channels:'users',resources:null,'invitation-email':'users','report-email':'orders:write','email-settings':'users',offers:'price:write'};
 function allowed(topic){if(!Object.hasOwn(labels,topic))return false;if(!Object.hasOwn(permissionByTopic,topic))return true;const user=window.ZZWS_HELP_USER;return user?.role==='admin'&&!!user.adminScope&&(!permissionByTopic[topic]||user.permissions?.includes(permissionByTopic[topic]));}
 const guideFor=topic=>Object.hasOwn(permissionByTopic,topic)?(admin?'../help/admin-guide.html':'help/admin-guide.html'):base;
 async function openTopic(topic){
  if(!allowed(topic))return false;
  const who=window.ZZWS_HELP_USER,dialog=document.createElement('dialog');document.getElementById('contextGuideDialog')?.remove();dialog.id='contextGuideDialog';dialog.className='zzws-context-guide';dialog.setAttribute('aria-label',labels[topic]);
  const close=document.createElement('button');close.type='button';close.textContent='Փակել';close.onclick=()=>{dialog.close();dialog.remove();};const root=document.createElement('div');root.className='context-guide-body';root.textContent='Բեռնվում է…';const header=document.createElement('div');header.className='context-guide-header';const title=document.createElement('h2');title.textContent='Օգնություն';header.append(title,close);dialog.append(header,root);document.body.append(dialog);dialog.showModal();
  try{
   const response=await fetch(guideFor(topic)+'?v=20261030-instructions');if(!response.ok)throw Error();
   const source=new DOMParser().parseFromString(await response.text(),'text/html');
   if(window.ZZWS_HELP_USER!==who||!allowed(topic)||!dialog.isConnected){dialog.close();dialog.remove();return false;}
   const section=source.getElementById('guide-'+topic)?.closest('section');if(!section)throw Error();root.replaceChildren(document.importNode(section,true));
   return true;
  }catch{if(dialog.isConnected)root.textContent='Չհաջողվեց բեռնել ուղեցույցը։ Փակեք և կրկին փորձեք։';return false;}
 }
 window.ZZWS_CONTEXT_HELP={open:openTopic};
 const attached=new Map();
 function attach(){
  for(const [target,entry]of attached)if(!target.isConnected||!entry.link.isConnected||!allowed(entry.topic)){entry.link.remove();attached.delete(target);}
  for(const [topic,selectors]of Object.entries(topics)){
   if(!allowed(topic)||(!admin&&(topic.startsWith('admin-')||['confirmation','backup','client-category','bootstrap','mfa','user-sessions','user-emails','channels','invitation-email','report-email','email-settings','offers','receipt-notices','apk-publish'].includes(topic))))continue;
   for(const selector of selectors)for(const target of document.querySelectorAll(selector)){
    if(attached.has(target))continue;
    const link=document.createElement('a');link.className='context-help';link.dataset.helpTopic=topic;link.dataset.helpTarget=selector;link.href=guideFor(topic)+'#guide-'+topic;link.textContent='?';link.title='Օգնություն․ '+labels[topic];link.setAttribute('aria-label',link.title);
    link.onclick=event=>{event.preventDefault();event.stopPropagation();openTopic(topic);};
    if(target.matches('input[type=checkbox],input[type=radio]'))(target.closest('label')||target).after(link);
    else if(['INPUT','SELECT','TEXTAREA'].includes(target.tagName)){target.parentElement.classList.add('has-context-help');link.classList.add('field-help');target.parentElement.append(link);}
    else if(target.tagName==='DETAILS')target.querySelector('summary')?.append(link);
    else if(/^H[1-6]$/.test(target.tagName)||target.tagName==='LEGEND')target.append(link);
    else if(['FORM','FIELDSET','DIV'].includes(target.tagName))target.before(link);else target.after(link);
    attached.set(target,{link,topic});
   }
  }
 }
 attach();new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});window.addEventListener('zzws:session-changed',attach);
})();
