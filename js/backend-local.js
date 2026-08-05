/* ==========================================================================
 * backend-local.js — offline backend backed by localStorage.
 * Implements the same async interface as the cloud backend so the rest of the
 * app doesn't care which one is active. A single implicit household is used.
 * ========================================================================== */
window.App = window.App || {}

App.LocalBackend = (function () {
  const { uid, inviteCode, round2, monthKey } = App.util
  const KEY = 'moneysmart.data'

  const DEFAULT_CATEGORIES = [
    { name: 'Groceries', kind: 'expense', color: '#22c55e' },
    { name: 'Rent/Mortgage', kind: 'expense', color: '#3b82f6' },
    { name: 'Utilities', kind: 'expense', color: '#f59e0b' },
    { name: 'Transport', kind: 'expense', color: '#8b5cf6' },
    { name: 'Dining Out', kind: 'expense', color: '#ef4444' },
    { name: 'Entertainment', kind: 'expense', color: '#ec4899' },
    { name: 'Health', kind: 'expense', color: '#14b8a6' },
    { name: 'Kids', kind: 'expense', color: '#f97316' },
    { name: 'Savings', kind: 'expense', color: '#06b6d4' },
    { name: 'Salary', kind: 'income', color: '#10b981' },
    { name: 'Other Income', kind: 'income', color: '#84cc16' },
  ]

  function seed() {
    const hid = uid()
    return {
      household: { id: hid, name: 'My Household', invite_code: inviteCode() },
      members: [{ id: uid(), user_id: 'local', display_name: 'Me', role: 'owner' }],
      accounts: [],
      categories: DEFAULT_CATEGORIES.map((c) => ({
        id: uid(),
        household_id: hid,
        name: c.name,
        kind: c.kind,
        color: c.color,
      })),
      transactions: [],
      budgets: [],
    }
  }

  function load() {
    let data
    try {
      data = JSON.parse(localStorage.getItem(KEY) || 'null')
    } catch {
      data = null
    }
    if (!data || !data.household) {
      data = seed()
      save(data)
    }
    return data
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data))
    return data
  }

  const ok = (v) => Promise.resolve(v)

  return {
    id: 'local',
    isCloud: false,

    async init() {
      load()
      return ok()
    },

    async getHousehold() {
      return ok(load().household)
    },

    async renameHousehold(name) {
      const d = load()
      d.household.name = name
      save(d)
      return ok(d.household)
    },

    async listMembers() {
      return ok(load().members)
    },

    /* ---- Accounts ---- */
    async listAccounts() {
      return ok(load().accounts.slice())
    },
    async addAccount({ name, type, starting_balance }) {
      const d = load()
      const row = {
        id: uid(),
        household_id: d.household.id,
        name,
        type,
        starting_balance: round2(starting_balance),
        created_at: new Date().toISOString(),
      }
      d.accounts.push(row)
      save(d)
      return ok(row)
    },
    async updateAccount(id, patch) {
      const d = load()
      const a = d.accounts.find((x) => x.id === id)
      if (a) Object.assign(a, patch, { starting_balance: round2(patch.starting_balance ?? a.starting_balance) })
      save(d)
      return ok(a)
    },
    async deleteAccount(id) {
      const d = load()
      d.accounts = d.accounts.filter((x) => x.id !== id)
      // Keep transactions but unlink them (mirrors ON DELETE SET NULL).
      d.transactions.forEach((t) => {
        if (t.account_id === id) t.account_id = null
      })
      save(d)
      return ok()
    },

    /* ---- Categories ---- */
    async listCategories() {
      return ok(load().categories.slice())
    },
    async addCategory({ name, kind, color, parent_id }) {
      const d = load()
      const row = { id: uid(), household_id: d.household.id, name, kind, color, parent_id: parent_id || null }
      d.categories.push(row)
      save(d)
      return ok(row)
    },
    async deleteCategory(id) {
      const d = load()
      // Deleting a parent also removes its subcategories (cascade).
      const ids = new Set([id])
      d.categories.forEach((c) => {
        if (c.parent_id === id) ids.add(c.id)
      })
      d.categories = d.categories.filter((x) => !ids.has(x.id))
      d.transactions.forEach((t) => {
        if (ids.has(t.category_id)) t.category_id = null
      })
      d.budgets = d.budgets.filter((b) => !ids.has(b.category_id))
      save(d)
      return ok()
    },

    /* ---- Transactions ---- */
    async listTransactions() {
      // Newest first, matching the cloud ordering.
      return ok(
        load().transactions.slice().sort((a, b) => {
          if (a.occurred_on !== b.occurred_on)
            return a.occurred_on < b.occurred_on ? 1 : -1
          return (a.created_at || '') < (b.created_at || '') ? 1 : -1
        }),
      )
    },
    async addTransaction(input) {
      const d = load()
      const row = {
        id: uid(),
        household_id: d.household.id,
        account_id: input.account_id || null,
        category_id: input.category_id || null,
        kind: input.kind,
        amount: round2(input.amount),
        description: input.description || null,
        occurred_on: input.occurred_on,
        created_by: 'local',
        created_at: new Date().toISOString(),
      }
      d.transactions.push(row)
      save(d)
      return ok(row)
    },
    async updateTransaction(id, patch) {
      const d = load()
      const t = d.transactions.find((x) => x.id === id)
      if (t) {
        Object.assign(t, patch)
        if (patch.amount != null) t.amount = round2(patch.amount)
      }
      save(d)
      return ok(t)
    },
    async deleteTransaction(id) {
      const d = load()
      d.transactions = d.transactions.filter((x) => x.id !== id)
      save(d)
      return ok()
    },

    /* ---- Budgets ---- */
    async listBudgets(month) {
      const key = month || monthKey(new Date())
      return ok(load().budgets.filter((b) => b.month === key))
    },
    async setBudget(categoryId, amount, month) {
      const d = load()
      const key = month || monthKey(new Date())
      const existing = d.budgets.find(
        (b) => b.category_id === categoryId && b.month === key,
      )
      const value = round2(amount)
      if (value <= 0) {
        d.budgets = d.budgets.filter((b) => !(b.category_id === categoryId && b.month === key))
      } else if (existing) {
        existing.amount = value
      } else {
        d.budgets.push({
          id: uid(),
          household_id: d.household.id,
          category_id: categoryId,
          amount: value,
          month: key,
        })
      }
      save(d)
      return ok()
    },

    /* Export the raw store — used to migrate local data into the cloud. */
    _dump() {
      return load()
    },

    /* ---- Backup / restore ---- */
    async exportAll() {
      const d = load()
      return {
        app: 'moneysmart',
        version: 1,
        exportedAt: new Date().toISOString(),
        household: d.household,
        categories: d.categories,
        accounts: d.accounts,
        transactions: d.transactions,
        budgets: d.budgets,
      }
    },

    /** Replace all local data with a previously exported backup. */
    async importAll(backup) {
      if (!backup || !Array.isArray(backup.categories) || !Array.isArray(backup.transactions)) {
        throw new Error('This file is not a valid MoneySmart backup.')
      }
      const cur = load()
      const household =
        backup.household && backup.household.id ? backup.household : cur.household
      const hid = household.id
      const next = {
        household,
        members: cur.members,
        categories: backup.categories || [],
        accounts: backup.accounts || [],
        transactions: backup.transactions || [],
        budgets: backup.budgets || [],
      }
      // Keep every row pointed at this household for internal consistency.
      next.categories.forEach((c) => (c.household_id = hid))
      next.accounts.forEach((a) => (a.household_id = hid))
      next.transactions.forEach((t) => (t.household_id = hid))
      next.budgets.forEach((b) => (b.household_id = hid))
      save(next)
      return ok()
    },
  }
})()
