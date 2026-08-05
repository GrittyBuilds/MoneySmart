import { useState, type FormEvent } from 'react'
import { Copy, Check, Users, Tag, Plus, Trash2, Crown } from 'lucide-react'
import { useHousehold } from '../context/HouseholdContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Category, TxKind } from '../lib/types'
import { Modal, Spinner } from '../components/ui'

const SWATCHES = [
  '#10b981', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6',
  '#ec4899', '#f43f5e', '#ef4444', '#f59e0b', '#eab308',
  '#14b8a6', '#06b6d4', '#84cc16', '#64748b',
]

export default function Family() {
  const { current, members, categories, refreshCategories } = useHousehold()
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [catModalOpen, setCatModalOpen] = useState(false)

  async function copyCode() {
    if (!current) return
    try {
      await navigator.clipboard.writeText(current.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard may be blocked; the code is visible anyway */
    }
  }

  async function deleteCategory(cat: Category) {
    if (!confirm(`Delete the "${cat.name}" category?`)) return
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (error) alert(error.message)
    else await refreshCategories()
  }

  const expenseCats = categories.filter((c) => c.kind === 'expense')
  const incomeCats = categories.filter((c) => c.kind === 'income')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Family</h1>
        <p className="text-sm text-slate-400">Invite members and manage categories.</p>
      </div>

      {/* Invite */}
      <div className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-brand-400" />
          Invite family members
        </h2>
        <p className="mb-3 text-sm text-slate-400">
          Share this code. Family members sign up, choose “Join”, and enter it to access this
          shared budget.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-lg tracking-widest text-brand-300">
            {current?.invite_code ?? '—'}
          </code>
          <button onClick={copyCode} className="btn-ghost h-full px-4" aria-label="Copy invite code">
            {copied ? <Check className="h-4 w-4 text-brand-400" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Members */}
      <div className="card p-5">
        <h2 className="mb-3 font-semibold">
          Members <span className="text-slate-500">({members.length})</span>
        </h2>
        <ul className="divide-y divide-slate-800">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-300">
                  {(m.display_name ?? '?').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {m.display_name ?? 'Member'}
                    {m.user_id === user?.id && (
                      <span className="ml-2 text-xs text-slate-500">(you)</span>
                    )}
                  </p>
                  <p className="text-xs capitalize text-slate-500">{m.role}</p>
                </div>
              </div>
              {m.role === 'owner' && <Crown className="h-4 w-4 text-amber-400" />}
            </li>
          ))}
        </ul>
      </div>

      {/* Categories */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Tag className="h-4 w-4 text-brand-400" />
            Categories
          </h2>
          <button onClick={() => setCatModalOpen(true)} className="btn-ghost px-3 py-2 text-xs">
            <Plus className="h-4 w-4" />
            New
          </button>
        </div>

        <CategoryGroup title="Expenses" cats={expenseCats} onDelete={deleteCategory} />
        <CategoryGroup title="Income" cats={incomeCats} onDelete={deleteCategory} />
      </div>

      <CategoryModal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        onCreated={refreshCategories}
      />
    </div>
  )
}

function CategoryGroup({
  title,
  cats,
  onDelete,
}: {
  title: string
  cats: Category[]
  onDelete: (c: Category) => void
}) {
  if (cats.length === 0) return null
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <span
            key={c.id}
            className="group flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 py-1.5 pl-3 pr-1.5 text-sm"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            {c.name}
            <button
              onClick={() => onDelete(c)}
              className="rounded-full p-1 text-slate-600 hover:bg-red-500/10 hover:text-red-400"
              aria-label={`Delete ${c.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

function CategoryModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const { currentId } = useHousehold()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<TxKind>('expense')
  const [color, setColor] = useState(SWATCHES[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!currentId) return
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.from('categories').insert({
      household_id: currentId,
      name: name.trim(),
      kind,
      color,
      icon: 'tag',
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    await onCreated()
    setName('')
    setColor(SWATCHES[0])
    setKind('expense')
    onClose()
  }

  return (
    <Modal open={open} title="New category" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1">
          {(['expense', 'income'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
                kind === k ? 'bg-brand-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div>
          <label className="label" htmlFor="cat-name">
            Name
          </label>
          <input
            id="cat-name"
            className="input"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries"
          />
        </div>

        <div>
          <span className="label">Color</span>
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setColor(s)}
                className={`h-8 w-8 rounded-full transition-transform ${
                  color === s ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''
                }`}
                style={{ background: s }}
                aria-label={`Choose color ${s}`}
              />
            ))}
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy && <Spinner className="h-4 w-4" />}
          Create category
        </button>
      </form>
    </Modal>
  )
}
