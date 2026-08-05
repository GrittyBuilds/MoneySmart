import type { Account, Category, Transaction } from './types'

/** Net balance of an account: starting balance + income − expenses. */
export function accountBalance(account: Account, transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.account_id === account.id)
    .reduce(
      (bal, t) => bal + (t.kind === 'income' ? t.amount : -t.amount),
      account.starting_balance,
    )
}

/** Total balance across a set of accounts. */
export function totalBalance(accounts: Account[], transactions: Transaction[]): number {
  return accounts.reduce((sum, a) => sum + accountBalance(a, transactions), 0)
}

export interface Totals {
  income: number
  expense: number
  net: number
}

export function sumTotals(transactions: Transaction[]): Totals {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (t.kind === 'income') income += t.amount
    else expense += t.amount
  }
  return { income, expense, net: income - expense }
}

/** Map of category id → total expense amount within the given transactions. */
export function spendByCategory(transactions: Transaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.kind !== 'expense') continue
    const key = t.category_id ?? 'uncategorized'
    map.set(key, (map.get(key) ?? 0) + t.amount)
  }
  return map
}

export function categoryById(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((c) => [c.id, c]))
}

export function accountById(accounts: Account[]): Map<string, Account> {
  return new Map(accounts.map((a) => [a.id, a]))
}
