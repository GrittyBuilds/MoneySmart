import { format, parseISO, startOfMonth } from 'date-fns'

/** The user's currency. Kept simple; can be made configurable later. */
export const CURRENCY = 'USD'

const currencyFmt = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 2,
})

const compactFmt = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: CURRENCY,
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function money(amount: number): string {
  return currencyFmt.format(amount ?? 0)
}

/** Compact form for tight spaces (axis labels, chips): $1.2K. */
export function moneyCompact(amount: number): string {
  return compactFmt.format(amount ?? 0)
}

/** A signed representation: income positive, expense negative. */
export function signedMoney(amount: number, kind: 'income' | 'expense'): string {
  const v = kind === 'expense' ? -Math.abs(amount) : Math.abs(amount)
  return (v > 0 ? '+' : '') + money(v)
}

export function prettyDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy')
  } catch {
    return iso
  }
}

export function shortDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d')
  } catch {
    return iso
  }
}

/** First day of a month as YYYY-MM-DD, e.g. for budget keys. */
export function monthKey(date: Date): string {
  return format(startOfMonth(date), 'yyyy-MM-dd')
}

export function monthLabel(iso: string): string {
  try {
    return format(parseISO(iso), 'MMMM yyyy')
  } catch {
    return iso
  }
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
