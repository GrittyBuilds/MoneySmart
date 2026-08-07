/* ==========================================================================
 * backend-cloud.js — Supabase-backed backend for cross-device sync + family
 * sharing. The Supabase JS SDK is loaded lazily from a CDN so the app has zero
 * dependencies until you actually connect a project.
 *
 * Requires the SQL in supabase/schema.sql to have been run in your project.
 * ========================================================================== */
window.App = window.App || {}

App.CloudBackend = (function () {
  const { round2, monthKey } = App.util
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
  const HKEY = 'moneysmart.cloud.household'

  let client = null
  let currentHouseholdId = localStorage.getItem(HKEY) || null
  let sdkPromise = null

  function loadSDK() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve()
    if (sdkPromise) return sdkPromise
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SDK_URL
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Could not load the Supabase library (are you online?)'))
      document.head.appendChild(s)
    })
    return sdkPromise
  }

  function need() {
    if (!client) throw new Error('Cloud backend is not connected')
    return client
  }

  async function rows(promise) {
    const { data, error } = await promise
    if (error) throw error
    return data || []
  }

  function normalizeSplits(splits) {
    if (!Array.isArray(splits)) return []
    return splits
      .map((s) => ({ category_id: s.category_id || null, amount: Math.round((Number(s.amount) || 0) * 100) / 100 }))
      .filter((s) => s.amount > 0)
  }

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
      tag_ids: Array.isArray(t.tag_ids) ? t.tag_ids : [],
      splits: normalizeSplits(t.splits),
    }
  }

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
    id: 'cloud',
    isCloud: true,

    /** Connect the client using the saved Supabase URL + anon key. */
    async init() {
      const { supabaseUrl, supabaseKey } = App.config.all()
      if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase URL or key')
      await loadSDK()
      client = window.supabase.createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    },

    /* ---- Auth ---- */
    async getSession() {
      const { data } = await need().auth.getSession()
      return data.session
    },
    async getUser() {
      const { data } = await need().auth.getUser()
      return data.user
    },
    onAuth(cb) {
      const { data } = need().auth.onAuthStateChange((_e, session) => cb(session))
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await need().auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email, password) {
      const { data, error } = await need().auth.signUp({ email, password })
      if (error) throw error
      return { needsConfirmation: !data.session }
    },
    async signOut() {
      await need().auth.signOut()
      currentHouseholdId = null
      localStorage.removeItem(HKEY)
    },

    /* ---- Households ---- */
    async listHouseholds() {
      const user = await this.getUser()
      if (!user) return []
      const data = await rows(
        need().from('household_members').select('households(*)').eq('user_id', user.id),
      )
      return data.map((r) => r.households).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
    },
    getCurrentHouseholdId() {
      return currentHouseholdId
    },
    setCurrentHousehold(id) {
      currentHouseholdId = id
      if (id) localStorage.setItem(HKEY, id)
      else localStorage.removeItem(HKEY)
    },
    async createHousehold(name, memberName) {
      const { data, error } = await need().rpc('create_household', {
        household_name: name,
        member_name: memberName,
      })
      if (error) throw error
      this.setCurrentHousehold(data)
      return data
    },
    async joinHousehold(code, memberName) {
      const { data, error } = await need().rpc('join_household', {
        code,
        member_name: memberName,
      })
      if (error) throw error
      this.setCurrentHousehold(data)
      return data
    },
    async getHousehold() {
      if (!currentHouseholdId) return null
      const { data, error } = await need()
        .from('households')
        .select('*')
        .eq('id', currentHouseholdId)
        .single()
      if (error) throw error
      return data
    },
    async renameHousehold(name) {
      const { data, error } = await need()
        .from('households')
        .update({ name })
        .eq('id', currentHouseholdId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    async listMembers() {
      if (!currentHouseholdId) return []
      return rows(
        need()
          .from('household_members')
          .select('*')
          .eq('household_id', currentHouseholdId)
          .order('joined_at', { ascending: true }),
      )
    },

    /* ---- Accounts ---- */
    async listAccounts() {
      return rows(
        need()
          .from('accounts')
          .select('*')
          .eq('household_id', currentHouseholdId)
          .order('created_at', { ascending: true }),
      )
    },
    async addAccount(input) {
      const { error } = await need()
        .from('accounts')
        .insert({ ...input, starting_balance: round2(input.starting_balance), household_id: currentHouseholdId })
      if (error) throw error
    },
    async updateAccount(id, patch) {
      const { error } = await need().from('accounts').update(patch).eq('id', id)
      if (error) throw error
    },
    async deleteAccount(id) {
      const { error } = await need().from('accounts').delete().eq('id', id)
      if (error) throw error
    },

    /* ---- Categories ---- */
    async listCategories() {
      return rows(
        need()
          .from('categories')
          .select('*')
          .eq('household_id', currentHouseholdId)
          .order('kind', { ascending: true })
          .order('name', { ascending: true }),
      )
    },
    async addCategory(input) {
      const { error } = await need().from('categories').insert({
        name: input.name,
        kind: input.kind,
        color: input.color,
        parent_id: input.parent_id || null,
        icon: 'tag',
        household_id: currentHouseholdId,
      })
      if (error) throw error
    },
    async deleteCategory(id) {
      const { error } = await need().from('categories').delete().eq('id', id)
      if (error) throw error
    },

    /* ---- Tags ---- */
    async listTags() {
      return rows(
        need()
          .from('tags')
          .select('*')
          .eq('household_id', currentHouseholdId)
          .order('name', { ascending: true }),
      )
    },
    async addTag(input) {
      const { error } = await need()
        .from('tags')
        .insert({ name: input.name, color: input.color || '#64748b', household_id: currentHouseholdId })
      if (error) throw error
    },
    async updateTag(id, patch) {
      const { error } = await need().from('tags').update(patch).eq('id', id)
      if (error) throw error
    },
    async deleteTag(id) {
      const { error } = await need().from('tags').delete().eq('id', id)
      if (error) throw error
      // Best-effort: drop the tag id from any transactions that reference it.
      const tagged = await rows(
        need().from('transactions').select('id, tag_ids').eq('household_id', currentHouseholdId).contains('tag_ids', [id]),
      )
      for (const t of tagged) {
        const next = (t.tag_ids || []).filter((x) => x !== id)
        await need().from('transactions').update({ tag_ids: next }).eq('id', t.id)
      }
    },

    /* ---- Transactions ---- */
    async listTransactions() {
      return rows(
        need()
          .from('transactions')
          .select('*')
          .eq('household_id', currentHouseholdId)
          .order('occurred_on', { ascending: false })
          .order('created_at', { ascending: false }),
      )
    },
    async addTransaction(input) {
      const { error } = await need().from('transactions').insert({
        household_id: currentHouseholdId,
        account_id: input.account_id || null,
        transfer_account_id: input.transfer_account_id || null,
        category_id: input.kind === 'transfer' ? null : input.category_id || null,
        kind: input.kind,
        amount: round2(input.amount),
        description: input.description || null,
        vendor: input.vendor || null,
        tag_ids: Array.isArray(input.tag_ids) ? input.tag_ids : [],
        splits: input.kind === 'transfer' ? [] : normalizeSplits(input.splits),
        occurred_on: input.occurred_on,
      })
      if (error) throw error
    },
    async updateTransaction(id, patch) {
      const next = { ...patch }
      if ('splits' in next) next.splits = normalizeSplits(next.splits)
      if ('amount' in next) next.amount = round2(next.amount)
      const { error } = await need().from('transactions').update(next).eq('id', id)
      if (error) throw error
    },
    async deleteTransaction(id) {
      const { error } = await need().from('transactions').delete().eq('id', id)
      if (error) throw error
    },

    /* ---- Budgets ---- */
    async listBudgets(month) {
      const key = month || monthKey(new Date())
      return rows(
        need()
          .from('budgets')
          .select('*')
          .eq('household_id', currentHouseholdId)
          .eq('month', key),
      )
    },
    async setBudget(categoryId, amount, month) {
      const key = month || monthKey(new Date())
      const value = round2(amount)
      const existing = await rows(
        need()
          .from('budgets')
          .select('*')
          .eq('household_id', currentHouseholdId)
          .eq('category_id', categoryId)
          .eq('month', key),
      )
      if (value <= 0) {
        if (existing[0]) {
          const { error } = await need().from('budgets').delete().eq('id', existing[0].id)
          if (error) throw error
        }
        return
      }
      if (existing[0]) {
        const { error } = await need().from('budgets').update({ amount: value }).eq('id', existing[0].id)
        if (error) throw error
      } else {
        const { error } = await need().from('budgets').insert({
          household_id: currentHouseholdId,
          category_id: categoryId,
          amount: value,
          month: key,
        })
        if (error) throw error
      }
    },

    /* ---- Recurring transactions ---- */
    async listRecurring() {
      return rows(
        need()
          .from('recurring')
          .select('*')
          .eq('household_id', currentHouseholdId)
          .order('next_on', { ascending: true }),
      )
    },
    async addRecurring(input) {
      const { error } = await need().from('recurring').insert({
        household_id: currentHouseholdId,
        template: sanitizeTemplate(input.template),
        frequency: input.frequency || 'monthly',
        next_on: input.next_on,
        end_on: input.end_on || null,
        active: input.active !== false,
      })
      if (error) throw error
    },
    async updateRecurring(id, patch) {
      const next = { ...patch }
      if (next.template) next.template = sanitizeTemplate(next.template)
      const { error } = await need().from('recurring').update(next).eq('id', id)
      if (error) throw error
    },
    async deleteRecurring(id) {
      const { error } = await need().from('recurring').delete().eq('id', id)
      if (error) throw error
    },
    /** Materialize any recurring rules that have come due (up to today). */
    async runDueRecurring() {
      if (!currentHouseholdId) return 0
      const today = App.util.todayISO()
      const list = await rows(
        need().from('recurring').select('*').eq('household_id', currentHouseholdId).eq('active', true).lte('next_on', today),
      )
      let created = 0
      for (const r of list) {
        const toInsert = []
        let next = r.next_on
        let guard = 0
        while (next && next <= today && (!r.end_on || next <= r.end_on) && guard < 500) {
          const tpl = r.template || {}
          toInsert.push({
            household_id: currentHouseholdId,
            account_id: tpl.account_id || null,
            transfer_account_id: tpl.transfer_account_id || null,
            category_id: tpl.kind === 'transfer' ? null : tpl.category_id || null,
            kind: tpl.kind,
            amount: round2(tpl.amount),
            description: tpl.description || null,
            vendor: tpl.vendor || null,
            tag_ids: Array.isArray(tpl.tag_ids) ? tpl.tag_ids : [],
            splits: tpl.kind === 'transfer' ? [] : normalizeSplits(tpl.splits),
            occurred_on: next,
            recurring_id: r.id,
          })
          next = advanceDate(next, r.frequency)
          guard++
        }
        if (toInsert.length) {
          const { error } = await need().from('transactions').insert(toInsert)
          if (error) throw error
          created += toInsert.length
          const patch = { next_on: next }
          if (r.end_on && next > r.end_on) patch.active = false
          await need().from('recurring').update(patch).eq('id', r.id)
        }
      }
      return created
    },

    async exportAll() {
      const [household, categories, tags, accounts, transactions, budgets, recurring] = await Promise.all([
        this.getHousehold(),
        this.listCategories(),
        this.listTags(),
        this.listAccounts(),
        this.listTransactions(),
        rows(need().from('budgets').select('*').eq('household_id', currentHouseholdId)),
        this.listRecurring().catch(() => []),
      ])
      return {
        app: 'moneysmart',
        version: 1,
        exportedAt: new Date().toISOString(),
        household,
        categories,
        tags,
        accounts,
        transactions,
        budgets,
        recurring,
      }
    },

    // Back-compat alias for the old name.
    async importLocalDump(dump) {
      return this.importDump(dump)
    },

    /** Bulk-import a data dump / backup into the current cloud household. */
    async importDump(dump) {
      const hid = currentHouseholdId
      if (!hid) throw new Error('No household selected')
      if (!dump || !Array.isArray(dump.categories)) {
        throw new Error('This file is not a valid MoneySmart backup.')
      }

      // Top-level categories are de-duplicated against existing ones by
      // name+kind; subcategories are always inserted and linked to their
      // (already-inserted) parent's new id.
      const existingCats = await this.listCategories()
      const byName = new Map(
        existingCats.filter((c) => !c.parent_id).map((c) => [c.kind + '|' + c.name.toLowerCase(), c.id]),
      )
      const catIdMap = {}
      const src = dump.categories || []
      const ordered = [...src.filter((c) => !c.parent_id), ...src.filter((c) => c.parent_id)]
      for (const c of ordered) {
        if (!c.parent_id) {
          const key = c.kind + '|' + c.name.toLowerCase()
          if (byName.has(key)) {
            catIdMap[c.id] = byName.get(key)
            continue
          }
          const { data, error } = await need()
            .from('categories')
            .insert({ household_id: hid, name: c.name, kind: c.kind, color: c.color, icon: 'tag', parent_id: null })
            .select()
            .single()
          if (error) throw error
          catIdMap[c.id] = data.id
          byName.set(key, data.id)
        } else {
          const { data, error } = await need()
            .from('categories')
            .insert({ household_id: hid, name: c.name, kind: c.kind, color: c.color, icon: 'tag', parent_id: catIdMap[c.parent_id] || null })
            .select()
            .single()
          if (error) throw error
          catIdMap[c.id] = data.id
        }
      }

      // Tags — de-duplicate by name against existing tags.
      const existingTags = await this.listTags()
      const tagByName = new Map(existingTags.map((t) => [t.name.toLowerCase(), t.id]))
      const tagIdMap = {}
      for (const tg of dump.tags || []) {
        const key = (tg.name || '').toLowerCase()
        if (tagByName.has(key)) {
          tagIdMap[tg.id] = tagByName.get(key)
          continue
        }
        const { data, error } = await need()
          .from('tags')
          .insert({ household_id: hid, name: tg.name, color: tg.color || '#64748b' })
          .select()
          .single()
        if (error) throw error
        tagIdMap[tg.id] = data.id
        tagByName.set(key, data.id)
      }

      // Accounts.
      const acctIdMap = {}
      for (const a of dump.accounts || []) {
        const { data, error } = await need()
          .from('accounts')
          .insert({ household_id: hid, name: a.name, type: a.type, starting_balance: a.starting_balance })
          .select()
          .single()
        if (error) throw error
        acctIdMap[a.id] = data.id
      }

      // Transactions — remap category, account, tag ids, and split categories.
      const txPayload = (dump.transactions || []).map((t) => ({
        household_id: hid,
        account_id: t.account_id ? acctIdMap[t.account_id] || null : null,
        transfer_account_id: t.transfer_account_id ? acctIdMap[t.transfer_account_id] || null : null,
        category_id: t.category_id ? catIdMap[t.category_id] || null : null,
        kind: t.kind,
        amount: t.amount,
        description: t.description,
        vendor: t.vendor || null,
        tag_ids: (t.tag_ids || []).map((id) => tagIdMap[id]).filter(Boolean),
        splits: normalizeSplits(t.splits).map((s) => ({
          category_id: s.category_id ? catIdMap[s.category_id] || null : null,
          amount: s.amount,
        })),
        occurred_on: t.occurred_on,
      }))
      if (txPayload.length) {
        const { error } = await need().from('transactions').insert(txPayload)
        if (error) throw error
      }

      // Budgets.
      const budgetPayload = (dump.budgets || [])
        .filter((b) => catIdMap[b.category_id])
        .map((b) => ({
          household_id: hid,
          category_id: catIdMap[b.category_id],
          amount: b.amount,
          month: b.month,
        }))
      if (budgetPayload.length) {
        const { error } = await need().from('budgets').insert(budgetPayload)
        if (error) throw error
      }
    },
  }
})()
