/* ==========================================================================
 * pages/transactions.js — list, search, filter, add / edit / delete.
 * Supports expense, income and transfer transactions, a vendor field, tags,
 * splitting an amount across categories, and recurring rules.
 * ========================================================================== */
window.App = window.App || {}
App.pages = App.pages || {}
App.actions = App.actions || {}

App.pages.transactions = (function () {
  let search = ''
  let kindFilter = 'all'
  let showRecurring = false

  const FREQ = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Every 2 weeks' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ]
  const freqLabel = (v) => (FREQ.find((f) => f.value === v) || {}).label || v

  // Advance a YYYY-MM-DD date by one step of a frequency (mirrors the backend).
  function advanceDate(iso, frequency) {
    const d = App.util.parseISO(iso)
    if (frequency === 'weekly') d.setDate(d.getDate() + 7)
    else if (frequency === 'biweekly') d.setDate(d.getDate() + 14)
    else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
    else d.setMonth(d.getMonth() + 1)
    return App.util.toISO(d)
  }

  function matches(t, q, cats, tags, accts) {
    if (kindFilter !== 'all' && t.kind !== kindFilter) return false
    if (!q) return true
    const cn = t.category_id ? (cats.get(t.category_id) || {}).name || '' : ''
    const tagNames = (t.tag_ids || []).map((id) => (tags.get(id) || {}).name || '').join(' ')
    const an = t.account_id ? (accts.get(t.account_id) || {}).name || '' : ''
    const an2 = t.transfer_account_id ? (accts.get(t.transfer_account_id) || {}).name || '' : ''
    return (
      (t.description || '').toLowerCase().includes(q) ||
      (t.vendor || '').toLowerCase().includes(q) ||
      cn.toLowerCase().includes(q) ||
      an.toLowerCase().includes(q) ||
      an2.toLowerCase().includes(q) ||
      tagNames.toLowerCase().includes(q)
    )
  }

  function render() {
    const s = App.store
    const ui = App.ui
    const { el } = App.util
    const cats = s.categoryMap()
    const tags = s.tagMap()
    const accts = s.accountMap()

    const q = search.trim().toLowerCase()
    const filtered = s.data.transactions.filter((t) => matches(t, q, cats, tags, accts))

    const headerBtns = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
      el('button', { class: 'btn ghost', onClick: () => { showRecurring = !showRecurring; App.rerender() } }, [ui.icon('trending', 16), `Recurring${s.data.recurring.length ? ' (' + s.data.recurring.length + ')' : ''}`]),
      el('button', { class: 'btn primary', onClick: () => openForm(null) }, [ui.icon('plus', 18), 'Add']),
    ])

    const toolbar = el('div', { class: 'toolbar' }, [
      el('div', { class: 'grow input-icon' }, [
        ui.icon('search', 16),
        el('input', {
          class: 'input', placeholder: 'Search description, vendor, category, account, tag…', value: search,
          onInput: (e) => { search = e.target.value; rerenderList() },
        }),
      ]),
      el('div', { class: 'pills' }, ['all', 'expense', 'income', 'transfer'].map((k) =>
        el('button', { class: kindFilter === k ? 'on' : '', text: k, onClick: () => { kindFilter = k; App.rerender() } }),
      )),
    ])

    const listWrap = el('div', {})
    function rerenderList() {
      const qq = search.trim().toLowerCase()
      const rows = s.data.transactions.filter((t) => matches(t, qq, cats, tags, accts))
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
      return el('div', { class: 'card card-list list' }, rows.map((t) => txRow(t, cats, tags, accts)))
    }

    listWrap.appendChild(buildList(filtered))

    return el('div', {}, [
      ui.pageHeader('Transactions', 'Every dollar in and out.', headerBtns),
      showRecurring ? recurringPanel() : null,
      toolbar,
      listWrap,
    ])
  }

  function txRow(t, cats, tags, accts) {
    const { el, money, prettyDate } = App.util
    const s = App.store
    const ui = App.ui

    if (t.kind === 'transfer') {
      const from = t.account_id ? accts.get(t.account_id) : null
      const to = t.transfer_account_id ? accts.get(t.transfer_account_id) : null
      const sub = [prettyDate(t.occurred_on), `${(from && from.name) || '—'} → ${(to && to.name) || '—'}`]
      if (t.recurring_id) sub.push('Recurring')
      return el('div', { class: 'row' }, [
        el('div', { class: 'row-main' }, [
          el('span', { class: 'avatar', style: { background: 'var(--surface-2)', color: 'var(--muted)' } }, [ui.icon('tx', 18)]),
          el('div', { style: { minWidth: 0 } }, [
            el('div', { class: 'row-title', text: t.description || 'Transfer' }),
            el('div', { class: 'row-sub', text: sub.join(' · ') }),
          ]),
        ]),
        el('div', { class: 'row-actions' }, [
          el('span', { class: 'amount', style: { marginRight: '4px' }, text: money(t.amount) }),
          el('button', { class: 'icon-btn', 'aria-label': 'Edit', onClick: () => openForm(t) }, [ui.icon('edit', 16)]),
          el('button', { class: 'icon-btn danger', 'aria-label': 'Delete', onClick: () => del(t) }, [ui.icon('trash', 16)]),
        ]),
      ])
    }

    const split = s.isSplit(t)
    const c = !split && t.category_id ? cats.get(t.category_id) : null
    const a = t.account_id ? accts.get(t.account_id) : null

    const badge = split
      ? el('span', { class: 'avatar', style: { background: 'var(--surface-2)', color: 'var(--muted)' } }, [ui.icon('tx', 18)])
      : ui.catBadge(c)

    const subParts = [prettyDate(t.occurred_on)]
    if (t.vendor) subParts.push(t.vendor)
    if (split) subParts.push(`Split · ${t.splits.length} categories`)
    else if (c) subParts.push(c.name)
    if (a) subParts.push(a.name)
    if (t.recurring_id) subParts.push('Recurring')

    const tagChips = (t.tag_ids || [])
      .map((id) => tags.get(id))
      .filter(Boolean)
      .map((tag) => el('span', { class: 'tag-mini' }, [
        el('span', { class: 'dot', style: { background: tag.color } }),
        tag.name,
      ]))

    return el('div', { class: 'row' }, [
      el('div', { class: 'row-main' }, [
        badge,
        el('div', { style: { minWidth: 0 } }, [
          el('div', { class: 'row-title', text: t.description || t.vendor || (c && c.name) || (split ? 'Split transaction' : 'Transaction') }),
          el('div', { class: 'row-sub', text: subParts.join(' · ') }),
          tagChips.length ? el('div', { class: 'tag-row' }, tagChips) : null,
        ]),
      ]),
      el('div', { class: 'row-actions' }, [
        el('span', { class: 'amount ' + (t.kind === 'income' ? 'income' : ''), style: { marginRight: '4px' }, text: (t.kind === 'income' ? '+' : '−') + money(t.amount) }),
        el('button', { class: 'icon-btn', 'aria-label': 'Edit', onClick: () => openForm(t) }, [ui.icon('edit', 16)]),
        el('button', { class: 'icon-btn danger', 'aria-label': 'Delete', onClick: () => del(t) }, [ui.icon('trash', 16)]),
      ]),
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

  /* -------------------------------------------------------------------------- */
  /* Recurring rules panel                                                       */
  /* -------------------------------------------------------------------------- */
  function recurringPanel() {
    const { el, money } = App.util
    const s = App.store
    const ui = App.ui
    const cats = s.categoryMap()
    const accts = s.accountMap()

    const rules = s.data.recurring.slice().sort((a, b) => (a.next_on || '') < (b.next_on || '') ? -1 : 1)

    const head = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' } }, [
      el('div', { class: 'section-title', style: { marginBottom: 0 } }, [ui.icon('trending', 18), 'Recurring transactions']),
      el('button', { class: 'btn ghost sm', onClick: () => openForm(null, { repeat: 'monthly' }) }, [ui.icon('plus', 16), 'New']),
    ])

    let body
    if (rules.length === 0) {
      body = el('p', { class: 'faint', style: { fontSize: '13px' }, text: 'No recurring transactions yet. Add one, or tick “Repeat” when creating a transaction.' })
    } else {
      body = el('div', { class: 'list' }, rules.map((r) => {
        const tpl = r.template || {}
        let title
        if (tpl.kind === 'transfer') {
          const from = accts.get(tpl.account_id)
          const to = accts.get(tpl.transfer_account_id)
          title = `Transfer · ${(from && from.name) || '—'} → ${(to && to.name) || '—'}`
        } else {
          const c = tpl.category_id ? cats.get(tpl.category_id) : null
          title = (c && c.name) || tpl.description || (tpl.kind === 'income' ? 'Income' : 'Expense')
        }
        const sub = `${freqLabel(r.frequency)} · next ${App.util.prettyDate(r.next_on)}${r.active ? '' : ' · paused'}`
        return el('div', { class: 'row' }, [
          el('div', { class: 'row-main' }, [
            el('span', { class: 'avatar', style: { background: 'var(--brand-soft)', color: 'var(--brand-text)' } }, [ui.icon('trending', 18)]),
            el('div', { style: { minWidth: 0 } }, [
              el('div', { class: 'row-title', text: title }),
              el('div', { class: 'row-sub', text: sub }),
            ]),
          ]),
          el('div', { class: 'row-actions' }, [
            el('span', { class: 'amount ' + (tpl.kind === 'income' ? 'income' : ''), style: { marginRight: '4px' }, text: (tpl.kind === 'income' ? '+' : tpl.kind === 'expense' ? '−' : '') + money(tpl.amount) }),
            el('button', { class: 'icon-btn', 'aria-label': r.active ? 'Pause' : 'Resume', onClick: () => toggleRule(r) }, [ui.icon(r.active ? 'lock' : 'unlock', 16)]),
            el('button', { class: 'icon-btn', 'aria-label': 'Edit', onClick: () => editRule(r) }, [ui.icon('edit', 16)]),
            el('button', { class: 'icon-btn danger', 'aria-label': 'Delete', onClick: () => delRule(r) }, [ui.icon('trash', 16)]),
          ]),
        ])
      }))
    }

    return el('div', { class: 'card pad', style: { marginBottom: '16px' } }, [head, body])
  }

  async function toggleRule(r) {
    try {
      await App.store.getBackend().updateRecurring(r.id, { active: !r.active })
      await App.refresh()
    } catch (e) { App.ui.toast(e.message || 'Failed', 'error') }
  }

  async function delRule(r) {
    if (!(await App.ui.confirm('Delete this recurring rule? Transactions already created are kept.'))) return
    try {
      await App.store.getBackend().deleteRecurring(r.id)
      await App.refresh()
      App.ui.toast('Recurring rule deleted', 'success')
    } catch (e) { App.ui.toast(e.message || 'Failed to delete', 'error') }
  }

  function editRule(r) {
    const { el, round2 } = App.util
    const ui = App.ui
    const tpl = r.template || {}
    const amountField = ui.moneyField('rec-amount', tpl.amount, { autofocus: true })
    const freqSel = el('select', { class: 'input' }, FREQ.map((f) =>
      el('option', { value: f.value, text: f.label, selected: r.frequency === f.value })))
    const nextInput = el('input', { class: 'input', type: 'date', value: r.next_on || App.util.todayISO() })
    const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: 'Save recurring rule' })
    const err = el('div', {})

    const form = el('form', {
      onSubmit: async (e) => {
        e.preventDefault()
        ui.clear(err)
        const amount = round2(amountField.input.value)
        if (!(amount > 0)) { err.appendChild(el('div', { class: 'notice error', text: 'Enter an amount greater than zero.' })); return }
        submitBtn.disabled = true
        try {
          await App.store.getBackend().updateRecurring(r.id, {
            template: { ...tpl, amount },
            frequency: freqSel.value,
            next_on: nextInput.value,
            active: true,
          })
          await App.refresh()
          m.close()
          ui.toast('Recurring rule updated', 'success')
        } catch (ex) {
          submitBtn.disabled = false
          err.appendChild(el('div', { class: 'notice error', text: ex.message || 'Failed to save' }))
        }
      },
    }, [
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Amount' }), amountField.wrap]),
      el('div', { class: 'grid-2' }, [
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Frequency' }), freqSel]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Next date' }), nextInput]),
      ]),
      err,
      submitBtn,
    ])
    const m = ui.modal({ title: 'Edit recurring rule', body: form })
  }

  /* -------------------------------------------------------------------------- */
  /* Add / edit transaction form                                                 */
  /* -------------------------------------------------------------------------- */
  function openForm(existing, preset) {
    preset = preset || {}
    const { el, todayISO, round2, money } = App.util
    const s = App.store
    const ui = App.ui

    let kind = existing ? existing.kind : preset.kind || 'expense'
    const existingSplits = existing && Array.isArray(existing.splits) ? existing.splits : []
    let splitOn = existingSplits.length > 1
    const selectedTags = new Set(existing && Array.isArray(existing.tag_ids) ? existing.tag_ids : [])

    const amountField = ui.moneyField('tx-amount', existing ? existing.amount : '', { autofocus: true })
    amountField.input.addEventListener('input', updateSplitTotal)

    // --- Single category (searchable picker) ---
    const singlePicker = ui.categoryPicker({ kind, selectedId: existing ? existing.category_id : '' })

    // --- Split editor ---
    const splitList = el('div', { class: 'split-list' })
    const splitTotal = el('div', { class: 'split-total' })
    let splitRows = []

    function addSplitRow(catId, amount) {
      const picker = ui.categoryPicker({ kind, selectedId: catId || '' })
      const amt = el('input', { type: 'number', step: '0.01', min: '0', class: 'input', placeholder: '0.00', value: amount != null && amount !== '' ? String(amount) : '' })
      amt.addEventListener('input', updateSplitTotal)
      const row = el('div', { class: 'split-row' }, [
        picker.wrap,
        el('div', { class: 'money-wrap split-amt' }, [el('span', { class: 'money-sign', text: '$' }), amt]),
        el('button', { type: 'button', class: 'icon-btn danger', 'aria-label': 'Remove split', onClick: () => {
          splitRows = splitRows.filter((r) => r.row !== row)
          row.remove()
          updateSplitTotal()
        } }, [ui.icon('trash', 15)]),
      ])
      splitRows.push({ row, picker, amt })
      splitList.appendChild(row)
      updateSplitTotal()
    }

    function updateSplitTotal() {
      if (!splitOn) return
      const total = round2(amountField.input.value)
      const allocated = round2(splitRows.reduce((sum, r) => sum + (parseFloat(r.amt.value) || 0), 0))
      const remaining = round2(total - allocated)
      const ok = Math.abs(remaining) < 0.005 && total > 0
      ui.clear(splitTotal)
      splitTotal.appendChild(el('span', { class: ok ? 'ok' : 'off', text: `${money(allocated)} of ${money(total)}` }))
      if (!ok && total > 0) splitTotal.appendChild(el('span', { class: 'off', text: ` · ${money(Math.abs(remaining))} ${remaining < 0 ? 'over' : 'left'}` }))
    }

    const splitEditor = el('div', { class: 'split-editor' }, [
      splitList,
      el('div', { class: 'split-foot' }, [
        el('button', { type: 'button', class: 'btn ghost sm', onClick: () => addSplitRow('', '') }, [ui.icon('plus', 14), 'Add split']),
        splitTotal,
      ]),
    ])

    const catSection = el('div', {})
    function renderCatSection() {
      ui.clear(catSection)
      const cb = el('input', { type: 'checkbox' })
      cb.checked = splitOn
      cb.addEventListener('change', () => { splitOn = cb.checked; renderCatSection() })
      catSection.appendChild(el('div', { class: 'field' }, [
        el('div', { class: 'field-head' }, [
          el('label', { class: 'label', style: { marginBottom: 0 }, text: 'Category' }),
          el('label', { class: 'split-toggle' }, [cb, el('span', { text: 'Split across categories' })]),
        ]),
        splitOn ? splitEditor : singlePicker.wrap,
      ]))
      if (splitOn) {
        if (splitRows.length === 0) {
          splitList.innerHTML = ''
          if (existingSplits.length > 1) existingSplits.forEach((sp) => addSplitRow(sp.category_id, sp.amount))
          else { addSplitRow(existing ? existing.category_id : '', ''); addSplitRow('', '') }
        }
        updateSplitTotal()
      }
    }

    // --- Accounts ---
    function accountSelect(id, selectedId) {
      const sel = el('select', { id, class: 'input' })
      sel.appendChild(el('option', { value: '', text: 'None' }))
      s.data.accounts.forEach((a) =>
        sel.appendChild(el('option', { value: a.id, text: a.name + (App.store.isLiability(a) ? ' (credit)' : ''), selected: selectedId === a.id })))
      return sel
    }
    const acctSelect = accountSelect('tx-acct', existing ? existing.account_id : preset.account_id || '')
    const toAcctSelect = accountSelect('tx-acct-to', existing ? existing.transfer_account_id : preset.transfer_account_id || '')

    const dateInput = el('input', { id: 'tx-date', class: 'input', type: 'date', value: existing ? existing.occurred_on : todayISO() })

    const vendorList = el('datalist', { id: 'tx-vendor-list' }, s.vendors().map((v) => el('option', { value: v })))
    const vendorInput = el('input', { id: 'tx-vendor', class: 'input', list: 'tx-vendor-list', value: existing ? existing.vendor || '' : '', placeholder: 'e.g. Whole Foods' })

    const descInput = el('input', { id: 'tx-desc', class: 'input', value: existing ? existing.description || '' : '', placeholder: kind === 'transfer' ? 'e.g. Credit card payment' : 'e.g. Weekly grocery run' })

    // --- Repeat (only for new transactions) ---
    const repeatSel = el('select', { class: 'input' }, [el('option', { value: '', text: 'Does not repeat' })].concat(
      FREQ.map((f) => el('option', { value: f.value, text: f.label, selected: preset.repeat === f.value })),
    ))

    const tagsWrap = el('div', {})
    function renderTags() {
      ui.clear(tagsWrap)
      if (s.data.tags.length === 0) {
        tagsWrap.appendChild(el('p', { class: 'faint', style: { fontSize: '12px' }, text: 'No tags yet — create them on the Family page.' }))
        return
      }
      tagsWrap.appendChild(el('div', { class: 'chips' }, s.data.tags.map((tag) => {
        const chip = el('button', { type: 'button', class: 'chip tag-chip' + (selectedTags.has(tag.id) ? ' sel' : '') }, [
          el('span', { class: 'dot', style: { background: tag.color } }),
          tag.name,
        ])
        chip.addEventListener('click', () => {
          if (selectedTags.has(tag.id)) { selectedTags.delete(tag.id); chip.classList.remove('sel') }
          else { selectedTags.add(tag.id); chip.classList.add('sel') }
        })
        return chip
      })))
    }
    renderTags()

    const err = el('div', {})

    // Fields that only apply to income/expense (hidden for transfers).
    const nonTransferFields = el('div', {})
    // Fields that only apply to transfers.
    const transferFields = el('div', {})

    function paintKindFields() {
      ui.clear(nonTransferFields)
      ui.clear(transferFields)
      if (kind === 'transfer') {
        transferFields.appendChild(el('div', { class: 'grid-2' }, [
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'From account' }), acctSelect]),
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'To account' }), toAcctSelect]),
        ]))
        transferFields.appendChild(el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Date' }), dateInput]))
        transferFields.appendChild(el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Description (optional)' }), descInput]))
        transferFields.appendChild(el('p', { class: 'faint', style: { fontSize: '12px', marginTop: '-4px' }, text: 'Move money between accounts — e.g. pay down a credit card. Not counted as income or expense.' }))
      } else {
        nonTransferFields.appendChild(catSection)
        nonTransferFields.appendChild(el('div', { class: 'grid-2' }, [
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Account' }), acctSelect]),
          el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Date' }), dateInput]),
        ]))
        nonTransferFields.appendChild(el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Vendor (optional)' }), vendorInput, vendorList]))
        nonTransferFields.appendChild(el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Description (optional)' }), descInput]))
        nonTransferFields.appendChild(el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Tags' }), tagsWrap]))
      }
    }

    const seg = el('div', { class: 'segment segment-3' }, ['expense', 'income', 'transfer'].map((k) =>
      el('button', { type: 'button', class: (kind === k ? 'on ' : '') + k, text: k, onClick: () => {
        if (k === kind) return
        kind = k
        seg.querySelectorAll('button').forEach((b) => b.classList.remove('on'))
        seg.querySelector(`button.${k}`).classList.add('on')
        // Category options depend on kind — rebuild single + split pickers.
        singlePicker.setKind(kind)
        splitRows = []
        splitList.innerHTML = ''
        renderCatSection()
        paintKindFields()
      } })))

    renderCatSection()
    paintKindFields()

    const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: existing ? 'Save changes' : 'Add transaction' })

    const form = el('form', {
      onSubmit: async (e) => {
        e.preventDefault()
        ui.clear(err)
        const amount = round2(amountField.input.value)
        if (!(amount > 0)) {
          err.appendChild(el('div', { class: 'notice error', text: 'Enter an amount greater than zero.' }))
          return
        }

        let payload
        if (kind === 'transfer') {
          const fromId = acctSelect.value || null
          const toId = toAcctSelect.value || null
          if (!fromId || !toId) {
            err.appendChild(el('div', { class: 'notice error', text: 'Choose both a “from” and a “to” account.' }))
            return
          }
          if (fromId === toId) {
            err.appendChild(el('div', { class: 'notice error', text: 'The two accounts must be different.' }))
            return
          }
          payload = {
            kind: 'transfer',
            amount,
            account_id: fromId,
            transfer_account_id: toId,
            category_id: null,
            splits: [],
            tag_ids: [],
            description: descInput.value.trim() || null,
            vendor: null,
            occurred_on: dateInput.value,
          }
        } else {
          let category_id = null
          let splits = []
          if (splitOn) {
            splits = splitRows
              .map((r) => ({ category_id: r.picker.getValue() || null, amount: round2(r.amt.value) }))
              .filter((sp) => sp.amount > 0)
            if (splits.length < 2) {
              err.appendChild(el('div', { class: 'notice error', text: 'A split needs at least two lines with an amount.' }))
              return
            }
            const sum = round2(splits.reduce((tot, sp) => tot + sp.amount, 0))
            if (Math.abs(sum - amount) >= 0.005) {
              err.appendChild(el('div', { class: 'notice error', text: `Splits add up to ${money(sum)}, but the amount is ${money(amount)}.` }))
              return
            }
          } else {
            category_id = singlePicker.getValue() || null
          }
          payload = {
            kind,
            amount,
            category_id,
            splits,
            account_id: acctSelect.value || null,
            transfer_account_id: null,
            description: descInput.value.trim() || null,
            vendor: vendorInput.value.trim() || null,
            tag_ids: [...selectedTags],
            occurred_on: dateInput.value,
          }
        }

        submitBtn.disabled = true
        try {
          const b = s.getBackend()
          if (existing) {
            await b.updateTransaction(existing.id, payload)
          } else {
            await b.addTransaction(payload)
            // If "Repeat" is set, schedule the next occurrence as a rule.
            const repeat = repeatSel.value
            if (repeat && b.addRecurring) {
              const { account_id, transfer_account_id, category_id, kind: k, amount: amt, description, vendor, tag_ids, splits } = payload
              await b.addRecurring({
                template: { kind: k, amount: amt, account_id, transfer_account_id, category_id, description, vendor, tag_ids, splits },
                frequency: repeat,
                next_on: advanceDate(payload.occurred_on, repeat),
                active: true,
              })
            }
          }
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
      nonTransferFields,
      transferFields,
      existing ? null : el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Repeat' }), repeatSel]),
      err,
      submitBtn,
    ])

    const m = ui.modal({ title: existing ? 'Edit transaction' : (preset.repeat ? 'New recurring transaction' : 'Add transaction'), body: form })
  }

  // Quick-add hooks used by the bottom-bar “+” menu and account detail.
  App.actions.addTransaction = (preset) => openForm(null, preset)
  App.actions.addTransfer = (preset) => openForm(null, { ...(preset || {}), kind: 'transfer' })
  App.actions.editTransaction = (t) => openForm(t)

  return render
})()
