/* ==========================================================================
 * pages/reports.js — reports & printable statements.
 *  • Breakdown — group by category / subcategory / tag / vendor / account /
 *    month, with a ranked bar view and CSV export.
 *  • Profit & Loss — income vs expenses by category over the period.
 *  • Cash Flow — inflows / outflows / net change by month.
 * Any view can be printed to a branded, print-friendly document (→ PDF).
 * ========================================================================== */
window.App = window.App || {}
App.pages = App.pages || {}

App.pages.reports = (function () {
  let reportType = 'breakdown' // 'breakdown' | 'pl' | 'cashflow'
  let preset = 'this-month'
  let customFrom = ''
  let customTo = ''
  let kind = 'expense'
  let groupBy = 'category'

  const REPORT_TYPES = [
    { value: 'breakdown', label: 'Breakdown' },
    { value: 'pl', label: 'Profit & Loss' },
    { value: 'cashflow', label: 'Cash Flow' },
  ]
  const PRESETS = [
    { value: 'this-month', label: 'This month' },
    { value: 'last-month', label: 'Last month' },
    { value: 'this-year', label: 'This year' },
    { value: 'last-year', label: 'Last year' },
    { value: 'all', label: 'All time' },
    { value: 'custom', label: 'Custom' },
  ]
  const GROUPS = [
    { value: 'category', label: 'Category', plural: 'Categories' },
    { value: 'subcategory', label: 'Subcategory', plural: 'Subcategories' },
    { value: 'tag', label: 'Tag', plural: 'Tags' },
    { value: 'vendor', label: 'Vendor', plural: 'Vendors' },
    { value: 'account', label: 'Account', plural: 'Accounts' },
    { value: 'month', label: 'Month', plural: 'Months' },
  ]
  const groupDef = () => GROUPS.find((g) => g.value === groupBy)

  function pad(n) { return String(n).padStart(2, '0') }
  function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

  /* Resolve the active date window to { from, to } (either may be '' = open). */
  function range() {
    const now = new Date()
    const y = now.getFullYear()
    switch (preset) {
      case 'this-month': return { from: iso(App.util.startOfMonth(now)), to: iso(App.util.endOfMonth(now)) }
      case 'last-month': {
        const s = App.util.addMonths(now, -1)
        return { from: iso(App.util.startOfMonth(s)), to: iso(App.util.endOfMonth(s)) }
      }
      case 'this-year': return { from: `${y}-01-01`, to: `${y}-12-31` }
      case 'last-year': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
      case 'all': return { from: '', to: '' }
      case 'custom': return { from: customFrom, to: customTo }
      default: return { from: '', to: '' }
    }
  }

  function inRange(t) {
    const { from, to } = range()
    if (from && t.occurred_on < from) return false
    if (to && t.occurred_on > to) return false
    return true
  }
  const periodTx = () => App.store.data.transactions.filter(inRange)
  const filteredTx = () => periodTx().filter((t) => kind === 'all' || t.kind === kind)

  function periodLabel() {
    const { from, to } = range()
    if (!from && !to) return 'All time'
    const p = PRESETS.find((x) => x.value === preset)
    if (preset !== 'custom' && p) return p.label
    const fmt = (d) => (d ? App.util.prettyDate(d) : '—')
    return `${fmt(from)} – ${fmt(to)}`
  }

  /* Roll expense/income allocations up to the top-level category. */
  function catTotals(txns) {
    const s = App.store
    const cats = s.categoryMap()
    const map = new Map()
    for (const t of txns) {
      for (const a of s.allocations(t)) {
        const cat = a.category_id ? cats.get(a.category_id) : null
        const top = cat ? s.topLevelOf(cat) : null
        const key = top ? top.id : 'uncat'
        const e = map.get(key) || { name: top ? top.name : 'Uncategorized', color: top ? top.color : '#64748b', amount: 0 }
        e.amount += a.amount
        map.set(key, e)
      }
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount)
  }

  /* Group grouped-breakdown rows: [{ key, label, color, amount, count }]. */
  function buildGroups(txns) {
    const s = App.store
    const cats = s.categoryMap()
    const tags = s.tagMap()
    const accts = s.accountMap()
    const map = new Map()
    const add = (key, label, color, amount) => {
      const e = map.get(key) || { key, label, color, amount: 0, count: 0 }
      e.amount += amount
      e.count += 1
      map.set(key, e)
    }
    for (const t of txns) {
      if (groupBy === 'category' || groupBy === 'subcategory') {
        for (const a of s.allocations(t)) {
          const cat = a.category_id ? cats.get(a.category_id) : null
          if (groupBy === 'category') {
            const top = cat ? s.topLevelOf(cat) : null
            add(top ? top.id : 'uncat', top ? top.name : 'Uncategorized', top ? top.color : '#64748b', a.amount)
          } else {
            let label = 'Uncategorized'
            if (cat) {
              const parent = cat.parent_id ? cats.get(cat.parent_id) : null
              label = parent ? `${parent.name} › ${cat.name}` : cat.name
            }
            add(cat ? cat.id : 'uncat', label, cat ? cat.color : '#64748b', a.amount)
          }
        }
      } else if (groupBy === 'tag') {
        const ids = (t.tag_ids || []).filter((id) => tags.get(id))
        if (ids.length === 0) add('untagged', 'Untagged', '#64748b', t.amount)
        else ids.forEach((id) => { const tg = tags.get(id); add(tg.id, tg.name, tg.color, t.amount) })
      } else if (groupBy === 'vendor') {
        const v = (t.vendor || '').trim()
        add(v ? 'v:' + v.toLowerCase() : 'novendor', v || 'No vendor', '#159C6A', t.amount)
      } else if (groupBy === 'account') {
        const a = t.account_id ? accts.get(t.account_id) : null
        add(a ? a.id : 'noacct', a ? a.name : 'No account', '#3b82f6', t.amount)
      } else if (groupBy === 'month') {
        const key = t.occurred_on.slice(0, 7)
        add(key, App.util.monthLabel(App.util.parseISO(t.occurred_on)), '#8b5cf6', t.amount)
      }
    }
    const rows = [...map.values()]
    if (groupBy === 'month') rows.sort((a, b) => (a.key < b.key ? -1 : 1))
    else rows.sort((a, b) => b.amount - a.amount)
    return rows
  }

  /* Inflow/outflow per month across the period. */
  function cashflowMonths() {
    const map = new Map()
    for (const t of periodTx()) {
      const key = t.occurred_on.slice(0, 7)
      const e = map.get(key) || { key, label: App.util.monthLabel(App.util.parseISO(t.occurred_on)), inflow: 0, outflow: 0 }
      if (t.kind === 'income') e.inflow += t.amount
      else e.outflow += t.amount
      map.set(key, e)
    }
    return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1))
  }

  /* -------------------------------------------------------------------------- */
  function render() {
    const { el } = App.util
    const ui = App.ui

    const typeSeg = el('div', { class: 'segment', style: { maxWidth: '360px' } }, REPORT_TYPES.map((rt) =>
      el('button', { type: 'button', class: reportType === rt.value ? 'on' : '', text: rt.label, onClick: () => { reportType = rt.value; App.rerender() } })))

    const presetSel = el('select', { class: 'input' }, PRESETS.map((p) =>
      el('option', { value: p.value, text: p.label, selected: p.value === preset })))
    presetSel.addEventListener('change', () => { preset = presetSel.value; App.rerender() })

    const fromInput = el('input', { class: 'input', type: 'date', value: customFrom })
    const toInput = el('input', { class: 'input', type: 'date', value: customTo })
    fromInput.addEventListener('change', () => { customFrom = fromInput.value; App.rerender() })
    toInput.addEventListener('change', () => { customTo = toInput.value; App.rerender() })

    const groupSel = el('select', { class: 'input' }, GROUPS.map((g) =>
      el('option', { value: g.value, text: g.label, selected: g.value === groupBy })))
    groupSel.addEventListener('change', () => { groupBy = groupSel.value; App.rerender() })

    const kindPills = el('div', { class: 'pills' }, ['expense', 'income', 'all'].map((k) =>
      el('button', { class: kind === k ? 'on' : '', text: k, onClick: () => { kind = k; App.rerender() } })))

    const filterFields = [
      el('div', { class: 'field', style: { margin: 0 } }, [el('label', { class: 'label', text: 'Period' }), presetSel]),
    ]
    if (reportType === 'breakdown') {
      filterFields.push(el('div', { class: 'field', style: { margin: 0 } }, [el('label', { class: 'label', text: 'Group by' }), groupSel]))
      filterFields.push(el('div', { class: 'field', style: { margin: 0 } }, [el('label', { class: 'label', text: 'Type' }), kindPills]))
    }

    const controls = el('div', { class: 'card pad report-controls' }, [
      el('div', { class: 'field', style: { marginBottom: '12px' } }, [el('label', { class: 'label', text: 'Report' }), typeSeg]),
      el('div', { class: 'report-filters' }, filterFields),
      preset === 'custom'
        ? el('div', { class: 'grid-2', style: { marginTop: '12px' } }, [
            el('div', { class: 'field', style: { margin: 0 } }, [el('label', { class: 'label', text: 'From' }), fromInput]),
            el('div', { class: 'field', style: { margin: 0 } }, [el('label', { class: 'label', text: 'To' }), toInput]),
          ])
        : null,
    ])

    const body =
      reportType === 'pl' ? renderPL() :
      reportType === 'cashflow' ? renderCashflow() :
      renderBreakdown()

    return el('div', {}, [
      ui.pageHeader('Reports', 'Slice your money, or print a statement.'),
      el('div', { class: 'stack' }, [controls, body]),
    ])
  }

  function headerBar(title, buttons) {
    const { el } = App.util
    return el('div', { class: 'report-head' }, [
      el('div', { class: 'section-title', style: { marginBottom: 0 } }, [App.ui.icon('report', 18), title]),
      el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, buttons),
    ])
  }
  function printBtn(fn) {
    return App.util.el('button', { class: 'btn ghost sm', onClick: fn }, [App.ui.icon('report', 14), 'Print / PDF'])
  }
  function csvBtn(label, fn) {
    return App.util.el('button', { class: 'btn ghost sm', onClick: fn }, [App.ui.icon('download', 14), label])
  }

  /* -------------------------------- Breakdown ------------------------------- */
  function renderBreakdown() {
    const { el, money } = App.util
    const ui = App.ui
    const txns = filteredTx()
    const rows = buildGroups(txns)
    const txTotal = txns.reduce((s, t) => s + t.amount, 0)
    const rowsTotal = rows.reduce((s, r) => s + r.amount, 0)
    const maxAmount = rows.reduce((m, r) => Math.max(m, r.amount), 0)

    const summary = el('div', { class: 'stat-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '16px' } }, [
      ui.statCard({ label: kind === 'income' ? 'Total income' : kind === 'all' ? 'Total' : 'Total spending', value: money(txTotal), tone: kind === 'income' ? 'pos' : kind === 'expense' ? 'neg' : 'default' }),
      ui.statCard({ label: 'Transactions', value: String(txns.length) }),
      ui.statCard({ label: groupDef().plural, value: String(rows.length) }),
    ])

    const card = el('div', { class: 'card pad' }, [
      headerBar(`By ${groupDef().label.toLowerCase()}`, [
        printBtn(() => printBreakdown(rows, rowsTotal)),
        csvBtn('Summary CSV', () => exportSummary(rows)),
        csvBtn('Transactions CSV', () => exportTransactions(txns)),
      ]),
      rows.length === 0
        ? ui.empty({ title: 'Nothing to report', description: 'No transactions match these filters yet.' })
        : el('div', { class: 'report-list' }, rows.map((r) => {
            const pct = rowsTotal > 0 ? (r.amount / rowsTotal) * 100 : 0
            const barW = maxAmount > 0 ? (r.amount / maxAmount) * 100 : 0
            return el('div', { class: 'report-row' }, [
              el('div', { class: 'report-line' }, [
                el('span', { class: 'report-label' }, [el('span', { class: 'dot', style: { background: r.color } }), el('span', { class: 'report-name', text: r.label })]),
                el('span', { class: 'report-amount', text: money(r.amount) }),
              ]),
              el('div', { class: 'report-bar' }, [el('span', { class: 'report-fill', style: { width: barW + '%', background: r.color } })]),
              el('div', { class: 'report-sub', text: `${pct.toFixed(1)}% · ${r.count} item${r.count === 1 ? '' : 's'}` }),
            ])
          })),
      groupBy === 'tag' && rows.length
        ? el('p', { class: 'faint', style: { fontSize: '12px', marginTop: '10px' }, text: 'A transaction with multiple tags is counted under each tag, so tag totals can exceed the overall total.' })
        : null,
    ])
    return el('div', {}, [summary, card])
  }

  /* ----------------------------- Profit & Loss ------------------------------ */
  function plData() {
    const inc = catTotals(periodTx().filter((t) => t.kind === 'income'))
    const exp = catTotals(periodTx().filter((t) => t.kind === 'expense'))
    const totalIncome = inc.reduce((s, r) => s + r.amount, 0)
    const totalExpense = exp.reduce((s, r) => s + r.amount, 0)
    return { inc, exp, totalIncome, totalExpense, net: totalIncome - totalExpense }
  }

  function renderPL() {
    const { el, money } = App.util
    const d = plData()
    const stRows = (rows) => rows.map((r) => el('div', { class: 'st-row' }, [
      el('span', { class: 'st-name' }, [el('span', { class: 'dot', style: { background: r.color } }), r.name]),
      el('span', { class: 'st-amt', text: money(r.amount) }),
    ]))

    return el('div', { class: 'card pad' }, [
      headerBar('Profit & Loss', [printBtn(printPL), csvBtn('CSV', exportPL)]),
      el('p', { class: 'muted', style: { marginBottom: '14px' }, text: periodLabel() }),
      el('div', { class: 'statement' }, [
        el('div', { class: 'st-section-title', text: 'Income' }),
        ...(d.inc.length ? stRows(d.inc) : [el('div', { class: 'st-row muted', text: 'No income in this period.' })]),
        el('div', { class: 'st-row st-total' }, [el('span', { text: 'Total income' }), el('span', { class: 'st-amt', text: money(d.totalIncome) })]),

        el('div', { class: 'st-section-title', style: { marginTop: '18px' }, text: 'Expenses' }),
        ...(d.exp.length ? stRows(d.exp) : [el('div', { class: 'st-row muted', text: 'No expenses in this period.' })]),
        el('div', { class: 'st-row st-total' }, [el('span', { text: 'Total expenses' }), el('span', { class: 'st-amt', text: money(d.totalExpense) })]),

        el('div', { class: 'st-row st-net' }, [
          el('span', { text: d.net >= 0 ? 'Net profit' : 'Net loss' }),
          el('span', { class: 'st-amt ' + (d.net >= 0 ? 'pos' : 'neg'), text: money(d.net) }),
        ]),
      ]),
    ])
  }

  /* ------------------------------- Cash Flow -------------------------------- */
  function renderCashflow() {
    const { el, money } = App.util
    const months = cashflowMonths()
    const tIn = months.reduce((s, m) => s + m.inflow, 0)
    const tOut = months.reduce((s, m) => s + m.outflow, 0)

    const table = el('table', { class: 'rtable' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: 'Month' }),
        el('th', { class: 'num', text: 'Inflows' }),
        el('th', { class: 'num', text: 'Outflows' }),
        el('th', { class: 'num', text: 'Net change' }),
      ])]),
      el('tbody', {}, months.length
        ? months.map((m) => el('tr', {}, [
            el('td', { text: m.label }),
            el('td', { class: 'num pos', text: money(m.inflow) }),
            el('td', { class: 'num neg', text: money(m.outflow) }),
            el('td', { class: 'num ' + (m.inflow - m.outflow >= 0 ? 'pos' : 'neg'), text: money(m.inflow - m.outflow) }),
          ]))
        : [el('tr', {}, [el('td', { colspan: '4', class: 'muted', text: 'No cash movement in this period.' })])]),
      el('tfoot', {}, [el('tr', {}, [
        el('td', { text: 'Total' }),
        el('td', { class: 'num pos', text: money(tIn) }),
        el('td', { class: 'num neg', text: money(tOut) }),
        el('td', { class: 'num ' + (tIn - tOut >= 0 ? 'pos' : 'neg'), text: money(tIn - tOut) }),
      ])]),
    ])

    return el('div', { class: 'card pad' }, [
      headerBar('Cash Flow', [printBtn(printCashflow), csvBtn('CSV', exportCashflow)]),
      el('p', { class: 'muted', style: { marginBottom: '14px' }, text: periodLabel() }),
      el('div', { style: { overflowX: 'auto' } }, [table]),
    ])
  }

  /* -------------------------------------------------------------------------- */
  /* Printing                                                                   */
  /* -------------------------------------------------------------------------- */
  const esc = (v) => App.util.escapeHtml(v)
  const fmt = (n) => App.util.money(n)

  function printDoc(title, bodyHTML) {
    const hh = (App.store.data.household && App.store.data.household.name) || 'MoneySmart'
    let root = document.getElementById('print-root')
    if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root) }
    const mark = App.ui.logoMark(30).innerHTML
    root.innerHTML =
      `<div class="print-doc">
        <header class="print-head">
          <div class="print-brand"><span class="print-mark">${mark}</span><span class="print-word">Money<span>Smart</span></span></div>
          <div class="print-meta">
            <div class="print-hh">${esc(hh)}</div>
            <div class="print-title">${esc(title)}</div>
            <div class="print-period">${esc(periodLabel())}</div>
          </div>
        </header>
        ${bodyHTML}
        <footer class="print-foot">MoneySmart — Every dollar has a home.</footer>
      </div>`
    const done = () => { root.innerHTML = ''; window.removeEventListener('afterprint', done) }
    window.addEventListener('afterprint', done)
    window.print()
  }

  function tableHTML(headers, rows) {
    const head = headers.map((h) => `<th class="${h.num ? 'num' : ''}">${esc(h.label)}</th>`).join('')
    const body = rows.map((r) =>
      '<tr>' + r.map((c) => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${c.html || esc(c.text)}</td>`).join('') + '</tr>',
    ).join('')
    return `<table class="print-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
  }

  function printBreakdown(rows, total) {
    const body = tableHTML(
      [{ label: groupDef().label }, { label: 'Amount', num: true }, { label: '% of total', num: true }, { label: 'Items', num: true }],
      rows.map((r) => [
        { text: r.label },
        { text: fmt(r.amount), num: true },
        { text: (total > 0 ? (r.amount / total) * 100 : 0).toFixed(1) + '%', num: true },
        { text: String(r.count), num: true },
      ]).concat([[
        { html: '<b>Total</b>' },
        { html: '<b>' + esc(fmt(total)) + '</b>', num: true },
        { text: '', num: true },
        { text: '', num: true },
      ]]),
    )
    printDoc(`Spending by ${groupDef().label.toLowerCase()} (${kind})`, body)
  }

  function printPL() {
    const d = plData()
    const section = (title, rows, totalLabel, totalVal) =>
      `<h3 class="print-h">${esc(title)}</h3>` +
      tableHTML([{ label: 'Category' }, { label: 'Amount', num: true }],
        rows.map((r) => [{ text: r.name }, { text: fmt(r.amount), num: true }])
          .concat([[{ html: '<b>' + esc(totalLabel) + '</b>' }, { html: '<b>' + esc(fmt(totalVal)) + '</b>', num: true }]]))
    const net = `<table class="print-table print-net"><tbody><tr><td><b>${d.net >= 0 ? 'Net profit' : 'Net loss'}</b></td><td class="num"><b>${esc(fmt(d.net))}</b></td></tr></tbody></table>`
    printDoc('Profit & Loss Statement', section('Income', d.inc, 'Total income', d.totalIncome) + section('Expenses', d.exp, 'Total expenses', d.totalExpense) + net)
  }

  function printCashflow() {
    const months = cashflowMonths()
    const tIn = months.reduce((s, m) => s + m.inflow, 0)
    const tOut = months.reduce((s, m) => s + m.outflow, 0)
    const body = tableHTML(
      [{ label: 'Month' }, { label: 'Inflows', num: true }, { label: 'Outflows', num: true }, { label: 'Net change', num: true }],
      months.map((m) => [
        { text: m.label },
        { text: fmt(m.inflow), num: true },
        { text: fmt(m.outflow), num: true },
        { text: fmt(m.inflow - m.outflow), num: true },
      ]).concat([[
        { html: '<b>Total</b>' },
        { html: '<b>' + esc(fmt(tIn)) + '</b>', num: true },
        { html: '<b>' + esc(fmt(tOut)) + '</b>', num: true },
        { html: '<b>' + esc(fmt(tIn - tOut)) + '</b>', num: true },
      ]]),
    )
    printDoc('Cash Flow Statement', body)
  }

  /* -------------------------------------------------------------------------- */
  /* CSV exports                                                                */
  /* -------------------------------------------------------------------------- */
  function rangeLabel() {
    const { from, to } = range()
    if (!from && !to) return 'all-time'
    return `${from || 'start'}_to_${to || 'now'}`
  }
  function exportSummary(rows) {
    const header = [groupDef().label, 'Amount', 'Count']
    App.util.downloadCSV(`moneysmart-report-${groupBy}-${rangeLabel()}.csv`, [header, ...rows.map((r) => [r.label, r.amount.toFixed(2), r.count])])
    App.ui.toast('Summary exported', 'success')
  }
  function exportTransactions(txns) {
    const s = App.store
    const cats = s.categoryMap(), tags = s.tagMap(), accts = s.accountMap()
    const header = ['Date', 'Type', 'Amount', 'Category', 'Splits', 'Vendor', 'Description', 'Account', 'Tags']
    const rows = txns.map((t) => {
      const split = s.isSplit(t)
      const catName = split ? `Split (${t.splits.length})` : t.category_id ? (cats.get(t.category_id) || {}).name || '' : ''
      const splitsStr = split ? t.splits.map((sp) => `${(cats.get(sp.category_id) || {}).name || 'Uncategorized'}:${Number(sp.amount).toFixed(2)}`).join('; ') : ''
      const acctName = t.account_id ? (accts.get(t.account_id) || {}).name || '' : ''
      const tagNames = (t.tag_ids || []).map((id) => (tags.get(id) || {}).name).filter(Boolean).join('; ')
      return [t.occurred_on, t.kind, Number(t.amount).toFixed(2), catName, splitsStr, t.vendor || '', t.description || '', acctName, tagNames]
    })
    App.util.downloadCSV(`moneysmart-transactions-${rangeLabel()}.csv`, [header, ...rows])
    App.ui.toast('Transactions exported', 'success')
  }
  function exportPL() {
    const d = plData()
    const rows = [['Section', 'Category', 'Amount']]
    d.inc.forEach((r) => rows.push(['Income', r.name, r.amount.toFixed(2)]))
    rows.push(['Income', 'Total income', d.totalIncome.toFixed(2)])
    d.exp.forEach((r) => rows.push(['Expenses', r.name, r.amount.toFixed(2)]))
    rows.push(['Expenses', 'Total expenses', d.totalExpense.toFixed(2)])
    rows.push(['Net', d.net >= 0 ? 'Net profit' : 'Net loss', d.net.toFixed(2)])
    App.util.downloadCSV(`moneysmart-profit-loss-${rangeLabel()}.csv`, rows)
    App.ui.toast('P&L exported', 'success')
  }
  function exportCashflow() {
    const months = cashflowMonths()
    const rows = [['Month', 'Inflows', 'Outflows', 'Net change']]
    months.forEach((m) => rows.push([m.label, m.inflow.toFixed(2), m.outflow.toFixed(2), (m.inflow - m.outflow).toFixed(2)]))
    const tIn = months.reduce((s, m) => s + m.inflow, 0), tOut = months.reduce((s, m) => s + m.outflow, 0)
    rows.push(['Total', tIn.toFixed(2), tOut.toFixed(2), (tIn - tOut).toFixed(2)])
    App.util.downloadCSV(`moneysmart-cash-flow-${rangeLabel()}.csv`, rows)
    App.ui.toast('Cash flow exported', 'success')
  }

  return render
})()
