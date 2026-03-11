import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import NouveauDossierWizard from '../components/NouveauDossierWizard'

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
  accent: '#2563EB',
}

function StatutBadge({ statut }) {
  const s = STATUTS.find(x => x.id === statut) || STATUTS[0]
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { dossiers, fetchDossiers, fetchProfiles, setCurrentDossier, user, profile, profiles, signOut } = useStore()
  const [showWizard, setShowWizard]     = useState(false)
  const [search, setSearch]             = useState('')
  const [filtreStatut, setFiltreStatut] = useState('all')
  const [filtreCommercial, setFiltreCommercial] = useState('all')
  const [loading, setLoading]           = useState(true)

  // Admin si role=admin OU si pas encore de profile (fallback sécurisé)
  const isAdmin = profile?.role === 'admin' || profile?.role === undefined

  useEffect(() => {
    Promise.all([fetchDossiers(), fetchProfiles()]).then(() => setLoading(false))
  }, [])

  const filtered = dossiers.filter(d => {
    const matchSearch = !search ||
      d.ref?.toLowerCase().includes(search.toLowerCase()) ||
      d.prospects?.raison_sociale?.toLowerCase().includes(search.toLowerCase()) ||
      d.prospects?.ville?.toLowerCase().includes(search.toLowerCase())
    const matchStatut = filtreStatut === 'all' || d.statut === filtreStatut
    const matchCommercial = filtreCommercial === 'all' || d.assigne_a === filtreCommercial
    return matchSearch && matchStatut && matchCommercial
  })

  const counts = STATUTS.reduce((acc, s) => {
    acc[s.id] = dossiers.filter(d => d.statut === s.id).length
    return acc
  }, {})

  const commerciaux = profiles.filter(p => ['admin', 'commercial'].includes(p.role))

  const openDossier = (dossier) => {
    setCurrentDossier(dossier)
    navigate(`/dossier/${dossier.id}`)
  }

  const totalPrimes = dossiers
    .filter(d => d.prime_estimee)
    .reduce((acc, d) => acc + (d.prime_estimee || 0), 0)

  const totalMarges = dossiers
    .filter(d => d.montant_devis && d.prime_estimee)
    .reduce((acc, d) => acc + ((d.prime_estimee || 0) - (d.montant_devis || 0)), 0)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      {/* ── Navbar ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#60A5FA', letterSpacing: 2 }}>PICPUS</span>
          <span style={{ color: C.textSoft, fontSize: 13 }}>CRM CEE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Bouton Outils */}
          <button onClick={() => navigate('/hub')}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 7, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            🔧 Outils Hub
          </button>

          {/* Bouton Gestion utilisateurs — toujours visible, admin uniquement en prod */}
          <button onClick={() => navigate('/admin/users')}
            style={{ background: '#F59E0B22', border: '1px solid #F59E0B55', color: '#F59E0B', borderRadius: 7, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            👥 Utilisateurs
          </button>

          {/* Infos user */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
              {(profile?.prenom || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>
                {profile?.prenom ? `${profile.prenom} ${profile.nom || ''}`.trim() : user?.email?.split('@')[0]}
              </div>
              <div style={{ fontSize: 10, color: profile?.role === 'admin' ? '#F59E0B' : '#60A5FA', fontWeight: 700 }}>
                {(profile?.role || 'admin').toUpperCase()}
              </div>
            </div>
          </div>

          <button onClick={signOut}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Déco
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1340, margin: '0 auto', padding: '24px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, marginBottom: 4 }}>Pipeline CEE</h1>
            <p style={{ fontSize: 13, color: C.textMid, margin: 0 }}>
              {dossiers.length} dossier{dossiers.length > 1 ? 's' : ''}
              {totalPrimes > 0 && <> · Primes estimées <strong style={{ color: '#a78bfa' }}>{totalPrimes.toLocaleString('fr')} €</strong></>}
              {totalMarges !== 0 && <> · Marge totale <strong style={{ color: totalMarges > 0 ? '#4ade80' : '#ef4444' }}>{totalMarges.toLocaleString('fr')} €</strong></>}
            </p>
          </div>
          <button onClick={() => setShowWizard(true)}
            style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
            ➕ Nouveau dossier
          </button>
        </div>

        {/* ── KPIs statuts ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 20 }}>
          {STATUTS.map(s => (
            <div key={s.id} onClick={() => setFiltreStatut(filtreStatut === s.id ? 'all' : s.id)}
              style={{ background: filtreStatut === s.id ? s.bg : C.surface, border: `2px solid ${filtreStatut === s.id ? s.color : C.border}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{counts[s.id] || 0}</div>
              <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filtres ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍  Rechercher prospect, référence, ville…"
            style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 16px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          />
          {commerciaux.length > 1 && (
            <select value={filtreCommercial} onChange={e => setFiltreCommercial(e.target.value)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', minWidth: 200 }}>
              <option value="all">Tous les commerciaux</option>
              {commerciaux.map(p => (
                <option key={p.id} value={p.id}>{p.prenom || ''} {p.nom || p.email}</option>
              ))}
            </select>
          )}
          {filtreStatut !== 'all' && (
            <button onClick={() => setFiltreStatut('all')}
              style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 9, padding: '10px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              × Effacer filtre
            </button>
          )}
        </div>

        {/* ── Liste dossiers ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.textMid }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '80px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>
              {dossiers.length === 0 ? 'Aucun dossier' : 'Aucun résultat'}
            </div>
            <div style={{ fontSize: 13, color: C.textMid, marginBottom: 20 }}>
              {dossiers.length === 0 ? 'Créez votre premier dossier pour démarrer' : 'Modifiez vos critères de recherche'}
            </div>
            {dossiers.length === 0 && (
              <button onClick={() => setShowWizard(true)}
                style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ➕ Créer un dossier
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* En-têtes */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 130px 150px 120px 120px 90px 80px', gap: 12, padding: '8px 16px', fontSize: 11, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4 }}>
              <span>Référence</span><span>Prospect</span><span>Fiche CEE</span><span>Commercial</span><span>Prime CEE</span><span>Marge nette</span><span>Statut</span><span>Date</span>
            </div>

            {filtered.map(d => {
              const commercial = profiles.find(p => p.id === d.assigne_a)
              const marge = d.prime_estimee && d.montant_devis ? d.prime_estimee - d.montant_devis : null
              return (
                <div key={d.id} onClick={() => openDossier(d)}
                  style={{ display: 'grid', gridTemplateColumns: '120px 1fr 130px 150px 120px 120px 90px 80px', gap: 12, padding: '13px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', marginBottom: 6, alignItems: 'center', transition: 'border-color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#475569'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#60A5FA', fontFamily: 'monospace' }}>{d.ref}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{d.prospects?.raison_sociale || '—'}</div>
                    <div style={{ fontSize: 11, color: C.textMid }}>{d.prospects?.ville || ''}</div>
                  </div>
                  <span style={{ fontSize: 11, color: C.textMid, background: '#172033', border: '1px solid #1e3a5f', borderRadius: 5, padding: '2px 7px', fontWeight: 600 }}>{d.fiche_cee}</span>
                  <span style={{ fontSize: 12, color: C.textMid }}>
                    {commercial ? `${commercial.prenom || ''} ${commercial.nom || ''}`.trim() || commercial.email : '—'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: d.prime_estimee ? '#a78bfa' : C.textSoft }}>
                    {d.prime_estimee ? `${d.prime_estimee.toLocaleString('fr')} €` : '—'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: marge === null ? C.textSoft : marge >= 0 ? '#4ade80' : '#ef4444' }}>
                    {marge !== null ? `${marge.toLocaleString('fr')} €` : '—'}
                  </span>
                  <StatutBadge statut={d.statut} />
                  <span style={{ fontSize: 11, color: C.textSoft }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showWizard && (
        <NouveauDossierWizard
          onClose={() => setShowWizard(false)}
          onCreate={(d) => { setShowWizard(false); if (d) openDossier(d) }}
        />
      )}
    </div>
  )
}
