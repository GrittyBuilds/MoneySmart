/* ==========================================================================
 * pages/settings.js — currency + storage/sync (local ⇄ Supabase cloud).
 * ========================================================================== */
window.App = window.App || {}
App.pages = App.pages || {}

App.pages.settings = (function () {
  const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'INR', 'JPY', 'SGD', 'ZAR', 'BRL', 'MXN']

  function render() {
    const { el } = App.util
    const ui = App.ui
    const cfg = App.config.all()
    const isCloud = App.store.getBackend().isCloud

    return el('div', {}, [
      ui.pageHeader('Settings', 'Appearance, security, currency, backups, and syncing.'),
      el('div', { class: 'stack' }, [
        appearanceCard(cfg),
        securityCard(),
        currencyCard(cfg),
        backupCard(),
        isCloud ? cloudConnectedCard(cfg) : localCard(cfg),
      ]),
    ])
  }

  /* ---------- Security / app lock ---------- */
  function securityCard() {
    const { el } = App.util
    const ui = App.ui
    const on = App.config.hasPin()

    const autoOptions = [
      { value: 0, label: 'Off' },
      { value: 1, label: '1 min' },
      { value: 5, label: '5 min' },
      { value: 15, label: '15 min' },
      { value: 30, label: '30 min' },
    ]
    const autoSel = el('select', { class: 'input', style: { maxWidth: '160px' } }, autoOptions.map((o) =>
      el('option', { value: String(o.value), text: o.label, selected: (App.config.get('autoLockMinutes') || 0) === o.value })))
    autoSel.addEventListener('change', () => {
      App.config.write({ autoLockMinutes: Number(autoSel.value) })
      App.startAutoLock()
      App.ui.toast('Auto-lock updated', 'success')
    })

    const body = on
      ? el('div', {}, [
          el('div', { class: 'notice ok', style: { marginBottom: '12px' }, text: 'App lock is on — a PIN is required each time MoneySmart opens on this device.' }),
          el('div', { class: 'field' }, [
            el('label', { class: 'label', text: 'Auto-lock after inactivity' }),
            autoSel,
          ]),
          el('div', { class: 'row-end', style: { justifyContent: 'flex-start', flexWrap: 'wrap' } }, [
            el('button', { class: 'btn ghost', onClick: () => openPin('change') }, [ui.icon('lock', 16), 'Change PIN']),
            el('button', { class: 'btn ghost', onClick: () => App.lockNow() }, [ui.icon('lock', 16), 'Lock now']),
            el('button', { class: 'btn ghost', onClick: turnOff }, [ui.icon('unlock', 16), 'Turn off']),
          ]),
        ])
      : el('div', {}, [
          el('p', { class: 'muted', style: { marginBottom: '12px' }, text: 'Set a PIN to keep your budget private on this device. You’ll be asked for it whenever MoneySmart opens.' }),
          el('button', { class: 'btn primary', onClick: () => openPin('set') }, [ui.icon('lock', 16), 'Set a PIN']),
        ])

    return el('div', { class: 'card pad' }, [
      el('div', { class: 'section-title' }, [ui.icon('lock', 18), 'Security & app lock']),
      body,
      el('p', { class: 'faint', style: { fontSize: '12px', marginTop: '12px' }, text: 'The PIN is stored hashed on this device. It’s a privacy lock, not full encryption — clearing browser data removes it.' }),
    ])
  }

  async function turnOff() {
    if (!(await App.ui.confirm('Turn off the app lock? Anyone with this device will be able to open MoneySmart.', { danger: false, okLabel: 'Turn off' }))) return
    App.config.clearPin()
    App.ui.toast('App lock turned off', 'success')
    App.rerender()
  }

  function openPin(mode) {
    const { el } = App.util
    const ui = App.ui
    const digits = (v) => v.replace(/\D/g, '').slice(0, 6)

    const pin1 = el('input', { class: 'input', type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: '4–6 digits' })
    pin1.setAttribute('autofocus', '')
    const pin2 = el('input', { class: 'input', type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: 'Re-enter PIN' })
    ;[pin1, pin2].forEach((i) => i.addEventListener('input', () => { i.value = digits(i.value) }))
    const err = el('div', {})
    const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: mode === 'change' ? 'Update PIN' : 'Set PIN' })

    const form = el('form', {
      onSubmit: async (e) => {
        e.preventDefault()
        ui.clear(err)
        const a = pin1.value
        const b = pin2.value
        if (a.length < 4) { err.appendChild(el('div', { class: 'notice error', text: 'PIN must be at least 4 digits.' })); return }
        if (a !== b) { err.appendChild(el('div', { class: 'notice error', text: 'The two PINs don’t match.' })); return }
        submitBtn.disabled = true
        await App.config.setPin(a)
        m.close()
        App.ui.toast(mode === 'change' ? 'PIN updated' : 'App lock enabled', 'success')
        App.rerender()
      },
    }, [
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'New PIN' }), pin1]),
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Confirm PIN' }), pin2]),
      err,
      submitBtn,
    ])
    const m = ui.modal({ title: mode === 'change' ? 'Change PIN' : 'Set a PIN', body: form })
  }

  /* ---------- Appearance / theme ---------- */
  function appearanceCard(cfg) {
    const { el } = App.util
    const options = [
      { value: 'system', label: 'System' },
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ]
    const seg = el('div', { class: 'segment', style: { maxWidth: '320px' } }, options.map((o) =>
      el('button', {
        type: 'button',
        class: cfg.theme === o.value ? 'on' : '',
        text: o.label,
        onClick: () => {
          App.config.write({ theme: o.value })
          App.applyTheme()
          App.refreshThemeButtons()
          seg.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', options[i].value === o.value))
        },
      })))
    return el('div', { class: 'card pad' }, [
      el('div', { class: 'section-title' }, [App.ui.icon('sun', 18), 'Appearance']),
      el('p', { class: 'muted', style: { marginBottom: '12px' }, text: 'Choose a light or dark theme, or follow your device setting.' }),
      seg,
    ])
  }

  /* ---------- Backup & restore ---------- */
  function backupCard() {
    const { el } = App.util
    const ui = App.ui
    const isCloud = App.store.getBackend().isCloud

    const exportBtn = el('button', { class: 'btn ghost' }, [ui.icon('download', 16), 'Export backup'])
    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true
      try {
        const backup = await App.store.getBackend().exportAll()
        App.util.downloadJSON(`moneysmart-backup-${App.util.todayISO()}.json`, backup)
        ui.toast('Backup downloaded', 'success')
      } catch (e) {
        ui.toast(e.message || 'Export failed', 'error')
      } finally {
        exportBtn.disabled = false
      }
    })

    const fileInput = el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } })
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0]
      if (!file) return
      let backup
      try {
        backup = JSON.parse(await file.text())
      } catch {
        ui.toast('That file is not valid JSON', 'error')
        fileInput.value = ''
        return
      }
      const counts = `${(backup.accounts || []).length} account(s), ${(backup.categories || []).length} categor(y/ies), ${(backup.transactions || []).length} transaction(s)`
      const message = isCloud
        ? `Import ${counts} into this cloud household? Existing data is kept; imported items are added.`
        : `Restore this backup? It will REPLACE all current local data (${counts}).`
      if (!(await ui.confirm(message, { danger: !isCloud, okLabel: isCloud ? 'Import' : 'Replace' }))) {
        fileInput.value = ''
        return
      }
      try {
        const backend = App.store.getBackend()
        if (isCloud) {
          await backend.importDump(backup)
          await App.refresh()
          ui.toast('Backup imported', 'success')
        } else {
          await backend.importAll(backup)
          await App.boot()
          ui.toast('Backup restored', 'success')
        }
      } catch (e) {
        ui.toast(e.message || 'Import failed', 'error')
      } finally {
        fileInput.value = ''
      }
    })
    const importBtn = el('button', { class: 'btn ghost', onClick: () => fileInput.click() }, [ui.icon('upload', 16), 'Import backup'])

    return el('div', { class: 'card pad' }, [
      el('div', { class: 'section-title' }, [App.ui.icon('download', 18), 'Backup & restore']),
      el('p', { class: 'muted', style: { marginBottom: '12px' }, text: isCloud
        ? 'Export a JSON copy of this household, or import a backup file to add its data here.'
        : 'Export a JSON copy of all your data to keep it safe, or import a backup to restore it on this device.' }),
      el('div', { class: 'row-end', style: { justifyContent: 'flex-start', flexWrap: 'wrap' } }, [exportBtn, importBtn, fileInput]),
    ])
  }

  function currencyCard(cfg) {
    const { el } = App.util
    const select = el('select', { class: 'input', style: { maxWidth: '220px' } },
      CURRENCIES.map((c) => el('option', { value: c, text: c, selected: c === cfg.currency })))
    select.addEventListener('change', () => {
      App.config.write({ currency: select.value })
      App.util.setCurrency(select.value)
      App.ui.toast('Currency updated', 'success')
      App.rerender()
    })
    return el('div', { class: 'card pad' }, [
      el('div', { class: 'section-title' }, [App.ui.icon('settings', 18), 'Currency']),
      el('p', { class: 'muted', style: { marginBottom: '12px' }, text: 'Used to format all amounts across the app.' }),
      select,
    ])
  }

  /* ---------- Local mode: offer to connect Supabase ---------- */
  function localCard(cfg) {
    const { el } = App.util
    const ui = App.ui

    const urlInput = el('input', { class: 'input', placeholder: 'https://YOUR-PROJECT.supabase.co', value: cfg.supabaseUrl || '' })
    const keyInput = el('input', { class: 'input', placeholder: 'anon public key', value: cfg.supabaseKey || '' })
    const err = el('div', {})
    const connectBtn = el('button', { class: 'btn primary', text: 'Connect & sync' }, [])

    connectBtn.addEventListener('click', async () => {
      ui.clear(err)
      const url = urlInput.value.trim().replace(/\/$/, '')
      const key = keyInput.value.trim()
      if (!url || !key) {
        err.appendChild(el('div', { class: 'notice error', text: 'Enter both the project URL and the anon key.' }))
        return
      }
      connectBtn.disabled = true
      connectBtn.textContent = 'Connecting…'
      App.config.write({ supabaseUrl: url, supabaseKey: key, mode: 'cloud' })
      // Re-boot into cloud mode (handles SDK load + auth screen).
      await App.boot()
    })

    return el('div', { class: 'card pad' }, [
      el('div', { class: 'section-title' }, [ui.icon('cloud', 18), 'Storage & sync']),
      el('p', { class: 'muted', text: 'You are storing data locally on this device. Connect a free Supabase project to sync across devices and share one budget with your family.' }),
      el('ol', { class: 'steps', style: { margin: '12px 0' }, html:
        'Create a project at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>.' +
        '<li>In the SQL editor, run the contents of <code>supabase/schema.sql</code>.</li>' +
        '<li>Paste your Project URL and anon key below (Project Settings → API).</li>',
      }),
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Supabase URL' }), urlInput]),
      el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Anon public key' }), keyInput]),
      err,
      el('div', { class: 'row-end' }, [connectBtn]),
      el('p', { class: 'faint', style: { fontSize: '12px', marginTop: '10px' }, text: 'The anon key is safe to store in the browser — Row Level Security keeps each household’s data private.' }),
    ])
  }

  /* ---------- Cloud mode: connected controls ---------- */
  function cloudConnectedCard(cfg) {
    const { el } = App.util
    const ui = App.ui
    const backend = App.store.getBackend()

    const importBtn = el('button', { class: 'btn ghost', text: 'Import my local data' })
    importBtn.addEventListener('click', async () => {
      const dump = App.LocalBackend._dump()
      const count = (dump.transactions || []).length + (dump.accounts || []).length
      if (count === 0) { ui.toast('No local data to import', 'info'); return }
      if (!(await ui.confirm(`Copy ${dump.accounts.length} account(s), ${dump.transactions.length} transaction(s), and their budgets into this cloud household?`, { danger: false, okLabel: 'Import' }))) return
      importBtn.disabled = true
      importBtn.textContent = 'Importing…'
      try {
        await backend.importLocalDump(dump)
        await App.refresh()
        ui.toast('Local data imported', 'success')
      } catch (e) {
        ui.toast(e.message || 'Import failed', 'error')
      } finally {
        importBtn.disabled = false
        importBtn.textContent = 'Import my local data'
      }
    })

    const signOutBtn = el('button', { class: 'btn ghost', onClick: async () => {
      await backend.signOut()
      await App.boot()
    } }, [ui.icon('logout', 16), 'Sign out'])

    const disconnectBtn = el('button', { class: 'btn ghost', text: 'Switch to local storage', onClick: async () => {
      if (!(await ui.confirm('Switch back to local (device-only) storage? Your cloud data stays in Supabase; you can reconnect any time.', { danger: false, okLabel: 'Switch' }))) return
      App.config.write({ mode: 'local' })
      await App.boot()
    } })

    return el('div', { class: 'card pad' }, [
      el('div', { class: 'section-title' }, [ui.icon('cloud', 18), 'Cloud sync — connected']),
      el('div', { class: 'list' }, [
        infoRow('Project', cfg.supabaseUrl),
        infoRow('Signed in as', (App.state.user && App.state.user.email) || '—'),
        infoRow('Household', (App.store.data.household && App.store.data.household.name) || '—'),
      ]),
      el('p', { class: 'muted', style: { margin: '14px 0 8px' }, text: 'Started locally first? Bring that data along:' }),
      el('div', { class: 'row-end', style: { justifyContent: 'flex-start', flexWrap: 'wrap' } }, [importBtn, signOutBtn, disconnectBtn]),
    ])
  }

  function infoRow(label, value) {
    const { el } = App.util
    return el('div', { class: 'row' }, [
      el('div', { class: 'row-sub', style: { color: 'var(--muted)' }, text: label }),
      el('div', { class: 'row-title', style: { textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }, text: value }),
    ])
  }

  return render
})()
