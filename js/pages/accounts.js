/* ==========================================================================
 * pages/accounts.js — accounts with balances derived from transactions.
 * ========================================================================== */
window.App = window.App || {}
App.pages = App.pages || {}

App.pages.accounts = (function () {
  const TYPES = [
    { value: 'checking', label: 'Checking' },
    { value: 'savings', label: 'Savings' },
    { value: 'cash', label: 'Cash' },
    { value: 'credit', label: 'Credit card' },
    { value: 'other', label: 'Other' },
  ]

  function render() {
    const { el, money } = App.util
    const s = App.store
    const ui = App.ui
    const total = s.totalBalance()

    const addBtn = el('button', { class: 'btn primary', onClick: () => openForm(null) }, [ui.icon('plus', 18), 'Add account'])

    const body = s.data.accounts.length === 0
      ? ui.empty({
          title: 'No accounts yet',
          description: 'Add a checking, savings, or cash account to track balances.',
          action: el('button', { class: 'btn primary', onClick: () => openForm(null) }, [ui.icon('plus', 18), 'Add account']),
        })
      : el('div', { class: 'stat-grid', style: { gridTemplateColumns: 'repeat(2, 1fr)' } }, s.data.accounts.map((a) => {
          const bal = s.accountBalance(a)
          return el('div', { class: 'card', style: { padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' } }, [
            el('div', { class: 'row-main' }, [
              el('span', { class: 'avatar', style: { background: 'var(--brand-soft)', color: 'var(--brand-text)' } }, [ui.icon('wallet', 20)]),
              el('div', { style: { minWidth: 0 } }, [
                el('div', { class: 'row-title', text: a.name }),
                el('div', { class: 'row-sub', style: { textTransform: 'capitalize' }, text: a.type }),
              ]),
            ]),
            el('div', { class: 'row-actions' }, [
              el('span', { class: 'amount ' + (bal < 0 ? 'neg' : ''), style: { marginRight: '4px' }, text: money(bal) }),
              el('button', { class: 'icon-btn', 'aria-label': 'Edit', onClick: () => openForm(a) }, [ui.icon('edit', 16)]),
              el('button', { class: 'icon-btn danger', 'aria-label': 'Delete', onClick: () => del(a) }, [ui.icon('trash', 16)]),
            ]),
          ])
        }))

    return el('div', {}, [
      ui.pageHeader('Accounts', "Where your family's money lives.", addBtn),
      ui.statCard({ label: 'Total balance', value: money(total), hint: `${s.data.accounts.length} account${s.data.accounts.length === 1 ? '' : 's'}`, tone: total >= 0 ? 'pos' : 'neg' }),
      el('div', { style: { marginTop: '16px' } }, [body]),
    ])
  }

  async function del(a) {
    if (!(await App.ui.confirm(`Delete "${a.name}"? Transactions are kept but unlinked from this account.`))) return
    try {
      await App.store.getBackend().deleteAccount(a.id)
      await App.refresh()
      App.ui.toast('Account deleted', 'success')
    } catch (e) {
      App.ui.toast(e.message || 'Failed to delete', 'error')
    }
  }

  function openForm(existing) {
    const { el, round2 } = App.util
    const ui = App.ui
    const nameInput = el('input', { class: 'input', required: 'required', value: existing ? existing.name : '', placeholder: 'e.g. Joint Checking' })
    nameInput.setAttribute('autofocus', '')
    const typeSelect = el('select', { class: 'input' }, TYPES.map((t) =>
      el('option', { value: t.value, text: t.label, selected: existing && existing.type === t.value })))
    const balField = ui.moneyField('acct-bal', existing ? existing.starting_balance : '')
    const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: existing ? 'Save changes' : 'Add account' })
    const err = el('div', {})

    const form = el('form', {
      onSubmit: async (e) => {
        e.preventDefault()
        ui.clear(err)
        submitBtn.disabled = true
        const payload = { name: nameInput.value.trim(), type: typeSelect.value, starting_balance: round2(balField.input.value) }
        try {
          const b = App.store.getBackend()
          if (existing) await b.updateAccount(existing.id, payload)
          else await b.addAccount(payload)
          await App.refresh()
          m.close()
          ui.toast(existing ? 'Account updated' : 'Account added', 'success')
        } catch (ex) {
          submitBtn.disabled = false
          err.appendChild(el('div', { class: 'notice error', text: ex.message || 'Failed to save' }))
        }
      },
    }, [
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Account name' }), nameInput]),
      el('div', { class: 'grid-2' }, [
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Type' }), typeSelect]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Starting balance' }), balField.wrap]),
      ]),
      err,
      submitBtn,
    ])
    const m = ui.modal({ title: existing ? 'Edit account' : 'Add account', body: form })
  }

  return render
})()
