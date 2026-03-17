// api/auth-callback.js — Callback OAuth2 Google
// Google redirige ici après consentement. On échange le code contre des tokens
// et on les stocke dans Supabase (table google_tokens) par userId.

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { code, state, error } = req.query

  if (error) return res.redirect('/?error=google_denied')
  if (!code || !state) return res.status(400).send('Paramètres manquants')

  // Décoder le state pour retrouver l'userId
  let userId
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = decoded.userId
    // Vérification anti-rejeu basique : state vieux de plus de 10 min → refus
    if (Date.now() - decoded.ts > 10 * 60 * 1000) throw new Error('State expiré')
  } catch {
    return res.status(400).send('State invalide ou expiré')
  }

  // Échange du code contre des tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  if (!tokens.access_token) {
    console.error('Token exchange failed:', tokens)
    return res.redirect('/relances?error=token_exchange')
  }

  // Récupérer l'email Google de l'utilisateur
  const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const { email } = await infoRes.json()

  // Stocker dans Supabase (upsert par user_id)
  const { error: dbError } = await supabase.from('google_tokens').upsert({
    user_id:       userId,
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at:    new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    email,
    updated_at:    new Date().toISOString(),
  })

  if (dbError) {
    console.error('Supabase upsert error:', dbError)
    return res.redirect('/relances?error=db')
  }

  res.redirect('/relances?google=connected')

  } catch (e) {
    console.error('auth-callback crash:', e)
    return res.redirect(`/relances?error=${encodeURIComponent(e.message)}`)
  }
}
