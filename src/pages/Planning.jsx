// src/pages/Planning.jsx — Vue planning Google Agenda (liste / semaine / mois)

import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB', today: '#EFF6FF',
}

const TYPE_CONFIG = {
  VT:    { label: 'Visite technique', color: '#D97706', bg: '#FEF3C7', icon: '🏠' },
  Visio: { label: 'Visio',            color: '#7C3AED', bg: '#EDE9FE', icon: '📹' },
  Meet:  { label: 'Google Meet',      color: '#059669', bg: '#D1FAE5', icon: '🎥' },
  Teams: { label: 'Teams',            color: '#2563EB', bg: '#DBEAFE', icon: '💼' },
  Autre: { label: 'Autre',            color: '#475569', bg: '#F1F5F9', icon: '📅' },
}

const PERIODS = [
  { value: 7,  label: '7 j' },
  { value: 14, label: '14 j' },
  { value: 30, label: '30 j' },
  { value: 60, label: '60 j' },
]

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const REF_REGEX = /\b(\d{4}-\d{2}-\d{3})\b/g

// ── Helpers date ─────────────────────────────────────────────────────────────

function startOfISOWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() // 0=dim, 1=lun...
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d
}

function getWeekDays(date) {
  const mon = startOfISOWeek(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month - 1, 1)
  const startDow = firstDay.getDay()
  const offset = startDow === 0 ? 6 : startDow - 1

  const grid = []
  let cur = new Date(firstDay)
  cur.setDate(cur.getDate() - offset)

  for (let row = 0; row < 6; row++) {
    const week = []
    for (let col = 0; col < 7; col++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    grid.push(week)
  }
  return grid
}

function toDayKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isToday(date) {
  const t = new Date()
  return date.getFullYear() === t.getFullYear() &&
    date.getMonth() === t.getMonth() &&
    date.getDate() === t.getDate()
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.Autre
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function EventCard({ event, dossiersMap, navigate }) {
  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.Autre
  // Detect dossier ref in summary or description
  REF_REGEX.lastIndex = 0
  const refMatch = REF_REGEX.exec(event.summary + ' ' + event.description)
  const dossierRef = refMatch?.[1]
  const dossierId  = dossierRef ? dossiersMap[dossierRef] : null

  return (
    <div
      style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        borderLeft: `4px solid ${cfg.color}`,
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Heure */}
      <div style={{ minWidth: 52, textAlign: 'right', flexShrink: 0 }}>
        {event.isAllDay ? (
          <span style={{ fontSize: 11, color: C.textSoft, fontWeight: 600 }}>
            {event.isMultiDay ? 'Multi-j.' : 'Jour\nentier'}
          </span>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{event.startLabel}</div>
            {event.endLabel && <div style={{ fontSize: 11, color: C.textSoft }}>{event.endLabel}</div>}
          </>
        )}
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{
            fontSize: 14, fontWeight: 600, color: C.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280,
          }}>
            {event.summary}
          </span>
          <TypeBadge type={event.type} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {event.location && (
            <span style={{ fontSize: 12, color: C.textMid }}>
              📍 {event.location}
            </span>
          )}
          {event.attendees.length > 0 && (
            <span style={{ fontSize: 12, color: C.textSoft }}>
              👥 {event.attendees.length} participant{event.attendees.length > 1 ? 's' : ''}
            </span>
          )}
          {event.hangoutLink && (
            <a
              href={event.hangoutLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#059669', textDecoration: 'none', fontWeight: 600 }}
            >
              Rejoindre ↗
            </a>
          )}
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: C.textSoft, textDecoration: 'none' }}
            >
              Google Cal ↗
            </a>
          )}
          {dossierId && (
            <button
              onClick={() => navigate(`/dossier/${dossierId}`)}
              style={{
                fontSize: 12, color: C.accent, background: '#EFF6FF',
                border: `1px solid #BFDBFE`, borderRadius: 12,
                padding: '2px 8px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              📁 Dossier {dossierRef}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Vue Liste ─────────────────────────────────────────────────────────────────

function ListView({ events, dossiersMap, navigate }) {
  const groups = events.reduce((acc, e) => {
    if (!acc[e.dayKey]) acc[e.dayKey] = { label: e.dayLabel, events: [] }
    acc[e.dayKey].events.push(e)
    return acc
  }, {})
  const sortedDays = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))

  if (sortedDays.length === 0) return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '40px 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Aucun événement</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {sortedDays.map(([key, group]) => (
        <div key={key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textMid, textTransform: 'capitalize' }}>
              {group.label}
            </div>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{
              fontSize: 11, color: C.textSoft, background: C.bg,
              padding: '2px 8px', borderRadius: 10, border: `1px solid ${C.border}`,
            }}>
              {group.events.length} événement{group.events.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.events.map(ev => (
              <EventCard key={ev.id} event={ev} dossiersMap={dossiersMap} navigate={navigate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Vue Semaine ────────────────────────────────────────────────────────────────

function WeekView({ events, viewDate, dossiersMap, navigate }) {
  const [expandedDay, setExpandedDay] = useState(null)
  const days = getWeekDays(viewDate)
  const todayKey = toDayKey(new Date())

  return (
    <div>
      {/* Grille 7 colonnes */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 8, overflowX: 'auto',
      }}>
        {days.map((day, i) => {
          const key = toDayKey(day)
          const dayEvents = events.filter(e => e.dayKey === key)
          const today = key === todayKey
          const isExpanded = expandedDay === key

          return (
            <div
              key={key}
              style={{
                background: today ? C.today : C.surface,
                border: today ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
                borderRadius: 10, padding: '10px 10px',
                minHeight: 120, cursor: dayEvents.length > 0 ? 'pointer' : 'default',
              }}
              onClick={() => dayEvents.length > 0 && setExpandedDay(isExpanded ? null : key)}
            >
              {/* En-tête du jour */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: today ? C.accent : C.textSoft, textTransform: 'uppercase' }}>
                  {JOURS_SEMAINE[i]}
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 800,
                  color: today ? C.accent : C.text,
                  lineHeight: 1.2,
                }}>
                  {day.getDate()}
                </div>
              </div>

              {/* Événements */}
              {dayEvents.length === 0 ? (
                <div style={{ fontSize: 11, color: C.textSoft }}>—</div>
              ) : (
                <>
                  {(isExpanded ? dayEvents : dayEvents.slice(0, 3)).map(ev => {
                    const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.Autre
                    REF_REGEX.lastIndex = 0
                    const refMatch = REF_REGEX.exec(ev.summary + ' ' + ev.description)
                    const dRef = refMatch?.[1]
                    const dId  = dRef ? dossiersMap[dRef] : null
                    return (
                      <div
                        key={ev.id}
                        style={{
                          background: cfg.bg, borderRadius: 6, padding: '4px 6px',
                          marginBottom: 4, fontSize: 11, color: cfg.color,
                          overflow: 'hidden',
                        }}
                        onClick={e => {
                          e.stopPropagation()
                          if (dId) navigate(`/dossier/${dId}`)
                          else if (ev.htmlLink) window.open(ev.htmlLink, '_blank')
                        }}
                      >
                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cfg.icon} {ev.summary}
                        </div>
                        {!ev.isAllDay && (
                          <div style={{ opacity: 0.8 }}>{ev.startLabel}</div>
                        )}
                        {dId && (
                          <div style={{ fontSize: 10, opacity: 0.8 }}>📁 {dRef}</div>
                        )}
                      </div>
                    )
                  })}
                  {!isExpanded && dayEvents.length > 3 && (
                    <div style={{ fontSize: 11, color: C.textSoft, fontWeight: 600 }}>
                      +{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? 's' : ''}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Détail du jour cliqué */}
      {expandedDay && (() => {
        const group = events.filter(e => e.dayKey === expandedDay)
        return group.length > 0 ? (
          <div style={{
            marginTop: 16, background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '16px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textMid, marginBottom: 12, textTransform: 'capitalize' }}>
              {group[0].dayLabel} — {group.length} événement{group.length > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.map(ev => (
                <EventCard key={ev.id} event={ev} dossiersMap={dossiersMap} navigate={navigate} />
              ))}
            </div>
          </div>
        ) : null
      })()}
    </div>
  )
}

// ── Vue Mois ──────────────────────────────────────────────────────────────────

function MonthView({ events, viewDate, dossiersMap, navigate }) {
  const [selectedDay, setSelectedDay] = useState(null)
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth() + 1
  const grid  = getMonthGrid(year, month)
  const todayKey = toDayKey(new Date())

  const selectedEvents = selectedDay ? events.filter(e => e.dayKey === selectedDay) : []

  return (
    <div>
      {/* En-tête colonnes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {JOURS_SEMAINE.map(j => (
          <div key={j} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.textSoft, padding: '4px 0', textTransform: 'uppercase' }}>
            {j}
          </div>
        ))}
      </div>

      {/* Grille */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {grid.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {week.map((day, di) => {
              const key = toDayKey(day)
              const inMonth = day.getMonth() + 1 === month
              const today = key === todayKey
              const selected = key === selectedDay
              const dayEvents = events.filter(e => e.dayKey === key)

              return (
                <div
                  key={key}
                  onClick={() => setSelectedDay(selected ? null : key)}
                  style={{
                    background: today ? C.today : selected ? '#EFF6FF' : inMonth ? C.surface : '#F8FAFC',
                    border: today ? `2px solid ${C.accent}` : selected ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
                    borderRadius: 8, padding: '6px 8px',
                    minHeight: 72, cursor: 'pointer',
                    opacity: inMonth ? 1 : 0.4,
                  }}
                >
                  <div style={{
                    fontSize: 13, fontWeight: today ? 800 : 600,
                    color: today ? C.accent : C.text,
                    marginBottom: 4,
                  }}>
                    {day.getDate()}
                  </div>
                  {dayEvents.slice(0, 3).map(ev => {
                    const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.Autre
                    return (
                      <div
                        key={ev.id}
                        style={{
                          background: cfg.bg, color: cfg.color,
                          borderRadius: 4, padding: '2px 5px',
                          fontSize: 10, fontWeight: 600, marginBottom: 2,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                      >
                        {cfg.icon} {ev.summary}
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: 10, color: C.textSoft, fontWeight: 600 }}>
                      +{dayEvents.length - 3}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Détail du jour sélectionné */}
      {selectedDay && selectedEvents.length > 0 && (
        <div style={{
          marginTop: 16, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: '16px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMid, marginBottom: 12, textTransform: 'capitalize' }}>
            {selectedEvents[0].dayLabel} — {selectedEvents.length} événement{selectedEvents.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedEvents.map(ev => (
              <EventCard key={ev.id} event={ev} dossiersMap={dossiersMap} navigate={navigate} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

const INP = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 7, padding: '6px 10px',
  color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
}

export default function Planning() {
  const { session, profile } = useStore()
  const isAdmin = profile?.role === 'admin'
  const navigate = useNavigate()

  const [googleConnected, setGoogleConnected] = useState(null)
  const [events,          setEvents]          = useState([])
  const [dossiersMap,     setDossiersMap]     = useState({})
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState(null)

  // Vues
  const [view,        setView]        = useState('list')         // 'list' | 'week' | 'month'
  const [viewDate,    setViewDate]    = useState(new Date())

  // Filtres
  const [days,        setDays]        = useState(30)
  const [filterType,  setFilterType]  = useState('Tous')
  const [filterUser,  setFilterUser]  = useState('me')
  const [commerciaux, setCommerciaux] = useState([])

  // Vérification connexion Google
  useEffect(() => {
    if (!session) return
    fetch('/api/auth-google-status', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.json())
      .then(d => setGoogleConnected(d.connected))
      .catch(() => setGoogleConnected(false))
  }, [session])

  // Liste des commerciaux (admin)
  useEffect(() => {
    if (!isAdmin) return
    async function load() {
      const { data } = await supabase.from('profiles').select('id, prenom, nom').order('nom')
      setCommerciaux(data || [])
    }
    load()
  }, [isAdmin])

  // Chargement des événements selon la vue
  const loadEvents = useCallback(async () => {
    if (!session || !googleConnected) return
    setLoading(true)
    setError(null)
    try {
      let rangeParam
      if (view === 'week') {
        const weekStart = startOfISOWeek(viewDate)
        const weekEnd   = new Date(weekStart.getTime() + 7 * 86400000)
        rangeParam = `&from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`
      } else if (view === 'month') {
        const year  = viewDate.getFullYear()
        const month = viewDate.getMonth()
        const from  = new Date(year, month, 1)
        const to    = new Date(year, month + 1, 0, 23, 59, 59)
        rangeParam = `&from=${from.toISOString()}&to=${to.toISOString()}`
      } else {
        rangeParam = `&days=${days}`
      }

      const targetParam = filterUser !== 'me' ? `&targetUserId=${filterUser}` : ''
      const r = await fetch(
        `/api/calendar?action=upcoming${rangeParam}${targetParam}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      )
      const d = await r.json()
      if (d.error) throw new Error(d.error)

      const rawEvents = d.events || []

      // Extraction des refs dossiers dans les titres / descriptions
      const refs = new Set()
      rawEvents.forEach(e => {
        REF_REGEX.lastIndex = 0
        let m
        while ((m = REF_REGEX.exec(e.summary + ' ' + e.description)) !== null) refs.add(m[1])
      })
      if (refs.size > 0) {
        const { data: dossiers } = await supabase
          .from('dossiers').select('id, ref').in('ref', [...refs])
        const map = {}
        dossiers?.forEach(dd => { map[dd.ref] = dd.id })
        setDossiersMap(map)
      } else {
        setDossiersMap({})
      }

      setEvents(rawEvents)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [session, googleConnected, view, viewDate, days, filterUser])

  useEffect(() => { loadEvents() }, [loadEvents])

  // Filtrage local par type
  const displayed = filterType === 'Tous'
    ? events
    : events.filter(e => e.type === filterType)

  // ── Navigation semaine / mois ────────────────────────────────────────────
  const navPrev = () => {
    if (view === 'week') setViewDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
    else setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  const navNext = () => {
    if (view === 'week') setViewDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
    else setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }
  const navToday = () => setViewDate(new Date())

  // ── Label de navigation ──────────────────────────────────────────────────
  const navLabel = (() => {
    if (view === 'week') {
      const days7 = getWeekDays(viewDate)
      const start = days7[0], end = days7[6]
      if (start.getMonth() === end.getMonth())
        return `${start.getDate()} – ${end.getDate()} ${MOIS_FR[start.getMonth()]} ${start.getFullYear()}`
      return `${start.getDate()} ${MOIS_FR[start.getMonth()]} – ${end.getDate()} ${MOIS_FR[end.getMonth()]} ${end.getFullYear()}`
    }
    return `${MOIS_FR[viewDate.getMonth()]} ${viewDate.getFullYear()}`
  })()

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = Object.entries(TYPE_CONFIG).map(([type, cfg]) => ({
    type, cfg, count: events.filter(e => e.type === type).length,
  })).filter(s => s.count > 0)

  // ── Écrans non connecté / chargement ─────────────────────────────────────
  if (googleConnected === null) {
    return <div style={{ padding: 32, color: C.textSoft, fontSize: 14 }}>Vérification connexion Google…</div>
  }

  if (googleConnected === false) {
    return (
      <div style={{ padding: '48px 24px', maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Agenda non connecté</div>
        <div style={{ fontSize: 14, color: C.textMid, marginBottom: 24, lineHeight: 1.6 }}>
          Connectez votre compte Google dans les Paramètres pour accéder à la vue planning.
        </div>
        <button
          onClick={() => navigate('/parametres')}
          style={{
            background: C.accent, color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Aller dans les Paramètres
        </button>
      </div>
    )
  }

  // ── Rendu principal ────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px', background: C.bg, minHeight: '100%' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Planning</h1>
          <p style={{ fontSize: 13, color: C.textSoft, margin: '4px 0 0' }}>
            Prochains événements Google Agenda
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Toggle vue */}
          <div style={{
            display: 'flex', background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, overflow: 'hidden',
          }}>
            {[
              { id: 'list',  label: '☰ Liste' },
              { id: 'week',  label: '📆 Semaine' },
              { id: 'month', label: '🗓 Mois' },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                style={{
                  padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none',
                  background: view === v.id ? C.accent : 'transparent',
                  color: view === v.id ? '#fff' : C.textMid,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .1s',
                  borderRight: `1px solid ${C.border}`,
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          {/* Actualiser */}
          <button
            onClick={loadEvents}
            disabled={loading}
            style={{
              background: loading ? C.border : C.surface, color: loading ? C.textSoft : C.textMid,
              border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px',
              fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? '⟳' : '↻'}
          </button>
        </div>
      </div>

      {/* Barre de filtres */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '12px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        {/* Période (liste uniquement) */}
        {view === 'list' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Période
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setDays(p.value)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${days === p.value ? C.accent : C.border}`,
                    background: days === p.value ? C.accent : 'transparent',
                    color: days === p.value ? '#fff' : C.textMid,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Séparateur conditionnel */}
        {view === 'list' && <div style={{ width: 1, height: 20, background: C.border }} />}

        {/* Type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Type
          </span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['Tous', ...Object.keys(TYPE_CONFIG)].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${filterType === t ? C.accent : C.border}`,
                  background: filterType === t ? C.accent : 'transparent',
                  color: filterType === t ? '#fff' : C.textMid,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                {t !== 'Tous' && TYPE_CONFIG[t]?.icon} {t}
              </button>
            ))}
          </div>
        </div>

        {/* Commercial (admin) */}
        {isAdmin && commerciaux.length > 0 && (
          <>
            <div style={{ width: 1, height: 20, background: C.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Commercial
              </span>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={INP}>
                <option value="me">Mon agenda</option>
                {commerciaux.map(u => (
                  <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Stats rapides (liste uniquement) */}
      {view === 'list' && stats.length > 0 && !loading && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {stats.map(({ type, cfg, count }) => (
            <div
              key={type}
              onClick={() => setFilterType(filterType === type ? 'Tous' : type)}
              style={{
                background: cfg.bg, borderRadius: 10, padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                outline: filterType === type ? `2px solid ${cfg.color}` : 'none',
                outlineOffset: 2, border: `1px solid ${cfg.color}20`,
              }}
            >
              <span style={{ fontSize: 16 }}>{cfg.icon}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 10, color: cfg.color, opacity: 0.8 }}>{cfg.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation semaine / mois */}
      {(view === 'week' || view === 'month') && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
        }}>
          <button
            onClick={navPrev}
            style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '6px 12px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              color: C.textMid,
            }}
          >
            ‹
          </button>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text, flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>
            {navLabel}
          </div>
          <button
            onClick={navToday}
            style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              color: C.accent, fontWeight: 600,
            }}
          >
            Aujourd'hui
          </button>
          <button
            onClick={navNext}
            style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '6px 12px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              color: C.textMid,
            }}
          >
            ›
          </button>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, color: '#DC2626', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ⚠️ {error}
          {error.toLowerCase().includes('connectez') && (
            <button
              onClick={() => navigate('/parametres')}
              style={{ marginLeft: 8, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              Paramètres →
            </button>
          )}
        </div>
      )}

      {/* Contenu */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: C.textSoft, fontSize: 14 }}>
          Chargement des événements…
        </div>
      ) : (
        <>
          {view === 'list'  && <ListView  events={displayed} dossiersMap={dossiersMap} navigate={navigate} />}
          {view === 'week'  && <WeekView  events={displayed} viewDate={viewDate} dossiersMap={dossiersMap} navigate={navigate} />}
          {view === 'month' && <MonthView events={displayed} viewDate={viewDate} dossiersMap={dossiersMap} navigate={navigate} />}
        </>
      )}
    </div>
  )
}
