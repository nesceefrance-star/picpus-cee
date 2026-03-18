// api/calendar-events.js
// GET ?year=YYYY&month=M
// Retourne les plages occupées par jour du mois + créneaux libres par jour
// Utilisé par le mini-calendrier dans le bloc Visio

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getValidToken(userId) {
  const { data } = await supabase.from('google_tokens').select('*').eq('user_id', userId).single()
  if (!data) throw new Error('Google non connecté')

  if (new Date(data.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return data.access_token
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

  return tokens.access_token
}

const WINDOWS = [
  [9,0],[9,45],[10,30],[11,0],
  [14,0],[14,45],[15,30],[16,0],[16,30],[17,0],
]

function freeSlots(dateStr, busy) {
  const slots = []
  for (const [h, m] of WINDOWS) {
    const start = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
    const end   = new Date(start.getTime() + 45 * 60 * 1000)
    const isBusy = busy.some(b => start < b.end && end > b.start)
    if (!isBusy) {
      slots.push({
        time:  `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`,
        label: `${String(h).padStart(2,'0')}h${m === 0 ? '00' : m}`,
      })
    }
  }
  return slots
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  let accessToken
  try {
    accessToken = await getValidToken(user.id)
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }

  const year  = parseInt(req.query.year)
  const month = parseInt(req.query.month) // 1-based
  if (!year || !month) return res.status(400).json({ error: 'year et month requis' })

  const timeMin = new Date(year, month - 1, 1).toISOString()
  const timeMax = new Date(year, month, 1).toISOString() // 1er du mois suivant

  const eventsRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const eventsData = await eventsRes.json()
  const events = eventsData.items || []

  // Grouper les événements par jour
  // busy[dateStr] = [{ start, end }]
  const busyByDay = {}

  for (const e of events) {
    if (e.status === 'cancelled') continue

    // Événement sur toute la journée
    if (e.start?.date && !e.start?.dateTime) {
      const dateStr = e.start.date
      if (!busyByDay[dateStr]) busyByDay[dateStr] = []
      busyByDay[dateStr].push({ allDay: true })
      continue
    }

    if (!e.start?.dateTime) continue
    const start = new Date(e.start.dateTime)
    const end   = new Date(e.end.dateTime)
    const dateStr = start.toISOString().split('T')[0]
    if (!busyByDay[dateStr]) busyByDay[dateStr] = []
    busyByDay[dateStr].push({ start, end, allDay: false })
  }

  // Calculer les créneaux libres par jour (jours ouvrés uniquement)
  const today = new Date(); today.setHours(0,0,0,0)
  const days = {}
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dow  = date.getDay()
    if (dow === 0 || dow === 6) continue // week-end
    if (date < today) continue           // passé

    const dateStr = date.toISOString().split('T')[0]
    const busy    = (busyByDay[dateStr] || []).filter(b => !b.allDay)
    const hasAllDay = (busyByDay[dateStr] || []).some(b => b.allDay)

    days[dateStr] = {
      eventCount: (busyByDay[dateStr] || []).length,
      hasAllDay,
      slots: hasAllDay ? [] : freeSlots(dateStr, busy),
    }
  }

  return res.json({ days })
}
