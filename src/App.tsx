import { Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { AuthProvider, useAuth } from './context/AuthContext'
import { HouseholdProvider, useHousehold } from './context/HouseholdContext'
import { FullPageLoader } from './components/ui'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import SetupNeeded from './pages/SetupNeeded'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Budgets from './pages/Budgets'
import Accounts from './pages/Accounts'
import Family from './pages/Family'

function Gate() {
  const { loading: authLoading, session } = useAuth()

  if (authLoading) return <FullPageLoader />
  if (!session) return <Login />

  return (
    <HouseholdProvider>
      <HouseholdGate />
    </HouseholdProvider>
  )
}

function HouseholdGate() {
  const { loading, households } = useHousehold()

  if (loading) return <FullPageLoader label="Loading your budget…" />
  if (households.length === 0) return <Onboarding />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/family" element={<Family />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNeeded />

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
