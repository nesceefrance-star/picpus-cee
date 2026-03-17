// api/relances-list.js — ÉTAPE 1 (rapide, < 1s)
// Retourne les devis "envoyé" en attente de relance depuis Supabase.
// Pour l'admin : tous les commerciaux. Pour un commercial : uniquement ses dossiers.
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

  // Profil pour déterminer le rôle
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  // Tous les devis envoyés avec leur dossier + prospect
  const { data: devisList, error: devisErr } = await supabase
    .from('devis')
    .select(`
      id, numero, total_ttc, prime_cee, reste_ttc, updated_at,
      dossier:dossiers(
        id, ref, fiche_cee, assigne_a,
        prospect:prospects(raison_sociale, contact_nom, contact_email, contact_tel)
      )
    `)
    .eq('statut', 'envoye')
    .order('updated_at', { ascending: true })

  if (devisErr) return res.status(500).json({ error: devisErr.message })

  // Filtrer par commercial si non-admin
  const filtered = isAdmin
    ? devisList
    : devisList.filter(d => d.dossier?.assigne_a === user.id)

  if (!filtered.length) return res.json({ relances: [], isAdmin, commercials: [] })

  // Compter les activités email déjà faites après envoi du devis (= relances effectuées)
  const dossierIds = [...new Set(filtered.map(d => d.dossier?.id).filter(Boolean))]
  const { data: activites } = await supabase
    .from('activites')
    .select('dossier_id, created_at')
    .in('dossier_id', dossierIds)
    .eq('type', 'email')

  // Récupérer les profils des commerciaux pour la vue admin
  let profilesMap = {}
  let commercials = []
  if (isAdmin) {
    const userIds = [...new Set(filtered.map(d => d.dossier?.assigne_a).filter(Boolean))]
    const { data: profiles } = await supabase
      .from('profiles').select('id, nom, prenom').in('id', userIds)
    profiles?.forEach(p => { profilesMap[p.id] = p })
    commercials = profiles || []
  }

  const now = Date.now()

  const relances = filtered.map(devis => {
    const sentAt   = new Date(devis.updated_at).getTime()
    const daysSince = Math.floor((now - sentAt) / 86400000)
    const b = bucket(daysSince)
    if (!b) return null // Pas encore J+7

    const dossierId = devis.dossier?.id
    const relancesDone = activites
      ?.filter(a => a.dossier_id === dossierId && new Date(a.created_at) > new Date(devis.updated_at))
      .length || 0

    return {
      devisId:      devis.id,
      devisNumero:  devis.numero,
      totalTtc:     devis.total_ttc,
      primeCee:     devis.prime_cee,
      resteTtc:     devis.reste_ttc,
      sentAt:       devis.updated_at,
      daysSince,
      bucket:       b,
      relancesDone,
      dossier: {
        id:       dossierId,
        ref:      devis.dossier?.ref,
        ficheCee: devis.dossier?.fiche_cee,
        assigneA: devis.dossier?.assigne_a,
      },
      prospect:      devis.dossier?.prospect,
      commercial:    isAdmin ? (profilesMap[devis.dossier?.assigne_a] || null) : undefined,
    }
  }).filter(Boolean)

  return res.json({ relances, isAdmin, commercials })
}
