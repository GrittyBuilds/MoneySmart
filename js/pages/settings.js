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
      ui.pageHeader('Settings', 'Appearance, currency, backups, and syncing.'),
      el('div', { class: 'stack' }, [
        appearanceCard(cfg),
        currencyCard(cfg),
        backupCard(),
        isCloud ? cloudConnectedCard(cfg) : localCard(cfg),
      ]),
    ])
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
