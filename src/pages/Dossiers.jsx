import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useStore from '../store/useStore'
import NouveauDossierWizard from '../components/NouveauDossierWizard'
import KanbanView from '../components/KanbanView'
import { supabase } from '../lib/supabase'
import { useAppTheme } from '../lib/theme'

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
  { id: 'perdu',            label: 'Marché perdu',       color: '#DC2626', bg: '#FEF2F2' },
]


const FICHE_META = {
  'BAT-TH-116': { label: 'GTB',              color: '#7C3AED' },
  'BAT-TH-163': { label: 'PAC Tertiaire',    color: '#0891B2' },
  'BAT-TH-142': { label: 'Destrat Tertiaire',color: '#D97706' },
  'IND-BA-110': { label: 'Destrat Industrie',color: '#EA580C' },
  'BAT-TH-125': { label: 'VMC Simple flux',  color: '#16A34A' },
  'BAT-TH-126': { label: 'VMC Double flux',  color: '#0369A1' },
}

const fmtK = (n) => {
  if (n == null || isNaN(n) || n === 0) return '—'
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' M€'
  if (n >= 1000) return Math.round(n / 1000) + ' k€'
  return Math.round(n) + ' €'
}
const fmtE = (n) => {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
const fmtMwh = (n) => {
  if (!n || isNaN(n)) return '—'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MWh'
}

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000)
}

