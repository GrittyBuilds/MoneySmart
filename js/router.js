/* ==========================================================================
 * router.js — minimal hash-based router. Pages register a render function that
 * returns a DOM node; the router swaps it into the outlet and marks active nav.
 * ========================================================================== */
window.App = window.App || {}

App.router = (function () {
  const routes = {}
  let outlet = null
  let onChange = null

  const path = () => (location.hash || '#/').slice(1) || '/'

  function register(p, fn) {
    routes[p] = fn
  }
  function mount(el, changeCb) {
    outlet = el
    onChange = changeCb
    window.addEventListener('hashchange', render)
  }
  function navigate(p) {
    if (path() === p) render()
    else location.hash = '#' + p
  }
  function render() {
    if (!outlet) return
    const fn = routes[path()] || routes['/']
    App.util.clear(outlet)
    try {
      const node = fn ? fn() : document.createTextNode('')
      if (node) outlet.appendChild(node)
    } catch (err) {
      console.error(err)
      outlet.appendChild(App.util.el('p', { class: 'error-text', text: String(err.message || err) }))
    }
    outlet.scrollTop = 0
    if (onChange) onChange(path())
  }

  return { register, mount, navigate, render, path }
})()
