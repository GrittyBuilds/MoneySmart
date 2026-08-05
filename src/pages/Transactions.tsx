import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Receipt, Search } from 'lucide-react'
import { useHousehold } from '../context/HouseholdContext'
import { useTransactions, type NewTransaction } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { accountById, categoryById } from '../lib/compute'
import { money, prettyDate, todayISO } from '../lib/format'
import type { Transaction, TxKind } from '../lib/types'
import { Modal, EmptyState, FullPageLoader, Spinner } from '../components/ui'

const EMPTY: NewTransaction = {
  account_id: null,
  category_id: null,
  kind: 'expense',
  amount: 0,
  description: '',
  occurred_on: todayISO(),
}

export default function Transactions() {
  const { currentId, categories } = useHousehold()
  const {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactions(currentId)
  const { accounts } = useAccounts(currentId)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | TxKind>('all')

  const catMap = useMemo(() => categoryById(categories), [categories])
  const acctMap = useMemo(() => accountById(accounts), [accounts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter((t) => {
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false
      if (!q) return true
      const cat = t.category_id ? catMap.get(t.category_id)?.name ?? '' : ''
      return (
        (t.description ?? '').toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      )
    })
  }, [transactions, search, kindFilter, catMap])

  function openAdd() {
    setEditing(null)
    setModalOpen(true)
  }
  function openEdit(t: Transaction) {
    setEditing(t)
    setModalOpen(true)
  }

  if (loading) return <FullPageLoader label="Loading transactions…" />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-slate-400">Every dollar in and out.</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="h-4 w-4" />
          Add transaction
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Search description or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-xl bg-slate-900 p-1">
          {(['all', 'expense', 'income'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                kindFilter === k ? 'bg-brand-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title={transactions.length === 0 ? 'No transactions yet' : 'No matches'}
          description={
            transactions.length === 0
              ? 'Add your first income or expense to get started.'
              : 'Try a different search or filter.'
          }
          action={
            transactions.length === 0 ? (
              <button onClick={openAdd} className="btn-primary">
                <Plus className="h-4 w-4" />
                Add transaction
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="card divide-y divide-slate-800 overflow-hidden">
          {filtered.map((t) => {
            const cat = t.category_id ? catMap.get(t.category_id) : undefined
            const acct = t.account_id ? acctMap.get(t.account_id) : undefined
            return (
              <div
                key={t.id}
                className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-800/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
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
                      {prettyDate(t.occurred_on)}
                      {cat ? ` · ${cat.name}` : ''}
                      {acct ? ` · ${acct.name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`mr-1 text-sm font-semibold ${
                      t.kind === 'income' ? 'text-brand-400' : 'text-slate-200'
                    }`}
                  >
                    {t.kind === 'income' ? '+' : '−'}
                    {money(t.amount)}
                  </span>
                  <button
                    onClick={() => openEdit(t)}
                    className="rounded-lg p-2 text-slate-500 opacity-0 hover:bg-slate-800 hover:text-slate-200 group-hover:opacity-100"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this transaction?')) deleteTransaction(t.id)
                    }}
                    className="rounded-lg p-2 text-slate-500 opacity-0 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <TransactionModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onCreate={addTransaction}
        onUpdate={updateTransaction}
      />
    </div>
  )
}

function TransactionModal({
  open,
  editing,
  onClose,
  onCreate,
  onUpdate,
}: {
  open: boolean
  editing: Transaction | null
  onClose: () => void
  onCreate: (t: NewTransaction) => Promise<void>
  onUpdate: (id: string, patch: Partial<Transaction>) => Promise<void>
}) {
  const { categories } = useHousehold()
  const { accounts } = useAccounts(useHousehold().currentId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initial: NewTransaction = editing
    ? {
        account_id: editing.account_id,
        category_id: editing.category_id,
        kind: editing.kind,
        amount: editing.amount,
        description: editing.description ?? '',
        occurred_on: editing.occurred_on,
      }
    : EMPTY

  // Re-key the form on open/target change so fields reset correctly.
  return (
    <Modal
      open={open}
      title={editing ? 'Edit transaction' : 'Add transaction'}
      onClose={onClose}
    >
      <TxForm
        key={editing?.id ?? 'new'}
        initial={initial}
        categories={categories}
        accounts={accounts}
        busy={busy}
        error={error}
        submitLabel={editing ? 'Save changes' : 'Add transaction'}
        onSubmit={async (values) => {
          setError(null)
          setBusy(true)
          try {
            if (editing) await onUpdate(editing.id, values)
            else await onCreate(values)
            onClose()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
          } finally {
            setBusy(false)
          }
        }}
      />
    </Modal>
  )
}

function TxForm({
  initial,
  categories,
  accounts,
  busy,
  error,
  submitLabel,
  onSubmit,
}: {
  initial: NewTransaction
  categories: ReturnType<typeof useHousehold>['categories']
  accounts: ReturnType<typeof useAccounts>['accounts']
  busy: boolean
  error: string | null
  submitLabel: string
  onSubmit: (values: NewTransaction) => void
}) {
  const [kind, setKind] = useState<TxKind>(initial.kind)
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : '')
  const [categoryId, setCategoryId] = useState(initial.category_id ?? '')
  const [accountId, setAccountId] = useState(initial.account_id ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [date, setDate] = useState(initial.occurred_on)

  const relevantCats = categories.filter((c) => c.kind === kind)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      kind,
      amount: Math.round(parseFloat(amount || '0') * 100) / 100,
      category_id: categoryId || null,
      account_id: accountId || null,
      description: description.trim() || null,
      occurred_on: date,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1">
        {(['expense', 'income'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k)
              setCategoryId('')
            }}
            className={`rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
              kind === k
                ? k === 'income'
                  ? 'bg-brand-500 text-slate-950'
                  : 'bg-red-500 text-white'
                : 'text-slate-400'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="amount">
          Amount
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            $
          </span>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            required
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input pl-7 text-lg font-semibold"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Uncategorized</option>
            {relevantCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="account">
            Account
          </label>
          <select
            id="account"
            className="input"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">None</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="date">
          Date
        </label>
        <input
          id="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="desc">
          Description <span className="normal-case text-slate-600">(optional)</span>
        </label>
        <input
          id="desc"
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Weekly grocery run"
        />
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy && <Spinner className="h-4 w-4" />}
        {submitLabel}
      </button>
    </form>
  )
}
