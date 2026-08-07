/* ==========================================================================
 * pages/accounts.js — accounts with balances derived from transactions.
 * Credit cards and loans are liabilities: their balance is the amount owed and
 * counts negatively toward net worth. Tap an account to see its transactions.
 * ========================================================================== */
window.App = window.App || {}
App.pages = App.pages || {}
App.actions = App.actions || {}

App.pages.accounts = (function () {
  const TYPES = [
    { value: 'checking', label: 'Checking' },
    { value: 'savings', label: 'Savings' },
    { value: 'cash', label: 'Cash' },
    { value: 'credit', label: 'Credit card' },
    { value: 'loan', label: 'Loan' },
    { value: 'other', label: 'Other' },
  ]
  const typeLabel = (v) => (TYPES.find((t) => t.value === v) || {}).label || v

  // Which account (if any) is currently opened to its detail view.
  let viewId = null

  function render() {
    const s = App.store
    // If the opened account no longer exists, fall back to the list.
    if (viewId && !s.data.accounts.some((a) => a.id === viewId)) viewId = null
    return viewId ? renderDetail(s.data.accounts.find((a) => a.id === viewId)) : renderList()
  }

  /* -------------------------------------------------------------------------- */
  /* Account list                                                                */
  /* -------------------------------------------------------------------------- */
  function renderList() {
    const { el, money } = App.util
    const s = App.store
    const ui = App.ui
    const total = s.totalBalance()

    const addBtn = el('button', { class: 'btn primary', onClick: () => openForm(null) }, [ui.icon('plus', 18), 'Add account'])

    const body = s.data.accounts.length === 0
      ? ui.empty({
          title: 'No accounts yet',
          description: 'Add a checking, savings, cash, or credit card account to track balances.',
          action: el('button', { class: 'btn primary', onClick: () => openForm(null) }, [ui.icon('plus', 18), 'Add account']),
        })
      : el('div', { class: 'account-list' }, s.data.accounts.map((a) => accountCard(a)))

    return el('div', {}, [
      ui.pageHeader('Accounts', "Where your family's money lives.", addBtn),
      ui.statCard({ label: 'Net worth', value: money(total), hint: `${s.data.accounts.length} account${s.data.accounts.length === 1 ? '' : 's'} · assets − debts`, tone: total >= 0 ? 'pos' : 'neg' }),
      el('div', { style: { marginTop: '16px' } }, [body]),
    ])
  }

  function accountCard(a) {
    const { el, money } = App.util
    const s = App.store
    const ui = App.ui
    const liability = s.isLiability(a)
    const bal = s.accountBalance(a)
    const owed = s.accountOwed(a)

    const amountText = liability ? money(owed) : money(bal)
    const amountClass = liability ? (owed > 0 ? 'neg' : '') : (bal < 0 ? 'neg' : '')

    return el('button', { class: 'account-card', onClick: () => { viewId = a.id; App.rerender() } }, [
      el('div', { class: 'row-main' }, [
        el('span', { class: 'avatar', style: { background: liability ? 'var(--danger-soft)' : 'var(--brand-soft)', color: liability ? 'var(--danger)' : 'var(--brand-text)' } }, [ui.icon('wallet', 20)]),
        el('div', { style: { minWidth: 0 } }, [
          el('div', { class: 'row-title', text: a.name }),
          el('div', { class: 'row-sub', text: typeLabel(a.type) + (liability ? ' · owed' : '') }),
        ]),
      ]),
      el('div', { class: 'account-card-right' }, [
        el('span', { class: 'amount ' + amountClass, text: amountText }),
        ui.icon('chevronRight', 18),
      ]),
    ])
  }

  /* -------------------------------------------------------------------------- */
  /* Account detail — its transactions                                           */
  /* -------------------------------------------------------------------------- */
  function renderDetail(a) {
    const { el, money } = App.util
    const s = App.store
    const ui = App.ui
    const liability = s.isLiability(a)
    const bal = s.accountBalance(a)
    const owed = s.accountOwed(a)
    const txns = s.transactionsForAccount(a.id)
    const cats = s.categoryMap()
    const accts = s.accountMap()

    const back = el('button', { class: 'btn ghost sm', onClick: () => { viewId = null; App.rerender() } }, [ui.icon('chevronLeft', 16), 'Accounts'])

    const bigValue = liability ? money(owed) : money(bal)
    const bigHint = liability
      ? `Owed · counts as ${money(-owed)} toward net worth`
      : (bal < 0 ? 'Overdrawn' : typeLabel(a.type))
    const bigTone = liability ? (owed > 0 ? 'neg' : 'pos') : (bal >= 0 ? 'pos' : 'neg')

    const actions = el('div', { class: 'detail-actions' }, [
      el('button', { class: 'btn primary sm', onClick: () => App.actions.addTransaction({ account_id: a.id, kind: 'expense' }) }, [ui.icon('plus', 16), 'Transaction']),
      liability
        ? el('button', { class: 'btn ghost sm', onClick: () => App.actions.addTransfer({ transfer_account_id: a.id }) }, [ui.icon('tx', 16), 'Pay / transfer'])
        : el('button', { class: 'btn ghost sm', onClick: () => App.actions.addTransfer({ account_id: a.id }) }, [ui.icon('tx', 16), 'Transfer']),
      el('button', { class: 'btn ghost sm', onClick: () => openForm(a) }, [ui.icon('edit', 16), 'Edit']),
      el('button', { class: 'btn ghost sm', onClick: () => del(a), style: { color: 'var(--danger)' } }, [ui.icon('trash', 16), 'Delete']),
    ])

    const listBody = txns.length === 0
      ? ui.empty({ title: 'No transactions', description: 'Transactions in this account will appear here.' })
      : el('div', { class: 'card card-list list' }, txns.map((t) => detailRow(t, a, cats, accts)))

    return el('div', {}, [
      el('div', { style: { marginBottom: '14px' } }, [back]),
      ui.pageHeader(a.name, typeLabel(a.type)),
      ui.statCard({ label: liability ? 'Balance owed' : 'Balance', value: bigValue, hint: bigHint, tone: bigTone }),
      el('div', { style: { marginTop: '14px' } }, [actions]),
      el('div', { class: 'section-title', style: { marginTop: '20px' } }, [ui.icon('receipt', 18), `Transactions (${txns.length})`]),
      listBody,
    ])
  }

  function detailRow(t, a, cats, accts) {
    const { el, money, prettyDate } = App.util
    const ui = App.ui
    const s = App.store

    // Sign of this transaction from the perspective of the current account.
    let sign
    let title
    const sub = [prettyDate(t.occurred_on)]
    if (t.kind === 'transfer') {
      sign = t.account_id === a.id ? -1 : 1
      const other = t.account_id === a.id ? accts.get(t.transfer_account_id) : accts.get(t.account_id)
      title = t.description || 'Transfer'
      sub.push((sign < 0 ? 'To ' : 'From ') + ((other && other.name) || '—'))
    } else {
      sign = t.kind === 'income' ? 1 : -1
      const split = s.isSplit(t)
      const c = !split && t.category_id ? cats.get(t.category_id) : null
      title = t.description || t.vendor || (c && c.name) || (split ? 'Split transaction' : 'Transaction')
      if (c) sub.push(c.name)
      else if (split) sub.push(`Split · ${t.splits.length} categories`)
      if (t.vendor && t.vendor !== title) sub.push(t.vendor)
    }
    if (t.recurring_id) sub.push('Recurring')

    return el('div', { class: 'row' }, [
      el('div', { class: 'row-main' }, [
        el('span', { class: 'avatar', style: { background: 'var(--surface-2)', color: 'var(--muted)' } }, [ui.icon(t.kind === 'transfer' ? 'tx' : 'receipt', 18)]),
        el('div', { style: { minWidth: 0 } }, [
          el('div', { class: 'row-title', text: title }),
          el('div', { class: 'row-sub', text: sub.join(' · ') }),
        ]),
      ]),
      el('div', { class: 'row-actions' }, [
        el('span', { class: 'amount ' + (sign > 0 ? 'income' : 'neg'), style: { marginRight: '4px' }, text: (sign > 0 ? '+' : '−') + money(t.amount) }),
        el('button', { class: 'icon-btn', 'aria-label': 'Edit', onClick: () => App.actions.editTransaction(t) }, [ui.icon('edit', 16)]),
      ]),
    ])
  }

  async function del(a) {
    if (!(await App.ui.confirm(`Delete "${a.name}"? Transactions are kept but unlinked from this account.`))) return
    try {
      await App.store.getBackend().deleteAccount(a.id)
      viewId = null
      await App.refresh()
      App.ui.toast('Account deleted', 'success')
    } catch (e) {
      App.ui.toast(e.message || 'Failed to delete', 'error')
    }
  }

  function openForm(existing) {
    const { el, round2 } = App.util
    const s = App.store
    const ui = App.ui
    const startsLiability = existing ? s.isLiability(existing) : false

    const nameInput = el('input', { class: 'input', required: 'required', value: existing ? existing.name : '', placeholder: 'e.g. Joint Checking' })
    nameInput.setAttribute('autofocus', '')
    const typeSelect = el('select', { class: 'input' }, TYPES.map((t) =>
      el('option', { value: t.value, text: t.label, selected: existing && existing.type === t.value })))

    // Liabilities store their starting balance as a negative number (money
    // owed). Show it to the user as a positive "amount owed".
    const startVal = existing
      ? (startsLiability ? -existing.starting_balance : existing.starting_balance)
      : ''
    const balLabel = el('label', { class: 'label', text: startsLiability ? 'Current balance owed' : 'Starting balance' })
    const balField = ui.moneyField('acct-bal', startVal)

    const isLiabilityType = (v) => v === 'credit' || v === 'loan'
    typeSelect.addEventListener('change', () => {
      balLabel.textContent = isLiabilityType(typeSelect.value) ? 'Current balance owed' : 'Starting balance'
    })

    const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: existing ? 'Save changes' : 'Add account' })
    const err = el('div', {})

    const form = el('form', {
      onSubmit: async (e) => {
        e.preventDefault()
        ui.clear(err)
        submitBtn.disabled = true
        const liability = isLiabilityType(typeSelect.value)
        const entered = round2(balField.input.value)
        // Store owed amounts as a negative ledger balance.
        const starting_balance = liability ? -Math.abs(entered) : entered
        const payload = { name: nameInput.value.trim(), type: typeSelect.value, starting_balance }
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
        el('div', { class: 'field' }, [balLabel, balField.wrap]),
      ]),
      el('p', { class: 'faint', style: { fontSize: '12px', marginTop: '-4px' }, text: 'Credit cards and loans are debts — their balance is the amount you owe and lowers your net worth.' }),
      err,
      submitBtn,
    ])
    const m = ui.modal({ title: existing ? 'Edit account' : 'Add account', body: form })
  }

  App.actions.addAccount = () => openForm(null)

  return render
})()
