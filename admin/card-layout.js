(() => {
 const form=document.getElementById('userForm'),node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 form.classList.add('organized-user-card');
 const anchor=form.querySelector('fieldset');
 function group(title,fields){const box=node('fieldset');box.className='user-card-group';box.append(node('legend',title));for(const name of fields){const label=form.elements.namedItem(name)?.closest('label');if(label)box.append(label);}form.insertBefore(box,anchor);return box;}
 const identity=group('1. Հաշվի տվյալներ',['login','client','role','active']);
 const pricing=group('2. Գնային պայմաններ',['allowResale']);pricing.prepend(document.getElementById('clientPricingFields'));
 const credentials=group('Գաղտնաբառ և մուտքի հրավեր',['password']);for(const id of ['passwordSetupState','issueInvitation','resetUserPassword'])credentials.append(document.getElementById(id));
 const actions=node('div');actions.className='user-card-actions';for(const b of [...form.children].filter(n=>n.tagName==='BUTTON'))actions.append(b);form.append(actions);
 const copy=node('fieldset'),select=node('select'),apply=node('button','Կիրառել ընտրված հաճախորդի կարգավորումները'),info=node('p','Պատճենվում են միայն կատեգորիան և ապրանքների հասանելիությունը։ Անունը, մուտքանունը, կոնտակտները, գաղտնաբառը և աշխատակցի իրավունքները չեն պատճենվում։');copy.id='copyClientSettings';copy.append(node('legend','Կարգավորումների օրինակ'),select,info,apply);apply.type='button';select.setAttribute('aria-label','Կարգավորումների օրինակ ծառայող հաճախորդ');form.querySelector('h2').after(copy);
 let choices=[];
 apply.onclick=()=>{const source=choices.find(u=>u.id===select.value);if(!source)return;const value={role:'client',active:false};for(const key of ['sheet','brands','allBrands','allowResale','catalogAccess'])if(Object.hasOwn(source,key))value[key]=structuredClone(source[key]);editUser(value);document.getElementById('userTitle').textContent='Նոր հաճախորդ · կարգավորումների օրինակ՝ '+source.client;};
 const access=document.getElementById('userAccessEditor').closest('fieldset'),delivery=form.querySelector('.delivery-variant')?.closest('fieldset'),emails=[...form.querySelectorAll('legend')].find(e=>e.textContent==='Էլ․ փոստ՝ հաշվետվությունների համար')?.parentElement;
 const ordered=[form.querySelector('h2'),form.elements.namedItem('id'),copy,identity,pricing,access,delivery,emails,document.getElementById('clientReceiptControlPanel'),document.getElementById('adminRoleSetupNote'),document.getElementById('adminScopePanel'),document.getElementById('adminPollingPanel'),document.getElementById('adminChannelsPanel'),credentials].filter(Boolean);
 const remaining=[...form.children].filter(n=>!ordered.includes(n)&&n!==actions);form.replaceChildren(...ordered,...remaining,actions);
 window.ZZWS_CARD_LAYOUT={edit(user,users){choices=users.filter(u=>u.role==='client');copy.hidden=!!user.id||user.role==='admin';select.replaceChildren();for(const u of choices){const option=node('option',u.client+' — '+u.login);option.value=u.id;select.append(option);}apply.disabled=!choices.length;}};
})();
