import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { pdf } from '@react-pdf/renderer'
import VisiteFormIND110 from '../components/visite/VisiteFormIND110'
import PhotoSection from '../components/visite/PhotoSection'
import VisiteRapportPDF from '../components/visite/VisiteRapportPDF'

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

const TABS = [
  { id: 'infos',      label: '📋 Infos générales' },
  { id: 'technique',  label: '🔧 Technique IND-BA-110' },
  { id: 'photos',     label: '📷 Photos' },
  { id: 'rapport',    label: '📄 Rapport & Envoi' },
]

export default function VisiteTechniqueDetail() {
  const { id }        = useParams()
  const navigate      = useNavigate()
  const { profile, session } = useStore()
  const isNew         = id === 'new'

  const [visiteId,    setVisiteId]    = useState(isNew ? null : id)
  const [donnees,     setDonnees]     = useState({})
  const [photos,      setPhotos]      = useState([])
  const [statut,      setStatut]      = useState('brouillon')
  const [typeFiche,   setTypeFiche]   = useState('IND-BA-110')
  const [dossier,     setDossier]     = useState(null)  // dossier lié
  const [dossierRef,  setDossierRef]  = useState('')
  const [tab,         setTab]         = useState('infos')
  const [saveStatus,  setSaveStatus]  = useState('saved') // 'saving' | 'saved' | 'error'
  const [loading,     setLoading]     = useState(!isNew)
  const [generating,  setGenerating]  = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailResult,  setEmailResult]  = useState(null)
  const [rapportUrl,   setRapportUrl]   = useState(null)
  const [token,        setToken]        = useState(null)
  // Dossier search
  const [dossierSearch, setDossierSearch] = useState('')
  const [dossierSugg,   setDossierSugg]   = useState([])

  const saveTimer = useRef(null)

  // ── Chargement visite existante ──────────────────────────────────────────
  useEffect(() => {
    if (isNew) return
    loadVisite()
  }, [id])

  const loadVisite = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('visites_techniques')
      .select('*, dossiers(ref, prospects(raison_sociale, siret, contact_email))')
      .eq('id', id)
      .single()
    if (!data) { navigate('/visites', { replace: true }); return }
    setDonnees(data.donnees || {})
    setPhotos(data.photos || [])
    setStatut(data.statut)
    setTypeFiche(data.type_fiche)
    setRapportUrl(data.rapport_url)
    setToken(data.partage_token)
    if (data.dossiers) {
      setDossier(data.dossiers)
      setDossierRef(data.dossiers.ref)
    }
    setLoading(false)
  }

  // ── Création visite (si new) ─────────────────────────────────────────────
  const ensureCreated = useCallback(async (currentDonnees, currentPhotos) => {
    if (visiteId) return visiteId
    const { data, error } = await supabase
      .from('visites_techniques')
      .insert({
        created_by: profile?.id,
        type_fiche: typeFiche,
        statut: 'brouillon',
        donnees: currentDonnees,
        photos: currentPhotos,
      })
      .select()
      .single()
    if (error || !data) throw error
    setVisiteId(data.id)
    setToken(data.partage_token)
    navigate(`/visites/${data.id}`, { replace: true })
    return data.id
  }, [visiteId, profile?.id, typeFiche, navigate])

  // ── Autosave données ─────────────────────────────────────────────────────
  const scheduleSave = useCallback((newDonnees) => {
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const vid = await ensureCreated(newDonnees, photos)
        await supabase.from('visites_techniques').update({
          donnees: newDonnees, updated_at: new Date().toISOString(),
        }).eq('id', vid)
        setSaveStatus('saved')
      } catch { setSaveStatus('error') }
    }, 1500)
  }, [ensureCreated, photos])

  const handleDonneesChange = (newDonnees) => {
    setDonnees(newDonnees)
    scheduleSave(newDonnees)
  }

  // ── Sauvegarde immédiate des photos ──────────────────────────────────────
  const handlePhotosChange = async (newPhotos) => {
    setPhotos(newPhotos)
    setSaveStatus('saving')
    try {
      const vid = await ensureCreated(donnees, newPhotos)
      await supabase.from('visites_techniques').update({
        photos: newPhotos, updated_at: new Date().toISOString(),
      }).eq('id', vid)
      setSaveStatus('saved')
    } catch { setSaveStatus('error') }
  }

  // ── Validation / Reprise ─────────────────────────────────────────────────
  const toggleStatut = async () => {
    const newStatut = statut === 'validée' ? 'brouillon' : 'validée'
    const vid = await ensureCreated(donnees, photos)
    await supabase.from('visites_techniques').update({ statut: newStatut }).eq('id', vid)
    setStatut(newStatut)
  }

  // ── Recherche dossier ────────────────────────────────────────────────────
  const searchDossier = async (q) => {
    setDossierSearch(q)
    if (q.length < 2) { setDossierSugg([]); return }
    const { data } = await supabase
      .from('dossiers')
      .select('id, ref, prospects(raison_sociale)')
      .or(`ref.ilike.%${q}%,prospects.raison_sociale.ilike.%${q}%`)
      .limit(6)
    setDossierSugg(data || [])
  }

  const selectDossier = async (d) => {
    setDossier(d)
    setDossierRef(d.ref)
    setDossierSearch('')
    setDossierSugg([])
    // Pré-remplir donnees depuis le dossier
    const newDonnees = {
      ...donnees,
      raison_sociale: d.prospects?.raison_sociale || donnees.raison_sociale || '',
    }
    setDonnees(newDonnees)
    // Sauvegarder le lien
    const vid = await ensureCreated(newDonnees, photos)
    await supabase.from('visites_techniques').update({ dossier_id: d.id, donnees: newDonnees }).eq('id', vid)
    setSaveStatus('saved')
  }

  const unlinkDossier = async () => {
    setDossier(null)
    setDossierRef('')
    if (visiteId) await supabase.from('visites_techniques').update({ dossier_id: null }).eq('id', visiteId)
  }

  // ── Génération PDF + upload ──────────────────────────────────────────────
  const genererRapport = async () => {
    setGenerating(true)
    try {
      const vid = await ensureCreated(donnees, photos)
      const visiteData = { id: vid, donnees, photos, statut, type_fiche: typeFiche }
      const blob = await pdf(<VisiteRapportPDF visite={visiteData} dossierRef={dossierRef} />).toBlob()
      const fileName = `rapport_${vid}_${Date.now()}.pdf`
      const { error } = await supabase.storage.from('visites-photos').upload(`${vid}/${fileName}`, blob, { contentType: 'application/pdf', upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('visites-photos').getPublicUrl(`${vid}/${fileName}`)
      setRapportUrl(publicUrl)
      await supabase.from('visites_techniques').update({ rapport_url: publicUrl }).eq('id', vid)
      // Télécharger localement
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `Rapport_Visite_${dossierRef || vid}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Erreur génération PDF : ' + e.message)
    } finally {
      setGenerating(false)
    }
  }

  // ── Envoi email (brouillon Gmail) ────────────────────────────────────────
  const envoyerEmail = async () => {
    if (!rapportUrl) return alert('Générez d\'abord le rapport PDF.')
    const email = donnees.prestataire_email
    if (!email) return alert('Renseignez l\'email du prestataire.')
    setSendingEmail(true)
    setEmailResult(null)
    try {
      const partageUrl = `${window.location.origin}/rapport/${token}`
      const res = await fetch('/api/rapport-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          visiteId: visiteId || id,
          prestataireEmail: email,
          prestataireNom: donnees.prestataire_nom || '',
          nomSite: donnees.nom_site || donnees.raison_sociale || 'Site',
          rapportUrl,
          partageUrl,
          dossierRef,
        }),
      })
      const data = await res.json()
      if (data.gmailUrl) {
        setEmailResult({ success: true, gmailUrl: data.gmailUrl })
      } else {
        setEmailResult({ success: false, error: data.error })
      }
    } catch (e) {
      setEmailResult({ success: false, error: e.message })
    } finally {
      setSendingEmail(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.textSoft }}>Chargement de la visite…</div>
  )

  const nom = donnees.nom_site || donnees.raison_sociale || (isNew ? 'Nouvelle visite' : 'Visite sans nom')
  const photoCount = photos.length

  return (
    <div style={{ padding: '20px 24px', maxWidth: 900, margin: '0 auto' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/visites')} style={{ background: 'none', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 20, padding: 0 }}>←</button>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.text }}>{nom}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '2px 7px', borderRadius: 5 }}>{typeFiche}</span>
              {dossierRef && <span style={{ fontSize: 11, color: C.accent }}>📁 {dossierRef}</span>}
              <span style={{ fontSize: 11, color: saveStatus === 'saving' ? '#D97706' : saveStatus === 'error' ? '#DC2626' : '#16A34A' }}>
                {saveStatus === 'saving' ? '⏳ Enregistrement…' : saveStatus === 'error' ? '⚠ Erreur' : '✓ Enregistré'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            background: statut === 'validée' ? '#DCFCE7' : '#FEF3C7',
            color: statut === 'validée' ? '#15803D' : '#D97706',
            padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700
          }}>
            {statut === 'validée' ? '✓ Validée' : '✏ Brouillon'}
          </span>
          <button
            onClick={toggleStatut}
            style={{ background: statut === 'validée' ? C.bg : '#16A34A', color: statut === 'validée' ? C.textMid : '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {statut === 'validée' ? 'Reprendre' : 'Valider la visite'}
          </button>
        </div>
      </div>

      {/* ── Onglets ── */}
      <div style={{ display: 'flex', gap: 2, borderBottom: `2px solid ${C.border}`, marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #2563EB' : '2px solid transparent',
              marginBottom: -2, padding: '10px 16px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? C.accent : C.textMid, cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {t.id === 'photos' && photoCount > 0 && (
              <span style={{ background: C.accent, color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, marginLeft: 6 }}>{photoCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Contenu onglet INFOS ── */}
      {tab === 'infos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Lier à un dossier */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📁 Dossier lié <span style={{ fontSize: 11, fontWeight: 400, color: C.textSoft }}>(optionnel)</span></div>
            {dossier ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>📁 {dossier.ref} — {dossier.prospects?.raison_sociale}</span>
                <button onClick={unlinkDossier} style={{ background: 'none', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  value={dossierSearch}
                  onChange={e => searchDossier(e.target.value)}
                  placeholder="Rechercher un dossier par référence ou raison sociale…"
                  style={INP}
                />
                {dossierSugg.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden' }}>
                    {dossierSugg.map(d => (
                      <div key={d.id} onClick={() => selectDossier(d)} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${C.bg}` }}
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

          {/* Informations site */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>🏭 Informations du site</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {[
                { key: 'raison_sociale', label: 'Raison sociale', ph: 'Ex: SARL Dupont Industrie' },
                { key: 'nom_site',       label: 'Nom du site',    ph: 'Ex: Atelier principal' },
                { key: 'adresse_site',   label: 'Adresse du site', ph: 'Ex: 12 rue des Acacias, 75012 Paris', full: true },
                { key: 'contact_nom',    label: 'Contact sur site', ph: 'Nom du contact' },
                { key: 'contact_tel',    label: 'Téléphone', ph: '06 00 00 00 00' },
                { key: 'date_visite',    label: 'Date de visite', type: 'date' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid }}>{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    style={INP}
                    value={donnees[f.key] || ''}
                    onChange={e => handleDonneesChange({ ...donnees, [f.key]: e.target.value })}
                    placeholder={f.ph}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid }}>Notes d'accès</label>
                <textarea
                  style={{ ...INP, resize: 'vertical', minHeight: 70 }}
                  value={donnees.notes_acces || ''}
                  onChange={e => handleDonneesChange({ ...donnees, notes_acces: e.target.value })}
                  placeholder="Horaires d'accès, digicode, contact gardien…"
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Contenu onglet TECHNIQUE ── */}
      {tab === 'technique' && (
        <VisiteFormIND110 donnees={donnees} onChange={handleDonneesChange} />
      )}

      {/* ── Contenu onglet PHOTOS ── */}
      {tab === 'photos' && (
        <div>
          {!visiteId && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#92400E', marginBottom: 16 }}>
              ⚠️ Renseignez d'abord les informations du site pour activer la prise de photos.
            </div>
          )}
          <PhotoSection visiteId={visiteId} photos={photos} onPhotosChange={handlePhotosChange} />
        </div>
      )}

      {/* ── Contenu onglet RAPPORT ── */}
      {tab === 'rapport' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Récapitulatif */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>📊 Récapitulatif</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Site', value: donnees.nom_site || donnees.raison_sociale || '—' },
                { label: 'Fiche CEE', value: typeFiche },
                { label: 'Statut', value: statut === 'validée' ? '✓ Validée' : '✏ Brouillon' },
                { label: 'Photos', value: `${photoCount} photo${photoCount !== 1 ? 's' : ''}` },
                { label: 'Zone climatique', value: donnees.zone_climatique || '—' },
                { label: 'Puissance convectif', value: donnees.puissance_convectif_kw ? `${donnees.puissance_convectif_kw} kW` : '—' },
              ].map(item => (
                <div key={item.label} style={{ background: C.bg, borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Génération PDF */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>📄 Rapport PDF</div>
            <div style={{ fontSize: 12, color: C.textSoft, marginBottom: 14 }}>
              Génère le rapport complet (données techniques + photos) et le télécharge sur votre appareil.
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={genererRapport}
                disabled={generating}
                style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: generating ? 'wait' : 'pointer', fontFamily: 'inherit' }}
              >
                {generating ? '⏳ Génération…' : '⬇ Générer & Télécharger le PDF'}
              </button>
              {rapportUrl && (
                <a href={rapportUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>
                  Voir le dernier rapport →
                </a>
              )}
            </div>
          </div>

          {/* Lien de partage */}
          {token && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>🔗 Lien de partage</div>
              <div style={{ fontSize: 12, color: C.textSoft, marginBottom: 12 }}>
                Lien accessible sans connexion — à partager avec votre prestataire.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  readOnly
                  value={`${window.location.origin}/rapport/${token}`}
                  style={{ ...INP, color: C.accent, fontFamily: 'monospace', fontSize: 12 }}
                />
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/rapport/${token}`)}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                >
                  📋 Copier
                </button>
              </div>
            </div>
          )}

          {/* Email prestataire */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>✉️ Envoyer au prestataire</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid }}>Nom du prestataire</label>
                <input style={INP} value={donnees.prestataire_nom || ''} onChange={e => handleDonneesChange({ ...donnees, prestataire_nom: e.target.value })} placeholder="Ex: Bureau d'études Dupont" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid }}>Email du prestataire</label>
                <input style={INP} type="email" value={donnees.prestataire_email || ''} onChange={e => handleDonneesChange({ ...donnees, prestataire_email: e.target.value })} placeholder="contact@prestataire.fr" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={envoyerEmail}
                disabled={sendingEmail || !donnees.prestataire_email}
                style={{ background: sendingEmail || !donnees.prestataire_email ? C.bg : '#0369A1', color: sendingEmail || !donnees.prestataire_email ? C.textSoft : '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: sendingEmail || !donnees.prestataire_email ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                {sendingEmail ? '⏳ Envoi…' : '✉️ Créer le brouillon Gmail'}
              </button>
              <span style={{ fontSize: 12, color: C.textSoft }}>Le rapport PDF + le lien de partage seront inclus.</span>
            </div>
            {emailResult && (
              <div style={{ marginTop: 12, background: emailResult.success ? '#DCFCE7' : '#FEF2F2', border: `1px solid ${emailResult.success ? '#86EFAC' : '#FCA5A5'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: emailResult.success ? '#15803D' : '#DC2626' }}>
                {emailResult.success ? (
                  <>✓ Brouillon créé — <a href={emailResult.gmailUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#15803D', fontWeight: 700 }}>Ouvrir dans Gmail →</a></>
                ) : (
                  `⚠ Erreur : ${emailResult.error}`
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
