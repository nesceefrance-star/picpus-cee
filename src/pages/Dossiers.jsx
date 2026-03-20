import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import NouveauDossierWizard from '../components/NouveauDossierWizard'
import { supabase } from '../lib/supabase'

const STATUTS = [
  { id: 'simulation',       label: 'Simulation',        color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'prospect',         label: 'Prospect',           color: '#0369A1', bg: '#DBEAFE' },
  { id: 'contacte',         label: 'Contacté',           color: '#0891B2', bg: '#CFFAFE' },
  { id: 'visio_planifiee',  label: 'Visio planifiée',    color: '#0D9488', bg: '#CCFBF1' },
  { id: 'visio_effectuee',  label: 'Visio effectuée',    color: '#059669', bg: '#D1FAE5' },
  { id: 'visite_planifiee', label: 'Visite planifiée',   color: '#D97706', bg: '#FEF3C7' },
  { id: 'visite_effectuee', label: 'Visite effectuée',   color: '#EA580C', bg: '#FFF7ED' },
  { id: 'devis',            label: 'Devis envoyé',       color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'ah',               label: 'AH signé',           color: '#16A34A', bg: '#DCFCE7' },
  { id: 'conforme',         label: 'Conforme',           color: '#15803D', bg: '#D1FAE5' },
  { id: 'facture',          label: 'Facturé',            color: '#64748B', bg: '#F1F5F9' },
]

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

const INP = {
  width: '100%', boxSizing: 'border-box',
  background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 7, padding: '9px 12px',
  color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
}

const fmtK = (n) => {
  if (n == null || isNaN(n) || n === 0) return '—'
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' M€'
  if (n >= 1000) return Math.round(n / 1000) + ' k€'
  return Math.round(n) + ' €'
}

function computeFinancials(devis) {
  const lignes = (devis.lignes || []).filter(l => l.inclus !== false)
  const ca = lignes.reduce((s, l) => s + (l.puVente || 0) * (l.qte || 0), 0)
    + (devis.bat_qte || 0) * (devis.bat_pu_vente || 0)
  const achat = lignes.reduce((s, l) => s + (l.puAchat || 0) * (l.qte || 0), 0)
  return { ca, marge: ca - achat, prime: devis.prime || 0 }
}

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000)
}

