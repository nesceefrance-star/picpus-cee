// api/calendar.js — point d'entrée unique pour tout Google Calendar + Meet
// Dispatch par req.query.action :
//   GET  ?action=events&year=YYYY&month=M  → events du mois (CalendarPicker)
//   GET  ?action=slots                     → créneaux libres J+3
//   GET  ?action=list                      → liste des agendas
//   POST ?action=list                      → sauvegarder sélection agendas
//   POST ?action=meet                      → créer réunion Google Meet

import { createClient } from '@supabase/supabase-js'
import { setCors } from './_cors.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getValidToken(userId) {
  const { data } = await supabase.from('google_tokens').select('*').eq('user_id', userId).single()
  if (!data) throw new Error('Google non connecté — connectez votre compte dans Paramètres')

  if (new Date(data.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return { token: data.access_token, calendarIds: data.calendar_ids || [] }
  }

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: data.refresh_token,
      grant_type:    'refresh_token',
    }),
  })
  const tokens = await r.json()
  if (!tokens.access_token) throw new Error('Token Google expiré — reconnectez dans Paramètres')

  await supabase.from('google_tokens').update({
    access_token: tokens.access_token,
    expires_at:   new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at:   new Date().toISOString(),
  }).eq('user_id', userId)

  return { token: tokens.access_token, calendarIds: data.calendar_ids || [] }
}

async function fetchAllEvents(accessToken, calendarIds, timeMin, timeMax) {
  const cals = calendarIds.length > 0 ? calendarIds : ['primary']
  const all  = await Promise.all(cals.map(calId =>
    fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).then(r => r.json()).then(d => d.items || []).catch(() => [])
  ))
  return all.flat()
}

const WINDOWS = [
  [9,30],[10,0],[10,30],[11,0],[11,30],[12,0],[12,30],
  [13,0],[13,30],[14,0],[14,30],[15,0],[15,30],[16,0],
  [16,30],[17,0],[17,30],[18,0],[18,30],[19,0],
]

function freeSlots(dateStr, busy, durationMin = 30) {
  const durationMs = durationMin * 60 * 1000
  // Détecter l'offset Paris pour ce jour (gère le passage heure d'été)
  const ref    = new Date(`${dateStr}T12:00:00Z`)
  const tzStr  = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' })
    .formatToParts(ref).find(p => p.type === 'timeZoneName').value // "GMT+1" ou "GMT+2"
  const offsetH = parseInt(tzStr.replace('GMT', '')) || 1
  const [Y, M, D] = dateStr.split('-').map(Number)
  return WINDOWS.reduce((acc, [h, m]) => {
    const start = new Date(Date.UTC(Y, M - 1, D, h - offsetH, m, 0))
    const end   = new Date(start.getTime() + durationMs)
    if (!busy.some(b => start < b.end && end > b.start)) {
      const totalEndMin = h * 60 + m + durationMin
      const endH = Math.floor(totalEndMin / 60)
      const endM = totalEndMin % 60
      const startStr = `${String(h).padStart(2,'0')}h${m === 0 ? '00' : String(m)}`
      const label = durationMin > 30
        ? `${startStr}-${String(endH).padStart(2,'0')}h${endM === 0 ? '00' : String(endM)}`
        : startStr
      acc.push({ time: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, label })
    }
    return acc
  }, [])
}

