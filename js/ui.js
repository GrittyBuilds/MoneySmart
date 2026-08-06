/* ==========================================================================
 * ui.js — shared UI building blocks: modal, confirm, toast, spinner, icons.
 * ========================================================================== */
window.App = window.App || {}

App.ui = (function () {
  const { el, clear } = App.util

  /* ---- Inline SVG icons (stroke-based, currentColor) ---- */
  const ICONS = {
    dashboard: '<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/>',
    tx: '<path d="M7 7h11M7 7l3-3M7 7l3 3M17 17H6M17 17l-3-3M17 17l-3 3"/>',
    budget: '<path d="M12 3a9 9 0 1 0 9 9M21 12A9 9 0 0 0 12 3v9z"/>',
    wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l2-3h12M17 13h2"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/>',
    settings: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    trending: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/>',
    report: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    backspace: '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="M18 9l-6 6M12 9l6 6"/>',
  }

  // The MoneySmart coin-with-growth-arc mark. Unique gradient ids per call so
  // multiple inline SVGs on one page don't collide.
  let markSeq = 0
  function logoMark(size = 40, { rounded = true } = {}) {
    const n = ++markSeq
    const rx = rounded ? 118 : 0
    const svg =
      `<svg viewBox="0 0 512 512" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<defs>` +
      `<linearGradient id="msbg${n}" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2FBF87"/><stop offset="1" stop-color="#159C6A"/></linearGradient>` +
      `<linearGradient id="msar${n}" x1="150" y1="330" x2="360" y2="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#159C6A"/><stop offset="1" stop-color="#2FBF87"/></linearGradient>` +
      `</defs>` +
      `<rect width="512" height="512" rx="${rx}" fill="url(#msbg${n})"/>` +
      `<circle cx="256" cy="256" r="156" fill="#fff"/>` +
      `<path d="M148 306 C 186 306, 206 322, 236 306 S 300 236, 336 188" fill="none" stroke="url(#msar${n})" stroke-width="30" stroke-linecap="round"/>` +
      `<path d="M300 176 L 352 168 L 348 220" fill="none" stroke="url(#msar${n})" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="176" cy="252" r="12" fill="#FFC94D"/>` +
      `<circle cx="228" cy="238" r="10" fill="#FF8A5B"/>` +
      `</svg>`
    const span = el('span', { class: 'logo-mark' })
    span.innerHTML = svg
    return span
  }

  // "MoneySmart" wordmark — Money in text color, Smart in brand green.
  function wordmark(size = '1rem', { reversed = false } = {}) {
    const w = el('span', { class: 'wordmark' + (reversed ? ' reversed' : ''), style: { fontSize: size } })
    w.innerHTML = '<span class="wm-money">Money</span><span class="wm-smart">Smart</span>'
    return w
  }

  function icon(name, size = 20) {
    const path = ICONS[name] || ''
    const svg =
      `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
      `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`
    const span = document.createElement('span')
    span.className = 'icon'
    span.innerHTML = svg
    return span
  }

  /* ---- Modal ---- */
  let modalRoot = null
  function modal({ title, body, onClose }) {
    closeModal() // remove any existing modal without firing the new one's onClose
    const dialog = el('div', { class: 'modal' }, [
      el('div', { class: 'modal-head' }, [
        el('h2', { text: title }),
        el('button', { class: 'icon-btn', 'aria-label': 'Close', onClick: () => close() }, [icon('close', 18)]),
      ]),
      el('div', { class: 'modal-body' }, body),
    ])
    modalRoot = el('div', {
      class: 'modal-overlay',
      onMousedown: (e) => {
        if (e.target === modalRoot) close()
      },
    }, [dialog])

    function esc(e) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', esc)
    document.body.appendChild(modalRoot)
    document.body.style.overflow = 'hidden'
    // Focus the first field flagged for autofocus (attribute alone is ignored
    // for dynamically inserted nodes).
    const af = dialog.querySelector('[autofocus]')
    if (af) setTimeout(() => af.focus(), 20)

    function close() {
      window.removeEventListener('keydown', esc)
      if (modalRoot && modalRoot.parentNode) modalRoot.parentNode.removeChild(modalRoot)
      document.body.style.overflow = ''
      modalRoot = null
      if (onClose) onClose()
    }
    return { close, dialog }
  }
  function closeModal() {
    if (modalRoot && modalRoot.parentNode) {
      modalRoot.parentNode.removeChild(modalRoot)
      document.body.style.overflow = ''
      modalRoot = null
    }
  }

  /* ---- Confirm (returns a Promise<boolean>) ---- */
  function confirm(message, { danger = true, okLabel = 'Delete' } = {}) {
    return new Promise((resolve) => {
      let decided = false
      const done = (val) => {
        if (decided) return
        decided = true
        m.close()
        resolve(val)
      }
      const m = modal({
        title: 'Please confirm',
        body: [
          el('p', { class: 'muted', text: message, style: { marginBottom: '1rem' } }),
          el('div', { class: 'row-end' }, [
            el('button', { class: 'btn ghost', text: 'Cancel', onClick: () => done(false) }),
            el('button', { class: danger ? 'btn danger' : 'btn primary', text: okLabel, onClick: () => done(true) }),
          ]),
        ],
        onClose: () => done(false),
      })
    })
  }

  /* ---- Toast ---- */
  function toast(message, type = 'info') {
    let host = App.util.$('#toasts')
    if (!host) {
      host = el('div', { id: 'toasts' })
      document.body.appendChild(host)
    }
    const t = el('div', { class: `toast ${type}`, text: message })
    host.appendChild(t)
    setTimeout(() => t.classList.add('show'), 10)
    setTimeout(() => {
      t.classList.remove('show')
      setTimeout(() => t.remove(), 250)
    }, 2600)
  }

  function spinner(label) {
    return el('div', { class: 'loader' }, [
      el('div', { class: 'spinner' }),
      label && el('p', { class: 'muted', text: label }),
    ])
  }

  function empty({ title, description, action }) {
    return el('div', { class: 'empty card' }, [
      el('div', { class: 'empty-icon' }, [icon('receipt', 26)]),
      el('h3', { text: title }),
      description && el('p', { class: 'muted', text: description }),
      action,
    ])
  }

  function pageHeader(title, subtitle, right) {
    return el('div', { class: 'page-head' }, [
      el('div', {}, [el('h1', { text: title }), subtitle && el('p', { class: 'muted', text: subtitle })]),
      right,
    ])
  }

  // Money-input field with a leading currency symbol.
  function moneyField(id, value, { autofocus = false } = {}) {
    const input = el('input', {
      id,
      type: 'number',
      step: '0.01',
      min: '0',
      class: 'input money-input',
      value: value != null && value !== '' ? String(value) : '',
      placeholder: '0.00',
    })
    if (autofocus) input.setAttribute('autofocus', '')
    return { wrap: el('div', { class: 'money-wrap' }, [el('span', { class: 'money-sign', text: '$' }), input]), input }
  }

  function statCard({ label, value, hint, tone }) {
    return el('div', { class: `stat ${tone || ''}` }, [
      el('div', { class: 'stat-label', text: label }),
      el('div', { class: 'stat-value', text: value }),
      hint && el('div', { class: 'stat-hint', text: hint }),
    ])
  }

  function monthPicker(date, onChange, { allowFuture = false } = {}) {
    const { monthLabel, addMonths, sameMonth } = App.util
    const atCurrent = sameMonth(date, new Date())
    return el('div', { class: 'month-picker' }, [
      el('button', { 'aria-label': 'Previous month', onClick: () => onChange(addMonths(date, -1)) }, [icon('chevronLeft', 16)]),
      el('span', { class: 'm-label', text: monthLabel(date) }),
      el('button', {
        'aria-label': 'Next month',
        disabled: !allowFuture && atCurrent,
        onClick: () => onChange(addMonths(date, 1)),
      }, [icon('chevronRight', 16)]),
    ])
  }

  // Coloured square badge showing a category's initials.
  function catBadge(cat, size = 40) {
    const color = (cat && cat.color) || '#64748b'
    return el('span', {
      class: 'avatar',
      style: { background: color + '22', color, width: size + 'px', height: size + 'px' },
      text: ((cat && cat.name) || '?').slice(0, 2).toUpperCase(),
    })
  }

  return {
    icon, logoMark, wordmark, modal, closeModal, confirm, toast, spinner, empty, pageHeader, clear,
    moneyField, statCard, monthPicker, catBadge,
  }
})()
