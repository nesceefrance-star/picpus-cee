// EmailGenerateur.jsx — Module standalone de génération d'emails CEE
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

const EMAIL_TYPES = [
  { key: 'visio_creneaux',  label: 'Créneaux visio',          icon: '📅', desc: 'Proposer des créneaux de visioconférence',     needsSlots: true,  slotType: 'visio'   },
  { key: 'visio_confirm',   label: 'Confirmation visio',      icon: '✅', desc: "Confirmer la date/heure d'une visio",          needsSlots: false  },
  { key: 'post_visio',      label: 'Post-visio',               icon: '📋', desc: 'Demander les éléments complémentaires',        needsSlots: false  },
  { key: 'visite_creneaux', label: 'Créneaux visite',          icon: '🗓️', desc: 'Proposer des créneaux de visite technique',    needsSlots: true,  slotType: 'visite'  },
  { key: 'visite_confirm',  label: 'Confirmation visite',     icon: '🔧', desc: "Confirmer la date/heure d'une visite tech.",   needsSlots: false  },
  { key: 'envoi_devis',     label: 'Envoi de devis',           icon: '💶', desc: 'Envoyer le devis avec prime CEE',              needsSlots: false  },
  { key: 'relance',         label: 'Relance devis',            icon: '🔔', desc: 'Relancer sans insistance après envoi devis',   needsSlots: false  },
]

const STATUT_LABELS = {
  contacte: 'Contacté', visio_planifiee: 'Visio planifiée', visio_effectuee: 'Visio effectuée',
  visite_planifiee: 'Visite planifiée', visite_effectuee: 'Visite effectuée',
  devis: 'Devis envoyé', signe: 'Signé', perdu: 'Perdu',
}

