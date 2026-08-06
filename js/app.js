/* ==========================================================================
 * app.js — bootstrap & orchestration. Chooses the backend (local vs cloud),
 * handles the cloud auth + household flow, builds the nav shell, and wires the
 * router. Loaded last.
 * ========================================================================== */
window.App = window.App || {}

App.state = { user: null, households: [], mode: 'local', unlocked: false }

/* Lock the app now (requires a PIN to be set). */
App.lockNow = function () {
  if (!App.config.hasPin()) return
  App.state.unlocked = false
  App.boot()
}

const NAV = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' },
  { path: '/transactions', label: 'Transactions', icon: 'tx' },
  { path: '/budgets', label: 'Budgets', icon: 'budget' },
  { path: '/reports', label: 'Reports', icon: 'report' },
  { path: '/accounts', label: 'Accounts', icon: 'wallet' },
  { path: '/family', label: 'Family', icon: 'users' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
]
// Mobile bottom bar shows the five core destinations; Family + Settings live
// in the mobile top bar and the desktop sidebar.
const BOTTOM = NAV.slice(0, 5)

const root = () => App.util.$('#app')

/* -------------------------------------------------------------------------- */
/* Theme (light / dark / system)                                               */
/* -------------------------------------------------------------------------- */
function systemPrefersLight() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
}

/* Resolve the configured theme and apply it to the document. */
App.applyTheme = function () {
  const pref = App.config.get('theme') || 'system'
  const resolved = pref === 'system' ? (systemPrefersLight() ? 'light' : 'dark') : pref
  document.documentElement.setAttribute('data-theme', resolved)
  App.state.resolvedTheme = resolved
  const meta = App.util.$('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#F5F7FA' : '#0f1626')
}

/* Flip between explicit light/dark (used by the quick toggle button). */
App.toggleTheme = function () {
  const next = App.state.resolvedTheme === 'light' ? 'dark' : 'light'
  App.config.write({ theme: next })
  App.applyTheme()
  App.refreshThemeButtons()
  // Keep any theme controls in the current page (e.g. Settings) in sync.
  App.router.render()
}

App.refreshThemeButtons = function () {
  const name = App.state.resolvedTheme === 'light' ? 'moon' : 'sun'
  const label = App.state.resolvedTheme === 'light' ? 'Dark mode' : 'Light mode'
  App.util.$$('.theme-toggle').forEach((b) => {
    const iconHost = b.querySelector('.icon')
    if (iconHost) iconHost.replaceWith(App.ui.icon(name, b.dataset.iconSize ? Number(b.dataset.iconSize) : 20))
    const lbl = b.querySelector('.theme-label')
    if (lbl) lbl.textContent = label
  })
}

// Follow the system when the OS theme changes and the app is set to "system".
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: light)')
  const onChange = () => {
    if ((App.config.get('theme') || 'system') === 'system') {
      App.applyTheme()
      App.refreshThemeButtons()
    }
  }
  if (mq.addEventListener) mq.addEventListener('change', onChange)
  else if (mq.addListener) mq.addListener(onChange)
}

/* Re-render only the current route (data already in cache). */
App.rerender = function () {
  App.router.render()
}

/* Reload cached data from the backend, then re-render the current route. */
App.refresh = async function () {
  await App.store.refresh()
  App.router.render()
}

/* Register routes once. */
App.router.register('/', App.pages.dashboard)
App.router.register('/transactions', App.pages.transactions)
App.router.register('/budgets', App.pages.budgets)
App.router.register('/reports', App.pages.reports)
App.router.register('/accounts', App.pages.accounts)
App.router.register('/family', App.pages.family)
App.router.register('/settings', App.pages.settings)

/* -------------------------------------------------------------------------- */
/* Boot                                                                        */
/* -------------------------------------------------------------------------- */
App.boot = async function () {
  const { el } = App.util
  App.util.setCurrency(App.config.get('currency'))
  App.applyTheme()
  App.ui.closeModal()

  // App lock: gate everything behind the PIN until unlocked this session.
  if (App.config.hasPin() && !App.state.unlocked) {
    renderLock()
    return
  }

  App.util.clear(root()).appendChild(App.ui.spinner('Loading MoneySmart…'))

  if (App.config.isCloud()) {
    App.state.mode = 'cloud'
    try {
      await bootCloud()
    } catch (err) {
      console.error(err)
      renderCloudError(err)
    }
  } else {
    App.state.mode = 'local'
    await App.LocalBackend.init()
    App.store.setBackend(App.LocalBackend)
    await App.store.refresh()
    renderShell()
  }
}

