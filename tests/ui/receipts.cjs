const assert=require('assert/strict');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const {defaultRules}=await import('../../supabase/functions/zzws-api/rules.mjs');
  const statement='Հաստատում եմ, որ այս պատվերի ապրանքները ստացել եմ ամբողջությամբ և առանց վնասվածքների։';
  const uuid=n=>String(n).padStart(8,'0')+'-1111-4111-8111-111111111111';
  const customer={id:uuid(20),login:'demo.dealer',client:'Ցուցադրական հաճախորդ',role:'client',sheet:'Dealers',active:true,needsPasswordSetup:false,clientCategory:'Dealers',rowsList:[{organization:'Ցուցադրական կազմակերպություն',address:'Ցուցադրական հասցե',contact:'Ցուցադրական կոնտակտ'}]};
  const products=Array.from({length:60},(_,i)=>({articul:String(i+1).padStart(6,'0'),name:['Samsung UE55DU7100','Bosch KGN36','LG F2V5'][i%3]+' / '+(i+1),brand:['Samsung','Bosch','LG'][i%3],category:['Հեռուստացույց','Սառնարան','Լվացքի մեքենա'][i%3],retail:150000+i*1000,wholesale:100000+i*700,marginVal:33,hasWholesale:true,stockStatus:'Առկա է',targetWarehousesStock:1}));
  const orders=[1,2,3].map(n=>({id:uuid(n),number:100+n,status:['new','confirmed','in_progress'][n-1],revision:2,created:'2026-10-28T08:00:00Z',updated:'2026-10-28T09:00:00Z',customer,delivery:{organization:customer.rowsList[0].organization,address:customer.rowsList[0].address,contact:customer.rowsList[0].contact,method:'Առաքում'},comment:'Պատրաստ է ստացման հաստատմանը',lines:[{...products[n-1],qty:2,unitPrice:products[n-1].wholesale}],original_lines:[{...products[n-1],qty:3,unitPrice:products[n-1].wholesale},{...products[5],qty:1,unitPrice:products[5].wholesale}],total:2*products[n-1].wholesale,events:[]}));
  let globalSetting={mode:'on',revision:uuid(90)},clientSetting={mode:'inherit',revision:null},notices=[],latched=true,receiptPosts=0;const settingsPosts=[];
  const state=()=>{const pending=orders.filter(o=>o.status!=='received').length;if(!pending)latched=false;const enabled=globalSetting.mode==='on'&&clientSetting.mode!=='off'&&clientSetting.mode!=='until';return {statement,enabled,blocked:enabled&&latched,latched,pendingCount:pending,remaining:latched?0:3-pending,limit:3,outstanding:orders.filter(o=>o.status!=='received').map(({id,number,status})=>({id,number,status})),global:globalSetting,client:clientSetting};};
  async function setup(role='client',scope='owner',width=1440){
   const page=await browser.newPage({viewport:{width,height:1000}}),errors=[],csp=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Content Security Policy|violates.*directive|Refused to/.test(m.text()))csp.push(m.text());});page.on('dialog',d=>d.accept());
   await page.addInitScript(()=>sessionStorage.setItem('zzws_session_v3','a'.repeat(64)));
   await page.route('**/functions/v1/zzws-api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname.split('/zzws-api/')[1],post=()=>req.postDataJSON();let data={};
    const permissions=scope==='viewer'?['orders:read','price:read']:['orders:read','orders:write','price:read','price:write','users','rules','storage','audit','security'];
    if(p==='me')data=role==='client'?customer:{id:uuid(40),login:'demo.admin',client:'Ցուցադրական ադմինիստրատոր',role,active:true,adminScope:scope,permissions};
    if(p==='catalog')data={products,version:'demo',updated:'28/10/2026'};if(p==='catalog/version')data={version:'demo'};
    if(p==='me/state')data=req.method()==='POST'?{version:post().version+1}:{data:{},versions:{}};if(p==='me/carts')data={carts:[]};
    if(p==='orders/receipt-state')data=state();if(p==='orders/notifications')data={events:[]};
    if(p==='orders'||p==='admin/orders')data={orders:url.searchParams.get('receiptPending')?orders.filter(o=>!o.received_at):orders};
    if(p==='orders/detail')data={order:orders.find(o=>o.id===post().id),events:[]};
    if(p==='admin/orders/detail')data=orders.find(o=>o.id===post().id);
    if(p==='orders/receipt'){
     receiptPosts++;const o=orders.find(o=>o.id===post().id);assert.equal(post().intact,true);assert.equal(post().revision,o.revision);o.status='received';o.received_at='2026-10-28T10:00:00Z';o.receipt={statement,intact:true};o.revision++;
     notices.push({id:uuid(50+o.number),order_id:o.id,number:o.number,customer,received_at:o.received_at});data={order:o,state:state()};
    }
    if(p==='admin/orders/receipt-notifications')data={events:notices,unreadCount:notices.length};
    if(p==='admin/orders/receipt-notifications/read'){notices=notices.filter(n=>n.id!==post().id);data={ok:true};}
    if(p==='admin/catalog-options')data={pairs:[]};if(p==='admin/users')data={users:[customer,{...customer,id:uuid(21),login:'demo.kp',client:'Ցուցադրական KP հաճախորդ',sheet:'KP',clientCategory:'KP'}],categoryByGroup:{Dealers:'Dealers',KP:'KP'}};
    if(p==='admin/rules')data={rules:defaultRules(),defaults:defaultRules(),revision:'demo'};if(p==='admin/price/versions')data={versions:[]};if(p==='admin/audit')data={events:[]};if(p==='admin/dashboard')data={counts:{new:1,confirmed:2,completed:orders.filter(o=>!o.received_at).length,received:orders.filter(o=>o.received_at).length},priceVersion:'Ցուցադրական',mfaVerified:true};
    if(p==='admin/receipt-control'){
     if(req.method()==='POST'){settingsPosts.push({path:p,...post()});globalSetting={mode:post().mode,disabled_until:post().disabledUntil,revision:uuid(91)};}
     data={setting:globalSetting};
    }
    if(p==='admin/users/receipt-control'){
     if(req.method()==='POST'){assert.equal(post().id,customer.id);settingsPosts.push({path:p,...post()});clientSetting={mode:post().mode,disabled_until:post().disabledUntil,revision:uuid(92)};}
     data={state:state(),setting:clientSetting};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   });
   await page.goto(new URL(role==='admin'?'admin/':'',process.env.ZZWS_TEST_URL||'http://127.0.0.1:8080/').href);
   if(role==='client')await page.waitForFunction(()=>catalogLoaded&&displayedCount>=40);else await page.locator('#dashboard').waitFor({state:'visible'});
   return {page,errors,csp};
  }
  const shot=async(page,name)=>{if(process.env.ZZWS_SCREENSHOTS)await page.screenshot({path:path.join(process.env.ZZWS_SCREENSHOTS,name+'.png')});};
  const client=await setup(),page=client.page;
  await page.locator('#receiptLimitNotice').waitFor({state:'visible'});assert.ok((await page.locator('#receiptLimitNotice').innerText()).includes('բոլոր 3'));
  await shot(page,'01-catalogue');
  await page.evaluate(()=>{addToCart('000001');addToCart('000002');openOrderModal();});await page.locator('#orderModal').waitFor({state:'visible'});assert.equal(await page.locator('#submitServerOrder').isDisabled(),true);await shot(page,'02-cart');
  await page.evaluate(()=>{closeOrderModal();openPersonalCabinet();});
  for(const status of ['new','confirmed','in_progress','completed','rejected']){
   orders[0].status=status;await page.evaluate(()=>{document.querySelectorAll('.server-order-card[open]').forEach(card=>card.open=false);return ZZWS_ORDERS.load();});await page.locator('.server-order-card summary').first().click();await page.locator('.server-order-card').first().getByRole('button',{name:'Հաստատել ապրանքների ստացումը',exact:true}).waitFor();
  }
  orders[0].status='new';await page.evaluate(()=>ZZWS_ORDERS.load());
  await page.getByRole('button',{name:'Հաստատել ապրանքների ստացումը',exact:true}).click();await page.locator('#receiptConfirmationDialog').waitFor();
  await page.locator('#receiptConfirmationDialog button[type=submit]').click();assert.equal(receiptPosts,0);await shot(page,'03-receipt-confirmation');
  await page.locator('#receiptConfirmationDialog input[type=checkbox]').check();await page.locator('#receiptConfirmationDialog button[type=submit]').click();
  await page.locator('#receiptResultNotice').waitFor({state:'visible'});assert.equal(receiptPosts,1);assert.equal(state().pendingCount,2);assert.equal(state().blocked,true);await page.locator('.receipt-proof strong').filter({hasText:'Ստացումն արդեն հաստատված է'}).waitFor();await shot(page,'04-order-received');
  const admin=await setup('admin');await admin.page.locator('#adminReceiptNotices').waitFor({state:'visible'});await shot(admin.page,'05-admin-dashboard');
  await admin.page.locator('#adminReceiptNoticeList button').first().click();await admin.page.locator('#selectedOrderReceipt').waitFor({state:'visible'});assert.equal(await admin.page.locator('#manualOrderSave').isVisible(),false);assert.equal(await admin.page.locator('#manualOrderLines input').first().isDisabled(),true);assert.equal(await admin.page.locator('#manualOrderLines button').count(),0);await admin.page.waitForFunction(()=>document.getElementById('adminReceiptNotices').hidden);await shot(admin.page,'06-admin-order');
  await admin.page.locator('[data-tab=users]').click();await admin.page.locator('#userList button').first().click();assert.equal(await admin.page.locator('#clientCategory').inputValue(),'Dealers');
  const userForm=admin.page.locator('#userForm'),beforeCategory=await admin.page.evaluate(()=>userPayload());assert.equal(await admin.page.locator('#clientPriceSequence').inputValue(),'Մեծածախ');await admin.page.locator('#clientCategory').selectOption('KP');assert.equal(await admin.page.locator('#clientPriceSequence').inputValue(),'KP ակցիոն → KP → Մեծածախ');let selectedCategory=await admin.page.evaluate(()=>userPayload());assert.equal(selectedCategory.sheet,'KP');assert.deepEqual(selectedCategory.rowsList,beforeCategory.rowsList);assert.deepEqual(selectedCategory.catalogAccess,beforeCategory.catalogAccess);await admin.page.locator('#clientCategory').selectOption('Dealers');assert.equal(await admin.page.locator('#clientPriceSequence').inputValue(),'Մեծածախ');selectedCategory=await admin.page.evaluate(()=>userPayload());assert.equal(selectedCategory.sheet,'Dealers');assert.ok(!Object.hasOwn(selectedCategory,'clientPriceSequence'));
  const box=admin.page.locator('#clientReceiptControls');await box.locator('select').waitFor();await box.locator('select').selectOption('until');await box.locator('input').fill('2099-10-28T18:00');await box.getByRole('button',{name:'Պահպանել վերահսկումը'}).click();await box.locator('select').waitFor();await admin.page.waitForFunction(()=>document.getElementById('clientReceiptControls').innerText.includes('պահպանված է'));assert.equal(settingsPosts.at(-1).mode,'until');assert.ok(settingsPosts.at(-1).disabledUntil.endsWith('Z'));
  await box.locator('select').selectOption('off');await box.getByRole('button',{name:'Պահպանել վերահսկումը'}).click();await admin.page.waitForFunction(()=>document.querySelector('#clientReceiptControls select')?.value==='off'&&!document.querySelector('#clientReceiptControls button').disabled);assert.equal(settingsPosts.at(-1).mode,'off');
  await admin.page.locator('#userForm').evaluate(form=>form.scrollIntoView());await shot(admin.page,'07-client-card');
  await admin.page.locator('[data-tab=dashboard]').click();const global=admin.page.locator('#receiptGlobalControls');await global.locator('select').selectOption('off');await global.getByRole('button',{name:'Պահպանել վերահսկումը'}).click();await admin.page.waitForFunction(()=>document.querySelector('#receiptGlobalControls select')?.value==='off'&&!document.querySelector('#receiptGlobalControls button').disabled);assert.equal(settingsPosts.at(-1).path,'admin/receipt-control');assert.equal(settingsPosts.at(-1).mode,'off');
  // Complete the remaining cycle in the mock, and ensure the UI unlocks only at zero.
  globalSetting={mode:'on',revision:uuid(90)};clientSetting={mode:'inherit',revision:null};
  for(let i=1;i<3;i++){
   await page.locator('.server-order-card summary').nth(i).click();await page.locator('.server-order-card').nth(i).getByRole('button',{name:'Հաստատել ապրանքների ստացումը',exact:true}).click();await page.locator('#receiptConfirmationDialog input').check();await page.locator('#receiptConfirmationDialog button[type=submit]').click();await page.waitForFunction(()=>!document.getElementById('receiptConfirmationDialog'));assert.equal(state().blocked,i===1);
  }
  await page.waitForFunction(()=>!document.getElementById('submitServerOrder').disabled);assert.equal(receiptPosts,3);
  const viewer=await setup('admin','viewer');assert.equal(await viewer.page.locator('#receiptGlobalPanel').isVisible(),false);assert.equal(await viewer.page.locator('[data-tab=users]').isVisible(),false);
  const mobile=await setup('client','owner',390);await shot(mobile.page,'08-mobile-catalogue');assert.ok(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  for(const context of [client,admin,viewer,mobile]){assert.deepEqual(context.errors,[]);assert.deepEqual(context.csp,[]);}
  console.log('PASS: receipt from all administrator statuses, acknowledgement, closed proof, three-order latch, cycle unlock, client category, timed/indefinite/global controls, own notice read, viewer rights, mobile layout and CSP');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
