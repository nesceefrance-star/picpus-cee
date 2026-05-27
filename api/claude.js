import { createClient } from '@supabase/supabase-js'
import { setCors } from './_cors.js'

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

// Supabase client (lazy — uniquement pour les actions veille)
const getSupabase = () => createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Veille : constantes et helpers ───────────────────────────────
const FICHES_CEE_PATTERNS = [
  'BAT-TH-163', 'BAT-TH-142', 'BAT-TH-116', 'BAT-TH-164', 'BAT-TH-162',
  'IND-BA-110', 'IND-BA-112', 'IND-EN-114',
  'RES-CH-', 'TRA-EQ-', 'AGR-EQ-',
]

function parseRSS(xml) {
  const items = []
  const isAtom = xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"')
  const itemTag = isAtom ? 'entry' : 'item'
  const itemRegex = new RegExp(`<${itemTag}[^>]*>([\\s\\S]*?)<\\/${itemTag}>`, 'gi')
  for (const match of xml.matchAll(itemRegex)) {
    const block = match[1]
    const get = (tag, alt) => {
      const re = new RegExp(`<${tag}(?:[^>]*)>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*<\\/${tag}>`, 'i')
      const m = block.match(re)
      if (m) return m[1].trim()
      if (alt) { const m2 = block.match(new RegExp(`<${alt}(?:[^>]*)>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*<\\/${alt}>`, 'i')); if (m2) return m2[1].trim() }
      return null
    }
    const getAttr = (tag, attr) => { const m = block.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i')); return m ? m[1].trim() : null }
    const clean = s => (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    const title = get('title') || ''
    const link = isAtom ? getAttr('link', 'href') : (get('link') || getAttr('link', 'href'))
    const pubDate = get('pubDate') || get('published') || get('updated') || get('dc:date')
    const description = get('description') || get('summary') || get('content') || get('content:encoded') || ''
    const guid = get('guid') || get('id') || link || (title ? `title-${title.slice(0, 80)}` : null)
    if (title && guid) items.push({ title: clean(title), link: link || null, pubDate: pubDate ? new Date(pubDate).toISOString() : null, description: clean(description).slice(0, 800), guid })
  }
  return items
}

function detectFiches(text) {
  const upper = (text || '').toUpperCase()
  return FICHES_CEE_PATTERNS.filter(f => upper.includes(f.toUpperCase()))
}

function isArrete(item, sourceCategorie) {
  if (sourceCategorie === 'arrete') return true
  const text = (item.title + ' ' + item.description).toLowerCase()
  return text.includes('arrêté') || text.includes('arrete') || text.includes('journal officiel') || text.includes('jorf')
}

// ── Action : veille-fetch (GET cron + POST manuel) ────────────────
async function handleVeilleFetch(req, res) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return res.status(500).json({ error: 'missing env: SUPABASE_SERVICE_ROLE_KEY' })

  // Auth obligatoire pour POST (bouton manuel), pas pour GET (cron Vercel)
  if (req.method === 'POST') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'unauthorized' })
    const { error } = await getSupabase().auth.getUser(token)
    if (error) return res.status(401).json({ error: 'unauthorized' })
  }

  const supabase = getSupabase()
  try {
    const { data: sources, error: srcErr } = await supabase.from('veille_sources').select('*').eq('actif', true)
    if (srcErr) throw srcErr

    let itemsProcessed = 0
    const errors = []

    for (const source of sources) {
      try {
        const response = await fetch(source.url, { headers: { 'User-Agent': 'PICPUS-CEE-Veille/1.0' }, signal: AbortSignal.timeout(8000) })
        if (!response.ok) { errors.push(`${source.nom}: HTTP ${response.status}`); continue }
        const items = parseRSS(await response.text())
        for (const item of items) {
          const fiches = detectFiches(item.title + ' ' + item.description)
          const arrete = isArrete(item, source.categorie)
          const { error: upsertErr } = await supabase.from('veille_items').upsert({
            guid: item.guid, source_nom: source.nom,
            source_categorie: arrete && source.categorie !== 'arrete' ? 'arrete' : (source.categorie || null),
            titre: item.title.slice(0, 500), url: item.link, description: item.description || null,
            fiches_impactees: fiches, date_publication: item.pubDate,
          }, { onConflict: 'guid', ignoreDuplicates: true })
          if (!upsertErr) itemsProcessed++
        }
        await supabase.from('veille_sources').update({ derniere_maj: new Date().toISOString() }).eq('id', source.id)
      } catch (e) { errors.push(`${source.nom}: ${e.message}`) }
    }
    return res.status(200).json({ items_processed: itemsProcessed, errors: errors.length ? errors : undefined })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}

