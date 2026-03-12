import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import useStore from './store/useStore'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminUsers from './pages/AdminUsers'
import ResetPassword from './pages/ResetPassword'
import PICPUSHub from './Hub'

function AuthGuard({ children }) {
  const { session, setSession, fetchProfile } = useStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let done = false
    const finish = () => { if (!done) { done = true; setReady(true) } }

    // Timeout de secours — 8s pour laisser le temps sur mobile lent
    const timeout = setTimeout(finish, 8000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout)
      setSession(session)
      if (session?.user) {
        try { await fetchProfile(session.user.id) } catch (_) {}
      }
      finish()
    }).catch(() => { clearTimeout(timeout); finish() })

    // Écoute les changements d'auth (login/logout depuis n'importe quel onglet)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (session?.user) {
        try { await fetchProfile(session.user.id) } catch (_) {}
      }
      // Si on vient de se connecter et qu'on n'est pas encore ready, on l'est maintenant
      if (!done) finish()
    })

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  if (!ready) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center', color: '#60A5FA' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 14, marginBottom: 8 }}>Chargement PICPUS…</div>
        <div style={{ fontSize: 11, color: '#334155' }}>Connexion en cours…</div>
      </div>
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
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/hub" element={<AuthGuard><PICPUSHub /></AuthGuard>} />
        <Route path="/dossier/:id" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/admin/users" element={<AuthGuard><AdminUsers /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
