/* ==========================================================================
 * config.js — persisted app settings (storage mode, Supabase keys, currency).
 * Lives in localStorage so it survives across sessions on a device.
 * ========================================================================== */
window.App = window.App || {}

App.config = (function () {
  const KEY = 'moneysmart.settings'

  const DEFAULTS = {
    mode: 'local', // 'local' | 'cloud'
    currency: 'USD',
    supabaseUrl: '',
    supabaseKey: '',
  }

  function read() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
    } catch {
      return { ...DEFAULTS }
    }
  }

  function write(patch) {
    const next = { ...read(), ...patch }
    localStorage.setItem(KEY, JSON.stringify(next))
    return next
  }

  const get = (k) => read()[k]
  const all = () => read()
  const hasSupabase = () => Boolean(read().supabaseUrl && read().supabaseKey)
  const isCloud = () => read().mode === 'cloud' && hasSupabase()

  return { read, write, get, all, hasSupabase, isCloud, DEFAULTS }
})()