function StatutBadge({ statut }) {
  const C = useAppTheme()
  const s = STATUTS.find(x => x.id === statut) || { label: statut, color: C.textSoft, bg: C.bg }
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}44`, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

export default function Dossiers() {
  const C = useAppTheme()
  const INP = {
    width: '100%', boxSizing: 'border-box',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 7, padding: '9px 12px',
    color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }
  const navigate = useNavigate()
  const location = useLocation()
  const { dossiers, fetchDossiers, setCurrentDossier, deleteDossier, deleteDossiers, user, profile, profiles, fetchProfiles } = useStore()
  const wizardPrefill = location.state?.openWizard ? {
    fiche: location.state.prefillFiche,
    tech:  location.state.prefillTech,
    prixMwh: location.state.prefillPrixMwh,
  } : null
  const [showModal, setShowModal]               = useState(!!location.state?.openWizard)
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
  const [simuMap, setSimuMap]                   = useState({})
  const [viewMode, setViewMode]                 = useState('list') // 'list' | 'kanban'
  // Export
  const [showExport, setShowExport]             = useState(false)
  const [exportFiche, setExportFiche]           = useState('all')
  const [exportStatut, setExportStatut]         = useState('all')
  const [exportDateFrom, setExportDateFrom]     = useState('')
  const [exportDateTo, setExportDateTo]         = useState('')

  const isAdmin = profile?.role === 'admin'
  const isMobile = window.innerWidth < 700

  useEffect(() => {
    if (!profile) return
    fetchProfiles()
    fetchDossiers().then(() => setLoading(false))
  }, [profile?.id])

  // Simulations pour MWh cumac — prend la plus récente par dossier
  useEffect(() => {
    if (!user?.id) return
    const load = async () => {
      const { data } = await supabase
        .from('simulations')
        .select('dossier_id, mwh_cumac, fiche_cee, parametres')
        .order('created_at', { ascending: false })
      if (!data) return
      const map = {}
      for (const s of data) {
        if (!map[s.dossier_id]) {
          map[s.dossier_id] = { mwh_cumac: s.mwh_cumac || null, fiche_cee: s.fiche_cee, parametres: s.parametres }
        }
      }
      setSimuMap(map)
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
    if (sortBy === 'prime')  { va = a.prime_estimee || 0; vb = b.prime_estimee || 0 }
    if (sortBy === 'marge')  { va = a.prime_estimee > 0 ? a.prime_estimee * 0.9 - (a.montant_devis || 0) : -Infinity; vb = b.prime_estimee > 0 ? b.prime_estimee * 0.9 - (b.montant_devis || 0) : -Infinity }
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

  const handleStatutChange = async (dossierId, newStatut) => {
    const now = new Date().toISOString()
    const { error } = await supabase.from('dossiers').update({ statut: newStatut, updated_at: now }).eq('id', dossierId)
    if (!error) fetchDossiers()
  }

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

  // ── Export CSV ────────────────────────────────────────────────────────────────
  // Parse une adresse texte "123 Rue X, 75001 Paris" → { adresse, cp, ville }
  const parseAdresse = (str) => {
    if (!str) return { adresse: '', cp: '', ville: '' }
    const m = str.match(/^(.*?)[,\s]+(\d{5})[,\s]+(.+)$/)
    if (m) return { adresse: m[1].trim(), cp: m[2], ville: m[3].trim() }
    return { adresse: str.trim(), cp: '', ville: '' }
  }

  // Helpers pour extraire superficie, secteur et fonctionnalités depuis simulations.parametres
  const SECTEUR_LABELS = {
    bureaux: 'Bureaux', commerce: 'Commerce', enseignement: 'Enseignement',
    sante: 'Santé', hotellerie: 'Hôtellerie', restauration: 'Restauration',
    industrie: 'Industrie', logistique: 'Logistique', autre: 'Autre',
  }

  const getSuperficie = (entry) => {
    if (!entry) return ''
    const p = entry.parametres || {}
    if (p.surface_m2 != null && p.surface_m2 !== '') return p.surface_m2
    if (p.surface_ventilee != null && p.surface_ventilee !== '') return p.surface_ventilee
    if (p.surface_isolant != null && p.surface_isolant !== '') return p.surface_isolant
    if (p.surfaces && typeof p.surfaces === 'object') {
      return Number(p.surfaces.chauffage) || ''
    }
    return ''
  }

  const getSecteur = (entry) => {
    if (!entry) return ''
    const s = entry.parametres?.secteur
    if (!s) return ''
    return SECTEUR_LABELS[s] || s
  }

  const getFonctionnalites = (entry) => {
    if (!entry) return ''
    const p = entry.parametres || {}
    const f = entry.fiche_cee || ''
    if (f === 'BAT-TH-116' && p.surfaces && typeof p.surfaces === 'object') {
      const LABELS = { chauffage: 'Chauffage', refroidissement: 'Refroidissement', ecs: 'ECS', eclairage: 'Éclairage', auxiliaires: 'Auxiliaires' }
      const active = Object.entries(p.surfaces)
        .filter(([, v]) => Number(v) > 0)
        .map(([k]) => LABELS[k] || k)
      return active.join(', ')
    }
    if (f === 'BAT-TH-163') return 'Chauffage / Climatisation (PAC)'
    if (f === 'BAT-TH-142') return 'Chauffage (Destratification)'
    if (f === 'IND-BA-110') return 'Récupération chaleur air comprimé'
    if (f === 'BAT-TH-125') return 'Ventilation simple flux'
    if (f === 'BAT-TH-126') return 'Ventilation double flux'
    return ''
  }

  const exportDossiers = () => {
    // Filtrage pour l'export
    const rows = myDossiers.filter(d => {
      if (exportFiche   !== 'all' && d.fiche_cee !== exportFiche)   return false
      if (exportStatut  !== 'all' && d.statut    !== exportStatut) return false
      if (exportDateFrom && new Date(d.created_at) < new Date(exportDateFrom)) return false
      if (exportDateTo   && new Date(d.created_at) > new Date(exportDateTo + 'T23:59:59')) return false
      return true
    })

    const STATUT_LABEL = Object.fromEntries(STATUTS.map(s => [s.id, s.label]))
    const headers = [
      'Référence', 'Statut', 'Fiche CEE',
      'Raison sociale', 'SIRET',
      'Nom contact', 'Téléphone', 'Email',
      'Adresse siège', 'CP siège', 'Ville siège',
      'Adresse site', 'CP site', 'Ville site',
      'Volume CUMAC (MWh)', 'Prime brute (€)',
      'Superficie (m²)', 'Secteur d\'activité', 'Fonctionnalités',
      'Date création',
    ]

    const csvRows = rows.map(d => {
      const p      = d.prospects || {}
      const site   = parseAdresse(d.adresse_site)
      const mwh    = simuMap[d.id]?.mwh_cumac
      const simu   = simuMap[d.id]
      const cell = (v) => {
        const s = String(v ?? '')
        return s.includes(';') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s
      }
      return [
        cell(d.ref),
        cell(STATUT_LABEL[d.statut] || d.statut),
        cell(d.fiche_cee),
        cell(p.raison_sociale),
        cell(p.siret),
        cell(p.contact_nom),
        cell(p.contact_tel),
        cell(p.contact_email),
        cell(p.adresse),
        cell(p.code_postal),
        cell(p.ville),
        cell(site.adresse),
        cell(site.cp),
        cell(site.ville),
        cell(mwh != null ? mwh.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : ''),
        cell(d.prime_estimee != null ? d.prime_estimee.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : ''),
        cell(getSuperficie(simu)),
        cell(getSecteur(simu)),
        cell(getFonctionnalites(simu)),
        cell(d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : ''),
      ].join(';')
    })

    const csv  = '﻿' + [headers.join(';'), ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href     = url
    a.download = `dossiers_export_${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setShowExport(false)
  }

  // Compte des dossiers qui seront exportés
  const exportCount = myDossiers.filter(d => {
    if (exportFiche !== 'all' && d.fiche_cee !== exportFiche) return false
    if (exportDateFrom && new Date(d.created_at) < new Date(exportDateFrom)) return false
    if (exportDateTo   && new Date(d.created_at) > new Date(exportDateTo + 'T23:59:59')) return false
    return true
  }).length

  // Même colonnes que Dashboard
  const COLS = '28px 72px 1fr 90px 110px 72px 105px 105px 70px 62px 34px'

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Toggle vue */}
            {!isMobile && (
              <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 2 }}>
                {[['list', '☰ Liste'], ['kanban', '🗂 Kanban']].map(([mode, label]) => (
                  <button key={mode} onClick={() => setViewMode(mode)} style={{
                    background: viewMode === mode ? C.surface : 'transparent',
                    border: viewMode === mode ? `1px solid ${C.border}` : '1px solid transparent',
                    borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: viewMode === mode ? 700 : 500,
                    color: viewMode === mode ? C.text : C.textSoft, cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,.08)' : 'none', transition: 'all .15s',
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowExport(true)}
              style={{ background: C.surface, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              ⬇︎ Exporter
            </button>
            <button onClick={() => setShowModal(true)}
              style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              ➕ Nouveau dossier
            </button>
          </div>
        </div>

        {/* ── Filtres ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
          <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}
            style={{ ...INP, width: 160, padding: '10px 12px', borderRadius: 9, cursor: 'pointer' }}>
            <option value="all">Tous les statuts</option>
            {STATUTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* ── Tags fiches CEE ── */}
        {fiches.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {['all', ...fiches].map(f => {
              const meta   = FICHE_META[f]
              const color  = meta?.color || C.accent
              const label  = f === 'all' ? 'Toutes' : (meta?.label || f)
              const active = filtreFiche === f
              const count  = f === 'all' ? myDossiers.length : myDossiers.filter(d => d.fiche_cee === f).length
              return (
                <button key={f} onClick={() => setFiltreFiche(f)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: active ? color : C.surface,
                  color: active ? '#fff' : (f === 'all' ? C.textSoft : color),
                  border: `1px solid ${active ? 'transparent' : (f === 'all' ? C.border : color + '66')}`,
                  borderRadius: 20, padding: '5px 12px',
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  transition: 'all .12s',
                }}>
                  {label}
                  <span style={{ fontSize: 10, fontWeight: 700, opacity: active ? 0.85 : 0.6,
                    background: active ? 'rgba(255,255,255,.2)' : (f === 'all' ? C.bg : color + '22'),
                    color: active ? '#fff' : color,
                    borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center',
                  }}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Toolbar sélection groupée */}
        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 9, padding: '10px 16px' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>{selected.size} dossier{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}</span>
            <button onClick={handleDeleteSelected} style={{ background: '#DC2626', border: 'none', color: '#fff', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🗑 Supprimer la sélection</button>
            <button onClick={() => setSelected(new Set())} style={{ background: 'transparent', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          </div>
        )}

        {/* ── Contenu ── */}
        {viewMode === 'kanban' && !loading ? (
          <KanbanView
            dossiers={filtered.filter(d => d.statut !== 'perdu')}
            onStatutChange={handleStatutChange}
            profiles={profiles}
            isAdmin={isAdmin}
          />
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.textMid }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>Aucun dossier</div>
            <div style={{ fontSize: 13, color: C.textMid }}>Créez votre premier dossier pour démarrer</div>
          </div>
        ) : isMobile ? (
          /* ── Vue mobile : cartes ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(d => {
              const isPerdu = d.statut === 'perdu'
              const prime   = d.prime_estimee || 0
              const cout    = d.montant_devis || 0
              const margeNette = prime > 0 ? Math.round((prime * 0.9 - cout) * 100) / 100 : null
              const mwh     = simuMap[d.id]?.mwh_cumac || null
              const jPlus   = daysSince(d.created_at)
              return (
                <div key={d.id} onClick={() => !deletingIds.has(d.id) && openDossier(d)}
                  style={{ background: isPerdu ? 'rgba(220,38,38,0.07)' : C.surface, border: `1px solid ${isPerdu ? '#FCA5A5' : C.border}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', opacity: isPerdu ? 0.8 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.prospects?.raison_sociale || '—'}</div>
                      {d.prospects?.contact_nom && <div style={{ fontSize: 12, color: C.textMid }}>{d.prospects.contact_nom}</div>}
                    </div>
                    <StatutBadge statut={d.statut} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>{d.ref}</span>
                    <span style={{ fontSize: 11, color: C.textMid, fontWeight: 600 }}>{d.fiche_cee}</span>
                    {mwh && <span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{fmtMwh(mwh)}</span>}
                    {prime > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>{fmtK(prime)}</span>}
                    {margeNette != null && <span style={{ fontSize: 11, fontWeight: 700, color: margeNette >= 0 ? '#16A34A' : '#DC2626' }}>m: {fmtK(margeNette)}</span>}
                    {isAdmin
                      ? <span style={{ fontSize: 11, color: C.textSoft, marginLeft: 'auto' }}>{profileName(d.assigne_a)}</span>
                      : <span style={{ fontSize: 11, color: jPlus > 14 ? '#DC2626' : jPlus > 7 ? '#D97706' : C.textSoft, fontWeight: jPlus > 7 ? 700 : 400, marginLeft: 'auto' }}>J+{jPlus}</span>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── Vue desktop : tableau ── */
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto' }}>
          <div style={{ minWidth: 820 }}>
            {/* En-tête */}
            <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '9px 14px', background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .4, alignItems: 'center' }}>
              <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} style={{ width: 14, height: 14, cursor: 'pointer', accentColor: C.accent }}/>
              <span>Réf.</span>
              <span>Prospect</span>
              <button onClick={() => toggleSort('fiche')} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'left', textTransform: 'uppercase', letterSpacing: .4 }}>Fiche{sortIcon('fiche')}</button>
              <span>Statut</span>
              <span style={{ textAlign: 'right' }}>MWh</span>
              <button onClick={() => toggleSort('prime')} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'right', textTransform: 'uppercase', letterSpacing: .4, width: '100%' }}>Prime brute{sortIcon('prime')}</button>
              <button onClick={() => toggleSort('marge')} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'right', textTransform: 'uppercase', letterSpacing: .4, width: '100%' }}>Marge nette{sortIcon('marge')}</button>
              {isAdmin ? <span>Comm.</span> : <span>J+</span>}
              <button onClick={() => toggleSort('date')} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0, textAlign: 'left', textTransform: 'uppercase', letterSpacing: .4 }}>Date{sortIcon('date')}</button>
              <span/>
            </div>

            {/* Lignes */}
            {filtered.map((d, idx) => {
              const isSelected = selected.has(d.id)
              const isDeleting = deletingIds.has(d.id)
              const isPerdu    = d.statut === 'perdu'
              const isConfirm  = confirmDeleteId === d.id
              const prime      = d.prime_estimee || 0
              const cout       = d.montant_devis || 0
              const margeNette = prime > 0 ? Math.round((prime * 0.9 - cout) * 100) / 100 : null
              const mwh        = simuMap[d.id]?.mwh_cumac || null
              const jPlus      = daysSince(d.created_at)
              return (
                <div key={d.id}
                  onClick={() => !isDeleting && openDossier(d)}
                  style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '12px 16px', alignItems: 'center', background: isSelected ? C.accentSoft : isPerdu ? 'rgba(220,38,38,0.07)' : idx % 2 === 0 ? C.surface : C.bg, borderBottom: `1px solid ${C.border}`, cursor: isDeleting ? 'default' : 'pointer', opacity: isDeleting ? .5 : isPerdu ? 0.7 : 1, transition: 'background .1s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isPerdu ? 'rgba(220,38,38,0.12)' : C.accentSoft }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isPerdu ? 'rgba(220,38,38,0.07)' : idx % 2 === 0 ? C.surface : C.bg }}>

                  <input type="checkbox" checked={isSelected} onClick={e => toggleSelect(d.id, e)} onChange={() => {}} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C.accent }}/>

                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>{d.ref}</span>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.prospects?.raison_sociale || '—'}</div>
                    {d.prospects?.contact_nom && <div style={{ fontSize: 11, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.prospects.contact_nom}</div>}
                  </div>

                  <span style={{ fontSize: 11, color: C.textMid, fontWeight: 600 }}>{d.fiche_cee}</span>

                  <StatutBadge statut={d.statut} />

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: mwh ? C.accent : C.textSoft }}>{fmtMwh(mwh)}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: prime > 0 ? '#7C3AED' : C.textSoft }}>{prime > 0 ? fmtE(prime) : '—'}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {margeNette != null ? (
                      <div style={{ fontSize: 12, fontWeight: 700, color: margeNette >= 0 ? '#16A34A' : '#DC2626' }}>{fmtE(margeNette)}</div>
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
            <div style={{ padding: '10px 16px', background: C.bg, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textSoft }}>
              {filtered.length} dossier{filtered.length > 1 ? 's' : ''}{filtered.length < myDossiers.length ? ` sur ${myDossiers.length}` : ''}
            </div>
          </div>
          </div>
        )}
      </div>

      {showModal && (
        <NouveauDossierWizard
          onClose={() => setShowModal(false)}
          onCreate={(d) => d && openDossier(d)}
          prefillFiche={wizardPrefill?.fiche}
          prefillTech={wizardPrefill?.tech}
          prefillPrixMwh={wizardPrefill?.prixMwh}
        />
      )}

      {/* ── Modal Export CSV ── */}
      {showExport && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "system-ui,'Segoe UI',Arial,sans-serif",
        }} onClick={e => e.target === e.currentTarget && setShowExport(false)}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: '28px 28px 24px',
            width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.2)',
          }}>
            {/* Titre */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>Exporter les dossiers</div>
                <div style={{ fontSize: 12, color: C.textSoft, marginTop: 2 }}>Format CSV · compatible Excel</div>
              </div>
              <button onClick={() => setShowExport(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textSoft, lineHeight: 1 }}>×</button>
            </div>

            {/* Filtre fiche CEE */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Fiche CEE</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['all', ...fiches].map(f => {
                  const meta   = FICHE_META[f]
                  const color  = meta?.color || C.accent
                  const label  = f === 'all' ? 'Toutes' : (meta?.label || f)
                  const active = exportFiche === f
                  const count  = f === 'all' ? myDossiers.length : myDossiers.filter(d => d.fiche_cee === f).length
                  return (
                    <button key={f} onClick={() => setExportFiche(f)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: active ? color : C.bg,
                      color: active ? '#fff' : (f === 'all' ? C.textSoft : color),
                      border: `1px solid ${active ? 'transparent' : (f === 'all' ? C.border : color + '66')}`,
                      borderRadius: 20, padding: '5px 12px',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {label}
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        background: active ? 'rgba(255,255,255,.2)' : color + '22',
                        color: active ? '#fff' : color,
                        borderRadius: 10, padding: '1px 6px',
                      }}>{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Filtre statut */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Statut</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[{ id: 'all', label: 'Tous', color: C.accent }, ...STATUTS].map(s => {
                  const active = exportStatut === s.id
                  const color  = s.id === 'all' ? C.accent : s.color
                  const count  = s.id === 'all' ? myDossiers.length : myDossiers.filter(d => d.statut === s.id).length
                  if (count === 0 && s.id !== 'all') return null
                  return (
                    <button key={s.id} onClick={() => setExportStatut(s.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: active ? color : C.bg,
                      color: active ? '#fff' : color,
                      border: `1px solid ${active ? 'transparent' : color + '66'}`,
                      borderRadius: 20, padding: '4px 11px',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {s.label}
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        background: active ? 'rgba(255,255,255,.2)' : color + '22',
                        color: active ? '#fff' : color,
                        borderRadius: 10, padding: '1px 5px',
                      }}>{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Filtre dates */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Période (date de création)</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 4 }}>Du</div>
                  <input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)}
                    style={{ ...INP, padding: '9px 12px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 4 }}>Au</div>
                  <input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)}
                    style={{ ...INP, padding: '9px 12px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                {(exportDateFrom || exportDateTo) && (
                  <button onClick={() => { setExportDateFrom(''); setExportDateTo('') }}
                    style={{ background: 'transparent', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 18, marginTop: 18, padding: '0 4px' }}>×</button>
                )}
              </div>
            </div>

            {/* Colonnes exportées (info) */}
            <div style={{ background: C.bg, borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 11, color: C.textSoft, lineHeight: 1.7 }}>
              <strong style={{ color: C.textMid }}>Colonnes exportées :</strong><br />
              Référence · Statut · Fiche CEE · Raison sociale · SIRET · Nom contact · Téléphone · Email · Adresse siège · CP · Ville · Adresse site · CP site · Ville site · Volume CUMAC · Prime brute · Superficie (m²) · Secteur d'activité · Fonctionnalités · Date création
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 13, color: C.textSoft }}>
                <strong style={{ color: C.text }}>{exportCount}</strong> dossier{exportCount !== 1 ? 's' : ''} à exporter
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowExport(false)}
                  style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Annuler
                </button>
                <button onClick={exportDossiers} disabled={exportCount === 0}
                  style={{ background: exportCount === 0 ? C.border : '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: exportCount === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  ⬇︎ Télécharger le CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
