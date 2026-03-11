import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import useStore from './store/useStore'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminUsers from './pages/AdminUsers'
import PICPUSHub from './Hub'

function AuthGuard({ children }) {
  const { session, setSession, fetchProfile } = useStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id).then(() => setLoading(false))
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA', fontSize: 14, fontFamily: 'system-ui' }}>
      Chargement…
    </div>
  )

  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/hub" element={<AuthGuard><PICPUSHub /></AuthGuard>} />
        <Route path="/dossier/:id" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/admin/users" element={<AuthGuard><AdminUsers /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
