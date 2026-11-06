const test=require('node:test');
const assert=require('node:assert/strict');
const {sortTransactions,TRANSACTION_SORTS}=require('../sheet-sync.js');
const a={row:15,date:'2026-10-31',name:'Banana',amount:250,myShare:75,category:'Food',method:'GCash',split:{status:'incomplete',otherPortion:175}};
const b={row:20,date:'2026-11-06',name:'Apple',amount:300,myShare:150,category:'Travel',method:'Card',split:{status:'matched',otherPortion:150}};
const c={row:33,date:'',name:'Toyota installment',amount:null,myShare:null,category:'Installment',method:'Card',split:{status:'planned',otherPortion:null}};
const d={row:21,date:'2026-11-06',name:'Cherry',amount:50,myShare:25,category:'Food',method:'Cash',split:{status:'settlement',otherPortion:null}};
const data=[a,b,c,d];const names=arr=>arr.map(x=>x.name);
test('newest-first date default uses source-row tie break and puts unconfirmed last',()=>{
  assert.deepEqual(names(sortTransactions(data)),['Cherry','Apple','Banana','Toyota installment']);
});
test('oldest-first date puts unconfirmed last',()=>{
  assert.deepEqual(names(sortTransactions(data,'date-asc')),['Banana','Apple','Cherry','Toyota installment']);
});
test('amount sorting handles empty planned amounts last',()=>{
  assert.deepEqual(names(sortTransactions(data,'amount-desc')),['Apple','Banana','Cherry','Toyota installment']);
  assert.deepEqual(names(sortTransactions(data,'amount-asc')),['Cherry','Banana','Apple','Toyota installment']);
});
test('my share and computed other portion sort numeric correctly',()=>{
  assert.deepEqual(names(sortTransactions(data,'mine-desc')),['Apple','Banana','Cherry','Toyota installment']);
  assert.deepEqual(names(sortTransactions(data,'others-desc')),['Banana','Apple','Cherry','Toyota installment']);
});
test('merchant sort uses alphabetical collation',()=>{
  assert.deepEqual(names(sortTransactions(data,'name-asc')),['Apple','Banana','Cherry','Toyota installment']);
});
test('category and payment method sort without mutating original list',()=>{
  const before=[...data];sortTransactions(data,'category-asc');sortTransactions(data,'method-asc');
  assert.deepEqual(data,before);
});
test('split issues first, then matched, then offset and planned',()=>{
  assert.deepEqual(names(sortTransactions(data,'split-issues')),['Banana','Apple','Cherry','Toyota installment']);
});
test('unknown sort falls back to the safe default and whitelist is finite',()=>{
  assert.deepEqual(names(sortTransactions(data,'malicious-sort')),names(sortTransactions(data,'date-desc')));
  assert.ok(TRANSACTION_SORTS.includes('date-desc'));
  assert.ok(TRANSACTION_SORTS.includes('split-issues'));
});
