import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { refDefault } from '../lib/genRef'
import EmailSection from '../components/EmailSection'
import CalendarPicker from '../components/CalendarPicker'

// ── IND-BA-110 ADEME coefficients (kWh cumac / kW) ────────────────────────
const COEFFICIENTS_IND_110 = {
  convectif: { H1: 7200, H2: 8000, H3: 8500 },
  radiatif:  { H1: 2500, H2: 2800, H3: 3000 },
}

const calculerCumac110 = ({ zone, pConvectif, pRadiatif }) => {
  const coeffConv = COEFFICIENTS_IND_110.convectif[zone] || 0
  const coeffRad  = COEFFICIENTS_IND_110.radiatif[zone]  || 0
  const kwhCumac  = Math.round(coeffConv * pConvectif + coeffRad * pRadiatif)
  return { kwhCumac, coeffConv, coeffRad }
}

// ── BAT-TH-142 ADEME coefficients ─────────────────────────────────────────
const COEFFICIENTS_142 = {
  sport_transport: {
    convectif: {
      H1: { '5-7': 900, '7-10': 2700, '10-15': 5100, '15-20': 7200, '20+': 8000 },
      H2: { '5-7': 1000, '7-10': 3100, '10-15': 5700, '15-20': 7800, '20+': 8600 },
      H3: { '5-7': 1300, '7-10': 4000, '10-15': 7000, '15-20': 9100, '20+': 9900 },
    },
    radiatif: {
      H1: { '5-7': 320, '7-10': 950, '10-15': 1800, '15-20': 2500, '20+': 2800 },
      H2: { '5-7': 350, '7-10': 1090, '10-15': 2000, '15-20': 2700, '20+': 3000 },
      H3: { '5-7': 460, '7-10': 1400, '10-15': 2500, '15-20': 3200, '20+': 3500 },
    },
  },
  commerce_loisirs: {
    convectif: {
      H1: { '5-7': 600, '7-10': 2000, '10-15': 4000, '15-20': 5800, '20+': 6700 },
      H2: { '5-7': 700, '7-10': 2200, '10-15': 4400, '15-20': 6300, '20+': 7100 },
      H3: { '5-7': 900, '7-10': 2800, '10-15': 5200, '15-20': 7200, '20+': 8000 },
    },
    radiatif: {
      H1: { '5-7': 210, '7-10': 700, '10-15': 1400, '15-20': 2000, '20+': 2300 },
      H2: { '5-7': 240, '7-10': 790, '10-15': 1600, '15-20': 2200, '20+': 2500 },
      H3: { '5-7': 320, '7-10': 1000, '10-15': 1900, '15-20': 2500, '20+': 2800 },
    },
  },
}

const getHauteurBracket = (h) => {
  if (h >= 5  && h < 7)  return '5-7'
  if (h >= 7  && h < 10) return '7-10'
  if (h >= 10 && h < 15) return '10-15'
  if (h >= 15 && h < 20) return '15-20'
  if (h >= 20)           return '20+'
  return null
}

const calculerCumac142 = ({ typeLocal, zone, hauteur, pConvectif, pRadiatif }) => {
  const bracket = getHauteurBracket(hauteur)
  if (!bracket) return { kwhCumac: 0 }
  const coeffConv = COEFFICIENTS_142[typeLocal]?.convectif?.[zone]?.[bracket] || 0
  const coeffRad  = COEFFICIENTS_142[typeLocal]?.radiatif?.[zone]?.[bracket] || 0
  const kwhCumac  = Math.round(coeffConv * pConvectif + coeffRad * pRadiatif)
  return { kwhCumac, coeffConv, coeffRad, bracket }
}

// ── BAT-TH-163 PAC air/eau tertiaire ─────────────────────────────────────────
const COEFFICIENTS_163 = {
  pac_small: {
    'etas_111_126': { H1: 1100, H2: 900,  H3: 600 },
    'etas_126_175': { H1: 1200, H2: 1000, H3: 700 },
    'etas_175_plus': { H1: 1300, H2: 1000, H3: 700 },
  },
  pac_large: {
    'cop_3_4_4_5': { H1: 1100, H2: 900,  H3: 600 },
    'cop_4_5_plus': { H1: 1200, H2: 1000, H3: 700 },
  },
}
const FACTEURS_SECTEUR_163 = {
  bureaux: 1.2, sante: 1.1, commerces: 0.9,
  enseignement: 0.8, hotellerie_restauration: 0.7, autres: 0.7,
}
const calculerCumac163 = ({ zone, puissancePac, etasBracket, copBracket, surface, secteur }) => {
  const forfait = puissancePac === 'small'
    ? (COEFFICIENTS_163.pac_small[etasBracket]?.[zone] || 0)
    : (COEFFICIENTS_163.pac_large[copBracket]?.[zone] || 0)
  const facteurSecteur = FACTEURS_SECTEUR_163[secteur] || 0.7
  const kwhCumac = Math.round(forfait * surface * facteurSecteur)
  return { kwhCumac, forfait, facteurSecteur }
}

const eqPuissance = (eq) => {
  // Supports both old format (puissance_kw) and new format (quantite × puissance_unitaire_kw)
  if (eq.puissance_unitaire_kw != null && eq.quantite != null) {
    return (parseFloat(eq.quantite) || 0) * (parseFloat(eq.puissance_unitaire_kw) || 0)
  }
  return parseFloat(eq.puissance_kw) || 0
}

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB', nav: '#1E293B',
}

const STATUTS = [
  { id: 'simulation',       label: 'Simulation',        color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'prospect',         label: 'Prospect',          color: '#0369A1', bg: '#DBEAFE' },
  { id: 'contacte',         label: 'Contacté',          color: '#0891B2', bg: '#CFFAFE' },
  { id: 'visio_planifiee',  label: 'Visio planifiée',   color: '#0D9488', bg: '#CCFBF1' },
  { id: 'visio_effectuee',  label: 'Visio effectuée',   color: '#059669', bg: '#D1FAE5' },
  { id: 'visite_planifiee', label: 'Visite planifiée',  color: '#D97706', bg: '#FEF3C7' },
  { id: 'visite_effectuee', label: 'Visite effectuée',  color: '#EA580C', bg: '#FFEDD5' },
  { id: 'devis',            label: 'Devis envoyé',      color: '#9333EA', bg: '#F3E8FF' },
  { id: 'ah',               label: 'AH en cours',       color: '#DC2626', bg: '#FEE2E2' },
  { id: 'conforme',         label: 'Conforme',          color: '#16A34A', bg: '#DCFCE7' },
  { id: 'facture',          label: 'Facturé',           color: '#64748B', bg: '#F1F5F9' },
]


function Field({ label, value, onChange, type = 'text', placeholder, suffix }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={type} value={value ?? ''} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: suffix ? '9px 44px 9px 12px' : '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        {suffix && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMid }}>{suffix}</span>}
      </div>
    </div>
  )
}

function InfoRow({ label, value, color }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 8, paddingBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.textSoft, width: 110, flexShrink: 0, paddingTop: 1, textTransform: 'uppercase', letterSpacing: .3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: color ? 700 : 400, color: color || C.text }}>{value}</span>
    </div>
  )
}

