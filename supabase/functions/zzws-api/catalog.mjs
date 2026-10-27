export const norm = v => String(v??'').toLowerCase().replace(/[^a-z0-9\u0531-\u058f]/g,'');
const number = v => { const n=Number(v||0); if(!Number.isFinite(n)||n<0) throw Error('Некорректная цена или остаток'); return n; };
export function parsePrice(rows) {
  const hi=rows.slice(0,25).findIndex(r=>r.some(c=>/artikul|артикул|արտիկուլ/i.test(String(c??''))));
  if(hi<0) throw Error('Не найдена строка заголовков');
  const headers=rows[hi].map(c=>String(c??'').trim());
  const find=(...words)=>headers.findIndex(h=>words.some(w=>h.toLowerCase().includes(w.toLowerCase())));
  const c={art:find('art','артикул','արտիկուլ'),brand:find('brand','бренд','բրենդ'),category:find('group','группа','категория','խումբ','կատեգորիա'),
    name:find('name','наименование','номенклатура','անվանում'),retail:find('Զեղչված','discount'),base:find('roznich','розница','մանրածախ'),
    ws:find('wholesale','опт','մեծածախ'),kp:find("Key Partner's AMD"),kpPromo:find("Key Partner's promo AMD")};
  if(c.retail<0)c.retail=c.base;
  for(const key of ['art','brand','category','name','retail','ws'])if(c[key]<0)throw Error('Отсутствует обязательная колонка: '+key);
  const stocks=headers.map((h,i)=>({h,i})).filter(v=>/^\d{3}$/.test(v.h));
  if(!stocks.length)throw Error('Не найдены колонки складов');
  const result=[], seen=new Set();
  for(const row of rows.slice(hi+1)) {
    const get=k=>row[c[k]];
    const articul=String(get('art')??'').trim(); if(!articul)continue;
    if(articul.length>30||seen.has(articul))throw Error('Повтор или неверный артикул: '+articul);
    seen.add(articul);
    const p={articul,stocks:{}};
    for(const k of ['brand','category','name']){p[k]=String(get(k)??'').trim();if(p[k].length>1000)throw Error('Слишком длинное название');}
    for(const k of ['retail','base','ws','kp','kpPromo'])p[k]=number(get(k));
    for(const {h,i} of stocks)p.stocks[h]=number(row[i]);
    result.push(p);
  }
  if(!result.length)throw Error('Прайс не содержит товаров');
  return result;
}
export function project(products,user) {
  const result=[],admin=user.role==='admin',kp=user.sheet==='KP'&&!admin,domus=/ԴՈՄՈՒՍ|ДОМУՍ|DOMUS/i.test(user.client);
  const allowed=(user.brands||[]).map(norm);
  for(const p of products){
    const brand=norm(p.brand);
    if(kp&&(!user.allBrands&&!allowed.includes(brand)))continue;
    if(kp&&(brand==='miele'||(brand==='sony'&&norm(p.category).includes(norm('Հեռուստացույց')))))continue;
    const wholesale=kp?(p.kpPromo||p.kp||p.ws):p.ws,kpPrice=p.kpPromo||p.kp,retail=p.retail;
    if(!admin&&(wholesale<=0||(retail>0&&wholesale>retail)))continue;
    const entries=Object.entries(p.stocks),base=entries.filter(([n])=>['003','023','026','031'].includes(n)).reduce((s,[,q])=>s+q,0);
    const other=entries.filter(([n])=>!['003','023','026','031'].includes(n)).reduce((s,[,q])=>s+q,0);
    if(admin?base+other<=0:base===0&&other<5)continue;
    const margin=price=>retail>0&&price>0?(domus?retail/price:(1-price/retail)*100):0;
    const item={articul:p.articul,brand:p.brand,category:p.category,name:p.name,retail,wholesale,
      isPromo:retail>0&&p.base>retail,isWholesalePromo:!!(kp&&p.kpPromo),hasWholesale:wholesale>0||(admin&&kpPrice>0),
      marginVal:margin(wholesale),stockStatus:admin?entries.filter(([,q])=>q>0).map(([n,q])=>`${n}: ${q}`).join(', '):(base>=3?'Առկա է':'Ճշտել')};
    if(admin)Object.assign(item,{kpPrice,kpIsPromo:!!p.kpPromo,kpMarginVal:margin(kpPrice),targetWarehousesStock:base});
    if(admin||user.allowResale)item.resaleWholesale=p.ws;
    result.push(item);
  }
  return result;
}
export function validateProfile(p){
  const login=String(p.login||'').trim().toLowerCase(),client=String(p.client||'').trim();
  if(!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(login))throw Error('Логин: латинские буквы, цифры, точка, дефис или подчёркивание');
  if(!client||client.length>200)throw Error('Укажите название клиента');
  const role=p.role||'client',sheet=p.sheet||'Dealers';
  if(!['admin','client'].includes(role)||!['Dealers','KP'].includes(sheet))throw Error('Неверная роль или группа цен');
  const brands=p.brands||[];if(!Array.isArray(brands)||brands.length>100||brands.some(b=>typeof b!=='string'||b.length>100))throw Error('Неверный список брендов');
  const rowsList=p.rowsList?.length?p.rowsList:[{organization:client,address:'',contact:''}];
  if(!Array.isArray(rowsList)||rowsList.length>5||rowsList.some(r=>!r||typeof r!=='object'||Object.values(r).some(v=>typeof v!=='string'||v.length>300)))throw Error('Неверные контакты');
  return {login,profile:{client,role,sheet,brands,allBrands:p.allBrands===true,allowResale:p.allowResale===true,rowsList}};
}
export function parseUsers(rows){
  if(rows[0]?.slice(0,3).join(',')!=='login,client,sheet')throw Error('Используйте шаблон пользователей');
  const seen=new Set(),result=[];
  for(const row of rows.slice(1)){
    if(!row.some(c=>c!==null&&c!==undefined&&c!==''))continue;
    const p=Object.fromEntries(rows[0].map((h,i)=>[h,String(row[i]??'').trim()]));
    p.brands=(p.brands||'').split(',').map(v=>v.trim()).filter(Boolean);p.allBrands=['true','1','yes'].includes(p.allBrands.toLowerCase());
    p.rowsList=[{organization:p.organization||p.client,address:p.address||'',contact:p.contact||''}];
    const user=validateProfile(p);if(seen.has(user.login))throw Error('Повтор логина: '+user.login);seen.add(user.login);result.push(user);
  }
  if(!result.length||result.length>1000)throw Error('Допустимо от 1 до 1000 пользователей');
  return result;
}
