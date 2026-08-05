import { useState, type FormEvent } from 'react'
import { Home, Users, LogOut } from 'lucide-react'
import { useHousehold } from '../context/HouseholdContext'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui'

export default function Onboarding() {
  const { createHousehold, joinHousehold } = useHousehold()
  const { signOut, user } = useAuth()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [householdName, setHouseholdName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const defaultName = user?.email?.split('@')[0] ?? 'Me'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const name = displayName.trim() || defaultName
      if (tab === 'create') {
        await createHousehold(householdName.trim() || 'Our Household', name)
      } else {
        await joinHousehold(inviteCode.trim(), name)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Set up your budget</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create a household for your family, or join one with an invite code.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-900 p-1">
        <button
          onClick={() => setTab('create')}
          className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors ${
            tab === 'create' ? 'bg-brand-500 text-slate-950' : 'text-slate-400'
          }`}
        >
          <Home className="h-4 w-4" />
          Create
        </button>
        <button
          onClick={() => setTab('join')}
          className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors ${
            tab === 'join' ? 'bg-brand-500 text-slate-950' : 'text-slate-400'
          }`}
        >
          <Users className="h-4 w-4" />
          Join
        </button>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        {tab === 'create' ? (
          <div>
            <label className="label" htmlFor="hname">
              Household name
            </label>
            <input
              id="hname"
              className="input"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="The Smith Family"
            />
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="code">
              Invite code
            </label>
            <input
              id="code"
              className="input font-mono tracking-widest"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="a1b2c3d4"
              required
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Ask a family member for the code shown on their Family page.
            </p>
          </div>
        )}

        <div>
          <label className="label" htmlFor="dname">
            Your name
          </label>
          <input
            id="dname"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={defaultName}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy && <Spinner className="h-4 w-4" />}
          {tab === 'create' ? 'Create household' : 'Join household'}
        </button>
      </form>

      <button
        onClick={signOut}
        className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-300"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  )
}
