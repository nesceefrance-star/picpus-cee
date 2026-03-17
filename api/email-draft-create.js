// api/email-draft-create.js — ÉTAPE 2 (Claude + Gmail draft)
// Génère un email de relance avec Claude puis crée un brouillon Gmail.
// Le commercial voit le brouillon dans son Gmail et l'envoie quand il veut.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── Refresh du token Google si expiré ───────────────────────────────────────
async function getValidAccessToken(userId) {
  const { data, error } = await supabase
    .from('google_tokens').select('*').eq('user_id', userId).single()

  if (error || !data) throw new Error('Compte Gmail non connecté')

  // Token encore valide (marge 5 min)
  if (new Date(data.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return { accessToken: data.access_token, senderEmail: data.email }
  }

  // Refresh
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

// ─── Construction message RFC 2822 en base64url ───────────────────────────────
function buildRawEmail({ from, to, subject, body, withPdf }) {
  const boundary = `boundary_${Date.now()}`

  if (!withPdf) {
    const msg = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
    ].join('\r\n')
    return Buffer.from(msg).toString('base64url')
  }

  // Avec PJ présentation PDF
  let pdfBase64 = null
  try {
    pdfBase64 = readFileSync(join(process.cwd(), 'public', 'presentation_cee.pdf')).toString('base64')
  } catch {
    // PDF absent → on envoie sans PJ
    return buildRawEmail({ from, to, subject, body, withPdf: false })
  }

  const msg = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
    '',
    `--${boundary}`,
    'Content-Type: application/pdf; name="Présentation_CEE.pdf"',
    'Content-Disposition: attachment; filename="Présentation_CEE.pdf"',
    'Content-Transfer-Encoding: base64',
    '',
    pdfBase64,
    `--${boundary}--`,
  ].join('\r\n')

  return Buffer.from(msg).toString('base64url')
}

// ─── Formatage montant ────────────────────────────────────────────────────────
function fmt(n) {
  if (!n) return '—'
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const {
    dossierId,
    ton       = 'chaleureux',
    argument  = 'roi',
    longueur  = 'moyen',
    attachPdf = false,
  } = req.body

  if (!dossierId) return res.status(400).json({ error: 'dossierId requis' })

  // Récupérer le dossier + prospect directement
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .select(`
      id, ref, fiche_cee, updated_at, prime_estimee, montant_devis,
      prospect:prospects(raison_sociale, contact_nom, contact_email)
    `)
    .eq('id', dossierId)
    .single()

  if (dossierErr || !dossier) return res.status(404).json({ error: 'Dossier introuvable' })

  const { prospect, fiche_cee, ref: dossierRef } = dossier
  const daysSince = Math.floor((Date.now() - new Date(dossier.updated_at).getTime()) / 86400000)

  // Compter les relances déjà faites
  const { data: activites } = await supabase
    .from('activites')
    .select('id')
    .eq('dossier_id', dossierId)
    .eq('type', 'email')
    .gt('created_at', dossier.updated_at)

  const relanceNum = (activites?.length || 0) + 1

  // ─── Génération Claude ──────────────────────────────────────────────────────
  const tonMap      = { chaleureux: 'chaleureux et bienveillant', neutre: 'professionnel et neutre', ferme: 'direct et ferme' }
  const argumentMap = {
    roi:          'retour sur investissement et valorisation de la prime CEE',
    urgence:      'urgence liée aux délais réglementaires et volumes disponibles',
    reassurance:  'réassurance sur le process, la solidité de l\'intervention et l\'avance de fonds',
  }
  const longueurMap = { court: '3 à 4 lignes', moyen: '6 à 8 lignes', long: '10 à 12 lignes' }

  const prompt = `Tu es un commercial CEE (Certificats d'Économies d'Énergie) rédigeant un email de relance pour un devis envoyé sans réponse.

CONTEXTE DU DOSSIER :
- Entreprise : ${prospect.raison_sociale}
- Contact : ${prospect.contact_nom || 'le responsable'}
- Fiche CEE concernée : ${fiche_cee}
- Référence dossier : ${dossierRef}
- Montant devis : ${fmt(dossier.montant_devis)} €
- Prime CEE estimée : ${fmt(dossier.prime_estimee)} €
- Devis envoyé il y a : ${daysSince} jours
- Numéro de cette relance : ${relanceNum}

PARAMÈTRES :
- Ton : ${tonMap[ton] || ton}
- Argument principal : ${argumentMap[argument] || argument}
- Longueur corps : ${longueurMap[longueur] || longueur}

INSTRUCTIONS :
- Rappelle brièvement l'objet du devis (opération CEE, fiche ${fiche_cee})
- Met en avant l'argument principal de façon naturelle
- Si relance >= 2, varie l'approche (ne pas répéter exactement la même accroche)
- Termine par une invitation simple à répondre (confirmation, question, date de rappel)
- Signe au nom de "L'équipe RÉGIE PICPUS"
- Pas de formule trop commerciale ou insistante
- Corps en texte brut avec sauts de ligne \\n

RÉPONDS UNIQUEMENT avec un objet JSON valide (pas de markdown, pas d'explication) :
{"objet":"...","corps":"..."}`

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })

  const claudeData = await claudeRes.json()
  let objet, corps
  try {
    const text = claudeData.content?.[0]?.text || ''
    // Extraire le JSON même s'il y a du texte autour
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match?.[0] || text)
    objet = parsed.objet
    corps = parsed.corps
  } catch {
    return res.status(500).json({ error: 'Erreur parsing réponse Claude', raw: claudeData })
  }

  // ─── Création brouillon Gmail ───────────────────────────────────────────────
  let accessToken, senderEmail
  try {
    ({ accessToken, senderEmail } = await getValidAccessToken(user.id))
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }

  const rawEmail = buildRawEmail({
    from:    senderEmail,
    to:      prospect.contact_email,
    subject: objet,
    body:    corps,
    withPdf: attachPdf,
  })

  const draftRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw: rawEmail } }),
  })

  const draft = await draftRes.json()
  if (!draft.id) {
    return res.status(500).json({ error: 'Échec création brouillon Gmail', detail: draft })
  }

  // ─── Log activité dans le CRM ───────────────────────────────────────────────
  await supabase.from('activites').insert({
    dossier_id: dossier.id,
    user_id:    user.id,
    type:       'email',
    contenu:    `Brouillon relance #${relanceNum} créé — ${objet}`,
  })

  return res.json({
    success:    true,
    draftId:    draft.id,
    objet,
    corps,
    relanceNum,
    gmailUrl:   `https://mail.google.com/mail/#drafts/${draft.id}`,
  })
}
