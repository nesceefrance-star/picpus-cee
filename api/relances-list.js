// api/relances-list.js — retourne tous les dossiers actifs + leurs générations d'emails.
// "Actif" = dans le cycle commercial : contacte → devis.
// statut_date est la date de référence pour le compteur J+7/J+14/J+20+ (devis seulement).

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ACTIVE_STATUTS = [
  'contacte', 'visio_planifiee', 'visio_effectuee',
  'visite_planifiee', 'visite_effectuee', 'devis',
]

function relanceBucket(days) {
  if (days >= 7  && days < 14) return 'J+7'
  if (days >= 14 && days < 20) return 'J+14'
  if (days >= 20)              return 'J+20+'
  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  let query = supabase
    .from('dossiers')
    .select(`
      id, ref, fiche_cee, statut, statut_date, assigne_a, updated_at,
      prime_estimee, montant_devis, marge_pct,
      prospect:prospects(raison_sociale, contact_nom, contact_email, contact_tel)
    `)
    .in('statut', ACTIVE_STATUTS)
    .order('statut_date', { ascending: true, nullsFirst: false })

  if (!isAdmin) query = query.eq('assigne_a', user.id)

  const { data: dossiers, error: dossierErr } = await query
  if (dossierErr) return res.status(500).json({ error: dossierErr.message })
  if (!dossiers?.length) return res.json({ dossiers: [], isAdmin, commercials: [] })

  const dossierIds = dossiers.map(d => d.id)

  // Dernières générations d'emails par dossier
  const { data: generations } = await supabase
    .from('email_generations')
    .select('dossier_id, type, subject, body, updated_at')
    .in('dossier_id', dossierIds)

  const genMap = {}
  generations?.forEach(g => {
    if (!genMap[g.dossier_id]) genMap[g.dossier_id] = {}
    genMap[g.dossier_id][g.type] = g
  })

  // Profils commerciaux (admin seulement)
  let profilesMap = {}
  let commercials = []
  if (isAdmin) {
    const userIds = [...new Set(dossiers.map(d => d.assigne_a).filter(Boolean))]
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, nom, prenom').in('id', userIds)
      profiles?.forEach(p => { profilesMap[p.id] = p })
      commercials = profiles || []
    }
  }

  const now = Date.now()

  const result = dossiers.map(dossier => {
    const refDate   = dossier.statut_date || dossier.updated_at
    const daysSince = Math.floor((now - new Date(refDate).getTime()) / 86400000)

    return {
      dossierId:     dossier.id,
      dossierRef:    dossier.ref,
      ficheCee:      dossier.fiche_cee,
      statut:        dossier.statut,
      statutDate:    dossier.statut_date,
      primeCee:      dossier.prime_estimee,
      montantDevis:  dossier.montant_devis,
      daysSince,
      relanceBucket: dossier.statut === 'devis' ? relanceBucket(daysSince) : null,
      prospect:      dossier.prospect,
      commercial:    isAdmin ? (profilesMap[dossier.assigne_a] || null) : undefined,
      assigneA:      dossier.assigne_a,
      generations:   genMap[dossier.id] || {},
    }
  })

  return res.json({ dossiers: result, isAdmin, commercials })
}
