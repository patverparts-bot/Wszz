import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from '../functions/zzws-api/vendor/xlsx.mjs';
import {parsePrice,project,validateProfile,parseUsers} from '../functions/zzws-api/catalog.mjs';
const rows=()=>[
 ['Артикул','Brand','Group','Name','Զեղչված գին','Մանրածախ գին','Wholesale AMD',"Key Partner's AMD","Key Partner's promo AMD",'003','025'],
 ['1','LG','TV','LG TV',100,120,80,70,65,4,0],
 ['2','Miele','Home','Miele',100,100,80,70,0,4,0],
 ['3','Sony','Հեռուստացույց','Sony TV',100,100,80,70,0,4,0],
 ['4','Samsung','TV','Samsung',100,100,80,70,0,4,0]];
const user=(sheet='Dealers',role='client')=>({client:'Test',sheet,role,brands:['LG'],allBrands:false});
test('dealer receives only own price and no warehouse quantities',()=>{
 const data=project(parsePrice(rows()),user());assert.equal(data.length,4);assert.equal(data[0].wholesale,80);
 for(const p of data)for(const key of ['kp','kpPromo','kpPrice','stocks','targetWarehousesStock','resaleWholesale','ws'])assert.ok(!(key in p));
});
test('KP brands and promo price are enforced on server',()=>{
 const data=project(parsePrice(rows()),user('KP'));assert.deepEqual(data.map(p=>p.brand),['LG']);assert.equal(data[0].wholesale,65);
});
test('KP all brands still excludes Miele and Sony TV',()=>{
 const data=project(parsePrice(rows()),{...user('KP'),allBrands:true});assert.deepEqual(data.map(p=>p.brand),['LG','Samsung']);
});
test('admin receives both price types',()=>{const data=project(parsePrice(rows()),user('Dealers','admin'));assert.equal(data[0].kpPrice,65);assert.equal(data[0].wholesale,80);});
test('unknown columns are not exposed as prices or warehouses',()=>{
 const r=rows();r[0].push('Internal margin');r[1].push(999);const p=parsePrice(r);assert.ok(!('Internal margin' in p[0].stocks));assert.deepEqual(project(p,user()),project(parsePrice(rows()),user()));
});
test('duplicate articles and negative prices reject publication',()=>{
 const r=rows();r.push(r[1]);assert.throws(()=>parsePrice(r),/Կրկնվող/);const b=rows();b[1][6]=-1;assert.throws(()=>parsePrice(b),/Սխալ/);
});
test('bad headers reject publication',()=>assert.throws(()=>parsePrice([['Wrong'],[1]])));
test('KP without allowed brands gets empty catalogue',()=>assert.deepEqual(project(parsePrice(rows()),{...user('KP'),brands:[]}),[]));
test('manual profiles validate roles, groups and login',()=>{
 assert.equal(validateProfile({login:'Client-1',client:'Client'}).login,'client-1');
 assert.throws(()=>validateProfile({login:'a',client:'c',role:'root'}));assert.throws(()=>validateProfile({login:'a@example.com',client:'c'}));
});
test('user import rejects duplicates and assigns no administrator roles',()=>{
 const r=[['login','client','sheet','brands','allBrands','organization','address','contact'],['client','Client','KP','LG','no','','','']];
 assert.equal(parseUsers(r)[0].profile.role,'client');r.push(r[1]);assert.throws(()=>parseUsers(r),/Կրկնվող/);
});
test('vendored SheetJS round trips Unicode XLSX',()=>{
 assert.equal(XLSX.version,'0.20.3');const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows()),'Price');
 const raw=XLSX.write(book,{type:'array',bookType:'xlsx'});const restored=XLSX.read(raw,{type:'array'});
 assert.equal(parsePrice(XLSX.utils.sheet_to_json(restored.Sheets.Price,{header:1})).length,4);
});
