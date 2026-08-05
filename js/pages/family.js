/* ==========================================================================
 * pages/family.js — invite code, members, and category management.
 * ========================================================================== */
window.App = window.App || {}
App.pages = App.pages || {}

App.pages.family = (function () {
  const SWATCHES = ['#10b981','#22c55e','#3b82f6','#6366f1','#8b5cf6','#ec4899','#f43f5e','#ef4444','#f59e0b','#eab308','#14b8a6','#06b6d4','#84cc16','#64748b']

  function render() {
    const { el } = App.util
    const s = App.store
    const ui = App.ui
    const isCloud = s.getBackend().isCloud
    const household = s.data.household

    /* Invite / sharing card */
    let shareCard
    if (isCloud) {
      const codeBox = el('code', { class: 'code', text: (household && household.invite_code) || '—' })
      const copyBtn = el('button', { class: 'btn ghost', 'aria-label': 'Copy invite code' }, [ui.icon('copy', 16), 'Copy'])
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(household.invite_code)
          ui.clear(copyBtn).append(ui.icon('check', 16), document.createTextNode('Copied'))
          setTimeout(() => ui.clear(copyBtn).append(ui.icon('copy', 16), document.createTextNode('Copy')), 1600)
        } catch { ui.toast('Copy failed — select the code manually', 'error') }
      })
      shareCard = el('div', { class: 'card pad' }, [
        el('div', { class: 'section-title' }, [ui.icon('users', 18), 'Invite family members']),
        el('p', { class: 'muted', style: { marginBottom: '12px' }, text: 'Share this code. Family members sign up, choose “Join”, and enter it to access this shared budget.' }),
        el('div', { class: 'code-box' }, [codeBox, copyBtn]),
      ])
    } else {
      shareCard = el('div', { class: 'card pad' }, [
        el('div', { class: 'section-title' }, [ui.icon('cloud', 18), 'Share with your family']),
        el('p', { class: 'muted', style: { marginBottom: '12px' }, text: 'You are using local storage on this device only. To share one budget across devices and family members, connect a free Supabase project.' }),
        el('button', { class: 'btn primary', onClick: () => App.router.navigate('/settings') }, [ui.icon('cloud', 18), 'Connect Supabase']),
      ])
    }

    /* Members card */
    const membersCard = el('div', { class: 'card pad' }, [
      el('h2', { class: 'section-title', html: `Members <span class="faint" style="font-weight:400">(${s.data.members.length})</span>` }),
      el('div', { class: 'list' }, s.data.members.map((m) =>
        el('div', { class: 'row' }, [
          el('div', { class: 'row-main' }, [
            el('span', { class: 'avatar', style: { background: 'var(--brand-soft)', color: '#6ee7b7', borderRadius: '50%' }, text: ((m.display_name || '?')[0] || '?').toUpperCase() }),
            el('div', {}, [
              el('div', { class: 'row-title', text: (m.display_name || 'Member') }),
              el('div', { class: 'row-sub', style: { textTransform: 'capitalize' }, text: m.role }),
            ]),
          ]),
        ]),
      )),
    ])

    /* Categories card */
    const catsCard = el('div', { class: 'card pad' }, [
      el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' } }, [
        el('div', { class: 'section-title', style: { marginBottom: 0 } }, [ui.icon('budget', 18), 'Categories']),
        el('button', { class: 'btn ghost sm', onClick: () => openCat() }, [ui.icon('plus', 16), 'New']),
      ]),
      catGroup('Expenses', s.expenseCategories()),
      catGroup('Income', s.incomeCategories()),
    ])

    return el('div', {}, [
      ui.pageHeader('Family', 'Invite members and manage categories.'),
      el('div', { class: 'stack' }, [shareCard, membersCard, catsCard]),
    ])
  }

  function catGroup(title, cats) {
    const { el } = App.util
    const ui = App.ui
    if (cats.length === 0) return document.createComment('')
    return el('div', { style: { marginTop: '10px' } }, [
      el('div', { class: 'label', text: title }),
      el('div', { class: 'chips' }, cats.map((c) =>
        el('span', { class: 'chip' }, [
          el('span', { class: 'dot', style: { background: c.color } }),
          c.name,
          el('button', { class: 'icon-btn danger', 'aria-label': `Delete ${c.name}`, style: { padding: '4px' }, onClick: () => delCat(c) }, [ui.icon('trash', 14)]),
        ]),
      )),
    ])
  }

  async function delCat(c) {
    if (!(await App.ui.confirm(`Delete the "${c.name}" category? Its transactions are kept but uncategorized.`))) return
    try {
      await App.store.getBackend().deleteCategory(c.id)
      await App.refresh()
      App.ui.toast('Category deleted', 'success')
    } catch (e) {
      App.ui.toast(e.message || 'Failed to delete', 'error')
    }
  }

  function openCat() {
    const { el } = App.util
    const ui = App.ui
    let kind = 'expense'
    let color = SWATCHES[0]

    const nameInput = el('input', { class: 'input', required: 'required', placeholder: 'e.g. Groceries' })
    nameInput.setAttribute('autofocus', '')

    const seg = el('div', { class: 'segment' }, ['expense', 'income'].map((k) =>
      el('button', { type: 'button', class: (kind === k ? 'on' : ''), text: k, onClick: () => {
        kind = k
        seg.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', ['expense', 'income'][i] === k))
      } })))

    const swatches = el('div', { class: 'swatches' }, SWATCHES.map((sw) =>
      el('button', { type: 'button', class: 'swatch' + (sw === color ? ' sel' : ''), style: { background: sw }, 'aria-label': `Color ${sw}`, onClick: (e) => {
        color = sw
        swatches.querySelectorAll('.swatch').forEach((b) => b.classList.remove('sel'))
        e.currentTarget.classList.add('sel')
      } })))

    const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: 'Create category' })
    const err = el('div', {})

    const form = el('form', {
      onSubmit: async (e) => {
        e.preventDefault()
        ui.clear(err)
        submitBtn.disabled = true
        try {
          await App.store.getBackend().addCategory({ name: nameInput.value.trim(), kind, color })
          await App.refresh()
          m.close()
          ui.toast('Category created', 'success')
        } catch (ex) {
          submitBtn.disabled = false
          err.appendChild(el('div', { class: 'notice error', text: ex.message || 'Failed to save' }))
        }
      },
    }, [
      seg,
      el('div', { class: 'field', style: { marginTop: '14px' } }, [el('label', { class: 'label', text: 'Name' }), nameInput]),
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Color' }), swatches]),
      err,
      submitBtn,
    ])
    const m = ui.modal({ title: 'New category', body: form })
  }

  return render
})()
