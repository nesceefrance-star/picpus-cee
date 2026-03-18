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
  visio_creneaux: "Email post-appel téléphonique. Fait suite à l'échange, propose les créneaux. Court, direct.",
  visio_confirm:  "Confirme la visio avec le lien. Très court, 4-5 lignes max.",
  post_visio:     "Demande les éléments techniques nécessaires. Liste à puces, pas d'intro longue.",
  visite_confirm: "Confirme la visite technique avec date/heure/lieu. Court.",
  envoi_devis:    "Accompagne l'envoi du devis. Mentionne la prime CEE et le reste à charge. Concis.",
  relance:        "Relance courte et non-insistante pour le devis. 3-4 lignes max.",
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

  const userMessage = `Type : ${EMAIL_TYPE_LABELS[type]}
Instructions : ${EMAIL_TYPE_INSTRUCTIONS[type]}

Dossier :
- Entreprise : ${p.raison_sociale || 'N/A'}
- Contact : ${p.contact_nom || 'N/A'}
- Ville : ${p.ville || 'N/A'}
- Fiche CEE : ${dossier.fiche_cee}
- Prime CEE : ${fmt(dossier.prime_estimee)}
- Montant devis : ${fmt(dossier.montant_devis)}
- Commercial : ${commercialName}${slotsText}

CONTRAINTES ABSOLUES :
- Maximum 10 lignes de corps
- Pas de formules creuses ("N'hésitez pas à", "Je reste à votre disposition", etc.)
- Pas de signature (elle est gérée automatiquement)
- Respecte le style et la longueur de l'exemple fourni

Format de réponse OBLIGATOIRE :
SUJET: [objet court]
---
[corps de l'email]`

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
      max_tokens: 600,
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
