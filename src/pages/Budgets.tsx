import { useMemo, useState } from 'react'
import { PiggyBank, Pencil } from 'lucide-react'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { useHousehold } from '../context/HouseholdContext'
import { useBudgets } from '../hooks/useBudgets'
import { useTransactions } from '../hooks/useTransactions'
import { spendByCategory } from '../lib/compute'
import { money } from '../lib/format'
import type { Category } from '../lib/types'
import { MonthPicker } from '../components/MonthPicker'
import { StatCard, FullPageLoader, Modal, Spinner, EmptyState } from '../components/ui'

export default function Budgets() {
  const { currentId, categories } = useHousehold()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

  const monthStr = format(startOfMonth(month), 'yyyy-MM-dd')
  const from = format(startOfMonth(month), 'yyyy-MM-dd')
  const to = format(endOfMonth(month), 'yyyy-MM-dd')

  const { budgets, loading: bLoading, setBudget } = useBudgets(currentId, monthStr)
  const { transactions, loading: tLoading } = useTransactions(currentId, { from, to })

  const [editing, setEditing] = useState<Category | null>(null)

  const spend = useMemo(() => spendByCategory(transactions), [transactions])
  const expenseCats = useMemo(
    () => categories.filter((c) => c.kind === 'expense'),
    [categories],
  )

  const budgetMap = useMemo(
    () => new Map(budgets.map((b) => [b.category_id, b.amount])),
    [budgets],
  )

  const rows = useMemo(() => {
    return expenseCats
      .map((cat) => {
        const budget = budgetMap.get(cat.id) ?? 0
        const spent = spend.get(cat.id) ?? 0
        return { cat, budget, spent }
      })
      // Budgeted categories first, then by spend.
      .sort((a, b) => {
        if ((b.budget > 0 ? 1 : 0) !== (a.budget > 0 ? 1 : 0))
          return (b.budget > 0 ? 1 : 0) - (a.budget > 0 ? 1 : 0)
        return b.spent - a.spent
      })
  }, [expenseCats, budgetMap, spend])

  const totals = useMemo(() => {
    let budgeted = 0
    let spent = 0
    for (const r of rows) {
      budgeted += r.budget
      if (r.budget > 0) spent += r.spent
    }
    return { budgeted, spent, remaining: budgeted - spent }
  }, [rows])

  if (bLoading || tLoading) return <FullPageLoader label="Loading budgets…" />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-sm text-slate-400">Set a monthly limit per category.</p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Budgeted" value={money(totals.budgeted)} />
        <StatCard label="Spent" value={money(totals.spent)} tone="negative" />
        <StatCard
          label="Remaining"
          value={money(totals.remaining)}
          tone={totals.remaining >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {expenseCats.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-6 w-6" />}
          title="No categories yet"
          description="Add expense categories on the Family page to start budgeting."
        />
      ) : (
        <div className="space-y-3">
          {rows.map(({ cat, budget, spent }) => (
            <BudgetRow
              key={cat.id}
              cat={cat}
              budget={budget}
              spent={spent}
              onEdit={() => setEditing(cat)}
            />
          ))}
        </div>
      )}

      <EditBudgetModal
        category={editing}
        currentAmount={editing ? budgetMap.get(editing.id) ?? 0 : 0}
        monthLabel={format(month, 'MMMM yyyy')}
        onClose={() => setEditing(null)}
        onSave={async (amount) => {
          if (editing) await setBudget(editing.id, amount)
        }}
      />
    </div>
  )
}

function BudgetRow({
  cat,
  budget,
  spent,
  onEdit,
}: {
  cat: Category
  budget: number
  spent: number
  onEdit: () => void
}) {
  const hasBudget = budget > 0
  const pct = hasBudget ? Math.min(100, (spent / budget) * 100) : 0
  const over = hasBudget && spent > budget
  const remaining = budget - spent

  const barColor = over ? '#f43f5e' : pct > 80 ? '#f59e0b' : cat.color

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full" style={{ background: cat.color }} />
          <span className="font-medium">{cat.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">
            {money(spent)}
            {hasBudget && <span className="text-slate-600"> / {money(budget)}</span>}
          </span>
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            aria-label={`Set budget for ${cat.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      {hasBudget ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
          <p
            className={`mt-1.5 text-xs ${
              over ? 'text-red-400' : 'text-slate-500'
            }`}
          >
            {over
              ? `${money(spent - budget)} over budget`
              : `${money(remaining)} left`}
          </p>
        </>
      ) : (
        <button
          onClick={onEdit}
          className="text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          + Set a budget
        </button>
      )}
    </div>
  )
}

function EditBudgetModal({
  category,
  currentAmount,
  monthLabel,
  onClose,
  onSave,
}: {
  category: Category | null
  currentAmount: number
  monthLabel: string
  onClose: () => void
  onSave: (amount: number) => Promise<void>
}) {
  return (
    <Modal
      open={Boolean(category)}
      title={category ? `Budget · ${category.name}` : 'Budget'}
      onClose={onClose}
    >
      {category && (
        <BudgetForm
          key={category.id}
          currentAmount={currentAmount}
          monthLabel={monthLabel}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

function BudgetForm({
  currentAmount,
  monthLabel,
  onSave,
  onClose,
}: {
  currentAmount: number
  monthLabel: string
  onSave: (amount: number) => Promise<void>
  onClose: () => void
}) {
  const [amount, setAmount] = useState(currentAmount ? String(currentAmount) : '')
  const [busy, setBusy] = useState(false)

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await onSave(Math.round(parseFloat(amount || '0') * 100) / 100)
          onClose()
        } finally {
          setBusy(false)
        }
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-400">
        Monthly limit for {monthLabel}. Set to 0 to remove the budget.
      </p>
      <div>
        <label className="label" htmlFor="budget-amount">
          Amount
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            $
          </span>
          <input
            id="budget-amount"
            type="number"
            step="0.01"
            min="0"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input pl-7 text-lg font-semibold"
          />
        </div>
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy && <Spinner className="h-4 w-4" />}
        Save budget
      </button>
    </form>
  )
}