async function bootCloud() {
  const cloud = App.CloudBackend
  await cloud.init()

  const session = await cloud.getSession()
  if (!session) return renderAuth()

  App.state.user = await cloud.getUser()
  const households = await cloud.listHouseholds()
  App.state.households = households

  if (households.length === 0) return renderOnboarding()

  const currentId = cloud.getCurrentHouseholdId()
  if (!currentId || !households.some((h) => h.id === currentId)) {
    cloud.setCurrentHousehold(households[0].id)
  }

  App.store.setBackend(cloud)
  await App.store.refresh()
  renderShell()
}

/* -------------------------------------------------------------------------- */
/* Nav shell                                                                   */
/* -------------------------------------------------------------------------- */
function brand() {
  const { el } = App.util
  return el('div', { class: 'brand' }, [
    App.ui.logoMark(36),
    el('div', {}, [
      App.ui.wordmark('1.02rem'),
      el('div', { class: 'brand-sub', text: 'Every dollar has a home.' }),
    ]),
  ])
}

function navLinks(items, className) {
  const { el } = App.util
  return el('nav', { class: className }, items.map((it) =>
    el('a', { href: '#' + it.path, dataset: { route: it.path } }, [
      App.ui.icon(it.icon, 20),
      el('span', { text: it.label }),
    ])))
}

function householdSwitcher() {
  if (App.state.mode !== 'cloud' || App.state.households.length === 0) return null
  const { el } = App.util
  const current = App.store.data.household
  const menu = el('div', { class: 'switcher-menu', style: { display: 'none' } },
    App.state.households.map((h) =>
      el('button', {
        onClick: async () => { await switchHousehold(h.id) },
      }, [
        el('span', { text: h.name, style: { overflow: 'hidden', textOverflow: 'ellipsis' } }),
        current && current.id === h.id ? App.ui.icon('check', 16) : null,
      ])))
  const btn = el('button', {
    class: 'switcher-btn',
    onClick: () => { menu.style.display = menu.style.display === 'none' ? 'block' : 'none' },
  }, [
    el('div', { style: { minWidth: 0 } }, [
      el('div', { class: 'switcher-label', text: 'Household' }),
      el('div', { class: 'switcher-name', text: (current && current.name) || '—' }),
    ]),
    App.ui.icon('chevronRight', 16),
  ])
  return el('div', { class: 'switcher' }, [btn, menu])
}

async function switchHousehold(id) {
  App.CloudBackend.setCurrentHousehold(id)
  App.util.clear(root()).appendChild(App.ui.spinner('Switching household…'))
  await App.store.refresh()
  renderShell()
}

// A nav-item-styled button that flips the theme; label + icon reflect state.
function themeNavButton() {
  const { el } = App.util
  const isLight = App.state.resolvedTheme === 'light'
  return el('button', {
    class: 'nav-btn theme-toggle',
    onClick: () => App.toggleTheme(),
  }, [App.ui.icon(isLight ? 'moon' : 'sun', 20), el('span', { class: 'theme-label', text: isLight ? 'Dark mode' : 'Light mode' })])
}

// A compact icon-only theme toggle for the mobile top bar.
function themeIconButton() {
  const { el } = App.util
  const isLight = App.state.resolvedTheme === 'light'
  return el('button', { class: 'icon-btn theme-toggle', dataset: { iconSize: '20' }, 'aria-label': 'Toggle light or dark theme', onClick: () => App.toggleTheme() }, [App.ui.icon(isLight ? 'moon' : 'sun', 20)])
}

function lockNavButton() {
  if (!App.config.hasPin()) return null
  return App.util.el('button', { class: 'nav-btn', onClick: () => App.lockNow() }, [
    App.ui.icon('lock', 20), App.util.el('span', { text: 'Lock now' }),
  ])
}

