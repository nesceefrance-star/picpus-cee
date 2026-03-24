// src/components/CalendarPicker.jsx
// Mini-calendrier mensuel avec disponibilités Google Calendar
// Props : session, onSelect(dateStr, timeStr), selectedDate, selectedTime

import { useState, useEffect, useCallback } from 'react'

const C = {
  bg:      '#F1F5F9',
  surface: '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0F172A',
  textMid: '#475569',
  textSoft:'#94A3B8',
  accent:  '#2563EB',
}

const DAYS_FR = ['L','M','M','J','V','S','D']
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function CalendarPicker({ session, onSelect, selectedDate, selectedTime, duration = 30 }) {
  const today = new Date(); today.setHours(0,0,0,0)

  const [viewDate,     setViewDate]     = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [days,         setDays]         = useState({})   // { dateStr: { eventCount, slots, hasAllDay } }
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [selectedDay,  setSelectedDay]  = useState(null) // dateStr

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth() + 1

  const fetchMonth = useCallback(async () => {
    if (!session) return
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/calendar?action=events&year=${year}&month=${month}&duration=${duration}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setDays(d.days || {})
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [session, year, month, duration])

  useEffect(() => { fetchMonth() }, [fetchMonth])

  // Construire la grille du mois (lundi en premier)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay  = new Date(year, month, 0)
  // Décalage lundi = 0
  const startOffset = (firstDay.getDay() + 6) % 7
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month - 1, d))

  const prevMonth = () => setViewDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n })
  const nextMonth = () => setViewDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n })

  const getDateStr = (d) => {
    const y  = d.getFullYear()
    const m  = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  const getDayStyle = (date) => {
    if (!date) return {}
    const dow     = date.getDay()
    const isPast  = date < today
    const dateStr = getDateStr(date)
    const info    = days[dateStr]
    const isSel   = selectedDate === dateStr
    const isDaySelected = selectedDay === dateStr

    if (isPast || dow === 0 || dow === 6) {
      return { background: 'transparent', color: C.textSoft, cursor: 'default', opacity: .4 }
    }
    if (isSel) {
      return { background: C.accent, color: '#fff', cursor: 'pointer', fontWeight: 700 }
    }
    if (isDaySelected) {
      return { background: '#EFF6FF', color: C.accent, cursor: 'pointer', fontWeight: 700, border: `1px solid ${C.accent}` }
    }
    if (info?.hasAllDay) {
      return { background: '#FEE2E2', color: '#991B1B', cursor: 'pointer' }
    }
    if (info?.eventCount > 0 && info?.slots?.length === 0) {
      return { background: '#FEE2E2', color: '#991B1B', cursor: 'pointer' }
    }
    if (info?.eventCount > 0 && info?.slots?.length > 0) {
      return { background: '#FEF9C3', color: '#854D0E', cursor: 'pointer' }
    }
    if (info?.slots?.length > 0) {
      return { background: '#F0FDF4', color: '#166534', cursor: 'pointer' }
    }
    // Jour ouvré sans données encore
    return { background: 'transparent', color: C.text, cursor: 'pointer' }
  }

  const handleDayClick = (date) => {
    if (!date) return
    const dow = date.getDay()
    if (date < today || dow === 0 || dow === 6) return
    const dateStr = getDateStr(date)
    setSelectedDay(prev => prev === dateStr ? null : dateStr)
  }

  const selectedDayInfo = selectedDay ? days[selectedDay] : null

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Header navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMid, fontSize: 16, padding: '2px 6px', borderRadius: 4 }}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {MONTHS_FR[month - 1]} {year}
          </span>
          {loading && <span style={{ fontSize: 11, color: C.textSoft }}>⏳</span>}
        </div>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMid, fontSize: 16, padding: '2px 6px', borderRadius: 4 }}>›</button>
      </div>

      {error && (
        <div style={{ padding: '8px 14px', fontSize: 11, color: '#DC2626', background: '#FEF2F2' }}>
          ⚠️ {error === 'Google non connecté' ? 'Connecte ton compte Google dans Paramètres' : error}
        </div>
      )}

      {/* Grille */}
      <div style={{ padding: '8px 10px 10px' }}>
        {/* Entêtes jours */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {DAYS_FR.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.textSoft, padding: '2px 0' }}>{d}</div>
          ))}
        </div>

        {/* Cellules */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((date, i) => {
            if (!date) return <div key={i} />
            const dateStr = getDateStr(date)
            const info    = days[dateStr]
            const style   = getDayStyle(date)
            const isToday = isSameDay(date, today)

            return (
              <div key={i} onClick={() => handleDayClick(date)}
                style={{
                  borderRadius: 6,
                  padding: '4px 2px 3px',
                  textAlign: 'center',
                  position: 'relative',
                  border: style.border || (isToday ? `1px solid ${C.accent}` : '1px solid transparent'),
                  transition: 'background .1s',
                  ...style,
                }}>
                <div style={{ fontSize: 12, fontWeight: style.fontWeight || 500, lineHeight: 1.2 }}>
                  {date.getDate()}
                </div>
                {/* Indicateur événements */}
                {info?.eventCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginTop: 1 }}>
                    {Array.from({ length: Math.min(info.eventCount, 3) }).map((_, j) => (
                      <div key={j} style={{ width: 3, height: 3, borderRadius: '50%', background: info.hasAllDay || info.slots?.length === 0 ? '#EF4444' : '#F59E0B' }} />
                    ))}
                  </div>
                )}
                {info?.slots?.length > 0 && info?.eventCount === 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 1 }}>
                    <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#22C55E' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: 12, padding: '0 12px 10px', flexWrap: 'wrap' }}>
        {[
          { color: '#22C55E', bg: '#F0FDF4', label: 'Libre' },
          { color: '#F59E0B', bg: '#FEF9C3', label: 'Quelques RDV' },
          { color: '#EF4444', bg: '#FEE2E2', label: 'Chargé / journée bloquée' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: l.bg, border: `1px solid ${l.color}` }} />
            <span style={{ fontSize: 10, color: C.textSoft }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Créneaux du jour sélectionné */}
      {selectedDay && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>

          {!selectedDayInfo && loading && (
            <div style={{ fontSize: 12, color: C.textSoft }}>Chargement…</div>
          )}

          {/* Événements du jour */}
          {selectedDayInfo?.events?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                Agenda
              </div>
              {selectedDayInfo.events.map((ev, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', borderBottom: i < selectedDayInfo.events.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', flexShrink: 0 }}>{ev.start} – {ev.end}</span>
                  <span style={{ fontSize: 12, color: C.textMid, fontStyle: 'italic' }}>Créneau bloqué</span>
                </div>
              ))}
            </div>
          )}
          {selectedDayInfo?.hasAllDay && (
            <div style={{ fontSize: 12, color: '#991B1B', background: '#FEF2F2', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
              Journée entière bloquée
            </div>
          )}

          {selectedDayInfo && !selectedDayInfo.hasAllDay && selectedDayInfo.slots?.length === 0 && (
            <div style={{ fontSize: 12, color: '#991B1B', background: '#FEF2F2', borderRadius: 6, padding: '6px 10px' }}>
              Aucun créneau disponible ce jour
            </div>
          )}

          {selectedDayInfo?.slots?.length > 0 && (
            <>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
              Créneaux libres
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedDayInfo.slots.map(slot => {
                const isSelected = selectedDate === selectedDay && selectedTime === slot.time
                return (
                  <button key={slot.time}
                    onClick={() => { onSelect(selectedDay, slot.time); setSelectedDay(null) }}
                    style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: isSelected ? 700 : 500,
                      border: `1px solid ${isSelected ? C.accent : C.border}`,
                      background: isSelected ? '#EFF6FF' : C.bg,
                      color: isSelected ? C.accent : C.textMid,
                      transition: 'all .1s',
                    }}>
                    {slot.label}
                  </button>
                )
              })}
            </div>
            </>
          )}

          {!selectedDayInfo && !loading && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {/* Jour sans événements connus — affiche tous les créneaux */}
              {['09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'].map(t => {
                const [hStr, mStr] = t.split(':')
                const h = parseInt(hStr, 10), m = parseInt(mStr, 10)
                const startLabel = `${hStr}h${mStr === '00' ? '00' : mStr}`
                const totalEndMin = h * 60 + m + duration
                const endH = Math.floor(totalEndMin / 60)
                const endM = totalEndMin % 60
                const label = duration > 30
                  ? `${startLabel}-${String(endH).padStart(2,'0')}h${endM === 0 ? '00' : String(endM)}`
                  : startLabel
                const isSelected = selectedDate === selectedDay && selectedTime === t
                return (
                  <button key={t}
                    onClick={() => { onSelect(selectedDay, t); setSelectedDay(null) }}
                    style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: isSelected ? 700 : 500,
                      border: `1px solid ${isSelected ? C.accent : C.border}`,
                      background: isSelected ? '#EFF6FF' : C.bg,
                      color: isSelected ? C.accent : C.textMid,
                    }}>
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
