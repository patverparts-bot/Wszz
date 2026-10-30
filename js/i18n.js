/* Presentation-only Armenian/Russian localization. Canonical data and input values remain unchanged. */
(() => {
 'use strict';
 const dictionaries=window.ZZWS_TRANSLATIONS||{},letter=/[\u0531-\u0556\u0561-\u0587]/,sources=new WeakMap(),attributes=new WeakMap(),validity=new WeakMap(),cache=new Map(),unknown=new Set();
 const preference='zzws_language_v1';let language='hy',applying=false,scheduled=false;
 try{const query=new URL(location.href).searchParams.get('lang'),saved=localStorage.getItem(preference);language=['hy','ru'].includes(query)?query:saved==='ru'?'ru':'hy';if(query&&['hy','ru'].includes(query))localStorage.setItem(preference,language);}catch{}
 const trie={};for(const [from,to]of Object.entries(dictionaries)){if(!from||from===to)continue;let n=trie;for(const ch of from)n=n[ch]||(n[ch]={});n.$=to;}
 const punctuation={'։':'.','՝':':','՜':'!','՞':'?','՛':''};
 function russian(value){
  const text=String(value??'').replace(/\u00ad|&shy;/g,'');if(!letter.test(text))return text;if(cache.has(text))return cache.get(text);
  const trimmed=text.trim();if(Object.hasOwn(dictionaries,trimmed)){const result=text.replace(trimmed,dictionaries[trimmed]);cache.set(text,result);return result;}
  let result='';for(let i=0;i<text.length;){let n=trie,last=null,end=i;for(let j=i;j<text.length&&n[text[j]];j++){n=n[text[j]];if(n.$!==undefined){last=n.$;end=j+1;}}if(last!==null){result+=last;i=end;}else{result+=punctuation[text[i]]??text[i];i++;}}
  if(letter.test(result))unknown.add(text);if(cache.size>10000)cache.clear();cache.set(text,result);return result;
 }
 const t=(value,locale=language)=>locale==='ru'?russian(value):String(value??'');
 function skip(node){return !node.parentElement||!!node.parentElement.closest('script,style,textarea,noscript,[contenteditable=true],[data-i18n-skip]');}
 function text(node){
  if(skip(node))return;const current=node.nodeValue,prior=sources.get(node),source=prior&&current===prior.last?prior.source:current;
  if(!letter.test(source)&&!prior)return;
  // Options without a value inherit their label as the submitted value. Pin that original value first.
  const option=node.parentElement.closest('option');if(option&&!option.hasAttribute('value'))option.setAttribute('value',option.textContent);
  const translated=t(source);sources.set(node,{source,last:translated});if(current!==translated)node.nodeValue=translated;
 }
 const names=['title','placeholder','aria-label','alt'];
 function attrs(el){
  if(el.matches('script,style,[data-i18n-skip]'))return;let original=attributes.get(el)||{};
  for(const name of names){if(!el.hasAttribute(name))continue;const current=el.getAttribute(name),prior=original[name],source=prior&&current===prior.last?prior.source:current;if(!letter.test(source)&&!prior)continue;const translated=t(source);original[name]={source,last:translated};if(current!==translated)el.setAttribute(name,translated);}
  attributes.set(el,original);
  if(el.tagName==='INPUT'&&['button','submit','reset'].includes(el.type)){
   const prior=original.value,source=prior&&el.value===prior.last?prior.source:el.value;const translated=t(source);original.value={source,last:translated};if(el.value!==translated)el.value=translated;
  }
 }
 function refresh(root=document.body){
  if(!root||applying)return;applying=true;
  try{if(root.nodeType===Node.TEXT_NODE)text(root);else{if(root.nodeType===Node.ELEMENT_NODE)attrs(root);const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode;if(node.nodeType===Node.TEXT_NODE)text(node);else attrs(node);}}const title=document.querySelector('title');if(title?.firstChild)text(title.firstChild);document.documentElement.lang=language;for(const control of document.querySelectorAll('[data-language-select]'))control.value=language;}
  finally{observer.takeRecords();applying=false;}
 }
 function setLanguage(value){
  if(!['hy','ru'].includes(value))return;language=value;try{localStorage.setItem(preference,value);}catch{}refresh();
  for(const el of document.querySelectorAll('input,textarea,select'))if(validity.has(el))el.setCustomValidity(validity.get(el));
  window.dispatchEvent(new CustomEvent('zzws:languagechange',{detail:{language:value}}));
 }
 const observer=new MutationObserver(records=>{if(applying||scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;refresh();});});
 observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:names});
 for(const method of ['alert','confirm','prompt']){const native=window[method].bind(window);window[method]=(message,...args)=>native(t(message),...args);}
 for(const kind of [HTMLInputElement,HTMLTextAreaElement,HTMLSelectElement]){const native=kind.prototype.setCustomValidity;kind.prototype.setCustomValidity=function(message){validity.set(this,String(message??''));return native.call(this,t(message));};}
 function selector(){
  for(const host of document.querySelectorAll('[data-language-switcher]')){if(host.querySelector('[data-language-select]'))continue;const label=document.createElement('label');label.className='zzws-language';const caption=document.createElement('span');caption.textContent='Լեզու';const select=document.createElement('select');select.dataset.languageSelect='true';select.setAttribute('aria-label','Լեզու / Язык');for(const [value,label]of [['hy','Հայերեն'],['ru','Русский']]){const o=document.createElement('option');o.value=value;o.textContent=label;o.dataset.i18nSkip='true';select.append(o);}select.value=language;select.addEventListener('change',()=>setLanguage(select.value));label.append(caption,select);host.append(label);}
 }
 function start(){selector();refresh();}
 document.addEventListener('DOMContentLoaded',start,{once:true});window.addEventListener('storage',event=>{if(event.key===preference&&['hy','ru'].includes(event.newValue)){language=event.newValue;refresh();window.dispatchEvent(new CustomEvent('zzws:languagechange',{detail:{language}}));}});
 function canonical(value,choices=[]){const raw=String(value??''),query=raw.toLocaleLowerCase();const exact=choices.find(c=>String(c).toLocaleLowerCase()===query||russian(c).toLocaleLowerCase()===query);if(exact!==undefined)return exact;return raw;}
 window.ZZWS_I18N=Object.freeze({t,russian,canonical,setLanguage,get language(){return language;},refresh,unknown:()=>[...unknown],search:(value,query)=>{const a=String(value??'').toLocaleLowerCase(),b=String(query??'').toLocaleLowerCase();return a.includes(b)||russian(a).toLocaleLowerCase().includes(b)||russian(String(value??'')).toLocaleLowerCase().includes(b);}});
 if(document.readyState!=='loading')start();
})();
