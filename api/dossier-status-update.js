// api/dossier-status-update.js
// Met à jour le statut d'un dossier + statut_date (saisi manuellement).
// statut_date est la date de référence pour le compteur J+7/J+14/J+20+.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

  const { dossierId, statut, statut_date } = req.body
  if (!dossierId || !statut) return res.status(400).json({ error: 'dossierId et statut requis' })

  const updates = { statut }
  if (statut_date) updates.statut_date = new Date(statut_date).toISOString()

  const { data, error } = await supabase
    .from('dossiers')
    .update(updates)
    .eq('id', dossierId)
    .select('id, statut, statut_date, ref')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Log activité
  await supabase.from('activites').insert({
    dossier_id: dossierId,
    user_id:    user.id,
    type:       'statut',
    contenu:    `Statut → ${statut}${statut_date ? ` (date : ${new Date(statut_date).toLocaleDateString('fr-FR')})` : ''}`,
  })

  return res.json({ success: true, dossier: data })
}
