/* ==========================================================================
 * pages/dashboard.js — overview with stats, spending donut, income/expense
 * trend, and recent activity.
 * ========================================================================== */
window.App = window.App || {}
App.pages = App.pages || {}

App.pages.dashboard = (function () {
  let month = App.util.startOfMonth(new Date())

  function render() {
    const { el, money, monthLabel, startOfMonth, endOfMonth, addMonths, shortDate } = App.util
    const s = App.store
    const ui = App.ui
    const cats = s.categoryMap()
    const accts = s.accountMap()

    const monthTx = s.txInMonth(month)
    const totals = s.sumTotals(monthTx)
    const balance = s.totalBalance()

    // Spending by category → donut segments.
    const spend = s.spendByCategory(monthTx)
    const segments = [...spend.entries()]
      .map(([cid, value]) => {
        const c = cats.get(cid)
        return { label: c ? c.name : 'Uncategorized', value, color: c ? c.color : '#64748b' }
      })
      .sort((a, b) => b.value - a.value)

    // 6-month income/expense trend.
    const labels = []
    const income = []
    const expense = []
    for (let i = 5; i >= 0; i--) {
      const m = addMonths(month, -i)
      const start = startOfMonth(m).getTime()
      const end = endOfMonth(m).getTime()
      const inMonth = s.data.transactions.filter((t) => {
        const d = App.util.parseISO(t.occurred_on).getTime()
        return d >= start && d <= end
      })
      const tt = s.sumTotals(inMonth)
      labels.push(monthLabel(m).split(' ')[0].slice(0, 3))
      income.push(tt.income)
      expense.push(tt.expense)
    }

    const recent = s.data.transactions.slice(0, 6)

    const donutCard = el('div', { class: 'card pad' }, [
      el('div', { class: 'section-title' }, [ui.icon('budget', 18), 'Spending by category']),
      segments.length === 0
        ? el('p', { class: 'muted', style: { padding: '28px 0', textAlign: 'center' }, text: `No spending recorded for ${monthLabel(month)}.` })
        : el('div', { class: 'donut-wrap' }, [
            App.charts.donut(segments),
            el('ul', { class: 'legend' }, segments.slice(0, 6).map((seg) =>
              el('li', {}, [
                el('span', { class: 'lg-name' }, [
                  el('span', { class: 'dot', style: { background: seg.color } }),
                  el('span', { text: seg.label }),
                ]),
                el('strong', { text: money(seg.value) }),
              ]),
            )),
          ]),
    ])

    const trendCard = el('div', { class: 'card pad' }, [
      el('div', { class: 'section-title' }, [ui.icon('trending', 18), 'Income vs. expenses']),
      App.charts.bars({
        labels,
        series: [
          { name: 'Income', color: '#10b981', values: income },
          { name: 'Expenses', color: '#f43f5e', values: expense },
        ],
      }),
      el('div', { class: 'row-end', style: { gap: '16px', marginTop: '6px' } }, [
        legendDot('#10b981', 'Income'),
        legendDot('#f43f5e', 'Expenses'),
      ]),
    ])

    const recentCard = el('div', { class: 'card pad' }, [
      el('div', { class: 'section-title' }, [ui.icon('receipt', 18), 'Recent activity']),
      recent.length === 0
        ? ui.empty({ title: 'No transactions yet', description: 'Add your first transaction to see it here.' })
        : el('div', { class: 'list' }, recent.map((t) => {
            const c = t.category_id ? cats.get(t.category_id) : null
            const a = t.account_id ? accts.get(t.account_id) : null
            return el('div', { class: 'row' }, [
              el('div', { class: 'row-main' }, [
                ui.catBadge(c, 36),
                el('div', { style: { minWidth: 0 } }, [
                  el('div', { class: 'row-title', text: t.description || (c && c.name) || 'Transaction' }),
                  el('div', { class: 'row-sub', text: shortDate(t.occurred_on) + (a ? ' · ' + a.name : '') }),
                ]),
              ]),
              el('span', { class: 'amount ' + (t.kind === 'income' ? 'income' : ''), text: (t.kind === 'income' ? '+' : '−') + money(t.amount) }),
            ])
          })),
    ])

    return el('div', {}, [
      ui.pageHeader("Dashboard", "Your family's money at a glance.",
        ui.monthPicker(month, (m) => { month = m; App.rerender() })),
      el('div', { class: 'stat-grid' }, [
        ui.statCard({ label: 'Total balance', value: money(balance), hint: 'All accounts', tone: balance >= 0 ? '' : 'neg' }),
        ui.statCard({ label: 'Income', value: money(totals.income), hint: monthLabel(month).split(' ')[0], tone: 'pos' }),
        ui.statCard({ label: 'Expenses', value: money(totals.expense), hint: monthLabel(month).split(' ')[0], tone: 'neg' }),
        ui.statCard({ label: 'Net', value: money(totals.net), hint: 'Income − expenses', tone: totals.net >= 0 ? 'pos' : 'neg' }),
      ]),
      el('div', { class: 'grid-main' }, [donutCard, trendCard]),
      el('div', { style: { marginTop: '16px' } }, [recentCard]),
    ])
  }

  function legendDot(color, label) {
    return App.util.el('span', { class: 'lg-name', style: { fontSize: '0.8rem', color: 'var(--muted)' } }, [
      App.util.el('span', { class: 'dot', style: { background: color } }),
      label,
    ])
  }

  return render
})()
