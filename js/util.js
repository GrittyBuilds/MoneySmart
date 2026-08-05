/* ==========================================================================
 * util.js — tiny helpers shared across the app (DOM, money, dates, ids).
 * Attaches to the global `App` namespace. No build step, no dependencies.
 * ========================================================================== */
window.App = window.App || {}

App.util = (function () {
  /* ---- DOM ---- */
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))

  /**
   * Create an element. `attrs` supports: class, html, text, dataset, style,
   * on{Event} handlers, and any other attribute. `children` is a node or array.
   */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue
      if (k === 'class') node.className = v
      else if (k === 'html') node.innerHTML = v
      else if (k === 'text') node.textContent = v
      else if (k === 'dataset') Object.assign(node.dataset, v)
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v)
      else if (k.startsWith('on') && typeof v === 'function')
        node.addEventListener(k.slice(2).toLowerCase(), v)
      else node.setAttribute(k, v)
    }
    for (const child of [].concat(children)) {
      if (child == null || child === false) continue
      node.append(child.nodeType ? child : document.createTextNode(String(child)))
    }
    return node
  }

  const clear = (node) => {
    while (node.firstChild) node.removeChild(node.firstChild)
    return node
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
    )
  }

  /* ---- Money ---- */
  let currency = 'USD'
  const setCurrency = (c) => (currency = c || 'USD')
  const getCurrency = () => currency

  function money(n) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(n) || 0)
  }
  function moneyCompact(n) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number(n) || 0)
  }
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

  /* ---- Dates (vanilla, no libraries) ---- */
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const pad = (n) => String(n).padStart(2, '0')
  // Parse a YYYY-MM-DD string as a *local* date (avoids UTC off-by-one).
  function parseISO(iso) {
    const [y, m, d] = String(iso).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }
  const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const todayISO = () => toISO(new Date())

  const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
  const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const addMonths = (date, n) => new Date(date.getFullYear(), date.getMonth() + n, 1)
  const monthKey = (date) => toISO(startOfMonth(date))
  const sameMonth = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()

  function monthLabel(date) {
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
  }
  function prettyDate(iso) {
    const d = parseISO(iso)
    return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`
  }
  function shortDate(iso) {
    const d = parseISO(iso)
    return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`
  }

  /* ---- Misc ---- */
  function uid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID()
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
  function inviteCode() {
    return Math.random().toString(36).slice(2, 10)
  }

  /** Trigger a client-side download of `obj` as a pretty-printed JSON file. */
  function downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = el('a', { href: url, download: filename })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return {
    $, $$, el, clear, escapeHtml,
    money, moneyCompact, round2, setCurrency, getCurrency,
    parseISO, toISO, todayISO, startOfMonth, endOfMonth, addMonths,
    monthKey, sameMonth, monthLabel, prettyDate, shortDate,
    uid, inviteCode, downloadJSON,
  }
})()
