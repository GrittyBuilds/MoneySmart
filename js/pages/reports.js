/* ==========================================================================
 * pages/reports.js — flexible spending/income reports.
 * Filter by date range + kind, group by category / subcategory / tag /
 * vendor / account / month, view a ranked bar breakdown, and export CSV.
 * ========================================================================== */
window.App = window.App || {}
App.pages = App.pages || {}

App.pages.reports = (function () {
  let preset = 'this-month'
  let customFrom = ''
  let customTo = ''
  let kind = 'expense'
  let groupBy = 'category'

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

  // Resolve the active date window to { from, to } (either may be '' = open).
  function range() {
    const now = new Date()
    const y = now.getFullYear()
    const som = App.util.startOfMonth(now)
    const eom = App.util.endOfMonth(now)
    switch (preset) {
      case 'this-month': return { from: iso(som), to: iso(eom) }
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

  function filteredTx() {
    const { from, to } = range()
    return App.store.data.transactions.filter((t) => {
      if (kind !== 'all' && t.kind !== kind) return false
      if (from && t.occurred_on < from) return false
      if (to && t.occurred_on > to) return false
      return true
    })
  }

  // Build grouped rows: [{ key, label, color, amount, count }] sorted desc.
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
        add(key, App.util.monthLabel(App.util.parseISO(t.occurred_on + (t.occurred_on.length === 7 ? '-01' : ''))), '#8b5cf6', t.amount)
      }
    }

    const rows = [...map.values()]
    if (groupBy === 'month') rows.sort((a, b) => (a.key < b.key ? -1 : 1))
    else rows.sort((a, b) => b.amount - a.amount)
    return rows
  }

  function render() {
    const { el, money } = App.util
    const s = App.store
    const ui = App.ui

    const txns = filteredTx()
    const rows = buildGroups(txns)
    const txTotal = txns.reduce((sum, t) => sum + t.amount, 0)
    const rowsTotal = rows.reduce((sum, r) => sum + r.amount, 0)
    const maxAmount = rows.reduce((m, r) => Math.max(m, r.amount), 0)

    /* ---- Controls ---- */
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

    const controls = el('div', { class: 'card pad report-controls' }, [
      el('div', { class: 'report-filters' }, [
        el('div', { class: 'field', style: { margin: 0 } }, [el('label', { class: 'label', text: 'Period' }), presetSel]),
        el('div', { class: 'field', style: { margin: 0 } }, [el('label', { class: 'label', text: 'Group by' }), groupSel]),
        el('div', { class: 'field', style: { margin: 0 } }, [el('label', { class: 'label', text: 'Type' }), kindPills]),
      ]),
      preset === 'custom'
        ? el('div', { class: 'grid-2', style: { marginTop: '12px' } }, [
            el('div', { class: 'field', style: { margin: 0 } }, [el('label', { class: 'label', text: 'From' }), fromInput]),
            el('div', { class: 'field', style: { margin: 0 } }, [el('label', { class: 'label', text: 'To' }), toInput]),
          ])
        : null,
    ])

    /* ---- Summary ---- */
    const summary = el('div', { class: 'stat-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } }, [
      ui.statCard({ label: kind === 'income' ? 'Total income' : kind === 'all' ? 'Total' : 'Total spending', value: money(txTotal), tone: kind === 'income' ? 'pos' : kind === 'expense' ? 'neg' : 'default' }),
      ui.statCard({ label: 'Transactions', value: String(txns.length) }),
      ui.statCard({ label: groupDef().plural, value: String(rows.length) }),
    ])

    /* ---- Breakdown ---- */
    const breakdown = el('div', { class: 'card pad' }, [
      el('div', { class: 'report-head' }, [
        el('div', { class: 'section-title', style: { marginBottom: 0 } }, [ui.icon('report', 18), `By ${groupDef().label.toLowerCase()}`]),
        el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, [
          el('button', { class: 'btn ghost sm', onClick: () => exportSummary(rows) }, [ui.icon('download', 14), 'Summary CSV']),
          el('button', { class: 'btn ghost sm', onClick: () => exportTransactions(txns) }, [ui.icon('download', 14), 'Transactions CSV']),
        ]),
      ]),
      rows.length === 0
        ? ui.empty({ title: 'Nothing to report', description: 'No transactions match these filters yet.' })
        : el('div', { class: 'report-list' }, rows.map((r) => {
            const pct = rowsTotal > 0 ? (r.amount / rowsTotal) * 100 : 0
            const barW = maxAmount > 0 ? (r.amount / maxAmount) * 100 : 0
            return el('div', { class: 'report-row' }, [
              el('div', { class: 'report-line' }, [
                el('span', { class: 'report-label' }, [
                  el('span', { class: 'dot', style: { background: r.color } }),
                  el('span', { class: 'report-name', text: r.label }),
                ]),
                el('span', { class: 'report-amount', text: money(r.amount) }),
              ]),
              el('div', { class: 'report-bar' }, [el('span', { class: 'report-fill', style: { width: barW + '%', background: r.color } })]),
              el('div', { class: 'report-sub', text: `${pct.toFixed(1)}% · ${r.count} item${r.count === 1 ? '' : 's'}` }),
            ])
          })),
      groupBy === 'tag' && rows.length
        ? el('p', { class: 'faint', style: { fontSize: '12px', marginTop: '10px' }, text: 'A transaction with multiple tags is counted under each of its tags, so tag totals can exceed the overall total.' })
        : null,
    ])

    return el('div', {}, [
      ui.pageHeader('Reports', 'Slice your spending and income any way you like.'),
      el('div', { class: 'stack' }, [controls, summary, breakdown]),
    ])
  }

  function rangeLabel() {
    const { from, to } = range()
    if (!from && !to) return 'all-time'
    return `${from || 'start'}_to_${to || 'now'}`
  }

  function exportSummary(rows) {
    const header = [groupDef().label, 'Amount', 'Count']
    const body = rows.map((r) => [r.label, r.amount.toFixed(2), r.count])
    App.util.downloadCSV(`moneysmart-report-${groupBy}-${rangeLabel()}.csv`, [header, ...body])
    App.ui.toast('Summary exported', 'success')
  }

  function exportTransactions(txns) {
    const s = App.store
    const cats = s.categoryMap()
    const tags = s.tagMap()
    const accts = s.accountMap()
    const header = ['Date', 'Type', 'Amount', 'Category', 'Splits', 'Vendor', 'Description', 'Account', 'Tags']
    const rows = txns.map((t) => {
      const split = s.isSplit(t)
      const catName = split
        ? `Split (${t.splits.length})`
        : t.category_id ? (cats.get(t.category_id) || {}).name || '' : ''
      const splitsStr = split
        ? t.splits.map((sp) => `${(cats.get(sp.category_id) || {}).name || 'Uncategorized'}:${Number(sp.amount).toFixed(2)}`).join('; ')
        : ''
      const acctName = t.account_id ? (accts.get(t.account_id) || {}).name || '' : ''
      const tagNames = (t.tag_ids || []).map((id) => (tags.get(id) || {}).name).filter(Boolean).join('; ')
      return [t.occurred_on, t.kind, Number(t.amount).toFixed(2), catName, splitsStr, t.vendor || '', t.description || '', acctName, tagNames]
    })
    App.util.downloadCSV(`moneysmart-transactions-${rangeLabel()}.csv`, [header, ...rows])
    App.ui.toast('Transactions exported', 'success')
  }

  return render
})()
