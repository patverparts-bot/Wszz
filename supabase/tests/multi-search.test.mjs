import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const scope={window:{}};vm.runInNewContext(fs.readFileSync('js/multi-search.js','utf8'),scope);const compile=scope.window.ZZWS_MULTI_SEARCH.compile;
const products=[{articul:'001',name:'Samsung UE85M70HAUXPY'},{articul:'002',name:'LG OLED C4'},{articul:'003',name:'Samsung Small TV'}];
test('multiple articles separated by spaces or commas return union with missing terms',()=>{
 for(const query of ['001 002 missing','001,002,missing']){const result=compile(query,products);assert.deepEqual([...result.matches],['001','002']);assert.equal(result.missing[0].text,'missing');}
});
test('full model names with spaces stay together while independent models are combined',()=>{
 assert.deepEqual([...compile('Samsung UE85M70HAUXPY LG OLED C4',products).matches],['001','002']);assert.equal(compile('Samsung UE85M70HAUXPY LG OLED C4',products).parts.length,2);
 assert.deepEqual([...compile('Samsung UE85M70HAUXPY, LG OLED C4',products).matches],['001','002']);
});
test('highlight ranges preserve the original text and matching is case insensitive',()=>{
 const q=' 001,  missing model , lg oled c4 ';const result=compile(q,products);assert.equal(result.missing.length,1);assert.equal(q.slice(result.missing[0].start,result.missing[0].end),'missing model');assert.deepEqual([...result.matches],['001','002']);
});
