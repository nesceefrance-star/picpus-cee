import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import useStore from './store/useStore'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Dossiers from './pages/Dossiers'
import DossierDetail from './pages/DossierDetail'
import AdminUsers from './pages/AdminUsers'
import AgentRelance from './pages/AgentRelance'
import MonAssistante from './pages/MonAssistante'
import SuiviEquipe from './pages/SuiviEquipe'
import ResetPassword from './pages/ResetPassword'
import AppHub from './Hub'
import Parametres from './pages/Parametres'
import VisitesTechniques from './pages/VisitesTechniques'
import VisiteTechniqueDetail from './pages/VisiteTechniqueDetail'
import RapportPublic from './pages/RapportPublic'
import Planning from './pages/Planning'
import SimulateurRapide from './pages/SimulateurRapide'
import EmailGenerateur from './pages/EmailGenerateur'
import AppLayout from './components/AppLayout'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

const muiTheme = createTheme({
  palette: { mode: 'dark', primary: { main: '#3B82F6' }, background: { default: '#0F172A', paper: '#1E293B' } },
  typography: { fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" },
})

function AuthGuard({ children }) {
  const { session, setSession, fetchProfile } = useStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let done = false
    const finish = () => { if (!done) { done = true; setReady(true) } }

    // Timeout de secours — si tout échoue, on débloque quand même après 4s
    const timeout = setTimeout(finish, 4000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      // fetchProfile en arrière-plan : ne bloque pas le rendu
      if (session?.user) fetchProfile(session.user.id).catch(() => {})
      finish()
    }).catch(() => finish())

    // Écoute les changements d'auth (login/logout depuis n'importe quel onglet)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id).catch(() => {})
      finish()
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

function WithLayout({ children }) {
  return (
    <AuthGuard>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  )
}

export default function AppRouter() {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login"          element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/"               element={<WithLayout><Dashboard /></WithLayout>} />
          <Route path="/dossiers"       element={<WithLayout><Dossiers /></WithLayout>} />
          <Route path="/hub"            element={<WithLayout><AppHub /></WithLayout>} />
          <Route path="/dossier/:id"    element={<WithLayout><DossierDetail /></WithLayout>} />
          <Route path="/relances"       element={<WithLayout><AgentRelance /></WithLayout>} />
          <Route path="/assistante"    element={<WithLayout><MonAssistante /></WithLayout>} />
          <Route path="/suivi-equipe"  element={<WithLayout><SuiviEquipe /></WithLayout>} />
          <Route path="/admin/users"    element={<WithLayout><AdminUsers /></WithLayout>} />
          <Route path="/parametres"      element={<WithLayout><Parametres /></WithLayout>} />
          <Route path="/visites"         element={<WithLayout><VisitesTechniques /></WithLayout>} />
          <Route path="/visites/:id"     element={<WithLayout><VisiteTechniqueDetail /></WithLayout>} />
          <Route path="/planning"        element={<WithLayout><Planning /></WithLayout>} />
          <Route path="/simulateur"      element={<WithLayout><SimulateurRapide /></WithLayout>} />
          <Route path="/emails"          element={<WithLayout><EmailGenerateur /></WithLayout>} />
          <Route path="/rapport/:token"  element={<RapportPublic />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
