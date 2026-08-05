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
            el('span', { class: 'avatar', style: { background: 'var(--brand-soft)', color: 'var(--brand-text)', borderRadius: '50%' }, text: ((m.display_name || '?')[0] || '?').toUpperCase() }),
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
        el('button', { class: 'btn ghost sm', onClick: () => openCat(null) }, [ui.icon('plus', 16), 'New']),
      ]),
      el('p', { class: 'muted', style: { marginBottom: '6px' }, text: 'Add categories and subcategories. Deleting a category also removes its subcategories.' }),
      catGroup('Expenses', 'expense'),
      catGroup('Income', 'income'),
    ])

    /* Tags card */
    const tagsCard = el('div', { class: 'card pad' }, [
      el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' } }, [
        el('div', { class: 'section-title', style: { marginBottom: 0 } }, [ui.icon('tag', 18), 'Tags']),
        el('button', { class: 'btn ghost sm', onClick: () => openTag() }, [ui.icon('plus', 16), 'New']),
      ]),
      el('p', { class: 'muted', style: { marginBottom: '10px' }, text: 'Freeform labels you can attach to any transaction and report on.' }),
      s.data.tags.length === 0
        ? el('p', { class: 'faint', style: { fontSize: '13px' }, text: 'No tags yet.' })
        : el('div', { class: 'chips' }, s.data.tags.map((tag) =>
            el('span', { class: 'chip' }, [
              el('span', { class: 'dot', style: { background: tag.color } }),
              tag.name,
              el('button', { class: 'icon-btn danger', 'aria-label': `Delete ${tag.name}`, style: { padding: '4px' }, onClick: () => delTag(tag) }, [ui.icon('trash', 14)]),
            ]),
          )),
    ])

    return el('div', {}, [
      ui.pageHeader('Family', 'Invite members, categories, and tags.'),
      el('div', { class: 'stack' }, [shareCard, membersCard, catsCard, tagsCard]),
    ])
  }

  function catGroup(title, kind) {
    const { el } = App.util
    const ui = App.ui
    const s = App.store
    const parents = s.topCategories(kind)
    if (parents.length === 0) return document.createComment('')

    return el('div', { style: { marginTop: '14px' } }, [
      el('div', { class: 'label', text: title }),
      el('div', { class: 'cat-tree' }, parents.map((p) => {
        const kids = s.childrenOf(p.id)
        return el('div', { class: 'cat-node' }, [
          el('div', { class: 'cat-parent' }, [
            el('span', { class: 'dot', style: { background: p.color } }),
            el('span', { class: 'cat-name', text: p.name }),
            el('div', { class: 'cat-actions' }, [
              el('button', { class: 'btn ghost sm', 'aria-label': `Add subcategory to ${p.name}`, onClick: () => openCat(p) }, [ui.icon('plus', 14), 'Sub']),
              el('button', { class: 'icon-btn danger', 'aria-label': `Delete ${p.name}`, onClick: () => delCat(p) }, [ui.icon('trash', 15)]),
            ]),
          ]),
          kids.length
            ? el('div', { class: 'cat-children' }, kids.map((c) =>
                el('div', { class: 'cat-child' }, [
                  el('span', { class: 'cat-branch', text: '↳' }),
                  el('span', { class: 'dot', style: { background: c.color } }),
                  el('span', { class: 'cat-name', text: c.name }),
                  el('button', { class: 'icon-btn danger', 'aria-label': `Delete ${c.name}`, onClick: () => delCat(c) }, [ui.icon('trash', 14)]),
                ]),
              ))
            : null,
        ])
      })),
    ])
  }

  async function delCat(c) {
    const kids = App.store.childrenOf(c.id)
    const extra = kids.length
      ? ` This also deletes its ${kids.length} subcategor${kids.length === 1 ? 'y' : 'ies'}.`
      : ''
    if (!(await App.ui.confirm(`Delete the "${c.name}" category?${extra} Transactions are kept but uncategorized.`))) return
    try {
      await App.store.getBackend().deleteCategory(c.id)
      await App.refresh()
      App.ui.toast('Category deleted', 'success')
    } catch (e) {
      App.ui.toast(e.message || 'Failed to delete', 'error')
    }
  }

  async function delTag(tag) {
    if (!(await App.ui.confirm(`Delete the "${tag.name}" tag? It will be removed from any transactions using it.`))) return
    try {
      await App.store.getBackend().deleteTag(tag.id)
      await App.refresh()
      App.ui.toast('Tag deleted', 'success')
    } catch (e) {
      App.ui.toast(e.message || 'Failed to delete', 'error')
    }
  }

  function openTag() {
    const { el } = App.util
    const ui = App.ui
    let color = SWATCHES[13] // slate default

    const nameInput = el('input', { class: 'input', required: 'required', placeholder: 'e.g. Vacation, Reimbursable' })
    nameInput.setAttribute('autofocus', '')

    const swatches = el('div', { class: 'swatches' }, SWATCHES.map((sw) =>
      el('button', { type: 'button', class: 'swatch' + (sw === color ? ' sel' : ''), style: { background: sw }, 'aria-label': `Color ${sw}`, onClick: (e) => {
        color = sw
        swatches.querySelectorAll('.swatch').forEach((b) => b.classList.remove('sel'))
        e.currentTarget.classList.add('sel')
      } })))

    const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: 'Create tag' })
    const err = el('div', {})

    const form = el('form', {
      onSubmit: async (e) => {
        e.preventDefault()
        ui.clear(err)
        submitBtn.disabled = true
        try {
          await App.store.getBackend().addTag({ name: nameInput.value.trim(), color })
          await App.refresh()
          m.close()
          ui.toast('Tag created', 'success')
        } catch (ex) {
          submitBtn.disabled = false
          err.appendChild(el('div', { class: 'notice error', text: ex.message || 'Failed to save' }))
        }
      },
    }, [
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Name' }), nameInput]),
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Color' }), swatches]),
      err,
      submitBtn,
    ])
    const m = ui.modal({ title: 'New tag', body: form })
  }

  // presetParent: a category object to add a subcategory under, or null for a
  // top-level category (with an optional parent picker).
  function openCat(presetParent) {
    const { el } = App.util
    const ui = App.ui
    const s = App.store

    let kind = presetParent ? presetParent.kind : 'expense'
    let parentId = presetParent ? presetParent.id : ''
    let color = presetParent ? presetParent.color : SWATCHES[0]

    const nameInput = el('input', { class: 'input', required: 'required', placeholder: presetParent ? 'e.g. Fresh produce' : 'e.g. Groceries' })
    nameInput.setAttribute('autofocus', '')

    // Parent picker (top-level mode only) — repopulated when the kind changes.
    const parentSelect = el('select', { class: 'input' })
    function fillParents() {
      ui.clear(parentSelect)
      parentSelect.appendChild(el('option', { value: '', text: 'None (top-level category)' }))
      s.topCategories(kind).forEach((p) =>
        parentSelect.appendChild(el('option', { value: p.id, text: p.name, selected: p.id === parentId })))
    }
    parentSelect.addEventListener('change', () => { parentId = parentSelect.value })
    if (!presetParent) fillParents()

    const seg = el('div', { class: 'segment' }, ['expense', 'income'].map((k) =>
      el('button', { type: 'button', class: (kind === k ? 'on' : ''), text: k, onClick: () => {
        kind = k
        parentId = ''
        seg.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', ['expense', 'income'][i] === k))
        fillParents()
      } })))

    const swatches = el('div', { class: 'swatches' }, SWATCHES.map((sw) =>
      el('button', { type: 'button', class: 'swatch' + (sw === color ? ' sel' : ''), style: { background: sw }, 'aria-label': `Color ${sw}`, onClick: (e) => {
        color = sw
        swatches.querySelectorAll('.swatch').forEach((b) => b.classList.remove('sel'))
        e.currentTarget.classList.add('sel')
      } })))

    const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: presetParent ? 'Add subcategory' : 'Create category' })
    const err = el('div', {})

    const topFields = presetParent
      ? el('div', { class: 'notice ok', style: { marginBottom: '4px' }, text: `Subcategory of ${presetParent.name} · ${kind}` })
      : el('div', {}, [
          seg,
          el('div', { class: 'field', style: { marginTop: '14px' } }, [el('label', { class: 'label', text: 'Parent category (optional)' }), parentSelect]),
        ])

    const form = el('form', {
      onSubmit: async (e) => {
        e.preventDefault()
        ui.clear(err)
        submitBtn.disabled = true
        try {
          await App.store.getBackend().addCategory({ name: nameInput.value.trim(), kind, color, parent_id: parentId || null })
          await App.refresh()
          m.close()
          ui.toast(presetParent ? 'Subcategory created' : 'Category created', 'success')
        } catch (ex) {
          submitBtn.disabled = false
          err.appendChild(el('div', { class: 'notice error', text: ex.message || 'Failed to save' }))
        }
      },
    }, [
      topFields,
      el('div', { class: 'field', style: { marginTop: '14px' } }, [el('label', { class: 'label', text: 'Name' }), nameInput]),
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Color' }), swatches]),
      err,
      submitBtn,
    ])
    const m = ui.modal({ title: presetParent ? 'New subcategory' : 'New category', body: form })
  }

  return render
})()
