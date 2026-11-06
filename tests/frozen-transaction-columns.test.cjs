const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
test('live transaction table uses seven fixed-width aligned columns', () => {
  const ui=read('live-ui.js');
  const start=ui.indexOf('function transactionRows(list)');
  const end=ui.indexOf('function activity()',start);
  assert.ok(start>=0 && end>start);
  const view=ui.slice(start,end);
  assert.match(view,/transaction-table-scroll/);
  assert.match(view,/class="data-table transaction-table"/);
  assert.match(view,/tabindex="0"/);
  assert.match(view,/aria-label="Transaction table/);
  const colTags=(view.match(/<col class=/g)||[]).length;
  const heads=(view.match(/<th scope="col">/g)||[]).length + (view.match(/headerSort\(/g)||[]).length;
  assert.equal(colTags,7);
  assert.equal(heads,7);
  assert.match(view,/txn-inline-date/);
});
test('desktop freezes both left identity columns and right receipt links', () => {
  const css=read('styles.css');
  assert.match(css,/\.transaction-table-scroll\{[^}]*overflow-x:auto/);
  assert.match(css,/\.transaction-table\{[^}]*border-collapse:separate/);
  assert.match(css,/\.transaction-table tr>:nth-child\(1\)\{left:0\}/);
  assert.match(css,/\.transaction-table tr>:nth-child\(2\)\{left:154px\}/);
  assert.match(css,/\.transaction-table col\.txn-date-col\{width:154px\}/);
  assert.match(css,/\.transaction-table th:first-child,\.transaction-table td:first-child\{/);
  assert.match(css,/\.transaction-table tr>:last-child\{right:0/);
  assert.match(css,/\.transaction-table thead tr>:nth-child\(1\)/);
});
test('mobile does not freeze both edges and keeps the date in transaction details', () => {
  const css=read('styles.css');
  assert.match(css,/@media\(max-width:1100px\)\{[\s\S]*?\.transaction-table tr>:last-child\{position:static/);
  assert.match(css,/@media\(max-width:800px\)\{[\s\S]*?\.transaction-table tr>:first-child\{display:none\}/);
  assert.match(css,/@media\(max-width:800px\)\{[\s\S]*?\.transaction-table tr>:nth-child\(2\)\{left:0\}/);
  assert.match(css,/\.txn-inline-date\{display:inline\}/);
});
test('only the transaction table uses sticky freeze rules; app shell and PWA cache are versioned', () => {
  const css=read('styles.css'),ui=read('live-ui.js'),html=read('index.html'),sw=read('sw.js'),pkg=JSON.parse(read('package.json'));
  assert.equal((ui.match(/class="data-table transaction-table"/g)||[]).length,1);
  assert.doesNotMatch(css,/(?<!transaction-)\.data-table tr>:last-child\{position:sticky/);
  assert.equal(pkg.version,'0.3.9');
  for(const asset of ['live-ui.js','styles.css']) {
    assert.ok(html.includes(asset+'?v=0.3.9'));
    assert.ok(sw.includes(asset+'?v=0.3.9'));
  }
  assert.match(sw,/finance-hq-shell-v13/);
});
