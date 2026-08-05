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
      const { error } = await need()
        .from('categories')
        .insert({ ...input, icon: 'tag', household_id: currentHouseholdId })
      if (error) throw error
    },
    async deleteCategory(id) {
      const { error } = await need().from('categories').delete().eq('id', id)
      if (error) throw error
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
        category_id: input.category_id || null,
        kind: input.kind,
        amount: round2(input.amount),
        description: input.description || null,
        occurred_on: input.occurred_on,
      })
      if (error) throw error
    },
    async updateTransaction(id, patch) {
      const { error } = await need().from('transactions').update(patch).eq('id', id)
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

    /** Bulk-import a local data dump into the current cloud household. */
    async importLocalDump(dump) {
      const hid = currentHouseholdId
      if (!hid) throw new Error('No household selected')

      // Map local category ids -> new cloud ids by name+kind.
      const existingCats = await this.listCategories()
      const byName = new Map(existingCats.map((c) => [c.kind + '|' + c.name.toLowerCase(), c.id]))
      const catIdMap = {}
      for (const c of dump.categories || []) {
        const key = c.kind + '|' + c.name.toLowerCase()
        if (byName.has(key)) {
          catIdMap[c.id] = byName.get(key)
        } else {
          const { data, error } = await need()
            .from('categories')
            .insert({ household_id: hid, name: c.name, kind: c.kind, color: c.color, icon: 'tag' })
            .select()
            .single()
          if (error) throw error
          catIdMap[c.id] = data.id
          byName.set(key, data.id)
        }
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

      // Transactions.
      const txPayload = (dump.transactions || []).map((t) => ({
        household_id: hid,
        account_id: t.account_id ? acctIdMap[t.account_id] || null : null,
        category_id: t.category_id ? catIdMap[t.category_id] || null : null,
        kind: t.kind,
        amount: t.amount,
        description: t.description,
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
