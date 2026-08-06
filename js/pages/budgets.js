/* ==========================================================================
 * pages/budgets.js — per-category monthly limits with progress bars.
 * ========================================================================== */
window.App = window.App || {}
App.pages = App.pages || {}

App.pages.budgets = (function () {
  let month = App.util.startOfMonth(new Date())

  function render() {
    const { el, monthKey } = App.util
    const ui = App.ui
    const container = el('div', {})

    const header = ui.pageHeader('Budgets', 'Set a monthly limit per category.',
      ui.monthPicker(month, (m) => { month = m; App.rerender() }))
    container.appendChild(header)

    const body = el('div', {}, [ui.spinner('Loading budgets…')])
    container.appendChild(body)

    // Load this month's budgets, then paint.
    App.store.getBackend().listBudgets(monthKey(month)).then((budgets) => {
      paint(body, budgets)
    }).catch((e) => {
      ui.clear(body).appendChild(el('div', { class: 'notice error', text: e.message || 'Failed to load budgets' }))
    })

    return container
  }

  function paint(body, budgets) {
    const { el, money, monthKey } = App.util
    const s = App.store
    const ui = App.ui
    const monthTx = s.txInMonth(month)
    const spend = s.spendByCategory(monthTx)
    const budgetMap = new Map(budgets.map((b) => [b.category_id, b.amount]))
    const cats = s.expenseCategories()

    // Keep parent → subcategory order so the hierarchy reads top to bottom.
    const rows = s.orderedCategories('expense').map(({ cat, depth }) => ({
      cat,
      depth,
      budget: budgetMap.get(cat.id) || 0,
      spent: spend.get(cat.id) || 0,
    }))

    let budgeted = 0
    let spent = 0
    rows.forEach((r) => { budgeted += r.budget; if (r.budget > 0) spent += r.spent })
    const remaining = budgeted - spent

    ui.clear(body)
    body.appendChild(el('div', { class: 'stat-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } }, [
      ui.statCard({ label: 'Budgeted', value: money(budgeted) }),
      ui.statCard({ label: 'Spent', value: money(spent), tone: 'neg' }),
      ui.statCard({ label: 'Remaining', value: money(remaining), tone: remaining >= 0 ? 'pos' : 'neg' }),
    ]))

    if (cats.length === 0) {
      body.appendChild(el('div', { style: { marginTop: '16px' } }, [
        ui.empty({ title: 'No expense categories', description: 'Add categories on the Family page to start budgeting.' }),
      ]))
      return
    }

    const list = el('div', { class: 'stack', style: { marginTop: '16px' } }, rows.map((r) => budgetRow(r)))
    body.appendChild(list)

    function budgetRow({ cat, depth, budget, spent }) {
      const has = budget > 0
      const pct = has ? Math.min(100, (spent / budget) * 100) : 0
      const over = has && spent > budget
      const barColor = over ? '#E5556E' : pct > 80 ? '#FFC94D' : cat.color

      return el('div', { class: 'card budget-row' + (depth ? ' sub' : '') }, [
        el('div', { class: 'budget-top' }, [
          el('div', { class: 'budget-cat' }, [
            depth ? el('span', { class: 'cat-branch', text: '↳' }) : null,
            el('span', { class: 'dot', style: { background: cat.color } }),
            cat.name,
          ]),
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
            el('span', { class: 'budget-nums', html: money(spent) + (has ? ` <span class="of">/ ${money(budget)}</span>` : '') }),
            el('button', { class: 'icon-btn', 'aria-label': 'Set budget', onClick: () => openBudget(cat, budget) }, [ui.icon('edit', 16)]),
          ]),
        ]),
        has
          ? el('div', {}, [
              el('div', { class: 'progress' }, [el('span', { style: { width: pct + '%', background: barColor } })]),
              el('div', { class: 'budget-note' + (over ? ' over' : ''), text: over ? `${money(spent - budget)} over budget` : `${money(budget - spent)} left` }),
            ])
          : el('button', { class: 'link-btn', style: { fontSize: '0.8rem' }, text: '+ Set a budget', onClick: () => openBudget(cat, 0) }),
      ])
    }

    function openBudget(cat, current) {
      const { monthLabel } = App.util
      const field = ui.moneyField('bud-amount', current || '', { autofocus: true })
      const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: 'Save budget' })
      const form = el('form', {
        onSubmit: async (e) => {
          e.preventDefault()
          submitBtn.disabled = true
          try {
            await s.getBackend().setBudget(cat.id, App.util.round2(field.input.value), monthKey(month))
            m.close()
            App.rerender()
            ui.toast('Budget saved', 'success')
          } catch (ex) {
            submitBtn.disabled = false
            ui.toast(ex.message || 'Failed to save', 'error')
          }
        },
      }, [
        el('p', { class: 'muted', style: { marginBottom: '12px' }, text: `Monthly limit for ${monthLabel(month)}. Set to 0 to remove the budget.` }),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Amount' }), field.wrap]),
        submitBtn,
      ])
      const m = ui.modal({ title: `Budget · ${cat.name}`, body: form })
    }
  }

  return render
})()
