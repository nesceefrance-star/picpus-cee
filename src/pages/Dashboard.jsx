import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import NouveauDossierWizard from '../components/NouveauDossierWizard'
import { nextRef } from '../lib/genRef'
import { supabase } from '../lib/supabase'
import { useAppTheme } from '../lib/theme'
import { useBreakpoint } from '../lib/useBreakpoint'

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

const TACHES = [
  { icon: '📞', label: 'À contacter',        color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE', statuts: ['prospect'] },
  { icon: '✉️', label: 'Créneaux à envoyer', color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', statuts: ['contacte'] },
  { icon: '📄', label: 'Devis à préparer',   color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', statuts: ['visite_effectuee'] },
  { icon: '🔔', label: 'Relance devis',       color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', statuts: ['devis'] },
  { icon: '🎥', label: 'Visio à venir',       color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', statuts: ['visio_planifiee'] },
  { icon: '🏠', label: 'Visite à venir',      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', statuts: ['visite_planifiee'] },
]


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
const fmtGwh = (mwh) => {
  if (!mwh || isNaN(mwh) || mwh === 0) return '—'
  const gwh = mwh / 1000
  if (gwh >= 1) return gwh.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' GWh'
  return mwh.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MWh'
}

const STATUTS_EN_COURS = ['visio_planifiee','visio_effectuee','visite_planifiee','visite_effectuee','devis','devis_valide','ah','travaux','depot_delegataire','conforme','facture']
const STATUTS_TRAVAUX  = ['travaux', 'depot_delegataire', 'conforme']

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
  const C = useAppTheme()
  const s = STATUTS.find(x => x.id === statut) || { label: statut, color: C.textSoft, bg: C.surface }
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}44`, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const C = useAppTheme()
  const { isMobile, isCompact } = useBreakpoint()
  const INP = {
    width: '100%', boxSizing: 'border-box',
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 7, padding: '9px 12px',
    color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }
  const LBL = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: C.textMid, marginBottom: 5,
    textTransform: 'uppercase', letterSpacing: .4,
  }
  const { dossiers, fetchDossiers, setCurrentDossier, deleteDossier, deleteDossiers, user, profile, profiles, fetchProfiles, session } = useStore()
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
  const [devisMap, setDevisMap]                 = useState({}) // dossier_id → {ca, marge, prime}
  const [simuMap, setSimuMap]                   = useState({}) // dossier_id → {mwh_cumac}
  const [rappelsMap, setRappelsMap]             = useState({}) // dossier_id → rappel_at
  const [briefingOpen, setBriefingOpen]         = useState(null) // tâche key ouverte
  // Tâches todo
  const [taches, setTaches]                     = useState([])
  const [tacheInput, setTacheInput]             = useState('')
  const [tacheDate, setTacheDate]               = useState('')
  const [tacheTime, setTacheTime]               = useState('')
  const [tacheDossierId, setTacheDossierId]     = useState('')
  const [tacheSaving, setTacheSaving]           = useState(false)
  const [tacheError, setTacheError]             = useState('')
  // Édition inline
  const [editingTacheId, setEditingTacheId]     = useState(null)
  const [editTitre, setEditTitre]               = useState('')
  const [editDate, setEditDate]                 = useState('')
  const [editTime, setEditTime]                 = useState('')
  // Partage
  const [sharingTacheId, setSharingTacheId]     = useState(null)
  // Agenda Google Calendar
  const [agendaEvents, setAgendaEvents]         = useState([])
  const [googleConnected, setGoogleConnected]   = useState(false)

  // Attend que le profil soit chargé avant de fetcher les dossiers (sinon admin = filtré par user.id)
  useEffect(() => {
    if (!profile) return
    fetchProfiles()
    fetchDossiers().then(() => setLoading(false))
  }, [profile?.id])

  // Charge devis_hub pour les dossiers de ce commercial
  useEffect(() => {
    if (!user?.id) return
    const loadDevis = async () => {
      let query = supabase.from('devis_hub').select('dossier_id, lignes, prime, bat_qte, bat_pu_vente')
      if (profile?.role !== 'admin') query = query // on filtre côté client via devisMap
      const { data } = await query
      if (!data) return
      const map = {}
      for (const dv of data) {
        const fin = computeFinancials(dv)
        if (!map[dv.dossier_id] || fin.ca > (map[dv.dossier_id]?.ca || 0)) {
          map[dv.dossier_id] = fin
        }
      }
      setDevisMap(map)
    }
    loadDevis()
  }, [user?.id, profile?.role])

  // Charge les simulations pour volume cumac
  useEffect(() => {
    if (!user?.id) return
    const loadSimu = async () => {
      const { data } = await supabase.from('simulations').select('dossier_id, mwh_cumac')
      if (!data) return
      const map = {}
      for (const s of data) {
        if (!map[s.dossier_id]) map[s.dossier_id] = { mwh_cumac: s.mwh_cumac }
      }
      setSimuMap(map)
    }
    loadSimu()
  }, [user?.id])

  // Charge les rappels planifiés depuis la table appels
  useEffect(() => {
    if (!user?.id) return
    const loadRappels = async () => {
      const { data } = await supabase
        .from('appels')
        .select('dossier_id, rappel_at, etat, created_at')
        .not('rappel_at', 'is', null)
        .order('created_at', { ascending: false })
      if (!data) return
      const map = {}
      for (const a of data) {
        if (!map[a.dossier_id]) map[a.dossier_id] = a.rappel_at
      }
      setRappelsMap(map)
    }
    loadRappels()
  }, [user?.id])

  // Charge les tâches todo (les miennes + celles partagées avec moi)
  const loadTaches = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase.from('taches')
      .select('*, dossiers(ref, prospects(raison_sociale))')
      .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
      .order('echeance', { ascending: true, nullsFirst: false })
    if (!data) return
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const visible = data.filter(t => !(t.done && t.done_at && new Date(t.done_at).getTime() < cutoff))
    setTaches(visible)
    // Nettoyage silencieux des tâches expirées dont je suis créateur
    const expired = data.filter(t => t.done && t.done_at && new Date(t.done_at).getTime() < cutoff && t.user_id === user.id)
    if (expired.length > 0) supabase.from('taches').delete().in('id', expired.map(t => t.id))
  }, [user?.id])

  useEffect(() => { loadTaches() }, [loadTaches])

  // Charge le statut Google + events agenda
  useEffect(() => {
    if (!session?.access_token) return
    const loadAgenda = async () => {
      try {
        const statusRes = await fetch('/api/auth-google-status', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const statusData = await statusRes.json()
        if (!statusData.connected) return
        setGoogleConnected(true)
        const evRes = await fetch('/api/calendar?action=upcoming&days=7', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const evData = await evRes.json()
        setAgendaEvents(evData?.events || [])
      } catch (e) { /* silencieux */ }
    }
    loadAgenda()
  }, [session?.access_token])

  // Ajouter une tâche
  const addTache = async () => {
    if (!tacheInput.trim() || tacheSaving) return
    setTacheSaving(true)
    setTacheError('')
    const echeance = tacheDate ? (tacheTime ? `${tacheDate}T${tacheTime}:00` : `${tacheDate}T00:00:00`) : null
    const { data, error } = await supabase.from('taches').insert({
      user_id: user.id,
      titre: tacheInput.trim(),
      echeance: echeance || null,
      dossier_id: tacheDossierId || null,
      done: false,
      shared_with: [],
      checks: {},
    }).select('*, dossiers(ref, prospects(raison_sociale))').single()
    if (error) {
      setTacheError(error.message)
    } else if (data) {
      setTaches(prev => [...prev, data].sort((a, b) => {
        if (!a.echeance && !b.echeance) return 0
        if (!a.echeance) return 1
        if (!b.echeance) return -1
        return new Date(a.echeance) - new Date(b.echeance)
      }))
      setTacheInput(''); setTacheDate(''); setTacheTime(''); setTacheDossierId('')
    }
    setTacheSaving(false)
  }

  // Toggle done — propriétaire : done + done_at. Invité : checks JSONB
  const toggleTache = async (id, currentDone, isShared = false) => {
    if (isShared) {
      const tache = taches.find(t => t.id === id)
      const alreadyChecked = !!(tache?.checks?.[user.id]?.checked)
      const newChecks = {
        ...(tache?.checks || {}),
        [user.id]: { checked: !alreadyChecked, checked_at: new Date().toISOString(), name: profile?.prenom || user?.email?.split('@')[0] || 'Moi' },
      }
      await supabase.from('taches').update({ checks: newChecks }).eq('id', id)
      setTaches(prev => prev.map(t => t.id === id ? { ...t, checks: newChecks } : t))
      return
    }
    const nowIso = new Date().toISOString()
    const newDone = !currentDone
    await supabase.from('taches').update({ done: newDone, done_at: newDone ? nowIso : null }).eq('id', id)
    setTaches(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, done: newDone, done_at: newDone ? nowIso : null } : t)
      // Si on coche : garder 24h visible puis filtrage au prochain load (pas de retrait immédiat)
      return updated
    })
  }

  // Soft-delete : marque done + done_at (reste barré 24h, disparaît seul)
  const deleteTache = async (id) => {
    const nowIso = new Date().toISOString()
    await supabase.from('taches').update({ done: true, done_at: nowIso }).eq('id', id)
    setTaches(prev => prev.map(t => t.id === id ? { ...t, done: true, done_at: nowIso } : t))
  }

  // Édition inline
  const startEditTache = (t) => {
    setEditingTacheId(t.id)
    setEditTitre(t.titre)
    if (t.echeance) {
      const dt = new Date(t.echeance)
      setEditDate(dt.toISOString().slice(0, 10))
      const h = dt.getHours().toString().padStart(2, '0')
      const m = dt.getMinutes().toString().padStart(2, '0')
      setEditTime(h === '00' && m === '00' ? '' : `${h}:${m}`)
    } else { setEditDate(''); setEditTime('') }
  }

  const saveEditTache = async (id) => {
    if (!editTitre.trim()) return
    const echeance = editDate ? (editTime ? `${editDate}T${editTime}:00` : `${editDate}T00:00:00`) : null
    await supabase.from('taches').update({ titre: editTitre.trim(), echeance }).eq('id', id)
    setTaches(prev => prev.map(t => t.id === id ? { ...t, titre: editTitre.trim(), echeance } : t))
    setEditingTacheId(null)
  }

  // Partage avec d'autres users
  const shareTache = async (tacheId, userId) => {
    const tache = taches.find(t => t.id === tacheId)
    if ((tache?.shared_with || []).includes(userId)) return
    const sw = [...(tache?.shared_with || []), userId]
    await supabase.from('taches').update({ shared_with: sw }).eq('id', tacheId)
    setTaches(prev => prev.map(t => t.id === tacheId ? { ...t, shared_with: sw } : t))
  }

  const unshareTache = async (tacheId, userId) => {
    const tache = taches.find(t => t.id === tacheId)
    const sw = (tache?.shared_with || []).filter(id => id !== userId)
    const newChecks = { ...(tache?.checks || {}) }
    delete newChecks[userId]
    await supabase.from('taches').update({ shared_with: sw, checks: newChecks }).eq('id', tacheId)
    setTaches(prev => prev.map(t => t.id === tacheId ? { ...t, shared_with: sw, checks: newChecks } : t))
  }

  const profileName = (id) => {
    const p = profiles.find(p => p.id === id)
    return p ? (p.prenom || p.nom || p.email) : '—'
  }

  const prenom = profile?.prenom || user?.email?.split('@')[0] || 'vous'

  const isAdmin = profile?.role === 'admin'

  // Dossiers filtrés par commercial (pour briefing + table)
  const myDossiers = isAdmin && filtreCommercial !== 'all'
    ? dossiers.filter(d => d.assigne_a === filtreCommercial)
    : isAdmin ? dossiers
    : dossiers.filter(d => d.assigne_a === user?.id)

  // Filtre + tri
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

  // Dossiers actifs (hors perdu)
  const activeDossiers = myDossiers.filter(d => d.statut !== 'perdu')

  // Financier global (KPIs) — dossiers perdus exclus
  const finGlobal = activeDossiers.reduce((acc, d) => {
    const prime = d.prime_estimee || 0
    const cout  = d.montant_devis || 0
    const marge = prime > 0 ? Math.round((prime * 0.9 - cout) * 100) / 100 : 0
    const mwh   = simuMap[d.id]?.mwh_cumac || 0
    const isFacture = d.statut === 'facture'
    return {
      primePrev:   acc.primePrev   + (prime > 0 && !isFacture ? prime : 0),
      primeEnc:    acc.primeEnc    + (prime > 0 && isFacture  ? prime : 0),
      marge:       acc.marge       + marge,
      totalMwh:    acc.totalMwh    + mwh,
    }
  }, { primePrev: 0, primeEnc: 0, marge: 0, totalMwh: 0 })

  // Tâches du jour — dossiers perdus exclus
  const tachesByKey = TACHES.map(t => ({
    ...t,
    dossiers: activeDossiers.filter(d => t.statuts.includes(d.statut)),
  }))
  const totalTaches = tachesByKey.reduce((s, t) => s + t.dossiers.length, 0)

  const openDossier = (dossier) => {
    setCurrentDossier(dossier)
    navigate(`/dossier/${dossier.id}`)
  }

  const toggleSelect = (id, e) => {
    e.stopPropagation()
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
    setConfirmDeleteId(null)
  }

  const toggleSelectAll = () => {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(d => d.id)))
  }

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

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '16px 12px' : isCompact ? '20px 16px' : '28px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: isMobile ? 16 : 24, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: C.text, margin: 0, marginBottom: 3 }}>
              Bonjour {prenom} 👋
            </h1>
            <p style={{ fontSize: 13, color: C.textMid, margin: 0 }}>
              {totalTaches > 0 ? `${totalTaches} action${totalTaches > 1 ? 's' : ''} à traiter` : 'Aucune action en attente — belle journée !'}
              {' · '}{activeDossiers.filter(d => !['facture','archive'].includes(d.statut)).length} dossiers actifs
            </p>
          </div>
          <button onClick={() => setShowModal(true)} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 9, padding: isMobile ? '10px 16px' : '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', alignSelf: isMobile ? 'stretch' : 'auto', textAlign: 'center' }}>
            ➕ Nouveau dossier
          </button>
        </div>

        {/* ── Alertes proactives ── */}
        {!loading && (() => {
          const stagnants = activeDossiers.filter(d =>
            STATUTS_EN_COURS.includes(d.statut) &&
            Math.floor((Date.now() - new Date(d.updated_at)) / 86400000) > 14
          )
          const retard = taches.filter(t => !t.done && t.echeance && new Date(t.echeance) < new Date())
          if (stagnants.length === 0 && retard.length === 0) return null
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: isMobile ? 16 : 20 }}>
              {stagnants.length > 0 && (
                <div style={{ background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>⏳</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E', flexShrink: 0 }}>
                    {stagnants.length} dossier{stagnants.length > 1 ? 's' : ''} sans activité depuis +14 jours
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {stagnants.slice(0, 6).map(d => (
                      <span key={d.id} onClick={() => openDossier(d)}
                        style={{ background: '#fff', border: '1px solid #FCD34D', borderRadius: 6, padding: '2px 9px', fontSize: 11, color: '#92400E', cursor: 'pointer', fontWeight: 600, transition: 'background .1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FEF08A'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        {d.prospects?.raison_sociale || d.ref}
                      </span>
                    ))}
                    {stagnants.length > 6 && <span style={{ fontSize: 11, color: '#92400E', alignSelf: 'center' }}>+{stagnants.length - 6} autres</span>}
                  </div>
                </div>
              )}
              {retard.length > 0 && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>🔴</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', flexShrink: 0 }}>
                    {retard.length} tâche{retard.length > 1 ? 's' : ''} en retard
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {retard.slice(0, 4).map(t => (
                      <span key={t.id} style={{ background: '#fff', border: '1px solid #FCA5A5', borderRadius: 6, padding: '2px 9px', fontSize: 11, color: '#991B1B', fontWeight: 600 }}>
                        {t.titre.length > 28 ? t.titre.slice(0, 28) + '…' : t.titre}
                      </span>
                    ))}
                    {retard.length > 4 && <span style={{ fontSize: 11, color: '#991B1B', alignSelf: 'center' }}>+{retard.length - 4} autres</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Bloc tâches du jour ── */}
        {totalTaches > 0 && (
          <div style={{ marginBottom: 24 }}>

            {/* Titre + filtre commercial (boutons pills pour admin) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.07em' }}>Actions du jour</div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { value: 'all',    label: 'Tous' },
                    { value: user?.id, label: 'Mes actions' },
                    ...profiles.filter(p => ['admin','commercial'].includes(p.role) && p.id !== user?.id)
                      .map(p => ({ value: p.id, label: (`${p.prenom || ''} ${p.nom || ''}`.trim()) || p.email }))
                  ].map(opt => {
                    const active = filtreCommercial === opt.value
                    return (
                      <button key={opt.value} onClick={() => setFiltreCommercial(opt.value)}
                        style={{ border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 20, padding: '4px 13px', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', background: active ? C.accent : C.surface, color: active ? '#fff' : C.textMid, transition: 'all .15s' }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Cards tâches */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: isMobile ? 8 : 10 }}>
              {tachesByKey.filter(t => t.dossiers.length > 0).map(t => (
                <div key={t.label}>
                  <div
                    onClick={() => setBriefingOpen(briefingOpen === t.label ? null : t.label)}
                    style={{ background: briefingOpen === t.label ? t.border : t.bg, border: `1px solid ${t.border}`, borderRadius: briefingOpen === t.label ? '10px 10px 0 0' : 10, padding: '12px 14px', cursor: 'pointer', transition: 'all .15s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>{t.icon}</span>
                      <span style={{ fontSize: 22, fontWeight: 800, color: t.color }}>{t.dossiers.length}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.color }}>{t.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Panel pleine largeur sous les cards */}
            {briefingOpen && (() => {
              const t = tachesByKey.find(x => x.label === briefingOpen)
              if (!t) return null
              return (
                <div style={{ marginTop: 8, background: C.surface, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
                  {/* En-tête panel */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: `1px solid ${t.border}`, background: t.bg }}>
                    <span style={{ fontSize: 16 }}>{t.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.color }}>{t.label}</span>
                    <span style={{ fontSize: 12, color: t.color, opacity: .7 }}>— {t.dossiers.length} dossier{t.dossiers.length > 1 ? 's' : ''}</span>
                  </div>
                  {/* Lignes dossiers en grille */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                    {t.dossiers.map((d, idx) => (
                      <div key={d.id} onClick={() => openDossier(d)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 20px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, transition: 'background .1s', gap: 12 }}
                        onMouseEnter={e => e.currentTarget.style.background = C.bg}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{d.ref}</span>
                            <span style={{ fontSize: 12, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.prospects?.raison_sociale}</span>
                            {isAdmin && filtreCommercial === 'all' && (
                              <span style={{ fontSize: 10, background: C.accentSoft, color: C.accent, border: `1px solid ${C.border}`, borderRadius: 10, padding: '1px 7px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {profileName(d.assigne_a)}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                            {d.prospects?.contact_nom && <span style={{ fontSize: 11, color: C.textMid }}>👤 {d.prospects.contact_nom}</span>}
                            {d.prospects?.contact_tel && (
                              <a href={`tel:${d.prospects.contact_tel}`} onClick={e => e.stopPropagation()}
                                style={{ fontSize: 11, color: t.color, fontWeight: 700, textDecoration: 'none' }}>
                                📞 {d.prospects.contact_tel}
                              </a>
                            )}
                          </div>
                          {rappelsMap[d.id] && (
                            <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600, marginTop: 3 }}>
                              🕐 {new Date(rappelsMap[d.id]).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à {new Date(rappelsMap[d.id]).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: C.textSoft, flexShrink: 0, paddingTop: 2 }}>J+{daysSince(d.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

          </div>
        )}

        {/* ── Agenda + Tâches ── */}
        <div style={{ display: 'grid', gridTemplateColumns: (googleConnected && !isMobile) ? '1fr 1fr' : '1fr', gap: isMobile ? 12 : 16, marginBottom: isMobile ? 16 : 24 }}>

          {/* Panel Tâches */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>✅</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Mes tâches</span>
              {taches.filter(t => !t.done).length > 0 && (
                <span style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.border}`, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700, marginLeft: 'auto' }}>
                  {taches.filter(t => !t.done).length} à faire
                </span>
              )}
            </div>

            {/* Formulaire ajout */}
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, background: C.bg }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  value={tacheInput}
                  onChange={e => setTacheInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTache()}
                  placeholder="Nouvelle tâche…"
                  style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 10px', fontSize: 13, color: C.text, outline: 'none', fontFamily: 'inherit' }}
                />
                <button onClick={addTache} disabled={!tacheInput.trim() || tacheSaving}
                  style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: tacheInput.trim() ? 'pointer' : 'default', opacity: tacheInput.trim() ? 1 : .4, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  + Ajouter
                </button>
              </div>
              {tacheError && (
                <div style={{ fontSize: 11, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '5px 10px', marginBottom: 6 }}>
                  ⚠️ {tacheError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input type="date" value={tacheDate} onChange={e => setTacheDate(e.target.value)}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 12, color: C.textMid, fontFamily: 'inherit', outline: 'none' }} />
                <input type="time" value={tacheTime} onChange={e => setTacheTime(e.target.value)} disabled={!tacheDate}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 12, color: C.textMid, fontFamily: 'inherit', outline: 'none', opacity: tacheDate ? 1 : .4 }} />
                <select value={tacheDossierId} onChange={e => setTacheDossierId(e.target.value)}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 8px', fontSize: 12, color: C.textMid, fontFamily: 'inherit', outline: 'none', flex: 1, minWidth: 120, cursor: 'pointer' }}>
                  <option value="">Aucun dossier</option>
                  {myDossiers.map(d => (
                    <option key={d.id} value={d.id}>{d.ref} — {d.prospects?.raison_sociale}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Liste tâches */}
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {taches.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: C.textSoft, fontSize: 13 }}>
                  Aucune tâche — profitez-en ! 🎉
                </div>
              ) : (
                <>
                  {/* Tâches en retard ou du jour (non-done avec echeance passée ou auj) */}
                  {(() => {
                    const today = new Date(); today.setHours(23, 59, 59, 999)
                    const urgent = taches.filter(t => !t.done && t.echeance && new Date(t.echeance) <= today)
                    const upcoming = taches.filter(t => !t.done && (!t.echeance || new Date(t.echeance) > today))
                    const done = taches.filter(t => t.done)
                    const renderTache = (t) => {
                      const isLate    = !t.done && t.echeance && new Date(t.echeance) < new Date()
                      const isShared  = t.user_id !== user?.id   // tâche partagée vers moi
                      const isMine    = t.user_id === user?.id
                      const sharedWith = t.shared_with || []
                      const checks     = t.checks || {}
                      // Pour les tâches partagées vers moi : ma case est dans checks
                      const myCheck   = isShared ? !!(checks[user?.id]?.checked) : t.done
                      const dateStr = t.echeance
                        ? new Date(t.echeance).toLocaleDateString('fr-FR', {
                            weekday: 'short', day: 'numeric', month: 'short',
                            ...(t.echeance.split('T')[1] && t.echeance.split('T')[1] !== '00:00:00' ? { hour: '2-digit', minute: '2-digit' } : {}),
                          })
                        : null
                      const isEditing  = editingTacheId === t.id
                      const isSharing  = sharingTacheId === t.id

                      return (
                        <div key={t.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                          {/* Ligne principale */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 14px', transition: 'background .1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = C.bg}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {/* Checkbox */}
                            <input type="checkbox" checked={myCheck}
                              onChange={() => toggleTache(t.id, isShared ? myCheck : t.done, isShared)}
                              style={{ marginTop: 3, width: 15, height: 15, cursor: 'pointer', accentColor: C.accent, flexShrink: 0 }} />

                            {/* Contenu */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {isEditing ? (
                                /* ── Mode édition ── */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  <input value={editTitre} onChange={e => setEditTitre(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveEditTache(t.id); if (e.key === 'Escape') setEditingTacheId(null) }}
                                    autoFocus
                                    style={{ border: `1px solid ${C.accent}`, borderRadius: 5, padding: '4px 8px', fontSize: 13, color: C.text, background: C.surface, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
                                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                                      style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: '3px 6px', fontSize: 11, color: C.textMid, background: C.surface, fontFamily: 'inherit', outline: 'none' }} />
                                    <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} disabled={!editDate}
                                      style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: '3px 6px', fontSize: 11, color: C.textMid, background: C.surface, fontFamily: 'inherit', outline: 'none', opacity: editDate ? 1 : .4 }} />
                                    <button onClick={() => saveEditTache(t.id)}
                                      style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                      ✓ Enregistrer
                                    </button>
                                    <button onClick={() => setEditingTacheId(null)}
                                      style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* ── Affichage normal ── */
                                <>
                                  {isShared && (
                                    <div style={{ fontSize: 10, color: C.textSoft, marginBottom: 1 }}>
                                      👤 {profileName(t.user_id)}
                                    </div>
                                  )}
                                  <div style={{ fontSize: 13, color: (t.done || (isShared && myCheck)) ? C.textSoft : C.text, textDecoration: (t.done || (isShared && myCheck)) ? 'line-through' : 'none', wordBreak: 'break-word' }}>
                                    {t.titre}
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2, alignItems: 'center' }}>
                                    {dateStr && (
                                      <span style={{ fontSize: 11, color: isLate ? '#DC2626' : C.textMid, fontWeight: isLate ? 700 : 400 }}>
                                        {isLate ? '⚠️ ' : '📅 '}{dateStr}
                                      </span>
                                    )}
                                    {t.dossiers && (
                                      <span onClick={e => { e.stopPropagation(); const d = myDossiers.find(x => x.id === t.dossier_id); if (d) openDossier(d) }}
                                        style={{ fontSize: 11, color: C.accent, cursor: 'pointer', fontWeight: 600 }}>
                                        📂 {t.dossiers.ref}
                                      </span>
                                    )}
                                    {/* Qui a coché parmi les partagés */}
                                    {isMine && sharedWith.length > 0 && (
                                      <span style={{ fontSize: 10, color: C.textSoft, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {sharedWith.map(uid => {
                                          const chk = checks[uid]
                                          const nm  = profileName(uid)
                                          return (
                                            <span key={uid} title={chk?.checked ? `Coché par ${nm} le ${new Date(chk.checked_at).toLocaleDateString('fr-FR')}` : `${nm} — pas encore coché`}
                                              style={{ background: chk?.checked ? '#D1FAE5' : '#F1F5F9', color: chk?.checked ? '#059669' : C.textSoft, borderRadius: 20, padding: '1px 6px', border: `1px solid ${chk?.checked ? '#6EE7B7' : C.border}`, cursor: 'default' }}>
                                              {chk?.checked ? '✓' : '○'} {nm}
                                            </span>
                                          )
                                        })}
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Actions — uniquement si pas en mode édition */}
                            {!isEditing && (
                              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                {/* Éditer — seulement si je suis propriétaire */}
                                {isMine && (
                                  <button onClick={() => startEditTache(t)} title="Modifier"
                                    style={{ background: 'none', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 13, padding: '0 3px' }}
                                    onMouseEnter={e => e.currentTarget.style.color = C.accent}
                                    onMouseLeave={e => e.currentTarget.style.color = C.textSoft}>
                                    ✏️
                                  </button>
                                )}
                                {/* Partager — seulement si je suis propriétaire */}
                                {isMine && (
                                  <button onClick={() => setSharingTacheId(isSharing ? null : t.id)} title="Partager"
                                    style={{ background: 'none', border: 'none', color: isSharing ? C.accent : C.textSoft, cursor: 'pointer', fontSize: 13, padding: '0 3px' }}
                                    onMouseEnter={e => e.currentTarget.style.color = C.accent}
                                    onMouseLeave={e => e.currentTarget.style.color = isSharing ? C.accent : C.textSoft}>
                                    👥
                                  </button>
                                )}
                                {/* Supprimer (soft delete 24h) — seulement si je suis propriétaire */}
                                {isMine && (
                                  <button onClick={() => deleteTache(t.id)} title="Supprimer (reste visible 24h)"
                                    style={{ background: 'none', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                                    onMouseLeave={e => e.currentTarget.style.color = C.textSoft}>
                                    ×
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Panneau partage */}
                          {isSharing && isMine && (
                            <div style={{ padding: '8px 14px 10px 37px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .4 }}>
                                Partager avec…
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {profiles.filter(p => p.id !== user?.id).map(p => {
                                  const isAdded = sharedWith.includes(p.id)
                                  const nm = [p.prenom, p.nom].filter(Boolean).join(' ') || p.email
                                  return (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <input type="checkbox" checked={isAdded}
                                        onChange={() => isAdded ? unshareTache(t.id, p.id) : shareTache(t.id, p.id)}
                                        style={{ accentColor: C.accent, cursor: 'pointer' }} />
                                      <span style={{ fontSize: 12, color: C.text }}>{nm}</span>
                                      {isAdded && checks[p.id]?.checked && (
                                        <span style={{ fontSize: 11, color: '#059669', background: '#D1FAE5', borderRadius: 20, padding: '1px 7px' }}>
                                          ✓ coché le {new Date(checks[p.id].checked_at).toLocaleDateString('fr-FR')}
                                        </span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    }
                    return (
                      <>
                        {urgent.length > 0 && (
                          <div style={{ padding: '5px 14px 2px', fontSize: 10, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: .4, background: 'rgba(220,38,38,0.07)' }}>
                            ⚠️ À traiter
                          </div>
                        )}
                        {urgent.map(renderTache)}
                        {upcoming.length > 0 && urgent.length > 0 && (
                          <div style={{ padding: '5px 14px 2px', fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .4 }}>
                            À venir
                          </div>
                        )}
                        {upcoming.map(renderTache)}
                        {done.length > 0 && (
                          <>
                            <div style={{ padding: '5px 14px 2px', fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .4 }}>
                              Terminées
                            </div>
                            {done.map(renderTache)}
                          </>
                        )}
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          </div>

          {/* Panel Agenda — affiché seulement si Google connecté */}
          {googleConnected && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>📅</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Agenda — 7 prochains jours</span>
                <button onClick={() => navigate('/planning')}
                  style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Voir tout →
                </button>
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {agendaEvents.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: C.textSoft, fontSize: 13 }}>
                    Aucun événement ces 7 prochains jours 🎉
                  </div>
                ) : (() => {
                  // Grouper les events par jour (J0 à J+6)
                  const todayStart = new Date(); todayStart.setHours(0,0,0,0)
                  // L'API renvoie des events normalisés : ev.start/end = ISO string,
                  // ev.startLabel/endLabel = heure Paris formatée, ev.isAllDay, ev.dayKey = "YYYY-MM-DD"
                  const days = Array.from({ length: 7 }, (_, i) => {
                    const dayStart = new Date(todayStart.getTime() + i * 86400000)
                    const dayEnd   = new Date(dayStart.getTime() + 86400000)
                    const isToday    = i === 0
                    const isTomorrow = i === 1
                    const label = isToday ? 'Aujourd\'hui'
                      : isTomorrow ? 'Demain'
                      : dayStart.toLocaleDateString('fr-FR', { weekday: 'long' })
                    const dateLabel = dayStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
                    const evs = agendaEvents.filter(ev => {
                      const d = new Date(ev.start)
                      return d >= dayStart && d < dayEnd
                    })
                    return { label, dateLabel, isToday, evs }
                  }).filter(d => d.evs.length > 0)

                  const renderEv = (ev) => {
                    const timeStr = ev.isAllDay
                      ? 'Journée entière'
                      : ev.startLabel
                        ? `${ev.startLabel}${ev.endLabel ? ' – ' + ev.endLabel : ''}`
                        : '—'
                    return (
                      <div key={ev.id} style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ flexShrink: 0, width: 52, textAlign: 'right' }}>
                          {ev.isAllDay ? (
                            <div style={{ fontSize: 10, color: C.textSoft, fontStyle: 'italic' }}>J. entière</div>
                          ) : (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{ev.startLabel}</div>
                              {ev.endLabel && <div style={{ fontSize: 10, color: C.textSoft }}>{ev.endLabel}</div>}
                            </>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.summary || '(Sans titre)'}</div>
                          {ev.location && <div style={{ fontSize: 11, color: C.textMid, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {ev.location}</div>}
                          {ev.attendees && ev.attendees.length > 1 && (
                            <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>👥 {ev.attendees.length} participant{ev.attendees.length > 1 ? 's' : ''}</div>
                          )}
                        </div>
                        {ev.hangoutLink && (
                          <a href={ev.hangoutLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            style={{ flexShrink: 0, background: '#0D9488', color: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, textDecoration: 'none' }}>
                            🎥 Meet
                          </a>
                        )}
                      </div>
                    )
                  }

                  return days.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: C.textSoft, fontSize: 13 }}>
                      Aucun événement à venir 🎉
                    </div>
                  ) : (
                    <>
                      {days.map(({ label, dateLabel, isToday, evs }) => (
                        <div key={dateLabel}>
                          <div style={{ padding: '7px 16px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4, background: isToday ? C.accentSoft : C.bg, color: isToday ? C.accent : C.textMid }}>
                            {label} · {dateLabel}
                          </div>
                          {evs.map(renderEv)}
                        </div>
                      ))}
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>

        {/* ── Filtres + recherche ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isMobile ? 'Rechercher…' : 'Rechercher référence, prospect, contact…'}
            style={{ ...INP, flex: 1, minWidth: isMobile ? 0 : 200, fontSize: 14, padding: '10px 16px', borderRadius: 9, width: isMobile ? '100%' : 'auto' }}/>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
            {isAdmin && (
              <select value={filtreCommercial} onChange={e => setFiltreCommercial(e.target.value)}
                style={{ ...INP, flex: isMobile ? 1 : 'none', width: isMobile ? 'auto' : 170, padding: '10px 12px', borderRadius: 9, cursor: 'pointer' }}>
                <option value="all">Tous les commerciaux</option>
                {profiles.filter(p => ['admin','commercial'].includes(p.role)).map(p => (
                  <option key={p.id} value={p.id}>{(`${p.prenom || ''} ${p.nom || ''}`.trim()) || p.email}</option>
                ))}
              </select>
            )}
            <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}
              style={{ ...INP, flex: isMobile ? 1 : 'none', width: isMobile ? 'auto' : 160, padding: '10px 12px', borderRadius: 9, cursor: 'pointer' }}>
              <option value="all">Tous les statuts</option>
              {STATUTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
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

        {/* ── Liste dossiers ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: C.textMid }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>Aucun dossier</div>
            <div style={{ fontSize: 13, color: C.textMid }}>Créez votre premier dossier pour démarrer</div>
          </div>
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto' }}>
          <div style={{ minWidth: 820 }}>
            {/* En-tête */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 72px 1fr 90px 110px 72px 105px 105px 70px 62px 34px', gap: 8, padding: '9px 14px', background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .4, alignItems: 'center' }}>
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
              const isConfirm  = confirmDeleteId === d.id
              const isPerdu    = d.statut === 'perdu'
              const prime      = d.prime_estimee || 0
              const cout       = d.montant_devis || 0
              const margeNette = prime > 0 ? Math.round((prime * 0.9 - cout) * 100) / 100 : null
              const mwh        = simuMap[d.id]?.mwh_cumac || null
              const jPlus      = daysSince(d.created_at)
              return (
                <div key={d.id}
                  onClick={() => !isDeleting && openDossier(d)}
                  style={{ display: 'grid', gridTemplateColumns: '28px 72px 1fr 90px 110px 72px 105px 105px 70px 62px 34px', gap: 8, padding: '12px 16px', alignItems: 'center', background: isSelected ? C.accentSoft : isPerdu ? 'rgba(220,38,38,0.07)' : idx % 2 === 0 ? C.surface : C.bg, borderBottom: `1px solid ${C.border}`, cursor: isDeleting ? 'default' : 'pointer', opacity: isDeleting ? .5 : isPerdu ? 0.7 : 1, transition: 'background .1s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.accentSoft }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? C.surface : C.bg }}>

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

            {/* Footer count */}
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
        />
      )}
    </div>
  )
}
