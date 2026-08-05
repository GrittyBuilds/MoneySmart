// Shared domain types plus a light Database type for the Supabase client.

export type TxKind = 'expense' | 'income'
export type AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'other'

export interface Household {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  display_name: string | null
  role: string
  joined_at: string
}

export interface Account {
  id: string
  household_id: string
  name: string
  type: AccountType
  starting_balance: number
  created_at: string
}

export interface Category {
  id: string
  household_id: string
  name: string
  kind: TxKind
  color: string
  icon: string
  created_at: string
}

export interface Transaction {
  id: string
  household_id: string
  account_id: string | null
  category_id: string | null
  kind: TxKind
  amount: number
  description: string | null
  occurred_on: string // YYYY-MM-DD
  created_by: string
  created_at: string
}

export interface Budget {
  id: string
  household_id: string
  category_id: string
  amount: number
  month: string // YYYY-MM-DD (first of month)
  created_at: string
}
