import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Wallet, Landmark, PiggyBank, Banknote, CreditCard } from 'lucide-react'
import { useHousehold } from '../context/HouseholdContext'
import { useAccounts } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { accountBalance, totalBalance } from '../lib/compute'
import { money } from '../lib/format'
import type { Account, AccountType } from '../lib/types'
import { Modal, EmptyState, FullPageLoader, Spinner, StatCard } from '../components/ui'

const TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit', label: 'Credit card' },
  { value: 'other', label: 'Other' },
]

const TYPE_ICON: Record<AccountType, typeof Wallet> = {
  checking: Landmark,
  savings: PiggyBank,
  cash: Banknote,
  credit: CreditCard,
  other: Wallet,
}

export default function Accounts() {
  const { currentId } = useHousehold()
  const { accounts, loading, addAccount, updateAccount, deleteAccount } =
    useAccounts(currentId)
  const { transactions } = useTransactions(currentId)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)

  const total = useMemo(
    () => totalBalance(accounts, transactions),
    [accounts, transactions],
  )

  if (loading) return <FullPageLoader label="Loading accounts…" />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-slate-400">Where your family's money lives.</p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          Add account
        </button>
      </div>

      <StatCard
        label="Total balance"
        value={money(total)}
        hint={`${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
        tone={total >= 0 ? 'positive' : 'negative'}
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No accounts yet"
          description="Add a checking, savings, or cash account to track balances."
          action={
            <button
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              Add account
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((a) => {
            const bal = accountBalance(a, transactions)
            const Icon = TYPE_ICON[a.type]
            return (
              <div key={a.id} className="card group flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{a.name}</p>
                    <p className="text-xs capitalize text-slate-500">{a.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`mr-1 font-semibold ${
                      bal >= 0 ? 'text-slate-100' : 'text-red-400'
                    }`}
                  >
                    {money(bal)}
                  </span>
                  <button
                    onClick={() => {
                      setEditing(a)
                      setModalOpen(true)
                    }}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                    aria-label="Edit account"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Delete "${a.name}"? Transactions will be kept but unlinked from this account.`,
                        )
                      )
                        deleteAccount(a.id)
                    }}
                    className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Delete account"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit account' : 'Add account'}
        onClose={() => setModalOpen(false)}
      >
        <AccountForm
          key={editing?.id ?? 'new'}
          initial={editing}
          onClose={() => setModalOpen(false)}
          onCreate={addAccount}
          onUpdate={updateAccount}
        />
      </Modal>
    </div>
  )
}

function AccountForm({
  initial,
  onClose,
  onCreate,
  onUpdate,
}: {
  initial: Account | null
  onClose: () => void
  onCreate: (a: Pick<Account, 'name' | 'type' | 'starting_balance'>) => Promise<void>
  onUpdate: (id: string, patch: Partial<Account>) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<AccountType>(initial?.type ?? 'checking')
  const [startingBalance, setStartingBalance] = useState(
    initial ? String(initial.starting_balance) : '',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const payload = {
      name: name.trim(),
      type,
      starting_balance: Math.round(parseFloat(startingBalance || '0') * 100) / 100,
    }
    try {
      if (initial) await onUpdate(initial.id, payload)
      else await onCreate(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="acct-name">
          Account name
        </label>
        <input
          id="acct-name"
          className="input"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Joint Checking"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="acct-type">
            Type
          </label>
          <select
            id="acct-type"
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="acct-balance">
            Starting balance
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              $
            </span>
            <input
              id="acct-balance"
              type="number"
              step="0.01"
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              placeholder="0.00"
              className="input pl-7"
            />
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy && <Spinner className="h-4 w-4" />}
        {initial ? 'Save changes' : 'Add account'}
      </button>
    </form>
  )
}
