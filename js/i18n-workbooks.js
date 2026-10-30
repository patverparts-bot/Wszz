/* Localize XLSX text directly in its XML; preserve formulas, dropdowns, styles and numeric values. */
(() => {
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const headers=['Մուտքանուն','Հաճախորդ','Հաճախորդի կատեգորիա','Դեր','Հասանելիությունը միացված է','Աշխատակցի իրավունքներ','Android հավելված','Telegram ծանուցումներ','Ստացողի Telegram ID','Telegram բոտի օգտանուն','Պատվերների ստուգման միջակայք (վրկ)','Ստացման վերահսկում','Անջատված է մինչև (Երևան)','Բոլոր բրենդները','Թույլատրված բրենդներ','Վերավաճառքի գին','Անհատական հասանելիություն','Կատեգորիայի համընկնում','Թույլտվությունների կապեր (JSON)','Բացառությունների կապեր (JSON)',...[1,2,3].flatMap(i=>['Կազմակերպություն','Հասցե','Կոնտակտային անձ'].map(label=>label+' '+i))];
 const enumHeaders=new Set(['Հաճախորդի կատեգորիա','Դեր','Հասանելիությունը միացված է','Աշխատակցի իրավունքներ','Android հավելված','Telegram ծանուցումներ','Ստացման վերահսկում','Բոլոր բրենդները','Վերավաճառքի գին','Անհատական հասանելիություն','Կատեգորիայի համընկնում']);
 const choices=['Այո','Ոչ','Հաճախորդ','Ադմինիստրատոր','Չնշանակել','Սեփականատեր','Պատվերների մենեջեր','Գնացուցակի օպերատոր','Միայն դիտում','Ընդհանուր կարգավորում','Միացված է','Անջատված է','Ժամանակավորապես անջատված է','Բոլոր ապրանքները','Ընտրված ապրանքները','Ճշգրիտ','Պարունակում է'];
 const source=value=>String(value??'');
 const rawCell=(cell,shared)=>cell.getAttribute('t')==='s'?shared[Number(cell.getElementsByTagName('v')[0]?.textContent)]||'':cell.getAttribute('t')==='inlineStr'?[...cell.getElementsByTagName('t')].map(t=>t.textContent).join(''):cell.getElementsByTagName('v')[0]?.textContent||'';
 function setCell(cell,value){cell.setAttribute('t','inlineStr');cell.replaceChildren();const i=cell.ownerDocument.createElementNS(ns,'is'),t=cell.ownerDocument.createElementNS(ns,'t');t.setAttribute('xml:space','preserve');t.textContent=value;i.append(t);cell.append(i);}
 async function rewrite(blob,transform){
  if(!window.XLSX)throw Error(ZZWS_I18N.t('Excel գործիքը չի բեռնվել։ Թարմացրեք էջը և կրկին փորձեք։ Զամբյուղը պահպանված է։'));
  const zip=XLSX.CFB.read(new Uint8Array(await blob.arrayBuffer()),{type:'buffer'}),documents=new Map();
  for(let i=0;i<zip.FullPaths.length;i++){
   const name=zip.FullPaths[i];if(!/\/(xl|docProps)\/.*\.xml$/.test(name))continue;
   const entry=zip.FileIndex[i];if(!entry.content?.length)continue;const xml=new TextDecoder().decode(entry.content),doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Invalid XLSX XML');documents.set(name,{entry,doc});
  }
  transform(documents);
  for(const {entry,doc}of documents.values()){entry.content=new TextEncoder().encode(new XMLSerializer().serializeToString(doc));entry.size=entry.content.length;}
  return new Blob([XLSX.CFB.write(zip,{type:'array',fileType:'zip',compression:true})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 }
 function localizeWorkbook(book){
  if(ZZWS_I18N.language!=='ru')return book;
  for(const sheet of Object.values(book.Sheets))for(const [address,cell]of Object.entries(sheet)){if(address.startsWith('!')||!cell||cell.f||typeof cell.v!=='string')continue;cell.v=ZZWS_I18N.t(cell.v);delete cell.w;}
  const sheets={};for(const name of book.SheetNames)sheets[ZZWS_I18N.t(name)]=book.Sheets[name];book.SheetNames=book.SheetNames.map(name=>ZZWS_I18N.t(name));book.Sheets=sheets;return book;
 }
 async function localizeBlob(blob){
  if(ZZWS_I18N.language!=='ru')return blob;
  return rewrite(blob,documents=>{
   const sheetNames=new Map();
   for(const [name,{doc}]of documents)if(name.endsWith('/xl/workbook.xml'))for(const sheet of doc.getElementsByTagName('sheet')){const old=sheet.getAttribute('name'),translated=ZZWS_I18N.t(old);sheetNames.set(old,translated);sheet.setAttribute('name',translated);}
   for(const [name,{doc}]of documents){
    if(/\/(sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name)){
     for(const text of doc.getElementsByTagName('t'))text.textContent=ZZWS_I18N.t(text.textContent);
     for(const cell of doc.getElementsByTagName('c'))if(cell.getAttribute('t')==='str')for(const value of cell.getElementsByTagName('v'))value.textContent=ZZWS_I18N.t(value.textContent);
    }
    for(const tag of ['f','definedName'])for(const formula of doc.getElementsByTagName(tag)){let text=formula.textContent;for(const [old,value]of sheetNames)if(old!==value)text=text.replaceAll("'"+old.replaceAll("'","''")+"'!","'"+value.replaceAll("'","''")+"'!");formula.textContent=text;}
    if(name.endsWith('/docProps/app.xml'))for(const text of doc.getElementsByTagName('vt:lpstr'))text.textContent=ZZWS_I18N.t(text.textContent);
   }
  });
 }
 async function userImport(form,categoryLabels){
  const file=form.get('file');if(!(file instanceof Blob))return form;
  const canonical=new Map(headers.map(h=>[ZZWS_I18N.russian(h),h]));
  const options=[...choices,...Object.values(categoryLabels||{})],reverse=new Map(options.map(value=>[ZZWS_I18N.russian(value),value]));
  let changed=false;
  const output=await rewrite(file,documents=>{
   const shared=[];for(const [name,{doc}]of documents)if(name.endsWith('/xl/sharedStrings.xml'))for(const item of doc.getElementsByTagName('si'))shared.push([...item.getElementsByTagName('t')].map(t=>t.textContent).join(''));
   for(const [name,{doc}]of documents){
    if(!/\/xl\/worksheets\/[^/]+\.xml$/.test(name))continue;const rows=[...doc.getElementsByTagName('row')],first=rows.find(row=>row.getAttribute('r')==='1');if(!first)continue;
    const cells=[...first.getElementsByTagName('c')],columns=new Map();
    const firstLabel=rawCell(cells[0]||doc.createElement('c'),shared);if(firstLabel!=='Մուտքանուն'&&firstLabel!==ZZWS_I18N.russian('Մուտքանուն'))continue;
    for(const cell of cells){const raw=rawCell(cell,shared),header=canonical.get(raw)||raw,col=cell.getAttribute('r').replace(/\d/g,'');columns.set(col,header);if(header!==raw){setCell(cell,header);changed=true;}}
    for(const row of rows)if(row!==first)for(const cell of row.getElementsByTagName('c')){
     const header=columns.get(cell.getAttribute('r').replace(/\d/g,''));if(!enumHeaders.has(header))continue;
     const raw=rawCell(cell,shared),value=reverse.get(raw.trim());if(value!==undefined&&value!==raw){setCell(cell,value);changed=true;}
    }
   }
  });
  if(changed)form.set('file',new File([output],file.name||'Users.xlsx',{type:output.type}));return form;
 }
 window.ZZWS_I18N_WORKBOOKS=Object.freeze({localizeBlob,localizeWorkbook,userImport});
})();
