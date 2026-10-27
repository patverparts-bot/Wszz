(() => {
 const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
 let priorText=null,priorProducts=null,priorResult=null;
 function compile(raw,products){
  if(raw===priorText&&products===priorProducts)return priorResult;
  const indexed=products.map(p=>({articul:p.articul,code:normalize(p.articul),name:normalize(p.name)})),parts=[];
  const found=text=>indexed.some(p=>p.code.includes(text)||p.name.includes(text));
  if(/[,;\n]/.test(raw)){
   for(const match of raw.matchAll(/[^,;\n]+/g)){const trimmed=match[0].trim();if(!trimmed)continue;const start=match.index+match[0].indexOf(trimmed),term=normalize(trimmed);parts.push({start,end:start+trimmed.length,text:trimmed,term,found:found(term)});}
  }else{
   const tokens=[...raw.matchAll(/\S+/g)];
   for(let i=0;i<tokens.length;){let end=i+1,matched=false;
    for(let j=Math.min(tokens.length,i+10);j>i;j--){const term=normalize(raw.slice(tokens[i].index,tokens[j-1].index+tokens[j-1][0].length));if(found(term)){end=j;matched=true;break;}}
    const start=tokens[i].index,stop=tokens[end-1].index+tokens[end-1][0].length,text=raw.slice(start,stop);parts.push({start,end:stop,text,term:normalize(text),found:matched});i=end;
   }
  }
  const terms=[...new Set(parts.filter(p=>p.found).map(p=>p.term))],matches=new Set(indexed.filter(p=>terms.some(term=>p.code.includes(term)||p.name.includes(term))).map(p=>p.articul));
  priorText=raw;priorProducts=products;priorResult={raw,parts,matches,missing:parts.filter(p=>!p.found)};return priorResult;
 }
 let input,mirror,mirrorText,status;
 function position(){if(!input||!mirror||mirror.hidden)return;const style=getComputedStyle(input);mirror.style.height=input.offsetHeight+'px';mirror.style.top=input.offsetTop+'px';mirror.style.left=input.offsetLeft+'px';mirror.style.width=input.offsetWidth+'px';mirror.style.padding=style.padding;mirror.style.fontFamily=style.fontFamily;mirror.style.fontSize=style.fontSize;mirror.style.fontWeight=style.fontWeight;mirror.style.lineHeight=style.lineHeight;mirror.style.borderRadius=style.borderRadius;mirrorText.style.transform='translateX(-'+input.scrollLeft+'px)';}
 function highlight(result){
  if(typeof document==='undefined')return;
  if(!input){input=document.getElementById('searchInput');if(!input)return;
   mirror=document.createElement('div');mirror.className='search-highlight-mirror';mirror.hidden=true;mirror.setAttribute('aria-hidden','true');mirrorText=document.createElement('div');mirrorText.className='search-highlight-text';mirror.append(mirrorText);input.before(mirror);
   status=document.createElement('div');status.id='multiSearchStatus';status.className='multi-search-status';status.setAttribute('role','status');status.hidden=true;document.getElementById('stickySearchBar').insertBefore(status,document.getElementById('compactFiltersRow'));input.setAttribute('aria-describedby',status.id);input.maxLength=5000;
   input.addEventListener('scroll',position);input.addEventListener('input',()=>{mirror.hidden=true;input.classList.remove('search-highlight-active');});window.addEventListener('resize',()=>requestAnimationFrame(position));
  }
  mirrorText.replaceChildren();let offset=0;
  for(const part of result.parts){mirrorText.append(document.createTextNode(result.raw.slice(offset,part.start)));const span=document.createElement('span');span.textContent=result.raw.slice(part.start,part.end);if(!part.found)span.className='search-query-missing';mirrorText.append(span);offset=part.end;}
  mirrorText.append(document.createTextNode(result.raw.slice(offset)));const errors=result.missing.length>0;
  input.classList.toggle('search-highlight-active',errors);input.setAttribute('aria-invalid',String(errors));mirror.hidden=!errors;position();
  status.hidden=!result.raw.trim();status.replaceChildren();if(result.raw.trim()){const summary=document.createElement('span');summary.textContent='Հարցումներ՝ '+result.parts.length+' · գտնված ապրանքներ՝ '+result.matches.size;status.append(summary);if(errors){const missing=document.createElement('strong');missing.textContent='Չեն գտնվել՝ '+result.missing.map(p=>p.text).join(', ');status.append(missing);}}
 }
 window.ZZWS_MULTI_SEARCH={compile,highlight};
})();
