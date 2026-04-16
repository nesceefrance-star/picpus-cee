// EmailGenerateur.jsx — Module standalone de génération d'emails CEE
import { useState } from 'react'
import useStore from '../store/useStore'

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

const EMAIL_TYPES = [
  { key: 'visio_creneaux',  label: 'Créneaux visio',      icon: '📅', desc: 'Proposer des créneaux de visioconférence',     needsSlots: true,  slotType: 'visio'   },
  { key: 'visio_confirm',   label: 'Confirmation visio',  icon: '✅', desc: "Confirmer la date/heure d'une visio",          needsSlots: false  },
  { key: 'post_visio',      label: 'Post-visio',           icon: '📋', desc: 'Demander les éléments complémentaires',        needsSlots: false  },
  { key: 'visite_creneaux', label: 'Créneaux visite',      icon: '🗓️', desc: 'Proposer des créneaux de visite technique',    needsSlots: true,  slotType: 'visite'  },
  { key: 'visite_confirm',  label: 'Confirmation visite', icon: '🔧', desc: "Confirmer la date/heure d'une visite tech.",   needsSlots: false  },
  { key: 'envoi_devis',     label: 'Envoi de devis',       icon: '💶', desc: 'Envoyer le devis avec prime CEE',              needsSlots: false  },
  { key: 'relance',         label: 'Relance devis',        icon: '🔔', desc: 'Relancer sans insistance après envoi devis',   needsSlots: false  },
]

