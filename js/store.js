/* ==========================================================================
 * store.js — central coordinator. Holds the active backend, caches the core
 * data (household, members, accounts, categories, transactions), and exposes
 * derived calculations. Pages read from here and call refresh() after changes.
 * ========================================================================== */
window.App = window.App || {}

App.store = (function () {
  const { round2 } = App.util
  let backend = null
  const data = {
    household: null,
    members: [],
    accounts: [],
    categories: [],
    tags: [],
    transactions: [],
    recurring: [],
  }

  // Account types that are debts: their balance is money owed, and they count
  // negatively toward net worth.
  const LIABILITY_TYPES = new Set(['credit', 'loan'])
  const isLiability = (a) => Boolean(a && LIABILITY_TYPES.has(a.type))

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
    // Materialize any recurring transactions that have come due first, so the
    // freshly loaded lists already include them.
    if (backend.runDueRecurring) {
      try {
        await backend.runDueRecurring()
      } catch (e) {
        console.error('Recurring run failed', e)
      }
    }
    const [household, members, accounts, categories, tags, transactions, recurring] = await Promise.all([
      backend.getHousehold(),
      backend.listMembers(),
      backend.listAccounts(),
      backend.listCategories(),
      backend.listTags ? backend.listTags() : Promise.resolve([]),
      backend.listTransactions(),
      backend.listRecurring ? backend.listRecurring() : Promise.resolve([]),
    ])
    data.household = household
    data.members = members
    data.accounts = accounts
    data.categories = categories
    data.tags = tags
    data.transactions = transactions
    data.recurring = recurring
    notify()
  }

  /* ---- Derived calculations ---- */
  /**
   * Signed effect of a transaction on a given account's ledger.
   * - income increases the account, expense decreases it
   * - a transfer decreases the source account and increases the destination
   * The ledger is asset-positive: a liability (credit card / loan) carries a
   * negative ledger balance, so spending on it makes the balance more negative
   * (i.e. the amount owed goes up) and it subtracts from net worth.
   */
  function txDelta(t, accountId) {
    if (t.kind === 'transfer') {
      let d = 0
      if (t.account_id === accountId) d -= t.amount
      if (t.transfer_account_id === accountId) d += t.amount
      return d
    }
    if (t.account_id !== accountId) return 0
    return t.kind === 'income' ? t.amount : -t.amount
  }

  /** The signed ledger balance of an account (negative = you owe money). */
  function accountBalance(account) {
    const start = Number(account.starting_balance) || 0
    return round2(data.transactions.reduce((bal, t) => bal + txDelta(t, account.id), start))
  }

  /** For a liability, the (positive) amount currently owed. 0 for assets. */
  function accountOwed(account) {
    return isLiability(account) ? round2(-accountBalance(account)) : 0
  }

  /** Sum of every account's signed ledger balance — the household net worth. */
  function totalBalance() {
    return round2(data.accounts.reduce((sum, a) => sum + accountBalance(a), 0))
  }

  /** Transactions that touch an account (as source, destination, or owner). */
  function transactionsForAccount(id) {
    return data.transactions.filter((t) => t.account_id === id || t.transfer_account_id === id)
  }

  function sumTotals(txns) {
    let income = 0
    let expense = 0
    for (const t of txns) {
      if (t.kind === 'income') income += t.amount
      else if (t.kind === 'expense') expense += t.amount
      // transfers move money between accounts and are neither income nor expense
    }
    return { income, expense, net: income - expense }
  }
  /**
   * How a transaction's amount is allocated across categories. A split
   * transaction returns its split rows; otherwise a single row from
   * category_id / amount.
   */
  function allocations(t) {
    if (Array.isArray(t.splits) && t.splits.length) {
      return t.splits.map((s) => ({ category_id: s.category_id || null, amount: Number(s.amount) || 0 }))
    }
    return [{ category_id: t.category_id || null, amount: Number(t.amount) || 0 }]
  }

  function isSplit(t) {
    return Array.isArray(t.splits) && t.splits.length > 1
  }

  function spendByCategory(txns) {
    const map = new Map()
    for (const t of txns) {
      if (t.kind !== 'expense') continue
      for (const a of allocations(t)) {
        const key = a.category_id || 'uncategorized'
        map.set(key, (map.get(key) || 0) + a.amount)
      }
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
      for (const a of allocations(t)) {
        const cat = a.category_id ? byId.get(a.category_id) : null
        const top = cat ? topLevelOf(cat) : null
        const key = top ? top.id : 'uncategorized'
        const entry = map.get(key) || {
          label: top ? top.name : 'Uncategorized',
          color: top ? top.color : '#64748b',
          value: 0,
        }
        entry.value += a.amount
        map.set(key, entry)
      }
    }
    return [...map.values()]
  }

  const tagMap = () => new Map(data.tags.map((t) => [t.id, t]))

  /** Distinct vendor names seen in transactions (for autocomplete/reporting). */
  function vendors() {
    const set = new Set()
    for (const t of data.transactions) {
      if (t.vendor && t.vendor.trim()) set.add(t.vendor.trim())
    }
    return [...set].sort((a, b) => a.localeCompare(b))
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
    accountOwed,
    isLiability,
    transactionsForAccount,
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
    // splits / tags / vendors
    allocations,
    isSplit,
    tagMap,
    vendors,
  }
})()
