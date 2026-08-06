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
    theme: 'system', // 'system' | 'light' | 'dark'
    supabaseUrl: '',
    supabaseKey: '',
    // App lock (device-local privacy PIN). pinHash = sha256(salt + pin).
    pinHash: '',
    pinSalt: '',
    pinLength: 0,
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

  /* ---- App lock (PIN) ---- */
  const hasPin = () => Boolean(read().pinHash)

  async function setPin(pin) {
    const salt = App.util.uid()
    const pinHash = await App.util.sha256(salt + pin)
    write({ pinHash, pinSalt: salt, pinLength: String(pin).length })
  }

  async function verifyPin(pin) {
    const s = read()
    if (!s.pinHash) return true
    const h = await App.util.sha256(s.pinSalt + pin)
    return h === s.pinHash
  }

  function clearPin() {
    write({ pinHash: '', pinSalt: '', pinLength: 0 })
  }

  return { read, write, get, all, hasSupabase, isCloud, hasPin, setPin, verifyPin, clearPin, DEFAULTS }
})()
