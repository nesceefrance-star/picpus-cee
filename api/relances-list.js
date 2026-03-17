// api/relances-list.js — ÉTAPE 1 (rapide, < 1s)
// Détecte les relances depuis dossiers.statut = 'devis' (= devis envoyé dans le CRM).
// Les montants viennent des champs prime_estimee / montant_devis du dossier.
// Buckets : J+7 (7-13j), J+14 (14-19j), J+20+ (20j+).

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function bucket(days) {
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

  // Dossiers au statut 'devis' avec prospect
  let query = supabase
    .from('dossiers')
    .select(`
      id, ref, fiche_cee, statut, assigne_a, updated_at,
      prime_estimee, montant_devis, marge_pct,
      prospect:prospects(raison_sociale, contact_nom, contact_email, contact_tel)
    `)
    .eq('statut', 'devis')
    .order('updated_at', { ascending: true })

  if (!isAdmin) query = query.eq('assigne_a', user.id)

  const { data: dossiers, error: dossierErr } = await query
  if (dossierErr) return res.status(500).json({ error: dossierErr.message })

  if (!dossiers?.length) return res.json({ relances: [], isAdmin, commercials: [] })

  // Activités email par dossier (relances déjà faites)
  const dossierIds = dossiers.map(d => d.id)
  const { data: activites } = await supabase
    .from('activites')
    .select('dossier_id, created_at')
    .in('dossier_id', dossierIds)
    .eq('type', 'email')

  // Profils commerciaux pour la vue admin
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

  const relances = dossiers.map(dossier => {
    const sentAt    = new Date(dossier.updated_at).getTime()
    const daysSince = Math.floor((now - sentAt) / 86400000)
    const b = bucket(daysSince)
    if (!b) return null

    const relancesDone = activites
      ?.filter(a => a.dossier_id === dossier.id && new Date(a.created_at) > new Date(dossier.updated_at))
      .length || 0

    return {
      dossierId:    dossier.id,
      dossierRef:   dossier.ref,
      ficheCee:     dossier.fiche_cee,
      primeCee:     dossier.prime_estimee,
      montantDevis: dossier.montant_devis,
      sentAt:       dossier.updated_at,
      daysSince,
      bucket:       b,
      relancesDone,
      prospect:     dossier.prospect,
      commercial:   isAdmin ? (profilesMap[dossier.assigne_a] || null) : undefined,
      assigneA:     dossier.assigne_a,
    }
  }).filter(Boolean)

  return res.json({ relances, isAdmin, commercials })
}
