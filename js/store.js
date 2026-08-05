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
  }
})()
