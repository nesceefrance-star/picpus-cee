// api/calendar-list.js
// GET — liste tous les agendas Google de l'utilisateur
// Retourne { calendars: [{ id, summary, backgroundColor, primary, selected }] }

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getValidToken(userId) {
  const { data } = await supabase.from('google_tokens').select('*').eq('user_id', userId).single()
  if (!data) throw new Error('Google non connecté')
  if (new Date(data.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return { token: data.access_token, calendarIds: data.calendar_ids || [] }
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: data.refresh_token, grant_type: 'refresh_token',
    }),
  })
  const tokens = await r.json()
  if (!tokens.access_token) throw new Error('Token expiré — reconnectez dans Paramètres')
  await supabase.from('google_tokens').update({
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)
  return { token: tokens.access_token, calendarIds: data.calendar_ids || [] }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // POST — sauvegarder la sélection
  if (req.method === 'POST') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'unauthorized' })
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })
    const { calendarIds } = req.body
    await supabase.from('google_tokens').update({ calendar_ids: calendarIds }).eq('user_id', user.id)
    return res.json({ ok: true })
  }

  // GET — lister les agendas
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  let accessToken, calendarIds
  try {
    ({ token: accessToken, calendarIds } = await getValidToken(user.id))
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }

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
