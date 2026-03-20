import { useState, useEffect, useRef, useCallback } from 'react'
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

// ── Zones de visite ──────────────────────────────────────────────────────────
const ZONES = [
  { id: 'infos',        icon: '📋', title: 'Infos générales',             photoCats: [] },
  { id: 'vue_generale', icon: '🏭', title: 'Vue générale & Bâtiment',     photoCats: ['vue_generale'] },
  { id: 'chaufferie',   icon: '🔥', title: 'Chaufferie',                   photoCats: ['chaufferie'] },
  { id: 'tgbt',         icon: '⚡', title: 'TGBT',                         photoCats: ['tgbt'] },
  { id: 'td',           icon: '🔌', title: 'Tableau divisionnaire',        photoCats: ['td'] },
  { id: 'equipements',  icon: '🔧', title: 'Équipements & CEE',            photoCats: ['equipements', 'plaque_constructeur', 'compteur'] },
  { id: 'observations', icon: '📝', title: 'Observations & Après travaux', photoCats: ['apres_travaux', 'autres'] },
  { id: 'rapport',      icon: '📄', title: 'Rapport & Envoi',              photoCats: [] },
]

// ── Autocomplete adresse ─────────────────────────────────────────────────────
function AdresseAutocomplete({ value, onChange }) {
  const [sugg, setSugg]   = useState([])
  const [open, setOpen]   = useState(false)
  const timer             = useRef(null)

  const search = (q) => {
    onChange(q)
    clearTimeout(timer.current)
    if (q.length < 3) { setSugg([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try {
        const base = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`
        const startsWithNum = /^\d/.test(q)
        const res  = await fetch(startsWithNum ? base + '&type=housenumber' : base)
        const data = await res.json()
        let features = data.features || []
        if (!features.length && startsWithNum) {
          const r2 = await fetch(base)
          features = (await r2.json()).features || []
        }
        setSugg(features)
        setOpen(features.length > 0)
      } catch {}
    }, 300)
  }

  const select = (feat) => {
    onChange(feat.properties.label || '')
    setSugg([]); setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value || ''}
        onChange={e => search(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 350)}
        placeholder="12 rue des Acacias, 75012 Paris…"
        style={INP}
      />
      {open && sugg.length > 0 && (
        <div onMouseDown={e => e.preventDefault()}
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200, overflow: 'hidden' }}>
          {sugg.map((f, i) => (
            <div key={i}
              onClick={() => select(f)}
              onTouchEnd={e => { e.preventDefault(); select(f) }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.bg}`, fontSize: 13, color: C.text }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {f.properties.label}
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

// ── En-tête de zone ──────────────────────────────────────────────────────────
function ZoneHeader({ zone, photoCount, fieldCount, active, onClick }) {
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', cursor: 'pointer', borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent', userSelect: 'none' }}>
      <span style={{ fontSize: 20 }}>{zone.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: active ? C.accent : C.text }}>{zone.title}</div>
        <div style={{ fontSize: 11, color: C.textSoft, marginTop: 1 }}>
          {photoCount > 0 && <span style={{ marginRight: 8 }}>📷 {photoCount}</span>}
          {fieldCount > 0 && <span>✓ {fieldCount} champ{fieldCount > 1 ? 's' : ''}</span>}
        </div>
      </div>
      <span style={{ fontSize: 12, color: C.textSoft }}>{active ? '▲' : '▼'}</span>
    </div>
  )
}

export default function VisiteTechniqueDetail() {
  const { id }                    = useParams()
  const navigate                  = useNavigate()
  const { profile, session }      = useStore()
  const isNew                     = id === 'new'

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

  // Dossier search
  const [allDossiers,   setAllDossiers]   = useState([])
  const [dossierSearch, setDossierSearch] = useState('')
  const [dossierOpen,   setDossierOpen]   = useState(false)

  const zoneRefs  = useRef({})
  const saveTimer = useRef(null)

  // ── Chargement ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAllDossiers()
    if (!isNew) loadVisite()
  }, [id])

  const loadAllDossiers = async () => {
    const { data: dos } = await supabase.from('dossiers')
      .select('id, ref, prospect_id').order('created_at', { ascending: false }).limit(200)
    if (!dos?.length) { setAllDossiers([]); return }
    const prospectIds = [...new Set(dos.map(d => d.prospect_id).filter(Boolean))]
    let prospectMap = {}
    if (prospectIds.length) {
      const { data: pros } = await supabase.from('prospects')
        .select('id, raison_sociale, adresse, code_postal, ville, contact_nom, contact_tel, contact_email').in('id', prospectIds)
      ;(pros || []).forEach(p => { prospectMap[p.id] = p })
    }
    setAllDossiers(dos.map(d => ({
      ...d,
      prospects: prospectMap[d.prospect_id] || {},
    })))
  }

  const loadVisite = async () => {
    setLoading(true)
    const { data } = await supabase.from('visites_techniques')
      .select('*').eq('id', id).single()
    if (!data) { navigate('/visites', { replace: true }); return }
    setDonnees(data.donnees || {})
    setPhotos(data.photos || [])
    setStatut(data.statut)
    setRapportUrl(data.rapport_url)
    setToken(data.partage_token)
    // Charge le dossier lié séparément
    if (data.dossier_id) {
      const { data: dos } = await supabase.from('dossiers')
        .select('id, ref, prospect_id').eq('id', data.dossier_id).single()
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
    const { data, error } = await supabase.from('visites_techniques').insert({
      created_by: profile?.id, type_fiche: 'IND-BA-110', statut: 'brouillon', donnees: d, photos: p,
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
        await supabase.from('visites_techniques').update({ donnees: newDonnees, updated_at: new Date().toISOString() }).eq('id', vid)
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

  // ── Dossier ─────────────────────────────────────────────────────────────────
  const dossierResults = dossierSearch.length > 1
    ? allDossiers.filter(d =>
        d.ref?.toLowerCase().includes(dossierSearch.toLowerCase()) ||
        d.prospects?.raison_sociale?.toLowerCase().includes(dossierSearch.toLowerCase())
      ).slice(0, 6)
    : []

  const selectDossier = async (d) => {
    setDossier(d); setDossierRef(d.ref); setDossierSearch(''); setDossierOpen(false)
    const p = d.prospects || {}
    const adresseProspect = [p.adresse, p.code_postal, p.ville].filter(Boolean).join(', ')
    const nd = {
      ...donnees,
      raison_sociale: donnees.raison_sociale || p.raison_sociale || '',
      adresse_site:   donnees.adresse_site   || adresseProspect  || '',
      contact_nom:    donnees.contact_nom    || p.contact_nom    || '',
      contact_tel:    donnees.contact_tel    || p.contact_tel    || '',
    }
    setDonnees(nd)
    const vid = await ensureCreated(nd, photos)
    await supabase.from('visites_techniques').update({ dossier_id: d.id, donnees: nd }).eq('id', vid)
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
    const idx = ZONES.findIndex(z => z.id === currentId)
    if (idx < ZONES.length - 1) goToZone(ZONES[idx + 1].id)
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

  // ── Helpers rendu ────────────────────────────────────────────────────────────
  const zonePhotoCount = (zone) => photos.filter(p => zone.photoCats.includes(p.categorie)).length
  const nom = donnees.nom_site || donnees.raison_sociale || (isNew ? 'Nouvelle visite' : 'Sans nom')

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.textSoft }}>Chargement…</div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Barre fixe en haut ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 24px', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 980, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate('/visites')} style={{ background: 'none', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 20, padding: 0, lineHeight: 1 }}>←</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{nom}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '1px 7px', borderRadius: 5 }}>IND-BA-110</span>
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

        {/* Navigation zones — scroll horizontal */}
        <div style={{ display: 'flex', gap: 4, marginTop: 10, maxWidth: 980, margin: '10px auto 0', overflowX: 'auto', paddingBottom: 2 }}>
          {ZONES.map(z => {
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

          {ZONES.map((zone, zoneIdx) => {
            const isActive  = activeZone === zone.id
            const photoCnt  = zonePhotoCount(zone)

            return (
              <div key={zone.id} ref={el => zoneRefs.current[zone.id] = el}
                style={{ background: C.surface, border: `1px solid ${isActive ? C.accent : C.border}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color .2s' }}>

                <ZoneHeader zone={zone} photoCount={photoCnt}
                  fieldCount={zone.photoCats.length === 0 ? 0 : 0}
                  active={isActive}
                  onClick={() => setActiveZone(isActive ? '' : zone.id)}
                />

                {isActive && (
                  <div style={{ padding: '20px 20px 24px', borderTop: `1px solid ${C.bg}` }}>

                    {/* ══ ZONE INFOS GÉNÉRALES ══ */}
                    {zone.id === 'infos' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                              {dossierOpen && dossierResults.length > 0 && (
                                <div onMouseDown={e => e.preventDefault()}
                                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200, overflow: 'hidden' }}>
                                  {dossierResults.map(d => (
                                    <div key={d.id}
                                      onClick={() => selectDossier(d)}
                                      onTouchEnd={e => { e.preventDefault(); selectDossier(d) }}
                                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.bg}`, fontSize: 13, color: C.text }}
                                      onMouseEnter={e => e.currentTarget.style.background = C.bg}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <strong>{d.ref}</strong> — {d.prospects?.raison_sociale}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Grille champs */}
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
                          <Field label="Notes d'accès" full>
                            <textarea style={{ ...INP, resize: 'vertical', minHeight: 90 }} value={v('notes_acces')} onChange={e => set('notes_acces', e.target.value)} placeholder="Horaires d'accès, digicode, interlocuteur sur site, contraintes particulières…" />
                          </Field>
                        </div>
                      </div>
                    )}

                    {/* ══ ZONE VUE GÉNÉRALE & BÂTIMENT ══ */}
                    {zone.id === 'vue_generale' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} showCategories={zone.photoCats} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                          <Field label="Type de bâtiment">
                            <select style={SEL} value={v('type_batiment')} onChange={e => set('type_batiment', e.target.value)}>
                              <option value="">— Sélectionner —</option>
                              <option value="atelier_industriel">Atelier industriel</option>
                              <option value="entrepot_logistique">Entrepôt logistique</option>
                              <option value="atelier_artisanal">Atelier artisanal</option>
                              <option value="batiment_agricole">Bâtiment agricole</option>
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

                    {/* ══ ZONE CHAUFFERIE ══ */}
                    {zone.id === 'chaufferie' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} showCategories={zone.photoCats} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
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
                        </div>
                      </div>
                    )}

                    {/* ══ ZONE TGBT ══ */}
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
                            <textarea style={{ ...INP, resize: 'vertical', minHeight: 80 }} value={v('tgbt_observations')} onChange={e => set('tgbt_observations', e.target.value)} placeholder="Observations, état des disjoncteurs, disponibilité de départs…" />
                          </Field>
                        </div>
                      </div>
                    )}

                    {/* ══ ZONE TD ══ */}
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

                    {/* ══ ZONE ÉQUIPEMENTS & CEE ══ */}
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
                          <Field label="Heures de fonctionnement / an">
                            <input style={INP} type="number" min="0" max="8760" value={v('heures_fonctionnement')} onChange={e => set('heures_fonctionnement', e.target.value)} placeholder="Ex: 3000" />
                          </Field>
                          <Field label="Température de consigne (°C)">
                            <input style={INP} type="number" min="5" max="30" value={v('temperature_consigne')} onChange={e => set('temperature_consigne', e.target.value)} placeholder="Ex: 16" />
                          </Field>
                        </div>

                        {/* kWh cumac en temps réel */}
                        {v('zone_climatique') && (parseFloat(v('puissance_convectif_kw')) > 0 || parseFloat(v('puissance_radiatif_kw')) > 0) && (() => {
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

                    {/* ══ ZONE OBSERVATIONS & APRÈS TRAVAUX ══ */}
                    {zone.id === 'observations' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} showCategories={zone.photoCats} />
                        <Field label="Observations générales" full>
                          <textarea style={{ ...INP, resize: 'vertical', minHeight: 120 }} value={v('observations_generales')} onChange={e => set('observations_generales', e.target.value)} placeholder="Remarques, contraintes particulières, points d'attention, travaux à prévoir…" />
                        </Field>
                      </div>
                    )}

                    {/* ══ ZONE RAPPORT & ENVOI ══ */}
                    {zone.id === 'rapport' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Résumé */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                          {[
                            { label: 'Site', value: donnees.nom_site || donnees.raison_sociale || '—' },
                            { label: 'Fiche CEE', value: 'IND-BA-110' },
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

                        {/* PDF */}
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

                        {/* Lien de partage */}
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

                        {/* Email */}
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
                                ? <></>
                                : `⚠ ${emailResult.error}`}
                              {emailResult.success && <>✓ Brouillon créé — <a href={emailResult.gmailUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#15803D', fontWeight: 700 }}>Ouvrir dans Gmail →</a></>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bouton Suivant (sauf dernière zone) */}
                    {zoneIdx < ZONES.length - 1 && (
                      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => nextZone(zone.id)}
                          style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Suivant → {ZONES[zoneIdx + 1].icon} {ZONES[zoneIdx + 1].title}
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
