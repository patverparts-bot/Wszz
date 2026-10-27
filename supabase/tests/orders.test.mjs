import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeLines,totalOf,changesBetween,parseConfirmation,parsePastedConfirmation,reportNumber,bank} from '../functions/zzws-api/orders.mjs';
const products=[{articul:'001',name:'First',wholesale:100,retail:150,kpPrice:90},{articul:'002',name:'Second',wholesale:200}];
test('customer order prices always come from permitted catalogue',()=>{
 const rows=normalizeLines([{articul:'001',qty:2,unitPrice:1}],products);assert.equal(rows[0].unitPrice,100);assert.equal(totalOf(rows),200);
 assert.throws(()=>normalizeLines([{articul:'private',qty:1}],products));
 assert.equal(normalizeLines([{articul:'001',qty:1}],products,[],false,'KP')[0].unitPrice,90);
});
test('quantities, duplicate articles, prices and payment are validated',()=>{
 for(const qty of [0,-1,1.2,10000])assert.throws(()=>normalizeLines([{articul:'001',qty}],products));
 assert.throws(()=>normalizeLines([{articul:'001',qty:1},{articul:'001',qty:2}],products));
 assert.throws(()=>normalizeLines([{articul:'001',qty:1,unitPrice:0}],products,[],true));
 assert.throws(()=>normalizeLines([{articul:'001',qty:1,paymentMethod:'unknown'}],products));
});
test('manual and file finalization detect removed, added and changed lines',()=>{
 const before=normalizeLines([{articul:'001',qty:2}],products);
 const after=normalizeLines([{articul:'001',qty:1,unitPrice:95},{articul:'002',qty:3}],products,before,true);
 assert.deepEqual(changesBetween(before,after).map(c=>c.kind),['changed','added']);assert.equal(totalOf(after),695);
 assert.equal(changesBetween(after,before)[1].kind,'changed');
 const deletedProduct=normalizeLines([{articul:'001',qty:1}],[],before,true);assert.equal(deletedProduct[0].unitPrice,100);
});
const pasted=`| **Ամսաթիվ** | **Կոդ** | **Մոդել** | **Արժեք (ըստ գնացուցակի) դրամ** | **Գնում** | | |
| :--- | :--- | :--- | :---: | :--- | - | --- |
| **Զեղչ %** | **Քանակ** | **Ընդհանուր արժեք Զեղչով  դրամ** | | | | |
| 27.10.2026 | 001 | Test product | 1,000 | 10 % | 1 | 900 |`;
test('user supplied Markdown layout uses discounted total rather than list price',()=>{
 const parsed=parsePastedConfirmation(pasted);assert.deepEqual(parsed.lines,[{articul:'001',qty:1,unitPrice:900}]);assert.equal(parsed.metadata.total,900);assert.equal(parsed.metadata.totalProvided,false);
});
test('merged Zigzag sales report stops before warranty table and reconciles control total',()=>{
 const top=Array(21).fill(null);Object.assign(top,{0:'Պատվիրատու',5:'Իրավաբանական անձ',13:'Պատվերի ընդհանուր գումար դրամ',16:'Տարադրամ',18:'Առաքման Տեսակ',19:'Առաքման օր',20:'Վճարման վերջնաժամկետ'});
 const values=Array(21).fill(null);Object.assign(values,{0:'Test client',5:'Test organisation',13:'900.00',16:'AMD',18:'Առաքում հասցեյով',19:'02/01/2026',20:'03/01/2026'});
 const header=Array(21).fill(null);Object.assign(header,{0:'Ամսաթիվ',3:'Կոդ',4:'Մոդել',7:'Արժեք (ըստ գնացուցակի) դրամ',11:'Գնում'});
 const sub=Array(21).fill(null);Object.assign(sub,{11:'Զեղչ %',14:'Քանակ',15:'Ընդհանուր արժեք Զեղչով դրամ'});
 const line=Array(21).fill(null);Object.assign(line,{0:'27.10.2026',3:'001',4:'Product',7:'1,000',11:'10 %',14:'1',15:'900'});
 const rows=[top,values,[],header,sub,line,[],['Կոդ','Մոդել',null,null,null,null,'Երաշխիքային քարտի N'],['001','Product',null,null,null,null,'Warranty']];
 const parsed=parseConfirmation(rows);assert.equal(parsed.lines.length,1);assert.equal(parsed.lines[0].unitPrice,900);assert.equal(parsed.delivery.date,'2026-01-02');assert.equal(parsed.delivery.paymentDeadline,'2026-01-03');
 values[13]='901';assert.throws(()=>parseConfirmation(rows),/Итог/);
});
test('plain tables preserve leading zeros and accept formatted numbers',()=>{
 const result=parsePastedConfirmation('Артикул\tКоличество\tЦена\n001\t2\t1,300.50');assert.equal(result.lines[0].articul,'001');assert.equal(result.lines[0].unitPrice,1300.5);
 for(const [raw,expected] of [['900.00',900],['9 000',9000],['1.234,50',1234.5]])assert.equal(reportNumber(raw),expected);
 assert.throws(()=>parsePastedConfirmation('not a table'));assert.throws(()=>parsePastedConfirmation('Артикул\tКоличество\n001\t1\n001\t2'));
});
