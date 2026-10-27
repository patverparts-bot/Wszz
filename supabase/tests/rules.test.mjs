import test from 'node:test';
import assert from 'node:assert/strict';
import { project,validateProfile } from '../functions/zzws-api/catalog.mjs';
import { defaultRules,validateRules,validateAccess,permits,selectPrice,validPassword,validateContacts } from '../functions/zzws-api/rules.mjs';
import { parseUsers } from '../functions/zzws-api/catalog.mjs';
const item=(brand='LG',category='TV',changes={})=>({articul:brand+'-'+category,brand,category,name:'Product',ws:80,kp:70,kpPromo:65,retail:100,base:120,stocks:{'003':4},...changes});
const user=(sheet='Dealers',catalogAccess)=>({role:'client',sheet,client:'Client',allBrands:true,brands:[],...(catalogAccess?{catalogAccess}:{})});
const access=(include=[],exclude=[],mode='selected')=>({mode,include,exclude});
const pair=(brand='',category='',categoryMatch='exact')=>({brand,category,categoryMatch});
test('Dealers include linked brand/category pairs with AND within each pair',()=>{
 const rules=access([pair('LG','TV'),pair('Samsung','Washing')]);
 const data=project([item('LG','TV'),item('LG','Washing'),item('Samsung','TV'),item('Samsung','Washing')],user('Dealers',rules));
 assert.deepEqual(data.map(p=>p.articul),['LG-TV','Samsung-Washing']);
});
test('category-only and brand-only permissions use explicit wildcard',()=>{
 const a=access([pair('','TV'),pair('LG','')]);
 assert.equal(project([item('Samsung','TV'),item('LG','Washing'),item('Samsung','Washing')],user('Dealers',a)).length,2);
});
test('exclusion wins over a linked permission',()=>{
 const a=access([pair('LG','')],[pair('LG','TV')]);
 assert.deepEqual(project([item('LG','TV'),item('LG','Washing')],user('Dealers',a)).map(p=>p.category),['Washing']);
});
test('brand and category exclusions independently hide matching products',()=>{
 const a=access([],[pair('LG',''),pair('','Washing')],'all');
 assert.deepEqual(project([item('LG','TV'),item('Samsung','Washing'),item('Samsung','TV')],user('Dealers',a)).map(p=>p.articul),['Samsung-TV']);
});
test('empty selected list denies everything for either group',()=>{
 for(const sheet of ['KP','Dealers'])assert.deepEqual(project([item()],user(sheet,access())),[]);
});
test('group and personal restrictions intersect',()=>{
 const g=defaultRules();g.Dealers.access=access([pair('','TV')]);
 assert.deepEqual(project([item('LG','TV'),item('LG','Washing'),item('Samsung','TV')],user('Dealers',access([pair('LG','')])),g).map(p=>p.articul),['LG-TV']);
});
test('legacy Dealers ignore legacy KP brand list until explicit access rules are saved',()=>{
 assert.equal(project([item()],{...user(),allBrands:false,brands:[]}).length,1);
});
test('legacy KP remains deny-by-default with no permitted brands',()=>assert.deepEqual(project([item()],{...user('KP'),allBrands:false,brands:[]}),[]));
test('default global KP exclusions remain, and can be edited explicitly',()=>{
 const p=[item('Miele'),item('Sony','Հեռուստացույցեր')];assert.equal(project(p,user('KP')).length,0);
 const g=defaultRules();g.KP.access.exclude=[];assert.equal(project(p,user('KP'),g).length,2);
});
test('Unicode names are matched without losing Cyrillic categories',()=>{
 const a=validateAccess(access([pair('LG','Телевизоры')]));
 assert.ok(permits(item('lg','Телевизоры'),a));assert.ok(!permits(item('LG','Холодильники'),a));
});
test('contains-category matching is explicit and cannot override brand scope',()=>{
 const a=access([pair('Sony','Հեռուստացույց','contains')]);assert.ok(permits(item('Sony','Հեռուստացույցեր'),a));assert.ok(!permits(item('LG','Հեռուստացույցեր'),a));
});
test('invalid and accidentally universal pairs are rejected',()=>{
 assert.throws(()=>validateAccess(access([pair()])));assert.throws(()=>validateAccess(access([pair('!!!','')])));assert.throws(()=>validateAccess({mode:'typo'}));
});
test('profile validation retains canonical access for either group',()=>{
 for(const sheet of ['KP','Dealers'])assert.deepEqual(validateProfile({login:'client',client:'Client',sheet,catalogAccess:access([pair('LG','TV')])}).profile.catalogAccess,access([pair('LG','TV')]));
});
test('default price selection is KP promo, KP normal, then WS; Dealers only WS',()=>{
 const d=defaultRules();assert.equal(selectPrice(item(),d.KP.pricing).price,65);
 assert.equal(selectPrice(item('LG','TV',{kpPromo:0}),d.KP.pricing).price,70);
 assert.equal(selectPrice(item('LG','TV',{kpPromo:0,kp:0}),d.KP.pricing).price,80);
 assert.equal(selectPrice(item(),d.Dealers.pricing).price,80);
});
test('first, min and max consider only positive prices',()=>{
 const p=item('LG','TV',{kpPromo:0}),r={...defaultRules().KP.pricing,sources:['ws','kpPromo','kp']};
 assert.equal(selectPrice(p,r).price,80);assert.equal(selectPrice(p,{...r,mode:'min'}).price,70);assert.equal(selectPrice(p,{...r,mode:'max'}).price,80);
});
test('percentage adjustment is applied before optional rounding',()=>{
 const r={...defaultRules().Dealers.pricing,adjustmentPercent:7,roundTo:10};assert.equal(selectPrice(item(),r).price,90);
});
test('legacy default prices do not lose precision',()=>assert.equal(selectPrice(item('LG','TV',{ws:80.12345}),defaultRules().Dealers.pricing).price,80.12345));
test('no usable source never produces a free or fallback retail price',()=>{
 const g=defaultRules();g.Dealers.pricing.sources=['kp'];assert.equal(project([item('LG','TV',{kp:0})],user(),g).length,0);
});
test('hide-above-retail can be changed explicitly',()=>{
 const g=defaultRules(),p=item('LG','TV',{ws:150});assert.equal(project([p],user(),g).length,0);g.Dealers.pricing.hideAboveRetail=false;assert.equal(project([p],user(),g)[0].wholesale,150);
});
test('group price policy never exposes unselected price columns',()=>{
 const g=defaultRules();g.Dealers.pricing.sources=['kpPromo'];const p=project([item()],user(),g)[0];assert.equal(p.wholesale,65);assert.equal(p.isWholesalePromo,true);
 for(const k of ['kp','kpPrice','kpPromo','ws','base','stocks'])assert.ok(!(k in p));
});
test('administrator keeps original raw KP and WS columns',()=>{
 const g=defaultRules();g.Dealers.pricing.sources=['retail'];g.Dealers.access=access();
 const p=project([item('LG','TV',{kpPromo:0,kp:0})],{...user(),role:'admin'},g)[0];assert.equal(p.wholesale,80);assert.equal(p.kpPrice,0);
});
test('invalid price policies cannot silently reset to defaults',()=>{
 for(const sources of [[],['ws','ws'],['secret']]){const g=defaultRules();g.KP.pricing.sources=sources;assert.throws(()=>validateRules(g));}
 const g=defaultRules();g.KP.pricing.adjustmentPercent=-100;assert.throws(()=>validateRules(g));
});
test('passwords require at least six ASCII digits, including leading zeroes',()=>{
 for(const value of ['001234','123456','123456789012'])assert.equal(validPassword(value),true);
 for(const value of ['12345','12345a','123 456','１２３４５６','abcdef','',123456])assert.equal(validPassword(value),false);
});
test('three complete contact variants retain their associations',()=>{
 const rows=[1,2,3].map(i=>({organization:'Company '+i,address:'Address '+i,contact:'Phone '+i}));
 assert.deepEqual(validateProfile({login:'client',client:'Client',rowsList:rows}).profile.rowsList,rows);
 assert.throws(()=>validateContacts([...rows,rows[0]],'Client'),/трёх/);
});
test('unused contact variants are omitted without inventing additional options',()=>{
 assert.deepEqual(validateContacts([{organization:'First',address:'Address',contact:'Phone'},{organization:'',address:'',contact:''}],'Client'),[{organization:'First',address:'Address',contact:'Phone'}]);
 assert.deepEqual(validateContacts([{organization:'',address:'Only address',contact:'000123'}],'Client'),[{organization:'Client',address:'Only address',contact:'000123'}]);
});
test('three-variant spreadsheet import accepts all organisation, address and contact columns',()=>{
 const data=[['login','client','sheet','brands','allBrands','organization','address','contact','organization2','address2','contact2','organization3','address3','contact3'],['client','Client','Dealers','','no','A','AA','001','B','BB','002','C','CC','003']];
 const imported=parseUsers(data)[0];assert.deepEqual(imported.profile.rowsList,[{organization:'A',address:'AA',contact:'001'},{organization:'B',address:'BB',contact:'002'},{organization:'C',address:'CC',contact:'003'}]);assert.equal(imported.preserveExtraContacts,false);
});
test('legacy spreadsheet imports explicitly preserve additional saved contact variants',()=>{
 const data=[['login','client','sheet','brands','allBrands','organization','address','contact'],['client','Client','KP','LG','no','A','AA','001']];
 assert.equal(parseUsers(data)[0].preserveExtraContacts,true);
});
