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

  // Hover is an explicit user gesture, not automatic background receipt fetching.
  // Delay iframe creation to avoid loading private files during incidental pointer movement.
  const HOVER_DELAY = 350, HIDE_DELAY = 260;
  let hoverCard = null, hoverTimer = null, hideTimer = null, activeHoverUrl = '', hoverAnchor = null;
  function clearTimer(which) {
    if (which === 'show' && hoverTimer !== null) { clearTimeout(hoverTimer); hoverTimer = null; }
    if (which === 'hide' && hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null; }
  }
  function canHover(event) {
    return typeof window !== 'undefined' &&
      !!window.matchMedia?.('(hover:hover) and (pointer:fine)').matches &&
      (!event?.pointerType || event.pointerType === 'mouse');
  }
  function ensureHoverCard() {
    if (hoverCard?.isConnected) return hoverCard;
    hoverCard = document.createElement('section');
    hoverCard.className = 'fhq-receipt-hover';
    hoverCard.hidden = true;
    hoverCard.setAttribute('role', 'region');
    hoverCard.setAttribute('aria-label', 'Receipt hover preview');
    hoverCard.innerHTML = '<div class="fhq-hover-head"><strong class="fhq-hover-title"></strong>' +
      '<div class="fhq-hover-actions"><button type="button" data-receipt-expand title="Expand receipt preview">Expand</button>' +
      '<button type="button" data-receipt-hover-close aria-label="Dismiss hover preview">✕</button></div></div>' +
      '<div class="fhq-hover-body"><iframe title="Private receipt preview from Google Drive" referrerpolicy="no-referrer"></iframe></div>' +
      '<div class="fhq-hover-foot"><span>Private Google Drive file · sign-in may be required</span>' +
      '<a data-receipt-original target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Original if needed</a></div>';
    document.body.appendChild(hoverCard);
    hoverCard.addEventListener('pointerenter', () => clearTimer('hide'));
    hoverCard.addEventListener('pointerleave', scheduleHide);
    return hoverCard;
  }
  function positionHover(anchor) {
    if (!hoverCard || !anchor?.isConnected || typeof window === 'undefined') return;
    const w = window.innerWidth || 1280, h = window.innerHeight || 800;
    const width = Math.min(520, w - 24), height = Math.min(530, h - 24);
    const rect = anchor.getBoundingClientRect();
    const left = Math.max(12, Math.min(rect.left, w - width - 12));
    let top = rect.bottom + 10;
    if (top + height > h - 12) top = rect.top - height - 10;
    if (top < 12 || top + height > h - 12) top = Math.max(12, Math.min(h - height - 12, rect.bottom + 10));
    hoverCard.style.width = width + 'px';
    hoverCard.style.height = height + 'px';
    hoverCard.style.left = left + 'px';
    hoverCard.style.top = top + 'px';
  }
  function hideHover() {
    clearTimer('show');
    clearTimer('hide');
    if (hoverCard) {
      hoverCard.hidden = true;
      hoverCard.querySelector('iframe')?.removeAttribute('src');
    }
    activeHoverUrl = '';
    hoverAnchor = null;
  }
  function scheduleHide() {
    clearTimer('show');
    clearTimer('hide');
    hideTimer = setTimeout(hideHover, HIDE_DELAY);
  }
  function showHover(anchor) {
    if (!anchor?.isConnected || (dialog && dialog.open)) return false;
    const value = anchor.dataset.receiptLink || anchor.dataset.receiptHover;
    const url = approvedUrl(value), target = previewUrl(url);
    if (!target || (typeof navigator !== 'undefined' && !navigator.onLine)) return false;
    const card = ensureHoverCard();
    const label = String(anchor.dataset.receiptLabel || anchor.dataset.receiptTitle || 'Receipt preview');
    card.querySelector('.fhq-hover-title').textContent = label;
    card.querySelector('[data-receipt-original]').href = url;
    card.dataset.receiptLink = url;
    card.dataset.receiptLabel = label;
    if (activeHoverUrl !== target) {
      card.querySelector('iframe').src = target;
      activeHoverUrl = target;
    }
    hoverAnchor = anchor;
    card.hidden = false;
    positionHover(anchor);
    return true;
  }
  function scheduleHover(anchor) {
    clearTimer('hide');
    if (hoverCard && !hoverCard.hidden && previewUrl(anchor.dataset.receiptLink || anchor.dataset.receiptHover) === activeHoverUrl) {
      hoverAnchor = anchor;
      positionHover(anchor);
      return;
    }
    clearTimer('show');
    hoverTimer = setTimeout(() => { hoverTimer = null; showHover(anchor); }, HOVER_DELAY);
  }
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
    hideHover();
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
    hideHover();
    if (!dialog) return;
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      document.getElementById('fhqReceiptBody')?.replaceChildren();
      document.body.classList.remove('fhq-receipt-open');
    }
  }
  if (typeof document !== 'undefined') {
    // Delegated handlers also work for transaction rows re-rendered after a Sheets refresh.
    document.addEventListener('pointerover', event => {
      if (!canHover(event) || hoverCard?.contains(event.target)) return;
      const anchor = event.target.closest('[data-receipt-link], [data-receipt-hover]');
      if (!anchor || (event.relatedTarget && anchor.contains(event.relatedTarget))) return;
      scheduleHover(anchor);
    }, true);
    document.addEventListener('pointerout', event => {
      if (!canHover(event) || hoverCard?.contains(event.target)) return;
      const anchor = event.target.closest('[data-receipt-link], [data-receipt-hover]');
      if (!anchor || (event.relatedTarget && (anchor.contains(event.relatedTarget) || hoverCard?.contains(event.relatedTarget)))) return;
      scheduleHide();
    }, true);
    document.addEventListener('scroll', () => {
      if (hoverCard && !hoverCard.hidden) hideHover();
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hideHover();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') hideHover();
    });
    document.addEventListener('click', event => {
      const expand = event.target.closest('[data-receipt-expand]');
      if (expand && hoverCard) {
        event.preventDefault();
        event.stopPropagation();
        open(hoverCard.dataset.receiptLink, hoverCard.dataset.receiptLabel);
        return;
      }
      const hoverClose = event.target.closest('[data-receipt-hover-close]');
      if (hoverClose) {
        event.preventDefault();
        event.stopPropagation();
        hideHover();
        return;
      }

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
  return { approvedUrl, driveFileId, previewUrl, link, open, close, hideHover };
});
