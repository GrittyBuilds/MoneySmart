/* ==========================================================================
 * store.js — central coordinator. Holds the active backend, caches the core
 * data (household, members, accounts, categories, transactions), and exposes
 * derived calculations. Pages read from here and call refresh() after changes.
 * ========================================================================== */
window.App = window.App || {}

App.store = (function () {
  let backend = null
  const data = {
    household: null,
    members: [],
    accounts: [],
    categories: [],
    transactions: [],
  }

  const listeners = new Set()
  const subscribe = (cb) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }
  const notify = () => listeners.forEach((cb) => cb())

  function setBackend(b) {
    backend = b
  }
  const getBackend = () => backend

  /** Reload the cached core data from the active backend. */
  async function refresh() {
    if (!backend) return
    const [household, members, accounts, categories, transactions] = await Promise.all([
      backend.getHousehold(),
      backend.listMembers(),
      backend.listAccounts(),
      backend.listCategories(),
      backend.listTransactions(),
    ])
    data.household = household
    data.members = members
    data.accounts = accounts
    data.categories = categories
    data.transactions = transactions
    notify()
  }

  /* ---- Derived calculations ---- */
  function accountBalance(account) {
    return data.transactions
      .filter((t) => t.account_id === account.id)
      .reduce((bal, t) => bal + (t.kind === 'income' ? t.amount : -t.amount), account.starting_balance)
  }
  function totalBalance() {
    return data.accounts.reduce((sum, a) => sum + accountBalance(a), 0)
  }
  function sumTotals(txns) {
    let income = 0
    let expense = 0
    for (const t of txns) {
      if (t.kind === 'income') income += t.amount
      else expense += t.amount
    }
    return { income, expense, net: income - expense }
  }
  function spendByCategory(txns) {
    const map = new Map()
    for (const t of txns) {
      if (t.kind !== 'expense') continue
      const key = t.category_id || 'uncategorized'
      map.set(key, (map.get(key) || 0) + t.amount)
    }
    return map
  }
  function txInMonth(date) {
    const { startOfMonth, endOfMonth, parseISO } = App.util
    const start = startOfMonth(date).getTime()
    const end = endOfMonth(date).getTime()
    return data.transactions.filter((t) => {
      const d = parseISO(t.occurred_on).getTime()
      return d >= start && d <= end
    })
  }

  const categoryMap = () => new Map(data.categories.map((c) => [c.id, c]))
  const accountMap = () => new Map(data.accounts.map((a) => [a.id, a]))
  const expenseCategories = () => data.categories.filter((c) => c.kind === 'expense')
  const incomeCategories = () => data.categories.filter((c) => c.kind === 'income')

  /* ---- Category hierarchy (parent → children) ---- */
  const childrenOf = (id) =>
    data.categories.filter((c) => c.parent_id === id).sort((a, b) => a.name.localeCompare(b.name))
  const topCategories = (kind) =>
    data.categories
      .filter((c) => c.kind === kind && !c.parent_id)
      .sort((a, b) => a.name.localeCompare(b.name))

  /** Flat list of {cat, depth} for a kind: each parent followed by its children. */
  function orderedCategories(kind) {
    const out = []
    for (const parent of topCategories(kind)) {
      out.push({ cat: parent, depth: 0 })
      for (const child of childrenOf(parent.id)) out.push({ cat: child, depth: 1 })
    }
    return out
  }

  /** The top-level ancestor of a category (itself if it has no parent). */
  function topLevelOf(cat) {
    if (!cat) return null
    if (!cat.parent_id) return cat
    return categoryMap().get(cat.parent_id) || cat
  }

  /** Expense spend rolled up to the top-level category → donut segments. */
  function rollupSpend(txns) {
    const byId = categoryMap()
    const map = new Map()
    for (const t of txns) {
      if (t.kind !== 'expense') continue
      const cat = t.category_id ? byId.get(t.category_id) : null
      const top = cat ? topLevelOf(cat) : null
      const key = top ? top.id : 'uncategorized'
      const entry = map.get(key) || {
        label: top ? top.name : 'Uncategorized',
        color: top ? top.color : '#64748b',
        value: 0,
      }
      entry.value += t.amount
      map.set(key, entry)
    }
    return [...map.values()]
  }

  return {
    data,
    setBackend,
    getBackend,
    refresh,
    subscribe,
    notify,
    // compute
    accountBalance,
    totalBalance,
    sumTotals,
    spendByCategory,
    txInMonth,
    categoryMap,
    accountMap,
    expenseCategories,
    incomeCategories,
    // hierarchy
    childrenOf,
    topCategories,
    orderedCategories,
    topLevelOf,
    rollupSpend,
  }
})()
