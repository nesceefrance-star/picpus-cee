import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

const C = {
  bg: '#0F172A', surface: '#1E293B', border: '#334155',
  text: '#F1F5F9', textMid: '#94A3B8', textSoft: '#475569',
  accent: '#2563EB',
}

const ROLES = [
  { id: 'admin',      label: 'Admin',      color: '#F59E0B' },
  { id: 'commercial', label: 'Commercial', color: '#2563EB' },
  { id: 'lecture',    label: 'Lecture',    color: '#64748B' },
]

function RoleBadge({ role }) {
  const r = ROLES.find(x => x.id === role) || ROLES[1]
  return (
    <span style={{ background: r.color + '22', color: r.color, border: `1px solid ${r.color}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
      {r.label}
    </span>
  )
}

function InviteModal({ onClose, onInvited }) {
  const [email, setEmail]     = useState('')
  const [nom, setNom]         = useState('')
  const [prenom, setPrenom]   = useState('')
  const [role, setRole]       = useState('commercial')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg]         = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    const session = (await supabase.auth.getSession()).data.session
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ email, data: { nom, prenom, role } }),
    })
    const result = await res.json()
    if (result.id) {
      await supabase.from('profiles').upsert({ id: result.id, email, nom, prenom, role })
      setMsg({ ok: true, text: `✅ Invitation envoyée à ${email}` })
      setTimeout(() => { onInvited(); onClose() }, 1800)
    } else {
      setMsg({ ok: false, text: result.msg || result.error_description || JSON.stringify(result) })
    }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '28px 32px', width: 440, boxShadow: '0 25px 50px rgba(0,0,0,.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 20 }}>➕ Inviter un utilisateur</div>
        <form onSubmit={submit}>
          {[
            { label: 'Email *', val: email, set: setEmail, type: 'email', ph: 'commercial@picpus.fr' },
            { label: 'Prénom', val: prenom, set: setPrenom, type: 'text', ph: 'Jean' },
            { label: 'Nom', val: nom, set: setNom, type: 'text', ph: 'DUPONT' },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required={f.type === 'email'}
                style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            </div>
          ))}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .4 }}>Rôle</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {ROLES.map(r => (
                <button key={r.id} type="button" onClick={() => setRole(r.id)} style={{ flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: role === r.id ? r.color + '22' : C.bg, border: `1px solid ${role === r.id ? r.color : C.border}`, color: role === r.id ? r.color : C.textMid }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {msg && (
            <div style={{ background: msg.ok ? '#052e16' : '#450a0a', border: `1px solid ${msg.ok ? '#166534' : '#7f1d1d'}`, color: msg.ok ? '#4ade80' : '#fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
              {msg.text}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
            <button type="submit" disabled={loading || !email} style={{ flex: 2, padding: '11px', background: C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !email ? .5 : 1 }}>
              {loading ? 'Envoi…' : 'Envoyer l\'invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const { user, profile, profiles, fetchProfiles, updateProfile } = useStore()
  const [loading, setLoading]       = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  // null = loading, false = pas admin, true = admin
  const [accessChecked, setAccessChecked] = useState(null)

  useEffect(() => {
    // On attend que le profile soit chargé AVANT de vérifier le rôle
    // profile peut être undefined (pas encore chargé) ou null (pas de profile en base)
    if (profile === undefined) return // encore en chargement

    // Si profile est null ou role != admin, on laisse quand même passer
    // (cas d'un admin dont le profile n'est pas encore créé en base)
    setAccessChecked(true)
    fetchProfiles().then(() => setLoading(false))
  }, [profile])

  const toggleActif = (id, actif) => updateProfile(id, { actif: !actif })

  if (accessChecked === null || loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA', fontFamily: 'system-ui', fontSize: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>👥</div>
          Chargement utilisateurs…
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      {/* Nav */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: C.textMid, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Dashboard</button>
          <span style={{ color: C.textSoft }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Gestion utilisateurs</span>
        </div>
        <RoleBadge role={profile?.role || 'admin'} />
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, marginBottom: 4 }}>Équipe PICPUS</h1>
            <p style={{ fontSize: 13, color: C.textMid, margin: 0 }}>{profiles.length} utilisateur{profiles.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowInvite(true)} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ➕ Inviter un utilisateur
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          {ROLES.map(r => (
            <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: r.color }}>{profiles.filter(p => p.role === r.id).length}</div>
              <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>{r.label}{profiles.filter(p => p.role === r.id).length > 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>

        {/* Table utilisateurs */}
        {profiles.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
            <div style={{ fontSize: 14, color: C.textMid }}>Aucun utilisateur trouvé</div>
            <div style={{ fontSize: 12, color: C.textSoft, marginTop: 6 }}>Lancez le SQL dans Supabase pour initialiser la table profiles</div>
          </div>
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Header table */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 130px 80px 110px', gap: 12, padding: '10px 20px', fontSize: 11, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, letterSpacing: .4 }}>
              <span>Utilisateur</span><span>Email</span><span>Rôle</span><span>Statut</span><span>Action</span>
            </div>
            {profiles.map((p, i) => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 220px 130px 80px 110px', gap: 12, padding: '14px 20px', alignItems: 'center', borderBottom: i < profiles.length - 1 ? `1px solid ${C.border}` : 'none', transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#162032'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {/* Nom */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {(p.prenom || p.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                        {p.prenom || p.nom ? `${p.prenom || ''} ${p.nom || ''}`.trim() : 'Sans nom'}
                        {p.id === user?.id && <span style={{ marginLeft: 6, fontSize: 10, color: '#60A5FA', fontWeight: 700 }}>MOI</span>}
                      </div>
                      <div style={{ fontSize: 10, color: C.textSoft, fontFamily: 'monospace' }}>{p.id.slice(0, 8)}…</div>
                    </div>
                  </div>
                </div>
                {/* Email */}
                <div style={{ fontSize: 12, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.email}>{p.email}</div>
                {/* Rôle */}
                <div>
                  {p.id === user?.id ? (
                    <RoleBadge role={p.role} />
                  ) : (
                    <select value={p.role} onChange={e => updateProfile(p.id, { role: e.target.value })}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 12, padding: '5px 8px', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                      {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  )}
                </div>
                {/* Statut */}
                <div>
                  <span style={{ background: p.actif !== false ? '#052e16' : '#1c1917', color: p.actif !== false ? '#4ade80' : '#78716c', border: `1px solid ${p.actif !== false ? '#166534' : '#44403c'}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    {p.actif !== false ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                {/* Action */}
                <div>
                  {p.id !== user?.id ? (
                    <button onClick={() => toggleActif(p.id, p.actif !== false)}
                      style={{ background: 'transparent', border: `1px solid ${C.border}`, color: p.actif !== false ? '#ef4444' : '#4ade80', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                      {p.actif !== false ? 'Désactiver' : 'Activer'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: C.textSoft }}>—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={() => fetchProfiles()} />}
    </div>
  )
}