export default function EmailGenerateur() {
  const { session } = useStore()

  // ── Recherche dossier ────────────────────────────────────────────────────
  const [query,        setQuery]        = useState('')
  const [suggestions,  setSuggestions]  = useState([])
  const [loadingSugg,  setLoadingSugg]  = useState(false)
  const [dossier,      setDossier]      = useState(null)  // dossier sélectionné
  const [showSugg,     setShowSugg]     = useState(false)
  const blurTimeout    = useRef(null)
  const inputRef       = useRef(null)

  // Charger récents si query vide, sinon rechercher
  useEffect(() => {
    const q = query.trim()
    if (!q && !showSugg) return
    const timer = setTimeout(() => {
      const run = async () => {
        setLoadingSugg(true)
        const req = supabase
          .from('dossiers')
          .select('id, ref, statut, type_fiche, prospects(raison_sociale, contact_nom, contact_email)')
          .order('created_at', { ascending: false })
          .limit(8)
        if (q) req.ilike('prospects.raison_sociale', `%${q}%`)
        const { data } = await req
        setSuggestions(data?.filter(d => d.prospects) || [])
        setLoadingSugg(false)
      }
      run()
    }, q ? 250 : 0)
    return () => clearTimeout(timer)
  }, [query, showSugg])

  const selectDossier = (d) => {
    setDossier(d)
    setQuery(d.prospects?.raison_sociale || '')
    setShowSugg(false)
    setSelectedType(null)
    setSubject('')
    setBody('')
    setGenerations({})
    // Charger les générations sauvegardées pour ce dossier
    supabase.from('email_generations').select('type, subject, body, updated_at').eq('dossier_id', d.id)
      .then(({ data }) => {
        const map = {}
        data?.forEach(g => { map[g.type] = g })
        setGenerations(map)
      })
  }

  // ── Type d'email ─────────────────────────────────────────────────────────
  const [generations,   setGenerations]   = useState({})
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
    const gen = generations[key]
    setSubject(gen?.subject || '')
    setBody(gen?.body || '')
  }

  // ── Créneaux ─────────────────────────────────────────────────────────────
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

  // ── Génération ───────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedType || !dossier || !session) return
    setGenerating(true); setError(null)
    try {
      const r = await fetch('/api/email-generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossierId: dossier.id, type: selectedType, ...(selectedSlots.length ? { selectedSlots } : {}) }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setSubject(d.subject); setBody(d.body)
      setGenerations(prev => ({ ...prev, [selectedType]: { subject: d.subject, body: d.body, updated_at: new Date().toISOString() } }))
    } catch (e) { setError(e.message) }
    setGenerating(false)
  }

  const handleCopy = async () => {
    const text = subject ? `Objet : ${subject}\n\n${body}` : body
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const currentTypeConfig = EMAIL_TYPES.find(t => t.key === selectedType)
  const needsSlots = currentTypeConfig?.needsSlots && dossier
  const canGenerate = !!dossier && !!selectedType && (!needsSlots || selectedSlots.length > 0)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '24px 24px 40px', fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>✉️ Générateur d'emails CEE</div>
        <div style={{ fontSize: 13, color: C.textMid, marginTop: 4 }}>
          Générez un email personnalisé pour n'importe quel prospect sans ouvrir sa fiche dossier.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', maxWidth: 1100 }}>

        {/* ── Formulaire ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Étape 1 — Rechercher un prospect */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>1. Sélectionnez le prospect / dossier</div>

            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setShowSugg(true); if (!e.target.value) setDossier(null) }}
                onFocus={() => setShowSugg(true)}
                onBlur={() => { blurTimeout.current = setTimeout(() => setShowSugg(false), 300) }}
                placeholder="Rechercher par raison sociale…"
                style={{ width: '100%', boxSizing: 'border-box', background: dossier ? '#F0FDF4' : C.bg, border: `1px solid ${dossier ? '#86EFAC' : C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              />
              {loadingSugg && (
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.textSoft }}>…</span>
              )}
              {showSugg && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 50, marginTop: 4, overflow: 'hidden' }}>
                  {suggestions.map(d => (
                    <div key={d.id}
                      onMouseDown={() => { clearTimeout(blurTimeout.current); selectDossier(d) }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.bg}`, display: 'flex', alignItems: 'center', gap: 10 }}
                      onMouseEnter={e => e.currentTarget.style.background = C.bg}
                      onMouseLeave={e => e.currentTarget.style.background = C.surface}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{d.prospects?.raison_sociale}</div>
                        <div style={{ fontSize: 11, color: C.textSoft }}>{d.ref} · {d.type_fiche || '—'} · {d.prospects?.contact_nom || '—'}</div>
                      </div>
                      {d.statut && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: C.bg, color: C.textMid, borderRadius: 4, padding: '2px 6px' }}>
                          {STATUT_LABELS[d.statut] || d.statut}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dossier sélectionné */}
            {dossier && (
              <div style={{ marginTop: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>✅</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>{dossier.prospects?.raison_sociale}</span>
                  <span style={{ fontSize: 11, color: '#4ADE80', marginLeft: 8 }}>
                    {dossier.ref} · {dossier.prospects?.contact_nom || ''} · {STATUT_LABELS[dossier.statut] || dossier.statut}
                  </span>
                </div>
                <button onClick={() => { setDossier(null); setQuery(''); setSelectedType(null); setSubject(''); setBody('') }}
                  style={{ background: 'transparent', border: 'none', color: '#16A34A', cursor: 'pointer', fontSize: 14, padding: 2 }}>✕</button>
              </div>
            )}
          </div>

          {/* Étape 2 — Type d'email */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>2. Choisissez le type d'email</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {EMAIL_TYPES.map(t => {
                const hasSaved = !!generations[t.key]
                return (
                  <button key={t.key} type="button" onClick={() => handleTypeChange(t.key)}
                    style={{ padding: '12px 10px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', position: 'relative',
                      background: selectedType === t.key ? '#EFF6FF' : C.bg,
                      border: `2px solid ${selectedType === t.key ? C.accent : C.border}` }}>
                    {hasSaved && (
                      <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: '#16A34A' }} title="Déjà généré" />
                    )}
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: selectedType === t.key ? '#2563EB' : C.text, lineHeight: 1.2 }}>{t.label}</div>
                    <div style={{ fontSize: 9, color: C.textSoft, marginTop: 3, lineHeight: 1.3 }}>{t.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Étape 3 — Créneaux (conditionnel) */}
          {needsSlots && (
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
                  {/* Navigation semaine */}
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
            {generating ? "⏳ Génération en cours…" : !dossier ? "Sélectionnez d'abord un dossier" : !selectedType ? "Choisissez un type d'email" : needsSlots && !selectedSlots.length ? "Sélectionnez au moins un créneau" : "✨ Générer l'email"}
          </button>

          {error && (
            <div style={{ marginTop: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#DC2626' }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* ── Panel résultat (sticky) ──────────────────────────────────── */}
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
                {/* Sujet */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMid, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 }}>Objet</div>
                  <input value={subject} onChange={e => setSubject(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 12, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }} />
                </div>

                {/* Corps */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMid, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 }}>Corps</div>
                  <textarea value={body} onChange={e => setBody(e.target.value)} rows={14}
                    style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }} />
                </div>

                {/* Générations sauvegardées */}
                {selectedType && generations[selectedType]?.updated_at && (
                  <div style={{ marginTop: 8, fontSize: 10, color: C.textSoft }}>
                    Dernière génération : {new Date(generations[selectedType].updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Raccourci vers la fiche dossier */}
          {dossier && (
            <a href={`/dossier/${dossier.id}`}
              style={{ display: 'block', marginTop: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: C.textMid, textDecoration: 'none', textAlign: 'center' }}>
              → Ouvrir la fiche dossier {dossier.ref}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
