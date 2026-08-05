import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Transaction } from '../lib/types'

export interface TxFilters {
  /** Inclusive start date (YYYY-MM-DD). */
  from?: string
  /** Inclusive end date (YYYY-MM-DD). */
  to?: string
  /** Cap the number of rows returned. */
  limit?: number
}

export type NewTransaction = Pick<
  Transaction,
  'account_id' | 'category_id' | 'kind' | 'amount' | 'description' | 'occurred_on'
>

export function useTransactions(householdId: string | null, filters: TxFilters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const { from, to, limit } = filters

  const refresh = useCallback(async () => {
    if (!householdId) {
      setTransactions([])
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('household_id', householdId)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })

    if (from) query = query.gte('occurred_on', from)
    if (to) query = query.lte('occurred_on', to)
    if (limit) query = query.limit(limit)

    const { data, error } = await query
    if (error) console.error('Failed to load transactions', error)
    setTransactions(data ?? [])
    setLoading(false)
  }, [householdId, from, to, limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addTransaction = useCallback(
    async (input: NewTransaction) => {
      if (!householdId) return
      const { error } = await supabase
        .from('transactions')
        .insert({ ...input, household_id: householdId })
      if (error) throw error
      await refresh()
    },
    [householdId, refresh],
  )

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Transaction>) => {
      const { error } = await supabase.from('transactions').update(patch).eq('id', id)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  const deleteTransaction = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  return {
    transactions,
    loading,
    refresh,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  }
}
