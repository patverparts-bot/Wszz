(() => {
 const bar=document.getElementById('stickySearchBar'),body=document.getElementById('filtersContainer');
 if(!bar||!body)return;
 const panel=body.parentElement,toolbar=bar.firstElementChild,bulk=toolbar.querySelector('button[onclick="openBulkAddModal()"]');
 panel.id='catalogFiltersPanel';toolbar.classList.add('sticky-search-inner');
 const actions=document.createElement('div');actions.id='stickySearchActions';actions.className='sticky-search-actions';
 for(const selector of ['.catalog-header-actions .header-notifications','.catalog-header-actions .header-primary']){const button=document.querySelector(selector);if(button)actions.append(button);}
 toolbar.append(actions);if(bulk){bulk.classList.add('sticky-bulk-add');bulk.innerHTML='<span class="bulk-add-full">Добавить списком</span><span class="bulk-add-short">Списком</span>';}
 const summary=document.createElement('button');summary.id='compactFiltersRow';summary.type='button';summary.className='compact-filters-row';summary.setAttribute('aria-controls','filtersContainer');
 const label=document.createElement('span');label.className='compact-filters-label';label.textContent='Фильтры';
 const selected=document.createElement('span');selected.id='compactFilterValues';selected.className='compact-filter-values';
 const icon=document.createElement('span');icon.className='compact-filters-chevron';icon.textContent='⌄';icon.setAttribute('aria-hidden','true');summary.append(label,selected,icon);
 bar.append(summary,panel);
 const wasOpen=window.matchMedia('(min-width:768px)').matches||!body.classList.contains('hidden');body.classList.remove('md:block');body.classList.toggle('hidden',!wasOpen);
 const marker=document.createElement('div');marker.id='stickyControlsMarker';marker.setAttribute('aria-hidden','true');bar.before(marker);
 let compact=false,manualExpanded=false,openedAt=0,scheduled=false;
 function setCompact(value){if(compact===value)return;compact=value;bar.classList.toggle('filters-auto-compact',compact);refreshSummary();updateStickyOffsets();}
 function refreshSummary(){
  const values=[];
  for(const brand of selectedBrands)values.push('Бренд: '+brand);
  for(const category of selectedCategories)values.push('Категория: '+category);
  const checkboxes={favOnlyFilter:'Избранное',promoOnlyFilter:'Акции',stockOnlyFilter:'В наличии',wholesaleOnlyFilter:'С оптовой ценой'};
  for(const [id,title] of Object.entries(checkboxes))if(document.getElementById(id)?.checked&&(id!=='wholesaleOnlyFilter'||isAdminUser()))values.push(title);
  const sort=activeColumnSort();if(sort.direction){const names={articul:'Артикул',brand:'Бренд',name:'Название',stockStatus:'Наличие',retail:'Розница',wholesale:'Ваша цена',kpPrice:'KP',marginVal:'Доходность',kpMarginVal:'Доходность KP',resaleWholesale:'Перепродажа'};values.push((names[sort.key]||sort.key)+(sort.direction===1?' ↑':' ↓'));}
  selected.replaceChildren();if(!values.length){const empty=document.createElement('span');empty.className='compact-filter-empty';empty.textContent='Не выбраны';selected.append(empty);}
  for(const value of values){const chip=document.createElement('span');chip.className='compact-filter-chip';chip.textContent=value;chip.title=value;selected.append(chip);}
  const expanded=!compact&&!body.classList.contains('hidden');summary.setAttribute('aria-expanded',String(expanded));summary.title=expanded?'Свернуть фильтры':'Показать фильтры';icon.textContent=expanded?'⌃':'⌄';
  panel.classList.toggle('filter-body-closed',body.classList.contains('hidden'));
 }
 function onScroll(){scheduled=false;const app=document.getElementById('mainApp');if(app.classList.contains('hidden'))return;
  const y=window.scrollY,atTop=y<=8||marker.getBoundingClientRect().top>12;
  if(atTop){manualExpanded=false;setCompact(false);}
  else if(manualExpanded){if(Math.abs(y-openedAt)>80&&!panel.contains(document.activeElement)){manualExpanded=false;setCompact(true);}}
  else setCompact(true);
  bar.classList.toggle('controls-stuck',marker.getBoundingClientRect().top<=0);
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(onScroll);}}
 function filtersToggled(open){if(open&&compact){manualExpanded=true;openedAt=window.scrollY;setCompact(false);}if(!open)manualExpanded=false;refreshSummary();requestAnimationFrame(updateStickyOffsets);}
 summary.onclick=()=>{const open=compact||body.classList.contains('hidden');if(open){manualExpanded=true;openedAt=window.scrollY;setCompact(false);}toggleMobileFilters(open);refreshSummary();};
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
 const observer=new ResizeObserver(()=>{updateStickyOffsets();schedule();});observer.observe(bar);
 window.ZZWS_STICKY={refreshSummary,filtersToggled};refreshSummary();schedule();
})();
