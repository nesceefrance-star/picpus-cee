import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function ResetPassword() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [ready, setReady]         = useState(false)
  const navigate = useNavigate()

  // Supabase envoie le token dans le hash de l'URL (#access_token=...&type=recovery)
  // On attend que la session soit établie via onAuthStateChange
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      } else if (event === 'SIGNED_IN' && session) {
        // Si déjà connecté via magic link sans recovery, on redirige
        setReady(true)
      }
    })

    // Timeout fallback — si le hash est déjà traité
    const t = setTimeout(() => setReady(true), 1500)

    return () => { subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  const handleSubmit = async () => {
    setError('')
    if (!password) return setError('Saisis un nouveau mot de passe.')
    if (password.length < 8) return setError('Minimum 8 caractères.')
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas.')

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) return setError(error.message)
    setSuccess(true)
    setTimeout(() => navigate('/'), 2500)
  }

  const C = {
    bg: '#0F172A', surface: '#1E293B', border: '#334155',
    accent: '#2563EB', text: '#F8FAFC', textMid: '#94A3B8',
  }

  if (!ready) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#60A5FA' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 14 }}>Vérification du lien…</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '36px 40px', width: 420, boxShadow: '0 25px 60px rgba(0,0,0,.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Nouveau mot de passe</div>
          <div style={{ fontSize: 13, color: C.textMid, marginTop: 4 }}>PICPUS — Plateforme CEE</div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#4ADE80', marginBottom: 6 }}>Mot de passe mis à jour !</div>
            <div style={{ fontSize: 13, color: C.textMid }}>Redirection en cours…</div>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background: '#450A0A', border: '1px solid #DC2626', borderRadius: 8, padding: '10px 14px', color: '#FCA5A5', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .4 }}>
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                style={{ width: '100%', boxSizing: 'border-box', background: '#0F172A', border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .4 }}>
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Répète le mot de passe"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{ width: '100%', boxSizing: 'border-box', background: '#0F172A', border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ width: '100%', padding: '13px', background: loading ? '#334155' : C.accent, border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {loading ? '⏳ Mise à jour…' : 'Enregistrer le mot de passe'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
