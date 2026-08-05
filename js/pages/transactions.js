/* ==========================================================================
 * pages/transactions.js — list, search, filter, add / edit / delete.
 * Supports a vendor field, tags, and splitting an amount across categories.
 * ========================================================================== */
window.App = window.App || {}
App.pages = App.pages || {}

App.pages.transactions = (function () {
  let search = ''
  let kindFilter = 'all'

  function matches(t, q, cats, tags) {
    if (kindFilter !== 'all' && t.kind !== kindFilter) return false
    if (!q) return true
    const cn = t.category_id ? (cats.get(t.category_id) || {}).name || '' : ''
    const tagNames = (t.tag_ids || []).map((id) => (tags.get(id) || {}).name || '').join(' ')
    return (
      (t.description || '').toLowerCase().includes(q) ||
      (t.vendor || '').toLowerCase().includes(q) ||
      cn.toLowerCase().includes(q) ||
      tagNames.toLowerCase().includes(q)
    )
  }

  function render() {
    const s = App.store
    const ui = App.ui
    const { el } = App.util
    const cats = s.categoryMap()
    const tags = s.tagMap()

    const q = search.trim().toLowerCase()
    const filtered = s.data.transactions.filter((t) => matches(t, q, cats, tags))

    const addBtn = el('button', { class: 'btn primary', onClick: () => openForm(null) }, [ui.icon('plus', 18), 'Add transaction'])

    const toolbar = el('div', { class: 'toolbar' }, [
      el('div', { class: 'grow input-icon' }, [
        ui.icon('search', 16),
        el('input', {
          class: 'input', placeholder: 'Search description, vendor, category, tag…', value: search,
          onInput: (e) => { search = e.target.value; rerenderList() },
        }),
      ]),
      el('div', { class: 'pills' }, ['all', 'expense', 'income'].map((k) =>
        el('button', { class: kindFilter === k ? 'on' : '', text: k, onClick: () => { kindFilter = k; App.rerender() } }),
      )),
    ])

    const listWrap = el('div', {})
    function rerenderList() {
      const qq = search.trim().toLowerCase()
      const rows = s.data.transactions.filter((t) => matches(t, qq, cats, tags))
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
      return el('div', { class: 'card card-list list' }, rows.map((t) => txRow(t, cats, tags)))
    }

    listWrap.appendChild(buildList(filtered))

    return el('div', {}, [
      ui.pageHeader('Transactions', 'Every dollar in and out.', addBtn),
      toolbar,
      listWrap,
    ])
  }

  function txRow(t, cats, tags) {
    const { el, money, prettyDate } = App.util
    const s = App.store
    const ui = App.ui
    const split = s.isSplit(t)
    const c = !split && t.category_id ? cats.get(t.category_id) : null
    const a = t.account_id ? s.accountMap().get(t.account_id) : null

    const badge = split
      ? el('span', { class: 'avatar', style: { background: 'var(--surface-2)', color: 'var(--muted)' } }, [ui.icon('tx', 18)])
      : ui.catBadge(c)

    const subParts = [prettyDate(t.occurred_on)]
    if (t.vendor) subParts.push(t.vendor)
    if (split) subParts.push(`Split · ${t.splits.length} categories`)
    else if (c) subParts.push(c.name)
    if (a) subParts.push(a.name)

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

  function openForm(existing) {
    const { el, todayISO, round2, money } = App.util
    const s = App.store
    const ui = App.ui

    let kind = existing ? existing.kind : 'expense'
    const existingSplits = existing && Array.isArray(existing.splits) ? existing.splits : []
    let splitOn = existingSplits.length > 1
    const selectedTags = new Set(existing && Array.isArray(existing.tag_ids) ? existing.tag_ids : [])

    const amountField = ui.moneyField('tx-amount', existing ? existing.amount : '', { autofocus: true })
    amountField.input.addEventListener('input', updateSplitTotal)

    function makeCatSelect(selectedId, id) {
      const sel = el('select', id ? { id, class: 'input' } : { class: 'input' })
      sel.appendChild(el('option', { value: '', text: 'Uncategorized' }))
      s.orderedCategories(kind).forEach(({ cat, depth }) =>
        sel.appendChild(el('option', { value: cat.id, text: (depth ? ' ↳ ' : '') + cat.name, selected: selectedId === cat.id })))
      return sel
    }

    const singleCatRef = { node: makeCatSelect(existing ? existing.category_id : '', 'tx-cat') }

    // --- Split editor ---
    const splitList = el('div', { class: 'split-list' })
    const splitTotal = el('div', { class: 'split-total' })
    let splitRows = []

    function addSplitRow(catId, amount) {
      const sel = makeCatSelect(catId || '')
      const amt = el('input', { type: 'number', step: '0.01', min: '0', class: 'input', placeholder: '0.00', value: amount != null && amount !== '' ? String(amount) : '' })
      amt.addEventListener('input', updateSplitTotal)
      const row = el('div', { class: 'split-row' }, [
        sel,
        el('div', { class: 'money-wrap split-amt' }, [el('span', { class: 'money-sign', text: '$' }), amt]),
        el('button', { type: 'button', class: 'icon-btn danger', 'aria-label': 'Remove split', onClick: () => {
          splitRows = splitRows.filter((r) => r.row !== row)
          row.remove()
          updateSplitTotal()
        } }, [ui.icon('trash', 15)]),
      ])
      splitRows.push({ row, sel, amt })
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
        splitOn ? splitEditor : singleCatRef.node,
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

    const acctSelect = el('select', { id: 'tx-acct', class: 'input' })
    acctSelect.appendChild(el('option', { value: '', text: 'None' }))
    s.data.accounts.forEach((a) =>
      acctSelect.appendChild(el('option', { value: a.id, text: a.name, selected: existing && existing.account_id === a.id })))

    const dateInput = el('input', { id: 'tx-date', class: 'input', type: 'date', value: existing ? existing.occurred_on : todayISO() })

    const vendorList = el('datalist', { id: 'tx-vendor-list' }, s.vendors().map((v) => el('option', { value: v })))
    const vendorInput = el('input', { id: 'tx-vendor', class: 'input', list: 'tx-vendor-list', value: existing ? existing.vendor || '' : '', placeholder: 'e.g. Whole Foods' })

    const descInput = el('input', { id: 'tx-desc', class: 'input', value: existing ? existing.description || '' : '', placeholder: 'e.g. Weekly grocery run' })

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

    const seg = el('div', { class: 'segment' }, ['expense', 'income'].map((k) =>
      el('button', { type: 'button', class: (kind === k ? 'on ' : '') + k, text: k, onClick: () => {
        if (k === kind) return
        kind = k
        seg.querySelectorAll('button').forEach((b) => b.classList.remove('on'))
        seg.querySelector(`button.${k}`).classList.add('on')
        // Category options depend on kind — rebuild single + split selects.
        singleCatRef.node = makeCatSelect('', 'tx-cat')
        splitRows = []
        splitList.innerHTML = ''
        renderCatSection()
      } })))

    renderCatSection()

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

        let category_id = null
        let splits = []
        if (splitOn) {
          splits = splitRows
            .map((r) => ({ category_id: r.sel.value || null, amount: round2(r.amt.value) }))
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
          category_id = singleCatRef.node.value || null
        }

        const payload = {
          kind,
          amount,
          category_id,
          splits,
          account_id: acctSelect.value || null,
          description: descInput.value.trim() || null,
          vendor: vendorInput.value.trim() || null,
          tag_ids: [...selectedTags],
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
      catSection,
      el('div', { class: 'grid-2' }, [
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Account' }), acctSelect]),
        el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Date' }), dateInput]),
      ]),
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Vendor (optional)' }), vendorInput, vendorList]),
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Description (optional)' }), descInput]),
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Tags' }), tagsWrap]),
      err,
      submitBtn,
    ])

    const m = ui.modal({ title: existing ? 'Edit transaction' : 'Add transaction', body: form })
  }

  return render
})()
