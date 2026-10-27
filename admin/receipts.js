(() => {
 const el=id=>document.getElementById(id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 let admin=null,owner=false,clientTicket=0,noticeTicket=0,globalTicket=0;
 const modeLabel={inherit:'Ընդհանուր կարգավորում',on:'Միացված է',off:'Անջատված է՝ անժամկետ',until:'Ժամանակավորապես անջատված է'};
 function buildControls(root,setting,global,customer=null,state=null){
  root.replaceChildren();const currentAdmin=admin,targetId=customer?.id,ticket=global?globalTicket:clientTicket;
  const info=node('p',global?'Սահմանը՝ երեք չհաստատված պատվեր։ Երրորդից հետո նոր պատվեր կարելի է ուղարկել միայն ամբողջ ցիկլը փակելուց հետո։':'Այս հաճախորդի վերահսկման կարգավորումը պահպանվում է առանձին՝ առանց հաշվի կամ ռեկվիզիտների փոփոխման։','help');
  const mode=node('select'),deadline=node('input'),modeField=node('label','Ստացման վերահսկում'),dateField=node('label','Անջատված է մինչև՝ սարքի տեղական ժամով'),save=node('button','Պահպանել վերահսկումը'),message=node('p');
  mode.setAttribute('aria-label',global?'Ընդհանուր ստացման վերահսկում':'Հաճախորդի ստացման վերահսկում');deadline.type='datetime-local';deadline.setAttribute('aria-label','Վերահսկման վերականգնման ամսաթիվ');save.type='button';
  for(const value of global?['on','off','until']:['inherit','on','off','until']){const option=node('option',modeLabel[value]);option.value=value;mode.append(option);}mode.value=setting.mode||'inherit';
  if(setting.disabled_until){const d=new Date(setting.disabled_until);deadline.value=new Date(d.valueOf()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}dateField.hidden=mode.value!=='until';mode.onchange=()=>{dateField.hidden=mode.value!=='until';deadline.required=mode.value==='until';};
  modeField.append(mode);dateField.append(deadline);message.setAttribute('role','status');root.append(info,modeField,dateField);
  if(state){root.append(node('p','Չփակված պատվերներ՝ '+state.pendingCount+' · '+(state.blocked?'Նոր պատվերները փակված են':state.enabled?'Վերահսկումը միացված է':'Վերահսկումը անջատված է'),'help'));}
  root.append(save,message);
  save.onclick=async()=>{
   if(admin!==currentAdmin||(!global&&(ticket!==clientTicket||el('userForm').elements.id.value!==targetId)))return;
   let until=null;if(mode.value==='until'){const time=Date.parse(deadline.value);if(!Number.isFinite(time)||time<=Date.now()){message.textContent='Նշեք ապագա ամսաթիվն ու ժամը';return;}until=new Date(time).toISOString();}
   save.disabled=mode.disabled=deadline.disabled=true;
   try{const data=await ZZWS.json(global?'admin/receipt-control':'admin/users/receipt-control',{method:'POST',body:JSON.stringify({...(global?{}:{id:targetId}),mode:mode.value,disabledUntil:until,revision:setting.revision||null})});if(admin!==currentAdmin||(global?ticket!==globalTicket:ticket!==clientTicket))return;buildControls(root,data.setting,global,customer,data.state);root.append(node('p','Վերահսկման կարգավորումը պահպանված է։','help'));}
   catch(e){message.textContent=ZZWS.message(e);}finally{save.disabled=mode.disabled=deadline.disabled=false;}
  };
 }
 async function loadGlobal(){const ticket=++globalTicket,who=admin;if(!owner)return;const root=el('receiptGlobalControls');try{const data=await ZZWS.json('admin/receipt-control');if(admin===who&&ticket===globalTicket)buildControls(root,data.setting,true);}catch(e){if(admin===who)root.textContent=ZZWS.message(e);}}
 async function loadClient(user){const ticket=++clientTicket,who=admin,root=el('clientReceiptControls'),box=el('clientReceiptControlPanel');root.replaceChildren();box.hidden=!owner||!user.id||user.role!=='client';if(box.hidden)return;root.textContent='Կարգավորումը բեռնվում է…';try{const data=await ZZWS.json('admin/users/receipt-control?id='+encodeURIComponent(user.id));if(admin===who&&ticket===clientTicket&&el('userForm').elements.id.value===user.id)buildControls(root,data.state.client,false,user,data.state);}catch(e){if(ticket===clientTicket)root.textContent=ZZWS.message(e);}}
 async function poll(){if(!admin||document.hidden||document.documentElement.dataset.orderRead!=='true')return;const who=admin,ticket=++noticeTicket;try{const data=await ZZWS.json('admin/orders/receipt-notifications');if(who!==admin||ticket!==noticeTicket)return;const events=data.events||[],root=el('adminReceiptNoticeList');root.replaceChildren();el('adminReceiptNotices').hidden=!events.length;el('adminReceiptBadge').textContent=data.unreadCount>99?'99+':String(data.unreadCount||0);el('adminReceiptBadge').hidden=!data.unreadCount;
   for(const event of events.slice(0,5)){const row=node('div',null,'admin-receipt-notice'),button=node('button','Բացել պատվեր №'+event.number);button.type='button';row.append(node('span',(event.customer.client||event.customer.login)+' · հաստատել է ապրանքների ամբողջական և անվնաս ստացումը'),button);button.onclick=async()=>{try{await selectAdminTab('orders');const order=await ZZWS_ADMIN_ORDERS.openNotice(event.order_id);if(!order?.received_at||who!==admin)return;await ZZWS.json('admin/orders/receipt-notifications/read',{method:'POST',body:JSON.stringify({id:event.id})});await poll();}catch(e){el('adminOrderStatus').textContent=ZZWS.message(e);}};root.append(row);}
  }catch(e){if(e.status===401)reset();}}
 function start(user){reset();admin=user.id;owner=(user.permissions||['users']).includes('users');el('receiptGlobalPanel').hidden=!owner;if(owner)loadGlobal();poll();}
 function reset(){admin=null;owner=false;++clientTicket;++noticeTicket;++globalTicket;for(const id of ['receiptGlobalControls','clientReceiptControls','adminReceiptNoticeList'])el(id)?.replaceChildren();for(const id of ['adminReceiptNotices','adminReceiptBadge','clientReceiptControlPanel'])if(el(id))el(id).hidden=true;}
 function proof(order,root){root.replaceChildren();root.hidden=!order.received_at;if(order.received_at){root.append(node('strong','Հաճախորդը հաստատել է ստացումը'),node('p',order.receipt?.statement||'Ապրանքներն ամբողջությամբ և առանց վնասվածքների ստացված են։'),node('small',new Date(order.received_at).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan'})));}}
 window.ZZWS_ADMIN_RECEIPTS={start,reset,poll,loadClient,loadGlobal,proof};
})();
