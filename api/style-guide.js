// api/style-guide.js
// GET  → retourne le guide rédactionnel + tous les exemples par type
// POST → sauvegarde le guide + les exemples

import { createClient } from '@supabase/supabase-js'
import { setCors } from './_cors.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') {
    const [{ data: guides }, { data: exemples }] = await Promise.all([
      supabase.from('style_guide').select('contenu, updated_at').order('updated_at', { ascending: false }).limit(1),
      supabase.from('email_exemples').select('type, contenu'),
    ])

    const exemplesMap = {}
    exemples?.forEach(e => { exemplesMap[e.type] = e.contenu })

    return res.json({
      guide:    guides?.[0]?.contenu || '',
      exemples: exemplesMap,
    })
  }

  if (req.method === 'POST') {
    const { guide, exemples } = req.body

    // Upsert guide (delete + insert pour le singleton)
    if (guide !== undefined) {
      await supabase.from('style_guide').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('style_guide').insert({ contenu: guide })
    }

    // Upsert exemples par type
    if (exemples) {
      for (const [type, contenu] of Object.entries(exemples)) {
        await supabase.from('email_exemples').upsert({ type, contenu }, { onConflict: 'type' })
      }
    }

    return res.json({ success: true })
  }

  return res.status(405).end()
}
