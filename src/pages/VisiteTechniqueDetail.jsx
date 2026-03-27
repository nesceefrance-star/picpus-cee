import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { pdf } from '@react-pdf/renderer'
import PhotoSection from '../components/visite/PhotoSection'
import VisiteRapportPDF from '../components/visite/VisiteRapportPDF'

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}
const INP = {
  width: '100%', boxSizing: 'border-box', background: C.bg,
  border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px',
  color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
const SEL = { ...INP, cursor: 'pointer' }

// ── Fiches CEE ───────────────────────────────────────────────────────────────
export const FICHES_CEE = {
  'BAT-TH-116': { label: 'BAT-TH-116 — GTB',                       zones: ['chaufferie','tgbt','td'] },
  'BAT-TH-142': { label: 'BAT-TH-142 — Déstratification tertiaire', zones: ['chaufferie','tgbt','td'] },
  'IND-BA-110': { label: 'IND-BA-110 — Déstratification industrie', zones: ['chaufferie','tgbt','td'] },
  'BAT-TH-163': { label: 'BAT-TH-163 — PAC air/eau tertiaire',      zones: ['chaufferie','tgbt','td'] },
  'BAT-TH-125': { label: 'BAT-TH-125 — Ventilation simple flux',    zones: ['ventilation'] },
  'BAT-TH-126': { label: 'BAT-TH-126 — Ventilation double flux',    zones: ['ventilation'] },
  'BAT-EN-101': { label: 'BAT-EN-101 — Isolation combles/toiture',  zones: ['isolation'] },
  'BAT-EN-102': { label: 'BAT-EN-102 — Isolation murs',             zones: ['isolation'] },
  'BAT-EN-103': { label: 'BAT-EN-103 — Isolation plancher',         zones: ['isolation'] },
}

// ── Toutes les zones disponibles ─────────────────────────────────────────────
const ALL_ZONES = [
  { id: 'infos',        icon: '📋', title: 'Infos générales',         photoCats: [] },
  { id: 'vue_generale', icon: '🏭', title: 'Vue générale & Bâtiment', photoCats: ['vue_generale'] },
  { id: 'chaufferie',   icon: '🔥', title: 'Chaufferie',              photoCats: ['chaufferie'] },
  { id: 'tgbt',         icon: '⚡', title: 'TGBT',                    photoCats: ['tgbt'] },
  { id: 'td',           icon: '🔌', title: 'Tableau divisionnaire',   photoCats: ['td'] },
  { id: 'ventilation',  icon: '💨', title: 'Ventilation',             photoCats: ['ventilation'] },
  { id: 'isolation',    icon: '🏠', title: 'Isolation',               photoCats: ['isolation'] },
  { id: 'equipements',  icon: '🔧', title: 'Équipements & CEE',       photoCats: ['equipements', 'plaque_constructeur', 'compteur'] },
  { id: 'observations', icon: '📝', title: 'Observations',            photoCats: ['observations', 'autres'] },
  { id: 'rapport',      icon: '📄', title: 'Rapport & Envoi',         photoCats: [] },
]

function getActiveZones(fiches) {
  if (!fiches || fiches.length === 0) return ALL_ZONES
  const needed = new Set(['infos','vue_generale','equipements','observations','rapport'])
  fiches.forEach(f => { (FICHES_CEE[f]?.zones || []).forEach(z => needed.add(z)) })
  return ALL_ZONES.filter(z => needed.has(z.id))
}

// ── Types d'isolation ────────────────────────────────────────────────────────
const ISOLATION_TYPES = [
  { id: 'toiture_terrasse',  label: 'Toiture terrasse' },
  { id: 'combles_perdus',    label: 'Combles perdus' },
  { id: 'combles_amenages',  label: 'Combles aménagés' },
  { id: 'murs_interieurs',   label: 'Murs intérieurs' },
  { id: 'murs_exterieurs',   label: 'Murs extérieurs' },
  { id: 'planchers_bas',     label: 'Planchers bas' },
]

// ── Autocomplete adresse ─────────────────────────────────────────────────────
function AdresseAutocomplete({ value, onChange }) {
  const [sugg, setSugg]   = useState([])
  const [open, setOpen]   = useState(false)
  const timer             = useRef(null)
  const queryRef          = useRef('')

  const search = (q) => {
    queryRef.current = q
    onChange(q)
    clearTimeout(timer.current)
    if (q.length < 3) { setSugg([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try {
        const res  = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`)
        const data = await res.json()
        setSugg(data.features || [])
        setOpen((data.features || []).length > 0)
      } catch {}
    }, 300)
  }

  const buildLabel = (feat) => {
    const p = feat.properties
    const num = queryRef.current.match(/^(\d+[a-zA-Z]?)/)?.[1]
    if (num && p.type !== 'housenumber' && !p.label.startsWith(num)) return num + ' ' + p.label
    return p.label || ''
  }

  const select = (feat) => { onChange(buildLabel(feat)); setSugg([]); setOpen(false) }

  return (
    <div style={{ position: 'relative' }}>
      <input value={value || ''} onChange={e => search(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 350)}
        placeholder="12 rue des Acacias, 75012 Paris…" style={INP} />
      {open && sugg.length > 0 && (
        <div onMouseDown={e => e.preventDefault()}
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200, overflow: 'hidden' }}>
          {sugg.map((f, i) => (
            <div key={i} onClick={() => select(f)} onTouchEnd={e => { e.preventDefault(); select(f) }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.bg}`, fontSize: 13, color: C.text }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {buildLabel(f)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Champ générique ──────────────────────────────────────────────────────────
function Field({ label, hint, children, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid }}>
        {label}
        {hint && <span style={{ fontSize: 11, fontWeight: 400, color: C.textSoft, marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

// ── Sous-section ─────────────────────────────────────────────────────────────
function SubSection({ title, children }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: C.bg, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: C.textMid, borderBottom: `1px solid ${C.border}` }}>
        {title}
      </div>
      <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {children}
      </div>
    </div>
  )
}

// ── En-tête de zone ──────────────────────────────────────────────────────────
function ZoneHeader({ zone, photoCount, active, onClick }) {
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', cursor: 'pointer', borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent', userSelect: 'none' }}>
      <span style={{ fontSize: 20 }}>{zone.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: active ? C.accent : C.text }}>{zone.title}</div>
        {photoCount > 0 && <div style={{ fontSize: 11, color: C.textSoft, marginTop: 1 }}>📷 {photoCount}</div>}
      </div>
      <span style={{ fontSize: 12, color: C.textSoft }}>{active ? '▲' : '▼'}</span>
    </div>
  )
}

export default function VisiteTechniqueDetail() {
  const { id }               = useParams()
  const navigate             = useNavigate()
  const { profile, session, dossiers: storeDossiers, fetchDossiers } = useStore()
  const isNew                = id === 'new'

  const [visiteId,    setVisiteId]    = useState(isNew ? null : id)
  const [donnees,     setDonnees]     = useState({ date_visite: new Date().toISOString().split('T')[0] })
  const [photos,      setPhotos]      = useState([])
  const [statut,      setStatut]      = useState('brouillon')
  const [dossier,     setDossier]     = useState(null)
  const [dossierRef,  setDossierRef]  = useState('')
  const [loading,     setLoading]     = useState(!isNew)
  const [saveStatus,  setSaveStatus]  = useState('saved')
  const [generating,  setGenerating]  = useState(false)
  const [sending,     setSending]     = useState(false)
  const [emailResult, setEmailResult] = useState(null)
  const [rapportUrl,  setRapportUrl]  = useState(null)
  const [token,       setToken]       = useState(null)
  const [activeZone,  setActiveZone]  = useState('infos')

  const [allDossiers,   setAllDossiers]   = useState([])
  const [dossierSearch, setDossierSearch] = useState('')
  const [dossierOpen,   setDossierOpen]   = useState(false)

  const zoneRefs  = useRef({})
  const saveTimer = useRef(null)

  // Zones dynamiques selon fiches sélectionnées
  const zones = useMemo(() => getActiveZones(donnees.fiches || []), [donnees.fiches])

  // ── Chargement ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!storeDossiers.length) fetchDossiers()
    if (!isNew) loadVisite()
  }, [id])

  // allDossiers — utilise le store (prospects déjà joints) avec fallback query si vide
  useEffect(() => {
    if (storeDossiers.length) setAllDossiers(storeDossiers)
  }, [storeDossiers])

  const loadVisite = async () => {
    setLoading(true)
    const { data } = await supabase.from('visites_techniques').select('*').eq('id', id).single()
    if (!data) { navigate('/visites', { replace: true }); return }
    // Migration : si pas de fiches dans donnees mais type_fiche présent
    const donneesMigrees = data.donnees || {}
    if (!donneesMigrees.fiches && data.type_fiche) {
      donneesMigrees.fiches = [data.type_fiche]
    }
    setDonnees(donneesMigrees)
    setPhotos(data.photos || [])
    setStatut(data.statut)
    setRapportUrl(data.rapport_url)
    setToken(data.partage_token)
    if (data.dossier_id) {
      const { data: dos } = await supabase.from('dossiers')
        .select('id, ref, prospect_id, type_fiche').eq('id', data.dossier_id).single()
      if (dos) {
        let raisonSociale = ''
        if (dos.prospect_id) {
          const { data: pro } = await supabase.from('prospects')
            .select('raison_sociale').eq('id', dos.prospect_id).single()
          raisonSociale = pro?.raison_sociale || ''
        }
        setDossier({ ...dos, prospects: { raison_sociale: raisonSociale } })
        setDossierRef(dos.ref)
      }
    }
    setLoading(false)
  }

  // ── Création + autosave ─────────────────────────────────────────────────────
  const ensureCreated = useCallback(async (d, p) => {
    if (visiteId) return visiteId
    const fiches = d.fiches || []
    const typeFiche = fiches[0] || 'IND-BA-110'
    const { data, error } = await supabase.from('visites_techniques').insert({
      created_by: profile?.id, type_fiche: typeFiche, statut: 'brouillon', donnees: d, photos: p,
    }).select().single()
    if (error) throw error
    setVisiteId(data.id)
    setToken(data.partage_token)
    navigate(`/visites/${data.id}`, { replace: true })
    return data.id
  }, [visiteId, profile?.id, navigate])

  const scheduleSave = useCallback((newDonnees) => {
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const vid = await ensureCreated(newDonnees, photos)
        const typeFiche = (newDonnees.fiches || [])[0] || 'IND-BA-110'
        await supabase.from('visites_techniques').update({
          donnees: newDonnees, type_fiche: typeFiche, updated_at: new Date().toISOString(),
        }).eq('id', vid)
        setSaveStatus('saved')
      } catch { setSaveStatus('error') }
    }, 1500)
  }, [ensureCreated, photos])

  const set = (key, val) => {
    const nd = { ...donnees, [key]: val }
    setDonnees(nd)
    scheduleSave(nd)
  }
  const v = (key, def = '') => donnees?.[key] ?? def

  const handlePhotosChange = async (newPhotos) => {
    setPhotos(newPhotos)
    setSaveStatus('saving')
    try {
      const vid = await ensureCreated(donnees, newPhotos)
      await supabase.from('visites_techniques').update({ photos: newPhotos, updated_at: new Date().toISOString() }).eq('id', vid)
      setSaveStatus('saved')
    } catch { setSaveStatus('error') }
  }

  // ── Fiche toggle ─────────────────────────────────────────────────────────────
  const toggleFiche = (ficheId) => {
    const current = donnees.fiches || []
    const dossierFiche = dossier?.type_fiche
    const isLocked = ficheId === dossierFiche
    if (isLocked) return // la fiche du dossier ne peut pas être décochée
    const newFiches = current.includes(ficheId)
      ? current.filter(f => f !== ficheId)
      : [...current, ficheId]
    set('fiches', newFiches)
  }

  // ── Dossier ─────────────────────────────────────────────────────────────────
  const dossierResults = dossierSearch.length > 0
    ? allDossiers.filter(d =>
        d.ref?.toLowerCase().includes(dossierSearch.toLowerCase()) ||
        d.prospects?.raison_sociale?.toLowerCase().includes(dossierSearch.toLowerCase())
      ).slice(0, 8)
    : []

  const selectDossier = async (d) => {
    setDossier(d); setDossierRef(d.ref); setDossierSearch(''); setDossierOpen(false)
    const p = d.prospects || {}
    const adresseProspect = [p.adresse, p.code_postal, p.ville].filter(Boolean).join(', ')
    // Pré-sélectionner la fiche du dossier
    const currentFiches = donnees.fiches || []
    const fichesDossier = d.type_fiche && !currentFiches.includes(d.type_fiche)
      ? [d.type_fiche, ...currentFiches]
      : currentFiches
    const nd = {
      ...donnees,
      fiches:         fichesDossier,
      raison_sociale: donnees.raison_sociale || p.raison_sociale || '',
      adresse_site:   donnees.adresse_site   || d.adresse_site   || adresseProspect || '',
      contact_nom:    donnees.contact_nom    || p.contact_nom    || '',
      contact_tel:    donnees.contact_tel    || p.contact_tel    || '',
    }
    setDonnees(nd)
    const vid = await ensureCreated(nd, photos)
    await supabase.from('visites_techniques').update({
      dossier_id: d.id, donnees: nd, type_fiche: fichesDossier[0] || 'IND-BA-110',
    }).eq('id', vid)
    setSaveStatus('saved')
  }

  const unlinkDossier = async () => {
    setDossier(null); setDossierRef('')
    if (visiteId) await supabase.from('visites_techniques').update({ dossier_id: null }).eq('id', visiteId)
  }

  // ── Statut ──────────────────────────────────────────────────────────────────
  const toggleStatut = async () => {
    const ns = statut === 'validée' ? 'brouillon' : 'validée'
    const vid = await ensureCreated(donnees, photos)
    await supabase.from('visites_techniques').update({ statut: ns }).eq('id', vid)
    setStatut(ns)
  }

  // ── Navigation zones ────────────────────────────────────────────────────────
  const goToZone = (zoneId) => {
    setActiveZone(zoneId)
    setTimeout(() => zoneRefs.current[zoneId]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const nextZone = (currentId) => {
    const idx = zones.findIndex(z => z.id === currentId)
    if (idx < zones.length - 1) goToZone(zones[idx + 1].id)
  }

  // ── Rapport PDF ─────────────────────────────────────────────────────────────
  const genererRapport = async () => {
    setGenerating(true)
    try {
      const vid = await ensureCreated(donnees, photos)
      const blob = await pdf(<VisiteRapportPDF visite={{ id: vid, donnees, photos, statut }} dossierRef={dossierRef} />).toBlob()
      const fileName = `rapport_${vid}_${Date.now()}.pdf`
      await supabase.storage.from('visites-photos').upload(`${vid}/${fileName}`, blob, { contentType: 'application/pdf', upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('visites-photos').getPublicUrl(`${vid}/${fileName}`)
      setRapportUrl(publicUrl)
      await supabase.from('visites_techniques').update({ rapport_url: publicUrl }).eq('id', vid)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `Rapport_Visite_${dossierRef || vid}.pdf`; a.click(); URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur PDF : ' + e.message) }
    finally { setGenerating(false) }
  }

  const envoyerEmail = async () => {
    if (!rapportUrl) return alert('Générez d\'abord le rapport PDF.')
    if (!donnees.prestataire_email) return alert('Renseignez l\'email du prestataire.')
    setSending(true); setEmailResult(null)
    try {
      const res = await fetch('/api/rapport-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          visiteId: visiteId || id, prestataireEmail: donnees.prestataire_email,
          prestataireNom: donnees.prestataire_nom || '', nomSite: donnees.nom_site || donnees.raison_sociale || '',
          rapportUrl, partageUrl: `${window.location.origin}/rapport/${token}`, dossierRef,
        }),
      })
      const data = await res.json()
      setEmailResult(data.gmailUrl ? { success: true, gmailUrl: data.gmailUrl } : { success: false, error: data.error })
    } catch (e) { setEmailResult({ success: false, error: e.message }) }
    finally { setSending(false) }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const zonePhotoCount = (zone) => photos.filter(p => zone.photoCats.includes(p.categorie)).length
  const nom = donnees.nom_site || donnees.raison_sociale || (isNew ? 'Nouvelle visite' : 'Sans nom')
  const selectedFiches = donnees.fiches || []

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.textSoft }}>Chargement…</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Barre fixe en haut ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 24px', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 980, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate('/visites')} style={{ background: 'none', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}>←</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{nom}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                {selectedFiches.length > 0
                  ? selectedFiches.map(f => (
                    <span key={f} style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '1px 7px', borderRadius: 5 }}>{f}</span>
                  ))
                  : <span style={{ fontSize: 11, color: C.textSoft }}>Aucune fiche sélectionnée</span>
                }
                {dossierRef && <span style={{ fontSize: 11, color: C.accent }}>📁 {dossierRef}</span>}
                <span style={{ fontSize: 11, color: saveStatus === 'saving' ? '#D97706' : saveStatus === 'error' ? '#DC2626' : '#16A34A' }}>
                  {saveStatus === 'saving' ? '⏳ Enregistrement…' : saveStatus === 'error' ? '⚠ Erreur' : '✓ Enregistré'}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ background: statut === 'validée' ? '#DCFCE7' : '#FEF3C7', color: statut === 'validée' ? '#15803D' : '#D97706', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
              {statut === 'validée' ? '✓ Validée' : '✏ Brouillon'}
            </span>
            <button onClick={toggleStatut} style={{ background: statut === 'validée' ? C.bg : '#16A34A', color: statut === 'validée' ? C.textMid : '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {statut === 'validée' ? 'Reprendre' : 'Valider'}
            </button>
          </div>
        </div>

        {/* Navigation zones */}
        <div style={{ display: 'flex', gap: 4, marginTop: 10, maxWidth: 980, margin: '10px auto 0', overflowX: 'auto', paddingBottom: 2 }}>
          {zones.map(z => {
            const pc = zonePhotoCount(z)
            return (
              <button key={z.id} onClick={() => goToZone(z.id)}
                style={{ background: activeZone === z.id ? C.accent : C.bg, color: activeZone === z.id ? '#fff' : C.textMid, border: `1px solid ${activeZone === z.id ? C.accent : C.border}`, borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: activeZone === z.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {z.icon} {z.title}{pc > 0 ? ` (${pc})` : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Contenu scrollable ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {zones.map((zone, zoneIdx) => {
            const isActive = activeZone === zone.id
            const photoCnt = zonePhotoCount(zone)

            return (
              <div key={zone.id} ref={el => zoneRefs.current[zone.id] = el}
                style={{ background: C.surface, border: `1px solid ${isActive ? C.accent : C.border}`, borderRadius: 12, transition: 'border-color .2s' }}>

                <ZoneHeader zone={zone} photoCount={photoCnt} active={isActive}
                  onClick={() => setActiveZone(isActive ? '' : zone.id)} />

                {isActive && (
                  <div style={{ padding: '20px 20px 24px', borderTop: `1px solid ${C.bg}` }}>

                    {/* ══ INFOS GÉNÉRALES ══ */}
                    {zone.id === 'infos' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Fiches CEE */}
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 6 }}>
                            📋 Fiches CEE concernées
                          </label>
                          {dossier?.type_fiche && (
                            <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 6 }}>
                              La fiche du dossier est pré-sélectionnée et ne peut pas être retirée.
                            </div>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                            {Object.entries(FICHES_CEE).map(([ficheId, cfg]) => {
                              const isSel    = selectedFiches.includes(ficheId)
                              const isLocked = ficheId === dossier?.type_fiche
                              return (
                                <button key={ficheId} onClick={() => toggleFiche(ficheId)}
                                  style={{
                                    padding: '6px 12px', borderRadius: 7, fontSize: 12, cursor: isLocked ? 'default' : 'pointer',
                                    fontFamily: 'inherit', fontWeight: isSel ? 700 : 400,
                                    border: `1px solid ${isSel ? C.accent : C.border}`,
                                    background: isSel ? '#EFF6FF' : C.bg,
                                    color: isSel ? C.accent : C.textMid,
                                    opacity: isLocked ? .85 : 1,
                                    position: 'relative',
                                  }}>
                                  {isSel && <span style={{ marginRight: 4 }}>✓</span>}
                                  {cfg.label}
                                  {isLocked && <span style={{ marginLeft: 4, fontSize: 10, opacity: .6 }}>🔒</span>}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Dossier lié */}
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 6 }}>
                            📁 Dossier lié <span style={{ fontWeight: 400, color: C.textSoft }}>(optionnel)</span>
                          </label>
                          {dossier ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px' }}>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>📁 {dossier.ref} — {dossier.prospects?.raison_sociale}</span>
                              <button onClick={unlinkDossier} style={{ background: 'none', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 16 }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ position: 'relative' }}>
                              <input
                                value={dossierSearch}
                                onChange={e => { setDossierSearch(e.target.value); setDossierOpen(true) }}
                                onFocus={() => setDossierOpen(true)}
                                onBlur={() => setTimeout(() => setDossierOpen(false), 350)}
                                placeholder="Rechercher par référence ou raison sociale…"
                                style={INP}
                              />
                              {dossierOpen && dossierSearch.length > 0 && (
                                <div onMouseDown={e => e.preventDefault()}
                                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 9999, overflow: 'hidden' }}>
                                  {dossierResults.length > 0 ? dossierResults.map(d => (
                                    <div key={d.id}
                                      onClick={() => selectDossier(d)}
                                      onTouchEnd={e => { e.preventDefault(); selectDossier(d) }}
                                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.bg}`, fontSize: 13, color: C.text }}
                                      onMouseEnter={e => e.currentTarget.style.background = C.bg}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                      <strong>{d.ref}</strong> — {d.prospects?.raison_sociale}
                                      {d.type_fiche && <span style={{ fontSize: 11, color: C.textSoft, marginLeft: 8 }}>{d.type_fiche}</span>}
                                    </div>
                                  )) : (
                                    <div style={{ padding: '10px 14px', fontSize: 13, color: C.textSoft, fontStyle: 'italic' }}>
                                      Aucun dossier trouvé{allDossiers.length === 0 ? ' — chargement en cours…' : ''}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Champs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                          <Field label="Raison sociale">
                            <input style={INP} value={v('raison_sociale')} onChange={e => set('raison_sociale', e.target.value)} placeholder="SARL Dupont Industrie" />
                          </Field>
                          <Field label="Nom du site">
                            <input style={INP} value={v('nom_site')} onChange={e => set('nom_site', e.target.value)} placeholder="Atelier principal" />
                          </Field>
                          <Field label="Adresse du site" hint="autocomplétion" full>
                            <AdresseAutocomplete value={v('adresse_site')} onChange={val => set('adresse_site', val)} />
                          </Field>
                          <Field label="Contact sur site">
                            <input style={INP} value={v('contact_nom')} onChange={e => set('contact_nom', e.target.value)} placeholder="Prénom Nom" />
                          </Field>
                          <Field label="Téléphone contact">
                            <input style={INP} value={v('contact_tel')} onChange={e => set('contact_tel', e.target.value)} placeholder="06 00 00 00 00" />
                          </Field>
                          <Field label="Date de visite">
                            <input style={INP} type="date" value={v('date_visite')} onChange={e => set('date_visite', e.target.value)} />
                          </Field>
                        </div>
                      </div>
                    )}

                    {/* ══ VUE GÉNÉRALE & BÂTIMENT ══ */}
                    {zone.id === 'vue_generale' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} showCategories={zone.photoCats} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                          <Field label="Type de bâtiment">
                            <select style={SEL} value={v('type_batiment')} onChange={e => set('type_batiment', e.target.value)}>
                              <option value="">— Sélectionner —</option>
                              <optgroup label="Industrie / Logistique">
                                <option value="atelier_industriel">Atelier industriel</option>
                                <option value="entrepot_logistique">Entrepôt logistique</option>
                                <option value="atelier_artisanal">Atelier artisanal</option>
                                <option value="batiment_agricole">Bâtiment agricole</option>
                              </optgroup>
                              <optgroup label="Tertiaire">
                                <option value="immeubles_bureaux">Immeubles de bureaux</option>
                                <option value="centre_commercial">Centre commercial</option>
                                <option value="batiment_sante">Bâtiment santé</option>
                                <option value="enseignement">Enseignement</option>
                                <option value="hotellerie_restauration">Hôtellerie / Restauration</option>
                              </optgroup>
                              <option value="autre">Autre</option>
                            </select>
                          </Field>
                          <Field label="Zone climatique" hint="(calcul CEE)">
                            <select style={SEL} value={v('zone_climatique')} onChange={e => set('zone_climatique', e.target.value)}>
                              <option value="">— Sélectionner —</option>
                              <option value="H1">H1 — Nord / Est</option>
                              <option value="H2">H2 — Centre / Ouest</option>
                              <option value="H3">H3 — Sud / Méditerranée</option>
                            </select>
                          </Field>
                          <Field label="Surface chauffée (m²)">
                            <input style={INP} type="number" min="0" value={v('surface_chauffee_m2')} onChange={e => set('surface_chauffee_m2', e.target.value)} placeholder="Ex: 1200" />
                          </Field>
                          <Field label="Hauteur sous plafond (m)">
                            <input style={INP} type="number" min="0" step="0.1" value={v('hauteur_sous_plafond_m')} onChange={e => set('hauteur_sous_plafond_m', e.target.value)} placeholder="Ex: 6" />
                          </Field>
                          <Field label="Isolation du bâtiment">
                            <select style={SEL} value={v('isolation_batiment')} onChange={e => set('isolation_batiment', e.target.value)}>
                              <option value="">— Sélectionner —</option>
                              <option value="bonne">Bonne (double vitrage, isolation toiture)</option>
                              <option value="partielle">Partielle</option>
                              <option value="faible">Faible / Non isolé</option>
                            </select>
                          </Field>
                        </div>
                      </div>
                    )}

                    {/* ══ CHAUFFERIE ══ */}
                    {zone.id === 'chaufferie' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} showCategories={zone.photoCats} />

                        {/* Production */}
                        <SubSection title="🔥 Production">
                          <Field label="Type d'installation">
                            <select style={SEL} value={v('type_installation')} onChange={e => set('type_installation', e.target.value)}>
                              <option value="">— Sélectionner —</option>
                              <option value="chaudiere">Chaudière</option>
                              <option value="aerotherme">Aérotherme</option>
                              <option value="radiateur">Radiateur</option>
                              <option value="generateur_air">Générateur air chaud</option>
                              <option value="plancher_chauffant">Plancher chauffant</option>
                              <option value="pompe_chaleur">Pompe à chaleur</option>
                              <option value="autre">Autre</option>
                            </select>
                          </Field>
                          <Field label="Marque">
                            <input style={INP} value={v('marque')} onChange={e => set('marque', e.target.value)} placeholder="Ex: De Dietrich" />
                          </Field>
                          <Field label="Modèle / Référence">
                            <input style={INP} value={v('modele')} onChange={e => set('modele', e.target.value)} placeholder="Ex: Vitodens 200-W" />
                          </Field>
                          <Field label="Année de fabrication">
                            <input style={INP} type="number" min="1950" max="2030" value={v('annee_fabrication')} onChange={e => set('annee_fabrication', e.target.value)} placeholder="Ex: 2008" />
                          </Field>
                          <Field label="Puissance nominale (kW)">
                            <input style={INP} type="number" min="0" step="0.1" value={v('puissance_nominale_kw')} onChange={e => set('puissance_nominale_kw', e.target.value)} placeholder="Ex: 150" />
                          </Field>
                          <Field label="Combustible actuel">
                            <select style={SEL} value={v('combustible')} onChange={e => set('combustible', e.target.value)}>
                              <option value="">— Sélectionner —</option>
                              <option value="gaz_naturel">Gaz naturel</option>
                              <option value="gpl">GPL</option>
                              <option value="fioul">Fioul</option>
                              <option value="electricite">Électricité</option>
                              <option value="bois_granules">Bois / Granulés</option>
                              <option value="autre">Autre</option>
                            </select>
                          </Field>
                          <Field label="Température de consigne (°C)">
                            <input style={INP} type="number" min="5" max="30" value={v('temperature_consigne')} onChange={e => set('temperature_consigne', e.target.value)} placeholder="Ex: 16" />
                          </Field>
                          <Field label="Heures de fonctionnement / an">
                            <input style={INP} type="number" min="0" max="8760" value={v('heures_fonctionnement')} onChange={e => set('heures_fonctionnement', e.target.value)} placeholder="Ex: 3000" />
                          </Field>
                          <Field label="État général">
                            <select style={SEL} value={v('etat_general')} onChange={e => set('etat_general', e.target.value)}>
                              <option value="">— Sélectionner —</option>
                              <option value="bon">Bon état</option>
                              <option value="moyen">État moyen</option>
                              <option value="mauvais">Mauvais état</option>
                              <option value="hors_service">Hors service</option>
                            </select>
                          </Field>
                          <Field label="Régulation existante">
                            <select style={SEL} value={v('regulation')} onChange={e => set('regulation', e.target.value)}>
                              <option value="">— Sélectionner —</option>
                              <option value="aucune">Aucune</option>
                              <option value="thermostat_simple">Thermostat simple</option>
                              <option value="programmable">Thermostat programmable</option>
                              <option value="gestion_technique">Gestion technique bâtiment</option>
                            </select>
                          </Field>
                          <Field label="Brûleur présent ?">
                            <select style={SEL} value={v('bruleur')} onChange={e => set('bruleur', e.target.value)}>
                              <option value="">— Sélectionner —</option>
                              <option value="oui">Oui</option>
                              <option value="non">Non</option>
                            </select>
                          </Field>
                          {v('bruleur') === 'oui' && <>
                            <Field label="Marque brûleur">
                              <input style={INP} value={v('bruleur_marque')} onChange={e => set('bruleur_marque', e.target.value)} placeholder="Ex: Riello" />
                            </Field>
                            <Field label="Modèle brûleur">
                              <input style={INP} value={v('bruleur_modele')} onChange={e => set('bruleur_modele', e.target.value)} />
                            </Field>
                          </>}
                          <Field label="Plaque constructeur" hint="(photo ci-dessus)" full>
                            <textarea style={{ ...INP, resize: 'vertical', minHeight: 60 }} value={v('plaque_constructeur_notes')} onChange={e => set('plaque_constructeur_notes', e.target.value)} placeholder="Informations relevées sur la plaque constructeur…" />
                          </Field>
                        </SubSection>

                        {/* Distribution */}
                        <SubSection title="🌡 Distribution">
                          <Field label="Nombre d'aérothèmes (points de chauffage)">
                            <input style={INP} type="number" min="0" value={v('chauf_nb_aerothermes')} onChange={e => set('chauf_nb_aerothermes', e.target.value)} placeholder="Ex: 4" />
                          </Field>
                          <Field label="Puissance / aérothème (kW)">
                            <input style={INP} type="number" min="0" step="0.1" value={v('chauf_puissance_aero_kw')} onChange={e => set('chauf_puissance_aero_kw', e.target.value)} placeholder="Ex: 20" />
                          </Field>
                          <Field label="Observations distribution" full>
                            <textarea style={{ ...INP, resize: 'vertical', minHeight: 70 }} value={v('chauf_distribution_obs')} onChange={e => set('chauf_distribution_obs', e.target.value)} placeholder="Type de réseau, état des canalisations, robinetterie…" />
                          </Field>
                        </SubSection>
                      </div>
                    )}

                    {/* ══ TGBT ══ */}
                    {zone.id === 'tgbt' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} showCategories={zone.photoCats} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                          <Field label="Localisation TGBT">
                            <input style={INP} value={v('tgbt_localisation')} onChange={e => set('tgbt_localisation', e.target.value)} placeholder="Ex: Local technique RDC" />
                          </Field>
                          <Field label="Marque TGBT">
                            <input style={INP} value={v('tgbt_marque')} onChange={e => set('tgbt_marque', e.target.value)} placeholder="Ex: Schneider" />
                          </Field>
                          <Field label="Puissance disponible (A)">
                            <input style={INP} type="number" min="0" value={v('tgbt_puissance_a')} onChange={e => set('tgbt_puissance_a', e.target.value)} placeholder="Ex: 400" />
                          </Field>
                          <Field label="Observations TGBT" full>
                            <textarea style={{ ...INP, resize: 'vertical', minHeight: 80 }} value={v('tgbt_observations')} onChange={e => set('tgbt_observations', e.target.value)} placeholder="État des disjoncteurs, disponibilité de départs…" />
                          </Field>
                        </div>
                      </div>
                    )}

                    {/* ══ TABLEAU DIVISIONNAIRE ══ */}
                    {zone.id === 'td' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} showCategories={zone.photoCats} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                          <Field label="Localisation TD">
                            <input style={INP} value={v('td_localisation')} onChange={e => set('td_localisation', e.target.value)} placeholder="Ex: Atelier nord" />
                          </Field>
                          <Field label="Observations TD" full>
                            <textarea style={{ ...INP, resize: 'vertical', minHeight: 80 }} value={v('td_observations')} onChange={e => set('td_observations', e.target.value)} placeholder="État du tableau, départs disponibles…" />
                          </Field>
                        </div>
                      </div>
                    )}

                    {/* ══ VENTILATION ══ */}
                    {zone.id === 'ventilation' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} showCategories={zone.photoCats} />

                        {/* Simple flux */}
                        <SubSection title="→ Simple flux">
                          <Field label="Quantité d'unités">
                            <input style={INP} type="number" min="0" value={v('ventil_simple_qty')} onChange={e => set('ventil_simple_qty', e.target.value)} placeholder="Ex: 3" />
                          </Field>
                          <Field label="Marque">
                            <input style={INP} value={v('ventil_simple_marque')} onChange={e => set('ventil_simple_marque', e.target.value)} placeholder="Ex: Atlantic, Aldes…" />
                          </Field>
                          <Field label="Débit d'air (m³/h)">
                            <input style={INP} type="number" min="0" value={v('ventil_simple_debit')} onChange={e => set('ventil_simple_debit', e.target.value)} placeholder="Ex: 1500" />
                          </Field>
                          <Field label="Surface ventilée (m²)">
                            <input style={INP} type="number" min="0" value={v('ventil_simple_surface')} onChange={e => set('ventil_simple_surface', e.target.value)} placeholder="Ex: 400" />
                          </Field>
                        </SubSection>

                        {/* Double flux / CTA */}
                        <SubSection title="⇄ Double flux / CTA">
                          <Field label="Quantité d'unités">
                            <input style={INP} type="number" min="0" value={v('ventil_double_qty')} onChange={e => set('ventil_double_qty', e.target.value)} placeholder="Ex: 1" />
                          </Field>
                          <Field label="Marque">
                            <input style={INP} value={v('ventil_double_marque')} onChange={e => set('ventil_double_marque', e.target.value)} placeholder="Ex: Zehnder, Atlantic…" />
                          </Field>
                          <Field label="Débit d'air (m³/h)">
                            <input style={INP} type="number" min="0" value={v('ventil_double_debit')} onChange={e => set('ventil_double_debit', e.target.value)} placeholder="Ex: 2000" />
                          </Field>
                          <Field label="Surface ventilée (m²)">
                            <input style={INP} type="number" min="0" value={v('ventil_double_surface')} onChange={e => set('ventil_double_surface', e.target.value)} placeholder="Ex: 600" />
                          </Field>
                        </SubSection>
                      </div>
                    )}

                    {/* ══ ISOLATION ══ */}
                    {zone.id === 'isolation' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} showCategories={zone.photoCats} />
                        <div style={{ fontSize: 12, color: C.textSoft, marginBottom: 4 }}>
                          Cochez les types d'isolation concernés et renseignez les surfaces.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {ISOLATION_TYPES.map(type => {
                            const checked = !!v(`isol_${type.id}`)
                            return (
                              <div key={type.id} style={{ border: `1px solid ${checked ? C.accent : C.border}`, borderRadius: 8, padding: '12px 14px', background: checked ? '#EFF6FF' : C.surface, transition: 'all .15s' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <input type="checkbox" id={`isol_${type.id}`}
                                    checked={checked}
                                    onChange={e => set(`isol_${type.id}`, e.target.checked ? true : false)}
                                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.accent }} />
                                  <label htmlFor={`isol_${type.id}`} style={{ fontSize: 13, fontWeight: 700, color: checked ? C.accent : C.text, cursor: 'pointer', flex: 1 }}>
                                    {type.label}
                                  </label>
                                  {checked && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <label style={{ fontSize: 12, color: C.textMid, whiteSpace: 'nowrap' }}>Surface (m²)</label>
                                      <input
                                        type="number" min="0"
                                        value={v(`isol_${type.id}_surface`)}
                                        onChange={e => set(`isol_${type.id}_surface`, e.target.value)}
                                        placeholder="0"
                                        style={{ ...INP, width: 100, padding: '6px 10px', fontSize: 13 }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <Field label="Observations isolation" full>
                          <textarea style={{ ...INP, resize: 'vertical', minHeight: 80 }} value={v('isolation_observations')} onChange={e => set('isolation_observations', e.target.value)} placeholder="État actuel, matériaux existants, contraintes de pose…" />
                        </Field>
                      </div>
                    )}

                    {/* ══ ÉQUIPEMENTS & CEE ══ */}
                    {zone.id === 'equipements' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} showCategories={zone.photoCats} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                          <Field label="Puissance convectif à installer (kW)" hint="(aérothermes, soufflantes)">
                            <input style={INP} type="number" min="0" step="0.5" value={v('puissance_convectif_kw')} onChange={e => set('puissance_convectif_kw', e.target.value)} placeholder="Ex: 80" />
                          </Field>
                          <Field label="Puissance radiatif à installer (kW)" hint="(panneaux rayonnants)">
                            <input style={INP} type="number" min="0" step="0.5" value={v('puissance_radiatif_kw')} onChange={e => set('puissance_radiatif_kw', e.target.value)} placeholder="Ex: 40" />
                          </Field>
                        </div>

                        {/* kWh cumac IND-BA-110 */}
                        {selectedFiches.includes('IND-BA-110') && v('zone_climatique') && (parseFloat(v('puissance_convectif_kw')) > 0 || parseFloat(v('puissance_radiatif_kw')) > 0) && (() => {
                          const COEF = { convectif: { H1: 7200, H2: 8000, H3: 8500 }, radiatif: { H1: 2500, H2: 2800, H3: 3000 } }
                          const z    = v('zone_climatique')
                          const kwh  = Math.round((COEF.convectif[z] || 0) * (parseFloat(v('puissance_convectif_kw')) || 0) + (COEF.radiatif[z] || 0) * (parseFloat(v('puissance_radiatif_kw')) || 0))
                          return (
                            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                              <span style={{ fontSize: 28 }}>⚡</span>
                              <div>
                                <div style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 700 }}>Estimation kWh cumac IND-BA-110</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: '#1D4ED8' }}>{kwh.toLocaleString('fr-FR')} kWh</div>
                                <div style={{ fontSize: 11, color: '#3B82F6' }}>Zone {z} · Convectif {v('puissance_convectif_kw') || 0} kW · Radiatif {v('puissance_radiatif_kw') || 0} kW</div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* ══ OBSERVATIONS ══ */}
                    {zone.id === 'observations' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} showCategories={zone.photoCats} />
                        <Field label="Observations" full>
                          <textarea style={{ ...INP, resize: 'vertical', minHeight: 120 }} value={v('observations_generales')} onChange={e => set('observations_generales', e.target.value)} placeholder="Horaires d'accès, digicode, interlocuteur sur site, remarques, contraintes particulières, travaux à prévoir…" />
                        </Field>
                      </div>
                    )}

                    {/* ══ RAPPORT & ENVOI ══ */}
                    {zone.id === 'rapport' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                          {[
                            { label: 'Site', value: donnees.nom_site || donnees.raison_sociale || '—' },
                            { label: 'Fiches CEE', value: selectedFiches.length ? selectedFiches.join(', ') : '—' },
                            { label: 'Statut', value: statut === 'validée' ? '✓ Validée' : '✏ Brouillon' },
                            { label: 'Photos', value: `${photos.length} photo${photos.length !== 1 ? 's' : ''}` },
                            { label: 'Zone climatique', value: donnees.zone_climatique || '—' },
                            { label: 'Date de visite', value: donnees.date_visite ? new Date(donnees.date_visite).toLocaleDateString('fr-FR') : '—' },
                          ].map(item => (
                            <div key={item.label} style={{ background: C.bg, borderRadius: 8, padding: '10px 14px' }}>
                              <div style={{ fontSize: 11, color: C.textSoft }}>{item.label}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 2 }}>{item.value}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>📄 Rapport PDF</div>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button onClick={genererRapport} disabled={generating}
                              style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: generating ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                              {generating ? '⏳ Génération…' : '⬇ Générer & Télécharger PDF'}
                            </button>
                            {rapportUrl && <a href={rapportUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>Voir le dernier →</a>}
                          </div>
                        </div>

                        {token && (
                          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>🔗 Lien de partage</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input readOnly value={`${window.location.origin}/rapport/${token}`} style={{ ...INP, color: C.accent, fontFamily: 'monospace', fontSize: 11 }} />
                              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/rapport/${token}`)}
                                style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                📋 Copier
                              </button>
                            </div>
                          </div>
                        )}

                        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>✉️ Envoyer au prestataire</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <Field label="Nom du prestataire">
                              <input style={INP} value={v('prestataire_nom')} onChange={e => set('prestataire_nom', e.target.value)} placeholder="Bureau d'études…" />
                            </Field>
                            <Field label="Email du prestataire">
                              <input style={INP} type="email" value={v('prestataire_email')} onChange={e => set('prestataire_email', e.target.value)} placeholder="contact@prestataire.fr" />
                            </Field>
                          </div>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <button onClick={envoyerEmail} disabled={sending || !donnees.prestataire_email}
                              style={{ background: sending || !donnees.prestataire_email ? C.bg : '#0369A1', color: sending || !donnees.prestataire_email ? C.textSoft : '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: sending || !donnees.prestataire_email ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                              {sending ? '⏳ Envoi…' : '✉️ Créer brouillon Gmail'}
                            </button>
                            <span style={{ fontSize: 11, color: C.textSoft }}>PDF + lien de partage inclus</span>
                          </div>
                          {emailResult && (
                            <div style={{ marginTop: 10, background: emailResult.success ? '#DCFCE7' : '#FEF2F2', border: `1px solid ${emailResult.success ? '#86EFAC' : '#FCA5A5'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: emailResult.success ? '#15803D' : '#DC2626' }}>
                              {emailResult.success
                                ? <>✓ Brouillon créé — <a href={emailResult.gmailUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#15803D', fontWeight: 700 }}>Ouvrir dans Gmail →</a></>
                                : `⚠ ${emailResult.error}`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Suivant */}
                    {zoneIdx < zones.length - 1 && (
                      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => nextZone(zone.id)}
                          style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Suivant → {zones[zoneIdx + 1].icon} {zones[zoneIdx + 1].title}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
