import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

const STATUTS = [
  { id: 'simulation',  label: 'Simulation',   color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'prospect',    label: 'Prospect',      color: '#0369A1', bg: '#DBEAFE' },
  { id: 'devis',       label: 'Devis envoyé',  color: '#D97706', bg: '#FEF3C7' },
  { id: 'ah',          label: 'AH en cours',   color: '#DC2626', bg: '#FEE2E2' },
  { id: 'conforme',    label: 'Conforme',      color: '#16A34A', bg: '#DCFCE7' },
  { id: 'facture',     label: 'Factuté',       color: '#64748B', bg: '#F1F5F9' },
]

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB', nav: '#1E293B',
}

const INP = {
  width: '100%', boxSizing: 'border-box',
  background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 7, padding: '9px 12px',
  color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
const LBL = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: C.textMid, marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: .4,
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

// ── Autocomplete Pappers (SIREN → raison sociale) ─────────────────────────
function SirenField({ value, onChange, onCompanyFound }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const timer = useRef(null)

  const search = useCallback(async (q) => {
    if (q.length < 3) { setSuggestions([]); return }
    try {
      const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=5`)
      const d = await r.json()
      setSuggestions((d.results || []).map(e => ({
        siren: e.siren,
        nom: e.nom_complet || e.nom_raison_sociale || '',
        adresse: e.siege?.adresse_complete || '',
      })))
      setOpen(true)
    } catch { setSuggestions([]) }
  }, [])

  const handleChange = (v) => {
    onChange(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => search(v), 350)
  }

  const pick = (s) => {
    onChange(s.siren)
    onCompanyFound(s.nom, s.adresse)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <label style={LBL}>SIREN — Recherche entreprise</label>
      <input
        type="text" value={value}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="SIREN ou nom d'entreprise"
        style={INP}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden',
        }}>
          {suggestions.map(s => (
            <div key={s.siren} onMouseDown={() => pick(s)} style={{
              padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`,
              fontSize: 13,
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.bg}
            onMouseLeave={e => e.currentTarget.style.background = C.surface}>
              <div style={{ fontWeight: 600, color: C.text }}>{s.nom}</div>
              <div style={{ fontSize: 11, color: C.textMid }}>{s.siren} {s.adresse ? '· ' + s.adresse : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Autocomplete adresse (API Adresse gouv.fr) ────────────────────────────
function AdresseField({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const timer = useRef(null)

  const search = useCallback(async (q) => {
    if (q.length < 4) { setSuggestions([]); return }
    try {
      const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`)
      const d = await r.json()
      setSuggestions((d.features || []).map(f => f.properties.label))
      setOpen(true)
    } catch { setSuggestions([]) }
  }, [])

  const handleChange = (v) => {
    onChange(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => search(v), 300)
  }

  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <label style={LBL}>Adresse du site</label>
      <input
        type="text" value={value}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="771 Rue de la Plaine, 59553 Lauwin-Planque"
        style={INP}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => (
            <div key={i} onMouseDown={() => { onChange(s); setSuggestions([]); setOpen(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg}
              onMouseLeave={e => e.currentTarget.style.background = C.surface}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal nouveau dossier ─────────────────────────────────────────────────
function NouveauDossierModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    nom_prospect: '', siren: '', adresse_site: '',
    fiche_cee: 'BAT-TH-142', contact_nom: '', contact_email: '',
  })
  const [loading, setLoading] = useState(false)
  const { createProspect, createDossier, user } = useStore()

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.nom_prospect) return
    setLoading(true)
    const { data: prospect } = await createProspect({
      raison_sociale: form.nom_prospect,
      siren: form.siren,
      adresse: form.adresse_site,
      contact_nom: form.contact_nom,
      contact_email: form.contact_email,
    })
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

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: '28px 32px', width: 520,
        boxShadow: '0 25px 50px rgba(0,0,0,.2)', maxHeight: '90vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 20 }}>
          ➕ Nouveau dossier
        </div>

        {/* Raison sociale */}
        <div style={{ marginBottom: 14 }}>
          <label style={LBL}>Raison sociale</label>
          <input value={form.nom_prospect} onChange={e => set('nom_prospect')(e.target.value)}
            placeholder="KIABI LOGISTIQUE" style={INP} autoComplete="organization"/>
        </div>

        {/* SIREN avec autocomplete API gouv */}
        <SirenField
          value={form.siren}
          onChange={set('siren')}
          onCompanyFound={(nom, adr) => setForm(f => ({
            ...f,
            nom_prospect: nom || f.nom_prospect,
            adresse_site: adr || f.adresse_site,
          }))}
        />

        {/* Adresse avec autocomplete */}
        <AdresseField value={form.adresse_site} onChange={set('adresse_site')} />

        {/* Fiche CEE */}
        <div style={{ marginBottom: 14 }}>
          <label style={LBL}>Fiche CEE</label>
          <select value={form.fiche_cee} onChange={e => set('fiche_cee')(e.target.value)}
            style={{ ...INP, appearance: 'auto' }}>
            <option value="BAT-TH-142">BAT-TH-142 — Déstratification d'air</option>
            <option value="BAT-TH-116">BAT-TH-116 — Système GTB</option>
            <option value="IND-BA-110">IND-BA-110 — Déstratification industrie</option>
          </select>
        </div>

        {/* Contact */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={LBL}>Contact</label>
            <input value={form.contact_nom} onChange={e => set('contact_nom')(e.target.value)}
              placeholder="Fabien Van De Ginste" style={INP}/>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={LBL}>Email contact</label>
            <input type="email" value={form.contact_email} onChange={e => set('contact_email')(e.target.value)}
              placeholder="f.vandeginste@kiabi.fr" style={INP}/>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', background: 'transparent',
            border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>Annuler</button>
          <button onClick={submit} disabled={loading} style={{
            flex: 2, padding: '11px', background: C.accent,
            border: 'none', color: '#fff', borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {loading ? 'Création…' : 'Créer le dossier'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { dossiers, fetchDossiers, setCurrentDossier, user, profile, signOut } = useStore()
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

  const isAdmin = profile?.role === 'admin'

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      {/* Nav */}
      <div style={{
        background: C.nav, borderBottom: `1px solid #334155`,
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#60A5FA', letterSpacing: 2 }}>PICPUS</span>
          <span style={{ color: '#64748B', fontSize: 13 }}>/ CRM CEE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate('/')} style={{
            background: 'transparent', border: 'none', color: '#94A3B8',
            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '5px 10px', borderRadius: 6,
          }}>🏠 Dashboard</button>
          <button onClick={() => navigate('/hub')} style={{
            background: 'transparent', border: 'none', color: '#94A3B8',
            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '5px 10px', borderRadius: 6,
          }}>🔧 Outils Hub</button>
          {isAdmin && (
            <button onClick={() => navigate('/admin/users')} style={{
              background: '#1D4ED822', border: '1px solid #2563EB66', color: '#60A5FA',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              padding: '5px 12px', borderRadius: 6,
            }}>👥 Utilisateurs</button>
          )}
          <div style={{ width: 1, height: 20, background: '#334155', margin: '0 4px' }}/>
          <span style={{ fontSize: 12, color: '#64748B' }}>{user?.email}</span>
          <button onClick={signOut} style={{
            background: 'transparent', border: `1px solid #334155`,
            color: '#94A3B8', borderRadius: 7, padding: '5px 12px',
            fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>Déco</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
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
            <div key={s.id}
              onClick={() => setFiltreStatut(filtreStatut === s.id ? 'all' : s.id)}
              style={{
                background: filtreStatut === s.id ? s.bg : C.surface,
                border: `1px solid ${filtreStatut === s.id ? s.color : C.border}`,
                borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all .15s',
              }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{counts[s.id] || 0}</div>
              <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recherche */}
        <div style={{ marginBottom: 16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un dossier, prospect…"
            style={{ ...INP, fontSize: 14, padding: '11px 16px', borderRadius: 9 }}/>
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
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>Aucun dossier</div>
            <div style={{ fontSize: 13, color: C.textMid }}>Créez votre premier dossier pour démarrer</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '140px 1fr 160px 120px 120px 80px',
              gap: 12, padding: '8px 16px',
              fontSize: 11, fontWeight: 700, color: C.textSoft,
              textTransform: 'uppercase', letterSpacing: .4,
            }}>
              <span>Référence</span><span>Prospect / Site</span>
              <span>Fiche CEE</span><span>Statut</span>
              <span>Assigné</span><span>Date</span>
            </div>
            {filtered.map(d => (
              <div key={d.id} onClick={() => openDossier(d)}
                style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr 160px 120px 120px 80px',
                  gap: 12, padding: '14px 16px',
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 10, cursor: 'pointer', transition: 'border-color .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>{d.ref}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{d.prospects?.raison_sociale || '—'}</div>
                  <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>{d.prospects?.adresse || '—'}</div>
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
