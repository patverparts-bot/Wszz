import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {validateMemory} from '../functions/zzws-api/memory.mjs';
test('saved carts retain only order fields and numeric quantities',()=>{
 assert.deepEqual({...validateMemory('cart',{a:{qty:2,articul:'a',addedPrice:12,password:'discard',product:{secret:true}}})},{a:{qty:2,articul:'a',addedPrice:12,addedPriceMode:'WS',paymentMethod:''}});
 for(const qty of [-1,0,1.5,1000001,'2'])assert.throws(()=>validateMemory('cart',{a:{qty}}));
});
test('memory bounds and section whitelist',()=>{
 assert.throws(()=>validateMemory('role',{role:'admin'}));
 assert.throws(()=>validateMemory('history',new Array(21).fill({})));
 assert.throws(()=>validateMemory('favorites',[{}]));
 assert.deepEqual(validateMemory('favorites',['x','x']),['x']);
 assert.throws(()=>validateMemory('draft',{text:'x'.repeat(300001)}));
});
test('price sorting puts unavailable prices last in both directions',()=>{
 const scope={document:{addEventListener(){}},window:{addEventListener(){}}};vm.createContext(scope);vm.runInContext(fs.readFileSync(new URL('../../js/price-sort.js',import.meta.url),'utf8'),scope);
 const rows=[{articul:'zero',retail:0},{articul:'b',retail:20},{articul:'a',retail:10},{articul:'missing'}];
 assert.deepEqual([...rows].sort((a,b)=>scope.compareProductPrices(a,b,'retail',1)).map(x=>x.articul),['a','b','missing','zero']);
 assert.deepEqual([...rows].sort((a,b)=>scope.compareProductPrices(a,b,'retail',-1)).map(x=>x.articul),['b','a','missing','zero']);
});
test('column sorting survives server preference validation',()=>{
 const result=validateMemory('filters',{sortBy:'columnDesc',sortColumn:'retail'});
 assert.equal(result.sortBy,'columnDesc');assert.equal(result.sortColumn,'retail');
 assert.equal(validateMemory('filters',{sortBy:'columnAsc',sortColumn:'password'}).sortColumn,'wholesale');
});
