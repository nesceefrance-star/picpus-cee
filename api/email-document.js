// api/email-document.js — Crée un brouillon Gmail avec lien de téléchargement d'un document
// POST body: { dossierId, storagePath, fileName }

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

  const { dossierId, storagePath, fileName } = req.body
  if (!dossierId || !storagePath || !fileName)
    return res.status(400).json({ error: 'dossierId, storagePath et fileName requis' })

  // Récupérer dossier + prospect
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('ref, prospects(raison_sociale, contact_email, contact_nom)')
    .eq('id', dossierId)
    .single()
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable' })

  // Générer un lien signé 7 jours (604800 secondes)
  const { data: signedData, error: signedErr } = await supabase
    .storage.from('dossier-documents')
    .createSignedUrl(storagePath, 604800)
  if (signedErr || !signedData?.signedUrl)
    return res.status(500).json({ error: 'Impossible de générer le lien de téléchargement' })

  const { prospect, ref } = dossier
  const to = prospect?.contact_email || ''
  const contactNom = prospect?.contact_nom || 'Madame, Monsieur'
  const societe = prospect?.raison_sociale || ''
  const expiresDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toLocaleDateString('fr-FR')

  const subject = `Document — ${fileName} — Dossier ${ref}`
  const body = [
    `${contactNom},`,
    '',
    `Veuillez trouver ci-dessous le lien de téléchargement du document "${fileName}" relatif au dossier ${ref}${societe ? ` (${societe})` : ''}.`,
    '',
    `Lien de téléchargement (valable jusqu'au ${expiresDate}) :`,
    signedData.signedUrl,
    '',
    'Cordialement,',
    "L'équipe SOFT.IA",
  ].join('\n')

  // Récupérer token Google
  let accessToken, senderEmail
  try {
    ({ accessToken, senderEmail } = await getValidAccessToken(user.id))
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }

  // Construire message RFC 2822
  const msg = [
    `From: ${senderEmail}`,
    to ? `To: ${to}` : `To: ${senderEmail}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n')
  const raw = Buffer.from(msg).toString('base64url')

  // Créer le brouillon Gmail
  const draftRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  })
  const draft = await draftRes.json()
  if (!draft.id)
    return res.status(500).json({ error: 'Échec création brouillon Gmail', detail: draft })

  // Log activité
  await supabase.from('activites').insert({
    dossier_id: dossierId,
    user_id:    user.id,
    type:       'email',
    contenu:    `Brouillon envoi document créé : ${fileName}`,
  })

  return res.json({
    success:  true,
    draftId:  draft.id,
    gmailUrl: `https://mail.google.com/mail/#drafts/${draft.id}`,
  })
}
