// api/rapport-send.js — Crée un brouillon Gmail avec le rapport de visite (PDF + lien de partage)
import { createClient } from '@supabase/supabase-js'
import { setCors } from './_cors.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getValidAccessToken(userId) {
  const { data, error } = await supabase
    .from('google_tokens').select('*').eq('user_id', userId).single()
  if (error || !data) throw new Error('Compte Gmail non connecté')

  if (new Date(data.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return { accessToken: data.access_token, senderEmail: data.email }
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
  if (!tokens.access_token) throw new Error('Refresh token invalide — reconnectez Gmail')

  await supabase.from('google_tokens').update({
    access_token: tokens.access_token,
    expires_at:   new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at:   new Date().toISOString(),
  }).eq('user_id', userId)

  return { accessToken: tokens.access_token, senderEmail: data.email }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const { visiteId, prestataireEmail, prestataireNom, nomSite, rapportUrl, partageUrl, dossierRef } = req.body

  if (!prestataireEmail) return res.status(400).json({ error: 'Email prestataire requis' })

  const expiresDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toLocaleDateString('fr-FR')
  const dest = prestataireNom ? `${prestataireNom},` : 'Madame, Monsieur,'
  const ref  = dossierRef ? ` — Dossier ${dossierRef}` : ''

  const subject = `Rapport de visite technique${ref}${nomSite ? ` (${nomSite})` : ''}`

  const body = [
    dest,
    '',
    `Veuillez trouver ci-dessous le rapport de visite technique${nomSite ? ` du site "${nomSite}"` : ''}${ref}.`,
    '',
    '─────────────────────────────────────',
    '📄 Rapport PDF (téléchargement direct) :',
    rapportUrl || '(non disponible)',
    '',
    '🔗 Rapport en ligne (lien de partage) :',
    partageUrl,
    `Ce lien est accessible sans connexion jusqu\'au ${expiresDate}.`,
    '─────────────────────────────────────',
    '',
    'Ce rapport contient :',
    '  • Les informations du site et de l\'installation existante',
    '  • Les données techniques CEE (IND-BA-110)',
    '  • Les photos prises lors de la visite',
    '',
    'Pour toute question, n\'hésitez pas à nous contacter.',
    '',
    'Cordialement,',
    "L'équipe SOFT.IA",
  ].join('\n')

  let accessToken, senderEmail
  try {
    ({ accessToken, senderEmail } = await getValidAccessToken(user.id))
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }

  const msg = [
    `From: ${senderEmail}`,
    `To: ${prestataireEmail}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n')

  const raw = Buffer.from(msg).toString('base64url')

  const draftRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  })
  const draft = await draftRes.json()
  if (!draft.id) return res.status(500).json({ error: 'Échec création brouillon Gmail', detail: draft })

  return res.json({
    success:  true,
    draftId:  draft.id,
    gmailUrl: `https://mail.google.com/mail/#drafts/${draft.id}`,
  })
}
