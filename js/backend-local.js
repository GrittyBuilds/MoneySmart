/* ==========================================================================
 * backend-local.js — offline backend backed by localStorage.
 * Implements the same async interface as the cloud backend so the rest of the
 * app doesn't care which one is active. A single implicit household is used.
 * ========================================================================== */
window.App = window.App || {}

App.LocalBackend = (function () {
  const { uid, inviteCode, round2, monthKey } = App.util
  const KEY = 'moneysmart.data'

  // Sample category tree: a handful of well-organised top-level ("top shelf")
  // categories, each with a few starter subcategories.
  const DEFAULT_CATEGORY_TREE = [
    { name: 'Housing', kind: 'expense', color: '#3b82f6', children: ['Rent/Mortgage', 'Utilities', 'Internet & Phone', 'Maintenance'] },
    { name: 'Food', kind: 'expense', color: '#22c55e', children: ['Groceries', 'Dining Out', 'Coffee & Snacks'] },
    { name: 'Transportation', kind: 'expense', color: '#8b5cf6', children: ['Gas & Fuel', 'Car Payment', 'Public Transit', 'Parking'] },
    { name: 'Health', kind: 'expense', color: '#14b8a6', children: ['Medical', 'Pharmacy', 'Fitness'] },
    { name: 'Shopping', kind: 'expense', color: '#f59e0b', children: ['Household', 'Clothing', 'Gifts'] },
    { name: 'Entertainment', kind: 'expense', color: '#ec4899', children: ['Streaming', 'Events', 'Hobbies'] },
    { name: 'Kids', kind: 'expense', color: '#f97316', children: ['Childcare', 'School', 'Activities'] },
    { name: 'Personal Care', kind: 'expense', color: '#6366f1', children: ['Subscriptions', 'Grooming', 'Pets'] },
    { name: 'Savings & Debt', kind: 'expense', color: '#06b6d4', children: ['Emergency Fund', 'Investments', 'Debt Payment'] },
    { name: 'Income', kind: 'income', color: '#159C6A', children: ['Salary', 'Bonus', 'Interest'] },
    { name: 'Other Income', kind: 'income', color: '#84cc16', children: [] },
  ]

  function seedCategories(hid) {
    const rows = []
    for (const parent of DEFAULT_CATEGORY_TREE) {
      const pid = uid()
      rows.push({ id: pid, household_id: hid, name: parent.name, kind: parent.kind, color: parent.color, parent_id: null })
      for (const childName of parent.children || []) {
        rows.push({ id: uid(), household_id: hid, name: childName, kind: parent.kind, color: parent.color, parent_id: pid })
      }
    }
    return rows
  }

  function seed() {
    const hid = uid()
    return {
      household: { id: hid, name: 'My Household', invite_code: inviteCode() },
      members: [{ id: uid(), user_id: 'local', display_name: 'Me', role: 'owner' }],
      accounts: [],
      categories: seedCategories(hid),
      tags: [],
      transactions: [],
      budgets: [],
      recurring: [],
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
    // Backfill collections added in later versions.
    if (!data.tags) data.tags = []
    if (!data.recurring) data.recurring = []
    return data
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data))
    return data
  }

  const ok = (v) => Promise.resolve(v)

  // Keep only valid split rows: a category (or null) and a positive amount.
  function normalizeSplits(splits) {
    if (!Array.isArray(splits)) return []
    return splits
      .map((s) => ({ category_id: s.category_id || null, amount: round2(s.amount) }))
      .filter((s) => s.amount > 0)
  }

  // Strip a recurring rule's template down to the fields used to spawn a tx.
  function sanitizeTemplate(t) {
    t = t || {}
    return {
      kind: t.kind || 'expense',
      amount: round2(t.amount),
      account_id: t.account_id || null,
      transfer_account_id: t.transfer_account_id || null,
      category_id: t.category_id || null,
      description: t.description || null,
      vendor: t.vendor || null,
      tag_ids: Array.isArray(t.tag_ids) ? t.tag_ids.slice() : [],
      splits: normalizeSplits(t.splits),
    }
  }

  // Advance a YYYY-MM-DD date by one step of the given frequency.
  function advanceDate(iso, frequency) {
    const d = App.util.parseISO(iso)
    switch (frequency) {
      case 'weekly': d.setDate(d.getDate() + 7); break
      case 'biweekly': d.setDate(d.getDate() + 14); break
      case 'yearly': d.setFullYear(d.getFullYear() + 1); break
      case 'monthly':
      default: d.setMonth(d.getMonth() + 1); break
    }
    return App.util.toISO(d)
  }

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
        if (t.transfer_account_id === id) t.transfer_account_id = null
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
        if (Array.isArray(t.splits)) {
          t.splits.forEach((s) => {
            if (ids.has(s.category_id)) s.category_id = null
          })
        }
      })
      d.budgets = d.budgets.filter((b) => !ids.has(b.category_id))
      save(d)
      return ok()
    },

    /* ---- Tags ---- */
    async listTags() {
      return ok(load().tags.slice().sort((a, b) => a.name.localeCompare(b.name)))
    },
    async addTag({ name, color }) {
      const d = load()
      const row = { id: uid(), household_id: d.household.id, name, color: color || '#64748b' }
      d.tags.push(row)
      save(d)
      return ok(row)
    },
    async updateTag(id, patch) {
      const d = load()
      const t = d.tags.find((x) => x.id === id)
      if (t) Object.assign(t, patch)
      save(d)
      return ok(t)
    },
    async deleteTag(id) {
      const d = load()
      d.tags = d.tags.filter((x) => x.id !== id)
      d.transactions.forEach((t) => {
        if (Array.isArray(t.tag_ids)) t.tag_ids = t.tag_ids.filter((x) => x !== id)
      })
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
        transfer_account_id: input.transfer_account_id || null,
        category_id: input.kind === 'transfer' ? null : input.category_id || null,
        kind: input.kind,
        amount: round2(input.amount),
        description: input.description || null,
        vendor: input.vendor || null,
        tag_ids: Array.isArray(input.tag_ids) ? input.tag_ids.slice() : [],
        splits: input.kind === 'transfer' ? [] : normalizeSplits(input.splits),
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
        if ('splits' in patch) t.splits = normalizeSplits(patch.splits)
        if ('tag_ids' in patch) t.tag_ids = Array.isArray(patch.tag_ids) ? patch.tag_ids.slice() : []
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

    /* ---- Recurring transactions ---- */
    async listRecurring() {
      return ok(load().recurring.slice())
    },
    async addRecurring(input) {
      const d = load()
      const row = {
        id: uid(),
        household_id: d.household.id,
        template: sanitizeTemplate(input.template),
        frequency: input.frequency || 'monthly',
        next_on: input.next_on,
        end_on: input.end_on || null,
        active: input.active !== false,
        created_at: new Date().toISOString(),
      }
      d.recurring.push(row)
      save(d)
      return ok(row)
    },
    async updateRecurring(id, patch) {
      const d = load()
      const r = d.recurring.find((x) => x.id === id)
      if (r) {
        Object.assign(r, patch)
        if (patch.template) r.template = sanitizeTemplate(patch.template)
      }
      save(d)
      return ok(r)
    },
    async deleteRecurring(id) {
      const d = load()
      d.recurring = d.recurring.filter((x) => x.id !== id)
      save(d)
      return ok()
    },
    /** Create any transactions whose recurring rules have come due (up to today). */
    async runDueRecurring() {
      const d = load()
      const today = App.util.todayISO()
      let created = 0
      for (const r of d.recurring) {
        if (!r.active || !r.next_on) continue
        let guard = 0
        while (r.next_on <= today && (!r.end_on || r.next_on <= r.end_on) && guard < 500) {
          const tpl = r.template || {}
          d.transactions.push({
            id: uid(),
            household_id: d.household.id,
            account_id: tpl.account_id || null,
            transfer_account_id: tpl.transfer_account_id || null,
            category_id: tpl.kind === 'transfer' ? null : tpl.category_id || null,
            kind: tpl.kind,
            amount: round2(tpl.amount),
            description: tpl.description || null,
            vendor: tpl.vendor || null,
            tag_ids: Array.isArray(tpl.tag_ids) ? tpl.tag_ids.slice() : [],
            splits: tpl.kind === 'transfer' ? [] : normalizeSplits(tpl.splits),
            occurred_on: r.next_on,
            recurring_id: r.id,
            created_by: 'local',
            created_at: new Date().toISOString(),
          })
          created++
          r.next_on = advanceDate(r.next_on, r.frequency)
          guard++
        }
        if (r.end_on && r.next_on > r.end_on) r.active = false
      }
      if (created) save(d)
      return ok(created)
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
        tags: d.tags,
        accounts: d.accounts,
        transactions: d.transactions,
        budgets: d.budgets,
        recurring: d.recurring,
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
        tags: backup.tags || [],
        accounts: backup.accounts || [],
        transactions: backup.transactions || [],
        budgets: backup.budgets || [],
        recurring: backup.recurring || [],
      }
      // Keep every row pointed at this household for internal consistency.
      next.categories.forEach((c) => (c.household_id = hid))
      next.tags.forEach((t) => (t.household_id = hid))
      next.accounts.forEach((a) => (a.household_id = hid))
      next.transactions.forEach((t) => (t.household_id = hid))
      next.budgets.forEach((b) => (b.household_id = hid))
      next.recurring.forEach((r) => (r.household_id = hid))
      save(next)
      return ok()
    },
  }
})()
