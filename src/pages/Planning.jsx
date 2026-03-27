// src/pages/Planning.jsx — Vue planning Google Agenda

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

const TYPE_CONFIG = {
  VT:     { label: 'Visite technique', color: '#D97706', bg: '#FEF3C7', icon: '🏠' },
  Visio:  { label: 'Visio',            color: '#7C3AED', bg: '#EDE9FE', icon: '📹' },
  Meet:   { label: 'Google Meet',      color: '#059669', bg: '#D1FAE5', icon: '🎥' },
  Teams:  { label: 'Teams',            color: '#2563EB', bg: '#DBEAFE', icon: '💼' },
  Autre:  { label: 'Autre',            color: '#475569', bg: '#F1F5F9', icon: '📅' },
}

const PERIODS = [
  { value: 7,  label: '7 jours' },
  { value: 14, label: '14 jours' },
  { value: 30, label: '30 jours' },
  { value: 60, label: '60 jours' },
]

const INP = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 7, padding: '8px 12px',
  color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
  cursor: 'pointer',
}

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.Autre
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function EventCard({ event, onClick }) {
  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.Autre
  return (
    <div
      onClick={() => event.htmlLink && window.open(event.htmlLink, '_blank')}
      style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '12px 16px',
        display: 'flex', alignItems: 'flex-start', gap: 14,
        cursor: event.htmlLink ? 'pointer' : 'default',
        transition: 'box-shadow .15s',
        borderLeft: `4px solid ${cfg.color}`,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Heure */}
      <div style={{ minWidth: 52, textAlign: 'right', flexShrink: 0 }}>
        {event.isAllDay ? (
          <span style={{ fontSize: 11, color: C.textSoft, fontWeight: 600 }}>Jour<br/>entier</span>
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
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
            {event.summary}
          </span>
          <TypeBadge type={event.type} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {event.location && (
            <span style={{ fontSize: 12, color: C.textMid, display: 'flex', alignItems: 'center', gap: 4 }}>
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
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 600 }}
            >
              Rejoindre ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Planning() {
  const { session, profile } = useStore()
  const isAdmin = profile?.role === 'admin'
  const navigate = useNavigate()

  const [googleConnected, setGoogleConnected] = useState(null) // null=chargement
  const [events,          setEvents]          = useState([])
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState(null)

  // Filtres
  const [days,            setDays]            = useState(30)
  const [filterType,      setFilterType]      = useState('Tous')
  const [filterUser,      setFilterUser]      = useState('me') // 'me' | userId
  const [commerciaux,     setCommerciaux]     = useState([])

  // Vérification connexion Google
  useEffect(() => {
    if (!session) return
    fetch('/api/auth-google-status', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => setGoogleConnected(d.connected))
      .catch(() => setGoogleConnected(false))
  }, [session])

  // Chargement de la liste des commerciaux (admin)
  useEffect(() => {
    if (!isAdmin) return
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('id, prenom, nom, role')
        .order('nom')
      setCommerciaux(data || [])
    }
    load()
  }, [isAdmin])

  // Chargement des événements
  const loadEvents = useCallback(async () => {
    if (!session || !googleConnected) return
    setLoading(true)
    setError(null)
    try {
      const targetParam = filterUser !== 'me' ? `&targetUserId=${filterUser}` : ''
      const r = await fetch(
        `/api/calendar?action=upcoming&days=${days}${targetParam}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      )
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setEvents(d.events || [])
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [session, googleConnected, days, filterUser])

  useEffect(() => { loadEvents() }, [loadEvents])

  // Filtrage local par type
  const displayed = filterType === 'Tous'
    ? events
    : events.filter(e => e.type === filterType)

  // Regroupement par jour
  const groups = displayed.reduce((acc, e) => {
    const key = e.dayKey
    if (!acc[key]) acc[key] = { label: e.dayLabel, events: [] }
    acc[key].events.push(e)
    return acc
  }, {})

  const sortedDays = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))

  // ─── État : pas connecté ────────────────────────────────────────────────────
  if (googleConnected === null) {
    return (
      <div style={{ padding: 32, color: C.textSoft, fontSize: 14 }}>
        Vérification de la connexion Google…
      </div>
    )
  }

  if (googleConnected === false) {
    return (
      <div style={{ padding: '32px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          Agenda non connecté
        </div>
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

  // ─── Stats rapides ──────────────────────────────────────────────────────────
  const stats = Object.entries(TYPE_CONFIG).map(([type, cfg]) => ({
    type, cfg, count: events.filter(e => e.type === type).length,
  })).filter(s => s.count > 0)

  return (
    <div style={{ padding: '24px', background: C.bg, minHeight: '100%' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Planning</h1>
          <p style={{ fontSize: 13, color: C.textSoft, margin: '4px 0 0' }}>
            Récapitulatif des prochains événements Google Agenda
          </p>
        </div>
        <button
          onClick={loadEvents}
          disabled={loading}
          style={{
            background: loading ? C.border : C.accent, color: loading ? C.textSoft : '#fff',
            border: 'none', borderRadius: 8, padding: '8px 16px',
            fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {loading ? '⟳ Chargement…' : '↻ Actualiser'}
        </button>
      </div>

      {/* Filtres */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '14px 16px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        {/* Période */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textMid, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Période
          </span>
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={INP}>
            {PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div style={{ width: 1, height: 24, background: C.border }} />

        {/* Type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textMid, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Type
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Tous', ...Object.keys(TYPE_CONFIG)].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${filterType === t ? C.accent : C.border}`,
                  background: filterType === t ? C.accent : C.surface,
                  color: filterType === t ? '#fff' : C.textMid,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .1s',
                  display: 'flex', alignItems: 'center', gap: 4,
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
            <div style={{ width: 1, height: 24, background: C.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.textMid, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Commercial
              </span>
              <select
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                style={INP}
              >
                <option value="me">Mon agenda</option>
                {commerciaux.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.prenom} {u.nom}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Stats rapides */}
      {stats.length > 0 && !loading && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {stats.map(({ type, cfg, count }) => (
            <div
              key={type}
              onClick={() => setFilterType(filterType === type ? 'Tous' : type)}
              style={{
                background: cfg.bg, border: `1px solid ${cfg.color}20`,
                borderRadius: 10, padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer',
                outline: filterType === type ? `2px solid ${cfg.color}` : 'none',
                outlineOffset: 2,
              }}
            >
              <span style={{ fontSize: 18 }}>{cfg.icon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 11, color: cfg.color, opacity: 0.8 }}>{cfg.label}</div>
              </div>
            </div>
          ))}
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
          {error.includes('connectez') && (
            <button
              onClick={() => navigate('/parametres')}
              style={{ marginLeft: 8, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              Aller dans les Paramètres →
            </button>
          )}
        </div>
      )}

      {/* Contenu principal */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: C.textSoft, fontSize: 14 }}>
          Chargement des événements…
        </div>
      ) : sortedDays.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>
            Aucun événement
          </div>
          <div style={{ fontSize: 13, color: C.textSoft }}>
            {filterType !== 'Tous'
              ? `Aucun événement de type "${TYPE_CONFIG[filterType]?.label}" dans les ${days} prochains jours.`
              : `Aucun événement dans les ${days} prochains jours.`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {sortedDays.map(([key, group]) => (
            <div key={key}>
              {/* Entête du jour */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: C.textMid,
                  textTransform: 'capitalize',
                }}>
                  {group.label}
                </div>
                <div style={{
                  flex: 1, height: 1, background: C.border,
                }} />
                <span style={{
                  fontSize: 11, color: C.textSoft, background: C.bg,
                  padding: '2px 8px', borderRadius: 10, border: `1px solid ${C.border}`,
                }}>
                  {group.events.length} événement{group.events.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Événements du jour */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.events.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