export default function DossierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentDossier, user, profile, session, updateDossier, updateProspect, fetchSimulations, createSimulation, profiles, fetchProfiles } = useStore()

  const [dossier,       setDossier]       = useState(null)
  const [simulation,    setSimulation]    = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [savingStatut,  setSavingStatut]  = useState(false)
  const [statutForm,    setStatutForm]    = useState({ statut: '', date: new Date().toISOString().split('T')[0] })
  const [statutSaved,   setStatutSaved]   = useState(false)
  const [pendingStatut, setPendingStatut] = useState(null) // pipeline click
  const [activeTab, setActiveTab] = useState('dossier')
  const [savingAssigne, setSavingAssigne] = useState(false)

  const [notesForm,     setNotesForm]     = useState('')
  const [savingNotes,   setSavingNotes]   = useState(false)
  const [notesSaved,    setNotesSaved]    = useState(false)
  const [meetProvider,     setMeetProvider]     = useState('meet') // 'teams' | 'meet'
  const [teamsDate,        setTeamsDate]        = useState('')
  const [teamsTime,        setTeamsTime]        = useState('')
  const [teamsDuration,    setTeamsDuration]    = useState(45)
  const [teamsEmails,      setTeamsEmails]      = useState('')
  const [reunionLinkInput, setReunionLinkInput] = useState('')
  const [reunionLink,      setReunionLink]      = useState(null)
  const [savingReunion,    setSavingReunion]    = useState(false)
  const [reunionSaved,     setReunionSaved]     = useState(false)
  const [reunionCopied,    setReunionCopied]    = useState(false)
  const [meetCreating,     setMeetCreating]     = useState(false)
  const [meetError,        setMeetError]        = useState(null)
  const [visiteAddress,    setVisiteAddress]    = useState('')
  const [visiteCreating,   setVisiteCreating]   = useState(false)
  const [visiteCreated,    setVisiteCreated]    = useState(false)
  const [visiteError,      setVisiteError]      = useState(null)
  const addressInputRef = useRef(null)

  const [editProspect, setEditProspect] = useState(false)
  const [pForm, setPForm] = useState({})
  const setP = (k, v) => setPForm(f => ({ ...f, [k]: v }))

  const [editSimu, setEditSimu] = useState(false)
  const [simuStep, setSimuStep] = useState(1)
  const [sForm, setSForm] = useState({})
  const setS = (k, v) => setSForm(f => ({ ...f, [k]: v }))

  // Documents
  const [documents, setDocuments] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const [renamingDoc, setRenamingDoc] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [simuResult, setSimuResult] = useState(null)
  const [savingSimu, setSavingSimu] = useState(false)

  // Appels
  const [appels, setAppels] = useState([])
  const [appelsLoading, setAppelsLoading] = useState(false)
  const [showAppelForm, setShowAppelForm] = useState(false)
  const [appelEtat, setAppelEtat] = useState('nrp')
  const [appelRappelAt, setAppelRappelAt] = useState('')
  const [appelNote, setAppelNote] = useState('')
  const [savingAppel, setSavingAppel] = useState(false)

  // Documents extra
  const [checkedDocs, setCheckedDocs] = useState(new Set())
  const [emailingDoc, setEmailingDoc] = useState(null)

  // Reset complet du formulaire lors du changement de fiche
  const switchFiche = (ficheId) => {
    setSimuResult(null)
    setSimuStep(1)
    if (ficheId === 'IND-BA-110') {
      setSForm({
        fiche_cee: 'IND-BA-110',
        zone_climatique: '',
        eqs_conv: [],
        eqs_rad: [],
        surface_m2: '', hauteur_m: '', debit_unitaire: '14000',
        nb_destrat: '', cout_unitaire_destrat: '2750', prix_mwh: '7.5',
      })
    } else {
      setSForm({
        fiche_cee: 'BAT-TH-142',
        zone_climatique: '', type_local: 'sport_transport', hauteur_m: '',
        eqs_conv: [], eqs_rad: [],
        nb_destrat: '', cout_unitaire_destrat: '2750', prix_mwh: '7.5',
      })
    }
  }

  useEffect(() => {
    fetchProfiles()
    loadData()
    loadDocuments()
    loadAppels()
  }, [id])

  // Google Places autocomplete sur le champ adresse visite
  useEffect(() => {
    if (activeTab !== 'visio' || meetProvider !== 'visite' || !addressInputRef.current) return
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) return
    const attach = () => {
      if (!window.google?.maps?.places || !addressInputRef.current) return
      const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'], componentRestrictions: { country: 'fr' },
      })
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (place.formatted_address) setVisiteAddress(place.formatted_address)
      })
    }
    if (window.google?.maps?.places) { attach(); return }
    if (document.querySelector(`script[src*="maps.googleapis.com"]`)) return
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    s.async = true; s.onload = attach
    document.head.appendChild(s)
  }, [activeTab, meetProvider])

  const BUCKET = 'dossier-documents'

  const loadDocuments = async () => {
    setDocsLoading(true)
    const { data, error } = await supabase.storage.from(BUCKET).list(id, { sortBy: { column: 'created_at', order: 'desc' } })
    if (error) console.error('[Documents] list error:', error)
    if (!error && data) setDocuments(data.filter(f => f.name !== '.emptyFolderPlaceholder'))
    setDocsLoading(false)
  }

  const uploadFiles = async (files) => {
    if (!files?.length) return
    setUploading(true)
    setUploadError(null)
    const errors = []
    for (const file of Array.from(files)) {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error } = await supabase.storage.from(BUCKET).upload(`${id}/${safeName}`, file, { upsert: true })
      if (error) errors.push(`${file.name} : ${error.message}`)
    }
    if (errors.length) setUploadError(errors.join('\n'))
    // Reset input pour permettre de re-uploader le même fichier
    if (fileInputRef.current) fileInputRef.current.value = ''
    await loadDocuments()
    setUploading(false)
  }

  const deleteDocument = async (fileName) => {
    if (!window.confirm(`Supprimer « ${fileName} » ?`)) return
    await supabase.storage.from(BUCKET).remove([`${id}/${fileName}`])
    setDocuments(d => d.filter(f => f.name !== fileName))
  }

  const downloadDocument = async (fileName) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(`${id}/${fileName}`, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const renameDocument = async (oldFileName, newDisplayName) => {
    const trimmed = newDisplayName.trim()
    if (!trimmed) return
    const ext = oldFileName.includes('.') ? oldFileName.split('.').pop() : ''
    const baseName = trimmed.includes('.') ? trimmed : ext ? `${trimmed}.${ext}` : trimmed
    const safeName = baseName.replace(/[^a-zA-Z0-9._\- ]/g, '_')
    const { error } = await supabase.storage.from(BUCKET).move(`${id}/${oldFileName}`, `${id}/${safeName}`)
    if (error) { setUploadError(`Renommage : ${error.message}`); return }
    setRenamingDoc(null)
    await loadDocuments()
  }

  const loadData = async () => {
    setLoading(true)
    let d = currentDossier?.id === id ? currentDossier : null
    if (!d) {
      const { data } = await supabase.from('dossiers').select('*, prospects(*)').eq('id', id).single()
      d = data
    }
    if (d) {
      setDossier(d)
      setNotesForm(d.notes || '')
      setTeamsEmails([user?.email, d.prospects?.contact_email].filter(Boolean).join(', '))
      const fullAddr = [d.prospects?.adresse, d.prospects?.code_postal, d.prospects?.ville].filter(Boolean).join(', ')
      if (fullAddr) setVisiteAddress(fullAddr)
      if (d.reunion_link) { setReunionLink(d.reunion_link); setReunionLinkInput(d.reunion_link) }
      setStatutForm({
        statut: d.statut || 'simulation',
        date: d.statut_date ? new Date(d.statut_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      })
      const sims = await fetchSimulations(d.id)
      const sim = sims[0] || null
      setSimulation(sim)
      setPForm(d.prospects || {})
      if (sim) {
        const p = sim.parametres || {}
        const fiche = sim.fiche_cee || 'BAT-TH-142'
        if (fiche === 'IND-BA-110') {
          setSForm({
            fiche_cee: 'IND-BA-110',
            zone_climatique: sim.zone_climatique || '',
            eqs_conv: p.eqs_conv || [],
            eqs_rad:  p.eqs_rad  || [],
            surface_m2: p.surface_m2 ?? '', hauteur_m: sim.hauteur_m ?? '',
            debit_unitaire: p.debit_unitaire || '14000',
            nb_destrat: p.nb_destrat ?? '', cout_unitaire_destrat: p.cout_unitaire_destrat || '2750',
            prix_mwh: sim.prix_mwh ?? '7.5',
          })
        } else if (fiche === 'BAT-TH-163') {
          setSForm({
            fiche_cee: 'BAT-TH-163',
            zone_climatique: sim.zone_climatique || '',
            surface_m2: p.surface_m2 ?? '',
            puissance_pac: p.puissance_pac || 'small',
            etas_bracket: p.etas_bracket || 'etas_111_126',
            cop_bracket: p.cop_bracket || 'cop_3_4_4_5',
            secteur_163: p.secteur || 'bureaux',
            cout_installation_163: p.cout_installation || '',
            bonification_x3: p.bonification_x3 || false,
            prix_mwh: sim.prix_mwh ?? '7.5',
          })
        } else {
          setSForm({
            fiche_cee: 'BAT-TH-142',
            zone_climatique: sim.zone_climatique || '',
            type_local: p.type_local || 'sport_transport',
            hauteur_m: sim.hauteur_m ?? '',
            eqs_conv: p.eqs_conv || [],
            eqs_rad:  p.eqs_rad  || [],
            nb_destrat: p.nb_destrat ?? '', cout_unitaire_destrat: p.cout_unitaire_destrat || '2750',
            prix_mwh: sim.prix_mwh ?? '7.5',
          })
        }
      } else {
        // No simulation — initialize from dossier fiche
        const fiche = d.fiche_cee || 'BAT-TH-142'
        if (fiche === 'BAT-TH-163') {
          setSForm({ fiche_cee: 'BAT-TH-163', zone_climatique: '', surface_m2: '', puissance_pac: 'small', etas_bracket: 'etas_111_126', cop_bracket: 'cop_3_4_4_5', secteur_163: 'bureaux', cout_installation_163: '', bonification_x3: false, prix_mwh: '7.5' })
        } else if (fiche === 'IND-BA-110') {
          setSForm({ fiche_cee: 'IND-BA-110', zone_climatique: '', eqs_conv: [], eqs_rad: [], surface_m2: '', hauteur_m: '', debit_unitaire: '14000', nb_destrat: '', cout_unitaire_destrat: '2750', prix_mwh: '7.5' })
        } else {
          setSForm({ fiche_cee: 'BAT-TH-142', zone_climatique: '', type_local: 'sport_transport', hauteur_m: '', eqs_conv: [], eqs_rad: [], nb_destrat: '', cout_unitaire_destrat: '2750', prix_mwh: '7.5' })
        }
      }
    }
    setLoading(false)
  }

  const loadAppels = async () => {
    setAppelsLoading(true)
    const { data } = await supabase
      .from('appels')
      .select('*')
      .eq('dossier_id', id)
      .order('created_at', { ascending: false })
    setAppels(data || [])
    setAppelsLoading(false)
  }

  const addAppel = async () => {
    setSavingAppel(true)
    await supabase.from('appels').insert({
      dossier_id: id,
      user_id: user?.id,
      etat: appelEtat,
      rappel_at: appelRappelAt || null,
      note: appelNote || null,
    })
    setShowAppelForm(false)
    setAppelEtat('nrp')
    setAppelRappelAt('')
    setAppelNote('')
    setSavingAppel(false)
    loadAppels()
  }

  const deleteAppel = async (appelId) => {
    await supabase.from('appels').delete().eq('id', appelId)
    setAppels(a => a.filter(x => x.id !== appelId))
  }

  const forceDownloadDocument = async (fileName) => {
    const { data } = await supabase.storage.from(BUCKET).download(`${id}/${fileName}`)
    if (!data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.replace(/^\d+_/, '')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const emailDocument = async (fileName) => {
    setEmailingDoc(fileName)
    try {
      const r = await fetch('/api/email-document', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossierId: id, storagePath: `${id}/${fileName}`, fileName: fileName.replace(/^\d+_/, '') }),
      })
      const d = await r.json()
      if (d.gmailUrl) window.open(d.gmailUrl, '_blank')
      else alert(d.error || 'Erreur création brouillon')
    } catch { /* ignore */ }
    setEmailingDoc(null)
  }

  const changeStatut = async () => {
    if (!session) return
    setSavingStatut(true)
    setStatutSaved(false)
    try {
      const r = await fetch('/api/dossier-status-update', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossierId: id, statut: statutForm.statut, statut_date: statutForm.date }),
      })
      const d = await r.json()
      if (d.dossier) setDossier(prev => ({ ...prev, statut: d.dossier.statut, statut_date: d.dossier.statut_date }))
      setStatutSaved(true)
      setPendingStatut(null)
      setTimeout(() => setStatutSaved(false), 3000)
    } catch (e) { /* ignore */ }
    setSavingStatut(false)
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    const { data } = await updateDossier(id, { notes: notesForm })
    if (data) setDossier(prev => ({ ...prev, notes: notesForm }))
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
    setSavingNotes(false)
  }

  const changeAssignation = async (newUserId) => {
    setSavingAssigne(true)
    const { data } = await updateDossier(id, { assigne_a: newUserId })
    if (data) setDossier(data)
    setSavingAssigne(false)
  }

  const saveProspect = async () => {
    const { raison_sociale, siret, adresse, code_postal, ville, contact_nom, contact_email, contact_tel } = pForm
    const data = await updateProspect(dossier.prospects.id, { raison_sociale, siret, adresse, code_postal, ville, contact_nom, contact_email, contact_tel })
    if (data) setDossier(d => ({ ...d, prospects: data }))
    setEditProspect(false)
  }

  const calculerSimuLocal = () => {
    const prix = parseFloat(sForm.prix_mwh) || 7.5
    const cout = parseFloat(sForm.cout_unitaire_destrat) || 2750
    const zone = sForm.zone_climatique || 'H2'

    if (sForm.fiche_cee === 'IND-BA-110') {
      // ── IND-BA-110 : cumac = coeff[zone] × pConv + coeff[zone] × pRad ──────
      const pConv   = (sForm.eqs_conv || []).reduce((s, e) => s + eqPuissance(e), 0)
      const pRad    = (sForm.eqs_rad  || []).reduce((s, e) => s + eqPuissance(e), 0)
      const surface = parseFloat(sForm.surface_m2) || 0
      const h       = parseFloat(sForm.hauteur_m) || 0
      const debit   = parseFloat(sForm.debit_unitaire) || 14000
      const nbAuto  = (surface > 0 && h > 0) ? Math.ceil((surface * h * 0.7) / debit) : 0
      const nb      = parseInt(sForm.nb_destrat) || nbAuto

      const { kwhCumac } = calculerCumac110({ zone, pConvectif: pConv, pRadiatif: pRad })
      const prime     = Math.round(kwhCumac * (prix / 1000) * 100) / 100
      const mwh       = Math.round(kwhCumac / 1000 * 10) / 10
      const coutTotal = nb * cout
      const marge     = Math.round((prime - coutTotal) * 100) / 100
      setSimuResult({ fiche: 'IND-BA-110', kwhCumac, mwh, prime, coutTotal, marge, rentable: marge > 0, nb, nbAuto, pConv, pRad })

    } else if (sForm.fiche_cee === 'BAT-TH-163') {
      const res = calculerCumac163({
        zone,
        puissancePac: sForm.puissance_pac,
        etasBracket: sForm.etas_bracket,
        copBracket: sForm.cop_bracket,
        surface: parseFloat(sForm.surface_m2) || 0,
        secteur: sForm.secteur_163,
      })
      const kwhCumacBase = res.kwhCumac
      const kwhCumac = sForm.bonification_x3 ? kwhCumacBase * 3 : kwhCumacBase
      const prime = Math.round(kwhCumac * (prix / 1000) * 100) / 100
      const primeNette = Math.round(prime * 0.9 * 100) / 100
      const coutTotal = parseFloat(sForm.cout_installation_163) || 0
      const margeNette = Math.round((primeNette - coutTotal) * 100) / 100
      setSimuResult({ fiche: 'BAT-TH-163', kwhCumac, kwhCumacBase, prime, primeNette, coutTotal, marge: margeNette, rentable: margeNette > 0,
        forfait: res.forfait, facteurSecteur: res.facteurSecteur })

    } else {
      // ── BAT-TH-142 : cumac = coeff[typeLocal][zone][bracket] × pConv/pRad ──
      const h     = parseFloat(sForm.hauteur_m) || 0
      const nb    = parseInt(sForm.nb_destrat) || 0
      const pConv = (sForm.eqs_conv || []).reduce((s, e) => s + eqPuissance(e), 0)
      const pRad  = (sForm.eqs_rad  || []).reduce((s, e) => s + eqPuissance(e), 0)

      const { kwhCumac } = calculerCumac142({ typeLocal: sForm.type_local, zone, hauteur: h, pConvectif: pConv, pRadiatif: pRad })
      const prime     = Math.round(kwhCumac * (prix / 1000) * 100) / 100
      const mwh       = Math.round(kwhCumac / 1000 * 10) / 10
      const coutTotal = nb * cout
      const marge     = Math.round((prime - coutTotal) * 100) / 100
      setSimuResult({ fiche: 'BAT-TH-142', kwhCumac, mwh, prime, coutTotal, marge, rentable: marge > 0, nb, pConv, pRad })
    }
  }

  const saveSimulation = async () => {
    if (!simuResult) return
    setSavingSimu(true)

    const is110 = sForm.fiche_cee === 'IND-BA-110'
    const is163 = sForm.fiche_cee === 'BAT-TH-163'
    const parametres163 = {
      puissance_pac: sForm.puissance_pac,
      etas_bracket: sForm.etas_bracket,
      cop_bracket: sForm.cop_bracket,
      secteur: sForm.secteur_163,
      surface_m2: sForm.surface_m2,
      bonification_x3: sForm.bonification_x3,
      kwh_cumac: simuResult.kwhCumac,
      kwh_cumac_base: simuResult.kwhCumacBase,
      forfait: simuResult.forfait,
      facteur_secteur: simuResult.facteurSecteur,
      cout_installation: sForm.cout_installation_163,
      cout_total: simuResult.coutTotal,
      marge: simuResult.marge,
    }
    const payload = {
      dossier_id: id,
      fiche_cee: sForm.fiche_cee || 'BAT-TH-142',
      hauteur_m: parseFloat(sForm.hauteur_m) || null,
      zone_climatique: sForm.zone_climatique,
      nb_equipements: is163 ? 1 : simuResult.nb,
      puissance_kw: is163 ? null : simuResult.pConv + simuResult.pRad,
      mwh_cumac: is163 ? Math.round(simuResult.kwhCumac / 100) / 10 : simuResult.mwh,
      prime_estimee: simuResult.prime,
      prix_mwh: parseFloat(sForm.prix_mwh),
      rentable: simuResult.rentable,
      parametres: is163 ? parametres163 : is110 ? {
        eqs_conv: sForm.eqs_conv, eqs_rad: sForm.eqs_rad,
        p_convectif: simuResult.pConv, p_radiatif: simuResult.pRad,
        surface_m2: sForm.surface_m2, debit_unitaire: sForm.debit_unitaire,
        kwh_cumac: simuResult.kwhCumac, nb_destrat: simuResult.nb,
        cout_unitaire_destrat: sForm.cout_unitaire_destrat,
        cout_total: simuResult.coutTotal, marge: simuResult.marge,
      } : {
        type_local: sForm.type_local,
        eqs_conv: sForm.eqs_conv, eqs_rad: sForm.eqs_rad,
        p_convectif: simuResult.pConv, p_radiatif: simuResult.pRad,
        kwh_cumac: simuResult.kwhCumac, nb_destrat: simuResult.nb,
        cout_unitaire_destrat: sForm.cout_unitaire_destrat,
        cout_total: simuResult.coutTotal, marge: simuResult.marge,
      },
    }
    await createSimulation(payload)
    const { data: updatedDossier } = await updateDossier(id, { prime_estimee: simuResult.prime, montant_devis: simuResult.coutTotal })
    if (updatedDossier) setDossier(updatedDossier)
    const sims = await fetchSimulations(id)
    setSimulation(sims[0] || null)
    setSimuResult(null)
    setEditSimu(false)
    setSavingSimu(false)
  }

  const assignedProfile = profiles.find(p => p.id === dossier?.assigne_a)
  const assignedName = assignedProfile
    ? (`${assignedProfile.prenom || ''} ${assignedProfile.nom || ''}`.trim() || assignedProfile.email)
    : (dossier?.assigne_a ? dossier.assigne_a.slice(0, 8) + '…' : '—')

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      <span style={{ color: C.textMid, fontSize: 14 }}>Chargement…</span>
    </div>
  )

  if (!dossier) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      <span style={{ color: C.text, fontSize: 16 }}>Dossier introuvable</span>
      <button onClick={() => navigate('/')} style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>← Retour</button>
    </div>
  )

  const canCalculerLocal = sForm.zone_climatique && (
    sForm.fiche_cee === 'IND-BA-110' ? true
    : sForm.fiche_cee === 'BAT-TH-163' ? (sForm.surface_m2 && parseFloat(sForm.surface_m2) > 0)
    : (sForm.hauteur_m && parseFloat(sForm.hauteur_m) >= 5)
  )

  const statutInfo = STATUTS.find(s => s.id === dossier.statut) || STATUTS[0]
  const sim = simulation
  const simParams = sim?.parametres || {}

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      {/* Nav */}
      <div style={{ background: C.nav, borderBottom: '1px solid #334155', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '5px 10px', borderRadius: 6 }}>← Dashboard</button>
          <span style={{ color: '#334155' }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#60A5FA', fontFamily: 'monospace' }}>{dossier.ref}</span>
          <span style={{ fontSize: 13, color: '#94A3B8' }}>{dossier.prospects?.raison_sociale}</span>
        </div>
        <span style={{ fontSize: 12, color: '#64748B' }}>{user?.email}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 48px' }}>

        {/* ── Header compact ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
              {dossier.prospects?.raison_sociale || '—'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.textSoft, fontFamily: 'monospace', background: C.bg, padding: '2px 7px', borderRadius: 4, border: `1px solid ${C.border}` }}>{dossier.ref}</span>
              <span style={{ fontSize: 11, color: C.textMid }}>{dossier.fiche_cee}</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 700, background: statutInfo.bg, color: statutInfo.color }}>{statutInfo.label}</span>
              {dossier.statut_date && (
                <span style={{ fontSize: 11, color: C.textSoft }}>
                  depuis le {new Date(dossier.statut_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </span>
              )}
            </div>
          </div>
          {/* Assignation */}
          <div>
            {profile?.role === 'admin' ? (
              <select
                value={dossier.assigne_a || ''}
                onChange={e => changeAssignation(e.target.value)}
                disabled={savingAssigne}
                style={{ fontSize: 12, color: C.text, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', opacity: savingAssigne ? .6 : 1 }}>
                <option value="">— Non assigné —</option>
                {profiles.filter(p => ['admin', 'commercial'].includes(p.role)).map(p => (
                  <option key={p.id} value={p.id}>
                    {(`${p.prenom || ''} ${p.nom || ''}`.trim()) || p.email}
                  </option>
                ))}
              </select>
            ) : dossier.assigne_a !== user?.id ? (
              <button onClick={() => changeAssignation(user?.id)} disabled={savingAssigne}
                style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: '#EFF6FF', border: `1px solid ${C.accent}44`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', opacity: savingAssigne ? .6 : 1 }}>
                {savingAssigne ? '…' : "M'attribuer"}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: C.textMid }}>Assigné à vous</span>
            )}
          </div>
        </div>

        {/* ── Pipeline statuts ── */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          {/* Steps */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
            {STATUTS.map((s, i) => {
              const currentIdx = STATUTS.findIndex(x => x.id === dossier.statut)
              const isDone    = i < currentIdx
              const isCurrent = i === currentIdx
              const isPending = pendingStatut === s.id
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                  {i > 0 && (
                    <div style={{ width: 24, height: 3, background: isDone ? s.color : C.border, marginTop: 11, transition: 'background .2s' }} />
                  )}
                  <button
                    onClick={() => {
                      if (s.id === dossier.statut) { setPendingStatut(null); return }
                      setPendingStatut(s.id)
                      setStatutForm({ statut: s.id, date: new Date().toISOString().split('T')[0] })
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      background: isPending ? `${s.color}11` : 'transparent',
                      border: isPending ? `1px solid ${s.color}44` : '1px solid transparent',
                      cursor: 'pointer', padding: '6px 8px', borderRadius: 10,
                      transition: 'all .15s', minWidth: 60,
                    }}
                  >
                    <div style={{
                      width: isCurrent ? 22 : 14, height: isCurrent ? 22 : 14,
                      borderRadius: '50%', flexShrink: 0,
                      background: isCurrent ? s.color : isDone ? s.color + '99' : '#E2E8F0',
                      border: isCurrent ? `4px solid ${s.color}33` : 'none',
                      boxShadow: isCurrent ? `0 0 0 3px ${s.color}22` : 'none',
                      boxSizing: 'border-box',
                      transition: 'all .2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isDone && <span style={{ fontSize: 8, color: '#fff', fontWeight: 900 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 10, color: isCurrent ? s.color : isDone ? C.textMid : C.textSoft, fontWeight: isCurrent ? 800 : isDone ? 500 : 400, whiteSpace: 'nowrap', textAlign: 'center', maxWidth: 64, lineHeight: 1.3 }}>
                      {s.label}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Confirmation inline */}
          {pendingStatut && (() => {
            const s = STATUTS.find(x => x.id === pendingStatut)
            return (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                  Passer à <span style={{ color: s.color }}>{s.label}</span>
                </span>
                <input
                  type="date"
                  value={statutForm.date}
                  onChange={e => setStatutForm(f => ({ ...f, date: e.target.value }))}
                  style={{ fontSize: 12, color: C.text, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', fontFamily: 'inherit' }}
                />
                <button
                  onClick={changeStatut}
                  disabled={savingStatut}
                  style={{ padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: savingStatut ? 'not-allowed' : 'pointer', fontFamily: 'inherit', border: 'none', background: s.color, color: '#fff', opacity: savingStatut ? .6 : 1 }}
                >
                  {savingStatut ? '…' : 'Confirmer'}
                </button>
                <button
                  onClick={() => setPendingStatut(null)}
                  style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid }}
                >
                  Annuler
                </button>
                {statutSaved && <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>✓ Mis à jour</span>}
              </div>
            )
          })()}
        </div>

        {/* ── Barre d'onglets ── */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: `2px solid ${C.border}` }}>
          {[
            { id: 'dossier',   label: '📋 Dossier',    badge: null },
            { id: 'appels',    label: '📞 Appels',     badge: appels.length > 0 ? String(appels.length) : null },
            { id: 'visio',     label: '📹 Visio / VT', badge: null },
            { id: 'documents', label: '📎 Documents',  badge: documents.length > 0 ? String(documents.length) : null },
            ...(['contacte','visio_planifiee','visio_effectuee','visite_planifiee','visite_effectuee','devis'].includes(dossier.statut) ? [{ id: 'email', label: '✉️ Email', badge: null }] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                padding: '9px 18px', fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: 'none',
                borderBottom: `2px solid ${activeTab === t.id ? C.accent : 'transparent'}`,
                marginBottom: -2, color: activeTab === t.id ? C.accent : C.textMid,
                transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {t.label}
              {t.badge && (
                <span style={{ fontSize: 10, fontWeight: 700, background: activeTab === t.id ? C.accent : C.border, color: activeTab === t.id ? '#fff' : C.textMid, borderRadius: 10, padding: '1px 6px' }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Dossier (Infos + Simulation) ── */}
        {activeTab === 'dossier' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, alignItems: 'start' }}>

            {/* Colonne gauche : Client + Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Client */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Informations client</span>
                  {!editProspect
                    ? <button onClick={() => setEditProspect(true)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Modifier</button>
                    : <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditProspect(false)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                        <button onClick={saveProspect} style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Enregistrer</button>
                      </div>
                  }
                </div>
                {editProspect ? (
                  <>
                    <Field label="Raison sociale" value={pForm.raison_sociale} onChange={v => setP('raison_sociale', v)} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                      <Field label="SIRET" value={pForm.siret} onChange={v => setP('siret', v)} />
                      <Field label="Ville" value={pForm.ville} onChange={v => setP('ville', v)} />
                      <div style={{ gridColumn: '1/-1' }}><Field label="Adresse" value={pForm.adresse} onChange={v => setP('adresse', v)} /></div>
                      <Field label="Code postal" value={pForm.code_postal} onChange={v => setP('code_postal', v)} />
                      <Field label="Contact" value={pForm.contact_nom} onChange={v => setP('contact_nom', v)} />
                      <Field label="Email" value={pForm.contact_email} onChange={v => setP('contact_email', v)} type="email" />
                      <Field label="Téléphone" value={pForm.contact_tel} onChange={v => setP('contact_tel', v)} />
                    </div>
                  </>
                ) : (
                  <div>
                    <InfoRow label="SIRET" value={dossier.prospects?.siret} />
                    <InfoRow label="Adresse" value={dossier.prospects?.adresse} />
                    <InfoRow label="Ville" value={[dossier.prospects?.code_postal, dossier.prospects?.ville].filter(Boolean).join(' ') || null} />
                    <InfoRow label="Contact" value={dossier.prospects?.contact_nom} />
                    <InfoRow label="Email" value={dossier.prospects?.contact_email} />
                    <InfoRow label="Tél" value={dossier.prospects?.contact_tel} />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Notes</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {notesSaved && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ Sauvegardé</span>}
                    <button onClick={saveNotes} disabled={savingNotes}
                      style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: savingNotes ? 'not-allowed' : 'pointer', fontFamily: 'inherit', border: 'none', background: C.accent, color: '#fff', opacity: savingNotes ? .6 : 1 }}>
                      {savingNotes ? '…' : 'Sauvegarder'}
                    </button>
                  </div>
                </div>
                <textarea value={notesForm} onChange={e => setNotesForm(e.target.value)}
                  placeholder="Ajoute des notes sur ce dossier…" rows={6}
                  style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, lineHeight: 1.6, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

            </div>

            {/* Colonne droite : Simulation */}
            <div>
                {/* ── Simulation card ── */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>⚡ Simulation CEE</span>
              {!editSimu
                ? <button onClick={() => { setSimuStep(1); setEditSimu(true) }} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{sim ? 'Modifier' : 'Créer'}</button>
                : <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setEditSimu(false); setSimuResult(null); setSimuStep(1) }} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                    {simuResult && <button onClick={saveSimulation} disabled={savingSimu} style={{ background: '#16A34A', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>{savingSimu ? 'Sauvegarde…' : 'Sauvegarder'}</button>}
                  </div>
              }
            </div>

            {/* Lecture */}
            {!editSimu && !sim && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: C.textSoft, fontSize: 13 }}>
                Aucune simulation enregistrée.
              </div>
            )}

            {!editSimu && sim && (
              <div>
                <InfoRow label="Fiche CEE" value={sim.fiche_cee} />
                {sim.fiche_cee === 'IND-BA-110' ? <>
                  <InfoRow label="Zone" value={sim.zone_climatique} />
                  <InfoRow label="P convectif" value={simParams.p_convectif != null ? `${simParams.p_convectif} kW` : null} />
                  <InfoRow label="P radiatif"  value={simParams.p_radiatif  != null ? `${simParams.p_radiatif}  kW` : null} />
                  <InfoRow label="Surface"     value={simParams.surface_m2  ? `${simParams.surface_m2} m²` : null} />
                  <InfoRow label="Hauteur"     value={sim.hauteur_m != null  ? `${sim.hauteur_m} m` : null} />
                  <InfoRow label="Débit"       value={simParams.debit_unitaire ? `${Number(simParams.debit_unitaire).toLocaleString('fr')} m³/h` : null} />
                </> : sim.fiche_cee === 'BAT-TH-163' ? <>
                  <InfoRow label="Zone"        value={sim.zone_climatique} />
                  <InfoRow label="Surface"     value={simParams.surface_m2 ? `${simParams.surface_m2} m²` : null} />
                  <InfoRow label="PAC"         value={simParams.puissance_pac === 'small' ? '≤ 400 kW' : simParams.puissance_pac === 'large' ? '> 400 kW' : null} />
                  <InfoRow label="Bracket"     value={simParams.puissance_pac === 'small' ? (simParams.etas_bracket||'').replace(/_/g,' ') : (simParams.cop_bracket||'').replace(/_/g,' ')} />
                  <InfoRow label="Secteur"     value={simParams.secteur} />
                  <InfoRow label="Forfait"     value={simParams.forfait != null ? `${simParams.forfait} kWh/m²` : null} />
                  <InfoRow label="Bonification" value={simParams.bonification_x3 ? '×3 ACTIF' : null} color="#4ade80" />
                </> : <>
                  <InfoRow label="Type local"  value={simParams.type_local === 'sport_transport' ? 'Sport / Transport' : simParams.type_local === 'commerce_loisirs' ? 'Commerce / Loisirs' : null} />
                  <InfoRow label="Hauteur"     value={sim.hauteur_m != null ? `${sim.hauteur_m} m` : null} />
                  <InfoRow label="Zone"        value={sim.zone_climatique} />
                  <InfoRow label="P convectif" value={simParams.p_convectif != null ? `${simParams.p_convectif} kW` : null} />
                  <InfoRow label="P radiatif"  value={simParams.p_radiatif  != null ? `${simParams.p_radiatif}  kW` : null} />
                </>}
                {sim.fiche_cee !== 'BAT-TH-163' && <InfoRow label="Nb destrats" value={sim.nb_equipements} />}
                <InfoRow label="kWh cumac" value={simParams.kwh_cumac != null ? `${Number(simParams.kwh_cumac).toLocaleString('fr')} kWh` : null} />
                <InfoRow label="MWh cumac" value={sim.mwh_cumac != null ? `${sim.mwh_cumac} MWh` : null} />
                <div style={{ height: 1, background: C.border, margin: '10px 0' }} />
                <InfoRow label="Prime CEE" value={sim.prime_estimee != null ? `${Number(sim.prime_estimee).toLocaleString('fr')} €` : null} color="#7C3AED" />
                <InfoRow label="Coût prestation" value={simParams.cout_total != null ? `${Number(simParams.cout_total).toLocaleString('fr')} €` : null} color="#D97706" />
                <InfoRow label="Marge nette" value={simParams.marge != null ? `${Number(simParams.marge).toLocaleString('fr')} €` : null} color={simParams.marge >= 0 ? '#16A34A' : '#DC2626'} />
                <InfoRow label="Prix MWh" value={sim.prix_mwh != null ? `${sim.prix_mwh} €/MWh` : null} />
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                  <button
                    onClick={() => navigate('/hub', {
                      state: {
                        module: 'marges',
                        prefill: {
                          nomClient: dossier.prospects?.raison_sociale || '',
                          siret: dossier.prospects?.siret || '',
                          adresseSite: [dossier.prospects?.adresse, dossier.prospects?.code_postal, dossier.prospects?.ville].filter(Boolean).join(', '),
                          nomContact: dossier.prospects?.contact_nom || '',
                          fonctionContact: '',
                          telephoneClient: dossier.prospects?.contact_tel || '',
                          emailClient: dossier.prospects?.contact_email || '',
                          refDevis: dossier.ref || refDefault(),
                          dateDevis: new Date().toLocaleDateString('fr-FR'),
                          prime: sim.prime_estimee || 0,
                          batQte: sim.nb_equipements || 0,
                          batPuVente: simParams.cout_unitaire_destrat ? parseFloat(simParams.cout_unitaire_destrat) : 0,
                          batDebit: simParams.debit_unitaire || '14000',
                          ficheCee: sim.fiche_cee || 'BAT-TH-142',
                        },
                      },
                    })}
                    style={{ width: '100%', padding: '10px', background: C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    📄 Créer un devis à partir d'un devis prestataire
                  </button>
                </div>
              </div>
            )}

            {/* Édition — wizard 4 étapes */}
            {editSimu && (
              <div>

                {/* Barre de progression */}
                <div style={{ display:'flex', gap:3, marginBottom:10 }}>
                  {[1,2,3,4].map(s => (
                    <div key={s} style={{ flex:1, height:3, borderRadius:2, background: simuStep >= s ? C.accent : C.border, transition:'background .2s' }} />
                  ))}
                </div>
                <div style={{ fontSize:11, color:C.textSoft, marginBottom:14 }}>
                  Étape {simuStep}/4 — {['Fiche CEE','Informations client','Informations du site','Résultats'][simuStep-1]}
                </div>

                {/* ── ÉTAPE 1 : Fiche CEE (verrouillée) ── */}
                {simuStep === 1 && (
                  <>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>① Fiche CEE du dossier</label>
                    <div style={{ marginBottom:16 }}>
                      <div style={{ display:'inline-flex', alignItems:'center', gap:8, background: C.bg, border:`1px solid ${C.accent}`, borderRadius:8, padding:'12px 16px' }}>
                        <span style={{ fontSize:14, fontWeight:800, color:'#60A5FA' }}>{sForm.fiche_cee || dossier.fiche_cee}</span>
                        <span style={{ fontSize:11, color:C.textSoft }}>— verrouillé (défini à la création du dossier)</span>
                      </div>
                    </div>
                    <button onClick={() => setSimuStep(2)}
                      style={{ width:'100%', padding:'10px', background:C.accent, border:'none', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      Suivant →
                    </button>
                  </>
                )}

                {/* ── ÉTAPE 2 : Informations client ── */}
                {simuStep === 2 && (
                  <>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>② Informations client</label>

                    {/* Zone climatique — commun aux deux fiches */}
                    <div style={{ marginBottom:14 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>Zone climatique</label>
                      <div style={{ display:'flex', gap:6 }}>
                        {['H1','H2','H3'].map(z => (
                          <button key={z} type="button" onClick={() => setS('zone_climatique', z)}
                            style={{ flex:1, padding:'10px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700,
                              background: sForm.zone_climatique === z ? '#EFF6FF' : C.bg,
                              border: `1px solid ${sForm.zone_climatique === z ? C.accent : C.border}`,
                              color: sForm.zone_climatique === z ? C.accent : C.textMid }}>{z}</button>
                        ))}
                      </div>
                    </div>

                    {/* Type local — BAT-TH-142 uniquement */}
                    {sForm.fiche_cee === 'BAT-TH-142' && (
                      <div style={{ marginBottom:14 }}>
                        <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>Type de local</label>
                        <div style={{ display:'flex', gap:6 }}>
                          {[{ id:'sport_transport', label:'🏟️ Sport / Transport' }, { id:'commerce_loisirs', label:'🏬 Commerce / Loisirs' }].map(t => (
                            <button key={t.id} type="button" onClick={() => setS('type_local', t.id)}
                              style={{ flex:1, padding:'9px 6px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600,
                                background: sForm.type_local === t.id ? '#EFF6FF' : C.bg,
                                border: `1px solid ${sForm.type_local === t.id ? C.accent : C.border}`,
                                color: sForm.type_local === t.id ? C.accent : C.textMid }}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display:'flex', gap:6, marginTop:4 }}>
                      <button onClick={() => setSimuStep(1)}
                        style={{ flex:1, padding:'9px', background:'transparent', border:`1px solid ${C.border}`, color:C.textMid, borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>← Retour</button>
                      <button onClick={() => setSimuStep(3)} disabled={!sForm.zone_climatique}
                        style={{ flex:2, padding:'9px', background: sForm.zone_climatique ? C.accent : C.border, border:'none', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, cursor: sForm.zone_climatique ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
                        Suivant →
                      </button>
                    </div>
                  </>
                )}

                {/* ── ÉTAPE 3 : Informations du site ── */}
                {simuStep === 3 && (
                  <>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>③ Informations du site</label>

                    {/* BAT-TH-142 : hauteur */}
                    {sForm.fiche_cee === 'BAT-TH-142' && (
                      <Field label="Hauteur sous plafond" value={String(sForm.hauteur_m ?? '')} onChange={v => setS('hauteur_m', v)} type="number" placeholder="Ex: 10" suffix="m" />
                    )}

                    {/* IND-BA-110 : surface + hauteur + débit */}
                    {sForm.fiche_cee === 'IND-BA-110' && <>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
                        <Field label="Surface" value={String(sForm.surface_m2??'')} onChange={v=>setS('surface_m2',v)} type="number" placeholder="Ex: 2000" suffix="m²"/>
                        <Field label="Hauteur" value={String(sForm.hauteur_m??'')} onChange={v=>setS('hauteur_m',v)} type="number" placeholder="Ex: 8" suffix="m"/>
                      </div>
                      <div style={{ marginBottom:14 }}>
                        <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:6, textTransform:'uppercase', letterSpacing:.4 }}>Débit unitaire destrat</label>
                        <div style={{ display:'flex', gap:6 }}>
                          {[{id:'14000',label:'14 000 m³/h'},{id:'8500',label:'8 500 m³/h'}].map(d=>(
                            <button key={d.id} type="button" onClick={()=>setS('debit_unitaire',d.id)}
                              style={{flex:1,padding:'8px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,
                                background:sForm.debit_unitaire===d.id?'#EFF6FF':C.bg,
                                border:`1px solid ${sForm.debit_unitaire===d.id?C.accent:C.border}`,
                                color:sForm.debit_unitaire===d.id?C.accent:C.textMid}}>
                              {d.label}
                            </button>
                          ))}
                        </div>
                        {sForm.surface_m2 && sForm.hauteur_m && (
                          <div style={{marginTop:6,fontSize:11,color:C.textMid}}>
                            → Nb destrats estimé : <strong>{Math.ceil((parseFloat(sForm.surface_m2)*parseFloat(sForm.hauteur_m)*0.7)/parseFloat(sForm.debit_unitaire||14000))}</strong>
                          </div>
                        )}
                      </div>
                    </>}

                    {/* BAT-TH-163 : PAC air/eau */}
                    {sForm.fiche_cee === 'BAT-TH-163' && (
                      <div style={{ background: '#F0F7FF', border: `1px solid #BFDBFE`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 14 }}>♨️ PAC air/eau tertiaire</div>

                        <Field label="Surface du site" value={String(sForm.surface_m2??'')} onChange={v=>setS('surface_m2',v)} type="number" placeholder="Ex: 2000" suffix="m²"/>

                        {/* Puissance PAC */}
                        <div style={{ marginBottom: 14 }}>
                          <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>Puissance PAC *</label>
                          <div style={{ display:'flex', gap:8 }}>
                            {[{id:'small',label:'≤ 400 kW',desc:'Bracket par Etas'},{id:'large',label:'> 400 kW',desc:'Bracket par COP'}].map(t=>(
                              <button key={t.id} type="button" onClick={()=>setS('puissance_pac',t.id)}
                                style={{flex:1,padding:'10px 12px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',textAlign:'center',
                                  background:sForm.puissance_pac===t.id?'#EFF6FF':C.surface,
                                  border:`1px solid ${sForm.puissance_pac===t.id?C.accent:C.border}`}}>
                                <div style={{fontSize:13,fontWeight:700,color:sForm.puissance_pac===t.id?C.accent:C.text}}>{t.label}</div>
                                <div style={{fontSize:10,color:C.textSoft,marginTop:2}}>{t.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Bracket Etas (≤400 kW) */}
                        {sForm.puissance_pac === 'small' && (
                          <div style={{ marginBottom: 14 }}>
                            <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>Bracket Etas *</label>
                            <div style={{ display:'flex', gap:8 }}>
                              {[{id:'etas_111_126',label:'111% ≤ Etas < 126%'},{id:'etas_126_175',label:'126% ≤ Etas < 175%'},{id:'etas_175_plus',label:'Etas ≥ 175%'}].map(b=>(
                                <button key={b.id} type="button" onClick={()=>setS('etas_bracket',b.id)}
                                  style={{flex:1,padding:'8px 6px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:700,
                                    background:sForm.etas_bracket===b.id?'#EFF6FF':C.surface,
                                    border:`1px solid ${sForm.etas_bracket===b.id?C.accent:C.border}`,
                                    color:sForm.etas_bracket===b.id?C.accent:C.textMid}}>
                                  {b.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bracket COP (>400 kW) */}
                        {sForm.puissance_pac === 'large' && (
                          <div style={{ marginBottom: 14 }}>
                            <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>Bracket COP *</label>
                            <div style={{ display:'flex', gap:8 }}>
                              {[{id:'cop_3_4_4_5',label:'3,4 ≤ COP < 4,5'},{id:'cop_4_5_plus',label:'COP ≥ 4,5'}].map(b=>(
                                <button key={b.id} type="button" onClick={()=>setS('cop_bracket',b.id)}
                                  style={{flex:1,padding:'8px 6px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:700,
                                    background:sForm.cop_bracket===b.id?'#EFF6FF':C.surface,
                                    border:`1px solid ${sForm.cop_bracket===b.id?C.accent:C.border}`,
                                    color:sForm.cop_bracket===b.id?C.accent:C.textMid}}>
                                  {b.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Secteur d'activité */}
                        <div style={{ marginBottom: 14 }}>
                          <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>Secteur d'activité *</label>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                            {[
                              {id:'bureaux',label:'Bureaux',facteur:'×1,2'},
                              {id:'sante',label:'Santé',facteur:'×1,1'},
                              {id:'commerces',label:'Commerces',facteur:'×0,9'},
                              {id:'enseignement',label:'Enseignement',facteur:'×0,8'},
                              {id:'hotellerie_restauration',label:'Hôtellerie / Restauration',facteur:'×0,7'},
                              {id:'autres',label:'Autres',facteur:'×0,7'},
                            ].map(s=>(
                              <button key={s.id} type="button" onClick={()=>setS('secteur_163',s.id)}
                                style={{padding:'8px 6px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',textAlign:'center',
                                  background:sForm.secteur_163===s.id?'#EFF6FF':C.surface,
                                  border:`1px solid ${sForm.secteur_163===s.id?C.accent:C.border}`}}>
                                <div style={{fontSize:11,fontWeight:700,color:sForm.secteur_163===s.id?C.accent:C.text}}>{s.label}</div>
                                <div style={{fontSize:10,color:sForm.secteur_163===s.id?C.accent:C.textSoft}}>{s.facteur}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Coût installation */}
                        <div style={{ marginBottom: 14, position:'relative' }}>
                          <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:5, textTransform:'uppercase', letterSpacing:.4 }}>Coût installation</label>
                          <input type="number" value={sForm.cout_installation_163??''} onChange={e=>setS('cout_installation_163',e.target.value)} placeholder="ex : 45000"
                            style={{width:'100%',boxSizing:'border-box',background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'9px 28px 9px 12px',color:C.text,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
                          <span style={{position:'absolute',right:10,bottom:10,fontSize:12,color:C.textMid}}>€</span>
                        </div>

                        {/* Bonification ×3 */}
                        <div onClick={()=>setS('bonification_x3',!sForm.bonification_x3)}
                          style={{display:'flex',alignItems:'center',gap:10,background:sForm.bonification_x3?'#F0FDF4':C.surface,border:`1px solid ${sForm.bonification_x3?'#86EFAC':C.border}`,borderRadius:8,padding:'10px 12px',cursor:'pointer',userSelect:'none'}}>
                          <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${sForm.bonification_x3?'#16A34A':C.border}`,background:sForm.bonification_x3?'#16A34A':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {sForm.bonification_x3 && <span style={{color:'#fff',fontSize:12,fontWeight:900,lineHeight:1}}>✓</span>}
                          </div>
                          <div>
                            <div style={{fontSize:12,fontWeight:700,color:sForm.bonification_x3?'#16A34A':C.text}}>Bonification ×3</div>
                            <div style={{fontSize:10,color:C.textSoft}}>Multiplie le volume cumac par 3</div>
                          </div>
                          {sForm.bonification_x3 && <span style={{fontSize:11,fontWeight:700,color:'#16A34A',background:'#DCFCE7',borderRadius:5,padding:'2px 7px',marginLeft:'auto'}}>×3 ACTIF</span>}
                        </div>
                      </div>
                    )}

                    {/* Équipements convectifs / radiatifs / destrat — BAT-TH-142 + IND-BA-110 uniquement */}
                    {sForm.fiche_cee !== 'BAT-TH-163' && (<>
                      {/* Équipements convectifs */}
                      <div style={{ fontSize:11, fontWeight:600, color:C.textMid, marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>🌀 Chauffage convectif</div>
                      {(sForm.eqs_conv || []).map((eq, i) => {
                        const upd = p => setS('eqs_conv', sForm.eqs_conv.map((x,j) => j===i ? {...x,...p} : x))
                        return (
                          <div key={i} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center' }}>
                            <input value={eq.label??''} onChange={e=>upd({label:e.target.value})} style={{flex:2,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 10px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                            <input type="number" value={eq.quantite??''} onChange={e=>upd({quantite:e.target.value})} placeholder="Qté" style={{width:60,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 8px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                            <span style={{fontSize:11,color:C.textSoft}}>×</span>
                            <input type="number" value={eq.puissance_unitaire_kw??''} onChange={e=>upd({puissance_unitaire_kw:e.target.value})} placeholder="kW" style={{width:72,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 8px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                            <button onClick={()=>setS('eqs_conv',sForm.eqs_conv.filter((_,j)=>j!==i))} style={{background:'transparent',border:`1px solid ${C.border}`,color:'#EF4444',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer'}}>✕</button>
                          </div>
                        )
                      })}
                      <button onClick={()=>setS('eqs_conv',[...(sForm.eqs_conv||[]),{label:'Chaudière aérothermique',quantite:'',puissance_unitaire_kw:''}])}
                        style={{background:'transparent',border:`1px solid ${C.border}`,color:C.textMid,borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit',marginBottom:14}}>+ Ajouter convectif</button>

                      {/* Équipements radiatifs */}
                      <div style={{ fontSize:11, fontWeight:600, color:C.textMid, marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>☀️ Chauffage radiatif</div>
                      {(sForm.eqs_rad || []).map((eq, i) => {
                        const upd = p => setS('eqs_rad', sForm.eqs_rad.map((x,j) => j===i ? {...x,...p} : x))
                        return (
                          <div key={i} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center' }}>
                            <input value={eq.label??''} onChange={e=>upd({label:e.target.value})} style={{flex:2,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 10px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                            <input type="number" value={eq.quantite??''} onChange={e=>upd({quantite:e.target.value})} placeholder="Qté" style={{width:60,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 8px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                            <span style={{fontSize:11,color:C.textSoft}}>×</span>
                            <input type="number" value={eq.puissance_unitaire_kw??''} onChange={e=>upd({puissance_unitaire_kw:e.target.value})} placeholder="kW" style={{width:72,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 8px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                            <button onClick={()=>setS('eqs_rad',sForm.eqs_rad.filter((_,j)=>j!==i))} style={{background:'transparent',border:`1px solid ${C.border}`,color:'#EF4444',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer'}}>✕</button>
                          </div>
                        )
                      })}
                      <button onClick={()=>setS('eqs_rad',[...(sForm.eqs_rad||[]),{label:'Équipement radiatif',quantite:'',puissance_unitaire_kw:''}])}
                        style={{background:'transparent',border:`1px solid ${C.border}`,color:C.textMid,borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit',marginBottom:14}}>+ Ajouter radiatif</button>

                      {/* Destrat */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
                        <Field label="Nb déstratificateurs" value={String(sForm.nb_destrat??'')} onChange={v=>setS('nb_destrat',v)} type="number" placeholder="Ex: 4"/>
                        <Field label="Coût unitaire destrat" value={String(sForm.cout_unitaire_destrat??'')} onChange={v=>setS('cout_unitaire_destrat',v)} type="number" suffix="€"/>
                      </div>
                    </>)}

                    {/* Prix MWh — toutes fiches */}
                    <Field label="Prix MWh" value={String(sForm.prix_mwh??'')} onChange={v=>setS('prix_mwh',v)} type="number" suffix="€/MWh"/>

                    <div style={{ display:'flex', gap:6, marginTop:4 }}>
                      <button onClick={() => setSimuStep(2)}
                        style={{ flex:1, padding:'9px', background:'transparent', border:`1px solid ${C.border}`, color:C.textMid, borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>← Retour</button>
                      <button onClick={() => { setSimuResult(null); setSimuStep(4) }}
                        style={{ flex:2, padding:'9px', background:C.accent, border:'none', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                        Suivant →
                      </button>
                    </div>
                  </>
                )}

                {/* ── ÉTAPE 4 : Résultats ── */}
                {simuStep === 4 && (
                  <>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>④ Résultats</label>

                    {/* Récap fiche + zone */}
                    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12, color:C.textMid }}>
                      <span style={{ fontWeight:700, color:C.text }}>{sForm.fiche_cee}</span>
                      {' · '}Zone <strong>{sForm.zone_climatique || '—'}</strong>
                      {sForm.fiche_cee === 'BAT-TH-142' && <> · <strong>{sForm.type_local === 'sport_transport' ? 'Sport/Transport' : 'Commerce/Loisirs'}</strong></>}
                      {sForm.fiche_cee === 'BAT-TH-163' ? <>
                        {' · '}{sForm.surface_m2} m²
                        {' · '}{sForm.puissance_pac === 'small' ? '≤400 kW' : '>400 kW'}
                        {' · '}<span style={{color:'#60A5FA'}}>{sForm.puissance_pac === 'small' ? (sForm.etas_bracket||'').replace(/_/g,' ') : (sForm.cop_bracket||'').replace(/_/g,' ')}</span>
                        {' · '}{sForm.secteur_163} (×{FACTEURS_SECTEUR_163[sForm.secteur_163]})
                        {sForm.bonification_x3 && <span style={{color:'#4ade80',fontWeight:700}}> · ×3 ACTIF</span>}
                      </> : <>
                        {' · '}Hauteur <strong>{sForm.hauteur_m || '—'} m</strong>
                        <br/>
                        <span>Convectif : <strong>{(sForm.eqs_conv||[]).reduce((s,e)=>s+eqPuissance(e),0).toFixed(1)} kW</strong></span>
                        {' · '}
                        <span>Radiatif : <strong>{(sForm.eqs_rad||[]).reduce((s,e)=>s+eqPuissance(e),0).toFixed(1)} kW</strong></span>
                      </>}
                    </div>

                    <button onClick={calculerSimuLocal} disabled={!canCalculerLocal}
                      style={{ width:'100%', padding:'10px', background:C.accent, border:'none', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, cursor: canCalculerLocal ? 'pointer' : 'not-allowed', fontFamily:'inherit', marginBottom: simuResult ? 12 : 0, opacity: canCalculerLocal ? 1 : .5 }}>
                      Calculer ⟳
                    </button>

                    {simuResult && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
                        {simuResult.fiche === 'BAT-TH-163' ? <>
                          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>📊 kWh cumac{simuResult.kwhCumacBase !== simuResult.kwhCumac ? ` (×3)` : ''}</div>
                            <div style={{ fontSize:16, fontWeight:800, color:'#94A3B8' }}>{simuResult.kwhCumac?.toLocaleString('fr')} kWh</div>
                            {simuResult.kwhCumacBase !== simuResult.kwhCumac && <div style={{fontSize:10,color:C.textSoft,marginTop:2}}>base : {simuResult.kwhCumacBase?.toLocaleString('fr')} kWh</div>}
                          </div>
                          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>💶 Prime brute</div>
                            <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{simuResult.prime?.toLocaleString('fr')} €</div>
                          </div>
                          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>💵 Prime nette (hors TVA 10%)</div>
                            <div style={{ fontSize:16, fontWeight:800, color:'#818cf8' }}>{simuResult.primeNette?.toLocaleString('fr')} €</div>
                            <div style={{fontSize:10,color:C.textSoft,marginTop:2}}>{simuResult.prime?.toLocaleString('fr')} € × 0,9</div>
                          </div>
                          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>🔧 Coût installation</div>
                            <div style={{ fontSize:16, fontWeight:800, color:'#fb923c' }}>{simuResult.coutTotal?.toLocaleString('fr')} €</div>
                          </div>
                          <div style={{ gridColumn:'1/-1', background: simuResult.rentable ? '#F0FDF4' : '#FEF2F2', border:`1px solid ${simuResult.rentable ? '#86EFAC' : '#FECACA'}`, borderRadius:8, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>{simuResult.rentable ? '✅' : '❌'} Marge nette</div>
                            <div style={{ fontSize:20, fontWeight:800, color: simuResult.rentable ? '#16A34A' : '#DC2626' }}>{simuResult.marge?.toLocaleString('fr')} €</div>
                            <div style={{fontSize:10,color:C.textSoft,marginTop:2}}>Prime nette ({simuResult.primeNette?.toLocaleString('fr')} €) − Coût ({simuResult.coutTotal?.toLocaleString('fr')} €)</div>
                          </div>
                        </> : <>
                          {[
                            { label: 'kWh cumac',    value: `${simuResult.kwhCumac?.toLocaleString('fr')} kWh`, color: '#94A3B8' },
                            { label: '⚡ MWh cumac',  value: `${simuResult.mwh} MWh`,                           color: C.accent  },
                            { label: '💶 Prime CEE',  value: `${simuResult.prime.toLocaleString('fr')} €`,       color: '#7C3AED' },
                            { label: '🔧 Coût',       value: `${simuResult.coutTotal.toLocaleString('fr')} €`,   color: '#D97706' },
                            { label: simuResult.rentable ? '✅ Marge nette' : '❌ Marge nette',
                              value: `${simuResult.marge.toLocaleString('fr')} €`,
                              color: simuResult.rentable ? '#16A34A' : '#DC2626' },
                          ].map(item => (
                            <div key={item.label} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
                              <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>{item.label}</div>
                              <div style={{ fontSize:16, fontWeight:800, color:item.color }}>{item.value}</div>
                            </div>
                          ))}
                        </>}
                      </div>
                    )}

                    <div style={{ display:'flex', gap:6, marginTop:12 }}>
                      <button onClick={() => setSimuStep(3)}
                        style={{ flex:1, padding:'9px', background:'transparent', border:`1px solid ${C.border}`, color:C.textMid, borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>← Retour</button>
                    </div>
                  </>
                )}

              </div>
            )}
          </div>
            </div>
          </div>
        )}

        {/* ── Tab: Appels ── */}
        {activeTab === 'appels' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>📞 Suivi des appels</span>
              <button onClick={() => setShowAppelForm(s => !s)}
                style={{ background: showAppelForm ? C.bg : C.accent, border: `1px solid ${showAppelForm ? C.border : C.accent}`, color: showAppelForm ? C.textMid : '#fff', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                {showAppelForm ? 'Annuler' : '+ Nouvel appel'}
              </button>
            </div>

            {showAppelForm && (
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px', marginBottom: 16 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .4 }}>Résultat de l'appel</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { v: 'nrp',            l: 'NRP',            col: '#DC2626', bg: '#FEE2E2' },
                      { v: 'message_laisse', l: 'Message laissé', col: '#D97706', bg: '#FEF3C7' },
                      { v: 'rappel',         l: 'À rappeler',     col: '#0891B2', bg: '#CFFAFE' },
                      { v: 'joint',          l: 'Contacté',       col: '#16A34A', bg: '#DCFCE7' },
                    ].map(o => (
                      <button key={o.v} onClick={() => setAppelEtat(o.v)}
                        style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: appelEtat === o.v ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit',
                          border: `1px solid ${appelEtat === o.v ? o.col : C.border}`,
                          background: appelEtat === o.v ? o.bg : C.surface,
                          color: appelEtat === o.v ? o.col : C.textMid }}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                {appelEtat === 'rappel' && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>Date & heure de rappel</label>
                    <input type="datetime-local" value={appelRappelAt} onChange={e => setAppelRappelAt(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', fontSize: 13, color: C.text, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                )}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>Note (optionnel)</label>
                  <input type="text" value={appelNote} onChange={e => setAppelNote(e.target.value)} placeholder="Ex : répondeur, message laissé à la secrétaire…"
                    style={{ width: '100%', boxSizing: 'border-box', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', fontSize: 13, color: C.text, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <button onClick={addAppel} disabled={savingAppel}
                  style={{ width: '100%', padding: '9px', background: C.accent, border: 'none', color: '#fff', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: savingAppel ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: savingAppel ? .6 : 1 }}>
                  {savingAppel ? '…' : "Enregistrer l'appel"}
                </button>
              </div>
            )}

            {appels.length > 0 && (() => {
              const last = appels[0]
              const days = Math.floor((Date.now() - new Date(last.created_at).getTime()) / 86400000)
              const ETATS = { nrp: 'NRP', message_laisse: 'Message laissé', rappel: 'À rappeler', joint: 'Contacté' }
              return (
                <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 7, padding: '9px 14px', marginBottom: 14, fontSize: 12, color: '#15803D', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>Dernier appel :</span>
                  <span>{days === 0 ? "Aujourd'hui" : days === 1 ? 'Hier' : `il y a ${days} jour${days > 1 ? 's' : ''}`}</span>
                  <span>—</span>
                  <span>{ETATS[last.etat] || last.etat}</span>
                  {last.rappel_at && (
                    <span style={{ color: '#0891B2', fontWeight: 600 }}>
                      · Rappel le {new Date(last.rappel_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {new Date(last.rappel_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )
            })()}

            {appelsLoading ? (
              <div style={{ textAlign: 'center', color: C.textSoft, fontSize: 13, padding: '20px 0' }}>Chargement…</div>
            ) : appels.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.textSoft, fontSize: 13, padding: '20px 0' }}>Aucun appel enregistré pour ce dossier.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {appels.map((a, idx) => {
                  const ETATS = {
                    nrp:            { l: 'NRP',            col: '#DC2626', bg: '#FEE2E2' },
                    message_laisse: { l: 'Message laissé', col: '#D97706', bg: '#FEF3C7' },
                    rappel:         { l: 'À rappeler',     col: '#0891B2', bg: '#CFFAFE' },
                    joint:          { l: 'Contacté',       col: '#16A34A', bg: '#DCFCE7' },
                  }
                  const et = ETATS[a.etat] || { l: a.etat, col: C.textMid, bg: C.bg }
                  const dateStr = new Date(a.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
                  const daysAgo = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000)
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: idx === 0 ? C.surface : C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: et.bg, color: et.col, flexShrink: 0, marginTop: 1 }}>{et.l}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: C.textMid }}>
                          {dateStr}
                          <span style={{ fontSize: 10, color: C.textSoft, marginLeft: 8 }}>
                            ({daysAgo === 0 ? "aujourd'hui" : daysAgo === 1 ? 'hier' : `il y a ${daysAgo}j`})
                          </span>
                        </div>
                        {a.rappel_at && (
                          <div style={{ fontSize: 12, color: '#0891B2', marginTop: 3, fontWeight: 600 }}>
                            📅 Rappeler le {new Date(a.rappel_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {new Date(a.rappel_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {a.note && <div style={{ fontSize: 12, color: C.text, marginTop: 3, fontStyle: 'italic' }}>"{a.note}"</div>}
                      </div>
                      <button onClick={() => deleteAppel(a.id)}
                        style={{ background: 'transparent', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: '0 2px' }}>×</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Documents ── */}
        {activeTab === 'documents' && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>📎 Documents</span>
            <span style={{ fontSize: 11, color: C.textSoft }}>{documents.length} fichier{documents.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Zone drag & drop */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? C.accent : C.border}`,
              borderRadius: 10,
              padding: '24px 16px',
              textAlign: 'center',
              cursor: uploading ? 'not-allowed' : 'pointer',
              background: dragOver ? '#EFF6FF' : C.bg,
              transition: 'all .15s',
              marginBottom: 16,
              opacity: uploading ? .6 : 1,
            }}>
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
              onChange={e => uploadFiles(e.target.files)} />
            {uploading ? (
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>⏳ Upload en cours…</div>
            ) : (
              <>
                <div style={{ fontSize: 24, marginBottom: 6 }}>☁️</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid }}>Glissez des fichiers ici ou cliquez pour parcourir</div>
                <div style={{ fontSize: 11, color: C.textSoft, marginTop: 4 }}>PDF, images, Word, Excel, ZIP… tous formats acceptés</div>
              </>
            )}
          </div>

          {uploadError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#DC2626', whiteSpace: 'pre-wrap' }}>
              ⚠️ Erreur upload : {uploadError}
              <button onClick={() => setUploadError(null)} style={{ float: 'right', background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Liste des fichiers */}
          {docsLoading ? (
            <div style={{ textAlign: 'center', padding: '12px 0', color: C.textSoft, fontSize: 12 }}>Chargement…</div>
          ) : documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 0', color: C.textSoft, fontSize: 12 }}>Aucun document pour ce dossier.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {documents.map(doc => {
                const ext = doc.name.split('.').pop().toLowerCase()
                const icon = ['pdf'].includes(ext) ? '📄' : ['jpg','jpeg','png','gif','webp'].includes(ext) ? '🖼️' : ['doc','docx'].includes(ext) ? '📝' : ['xls','xlsx','csv'].includes(ext) ? '📊' : ['zip','rar','7z'].includes(ext) ? '🗜️' : '📎'
                const sizeKb = doc.metadata?.size ? (doc.metadata.size / 1024).toFixed(0) : null
                const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : null
                // Retirer le préfixe timestamp ajouté lors de l'upload
                const displayName = doc.name.replace(/^\d+_/, '')
                const isChecked = checkedDocs.has(doc.name)
                return (
                  <div key={doc.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: isChecked ? '#EFF6FF' : C.bg, border: `1px solid ${renamingDoc === doc.name ? C.accent : isChecked ? C.accent : C.border}`, borderRadius: 8, padding: '9px 12px', transition: 'all .15s' }}>
                    <input type="checkbox" checked={isChecked}
                      onChange={() => setCheckedDocs(s => { const n = new Set(s); isChecked ? n.delete(doc.name) : n.add(doc.name); return n })}
                      style={{ flexShrink: 0, cursor: 'pointer', width: 14, height: 14, accentColor: C.accent }} />
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                    {renamingDoc === doc.name ? (
                      <>
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') renameDocument(doc.name, renameValue); if (e.key === 'Escape') setRenamingDoc(null) }}
                          style={{ flex: 1, fontSize: 12, fontWeight: 600, background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '5px 8px', color: C.text, outline: 'none', fontFamily: 'inherit' }}
                        />
                        <button onClick={() => renameDocument(doc.name, renameValue)}
                          style={{ background: '#16A34A', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, flexShrink: 0 }}>
                          ✓
                        </button>
                        <button onClick={() => setRenamingDoc(null)}
                          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                          <div style={{ fontSize: 10, color: C.textSoft, marginTop: 1 }}>
                            {[sizeKb ? `${sizeKb} Ko` : null, date].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <button onClick={() => { setRenamingDoc(doc.name); setRenameValue(displayName) }}
                          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }} title="Renommer">
                          ✏️
                        </button>
                        <button onClick={() => downloadDocument(doc.name)} title="Ouvrir"
                          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.accent, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                          👁
                        </button>
                        <button onClick={() => forceDownloadDocument(doc.name)} title="Télécharger"
                          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.accent, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, flexShrink: 0 }}>
                          ⬇
                        </button>
                        <button onClick={() => emailDocument(doc.name)} disabled={emailingDoc === doc.name} title="Brouillon Gmail"
                          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: '#16A34A', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: emailingDoc === doc.name ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: emailingDoc === doc.name ? .5 : 1 }}>
                          {emailingDoc === doc.name ? '⏳' : '📧'}
                        </button>
                        <button onClick={() => deleteDocument(doc.name)}
                          style={{ background: 'transparent', border: `1px solid #FECACA`, color: '#DC2626', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
              {checkedDocs.size > 0 && (
                <div style={{ marginTop: 8, background: '#EFF6FF', border: `1px solid ${C.accent}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>
                    {checkedDocs.size} document{checkedDocs.size > 1 ? 's' : ''} sélectionné{checkedDocs.size > 1 ? 's' : ''} pour le vérificateur
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setCheckedDocs(new Set())}
                      style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Désélectionner
                    </button>
                    <button
                      style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                      ✓ Envoyer au vérificateur
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* ── Tab: Visio ── */}
        {activeTab === 'visio' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📹 Visio</div>

            {/* Choix provider */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[
                { id: 'meet',   label: '🟢 Google Meet',     a: '#16A34A', bg: '#F0FDF4', t: '#15803D' },
                { id: 'teams',  label: '🟣 Teams',            a: '#5B5EA6', bg: '#EDEDFF', t: '#5B5EA6' },
                { id: 'visite', label: '🔧 Visite technique', a: '#D97706', bg: '#FFFBEB', t: '#92400E' },
              ].map(p => {
                const sel = meetProvider === p.id
                return (
                  <button key={p.id} onClick={() => setMeetProvider(p.id)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: sel ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${sel ? p.a : C.border}`,
                      background: sel ? p.bg : C.bg,
                      color: sel ? p.t : C.textMid }}>
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* Calendrier dispo */}
            <div style={{ marginBottom: 10 }}>
              <CalendarPicker
                session={session}
                selectedDate={teamsDate}
                selectedTime={teamsTime}
                onSelect={(date, time) => { setTeamsDate(date); setTeamsTime(time) }}
              />
            </div>

            {/* Date / heure sélectionnées */}
            {teamsDate && teamsTime && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: '#EFF6FF', border: `1px solid ${C.accent}`, borderRadius: 7, padding: '7px 12px' }}>
                <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>
                  📅 {new Date(teamsDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {teamsTime.replace(':', 'h')}
                </span>
                <button onClick={() => { setTeamsDate(''); setTeamsTime('') }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
              </div>
            )}

            {/* Durée */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 3 }}>Durée</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[30, 45, 60, 90].map(d => (
                  <button key={d} onClick={() => setTeamsDuration(d)}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: teamsDuration === d ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${teamsDuration === d ? C.accent : C.border}`,
                      background: teamsDuration === d ? '#EFF6FF' : C.bg,
                      color: teamsDuration === d ? C.accent : C.textMid }}>
                    {d < 60 ? `${d}min` : `${d / 60}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* Participants */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 3 }}>Participants (séparés par des virgules)</div>
              <textarea value={teamsEmails} onChange={e => setTeamsEmails(e.target.value)}
                rows={2} placeholder="client@exemple.com, collègue@picpus.fr"
                style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 10px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'none', lineHeight: 1.5 }} />
            </div>

            {/* Action principale selon provider */}
            {meetProvider === 'meet' && (
              <button
                onClick={async () => {
                  setMeetCreating(true); setMeetError(null)
                  try {
                    const start = new Date(`${teamsDate}T${teamsTime}:00`)
                    const end   = new Date(start.getTime() + teamsDuration * 60000)
                    const r = await fetch('/api/calendar?action=meet', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        subject: `RDV ${dossier.prospects?.raison_sociale || 'Client'} — SOFT.IA`,
                        startDateTime: start.toISOString(),
                        endDateTime:   end.toISOString(),
                        emails: teamsEmails.split(',').map(e => e.trim()).filter(Boolean),
                      }),
                    })
                    const d = await r.json()
                    if (d.error === 'scope_missing') throw new Error('Scope manquant — reconnecte ton compte Google dans les paramètres')
                    if (d.error) throw new Error(d.error)
                    setReunionLinkInput(d.meetLink)
                    setReunionLink(d.meetLink)
                    await updateDossier(id, { reunion_link: d.meetLink })
                    setReunionSaved(true)
                    setTimeout(() => setReunionSaved(false), 3000)
                  } catch (e) { setMeetError(e.message) }
                  setMeetCreating(false)
                }}
                disabled={meetCreating || !teamsDate || !teamsTime}
                style={{ width: '100%', padding: '9px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#16A34A', border: 'none', color: '#fff', marginBottom: meetError ? 8 : 10, opacity: meetCreating ? .7 : 1 }}>
                {meetCreating ? '⏳ Création en cours…' : '🟢 Créer la réunion Google Meet'}
              </button>
            )}

            {meetProvider === 'teams' && (
              <div>
                <button
                  onClick={() => window.open('https://teams.live.com', '_blank')}
                  style={{ width: '100%', padding: '9px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#5B5EA6', border: 'none', color: '#fff', marginBottom: 6 }}>
                  🟣 Ouvrir Teams
                </button>
                <div style={{ fontSize: 11, color: C.textSoft, textAlign: 'center', marginBottom: 10 }}>
                  Crée ta réunion dans Teams, puis colle le lien ci-dessous
                </div>
              </div>
            )}

            {meetProvider === 'visite' && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 3 }}>Adresse de la visite</div>
                <input
                  ref={addressInputRef}
                  value={visiteAddress}
                  onChange={e => setVisiteAddress(e.target.value)}
                  placeholder="12 rue de la Paix, 75001 Paris"
                  style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }}
                />
                <button
                  onClick={async () => {
                    setVisiteCreating(true); setVisiteError(null)
                    try {
                      const start = new Date(`${teamsDate}T${teamsTime}:00`)
                      const end   = new Date(start.getTime() + teamsDuration * 60000)
                      const r = await fetch('/api/calendar?action=event', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          subject: `Visite technique — ${dossier.prospects?.raison_sociale || 'Client'}`,
                          startDateTime: start.toISOString(),
                          endDateTime:   end.toISOString(),
                          location: visiteAddress,
                          emails: teamsEmails.split(',').map(e => e.trim()).filter(Boolean),
                        }),
                      })
                      const d = await r.json()
                      if (d.error) throw new Error(d.error)
                      setVisiteCreated(true)
                      setTimeout(() => setVisiteCreated(false), 4000)
                    } catch (e) { setVisiteError(e.message) }
                    setVisiteCreating(false)
                  }}
                  disabled={visiteCreating || !teamsDate || !teamsTime}
                  style={{ width: '100%', padding: '9px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', color: '#fff', marginBottom: 6,
                    background: visiteCreated ? '#16A34A' : '#D97706', opacity: visiteCreating ? .7 : 1 }}>
                  {visiteCreating ? '⏳ Envoi…' : visiteCreated ? '✓ Invitation envoyée !' : '🔧 Créer la visite technique'}
                </button>
                {visiteError && <div style={{ fontSize: 12, color: '#DC2626' }}>⚠️ {visiteError}</div>}
              </div>
            )}

            {meetError && (
              <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10 }}>⚠️ {meetError}</div>
            )}

            {/* Coller le lien manuellement (Teams uniquement) */}
            {meetProvider === 'teams' && (
              <div style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 7, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: C.textMid, fontWeight: 600, marginBottom: 6 }}>
                  Coller le lien de la réunion :
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={reunionLinkInput}
                    onChange={e => { setReunionLinkInput(e.target.value); setReunionSaved(false) }}
                    placeholder="https://meet.google.com/xxx  ou  https://teams.microsoft.com/..."
                    style={{ flex: 1, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, color: C.text, outline: 'none', fontFamily: 'inherit' }}
                  />
                  <button
                    onClick={async () => {
                      if (!reunionLinkInput.trim()) return
                      setSavingReunion(true)
                      await updateDossier(id, { reunion_link: reunionLinkInput.trim() })
                      setReunionLink(reunionLinkInput.trim())
                      setReunionSaved(true)
                      setSavingReunion(false)
                      setTimeout(() => setReunionSaved(false), 3000)
                    }}
                    disabled={savingReunion || !reunionLinkInput.trim()}
                    style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                      background: reunionSaved ? '#16A34A' : C.accent, color: '#fff', whiteSpace: 'nowrap', opacity: savingReunion ? .6 : 1 }}>
                    {reunionSaved ? '✓' : savingReunion ? '…' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            )}

            {/* Lien sauvegardé */}
            {reunionLink && (
              <div style={{ marginTop: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 7, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#15803D', fontWeight: 700, marginBottom: 6 }}>🔗 Lien de réunion sauvegardé</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input readOnly value={reunionLink}
                    style={{ flex: 1, background: '#fff', border: '1px solid #BBF7D0', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#166534', outline: 'none', fontFamily: 'monospace' }} />
                  <button onClick={() => { navigator.clipboard.writeText(reunionLink).catch(() => {}); setReunionCopied(true); setTimeout(() => setReunionCopied(false), 2000) }}
                    style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${reunionCopied ? '#16A34A' : '#BBF7D0'}`,
                      background: reunionCopied ? '#DCFCE7' : '#fff',
                      color: reunionCopied ? '#16A34A' : '#166534', whiteSpace: 'nowrap' }}>
                    {reunionCopied ? '✓' : '⎘'}
                  </button>
                  <button onClick={() => window.open(reunionLink, '_blank')}
                    style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid #BBF7D0', background: '#16A34A', color: '#fff', whiteSpace: 'nowrap' }}>
                    Rejoindre
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Email ── */}
        {activeTab === 'email' && (
          <EmailSection dossierId={id} statut={dossier.statut} />
        )}

      </div>
      </div>
    </div>
  )
}
