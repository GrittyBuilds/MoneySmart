import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Budget } from '../lib/types'

export function useBudgets(householdId: string | null, month: string | null) {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!householdId || !month) {
      setBudgets([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('household_id', householdId)
      .eq('month', month)
    if (error) console.error('Failed to load budgets', error)
    setBudgets(data ?? [])
    setLoading(false)
  }, [householdId, month])

  useEffect(() => {
    refresh()
  }, [refresh])

  /**
   * Create or update the budget for a category in this month. Passing 0 (or a
   * negative) removes the budget so the category no longer appears as tracked.
   */
  const setBudget = useCallback(
    async (categoryId: string, amount: number) => {
      if (!householdId || !month) return
      const existing = budgets.find((b) => b.category_id === categoryId)

      if (amount <= 0) {
        if (existing) {
          const { error } = await supabase.from('budgets').delete().eq('id', existing.id)
          if (error) throw error
        }
        await refresh()
        return
      }

      if (existing) {
        const { error } = await supabase
          .from('budgets')
          .update({ amount })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('budgets').insert({
          household_id: householdId,
          category_id: categoryId,
          amount,
          month,
        })
        if (error) throw error
      }
      await refresh()
    },
    [householdId, month, budgets, refresh],
  )

  return { budgets, loading, refresh, setBudget }
}
