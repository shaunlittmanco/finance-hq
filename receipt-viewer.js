/* Finance HQ private receipt viewer. No Drive API scope or public receipt copies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FinanceHQReceipts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  function approvedUrl(value) {
    try {
      const u = new URL(String(value));
      if (u.protocol !== 'https:' || u.username || u.password) return '';
      if (!['drive.google.com', 'docs.google.com'].includes(u.hostname)) return '';
      return u.href;
    } catch { return ''; }
  }
  function driveFileId(value) {
    const safe = approvedUrl(value);
    if (!safe) return '';
    const u = new URL(safe);
    if (u.hostname !== 'drive.google.com') return '';
    const filePath = /^\/file\/d\/([A-Za-z0-9_-]{10,160})(?:\/|$)/.exec(u.pathname);
    const id = filePath ? filePath[1] : (['/open', '/uc'].includes(u.pathname) ? u.searchParams.get('id') : '');
    return /^[A-Za-z0-9_-]{10,160}$/.test(id || '') ? id : '';
  }
  function previewUrl(value) {
    const id = driveFileId(value);
    return id ? 'https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview' : '';
  }
  function link(value, label) {
    const url = approvedUrl(value);
    if (!url) return '';
    return '<button type="button" class="receipt-preview-link" data-receipt-link="' +
      escapeHtml(url) + '" data-receipt-label="' + escapeHtml(label || 'View receipt') + '">' +
      escapeHtml(label || 'View receipt') + ' <span aria-hidden="true">↗</span></button>';
  }
  let dialog = null, previousFocus = null;
  function ensureDialog() {
    if (dialog && dialog.isConnected) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'fhq-receipt-dialog';
    dialog.setAttribute('aria-labelledby', 'fhqReceiptTitle');
    dialog.innerHTML = '<div class="fhq-receipt-shell">' +
      '<div class="fhq-receipt-head"><div><span class="fhq-receipt-kicker">PRIVATE RECEIPT · IN-APP VIEW</span>' +
      '<h2 id="fhqReceiptTitle">Receipt preview</h2></div>' +
      '<button type="button" class="fhq-receipt-close" data-receipt-close aria-label="Close receipt preview">Close ✕</button></div>' +
      '<div id="fhqReceiptBody" class="fhq-receipt-body"></div>' +
      '<div class="fhq-receipt-foot"><span>Private file. Google still checks your access. Nothing is made public or saved by Finance HQ.</span>' +
      '<a id="fhqReceiptOriginal" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Open original only if needed</a></div></div>';
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      document.getElementById('fhqReceiptBody')?.replaceChildren();
      document.body.classList.remove('fhq-receipt-open');
      if (previousFocus?.isConnected) previousFocus.focus();
      previousFocus = null;
    });
    dialog.addEventListener('click', e => {
      if (e.target === dialog) close();
    });
    return dialog;
  }
  function open(value, label) {
    const safe = approvedUrl(value);
    if (!safe || typeof document === 'undefined') return false;
    previousFocus = document.activeElement;
    const d = ensureDialog();
    const title = String(label || 'Receipt preview').replace(/\s*↗\s*$/, '');
    document.getElementById('fhqReceiptTitle').textContent = title;
    const original = document.getElementById('fhqReceiptOriginal');
    original.href = safe;
    const body = document.getElementById('fhqReceiptBody');
    body.replaceChildren();
    const target = previewUrl(safe);
    if (target && (typeof navigator === 'undefined' || navigator.onLine)) {
      const iframe = document.createElement('iframe');
      iframe.className = 'fhq-receipt-frame';
      iframe.title = 'Receipt preview from Google Drive';
      iframe.referrerPolicy = 'no-referrer';
      iframe.src = target;
      body.appendChild(iframe);
      const hint = document.createElement('p');
      hint.className = 'fhq-receipt-hint';
      hint.textContent = 'If the preview is blank or asks you to sign in, Google or your browser may block embedded private files. Use Open original only if needed.';
      body.appendChild(hint);
    } else {
      const note = document.createElement('div');
      note.className = 'fhq-receipt-unavailable';
      note.textContent = target ? 'You are offline. Reconnect to preview this private receipt.' :
        'This link is not a supported Google Drive file preview. You can open its original only if needed.';
      body.appendChild(note);
    }
    if (!d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
    document.body.classList.add('fhq-receipt-open');
    d.querySelector('[data-receipt-close]')?.focus();
    return true;
  }
  function close() {
    if (!dialog) return;
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      document.getElementById('fhqReceiptBody')?.replaceChildren();
      document.body.classList.remove('fhq-receipt-open');
    }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-receipt-link]');
      if (trigger) {
        event.preventDefault();
        event.stopPropagation();
        open(trigger.dataset.receiptLink, trigger.dataset.receiptLabel);
        return;
      }
      if (event.target.closest('[data-receipt-close]')) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    }, true);
  }
  return { approvedUrl, driveFileId, previewUrl, link, open, close };
});
