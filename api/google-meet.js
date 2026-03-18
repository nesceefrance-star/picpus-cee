// api/google-meet.js
// POST { subject, startDateTime, endDateTime, emails }
// Crée un événement Google Calendar avec Meet intégré
// Retourne { meetLink, eventLink }

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getValidToken(userId) {
  const { data } = await supabase.from('google_tokens').select('*').eq('user_id', userId).single()
  if (!data) throw new Error('Google non connecté — reconnectez votre compte')

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
  if (!tokens.access_token) throw new Error('Token Google expiré — reconnectez votre compte')

  await supabase.from('google_tokens').update({
    access_token: tokens.access_token,
    expires_at:   new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at:   new Date().toISOString(),
  }).eq('user_id', userId)

  return tokens.access_token
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

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

  const { subject, startDateTime, endDateTime, emails = [] } = req.body
  if (!subject || !startDateTime || !endDateTime) {
    return res.status(400).json({ error: 'subject, startDateTime et endDateTime requis' })
  }

  const requestId = `picpus-${Date.now()}`

  const event = {
    summary: subject,
    start: { dateTime: startDateTime, timeZone: 'Europe/Paris' },
    end:   { dateTime: endDateTime,   timeZone: 'Europe/Paris' },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    ...(emails.length > 0 ? {
      attendees: emails.map(email => ({ email })),
    } : {}),
  }

  const calRes = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  const calEvent = await calRes.json()

  if (!calEvent.hangoutLink) {
    console.error('Google Calendar API error:', calEvent)
    // Scope manquant — le token actuel n'a pas calendar.events
    if (calEvent.error?.code === 403) {
      return res.status(403).json({ error: 'scope_missing' })
    }
    return res.status(500).json({ error: calEvent.error?.message || 'Erreur création événement' })
  }

  return res.json({
    meetLink:  calEvent.hangoutLink,
    eventLink: calEvent.htmlLink,
  })
}
