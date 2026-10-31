(() => {
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const compact=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const url=new URL('product-specifications/items/',document.currentScript.src),cache=new Map();
 let active=null,epoch=0;
 function reset(){++epoch;active?.close();active?.remove();active=null;}
 async function data(code){
  if(cache.has(code))return cache.get(code);
  const pending=(async()=>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)),hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');const r=await fetch(new URL(hash+'.json',url),{credentials:'omit',cache:'no-cache'});if(r.status===404)return {schemaVersion:1,products:{}};if(!r.ok)throw Error('load');return r.json();})();
  cache.set(code,pending);try{const value=await pending;if(cache.size>40)cache.delete(cache.keys().next().value);return value;}catch(e){cache.delete(code);throw e;}
 }
 async function open(articul,displayName){
  const permitted=getProduct(articul),product=permitted||{articul,name:displayName||articul},owner=serverIdentity?.id;if(!owner)return;
  reset();const ticket=epoch,origin=document.activeElement,dialog=node('dialog',null,'product-technical-dialog'),head=node('header'),title=node('h2','Տեխնիկական բնութագրեր'),close=node('button','Փակել'),body=node('div',null,'product-technical-body');
  title.id='productTechnicalTitle';dialog.setAttribute('aria-labelledby',title.id);close.type='button';head.append(title,close);dialog.append(head,body);body.append(node('p',product.name,'product-technical-name'),node('p','Արտիկուլ՝ '+articul,'product-technical-meta'),node('p','Բնութագրերը բեռնվում են…'));document.body.append(dialog);active=dialog;
  const dismiss=()=>{if(active===dialog)reset();else dialog.remove();if(origin?.isConnected)origin.focus({preventScroll:true});};close.onclick=dismiss;dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});dialog.showModal();close.focus();
  const valid=()=>{const current=getProduct(articul);return active===dialog&&ticket===epoch&&serverIdentity?.id===owner&&(current?current.name===product.name:!permitted);};
  try{
   const all=await data(articul);if(!valid())return;const row=all.schemaVersion===1?all.products?.[articul]:null;
   body.replaceChildren(node('p',product.name,'product-technical-name'),node('p','Արտիկուլ՝ '+articul,'product-technical-meta'));
   if(!row||compact(row[0])!==compact(product.name)||!row[3]?.length){body.append(node('p','Այս ճշգրիտ մոդելի հաստատված տեխնիկական տվյալները դեռ չկան։'));return;}
   const renderSpecs=indices=>{const specs=node('dl',null,'product-technical-specs');for(const i of indices){const [name,value]=row[3][i];specs.append(node('dt',window.ZZWS_ARMENIAN_SPECS?.label(name)||name),node('dd',window.ZZWS_ARMENIAN_SPECS?.value(value)||String(value)));}return specs;};
   const main=[...new Set((row[4]||row[3].map((_,i)=>i).slice(0,6)).filter(i=>Number.isInteger(i)&&row[3][i]))].slice(0,8),other=row[3].map((_,i)=>i).filter(i=>!main.includes(i));body.append(renderSpecs(main));if(other.length){const details=node('details',null,'product-technical-all');details.append(node('summary','Բոլոր բնութագրերը · '+row[3].length),renderSpecs(other));body.append(details);}
   const source=new URL(row[1]);if(source.protocol==='https:'&&source.hostname==='www.zigzag.am'&&!source.username&&!source.password&&!source.port){const a=node('a','Աղբյուր՝ zigzag.am');a.href=source.href;a.target='_blank';a.rel='noopener noreferrer';body.append(a);}const checked=new Date(row[2]),stamp=node('p','Ստուգված է՝ '+(Number.isFinite(checked.valueOf())?checked.toLocaleDateString('hy-AM',{timeZone:'Asia/Yerevan'}):row[2]),'product-technical-meta');stamp.title=row[2];body.append(stamp);
  }catch{if(valid()){const message=node('p','Չհաջողվեց բեռնել բնութագրերը։ Կրկին փորձեք։'),retry=node('button','Կրկին բեռնել');retry.type='button';retry.onclick=()=>open(articul,displayName);body.replaceChildren(message,retry);}}
 }
 document.addEventListener('click',e=>{const target=e.target.closest?.('[data-product-technical]');if(target){e.preventDefault();open(target.dataset.productTechnical,target.dataset.productName);}});
 window.ZZWS_PRODUCT_TECHNICAL={open,reset};
})();
