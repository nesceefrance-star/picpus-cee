// api/calendar.js — point d'entrée unique pour tout Google Calendar + Meet
// Dispatch par req.query.action :
//   GET  ?action=events&year=YYYY&month=M  → events du mois (CalendarPicker)
//   GET  ?action=slots                     → créneaux libres J+3
//   GET  ?action=list                      → liste des agendas
//   POST ?action=list                      → sauvegarder sélection agendas
//   POST ?action=meet                      → créer réunion Google Meet

import { createClient } from '@supabase/supabase-js'

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
  [9,0],[9,45],[10,30],[11,0],
  [14,0],[14,45],[15,30],[16,0],[16,30],[17,0],
]

function freeSlots(dateStr, busy) {
  // Détecter l'offset Paris pour ce jour (gère le passage heure d'été)
  const ref    = new Date(`${dateStr}T12:00:00Z`)
  const tzStr  = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' })
    .formatToParts(ref).find(p => p.type === 'timeZoneName').value // "GMT+1" ou "GMT+2"
  const offsetH = parseInt(tzStr.replace('GMT', '')) || 1
  const [Y, M, D] = dateStr.split('-').map(Number)
  return WINDOWS.reduce((acc, [h, m]) => {
    const start = new Date(Date.UTC(Y, M - 1, D, h - offsetH, m, 0))
    const end   = new Date(start.getTime() + 45 * 60 * 1000)
    if (!busy.some(b => start < b.end && end > b.start)) {
      acc.push({ time: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, label: `${String(h).padStart(2,'0')}h${m === 0 ? '00' : m}` })
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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
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
    const year  = parseInt(req.query.year)
    const month = parseInt(req.query.month)
    if (!year || !month) return res.status(400).json({ error: 'year et month requis' })

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
        if (!busyByDay[e.start.date]) busyByDay[e.start.date] = []
        busyByDay[e.start.date].push({ allDay: true }); continue
      }
      if (!e.start?.dateTime) continue
      const start = new Date(e.start.dateTime); const end = new Date(e.end.dateTime)
      const dateStr = parisDateStr(start)
      if (!busyByDay[dateStr]) busyByDay[dateStr] = []
      busyByDay[dateStr].push({ start, end, allDay: false })
    }

    const today = new Date(); today.setHours(0,0,0,0)
    const days = {}
    for (let d = 1; d <= new Date(year, month, 0).getDate(); d++) {
      const date = new Date(year, month - 1, d); const dow = date.getDay()
      if (dow === 0 || dow === 6 || date < today) continue
      const dateStr = date.toISOString().split('T')[0]
      const busy = (busyByDay[dateStr] || []).filter(b => !b.allDay)
      const hasAllDay = (busyByDay[dateStr] || []).some(b => b.allDay)
      days[dateStr] = { eventCount: (busyByDay[dateStr] || []).length, hasAllDay, slots: hasAllDay ? [] : freeSlots(dateStr, busy) }
    }
    return res.json({ days })
  }

  // ── GET ?action=slots — créneaux libres J+3 (EmailSection) ────────────────
  if (action === 'slots') {
    const workDays = workingDaysFrom(3, 3)
    const timeMin  = workDays[0].toISOString()
    const timeMax  = new Date(workDays[workDays.length - 1]); timeMax.setHours(23, 59, 59)
    const events   = await fetchAllEvents(accessToken, calendarIds, timeMin, timeMax.toISOString())

    const busy = events
      .filter(e => e.status !== 'cancelled' && e.start?.dateTime)
      .map(e => ({ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }))

    const slots = []
    for (const day of workDays) {
      const dayLabel = day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      for (const [h, m] of WINDOWS) {
        const slotStart = new Date(day); slotStart.setHours(h, m, 0, 0)
        const slotEnd   = new Date(slotStart.getTime() + 45 * 60 * 1000)
        if (!busy.some(b => slotStart < b.end && slotEnd > b.start)) {
          slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), label: dayLabel + ' à ' + slotStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), day: dayLabel })
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

  return res.status(400).json({ error: 'action inconnue' })
}