function sideFoot() {
  const { el } = App.util
  const themeBtn = themeNavButton()
  if (App.state.mode === 'cloud') {
    return el('div', { class: 'side-foot' }, [
      el('div', { class: 'who', text: (App.state.user && App.state.user.email) || '' }),
      themeBtn,
      lockNavButton(),
      el('button', {
        class: 'nav-btn',
        onClick: async () => { await App.CloudBackend.signOut(); await App.boot() },
      }, [App.ui.icon('logout', 20), el('span', { text: 'Sign out' })]),
    ])
  }
  return el('div', { class: 'side-foot' }, [
    themeBtn,
    lockNavButton(),
    el('a', { href: '#/settings', class: 'nav-btn', style: { color: 'var(--brand)', textDecoration: 'none' } }, [
      App.ui.icon('cloud', 20), el('span', { text: 'Connect Supabase' }),
    ]),
  ])
}

function renderShell() {
  const { el } = App.util

  const sidebar = el('aside', { class: 'sidebar' }, [
    brand(),
    householdSwitcher(),
    navLinks(NAV, 'nav'),
    sideFoot(),
  ])

  const outlet = el('div', { id: 'outlet' })

  const topbarRight = el('div', { style: { display: 'flex', gap: '4px' } }, [
    themeIconButton(),
    App.config.hasPin()
      ? el('button', { class: 'icon-btn', 'aria-label': 'Lock now', onClick: () => App.lockNow() }, [App.ui.icon('lock', 20)])
      : null,
    el('a', { href: '#/family', class: 'icon-btn', 'aria-label': 'Family' }, [App.ui.icon('users', 20)]),
    el('a', { href: '#/settings', class: 'icon-btn', 'aria-label': 'Settings' }, [App.ui.icon('settings', 20)]),
    App.state.mode === 'cloud'
      ? el('button', { class: 'icon-btn', 'aria-label': 'Sign out', onClick: async () => { await App.CloudBackend.signOut(); await App.boot() } }, [App.ui.icon('logout', 20)])
      : null,
  ])

  const main = el('div', { class: 'main' }, [
    el('header', { class: 'topbar' }, [brand(), topbarRight]),
    el('div', { class: 'content' }, [
      App.state.mode === 'cloud' ? el('div', { class: 'topbar-switch' }, [householdSwitcher()]) : null,
      outlet,
    ]),
  ])

  const shell = el('div', { class: 'app-shell' }, [
    sidebar,
    main,
    navLinks(BOTTOM, 'bottom-nav'),
  ])

  App.util.clear(root()).appendChild(shell)
  App.router.mount(outlet, markActive)
  App.router.render()
}

function markActive(path) {
  App.util.$$('[data-route]').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === path)
  })
}

