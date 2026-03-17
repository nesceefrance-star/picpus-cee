// api/auth-google-status.js — Vérifie si le compte Gmail est connecté pour l'utilisateur courant

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'unauthorized' })

  const { data } = await supabase
    .from('google_tokens')
    .select('email, expires_at')
    .eq('user_id', user.id)
    .single()

  return res.json({
    connected: !!data,
    email:     data?.email || null,
    expired:   data ? new Date(data.expires_at) < new Date() : false,
  })
}