function workingDaysFrom(startOffset, count) {
  const days = []; const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + 1)
  let skipped = 0
  while (skipped < startOffset) { if (d.getDay() !== 0 && d.getDay() !== 6) skipped++; if (skipped < startOffset) d.setDate(d.getDate() + 1) }
  while (days.length < count) { if (d.getDay() !== 0 && d.getDay() !== 6) days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const action = req.query.action

  // ── POST ?action=list — sauvegarder sélection agendas ─────────────────────
  if (req.method === 'POST' && action === 'list') {
    const { calendarIds } = req.body
    await supabase.from('google_tokens').update({ calendar_ids: calendarIds }).eq('user_id', user.id)
    return res.json({ ok: true })
  }

  let accessToken, calendarIds
  try {
    ({ token: accessToken, calendarIds } = await getValidToken(user.id))
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }

  // ── GET ?action=list — liste des agendas ──────────────────────────────────
  if (action === 'list') {
    const r = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const data = await r.json()
    if (!data.items) return res.status(500).json({ error: data.error?.message || 'Erreur API Google' })

    const calendars = data.items
      .filter(c => c.accessRole !== 'none')
      .map(c => ({
        id:              c.id,
        summary:         c.summary,
        backgroundColor: c.backgroundColor || '#4285F4',
        primary:         c.primary || false,
        selected:        calendarIds.length === 0 ? c.primary : calendarIds.includes(c.id),
      }))
      .sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0))

    return res.json({ calendars })
  }

  // ── GET ?action=events&year=YYYY&month=M — events du mois ─────────────────
  if (action === 'events') {
    const year  = parseInt(req.query.year,  10)
    const month = parseInt(req.query.month, 10)
    if (!year || !month || year < 2020 || year > 2099 || month < 1 || month > 12)
      return res.status(400).json({ error: 'year et month invalides' })

    // Étendre de 2h de chaque côté pour couvrir les events à cheval sur minuit Paris (UTC+1/+2)
    const tMin = new Date(Date.UTC(year, month - 1, 1) - 2 * 60 * 60 * 1000).toISOString()
    const tMax = new Date(Date.UTC(year, month, 1)     + 2 * 60 * 60 * 1000).toISOString()
    const events  = await fetchAllEvents(accessToken, calendarIds, tMin, tMax)

    const parisDateStr = (dt) => {
      const fmt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt)
      const [dd, mm, yyyy] = fmt.split('/')
      return `${yyyy}-${mm}-${dd}`
    }

    const busyByDay = {}
    for (const e of events) {
      if (e.status === 'cancelled') continue
      if (e.start?.date && !e.start?.dateTime) {
        // Événement multi-jours : marquer chaque jour de la plage
        let cur = new Date(e.start.date + 'T00:00:00Z')
        const endD = new Date(e.end.date + 'T00:00:00Z') // fin exclusive
        while (cur < endD) {
          const ds = cur.toISOString().split('T')[0]
          if (!busyByDay[ds]) busyByDay[ds] = []
          busyByDay[ds].push({ allDay: true })
          cur.setUTCDate(cur.getUTCDate() + 1)
        }
        continue
      }
      if (!e.start?.dateTime) continue
      const start = new Date(e.start.dateTime); const end = new Date(e.end.dateTime)
      const startDateStr = parisDateStr(start)
      if (!busyByDay[startDateStr]) busyByDay[startDateStr] = []
      const fmtTime = (dt) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(dt)
      busyByDay[startDateStr].push({ start, end, allDay: false, summary: e.summary || '(sans titre)', startLabel: fmtTime(start), endLabel: fmtTime(end) })
      // Event multi-jours (dateTime) : bloquer aussi les jours suivants
      let dayCur = new Date(startDateStr + 'T12:00:00Z')
      dayCur.setUTCDate(dayCur.getUTCDate() + 1)
      for (let i = 0; i < 60; i++) {
        const dayStart = new Date(dayCur.toISOString().split('T')[0] + 'T00:00:00Z')
        if (end <= dayStart) break
        const ds = parisDateStr(dayCur)
        if (!busyByDay[ds]) busyByDay[ds] = []
        busyByDay[ds].push({ allDay: true })
        dayCur.setUTCDate(dayCur.getUTCDate() + 1)
      }
    }

    const durationMin = parseInt(req.query.duration, 10) || 30
    const today = new Date(); today.setHours(0,0,0,0)
    const days = {}
    const daysInMonth = new Date(year, month, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(year, month - 1, d)); const dow = date.getUTCDay()
      if (dow === 0 || dow === 6 || date < today) continue
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const dayEntries = busyByDay[dateStr] || []
      const busy       = dayEntries.filter(b => !b.allDay)
      const hasAllDay  = dayEntries.some(b => b.allDay)
      const eventsInfo = dayEntries.filter(b => !b.allDay).map(b => ({ summary: b.summary, start: b.startLabel, end: b.endLabel }))
      days[dateStr] = { eventCount: dayEntries.length, hasAllDay, slots: hasAllDay ? [] : freeSlots(dateStr, busy, durationMin), events: eventsInfo }
    }
    return res.json({ days })
  }

  // ── GET ?action=slots — créneaux libres J+3 (EmailSection) ────────────────
  // ?type=visite → créneaux 2h pour visite technique
  if (action === 'slots') {
    const isVisite     = req.query.type === 'visite'
    const weekOffset   = Math.max(0, Math.min(parseInt(req.query.week, 10) || 0, 4)) // 0–4 (max ~1 mois)
    const slotDuration = isVisite ? 120 * 60 * 1000 : 30 * 60 * 1000
    const workDays     = workingDaysFrom(3 + weekOffset * 5, 5)

    const timeMin = workDays[0].toISOString()
    const timeMax = new Date(workDays[workDays.length - 1]); timeMax.setHours(23, 59, 59)
    const events  = await fetchAllEvents(accessToken, calendarIds, timeMin, timeMax.toISOString())

    // Jours entièrement bloqués (events multi-jours allDay)
    const allDayBusy = new Set()
    for (const e of events) {
      if (e.status === 'cancelled' || !e.start?.date || e.start?.dateTime) continue
      let cur = new Date(e.start.date + 'T00:00:00Z')
      const endD = new Date(e.end.date + 'T00:00:00Z')
      while (cur < endD) { allDayBusy.add(cur.toISOString().split('T')[0]); cur.setUTCDate(cur.getUTCDate() + 1) }
    }

    const timedBusy = events
      .filter(e => e.status !== 'cancelled' && e.start?.dateTime)
      .map(e => ({ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }))

    const slots = []
    for (const day of workDays) {
      const dayStr = day.toISOString().split('T')[0]
      if (allDayBusy.has(dayStr)) continue
      const dayLabel = day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      let morningFound = false, afternoonFound = false
      for (const [h, m] of WINDOWS) {
        if (morningFound && afternoonFound) break
        const isMorning = h < 13
        if (isMorning && morningFound) continue
        if (!isMorning && afternoonFound) continue
        const slotStart = new Date(day); slotStart.setHours(h, m, 0, 0)
        const slotEnd   = new Date(slotStart.getTime() + slotDuration)
        if (!timedBusy.some(b => slotStart < b.end && slotEnd > b.start)) {
          const endH = slotEnd.getHours(), endM = slotEnd.getMinutes()
          const timeLabel = isVisite
            ? `${String(h).padStart(2,'0')}h-${String(endH).padStart(2,'0')}h${endM ? endM : ''}`
            : slotStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), label: `${dayLabel} ${timeLabel}`, day: dayLabel })
          if (isMorning) morningFound = true; else afternoonFound = true
        }
      }
    }
    return res.json({ slots })
  }

  // ── POST ?action=meet — créer réunion Google Meet ─────────────────────────
  if (req.method === 'POST' && action === 'meet') {
    const { subject, startDateTime, endDateTime, emails = [] } = req.body
    if (!subject || !startDateTime || !endDateTime) return res.status(400).json({ error: 'subject, startDateTime et endDateTime requis' })

    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: subject,
          start: { dateTime: startDateTime, timeZone: 'Europe/Paris' },
          end:   { dateTime: endDateTime,   timeZone: 'Europe/Paris' },
          conferenceData: { createRequest: { requestId: `picpus-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
          ...(emails.length > 0 ? { attendees: emails.map(email => ({ email })) } : {}),
        }),
      }
    )
    const calEvent = await calRes.json()
    if (!calEvent.hangoutLink) {
      if (calEvent.error?.code === 403) return res.status(403).json({ error: 'scope_missing' })
      return res.status(500).json({ error: calEvent.error?.message || 'Erreur création réunion' })
    }
    return res.json({ meetLink: calEvent.hangoutLink, eventLink: calEvent.htmlLink })
  }

  // ── POST ?action=event — créer événement Google Calendar sans Meet ────────
  if (req.method === 'POST' && action === 'event') {
    const { subject, startDateTime, endDateTime, emails = [], location = '' } = req.body
    if (!subject || !startDateTime || !endDateTime) return res.status(400).json({ error: 'subject, startDateTime et endDateTime requis' })

    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: subject,
          ...(location ? { location } : {}),
          start: { dateTime: startDateTime, timeZone: 'Europe/Paris' },
          end:   { dateTime: endDateTime,   timeZone: 'Europe/Paris' },
          ...(emails.length > 0 ? { attendees: emails.map(email => ({ email })) } : {}),
        }),
      }
    )
    const calEvent = await calRes.json()
    if (calEvent.error) return res.status(500).json({ error: calEvent.error.message || 'Erreur création événement' })
    return res.json({ eventLink: calEvent.htmlLink })
  }

  return res.status(400).json({ error: 'action inconnue' })
}
