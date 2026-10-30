(() => {
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;return e;},money=n=>Number(n).toLocaleString((window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM'))+' ֏';
 let user=null,generation=0,timer=null,started=0,items=[],dialog=null,shown=new Set(),cursor='',polling=false;
 const button=node('button','Ծանուցումներ · գներ և առաջարկներ');button.type='button';button.id='catalogBulletinsButton';button.hidden=true;button.className='catalog-bulletins-button';document.querySelector('.catalog-header')?.append(button);
 function reset(){user=null;++generation;clearInterval(timer);timer=null;items=[];cursor='';polling=false;shown.clear();dialog?.close();dialog?.remove();dialog=null;button.hidden=true;}
 async function mark(item){shown.add(item.id);item.seen=true;await ZZWS.json('me/bulletins/read',{method:'POST',body:JSON.stringify({id:item.id})}).catch(()=>{});}
 function open(selected=null){if(!user)return;dialog?.remove();dialog=node('dialog');dialog.className='catalog-bulletins-dialog';const head=node('div');head.className='bulletin-dialog-heading';head.append(node('h2',selected?.title||'Գներ և հատուկ առաջարկներ'));const close=node('button','Փակել');close.type='button';close.onclick=()=>dialog.close();head.append(close);dialog.append(head);
  const list=selected?[selected]:items;if(!list.length)dialog.append(node('p','Այս պահին նոր գների փոփոխություններ կամ հատուկ առաջարկներ չկան։'));
  for(const item of list){const section=node('section');section.append(node('h3',item.title),node('p',new Date(item.created).toLocaleString((window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM'),{timeZone:'Asia/Yerevan'})));const table=node('table'),tr=table.createTHead().insertRow();for(const h of ['Արտիկուլ / ապրանք','Գին',''])tr.append(node('th',h));
   const tbody=table.createTBody();for(const p of item.products){const row=tbody.insertRow();row.insertCell().append(node('strong',p.name),node('small',p.articul));const price=row.insertCell();if(p.previousPrice!=null)price.append(node('del',money(p.previousPrice)));price.append(node('strong',money(p.price)));const add=node('button','Ավելացնել զամբյուղ');add.type='button';add.onclick=async()=>{const who=user?.id,context=window.ZZWS_CATALOG_VIEW?.key();add.disabled=true;try{await loadPriceData();if(user?.id!==who||context!==window.ZZWS_CATALOG_VIEW?.key())return;if(!productIndex.has(p.articul)){add.textContent='Ապրանքն այլևս հասանելի չէ';return;}addToCart(p.articul);add.textContent='Ավելացված է ✓';}catch{add.textContent='Կրկին փորձել';}finally{add.disabled=false;}};row.insertCell().append(add);}section.append(table);dialog.append(section);mark(item);
  }
  document.body.append(dialog);dialog.showModal();
 }
 async function refresh(){if(!user||document.hidden||polling)return;const who=user.id,ticket=generation;polling=true;try{const r=await ZZWS.json('me/bulletins'+(cursor?'?cursor='+encodeURIComponent(cursor):''));if(user?.id!==who||generation!==ticket)return;if(!r.unchanged)items=r.bulletins;cursor=r.cursor||'';button.hidden=false;button.textContent='Ծանուցումներ · '+items.filter(i=>!i.seen&&!shown.has(i.id)).length;
   if(dialog?.open)return;const next=items.find(i=>!i.seen&&!shown.has(i.id)&&(i.kind==='prices'||Date.now()-started>=120000));if(next)open(next);
  }catch(e){if(e.status===404)button.hidden=true;}finally{if(generation===ticket)polling=false;}
 }
 button.onclick=()=>open();window.ZZWS_BULLETINS={reset,start(identity){reset();user=identity;started=Date.now();button.hidden=false;refresh();timer=setInterval(refresh,60000);},refresh,open};
})();