export default function EmailGenerateur() {
  const { session } = useStore()

  // ── Contact libre ─────────────────────────────────────────────────────────
  const [contactNom,  setContactNom]  = useState('')
  const [entreprise,  setEntreprise]  = useState('')

  // ── Type d'email ──────────────────────────────────────────────────────────
  const [selectedType,  setSelectedType]  = useState(null)
  const [subject,       setSubject]       = useState('')
  const [body,          setBody]          = useState('')
  const [generating,    setGenerating]    = useState(false)
  const [error,         setError]         = useState(null)
  const [copied,        setCopied]        = useState(false)

  const handleTypeChange = (key) => {
    setSelectedType(key)
    setError(null)
    setSlots([])
    setSelectedSlots([])
    setSlotsLoaded(false)
    setWeekOffset(0)
    setSubject('')
    setBody('')
  }

  // ── Créneaux ──────────────────────────────────────────────────────────────
  const [slots,         setSlots]         = useState([])
  const [loadingSlots,  setLoadingSlots]  = useState(false)
  const [selectedSlots, setSelectedSlots] = useState([])
  const [slotsLoaded,   setSlotsLoaded]   = useState(false)
  const [slotsError,    setSlotsError]    = useState(null)
  const [weekOffset,    setWeekOffset]    = useState(0)

  const loadSlots = async (week = weekOffset) => {
    setLoadingSlots(true); setSlotsError(null)
    const typeConf = EMAIL_TYPES.find(t => t.key === selectedType)
    const slotType = typeConf?.slotType || 'visio'
    try {
      const r = await fetch(`/api/calendar?action=slots${slotType === 'visite' ? '&type=visite' : ''}&week=${week}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setSlots(d.slots || []); setSlotsLoaded(true)
    } catch (e) { setSlotsError(e.message) }
    setLoadingSlots(false)
  }

  const changeWeek = async (delta) => {
    const next = Math.max(0, Math.min(weekOffset + delta, 4))
    if (next === weekOffset) return
    setWeekOffset(next); setSelectedSlots([])
    await loadSlots(next)
  }

  // ── Génération ────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedType || !session) return
    setGenerating(true); setError(null)
    try {
      const r = await fetch('/api/email-generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactNom: contactNom.trim() || undefined,
          entreprise: entreprise.trim() || undefined,
          type: selectedType,
          ...(selectedSlots.length ? { selectedSlots } : {}),
        }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setSubject(d.subject); setBody(d.body)
    } catch (e) { setError(e.message) }
    setGenerating(false)
  }

  const handleCopy = async () => {
    const text = subject ? `Objet : ${subject}\n\n${body}` : body
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const currentTypeConfig = EMAIL_TYPES.find(t => t.key === selectedType)
  const needsSlots = currentTypeConfig?.needsSlots
  const canGenerate = !!selectedType && (!needsSlots || selectedSlots.length > 0)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '24px 24px 40px', fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>✉️ Générateur d'emails CEE</div>
        <div style={{ fontSize: 13, color: C.textMid, marginTop: 4 }}>
          Générez un email personnalisé — aucun dossier requis, juste le nom du contact et son entreprise.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', maxWidth: 1100 }}>

        {/* ── Formulaire ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Étape 1 — Contact */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>1. Contact (optionnel)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5 }}>Nom du contact</div>
                <input
                  value={contactNom}
                  onChange={e => setContactNom(e.target.value)}
                  placeholder="ex : Jean Dupont"
                  style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5 }}>Entreprise</div>
                <input
                  value={entreprise}
                  onChange={e => setEntreprise(e.target.value)}
                  placeholder="ex : Société Martin SAS"
                  style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </div>

          {/* Étape 2 — Type d'email */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>2. Choisissez le type d'email</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {EMAIL_TYPES.map(t => (
                <button key={t.key} type="button" onClick={() => handleTypeChange(t.key)}
                  style={{ padding: '12px 10px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                    background: selectedType === t.key ? '#EFF6FF' : C.bg,
                    border: `2px solid ${selectedType === t.key ? C.accent : C.border}` }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: selectedType === t.key ? '#2563EB' : C.text, lineHeight: 1.2 }}>{t.label}</div>
                  <div style={{ fontSize: 9, color: C.textSoft, marginTop: 3, lineHeight: 1.3 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Étape 3 — Créneaux (conditionnel) */}
          {needsSlots && selectedType && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
                3. Sélectionnez les créneaux à proposer
              </div>

              {!slotsLoaded ? (
                <button onClick={() => loadSlots(0)} disabled={loadingSlots}
                  style={{ background: loadingSlots ? C.bg : '#EFF6FF', border: `1px solid ${loadingSlots ? C.border : '#93C5FD'}`, borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, color: loadingSlots ? C.textSoft : C.accent, cursor: loadingSlots ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {loadingSlots ? '⏳ Chargement…' : '📅 Charger les créneaux disponibles'}
                </button>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <button onClick={() => changeWeek(-1)} disabled={weekOffset === 0}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: weekOffset === 0 ? 'not-allowed' : 'pointer', color: weekOffset === 0 ? C.textSoft : C.text, fontFamily: 'inherit' }}>← Préc.</button>
                    <span style={{ fontSize: 12, color: C.textMid, flex: 1, textAlign: 'center' }}>
                      {weekOffset === 0 ? 'Semaine en cours' : `+${weekOffset} semaine${weekOffset > 1 ? 's' : ''}`}
                    </span>
                    <button onClick={() => changeWeek(1)} disabled={weekOffset >= 4}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: weekOffset >= 4 ? 'not-allowed' : 'pointer', color: weekOffset >= 4 ? C.textSoft : C.text, fontFamily: 'inherit' }}>Suiv. →</button>
                  </div>

                  {slotsError && <div style={{ color: '#DC2626', fontSize: 12, marginBottom: 8 }}>⚠️ {slotsError}</div>}

                  {slots.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.textSoft, fontStyle: 'italic' }}>Aucun créneau disponible cette semaine.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {slots.map(slot => {
                        const sel = selectedSlots.some(s => s.start === slot.start)
                        return (
                          <button key={slot.start} type="button"
                            onClick={() => setSelectedSlots(prev => sel ? prev.filter(s => s.start !== slot.start) : [...prev, slot])}
                            style={{ padding: '5px 11px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: sel ? 700 : 400,
                              background: sel ? '#BFDBFE' : C.bg, border: `1px solid ${sel ? C.accent : C.border}`, color: sel ? '#1D4ED8' : C.textMid }}>
                            {slot.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {selectedSlots.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#15803D', fontWeight: 600 }}>
                      ✓ {selectedSlots.length} créneau{selectedSlots.length > 1 ? 'x' : ''} sélectionné{selectedSlots.length > 1 ? 's' : ''}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Bouton Générer */}
          <button onClick={handleGenerate} disabled={!canGenerate || generating}
            style={{ width: '100%', padding: '13px', background: canGenerate && !generating ? C.accent : C.bg, border: 'none', color: canGenerate && !generating ? '#fff' : C.textSoft, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: canGenerate && !generating ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            {generating ? "⏳ Génération en cours…" : !selectedType ? "Choisissez un type d'email" : needsSlots && !selectedSlots.length ? "Sélectionnez au moins un créneau" : "✨ Générer l'email"}
          </button>

          {error && (
            <div style={{ marginTop: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#DC2626' }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* ── Panel résultat (sticky) ───────────────────────────────────── */}
        <div style={{ width: 340, flexShrink: 0, position: 'sticky', top: 24 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>✉️ Email généré</div>
              {(subject || body) && (
                <button onClick={handleCopy}
                  style={{ background: copied ? '#F0FDF4' : C.bg, border: `1px solid ${copied ? '#86EFAC' : C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: copied ? '#15803D' : C.textMid, fontFamily: 'inherit' }}>
                  {copied ? '✓ Copié !' : '📋 Tout copier'}
                </button>
              )}
            </div>

            {!(subject || body) ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: C.textSoft }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✉️</div>
                <div style={{ fontSize: 13 }}>L'email apparaîtra ici<br />après génération</div>
              </div>
            ) : (
              <>
                {subject && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMid, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 }}>Objet</div>
                    <input value={subject} onChange={e => setSubject(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 12, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMid, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 }}>Corps</div>
                  <textarea value={body} onChange={e => setBody(e.target.value)} rows={14}
                    style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
