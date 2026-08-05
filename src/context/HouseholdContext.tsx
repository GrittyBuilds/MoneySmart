import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Category, Household, HouseholdMember } from '../lib/types'

interface HouseholdState {
  loading: boolean
  households: Household[]
  currentId: string | null
  current: Household | null
  members: HouseholdMember[]
  categories: Category[]
  selectHousehold: (id: string) => void
  createHousehold: (name: string, memberName: string) => Promise<void>
  joinHousehold: (code: string, memberName: string) => Promise<void>
  refreshHouseholds: () => Promise<void>
  refreshCategories: () => Promise<void>
  refreshMembers: () => Promise<void>
}

const HouseholdContext = createContext<HouseholdState | undefined>(undefined)

const STORAGE_KEY = 'moneysmart.currentHousehold'

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [households, setHouseholds] = useState<Household[]>([])
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currentId, setCurrentId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  )

  const refreshHouseholds = useCallback(async () => {
    if (!user) {
      setHouseholds([])
      return
    }
    // Households the user is a member of, via the join table.
    const { data, error } = await supabase
      .from('household_members')
      .select('households(*)')
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to load households', error)
      return
    }
    const rows = (data ?? [])
      .map((r) => (r as unknown as { households: Household }).households)
      .filter(Boolean)
    // Sort newest first for stable ordering.
    rows.sort((a, b) => a.name.localeCompare(b.name))
    setHouseholds(rows)
  }, [user])

  const refreshMembers = useCallback(async () => {
    if (!currentId) {
      setMembers([])
      return
    }
    const { data, error } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', currentId)
      .order('joined_at', { ascending: true })
    if (error) {
      console.error('Failed to load members', error)
      return
    }
    setMembers(data ?? [])
  }, [currentId])

  const refreshCategories = useCallback(async () => {
    if (!currentId) {
      setCategories([])
      return
    }
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('household_id', currentId)
      .order('kind', { ascending: true })
      .order('name', { ascending: true })
    if (error) {
      console.error('Failed to load categories', error)
      return
    }
    setCategories(data ?? [])
  }, [currentId])

  // Load household list whenever the user changes.
  useEffect(() => {
    let active = true
    setLoading(true)
    refreshHouseholds().finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [refreshHouseholds])

  // Keep a valid current selection: default to the first household.
  useEffect(() => {
    if (households.length === 0) {
      setCurrentId(null)
      return
    }
    if (!currentId || !households.some((h) => h.id === currentId)) {
      setCurrentId(households[0].id)
    }
  }, [households, currentId])

  // Persist + load dependent data when the current household changes.
  useEffect(() => {
    if (currentId) localStorage.setItem(STORAGE_KEY, currentId)
    else localStorage.removeItem(STORAGE_KEY)
    refreshMembers()
    refreshCategories()
  }, [currentId, refreshMembers, refreshCategories])

  const selectHousehold = useCallback((id: string) => setCurrentId(id), [])

  const createHousehold = useCallback(
    async (name: string, memberName: string) => {
      const { data, error } = await supabase.rpc('create_household', {
        household_name: name,
        member_name: memberName,
      })
      if (error) throw error
      await refreshHouseholds()
      if (typeof data === 'string') setCurrentId(data)
    },
    [refreshHouseholds],
  )

  const joinHousehold = useCallback(
    async (code: string, memberName: string) => {
      const { data, error } = await supabase.rpc('join_household', {
        code,
        member_name: memberName,
      })
      if (error) throw error
      await refreshHouseholds()
      if (typeof data === 'string') setCurrentId(data)
    },
    [refreshHouseholds],
  )

  const current = useMemo(
    () => households.find((h) => h.id === currentId) ?? null,
    [households, currentId],
  )

  const value = useMemo<HouseholdState>(
    () => ({
      loading,
      households,
      currentId,
      current,
      members,
      categories,
      selectHousehold,
      createHousehold,
      joinHousehold,
      refreshHouseholds,
      refreshCategories,
      refreshMembers,
    }),
    [
      loading,
      households,
      currentId,
      current,
      members,
      categories,
      selectHousehold,
      createHousehold,
      joinHousehold,
      refreshHouseholds,
      refreshCategories,
      refreshMembers,
    ],
  )

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold(): HouseholdState {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within a HouseholdProvider')
  return ctx
}
