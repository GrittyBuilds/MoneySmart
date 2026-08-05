import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  PieChart as PieIcon,
  Receipt,
} from 'lucide-react'
import {
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { useHousehold } from '../context/HouseholdContext'
import { useTransactions } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import {
  accountById,
  categoryById,
  spendByCategory,
  sumTotals,
  totalBalance,
} from '../lib/compute'
import { money, moneyCompact, shortDate } from '../lib/format'
import { StatCard, FullPageLoader, EmptyState } from '../components/ui'
import { MonthPicker } from '../components/MonthPicker'

export default function Dashboard() {
  const { currentId, categories } = useHousehold()
  const { transactions, loading: txLoading } = useTransactions(currentId)
  const { accounts, loading: acctLoading } = useAccounts(currentId)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

  const catMap = useMemo(() => categoryById(categories), [categories])
  const acctMap = useMemo(() => accountById(accounts), [accounts])

  const monthTx = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    return transactions.filter((t) =>
      isWithinInterval(parseISO(t.occurred_on), { start, end }),
    )
  }, [transactions, month])

  const monthTotals = useMemo(() => sumTotals(monthTx), [monthTx])
  const balance = useMemo(
    () => totalBalance(accounts, transactions),
    [accounts, transactions],
  )

  const pieData = useMemo(() => {
    const spend = spendByCategory(monthTx)
    return [...spend.entries()]
      .map(([catId, amount]) => {
        const cat = catMap.get(catId)
        return {
          name: cat?.name ?? 'Uncategorized',
          value: amount,
          color: cat?.color ?? '#64748b',
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [monthTx, catMap])

  const trendData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(month, 5 - i)))
    return months.map((m) => {
      const start = startOfMonth(m)
      const end = endOfMonth(m)
      const inMonth = transactions.filter((t) =>
        isWithinInterval(parseISO(t.occurred_on), { start, end }),
      )
      const t = sumTotals(inMonth)
      return { label: format(m, 'MMM'), income: t.income, expense: t.expense }
    })
  }, [transactions, month])

  const recent = useMemo(() => transactions.slice(0, 6), [transactions])

  if (txLoading || acctLoading) return <FullPageLoader label="Crunching the numbers…" />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-400">Your family's money at a glance.</p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total balance"
          value={money(balance)}
          hint="Across all accounts"
          icon={<Wallet className="h-4 w-4" />}
          tone={balance >= 0 ? 'default' : 'negative'}
        />
        <StatCard
          label="Income"
          value={money(monthTotals.income)}
          hint={format(month, 'MMMM')}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="positive"
        />
        <StatCard
          label="Expenses"
          value={money(monthTotals.expense)}
          hint={format(month, 'MMMM')}
          icon={<TrendingDown className="h-4 w-4" />}
          tone="negative"
        />
        <StatCard
          label="Net"
          value={money(monthTotals.net)}
          hint="Income − expenses"
          icon={<Scale className="h-4 w-4" />}
          tone={monthTotals.net >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Spending by category */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <PieIcon className="h-4 w-4 text-brand-400" />
            Spending by category
          </h2>
          {pieData.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No spending recorded for {format(month, 'MMMM')}.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width="100%" height={180} className="max-w-[200px]">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => money(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="w-full flex-1 space-y-1.5">
                {pieData.slice(0, 6).map((d) => (
                  <li key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: d.color }}
                      />
                      <span className="truncate text-slate-300">{d.name}</span>
                    </span>
                    <span className="font-medium">{money(d.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Income vs expense trend */}
        <div className="card p-5 lg:col-span-3">
          <h2 className="mb-4 font-semibold">Income vs. expenses</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => moneyCompact(v)}
                width={48}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: '#1e293b55' }}
                formatter={(v: number) => money(v)}
              />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
              <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Receipt className="h-4 w-4 text-brand-400" />
          Recent activity
        </h2>
        {recent.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No transactions yet"
            description="Add your first transaction to see it here."
          />
        ) : (
          <ul className="divide-y divide-slate-800">
            {recent.map((t) => {
              const cat = t.category_id ? catMap.get(t.category_id) : undefined
              const acct = t.account_id ? acctMap.get(t.account_id) : undefined
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                      style={{
                        background: (cat?.color ?? '#64748b') + '22',
                        color: cat?.color ?? '#94a3b8',
                      }}
                    >
                      {(cat?.name ?? '?').slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {t.description || cat?.name || 'Transaction'}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {shortDate(t.occurred_on)}
                        {acct ? ` · ${acct.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      t.kind === 'income' ? 'text-brand-400' : 'text-slate-200'
                    }`}
                  >
                    {t.kind === 'income' ? '+' : '−'}
                    {money(t.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: '0.75rem',
  fontSize: '0.8rem',
  color: '#e2e8f0',
} as const
