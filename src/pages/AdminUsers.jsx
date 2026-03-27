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

const AVATAR_EMOJIS = ['👤', '👨', '👩', '🧑', '👨‍💼', '👩‍💼', '🧑‍💼', '👷', '👷‍♀️', '🧑‍💻', '⭐', '🚀', '💼', '🔧', '⚡', '🌟']

function RoleBadge({ role }) {
  const r = ROLES.find(x => x.id === role) || ROLES[1]
  return (
    <span style={{ background: r.color + '22', color: r.color, border: `1px solid ${r.color}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
      {r.label}
    </span>
  )
}

function AvatarCircle({ profile, size = 34 }) {
  const roleColor = profile.role === 'admin' ? '#F59E0B' : '#2563EB'
  if (profile.avatar_emoji) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: roleColor + '22', border: `1px solid ${roleColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, flexShrink: 0 }}>
        {profile.avatar_emoji}
      </div>
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: roleColor + '22', border: `1px solid ${roleColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: roleColor, flexShrink: 0 }}>
      {(profile.prenom || profile.email || '?')[0].toUpperCase()}
    </div>
  )
}

function EditProfileModal({ profile, currentUserId, onClose, onSave, onDelete, onUpdateEmail, onResetPassword }) {
  const [nom, setNom]         = useState(profile.nom || '')
  const [prenom, setPrenom]   = useState(profile.prenom || '')
  const [role, setRole]       = useState(profile.role || 'commercial')
  const [avatar, setAvatar]   = useState(profile.avatar_emoji || '')
  const [email, setEmail]     = useState(profile.email || '')
  const [saving, setSaving]           = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [resetting, setResetting]     = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [resetSent, setResetSent]     = useState(false)
  const [msg, setMsg]                 = useState(null)

  const isSelf = profile.id === currentUserId

  const inputStyle = { width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await onSave(profile.id, { nom, prenom, role, avatar_emoji: avatar })
      onClose()
    } catch (e) {
      setMsg({ type: 'err', text: e.message })
      setSaving(false)
    }
  }

  const saveEmail = async () => {
    const trimmed = email.trim()
    if (!trimmed || trimmed === profile.email) return
    setSavingEmail(true)
    setMsg(null)
    try {
      await onUpdateEmail(profile.id, trimmed)
      setMsg({ type: 'ok', text: 'Email mis à jour.' })
    } catch (e) {
      setMsg({ type: 'err', text: e.message })
    }
    setSavingEmail(false)
  }

  const resetPwd = async () => {
    setResetting(true)
    setMsg(null)
    const { error } = await onResetPassword(profile.email)
    if (error) {
      setMsg({ type: 'err', text: error.message })
    } else {
      setResetSent(true)
      setMsg({ type: 'ok', text: `Lien de réinitialisation envoyé à ${profile.email}` })
    }
    setResetting(false)
  }

  const doDelete = async () => {
    setDeleting(true)
    setMsg(null)
    try {
      await onDelete(profile.id)
      onClose()
    } catch (e) {
      setMsg({ type: 'err', text: e.message })
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '28px 32px', width: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,.5)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>Modifier le profil</div>
        <div style={{ fontSize: 12, color: C.textMid, marginBottom: 20 }}>{profile.email}</div>

        {/* Feedback message */}
        {msg && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 12, background: msg.type === 'ok' ? '#052e16' : '#450a0a', color: msg.type === 'ok' ? '#4ade80' : '#f87171', border: `1px solid ${msg.type === 'ok' ? '#166534' : '#7f1d1d'}` }}>
            {msg.text}
          </div>
        )}

        {/* ── Avatar ── */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Avatar</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {/* Option initiales */}
            <button type="button" onClick={() => setAvatar('')} style={{
              width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
              border: `2px ${avatar === '' ? 'solid' : 'dashed'} ${avatar === '' ? C.accent : C.border}`,
              background: avatar === '' ? C.accent + '22' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: avatar === '' ? C.accent : C.textSoft,
              fontFamily: 'inherit',
            }}>
              {(prenom || profile.email || '?')[0].toUpperCase()}
            </button>
            {AVATAR_EMOJIS.map(em => (
              <button key={em} type="button" onClick={() => setAvatar(em)} style={{
                width: 38, height: 38, borderRadius: 8, cursor: 'pointer', fontSize: 20,
                border: `2px solid ${avatar === em ? C.accent : C.border}`,
                background: avatar === em ? C.accent + '22' : C.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'inherit',
              }}>
                {em}
              </button>
            ))}
          </div>
        </div>

        {/* ── Nom / Prénom ── */}
        {[
          { label: 'Prénom', val: prenom, set: setPrenom, ph: 'Jean' },
          { label: 'Nom',    val: nom,    set: setNom,    ph: 'DUPONT' },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{f.label}</label>
            <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} style={inputStyle} />
          </div>
        ))}

        {/* ── Rôle ── */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Rôle & droits d'accès</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ROLES.map(r => (
              <button key={r.id} type="button" onClick={() => !isSelf && setRole(r.id)} disabled={isSelf} style={{
                padding: '12px 14px', borderRadius: 8, cursor: isSelf ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left',
                background: role === r.id ? r.color + '15' : C.bg,
                border: `1px solid ${role === r.id ? r.color : C.border}`,
                display: 'flex', alignItems: 'center', gap: 12, opacity: isSelf ? .5 : 1,
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

        {/* ── Boutons enregistrer ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '11px', background: C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </button>
        </div>

        {/* ── Séparateur ── */}
        <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 20 }} />

        {/* ── Email ── */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Adresse email</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              style={{ ...inputStyle, flex: 1, width: 'auto' }} />
            <button onClick={saveEmail} disabled={savingEmail || email.trim() === profile.email}
              style={{ padding: '9px 16px', background: C.accent, border: 'none', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: email.trim() === profile.email ? .4 : 1, whiteSpace: 'nowrap' }}>
              {savingEmail ? '…' : 'Changer'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.textSoft, marginTop: 5 }}>
            Nécessite VITE_SUPABASE_SERVICE_KEY pour mettre à jour l'authentification.
          </div>
        </div>

        {/* ── Reset mot de passe ── */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Mot de passe</label>
          <button onClick={resetPwd} disabled={resetting || resetSent}
            style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: `1px solid ${resetSent ? '#166534' : C.border}`, color: resetSent ? '#4ade80' : C.textMid, borderRadius: 8, fontSize: 12, cursor: resetSent ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            {resetSent ? '✅ Lien envoyé' : resetting ? 'Envoi…' : '🔑 Envoyer un lien de réinitialisation par email'}
          </button>
        </div>

        {/* ── Zone dangereuse (pas pour soi-même) ── */}
        {!isSelf && (
          <>
            <div style={{ borderTop: '1px solid #7f1d1d55', marginBottom: 14 }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Zone dangereuse</div>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid #7f1d1d', color: '#ef4444', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                🗑️ Supprimer cet utilisateur
              </button>
            ) : (
              <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5', marginBottom: 6 }}>Confirmer la suppression ?</div>
                <div style={{ fontSize: 12, color: '#f87171', marginBottom: 14, lineHeight: 1.5 }}>
                  Cette action est <strong>irréversible</strong>. Le compte de <strong>{profile.prenom || profile.nom || profile.email}</strong> sera définitivement supprimé.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)}
                    style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Annuler
                  </button>
                  <button onClick={doDelete} disabled={deleting}
                    style={{ flex: 2, padding: '9px', background: '#dc2626', border: 'none', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {deleting ? 'Suppression…' : 'Oui, supprimer'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
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
  const { user, profile, profiles, fetchProfiles, updateProfile, deleteUser, updateUserEmail, resetUserPassword } = useStore()
  const [loading, setLoading]         = useState(true)
  const [showHelp, setShowHelp]       = useState(false)
  const [editProfile, setEditProfile] = useState(null)

  useEffect(() => {
    fetchProfiles().then(() => setLoading(false))
  }, [])

  const handleToggleActif = (id, actif) => updateProfile(id, { actif: !actif })

  const handleSaveProfile = async (id, updates) => {
    await updateProfile(id, updates)
    await fetchProfiles()
  }

  const handleDelete = async (id) => {
    await deleteUser(id)
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
                  <AvatarCircle profile={p} size={34} />
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

      {showHelp    && <InviteHelpModal onClose={() => setShowHelp(false)} />}
      {editProfile && (
        <EditProfileModal
          profile={editProfile}
          currentUserId={user?.id}
          onClose={() => setEditProfile(null)}
          onSave={handleSaveProfile}
          onDelete={handleDelete}
          onUpdateEmail={updateUserEmail}
          onResetPassword={resetUserPassword}
        />
      )}
    </div>
  )
}
