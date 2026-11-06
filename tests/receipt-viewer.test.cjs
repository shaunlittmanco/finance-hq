const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const viewer = require('../receipt-viewer.js');
const ID = 'EXAMPLE_RECEIPT_FILE_0123456789';
const file = 'https://drive.google.com/file/d/' + ID + '/view?usp=sharing';
test('private Drive file links become same-site preview targets', () => {
  assert.equal(viewer.driveFileId(file), ID);
  assert.equal(viewer.previewUrl(file), 'https://drive.google.com/file/d/' + ID + '/preview');
  assert.equal(viewer.driveFileId('https://drive.google.com/open?id=' + ID), ID);
  assert.equal(viewer.driveFileId('https://drive.google.com/uc?id=' + ID), ID);
});
test('unsupported URL types never become embedded previews', () => {
  for (const url of [
    'http://drive.google.com/file/d/' + ID + '/view',
    'https://drive.google.com.evil.example/file/d/' + ID + '/view',
    'https://evil.example/file/d/' + ID + '/view',
    'https://drive.google.com/drive/u/0/folders/' + ID,
    'https://docs.google.com/spreadsheets/d/' + ID + '/edit',
    'javascript:alert(1)',
    'https://user@drive.google.com/file/d/' + ID + '/view'
  ]) assert.equal(viewer.previewUrl(url), '');
});
test('rendered receipt control does not navigate directly and escapes labels', () => {
  const html = viewer.link(file, 'Receipt <script>alert(1)</script> & more');
  assert.match(html, /<button/);
  assert.doesNotMatch(html, /<a[ >]/);
  assert.match(html, /data-receipt-link=/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp; more/);
  assert.equal(viewer.link('https://evil.example/image.png', 'Receipt'), '');
});
test('CSP permits only the approved embedded Google receipt domain', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.match(page, /frame-src https:\/\/accounts\.google\.com https:\/\/drive\.google\.com/);
  assert.ok(page.indexOf('receipt-viewer.js') < page.indexOf('live-ui.js'));
  assert.match(sw, /receipt-viewer\.js/);
});


test('hover preview waits for pointer intent and clears private iframe after mouse leaves', () => {
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(__dirname, '..', 'receipt-viewer.js'), 'utf8');
  const listeners = new Map(), pending = new Map();
  let nextTimer = 0, frameUrl = '', frameCleared = false, created = 0;
  const frame = {
    set src(value) { frameUrl = value; frameCleared = false; },
    removeAttribute(name) { if (name === 'src') { frameUrl = ''; frameCleared = true; } }
  };
  const labels = {
    '.fhq-hover-title': { textContent: '' },
    '[data-receipt-original]': { href: '' },
    'iframe': frame
  };
  const card = {
    hidden: true, isConnected: true, dataset: {}, style: {},
    setAttribute() {}, addEventListener() {},
    querySelector(selector) { return labels[selector]; },
    contains(element) { return element === card; }
  };
  const document = {
    body: { appendChild() {} },
    createElement() { created++; return card; },
    addEventListener(type, cb) { listeners.set(type, cb); }
  };
  const win = { matchMedia() { return { matches: true }; }, innerWidth: 1200, innerHeight: 820 };
  const code = { module: { exports: {} }, document, window: win, navigator: { onLine: true },
    URL, setTimeout(cb, delay) { const id = ++nextTimer; pending.set(id, { cb, delay }); return id; },
    clearTimeout(id) { pending.delete(id); }
  };
  vm.runInNewContext(src, code);
  const trigger = { dataset: { receiptLink: file, receiptLabel: 'Sample receipt' }, isConnected: true,
    closest() { return trigger; }, contains() { return false; },
    getBoundingClientRect() { return { left: 350, top: 170, bottom: 190 }; }
  };
  listeners.get('pointerover')({ pointerType: 'mouse', target: trigger, relatedTarget: null });
  assert.equal(created, 0, 'no iframe or popup should load immediately');
  assert.deepEqual([...pending.values()].map(t => t.delay), [350]);
  const show = [...pending.values()][0];
  pending.clear(); show.cb();
  assert.equal(created, 1);
  assert.equal(card.hidden, false);
  assert.equal(frameUrl, viewer.previewUrl(file));
  listeners.get('pointerout')({ pointerType: 'mouse', target: trigger, relatedTarget: null });
  assert.equal(frameCleared, false, 'frame should survive brief pointer travel');
  const hide = [...pending.values()][0];
  assert.equal(hide.delay, 260);
  pending.clear(); hide.cb();
  assert.equal(card.hidden, true);
  assert.equal(frameCleared, true, 'iframe URL must be removed after hover');
});
test('touch and coarse-pointer devices never open receipt hover iframe', () => {
  const vm = require('node:vm');
  const src = fs.readFileSync(path.join(__dirname, '..', 'receipt-viewer.js'), 'utf8');
  const listeners = new Map();
  let calls = 0;
  const ctx = {
    module: { exports: {} }, URL, navigator: { onLine: true },
    document: { addEventListener(type, cb) { listeners.set(type, cb); } },
    window: { matchMedia() { return { matches: false }; } },
    setTimeout() { calls++; return 1; }, clearTimeout() {}
  };
  vm.runInNewContext(src, ctx);
  const element = { closest() { return element; }, contains() { return false; } };
  listeners.get('pointerover')({ pointerType: 'touch', target: element, relatedTarget: null });
  listeners.get('pointerover')({ pointerType: 'mouse', target: element, relatedTarget: null });
  assert.equal(calls, 0);
});
