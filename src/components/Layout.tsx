import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Wallet,
  Users,
  LogOut,
  ChevronsUpDown,
  Check,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/family', label: 'Family', icon: Users },
]

function HouseholdSwitcher() {
  const { households, current, selectHousehold } = useHousehold()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-left hover:bg-slate-800"
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Household</p>
          <p className="truncate text-sm font-semibold">{current?.name ?? '—'}</p>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
            {households.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  selectHousehold(h.id)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-800"
              >
                <span className="truncate">{h.name}</span>
                {current?.id === h.id && <Check className="h-4 w-4 text-brand-400" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-lg font-black text-slate-950">
        $
      </div>
      <div>
        <p className="text-sm font-bold leading-none">MoneySmart</p>
        <p className="text-[10px] text-slate-500">Family budgeting</p>
      </div>
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth()

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-slate-800 p-4 md:flex">
        <Brand />
        <HouseholdSwitcher />
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-300'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 pt-3">
          <p className="truncate px-1 pb-2 text-xs text-slate-500">{user?.email}</p>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex w-full min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur md:hidden">
          <Brand />
          <button
            onClick={signOut}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4 sm:px-6 sm:pt-6 md:pb-8">
          <div className="mb-4 md:hidden">
            <HouseholdSwitcher />
          </div>
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-brand-400' : 'text-slate-500'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