/* -------------------------------------------------------------------------- */
/* Lock screen (device PIN)                                                    */
/* -------------------------------------------------------------------------- */
function renderLock() {
  const { el } = App.util
  if (App.state._lockCleanup) App.state._lockCleanup() // drop any prior key listener
  const pinLength = App.config.get('pinLength') || 4
  let entered = ''
  let busy = false

  const dots = el('div', { class: 'pin-dots' })
  const errorEl = el('div', { class: 'pin-error' })

  function paintDots() {
    App.util.clear(dots)
    for (let i = 0; i < pinLength; i++) {
      dots.appendChild(el('span', { class: 'pin-dot' + (i < entered.length ? ' on' : '') }))
    }
  }
  paintDots()

  async function tryUnlock() {
    busy = true
    const ok = await App.config.verifyPin(entered)
    if (ok) {
      cleanup()
      App.state.unlocked = true
      App.boot()
    } else {
      busy = false
      entered = ''
      paintDots()
      card.classList.add('shake')
      errorEl.textContent = 'Wrong PIN — try again'
      setTimeout(() => card.classList.remove('shake'), 450)
    }
  }

  function press(d) {
    if (busy || entered.length >= pinLength) return
    entered += d
    errorEl.textContent = ''
    paintDots()
    if (entered.length === pinLength) tryUnlock()
  }
  function backspace() {
    if (busy) return
    entered = entered.slice(0, -1)
    paintDots()
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']
  const keypad = el('div', { class: 'keypad' }, keys.map((k) => {
    if (k === '') return el('span', {})
    if (k === '⌫') return el('button', { type: 'button', class: 'key key-fn', 'aria-label': 'Delete', onClick: backspace }, [App.ui.icon('backspace', 22)])
    return el('button', { type: 'button', class: 'key', text: k, onClick: () => press(k) })
  }))

  function onKey(e) {
    if (e.key >= '0' && e.key <= '9') press(e.key)
    else if (e.key === 'Backspace') backspace()
  }
  window.addEventListener('keydown', onKey)
  function cleanup() { window.removeEventListener('keydown', onKey) }
  App.state._lockCleanup = cleanup

  const card = el('div', { class: 'lock-card' }, [
    App.ui.logoMark(60),
    App.ui.wordmark('1.6rem'),
    el('p', { class: 'lock-sub', text: 'Enter your PIN to unlock' }),
    dots,
    errorEl,
    keypad,
  ])

  App.util.clear(root()).appendChild(
    el('div', { class: 'lock-screen' }, [
      card,
      el('p', { class: 'lock-tag', text: 'Every dollar has a home.' }),
    ]),
  )
}

/* -------------------------------------------------------------------------- */
/* Cloud: auth screen                                                          */
/* -------------------------------------------------------------------------- */
function renderAuth() {
  const { el } = App.util
  const ui = App.ui
  let mode = 'signin'

  const emailInput = el('input', { class: 'input', type: 'email', required: 'required', placeholder: 'you@family.com', autocomplete: 'email' })
  const passInput = el('input', { class: 'input', type: 'password', required: 'required', minlength: '6', placeholder: '••••••••' })
  const notice = el('div', {})
  const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: 'Sign in' })
  const toggle = el('p', { class: 'muted', style: { textAlign: 'center', marginTop: '18px' } })

  function paintToggle() {
    submitBtn.textContent = mode === 'signin' ? 'Sign in' : 'Create account'
    App.util.clear(toggle).append(
      document.createTextNode(mode === 'signin' ? "Don't have an account? " : 'Already have an account? '),
      el('button', { class: 'link-btn', text: mode === 'signin' ? 'Sign up' : 'Sign in', onClick: () => { mode = mode === 'signin' ? 'signup' : 'signin'; App.util.clear(notice); paintToggle() } }),
    )
  }
  paintToggle()

  const form = el('form', {
    onSubmit: async (e) => {
      e.preventDefault()
      App.util.clear(notice)
      submitBtn.disabled = true
      try {
        if (mode === 'signin') {
          await App.CloudBackend.signIn(emailInput.value.trim(), passInput.value)
          await App.boot()
        } else {
          const { needsConfirmation } = await App.CloudBackend.signUp(emailInput.value.trim(), passInput.value)
          if (needsConfirmation) {
            mode = 'signin'
            paintToggle()
            notice.appendChild(el('div', { class: 'notice ok', text: 'Check your email to confirm your account, then sign in.' }))
            submitBtn.disabled = false
          } else {
            await App.boot()
          }
        }
      } catch (ex) {
        submitBtn.disabled = false
        notice.appendChild(el('div', { class: 'notice error', text: ex.message || 'Something went wrong' }))
      }
    },
  }, [
    el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Email' }), emailInput]),
    el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Password' }), passInput]),
    notice,
    submitBtn,
  ])

  const card = el('div', { class: 'auth-card' }, [
    el('div', { class: 'auth-head' }, [
      App.ui.logoMark(58),
      App.ui.wordmark('1.7rem'),
      el('p', { class: 'muted', text: 'Sign in to your family budget.' }),
    ]),
    el('div', { class: 'card pad' }, [form]),
    toggle,
    el('p', { style: { textAlign: 'center', marginTop: '8px' } }, [
      el('button', { class: 'link-btn', style: { fontWeight: 400, fontSize: '0.85rem', color: 'var(--faint)' }, text: 'Use local storage instead', onClick: async () => { App.config.write({ mode: 'local' }); await App.boot() } }),
    ]),
  ])

  App.util.clear(root()).appendChild(el('div', { class: 'center-screen' }, [card]))
}

