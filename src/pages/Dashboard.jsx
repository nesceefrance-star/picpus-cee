import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

const STATUTS = [
  { id: 'simulation',  label: 'Simulation',   color: '#7C3AED', bg: '#2E1065' },
  { id: 'prospect',    label: 'Prospect',      color: '#0369A1', bg: '#0C2D48' },
  { id: 'devis',       label: 'Devis envoyé',  color: '#D97706', bg: '#3D2000' },
  { id: 'ah',          label: 'AH en cours',   color: '#DC2626', bg: '#3D0000' },
  { id: 'conforme',    label: 'Conforme',      color: '#16A34A', bg: '#052e16' },
  { id: 'facture',     label: 'Facturé',       color: '#64748B', bg: '#1E293B' },
]

const C = {
  bg: '#0F172A', surface: '#1E293B', border: '#334155',
  text: '#F1F5F9', textMid: '#94A3B8', textSoft: '#475569',
  accent: '#2563EB', nav: '#0F172A',
}

function StatutBadge({ statut }) {
  const s = STATUTS.find(x => x.id === statut) || STATUTS[0]
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.color}44`,
      borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 700,
    }}>
      {s.label}
    </span>
  )
}

function NouveauDossierModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    nom_prospect: '', siren: '', adresse_site: '',
    fiche_cee: 'BAT-TH-142', contact_nom: '', contact_email: '',
  })
  const [loading, setLoading] = useState(false)
  const { createProspect, createDossier, user } = useStore()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    // Créer prospect
    const { data: prospect } = await createProspect({
      raison_sociale: form.nom_prospect,
      siren: form.siren,
      adresse: form.adresse_site,
      contact_nom: form.contact_nom,
      contact_email: form.contact_email,
    })
    // Créer dossier
    const { data: dossier } = await createDossier({
      prospect_id: prospect?.id,
      fiche_cee: form.fiche_cee,
      statut: 'simulation',
      assigne_a: user?.id,
      ref: `PICPUS-${Date.now().toString().slice(-6)}`,
    })
    setLoading(false)
    onCreate(dossier)
    onClose()
  }

  const Field = ({ label, name, type = 'text', placeholder }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
        {label}
      </label>
      <input
        type={type}
        value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: 7, padding: '9px 12px',
          color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
        }}
      />
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: '28px 32px', width: 500,
        boxShadow: '0 25px 50px rgba(0,0,0,.5)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 20 }}>
          ➕ Nouveau dossier
        </div>
        <form onSubmit={submit}>
          <Field label="Raison sociale" name="nom_prospect" placeholder="KIABI LOGISTIQUE" />
          <Field label="SIREN" name="siren" placeholder="347 727 950" />
          <Field label="Adresse du site" name="adresse_site" placeholder="771 Rue de la Plaine, 59553 Lauwin-Planque" />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
              Fiche CEE
            </label>
            <select
              value={form.fiche_cee}
              onChange={e => setForm(f => ({ ...f, fiche_cee: e.target.value }))}
              style={{
                width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 7, padding: '9px 12px', color: C.text,
                fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            >
              <option value="BAT-TH-142">BAT-TH-142 — Déstratification d'air</option>
              <option value="BAT-TH-116">BAT-TH-116 — Système GTB</option>
              <option value="IND-BA-110">IND-BA-110 — Déstratification industrie</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Contact" name="contact_nom" placeholder="Fabien Van De Ginste" />
            <Field label="Email contact" name="contact_email" type="email" placeholder="f.vandeginste@kiabi.fr" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '11px', background: 'transparent',
              border: `1px solid ${C.border}`, color: C.textMid,
              borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Annuler
            </button>
            <button type="submit" disabled={loading} style={{
              flex: 2, padding: '11px', background: C.accent,
              border: 'none', color: '#fff', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {loading ? 'Création…' : 'Créer le dossier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { dossiers, fetchDossiers, setCurrentDossier, user, signOut } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch]       = useState('')
  const [filtreStatut, setFiltreStatut] = useState('all')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetchDossiers().then(() => setLoading(false))
  }, [])

  const filtered = dossiers.filter(d => {
    const matchSearch = !search ||
      d.ref?.toLowerCase().includes(search.toLowerCase()) ||
      d.prospects?.raison_sociale?.toLowerCase().includes(search.toLowerCase())
    const matchStatut = filtreStatut === 'all' || d.statut === filtreStatut
    return matchSearch && matchStatut
  })

  const counts = STATUTS.reduce((acc, s) => {
    acc[s.id] = dossiers.filter(d => d.statut === s.id).length
    return acc
  }, {})

  const openDossier = (dossier) => {
    setCurrentDossier(dossier)
    navigate(`/dossier/${dossier.id}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      {/* Nav */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#60A5FA', letterSpacing: 2 }}>PICPUS</span>
          <span style={{ color: C.textSoft, fontSize: 13 }}>/ CRM CEE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {[
            { label: '🏠 Dashboard', path: '/' },
            { label: '🔧 Outils', path: '/hub' },
          ].map(item => (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              background: 'transparent', border: 'none', color: C.textMid,
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 8px',
            }}>
              {item.label}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: C.border }}/>
          <span style={{ fontSize: 13, color: C.textMid }}>{user?.email}</span>
          <button onClick={signOut} style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.textMid, borderRadius: 7, padding: '5px 12px',
            fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0, marginBottom: 4 }}>
              Pipeline CEE
            </h1>
            <p style={{ fontSize: 13, color: C.textMid, margin: 0 }}>
              {dossiers.length} dossier{dossiers.length > 1 ? 's' : ''} au total
            </p>
          </div>
          <button onClick={() => setShowModal(true)} style={{
            background: C.accent, color: '#fff', border: 'none',
            borderRadius: 9, padding: '11px 20px',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            ➕ Nouveau dossier
          </button>
        </div>

        {/* KPIs statuts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 24 }}>
          {STATUTS.map(s => (
            <div
              key={s.id}
              onClick={() => setFiltreStatut(filtreStatut === s.id ? 'all' : s.id)}
              style={{
                background: filtreStatut === s.id ? s.bg : C.surface,
                border: `1px solid ${filtreStatut === s.id ? s.color : C.border}`,
                borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{counts[s.id] || 0}</div>
              <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recherche */}
        <div style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un dossier, prospect…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 9, padding: '11px 16px',
              color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Liste dossiers */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.textMid }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '60px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              Aucun dossier
            </div>
            <div style={{ fontSize: 13, color: C.textMid }}>
              Créez votre premier dossier pour démarrer
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Header tableau */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '140px 1fr 160px 120px 120px 80px',
              gap: 12, padding: '8px 16px',
              fontSize: 11, fontWeight: 700, color: C.textSoft,
              textTransform: 'uppercase', letterSpacing: .4,
            }}>
              <span>Référence</span>
              <span>Prospect / Site</span>
              <span>Fiche CEE</span>
              <span>Statut</span>
              <span>Assigné</span>
              <span>Date</span>
            </div>
            {filtered.map(d => (
              <div
                key={d.id}
                onClick={() => openDossier(d)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr 160px 120px 120px 80px',
                  gap: 12, padding: '14px 16px',
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 10, cursor: 'pointer',
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#475569'}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: '#60A5FA', fontFamily: 'monospace' }}>
                  {d.ref}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                    {d.prospects?.raison_sociale || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>
                    {d.prospects?.adresse || '—'}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: C.textMid, alignSelf: 'center' }}>{d.fiche_cee}</span>
                <span style={{ alignSelf: 'center' }}><StatutBadge statut={d.statut} /></span>
                <span style={{ fontSize: 12, color: C.textMid, alignSelf: 'center' }}>
                  {d.assigne_a ? d.assigne_a.slice(0, 8) + '…' : '—'}
                </span>
                <span style={{ fontSize: 11, color: C.textSoft, alignSelf: 'center' }}>
                  {new Date(d.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <NouveauDossierModal
          onClose={() => setShowModal(false)}
          onCreate={(d) => d && openDossier(d)}
        />
      )}
    </div>
  )
}