function StatutBadge({ statut }) {
  const s = STATUTS.find(x => x.id === statut) || { label: statut, color: C.textSoft, bg: C.bg }
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}44`, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

export default function Dossiers() {
  const navigate = useNavigate()
  const { dossiers, fetchDossiers, setCurrentDossier, deleteDossier, deleteDossiers, user, profile, profiles, fetchProfiles } = useStore()
  const [showModal, setShowModal]               = useState(false)
  const [search, setSearch]                     = useState('')
  const [filtreStatut, setFiltreStatut]         = useState('all')
  const [filtreCommercial, setFiltreCommercial] = useState('all')
  const [filtreFiche, setFiltreFiche]           = useState('all')
  const [sortBy, setSortBy]                     = useState('date')
  const [sortDir, setSortDir]                   = useState('desc')
  const [loading, setLoading]                   = useState(true)
  const [selected, setSelected]                 = useState(new Set())
  const [confirmDeleteId, setConfirmDeleteId]   = useState(null)
  const [deletingIds, setDeletingIds]           = useState(new Set())
  const [devisMap, setDevisMap]                 = useState({})

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!profile) return
    fetchProfiles()
    fetchDossiers().then(() => setLoading(false))
  }, [profile?.id])

  useEffect(() => {
    if (!user?.id) return
    const load = async () => {
      const { data } = await supabase.from('devis_hub').select('dossier_id, lignes, prime, bat_qte, bat_pu_vente')
      if (!data) return
      const map = {}
      for (const dv of data) {
        const fin = computeFinancials(dv)
        if (!map[dv.dossier_id] || fin.ca > (map[dv.dossier_id]?.ca || 0)) map[dv.dossier_id] = fin
      }
      setDevisMap(map)
    }
    load()
  }, [user?.id])

  const profileName = (id) => {
    const p = profiles.find(p => p.id === id)
    return p ? (`${p.prenom || ''} ${p.nom || ''}`.trim() || p.email) : '—'
  }

  const myDossiers = isAdmin && filtreCommercial !== 'all'
    ? dossiers.filter(d => d.assigne_a === filtreCommercial)
    : isAdmin ? dossiers
    : dossiers.filter(d => d.assigne_a === user?.id)

  const sorted = [...myDossiers].sort((a, b) => {
    let va, vb
    if (sortBy === 'date')   { va = new Date(a.created_at); vb = new Date(b.created_at) }
    if (sortBy === 'fiche')  { va = a.fiche_cee || ''; vb = b.fiche_cee || '' }
    if (sortBy === 'statut') { va = a.statut || ''; vb = b.statut || '' }
    if (sortBy === 'ca')     { va = devisMap[a.id]?.ca || 0; vb = devisMap[b.id]?.ca || 0 }
    if (sortBy === 'marge')  { va = devisMap[a.id]?.ca > 0 ? devisMap[a.id].marge / devisMap[a.id].ca : -1; vb = devisMap[b.id]?.ca > 0 ? devisMap[b.id].marge / devisMap[b.id].ca : -1 }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const filtered = sorted.filter(d => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      d.ref?.toLowerCase().includes(q) ||
      d.prospects?.raison_sociale?.toLowerCase().includes(q) ||
      d.prospects?.contact_nom?.toLowerCase().includes(q) ||
      d.fiche_cee?.toLowerCase().includes(q)
    const matchStatut = filtreStatut === 'all' || d.statut === filtreStatut
    const matchFiche  = filtreFiche  === 'all' || d.fiche_cee === filtreFiche
    return matchSearch && matchStatut && matchFiche
  })

  const fiches = [...new Set(myDossiers.map(d => d.fiche_cee).filter(Boolean))]

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }
  const sortIcon = (col) => sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  const openDossier = (dossier) => { setCurrentDossier(dossier); navigate(`/dossier/${dossier.id}`) }

  const toggleSelect = (id, e) => {
    e.stopPropagation()
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmDeleteId(null)
  }
  const toggleSelectAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(d => d.id)))

  const handleDeleteOne = async (id, e) => {
    e.stopPropagation()
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return }
    setDeletingIds(s => new Set(s).add(id))
    await deleteDossier(id)
    setConfirmDeleteId(null)
    setDeletingIds(s => { const n = new Set(s); n.delete(id); return n })
    setSelected(s => { const n = new Set(s); n.delete(id); return n })
  }

  const handleDeleteSelected = async () => {
    const ids = [...selected]
    setDeletingIds(new Set(ids))
    await deleteDossiers(ids)
    setSelected(new Set())
    setDeletingIds(new Set())
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, marginBottom: 2 }}>Dossiers</h1>
            <p style={{ fontSize: 13, color: C.textMid, margin: 0 }}>
              {myDossiers.filter(d => !['facture','archive'].includes(d.statut)).length} dossiers actifs
            </p>
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            ➕ Nouveau dossier
          </button>
        </div>

        {/* ── Filtres ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher référence, prospect, contact…"
            style={{ ...INP, flex: 1, minWidth: 200, fontSize: 14, padding: '10px 16px', borderRadius: 9 }}/>
          {isAdmin && (
            <select value={filtreCommercial} onChange={e => setFiltreCommercial(e.target.value)}
              style={{ ...INP, width: 170, padding: '10px 12px', borderRadius: 9, cursor: 'pointer' }}>
              <option value="all">Tous les commerciaux</option>
              {profiles.filter(p => ['admin','commercial'].includes(p.role)).map(p => (
                <option key={p.id} value={p.id}>{(`${p.prenom || ''} ${p.nom || ''}`.trim()) || p.email}</option>
              ))}
            </select>
          )}
          <select value={filtreFiche} onChange={e => setFiltreFiche(e.target.value)}
            style={{ ...INP, width: 160, padding: '10px 12px', borderRadius: 9, cursor: 'pointer' }}>
            <option value="all">Toutes les fiches</option>
            {fiches.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}
            style={{ ...INP, width: 160, padding: '10px 12px', borderRadius: 9, cursor: 'pointer' }}>
            <option value="all">Tous les statuts</option>
            {STATUTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* Toolbar sélection groupée */}
        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 9, padding: '10px 16px' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>{selected.size} dossier{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}</span>
            <button onClick={handleDeleteSelected} style={{ background: '#DC2626', border: 'none', color: '#fff', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🗑 Supprimer la sélection</button>
            <button onClick={() => setSelected(new Set())} style={{ background: 'transparent', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          </div>
        )}

        {/* ── Tableau ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.textMid }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>Aucun dossier</div>
            <div style={{ fontSize: 13, color: C.textMid }}>Créez votre premier dossier pour démarrer</div>
          </div>
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* En-tête */}
            <div style={{ display: 'grid', gridTemplateColumns: '36px 120px 1fr 150px 110px 130px 90px 70px 110px 80px 44px', gap: 10, padding: '10px 16px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .4, alignItems: 'center' }}>
              <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C.accent }}/>
              <span>Référence</span>
              <span>Prospect</span>
              <span>Contact</span>
              <button onClick={() => toggleSort('fiche')} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'left', textTransform: 'uppercase', letterSpacing: .4 }}>Fiche CEE{sortIcon('fiche')}</button>
              <span>Statut</span>
              <button onClick={() => toggleSort('ca')} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'right', textTransform: 'uppercase', letterSpacing: .4, width: '100%' }}>CA{sortIcon('ca')}</button>
              <button onClick={() => toggleSort('marge')} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'right', textTransform: 'uppercase', letterSpacing: .4, width: '100%' }}>Marge{sortIcon('marge')}</button>
              {isAdmin ? <span>Commercial</span> : <span>J+</span>}
              <button onClick={() => toggleSort('date')} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'left', textTransform: 'uppercase', letterSpacing: .4 }}>Date{sortIcon('date')}</button>
              <span/>
            </div>

            {/* Lignes */}
            {filtered.map((d, idx) => {
              const isSelected = selected.has(d.id)
              const isDeleting = deletingIds.has(d.id)
              const isConfirm  = confirmDeleteId === d.id
              const fin        = devisMap[d.id]
              const margePctD  = fin?.ca > 0 ? Math.round(fin.marge / fin.ca * 100) : null
              const jPlus      = daysSince(d.created_at)
              return (
                <div key={d.id}
                  onClick={() => !isDeleting && openDossier(d)}
                  style={{ display: 'grid', gridTemplateColumns: '36px 120px 1fr 150px 110px 130px 90px 70px 110px 80px 44px', gap: 10, padding: '12px 16px', alignItems: 'center', background: isSelected ? '#EFF6FF' : idx % 2 === 0 ? C.surface : '#FAFBFC', borderBottom: `1px solid ${C.border}`, cursor: isDeleting ? 'default' : 'pointer', opacity: isDeleting ? .5 : 1, transition: 'background .1s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F0F7FF' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? C.surface : '#FAFBFC' }}>

                  <input type="checkbox" checked={isSelected} onClick={e => toggleSelect(d.id, e)} onChange={() => {}} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C.accent }}/>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>{d.ref}</span>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.prospects?.raison_sociale || '—'}</div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    {d.prospects?.contact_nom && (
                      <div style={{ fontSize: 12, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.prospects.contact_nom}</div>
                    )}
                    {d.prospects?.contact_tel && (
                      <a href={`tel:${d.prospects.contact_tel}`} onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, color: C.accent, fontWeight: 600, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📞 {d.prospects.contact_tel}
                      </a>
                    )}
                    {!d.prospects?.contact_nom && !d.prospects?.contact_tel && <span style={{ fontSize: 11, color: C.textSoft }}>—</span>}
                  </div>

                  <span style={{ fontSize: 11, color: C.textMid, fontWeight: 600 }}>{d.fiche_cee}</span>
                  <StatutBadge statut={d.statut} />

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: fin?.ca > 0 ? '#2563EB' : C.textSoft }}>{fmtK(fin?.ca)}</div>
                    {fin?.prime > 0 && <div style={{ fontSize: 10, color: '#7C3AED' }}>⚡ {fmtK(fin.prime)}</div>}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {margePctD != null ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: margePctD >= 20 ? '#16A34A' : margePctD >= 0 ? '#D97706' : '#DC2626', background: margePctD >= 20 ? '#F0FDF4' : margePctD >= 0 ? '#FFFBEB' : '#FEF2F2', border: `1px solid ${margePctD >= 20 ? '#86EFAC' : margePctD >= 0 ? '#FDE68A' : '#FCA5A5'}`, borderRadius: 5, padding: '2px 6px' }}>
                        {margePctD}%
                      </span>
                    ) : <span style={{ fontSize: 11, color: C.textSoft }}>—</span>}
                  </div>

                  {isAdmin
                    ? <span style={{ fontSize: 11, color: C.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileName(d.assigne_a)}</span>
                    : <span style={{ fontSize: 11, color: jPlus > 14 ? '#DC2626' : jPlus > 7 ? '#D97706' : C.textSoft, fontWeight: jPlus > 7 ? 700 : 400 }}>J+{jPlus}</span>
                  }

                  <span style={{ fontSize: 11, color: C.textSoft }}>{new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>

                  <button onClick={e => handleDeleteOne(d.id, e)} title={isConfirm ? 'Confirmer' : 'Supprimer'}
                    style={{ background: isConfirm ? '#DC2626' : 'transparent', border: `1px solid ${isConfirm ? '#DC2626' : C.border}`, color: isConfirm ? '#fff' : '#94A3B8', borderRadius: 6, padding: '5px 7px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .1s' }}
                    onMouseEnter={e => { if (!isConfirm) { e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.color = '#DC2626' } }}
                    onMouseLeave={e => { if (!isConfirm) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = '#94A3B8' } }}>
                    {isConfirm ? '?' : '🗑'}
                  </button>
                </div>
              )
            })}

            {/* Footer */}
            <div style={{ padding: '10px 16px', background: '#F8FAFC', borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textSoft }}>
              {filtered.length} dossier{filtered.length > 1 ? 's' : ''}{filtered.length < myDossiers.length ? ` sur ${myDossiers.length}` : ''}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NouveauDossierWizard
          onClose={() => setShowModal(false)}
          onCreate={(d) => d && openDossier(d)}
        />
      )}
    </div>
  )
}
