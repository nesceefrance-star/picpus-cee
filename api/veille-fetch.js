import { createClient } from '@supabase/supabase-js'
import { setCors } from './_cors.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Fiches CEE connues — enrichi dynamiquement depuis la feature FICHE CEE DYNAMIQUE quand elle sera active
const FICHES_CEE_PATTERNS = [
  'BAT-TH-163', 'BAT-TH-142', 'BAT-TH-116', 'BAT-TH-164', 'BAT-TH-162',
  'IND-BA-110', 'IND-BA-112', 'IND-EN-114',
  'RES-CH-', 'TRA-EQ-', 'AGR-EQ-',
]

// Parse RSS 2.0 ou Atom — retourne array d'items { title, link, pubDate, description, guid }
function parseRSS(xml) {
  const items = []

  // Détecter Atom vs RSS
  const isAtom = xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"')

  const itemTag = isAtom ? 'entry' : 'item'
  const itemRegex = new RegExp(`<${itemTag}[^>]*>([\\s\\S]*?)<\\/${itemTag}>`, 'gi')
  const matches = xml.matchAll(itemRegex)

  for (const match of matches) {
    const block = match[1]
    const get = (tag, alt) => {
      const re = new RegExp(`<${tag}(?:[^>]*)>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*<\\/${tag}>`, 'i')
      const m = block.match(re)
      if (m) return m[1].trim()
      if (alt) {
        const re2 = new RegExp(`<${alt}(?:[^>]*)>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*<\\/${alt}>`, 'i')
        const m2 = block.match(re2)
        if (m2) return m2[1].trim()
      }
      return null
    }
    const getAttr = (tag, attr) => {
      const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i')
      const m = block.match(re)
      return m ? m[1].trim() : null
    }

    const title = get('title') || ''
    const link = isAtom ? getAttr('link', 'href') : (get('link') || getAttr('link', 'href'))
    const pubDate = get('pubDate') || get('published') || get('updated') || get('dc:date')
    const description = get('description') || get('summary') || get('content') || get('content:encoded') || ''
    const guid = get('guid') || get('id') || link || (title ? `title-${title.slice(0, 80)}` : null)

    if (title && guid) {
      items.push({
        title: title.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
        link: link || null,
        pubDate: pubDate ? new Date(pubDate).toISOString() : null,
        description: description.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').slice(0, 800),
        guid,
      })
    }
  }
  return items
}

// Détecte les fiches CEE mentionnées dans le titre + description
function detectFiches(text) {
  const upper = (text || '').toUpperCase()
  return FICHES_CEE_PATTERNS.filter(f => upper.includes(f.toUpperCase()))
}

// Détermine si un item est un arrêté officiel
function isArrete(item, sourceCategorie) {
  if (sourceCategorie === 'arrete') return true
  const text = (item.title + ' ' + item.description).toLowerCase()
  return text.includes('arrêté') || text.includes('arrete') || text.includes('journal officiel') || text.includes('jorf')
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  // Autoriser GET (cron Vercel) et POST (bouton manuel)
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  // Sécurité basique : vérifier token auth Supabase si POST (appel depuis UI)
  // Le cron Vercel appelle en GET sans token — on accepte les deux
  if (req.method === 'POST') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'unauthorized' })
    const { error } = await supabase.auth.getUser(token)
    if (error) return res.status(401).json({ error: 'unauthorized' })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return res.status(500).json({ error: 'missing env: SUPABASE_SERVICE_ROLE_KEY' })

  try {
    // 1. Charger toutes les sources actives
    const { data: sources, error: srcErr } = await supabase
      .from('veille_sources')
      .select('*')
      .eq('actif', true)

    if (srcErr) throw srcErr

    let itemsProcessed = 0
    const errors = []

    // 2. Pour chaque source, fetcher et parser le RSS
    for (const source of sources) {
      try {
        const response = await fetch(source.url, {
          headers: { 'User-Agent': 'PICPUS-CEE-Veille/1.0' },
          signal: AbortSignal.timeout(8000),
        })
        if (!response.ok) {
          errors.push(`${source.nom}: HTTP ${response.status}`)
          continue
        }
        const xml = await response.text()
        const items = parseRSS(xml)

        // 3. Upsert chaque item (guid = clé de dédup)
        for (const item of items) {
          const fiches = detectFiches(item.title + ' ' + item.description)
          const arrete = isArrete(item, source.categorie)

          const { error: upsertErr } = await supabase
            .from('veille_items')
            .upsert({
              guid: item.guid,
              source_nom: source.nom,
              source_categorie: arrete && source.categorie !== 'arrete' ? 'arrete' : (source.categorie || null),
              titre: item.title.slice(0, 500),
              url: item.link,
              description: item.description || null,
              fiches_impactees: fiches,
              date_publication: item.pubDate,
            }, { onConflict: 'guid', ignoreDuplicates: true })

          if (!upsertErr) itemsProcessed++
        }

        // Mettre à jour derniere_maj de la source
        await supabase.from('veille_sources').update({ derniere_maj: new Date().toISOString() }).eq('id', source.id)

      } catch (e) {
        errors.push(`${source.nom}: ${e.message}`)
      }
    }

    return res.status(200).json({ items_processed: itemsProcessed, errors: errors.length ? errors : undefined })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