// ── Action : veille-summarize (POST) ─────────────────────────────
async function handleVeilleSummarize(req, res) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return res.status(500).json({ error: 'missing env: SUPABASE_SERVICE_ROLE_KEY' })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'missing env: ANTHROPIC_API_KEY' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  const supabase = getSupabase()
  const { error: authErr } = await supabase.auth.getUser(token)
  if (authErr) return res.status(401).json({ error: 'unauthorized' })

  const { item_id } = req.body
  if (!item_id) return res.status(400).json({ error: 'item_id requis' })

  const { data: item, error: itemErr } = await supabase.from('veille_items').select('*').eq('id', item_id).single()
  if (itemErr || !item) return res.status(404).json({ error: 'item non trouvé' })
  if (item.resume_ia) return res.status(200).json({ resume_ia: item.resume_ia, points_cles: item.points_cles, fiches_impactees: item.fiches_impactees || [] })

  let pageContent = item.description || ''
  if (item.url) {
    try {
      const r = await fetch(item.url, { headers: { 'User-Agent': 'PICPUS-CEE-Veille/1.0' }, signal: AbortSignal.timeout(6000) })
      const html = await r.text()
      pageContent = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000)
    } catch { /* garde description */ }
  }

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
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(15000),
    })
    if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`)
    const raw = (await claudeRes.json()).content?.[0]?.text || ''
    let parsed
    try { parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}') } catch { parsed = { resume: raw.slice(0, 300), points: [], fiches: [] } }
    const resume_ia = parsed.resume || ''
    const points_cles = parsed.points || []
    const fiches_impactees = [...new Set([...(item.fiches_impactees || []), ...(parsed.fiches || [])])]
    await supabase.from('veille_items').update({ resume_ia, points_cles, fiches_impactees }).eq('id', item_id)
    return res.status(200).json({ resume_ia, points_cles, fiches_impactees })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}

// ── Handler principal ─────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === "OPTIONS") return res.status(200).end()

  const action = req.body?.action || req.query?.action

  // GET uniquement pour le cron veille-fetch
  if (req.method === "GET") {
    if (action === 'veille-fetch') return handleVeilleFetch(req, res)
    return res.status(405).json({ error: "Method not allowed" })
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

  // ── Actions POST veille ───────────────────────────────────────
  if (action === 'veille-fetch')     return handleVeilleFetch(req, res)
  if (action === 'veille-summarize') return handleVeilleSummarize(req, res)

  // ── Proxy Lusha ───────────────────────────────────────────────
  if (action === 'lusha') {
    const LUSHA_API_KEY = process.env.LUSHA_API_KEY
    if (!LUSHA_API_KEY) return res.status(500).json({ error: 'LUSHA_API_KEY non configurée' })
    const { linkedin_url, firstName, lastName, first_name, last_name, company } = req.body
    const fn = firstName ?? first_name ?? ''
    const ln = lastName  ?? last_name  ?? ''
    const contact = { contactId: `c_${Date.now()}` }
    if (linkedin_url) contact.linkedinUrl = linkedin_url.trim()
    if (fn) contact.firstName = fn
    if (ln) contact.lastName  = ln
    if (company) contact.company = company
    try {
      const r = await fetch('https://api.lusha.com/v2/person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api_key': LUSHA_API_KEY },
        body: JSON.stringify({ contacts: [contact] }),
      })
      const data = await r.json()
      if (!r.ok) {
        const msg = data.message ?? data.error ?? (Array.isArray(data.errors) ? data.errors.join(', ') : null) ?? `Lusha HTTP ${r.status}`
        return res.status(r.status).json({ error: msg, details: data })
      }
      const contactsObj = data.contacts ?? {}
      const firstKey = Object.keys(contactsObj)[0]
      const entry = firstKey ? contactsObj[firstKey] : {}
      const c = entry.data ?? {}
      const companyData = c.companyId ? (data.companies ?? {})[String(c.companyId)] : null
      const emails = Array.isArray(c.emails) ? c.emails.filter(Boolean) : []
      const phones = Array.isArray(c.phones) ? c.phones.filter(Boolean) : (c.phoneNumbers ?? []).map(p => p.number ?? '').filter(Boolean)
      return res.status(200).json({
        emails, phones,
        linkedInUrl: c.socialLinks?.linkedin ?? linkedin_url ?? null,
        jobTitle: c.jobTitle?.title ?? null,
        firstName: c.firstName ?? fn ?? null,
        lastName: c.lastName ?? ln ?? null,
        company: companyData?.name ?? c.company ?? company ?? null,
        isCreditCharged: entry.isCreditCharged ?? null,
        _raw: data,
      })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── Proxy Anthropic (défaut) ──────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY non configurée" })
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...(req.headers["anthropic-beta"] ? { "anthropic-beta": req.headers["anthropic-beta"] } : {}),
      },
      body: JSON.stringify(req.body),
    })
    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
