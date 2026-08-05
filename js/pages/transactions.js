/* ==========================================================================
 * pages/transactions.js — list, search, filter, add / edit / delete.
 * ========================================================================== */
window.App = window.App || {}
App.pages = App.pages || {}

App.pages.transactions = (function () {
  let search = ''
  let kindFilter = 'all'

  function render() {
    const { el, money, prettyDate } = App.util
    const s = App.store
    const ui = App.ui
    const cats = s.categoryMap()
    const accts = s.accountMap()

    const q = search.trim().toLowerCase()
    const filtered = s.data.transactions.filter((t) => {
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false
      if (!q) return true
      const cn = t.category_id ? (cats.get(t.category_id) || {}).name || '' : ''
      return (t.description || '').toLowerCase().includes(q) || cn.toLowerCase().includes(q)
    })

    const addBtn = el('button', { class: 'btn primary', onClick: () => openForm(null) }, [ui.icon('plus', 18), 'Add transaction'])

    const toolbar = el('div', { class: 'toolbar' }, [
      el('div', { class: 'grow input-icon' }, [
        ui.icon('search', 16),
        el('input', {
          class: 'input', placeholder: 'Search description or category…', value: search,
          onInput: (e) => { search = e.target.value; rerenderList() },
        }),
      ]),
      el('div', { class: 'pills' }, ['all', 'expense', 'income'].map((k) =>
        el('button', { class: kindFilter === k ? 'on' : '', text: k, onClick: () => { kindFilter = k; App.rerender() } }),
      )),
    ])

    const listWrap = el('div', {})
    function rerenderList() {
      // Lightweight in-place list refresh for search typing (no full re-render).
      const qq = search.trim().toLowerCase()
      const rows = s.data.transactions.filter((t) => {
        if (kindFilter !== 'all' && t.kind !== kindFilter) return false
        if (!qq) return true
        const cn = t.category_id ? (cats.get(t.category_id) || {}).name || '' : ''
        return (t.description || '').toLowerCase().includes(qq) || cn.toLowerCase().includes(qq)
      })
      ui.clear(listWrap).appendChild(buildList(rows))
    }

    function buildList(rows) {
      if (rows.length === 0) {
        return ui.empty({
          title: s.data.transactions.length === 0 ? 'No transactions yet' : 'No matches',
          description: s.data.transactions.length === 0
            ? 'Add your first income or expense to get started.'
            : 'Try a different search or filter.',
          action: s.data.transactions.length === 0
            ? el('button', { class: 'btn primary', onClick: () => openForm(null) }, [ui.icon('plus', 18), 'Add transaction'])
            : null,
        })
      }
      return el('div', { class: 'card card-list list' }, rows.map((t) => {
        const c = t.category_id ? cats.get(t.category_id) : null
        const a = t.account_id ? accts.get(t.account_id) : null
        return el('div', { class: 'row' }, [
          el('div', { class: 'row-main' }, [
            ui.catBadge(c),
            el('div', { style: { minWidth: 0 } }, [
              el('div', { class: 'row-title', text: t.description || (c && c.name) || 'Transaction' }),
              el('div', { class: 'row-sub', text: prettyDate(t.occurred_on) + (c ? ' · ' + c.name : '') + (a ? ' · ' + a.name : '') }),
            ]),
          ]),
          el('div', { class: 'row-actions' }, [
            el('span', { class: 'amount ' + (t.kind === 'income' ? 'income' : ''), style: { marginRight: '4px' }, text: (t.kind === 'income' ? '+' : '−') + money(t.amount) }),
            el('button', { class: 'icon-btn', 'aria-label': 'Edit', onClick: () => openForm(t) }, [ui.icon('edit', 16)]),
            el('button', { class: 'icon-btn danger', 'aria-label': 'Delete', onClick: () => del(t) }, [ui.icon('trash', 16)]),
          ]),
        ])
      }))
    }

    listWrap.appendChild(buildList(filtered))

    return el('div', {}, [
      ui.pageHeader('Transactions', 'Every dollar in and out.', addBtn),
      toolbar,
      listWrap,
    ])
  }

  async function del(t) {
    if (!(await App.ui.confirm('Delete this transaction?'))) return
    try {
      await App.store.getBackend().deleteTransaction(t.id)
      await App.refresh()
      App.ui.toast('Transaction deleted', 'success')
    } catch (e) {
      App.ui.toast(e.message || 'Failed to delete', 'error')
    }
  }

  function openForm(existing) {
    const { el, todayISO, round2 } = App.util
    const s = App.store
    const ui = App.ui

    let kind = existing ? existing.kind : 'expense'
    const amountField = ui.moneyField('tx-amount', existing ? existing.amount : '', { autofocus: true })

    const catSelect = el('select', { id: 'tx-cat', class: 'input' })
    const acctSelect = el('select', { id: 'tx-acct', class: 'input' })
    function fillCats() {
      ui.clear(catSelect)
      catSelect.appendChild(el('option', { value: '', text: 'Uncategorized' }))
      s.data.categories.filter((c) => c.kind === kind).forEach((c) =>
        catSelect.appendChild(el('option', { value: c.id, text: c.name, selected: existing && existing.category_id === c.id })))
    }
    fillCats()
    acctSelect.appendChild(el('option', { value: '', text: 'None' }))
    s.data.accounts.forEach((a) =>
      acctSelect.appendChild(el('option', { value: a.id, text: a.name, selected: existing && existing.account_id === a.id })))

    const descInput = el('input', { id: 'tx-desc', class: 'input', value: existing ? existing.description || '' : '', placeholder: 'e.g. Weekly grocery run' })
    const dateInput = el('input', { id: 'tx-date', class: 'input', type: 'date', value: existing ? existing.occurred_on : todayISO() })
    const err = el('div', {})

    const seg = el('div', { class: 'segment' }, ['expense', 'income'].map((k) =>
      el('button', { type: 'button', class: (kind === k ? 'on ' : '') + k, text: k, onClick: () => {
        kind = k
        seg.querySelectorAll('button').forEach((b) => b.classList.remove('on'))
        seg.querySelector(`button.${k}`).classList.add('on')
        fillCats()
      } })))

    const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: existing ? 'Save changes' : 'Add transaction' })

    const form = el('form', {
      onSubmit: async (e) => {
        e.preventDefault()
        ui.clear(err)
        const payload = {
          kind,
          amount: round2(amountField.input.value),
          category_id: catSelect.value || null,
          account_id: acctSelect.value || null,
          description: descInput.value.trim() || null,
          occurred_on: dateInput.value,
        }
        submitBtn.disabled = true
        try {
          const b = s.getBackend()
          if (existing) await b.updateTransaction(existing.id, payload)
          else await b.addTransaction(payload)
          await App.refresh()
          m.close()
          ui.toast(existing ? 'Transaction updated' : 'Transaction added', 'success')
        } catch (ex) {
          submitBtn.disabled = false
          err.appendChild(el('div', { class: 'notice error', text: ex.message || 'Failed to save' }))
        }
      },
    }, [
      seg,
      el('div', { class: 'field', style: { marginTop: '14px' } }, [el('label', { class: 'label', text: 'Amount' }), amountField.wrap]),
      el('div', { class: 'grid-2' }, [
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Category' }), catSelect]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Account' }), acctSelect]),
      ]),
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Date' }), dateInput]),
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Description (optional)' }), descInput]),
      err,
      submitBtn,
    ])

    const m = ui.modal({ title: existing ? 'Edit transaction' : 'Add transaction', body: form })
  }

  return render
})()
