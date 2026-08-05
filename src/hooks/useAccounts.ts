import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Account } from '../lib/types'

export function useAccounts(householdId: string | null) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!householdId) {
      setAccounts([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true })
    if (error) console.error('Failed to load accounts', error)
    setAccounts(data ?? [])
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addAccount = useCallback(
    async (input: Pick<Account, 'name' | 'type' | 'starting_balance'>) => {
      if (!householdId) return
      const { error } = await supabase
        .from('accounts')
        .insert({ ...input, household_id: householdId })
      if (error) throw error
      await refresh()
    },
    [householdId, refresh],
  )

  const updateAccount = useCallback(
    async (id: string, patch: Partial<Account>) => {
      const { error } = await supabase.from('accounts').update(patch).eq('id', id)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  const deleteAccount = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  return { accounts, loading, refresh, addAccount, updateAccount, deleteAccount }
}
