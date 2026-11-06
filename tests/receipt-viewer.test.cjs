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
