// api/auth-google.js — Démarre le flow OAuth2 Google
// Appelé depuis le frontend : window.location.href = `/api/auth-google?userId=${userId}`
// L'userId Supabase est passé dans le state pour retrouver l'utilisateur au callback.

export default function handler(req, res) {
  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId requis' })

  const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url')

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/calendar',
    ].join(' '),
    access_type: 'offline',
    prompt:      'consent', // force refresh_token à chaque connexion
    state,
  })

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
