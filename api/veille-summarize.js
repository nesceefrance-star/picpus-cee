import { createClient } from '@supabase/supabase-js'
import { setCors } from './_cors.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return res.status(500).json({ error: 'missing env: SUPABASE_SERVICE_ROLE_KEY' })
  if (!ANTHROPIC_KEY)
    return res.status(500).json({ error: 'missing env: ANTHROPIC_API_KEY' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const { error: authErr } = await supabase.auth.getUser(token)
  if (authErr) return res.status(401).json({ error: 'unauthorized' })

  const { item_id } = req.body
  if (!item_id) return res.status(400).json({ error: 'item_id requis' })

  // 1. Récupérer l'item
  const { data: item, error: itemErr } = await supabase
    .from('veille_items')
    .select('*')
    .eq('id', item_id)
    .single()
  if (itemErr || !item) return res.status(404).json({ error: 'item non trouvé' })
  if (item.resume_ia) return res.status(200).json({ resume_ia: item.resume_ia, points_cles: item.points_cles, fiches_impactees: item.fiches_impactees || [] })

  // 2. Tenter de récupérer le contenu de la page (best effort)
  let pageContent = item.description || ''
  if (item.url) {
    try {
      const r = await fetch(item.url, {
        headers: { 'User-Agent': 'PICPUS-CEE-Veille/1.0' },
        signal: AbortSignal.timeout(6000),
      })
      const html = await r.text()
      // Extraire texte brut (supprimer balises HTML)
      pageContent = html.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 6000)
    } catch { /* on garde description si échec */ }
  }

  // 3. Appel Claude Haiku
  const prompt = `Tu es un expert en Certificats d'Économies d'Énergie (CEE) en France.
Voici un document officiel ou un article concernant les CEE :

TITRE : ${item.titre}
SOURCE : ${item.source_nom}
DATE : ${item.date_publication ? new Date(item.date_publication).toLocaleDateString('fr-FR') : 'inconnue'}

CONTENU :
${pageContent}

Ta mission :
1. Rédige un résumé clair en 2-3 phrases (max 100 mots)
2. Liste exactement 5 points clés sous forme de phrases courtes et actionnables
3. Si des fiches CEE spécifiques sont mentionnées (ex: BAT-TH-163, IND-BA-110), liste-les

Réponds UNIQUEMENT en JSON valide avec cette structure :
{
  "resume": "...",
  "points": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "fiches": ["BAT-TH-163"]
}`

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`)

    const claudeData = await claudeRes.json()
    const raw = claudeData.content?.[0]?.text || ''

    let parsed
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch?.[0] || '{}')
    } catch { parsed = { resume: raw.slice(0, 300), points: [], fiches: [] } }

    const resume_ia = parsed.resume || ''
    const points_cles = parsed.points || []
    const fiches_detectees = [...new Set([...(item.fiches_impactees || []), ...(parsed.fiches || [])])]

    // 4. Mettre à jour l'item en base
    await supabase.from('veille_items').update({
      resume_ia,
      points_cles,
      fiches_impactees: fiches_detectees,
    }).eq('id', item_id)

    return res.status(200).json({ resume_ia, points_cles, fiches_impactees: fiches_detectees })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
