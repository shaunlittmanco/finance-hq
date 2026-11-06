const test=require('node:test');
const assert=require('node:assert/strict');
const {auditTransactionSplit}=require('../sheet-sync.js');
test('full swipe allocation includes omitted extra parties without changing source Others',()=>{
  const t={amount:1400,myShare:500,others:420,method:'Card'};
  const copy={...t};const x=auditTransactionSplit(t);
  assert.deepEqual(t,copy);
  assert.equal(x.status,'incomplete');
  assert.equal(x.otherPortion,900);
  assert.equal(x.recordedOthers,420);
  assert.equal(x.additional,480);
});
test('blank source H does not hide the full remaining bill portion',()=>{
  const x=auditTransactionSplit({amount:275.60,myShare:115.40,others:null,method:'GCash'});
  assert.equal(x.status,'incomplete');
  assert.equal(x.otherPortion,160.20);
  assert.equal(x.additional,160.20);
  assert.equal(x.recordedOthers,null);
});
test('a fully recorded split is kept as matched',()=>{
  const x=auditTransactionSplit({amount:920,myShare:250,others:670,method:'Card'});
  assert.equal(x.status,'matched');
  assert.equal(x.additional,0);
  assert.equal(x.otherPortion,670);
});
test('a purchase with no others can match a blank Others column',()=>{
  const x=auditTransactionSplit({amount:125,myShare:125,others:null});
  assert.equal(x.status,'matched');
  assert.equal(x.otherPortion,0);
});
test('net reimbursements and offsets are not fabricated as others bills',()=>{
  const t={amount:575,myShare:700,others:null,method:'Bank transfer'};
  const x=auditTransactionSplit(t);
  assert.equal(x.status,'settlement');
  assert.equal(x.otherPortion,null);
  assert.equal(x.recordedOthers,null);
});
test('other-paid merchant receipt is not implicitly a receivable',()=>{
  const x=auditTransactionSplit({amount:830,myShare:310,others:null,method:'Paid by another'});
  assert.equal(x.status,'incomplete');
  assert.equal(x.otherPortion,520);
  assert.equal(x.paidByOther,true);
});
test('rebates and estimates are not treated as shared-purchase shortfalls',()=>{
  assert.equal(auditTransactionSplit({amount:-1500,myShare:-1500,others:null}).status,'credit');
  assert.equal(auditTransactionSplit({amount:null,myShare:null,others:300}).status,'planned');
});
test('missing My Share remains flagged rather than automatically assigning all to others',()=>{
  const x=auditTransactionSplit({amount:599,myShare:null,others:null});
  assert.equal(x.status,'needs-review');
  assert.equal(x.otherPortion,null);
});
test('overallocated source H is flagged without overriding it',()=>{
  const x=auditTransactionSplit({amount:500,myShare:400,others:250});
  assert.equal(x.status,'overallocated');
  assert.equal(x.recordedOthers,250);
  assert.equal(x.otherPortion,100);
  assert.equal(x.additional,-150);
});
