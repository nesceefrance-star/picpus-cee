// api/email-generate.js
// Génère un email via Claude (prompt caching sur guide rédactionnel + exemple).
// Ne crée PAS de brouillon Gmail — retourne { subject, body } pour copier-coller.
// Sauvegarde dans email_generations (upsert par dossier_id + type).

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EMAIL_TYPE_LABELS = {
  visio_creneaux: 'Proposition de créneaux de visioconférence',
  visio_confirm:  'Confirmation de visioconférence',
  post_visio:     "Post-visio — demande d'éléments complémentaires",
  visite_confirm: 'Confirmation de visite technique',
  envoi_devis:    'Envoi du devis',
  relance:        'Relance du devis',
}

const EMAIL_TYPE_INSTRUCTIONS = {
  visio_creneaux: "Propose les créneaux de visioconférence indiqués. L'email doit être chaleureux, professionnel, et inviter le contact à choisir un créneau.",
  visio_confirm:  "Confirme la visioconférence planifiée. Rappelle les informations pratiques (lien ou modalités). Prépare le contact à l'échange en précisant l'ordre du jour.",
  post_visio:     "Remercie pour la visioconférence. Explique les documents/informations nécessaires pour avancer le dossier CEE. Donne une liste claire et précise.",
  visite_confirm: "Confirme la visite technique sur site. Précise les modalités pratiques et ce qui sera vérifié lors de la visite.",
  envoi_devis:    "Envoie le devis avec toutes les explications nécessaires. Valorise la prime CEE et le reste à charge. Invite le contact à poser des questions.",
  relance:        "Relance poliment pour le devis envoyé. Reste chaleureux et non-insistant. Propose d'échanger si besoin.",
}

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

  const { dossierId, type, selectedSlots } = req.body
  if (!dossierId || !type) return res.status(400).json({ error: 'dossierId et type requis' })
  if (!EMAIL_TYPE_LABELS[type]) return res.status(400).json({ error: 'Type inconnu' })

  // Récupérer dossier + prospect en parallèle avec guide + exemple
  const [
    { data: dossier, error: dossierErr },
    { data: guides },
    { data: exemple },
    { data: profile },
  ] = await Promise.all([
    supabase.from('dossiers').select(`
      id, ref, fiche_cee, statut, statut_date,
      prime_estimee, montant_devis,
      prospect:prospects(raison_sociale, contact_nom, contact_email, contact_tel, ville)
    `).eq('id', dossierId).single(),
    supabase.from('style_guide').select('contenu').order('updated_at', { ascending: false }).limit(1),
    supabase.from('email_exemples').select('contenu').eq('type', type).maybeSingle(),
    supabase.from('profiles').select('nom, prenom').eq('id', user.id).single(),
  ])

  if (dossierErr || !dossier) return res.status(404).json({ error: 'Dossier introuvable' })

  const styleGuide   = guides?.[0]?.contenu || ''
  const exempleEmail = exemple?.contenu || ''
  const commercialName = profile ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() : 'le commercial'

  // Construire les blocs système avec prompt caching
  const systemParts = []

  if (styleGuide) {
    systemParts.push({
      type: 'text',
      text: `GUIDE RÉDACTIONNEL — respecte impérativement ces consignes pour tous tes emails :\n\n${styleGuide}`,
      cache_control: { type: 'ephemeral' },
    })
  }

  if (exempleEmail) {
    systemParts.push({
      type: 'text',
      text: `EXEMPLE D'EMAIL pour le type "${EMAIL_TYPE_LABELS[type]}" :\n\n${exempleEmail}\n\nInspire-toi du style, du ton et de la structure — mais adapte le contenu au dossier ci-dessous.`,
      cache_control: { type: 'ephemeral' },
    })
  }

  if (!systemParts.length) {
    systemParts.push({
      type: 'text',
      text: "Tu es un assistant commercial spécialisé dans les dossiers CEE (Certificats d'Économies d'Énergie). Rédige des emails professionnels, chaleureux et personnalisés.",
    })
  }

  // Préparer le contexte dossier
  const p = dossier.prospect || {}
  const fmt = n => n ? Number(n).toLocaleString('fr-FR') + ' €' : 'Non défini'

  const slotsText = selectedSlots?.length
    ? '\nCréneaux à proposer :\n' + selectedSlots.map(s => `- ${s.label}`).join('\n')
    : ''

  const userMessage = `Type d'email : ${EMAIL_TYPE_LABELS[type]}
Instructions spécifiques : ${EMAIL_TYPE_INSTRUCTIONS[type]}

Contexte du dossier :
- Référence dossier : ${dossier.ref}
- Fiche CEE : ${dossier.fiche_cee}
- Entreprise : ${p.raison_sociale || 'N/A'}
- Contact : ${p.contact_nom || 'N/A'}
- Email : ${p.contact_email || 'N/A'}
- Ville : ${p.ville || 'N/A'}
- Prime CEE estimée : ${fmt(dossier.prime_estimee)}
- Montant devis TTC : ${fmt(dossier.montant_devis)}
- Commercial en charge : ${commercialName}${slotsText}

Génère l'email en respectant EXACTEMENT ce format :
SUJET: [objet de l'email]
---
[corps de l'email complet]`

  // Appel Claude
  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta':    'prompt-caching-2024-07-31',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-opus-4-6',
      max_tokens: 1200,
      system:     systemParts,
      messages:   [{ role: 'user', content: userMessage }],
    }),
  })

  if (!claudeRes.ok) {
    const errText = await claudeRes.text()
    return res.status(500).json({ error: `Claude error: ${errText}` })
  }

  const claudeData = await claudeRes.json()
  const fullText   = claudeData.content?.[0]?.text || ''

  // Parser sujet + corps
  const sepIdx = fullText.indexOf('\n---\n')
  let subject = '', body = fullText

  if (fullText.startsWith('SUJET:') && sepIdx > -1) {
    subject = fullText.slice(6, sepIdx).trim()
    body    = fullText.slice(sepIdx + 5).trim()
  }

  // Sauvegarder dans email_generations (upsert)
  await supabase.from('email_generations').upsert({
    dossier_id: dossierId,
    type,
    subject,
    body,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'dossier_id,type' })

  return res.json({ subject, body })
}
