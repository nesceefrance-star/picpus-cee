import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

const C = {
  bg: '#0F172A', surface: '#1E293B', border: '#334155',
  text: '#F1F5F9', textMid: '#94A3B8', textSoft: '#475569',
  accent: '#2563EB',
}

const ROLES = [
  { id: 'admin',      label: 'Admin',      color: '#F59E0B', desc: 'Voit tous les dossiers, gère l\'équipe' },
  { id: 'commercial', label: 'Commercial', color: '#2563EB', desc: 'Voit uniquement ses propres dossiers' },
]

function RoleBadge({ role }) {
  const r = ROLES.find(x => x.id === role) || ROLES[1]
  return (
    <span style={{ background: r.color + '22', color: r.color, border: `1px solid ${r.color}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
      {r.label}
    </span>
  )
}

// Modal pour modifier le profil d'un user existant
function EditProfileModal({ profile, onClose, onSave }) {
  const [nom, setNom]     = useState(profile.nom || '')
  const [prenom, setPrenom] = useState(profile.prenom || '')
  const [role, setRole]   = useState(profile.role || 'commercial')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await onSave(profile.id, { nom, prenom, role })
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '28px 32px', width: 420, boxShadow: '0 25px 50px rgba(0,0,0,.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>Modifier le profil</div>
        <div style={{ fontSize: 12, color: C.textMid, marginBottom: 20 }}>{profile.email}</div>

        {[
          { label: 'Prénom', val: prenom, set: setPrenom, ph: 'Jean' },
          { label: 'Nom', val: nom, set: setNom, ph: 'DUPONT' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>{f.label}</label>
            <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
              style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          </div>
        ))}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .4 }}>Rôle & droits d'accès</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ROLES.map(r => (
              <button key={r.id} type="button" onClick={() => setRole(r.id)} style={{
                padding: '12px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                background: role === r.id ? r.color + '15' : C.bg,
                border: `1px solid ${role === r.id ? r.color : C.border}`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${role === r.id ? r.color : C.border}`, background: role === r.id ? r.color : 'transparent', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: role === r.id ? r.color : C.text }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }}>{r.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', background: C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Panneau d'aide pour créer un user depuis Supabase
function InviteHelpModal({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '28px 32px', width: 500, boxShadow: '0 25px 50px rgba(0,0,0,.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 6 }}>➕ Ajouter un utilisateur</div>
        <div style={{ fontSize: 12, color: C.textMid, marginBottom: 20 }}>
          L'ajout d'utilisateurs se fait en 2 étapes simples depuis Supabase.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {[
            {
              n: '1', title: 'Créer le compte dans Supabase',
              desc: 'Allez dans Authentication → Users → "Add user" → renseignez email + mot de passe temporaire.',
              link: 'https://supabase.com/dashboard/project/lgqscucrmsakifbqmkag/auth/users',
              linkLabel: 'Ouvrir Supabase Auth →',
            },
            {
              n: '2', title: 'Le profil se crée automatiquement',
              desc: 'Dès que l\'utilisateur est créé, son profil apparaît ici. Revenez sur cette page et définissez son rôle (Admin ou Commercial).',
            },
            {
              n: '3', title: 'L\'utilisateur reçoit ses accès',
              desc: 'Transmettez-lui l\'URL du CRM + ses identifiants. Il pourra modifier son mot de passe depuis son profil.',
            },
          ].map(step => (
            <div key={step.n} style={{ display: 'flex', gap: 14, background: C.bg, borderRadius: 10, padding: '14px 16px', border: `1px solid ${C.border}` }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{step.n}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{step.title}</div>
                <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.5 }}>{step.desc}</div>
                {step.link && (
                  <a href={step.link} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 700, color: '#60A5FA', textDecoration: 'none' }}>
                    {step.linkLabel}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{ width: '100%', padding: '11px', background: C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Compris
        </button>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const { user, profile, profiles, fetchProfiles, updateProfile } = useStore()
  const [loading, setLoading]       = useState(true)
  const [showHelp, setShowHelp]     = useState(false)
  const [editProfile, setEditProfile] = useState(null)

  useEffect(() => {
    fetchProfiles().then(() => setLoading(false))
  }, [])

  const handleToggleActif = (id, actif) => updateProfile(id, { actif: !actif })

  const handleSaveProfile = async (id, updates) => {
    await updateProfile(id, updates)
    await fetchProfiles()
  }

  const admins      = profiles.filter(p => p.role === 'admin')
  const commerciaux = profiles.filter(p => p.role === 'commercial')

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

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, marginBottom: 4 }}>Équipe PICPUS</h1>
            <p style={{ fontSize: 13, color: C.textMid, margin: 0 }}>
              {profiles.length} utilisateur{profiles.length > 1 ? 's' : ''} · {admins.length} admin{admins.length > 1 ? 's' : ''} · {commerciaux.length} commercial{commerciaux.length > 1 ? 'x' : ''}
            </p>
          </div>
          <button onClick={() => setShowHelp(true)} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
            ➕ Ajouter un utilisateur
          </button>
        </div>

        {/* Explication des droits */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {ROLES.map(r => (
            <div key={r.id} style={{ background: C.surface, border: `1px solid ${r.color}33`, borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{profiles.filter(p => p.role === r.id).length}</span>
                <RoleBadge role={r.id} />
              </div>
              <div style={{ fontSize: 11, color: C.textSoft }}>{r.desc}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: C.textMid }}>Chargement…</div>
        ) : profiles.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '50px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>Aucun profil trouvé</div>
            <div style={{ fontSize: 12, color: C.textSoft }}>Les profils se créent automatiquement quand un utilisateur se connecte pour la première fois.</div>
          </div>
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 110px 80px 120px', gap: 12, padding: '10px 20px', fontSize: 11, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .4, borderBottom: `1px solid ${C.border}` }}>
              <span>Utilisateur</span><span>Email</span><span>Rôle</span><span>Statut</span><span>Actions</span>
            </div>

            {profiles.map((p, i) => (
              <div key={p.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 200px 110px 80px 120px', gap: 12, padding: '13px 20px', alignItems: 'center', borderBottom: i < profiles.length - 1 ? `1px solid ${C.border}` : 'none', transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#0d1a2b'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Avatar + nom */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: p.role === 'admin' ? '#F59E0B33' : '#2563EB33', border: `1px solid ${p.role === 'admin' ? '#F59E0B55' : '#2563EB55'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: p.role === 'admin' ? '#F59E0B' : '#60A5FA', flexShrink: 0 }}>
                    {(p.prenom || p.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.prenom || p.nom ? `${p.prenom || ''} ${p.nom || ''}`.trim() : <span style={{ color: C.textSoft, fontStyle: 'italic' }}>Sans nom</span>}
                      {p.id === user?.id && <span style={{ fontSize: 9, background: '#1e3a5f', color: '#60A5FA', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>MOI</span>}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div style={{ fontSize: 11, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.email}>{p.email}</div>

                {/* Rôle (select si pas soi-même) */}
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

                {/* Statut actif */}
                <div>
                  <span style={{
                    background: p.actif !== false ? '#052e16' : '#1c1917',
                    color: p.actif !== false ? '#4ade80' : '#78716c',
                    border: `1px solid ${p.actif !== false ? '#166534' : '#44403c'}`,
                    borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700,
                  }}>
                    {p.actif !== false ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditProfile(p)}
                    style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '5px 0', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✏️ Modifier
                  </button>
                  {p.id !== user?.id && (
                    <button onClick={() => handleToggleActif(p.id, p.actif !== false)}
                      style={{ background: 'transparent', border: `1px solid ${p.actif !== false ? '#450a0a' : '#166534'}`, color: p.actif !== false ? '#ef4444' : '#4ade80', borderRadius: 6, padding: '5px 7px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {p.actif !== false ? '🚫' : '✅'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info supplémentaire */}
        <div style={{ marginTop: 16, background: '#0a1a2e', border: '1px solid #1e3a5f', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#60A5FA' }}>
          💡 <strong>Astuce :</strong> Pour ajouter un utilisateur, créez-le d'abord dans{' '}
          <a href="https://supabase.com/dashboard/project/lgqscucrmsakifbqmkag/auth/users" target="_blank" rel="noreferrer" style={{ color: '#93c5fd', fontWeight: 700 }}>
            Supabase Auth
          </a>
          {' '}puis revenez ici pour lui attribuer son rôle. Le profil se crée automatiquement à la première connexion.
        </div>
      </div>

      {showHelp   && <InviteHelpModal onClose={() => setShowHelp(false)} />}
      {editProfile && <EditProfileModal profile={editProfile} onClose={() => setEditProfile(null)} onSave={handleSaveProfile} />}
    </div>
  )
}
