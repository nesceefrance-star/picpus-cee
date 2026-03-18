// api/calendar-slots.js
// Retourne 4 créneaux libres de 45min sur les 5 prochains jours ouvrés
// Plages : 9h-12h et 14h-18h (heure de Paris)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getValidToken(userId) {
  const { data } = await supabase.from('google_tokens').select('*').eq('user_id', userId).single()
  if (!data) throw new Error('Gmail non connecté')

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
  if (!tokens.access_token) throw new Error('Token Google expiré — reconnectez Gmail')

  await supabase.from('google_tokens').update({
    access_token: tokens.access_token,
    expires_at:   new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at:   new Date().toISOString(),
  }).eq('user_id', userId)

  return tokens.access_token
}

function nextWorkingDays(n) {
  const days = []
  const d = new Date()
  d.setDate(d.getDate() + 1) // commence demain
  while (days.length < n) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function toParisISO(date, hours, minutes) {
  // Crée une date en heure de Paris (approximation UTC+1/UTC+2)
  const d = new Date(date)
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
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

  const workDays = nextWorkingDays(7) // 7 jours ouvrés pour avoir de la marge
  const timeMin  = workDays[0].toISOString()
  const timeMax  = workDays[workDays.length - 1]
  timeMax.setHours(23, 59, 59)

  // Récupérer les événements existants
  const eventsRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const eventsData = await eventsRes.json()
  const events = eventsData.items || []

  // Convertir les événements en plages occupées
  const busy = events
    .filter(e => e.status !== 'cancelled' && e.start?.dateTime)
    .map(e => ({ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }))

  // Créneaux de 45min à proposer
  const WINDOWS = [
    [9, 0], [9, 45], [10, 30], [11, 0],
    [14, 0], [14, 45], [15, 30], [16, 0], [16, 30], [17, 0],
  ]

  const slots = []
  for (const day of workDays) {
    if (slots.length >= 4) break
    for (const [h, m] of WINDOWS) {
      if (slots.length >= 4) break
      const slotStart = new Date(day)
      slotStart.setHours(h, m, 0, 0)
      const slotEnd = new Date(slotStart.getTime() + 45 * 60 * 1000)

      const isBusy = busy.some(b => slotStart < b.end && slotEnd > b.start)
      if (!isBusy) {
        slots.push({
          start:   slotStart.toISOString(),
          end:     slotEnd.toISOString(),
          label:   slotStart.toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long',
          }) + ' à ' + slotStart.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        })
      }
    }
  }

  return res.json({ slots })
}
