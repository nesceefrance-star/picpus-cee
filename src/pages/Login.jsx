import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [mode, setMode]         = useState('login')
  const navigate = useNavigate()

  // Si déjà connecté → redirige vers dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true })
    })
  }, [])

  const INP = {
    width: '100%', boxSizing: 'border-box',
    background: '#0F172A', border: '1px solid #334155',
    borderRadius: 8, padding: '11px 14px',
    color: '#F1F5F9', fontSize: 14, outline: 'none',
    fontFamily: 'inherit',
  }
  const LBL = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#94A3B8', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: .5,
  }

  const handleLogin = async () => {
    if (!email.trim() || !password) return setError('Remplis tous les champs.')
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Redirection explicite après succès
      navigate('/', { replace: true })
    }
  }

  const handleReset = async () => {
    if (!email.trim()) return setError('Saisis ton email.')
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://picpus-cee.vercel.app/reset-password',
    })
    if (error) setError(error.message)
    else setError('✅ Email envoyé — vérifie ta boîte mail')
    setLoading(false)
  }

  const ErrorBox = () => error ? (
    <div style={{
      background: error.startsWith('✅') ? '#052e16' : '#450a0a',
      border: `1px solid ${error.startsWith('✅') ? '#166534' : '#7f1d1d'}`,
      color: error.startsWith('✅') ? '#4ade80' : '#fca5a5',
      borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16,
    }}>
      {error}
    </div>
  ) : null

  return (
    <div style={{
      minHeight: '100vh', background: '#0F172A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "system-ui,'Segoe UI',Arial,sans-serif",
    }}>
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.04,
        backgroundImage: 'linear-gradient(#60A5FA 1px, transparent 1px), linear-gradient(90deg, #60A5FA 1px, transparent 1px)',
        backgroundSize: '40px 40px', pointerEvents: 'none',
      }}/>
      <div style={{
        width: 420, background: '#1E293B',
        border: '1px solid #334155', borderRadius: 16,
        padding: '40px 36px', position: 'relative',
        boxShadow: '0 25px 50px rgba(0,0,0,.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: '#64748B', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Plateforme CEE</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#60A5FA', letterSpacing: 3 }}>PICPUS</div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>Accès restreint — équipe interne</div>
        </div>

        {mode === 'login' ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={LBL}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="prenom@picpus.fr" autoComplete="email" style={INP}/>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={LBL}>Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••" autoComplete="current-password" style={INP}/>
            </div>
            <ErrorBox/>
            <button onClick={handleLogin} disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading ? '#1D4ED8' : '#2563EB',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 15, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <button onClick={() => { setMode('reset'); setError(null); }} style={{
              width: '100%', marginTop: 12, padding: '10px',
              background: 'transparent', color: '#475569',
              border: 'none', fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              Mot de passe oublié ?
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#94A3B8', marginBottom: 16, textAlign: 'center' }}>
              Réinitialiser le mot de passe
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={LBL}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="prenom@picpus.fr" autoComplete="email" style={INP}/>
            </div>
            <ErrorBox/>
            <button onClick={handleReset} disabled={loading} style={{
              width: '100%', padding: '13px',
              background: '#2563EB', color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
            <button onClick={() => { setMode('login'); setError(null); }} style={{
              width: '100%', marginTop: 12, padding: '10px',
              background: 'transparent', color: '#475569',
              border: 'none', fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>← Retour</button>
          </div>
        )}

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #1E293B', textAlign: 'center', fontSize: 11, color: '#334155' }}>
          PICPUS ÉNERGIE — SIREN 533 333 118
        </div>
      </div>
    </div>
  )
}
