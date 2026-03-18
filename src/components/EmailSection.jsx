// src/components/EmailSection.jsx
// Section "Emails" intégrée dans la fiche dossier.
// Génération Claude selon le statut courant, historique persistant.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

const EMAIL_TYPES = [
  { key: 'visio_creneaux', label: 'Proposition créneaux visio',    statuts: ['contacte'],         needsSlots: true  },
  { key: 'visio_confirm',  label: 'Confirmation visio',            statuts: ['visio_planifiee'],  needsSlots: false },
  { key: 'post_visio',     label: 'Post-visio — éléments',        statuts: ['visio_effectuee'],  needsSlots: false },
  { key: 'visite_confirm', label: 'Confirmation visite technique', statuts: ['visite_planifiee'], needsSlots: false },
  { key: 'envoi_devis',    label: 'Envoi de devis',                statuts: ['visite_effectuee'], needsSlots: false },
  { key: 'relance',        label: 'Relance devis',                 statuts: ['devis'],            needsSlots: false },
]

const ACTIVE_STATUTS = ['contacte','visio_planifiee','visio_effectuee','visite_planifiee','visite_effectuee','devis']

function getTypesForStatut(statut) {
  return EMAIL_TYPES.filter(t => t.statuts.includes(statut))
}

export default function EmailSection({ dossierId, statut }) {
  const { session } = useStore()

  const [generations,   setGenerations]   = useState({})
  const [selectedType,  setSelectedType]  = useState(null)
  const [subject,       setSubject]       = useState('')
  const [body,          setBody]          = useState('')
  const [generating,    setGenerating]    = useState(false)
  const [error,         setError]         = useState(null)
  const [copied,        setCopied]        = useState(false)

  const [slots,         setSlots]         = useState([])
  const [loadingSlots,  setLoadingSlots]  = useState(false)
  const [selectedSlots, setSelectedSlots] = useState([])
  const [slotsLoaded,   setSlotsLoaded]   = useState(false)
  const [slotsError,    setSlotsError]    = useState(null)

  const availableTypes = getTypesForStatut(statut)
  const isActive = ACTIVE_STATUTS.includes(statut)

  // Charger les générations sauvegardées
  useEffect(() => {
    if (!dossierId) return
    supabase
      .from('email_generations')
      .select('type, subject, body, updated_at')
      .eq('dossier_id', dossierId)
      .then(({ data }) => {
        const map = {}
        data?.forEach(g => { map[g.type] = g })
        setGenerations(map)
        // Pré-sélectionner le premier type disponible + charger le texte sauvegardé
        const types = getTypesForStatut(statut)
        if (types.length > 0) {
          const first = types[0].key
          setSelectedType(first)
          if (map[first]) {
            setSubject(map[first].subject || '')
            setBody(map[first].body || '')
          }
        }
      })
  }, [dossierId, statut])

  // Changer de type
  const handleTypeChange = (typeKey) => {
    setSelectedType(typeKey)
    setError(null)
    setSlots([])
    setSelectedSlots([])
    setSlotsLoaded(false)
    const gen = generations[typeKey]
    setSubject(gen?.subject || '')
    setBody(gen?.body || '')
  }

  // Charger créneaux Calendar
  const loadSlots = async () => {
    setLoadingSlots(true)
    setSlotsError(null)
    try {
      const r = await fetch('/api/calendar?action=slots', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setSlots(d.slots || [])
      setSlotsLoaded(true)
    } catch (e) {
      setSlotsError(e.message)
    }
    setLoadingSlots(false)
  }

  // Générer
  const handleGenerate = async () => {
    if (!selectedType || !session) return
    setGenerating(true)
    setError(null)
    try {
      const r = await fetch('/api/email-generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dossierId,
          type: selectedType,
          ...(selectedSlots.length ? { selectedSlots } : {}),
        }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setSubject(d.subject)
      setBody(d.body)
      // Mettre à jour le cache local
      setGenerations(prev => ({
        ...prev,
        [selectedType]: { subject: d.subject, body: d.body, updated_at: new Date().toISOString() },
      }))
    } catch (e) {
      setError(e.message)
    }
    setGenerating(false)
  }

  // Copier
  const handleCopy = async () => {
    const text = subject ? `Objet : ${subject}\n\n${body}` : body
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const currentTypeConfig = EMAIL_TYPES.find(t => t.key === selectedType)
  const savedGen = selectedType ? generations[selectedType] : null

  if (!isActive) return null

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>✉️ Email à générer</div>

      {/* Sélection type */}
      {availableTypes.length === 0 ? (
        <div style={{ fontSize: 13, color: C.textSoft, fontStyle: 'italic' }}>
          Aucun type d'email pour ce statut.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {availableTypes.map(t => {
              const hasSaved = !!generations[t.key]
              const isSelected = selectedType === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => handleTypeChange(t.key)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .1s',
                    border: `1px solid ${isSelected ? C.accent : C.border}`,
                    background: isSelected ? '#EFF6FF' : C.bg,
                    color: isSelected ? C.accent : C.textMid,
                  }}
                >
                  {t.label}
                  {hasSaved && <span style={{ marginLeft: 4, color: '#16A34A', fontSize: 10 }}>✓</span>}
                </button>
              )
            })}
          </div>

          {/* Créneaux Calendar (visio_creneaux) */}
          {currentTypeConfig?.needsSlots && (
            <div style={{ marginBottom: 12 }}>
              {!slotsLoaded ? (
                <button
                  onClick={loadSlots}
                  disabled={loadingSlots}
                  style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: loadingSlots ? 'not-allowed' : 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`, background: C.bg, color: C.textMid, opacity: loadingSlots ? .6 : 1 }}
                >
                  {loadingSlots ? '⏳ Chargement créneaux…' : '📅 Charger les créneaux disponibles'}
                </button>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: C.textMid, marginBottom: 6 }}>Sélectionne les créneaux à proposer :</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {slots.map((slot, i) => {
                      const isSel = selectedSlots.some(s => s.start === slot.start)
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedSlots(prev =>
                            isSel ? prev.filter(s => s.start !== slot.start) : [...prev, slot]
                          )}
                          style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                            border: `1px solid ${isSel ? C.accent : C.border}`,
                            background: isSel ? '#EFF6FF' : C.bg,
                            color: isSel ? C.accent : C.textMid,
                            fontWeight: isSel ? 700 : 400,
                          }}
                        >
                          {slot.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {slotsError && <div style={{ fontSize: 12, color: '#DC2626', marginTop: 6 }}>{slotsError}</div>}
            </div>
          )}

          {/* Bouton générer */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: body ? 12 : 0 }}>
            <button
              onClick={handleGenerate}
              disabled={generating || (currentTypeConfig?.needsSlots && slotsLoaded && selectedSlots.length === 0)}
              style={{
                padding: '7px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                cursor: (generating || (currentTypeConfig?.needsSlots && slotsLoaded && selectedSlots.length === 0)) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', border: 'none',
                background: C.accent, color: '#fff', opacity: generating ? .7 : 1,
              }}
            >
              {generating ? '⏳ Génération…' : body ? '↺ Régénérer' : '✨ Générer'}
            </button>
            {savedGen?.updated_at && !body && (
              <button
                onClick={() => { setSubject(savedGen.subject || ''); setBody(savedGen.body || '') }}
                style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`, background: C.bg, color: C.textMid }}
              >
                Voir la dernière génération
              </button>
            )}
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 12, color: '#DC2626' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Résultat */}
          {body && (
            <div style={{ marginTop: 4 }}>
              {subject && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>Objet</div>
                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 12px', color: C.text, fontSize: 13, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>
              )}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>Corps</div>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={8}
                  style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '10px 12px', color: C.text, fontSize: 13, lineHeight: 1.6, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={handleCopy}
                  style={{
                    padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${copied ? '#16A34A' : C.border}`,
                    background: copied ? '#F0FDF4' : C.bg,
                    color: copied ? '#16A34A' : C.textMid,
                  }}
                >
                  {copied ? '✓ Copié !' : '⎘ Copier tout'}
                </button>
                {savedGen?.updated_at && (
                  <span style={{ fontSize: 11, color: C.textSoft }}>
                    Généré le {new Date(savedGen.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