/* -------------------------------------------------------------------------- */
/* Cloud: household onboarding                                                 */
/* -------------------------------------------------------------------------- */
function renderOnboarding() {
  const { el } = App.util
  const ui = App.ui
  let tab = 'create'
  const defaultName = (App.state.user && App.state.user.email ? App.state.user.email.split('@')[0] : 'Me')

  const hNameInput = el('input', { class: 'input', placeholder: 'The Smith Family' })
  const codeInput = el('input', { class: 'input', placeholder: 'a1b2c3d4', style: { fontFamily: 'ui-monospace, monospace', letterSpacing: '.15em' } })
  const dNameInput = el('input', { class: 'input', placeholder: defaultName })
  const notice = el('div', {})
  const submitBtn = el('button', { class: 'btn primary block', type: 'submit', text: 'Create household' })

  const fieldsWrap = el('div', {})
  function paintFields() {
    App.util.clear(fieldsWrap)
    if (tab === 'create') {
      fieldsWrap.appendChild(el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Household name' }), hNameInput]))
    } else {
      fieldsWrap.appendChild(el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Invite code' }), codeInput]))
    }
    fieldsWrap.appendChild(el('div', { class: 'field' }, [el('label', { class: 'label', text: 'Your name' }), dNameInput]))
    submitBtn.textContent = tab === 'create' ? 'Create household' : 'Join household'
  }

  const tabs = el('div', { class: 'tabs' }, [
    tabBtn('create', 'Create'),
    tabBtn('join', 'Join'),
  ])
  function tabBtn(id, label) {
    return el('button', { type: 'button', class: tab === id ? 'on' : '', text: label, onClick: () => {
      tab = id
      tabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', ['create', 'join'][i] === id))
      App.util.clear(notice)
      paintFields()
    } })
  }
  paintFields()

  const form = el('form', {
    onSubmit: async (e) => {
      e.preventDefault()
      App.util.clear(notice)
      submitBtn.disabled = true
      const name = dNameInput.value.trim() || defaultName
      try {
        if (tab === 'create') {
          await App.CloudBackend.createHousehold(hNameInput.value.trim() || 'Our Household', name)
        } else {
          await App.CloudBackend.joinHousehold(codeInput.value.trim(), name)
        }
        await App.boot()
      } catch (ex) {
        submitBtn.disabled = false
        notice.appendChild(el('div', { class: 'notice error', text: ex.message || 'Something went wrong' }))
      }
    },
  }, [fieldsWrap, notice, submitBtn])

  const card = el('div', { class: 'auth-card' }, [
    el('div', { class: 'auth-head' }, [
      el('h1', { text: 'Set up your budget' }),
      el('p', { class: 'muted', text: 'Create a household for your family, or join one with an invite code.' }),
    ]),
    tabs,
    el('div', { class: 'card pad' }, [form]),
    el('p', { style: { textAlign: 'center', marginTop: '14px' } }, [
      el('button', { class: 'link-btn', style: { fontWeight: 400, fontSize: '0.85rem', color: 'var(--faint)' }, text: 'Sign out', onClick: async () => { await App.CloudBackend.signOut(); await App.boot() } }),
    ]),
  ])

  App.util.clear(root()).appendChild(el('div', { class: 'center-screen' }, [card]))
}

/* -------------------------------------------------------------------------- */
/* Cloud connection error                                                      */
/* -------------------------------------------------------------------------- */
function renderCloudError(err) {
  const { el } = App.util
  const card = el('div', { class: 'auth-card' }, [
    el('div', { class: 'auth-head' }, [
      App.ui.logoMark(52),
      el('h1', { text: 'Connection problem' }),
    ]),
    el('div', { class: 'card pad' }, [
      el('div', { class: 'notice error', style: { marginBottom: '14px' }, text: (err && err.message) || 'Could not connect to Supabase.' }),
      el('p', { class: 'muted', style: { marginBottom: '14px' }, text: 'Check your Supabase URL and anon key, make sure you ran supabase/schema.sql, and that you are online.' }),
      el('div', { class: 'stack' }, [
        el('button', { class: 'btn primary block', text: 'Open settings', onClick: () => { App.config.write({ mode: 'local' }); App.boot().then(() => App.router.navigate('/settings')) } }),
        el('button', { class: 'btn ghost block', text: 'Use local storage', onClick: async () => { App.config.write({ mode: 'local' }); await App.boot() } }),
      ]),
    ]),
  ])
  App.util.clear(root()).appendChild(el('div', { class: 'center-screen' }, [card]))
}

/* Go! */
App.boot()
