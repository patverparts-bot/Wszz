import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const scope={window:{}};vm.runInNewContext(fs.readFileSync('js/order-comparison.js','utf8'),scope);const model=scope.window.ZZWS_ORDER_COMPARE.model;
test('removed products stay in the original list and quantities retain both versions',()=>{
 const original=[{articul:'A',qty:5,unitPrice:100},{articul:'B',qty:1,unitPrice:200}],current=[{articul:'A',qty:4,unitPrice:95},{articul:'C',qty:2,unitPrice:10}];
 const rows=model(original,current);assert.equal(rows.length,3);assert.equal(rows[0].before.qty,5);assert.equal(rows[0].after.qty,4);assert.equal(rows[1].before.articul,'B');assert.equal(rows[1].after,null);assert.equal(rows[2].before,null);assert.equal(rows[2].after.articul,'C');assert.equal(original.length,2);assert.equal(original[0].qty,5);
});
