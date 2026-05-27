# Veille CEE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer une page `/veille` indépendante visuellement du CRM, agrégeant automatiquement les arrêtés officiels CEE, articles de blogs spécialisés, actualités immo tertiaire/industriel et vidéos YouTube, avec résumé IA des arrêtés et détection d'impact sur les fiches CEE actives du CRM.

**Architecture:** Page React `/veille` avec son propre design sombre "magazine", branchée sur deux tables Supabase (`veille_sources`, `veille_items`). Un cron Vercel daily (7h) appelle `api/veille-fetch.js` qui parse les RSS feeds et stocke les nouveaux items. Les arrêtés ont un traitement spécial : détection de fiches CEE mentionnées + génération de résumé IA via `api/veille-summarize.js` (proxy Claude existant). Aucun fichier CRM existant n'est modifié sauf `src/router.jsx` (+1 route) et `src/components/AppSidebar.jsx` (+1 item nav).

**Tech Stack:** React 18, Zustand, Supabase JS v2, Vercel Serverless Functions + Cron, API Claude (via proxy existant `/api/claude.js`), RSS 2.0/Atom parsing (regex inline, pas de dépendance externe)

---

## Fichiers créés / modifiés

| Action | Fichier | Rôle |
|---|---|---|
| Créer | `src/pages/Veille.jsx` | Page principale — design magazine dark |
| Créer | `src/hooks/useVeille.js` | Fetch items Supabase, mark lu, toggle sauvegarde, trigger fetch |
| Créer | `api/veille-fetch.js` | Serverless — parse RSS feeds → upsert veille_items |
| Créer | `api/veille-summarize.js` | Serverless — génère résumé IA d'un arrêté via Claude |
| Modifier | `src/router.jsx` | +1 route `/veille` |
| Modifier | `src/components/AppSidebar.jsx` | +1 item nav "Veille CEE" |
| Modifier | `vercel.json` | +1 cron daily 7h → /api/veille-fetch |

---

## Migrations SQL (à exécuter dans la console Supabase AVANT tout développement)

```sql
-- Table des sources de veille
CREATE TABLE IF NOT EXISTS veille_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  url         TEXT NOT NULL,           -- URL du flux RSS
  categorie   TEXT NOT NULL,           -- 'arrete' | 'cee' | 'immo' | 'video'
  actif       BOOLEAN DEFAULT true,
  favicon     TEXT,                    -- emoji ou URL favicon
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Table des items collectés
CREATE TABLE IF NOT EXISTS veille_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_nom         TEXT NOT NULL,
  source_categorie   TEXT NOT NULL,
  titre              TEXT NOT NULL,
  url                TEXT,
  description        TEXT,
  resume_ia          TEXT,             -- résumé IA généré à la demande
  points_cles        JSONB DEFAULT '[]',  -- array de strings (5 points max)
  fiches_impactees   TEXT[] DEFAULT '{}', -- ex: ['BAT-TH-163', 'IND-BA-110']
  date_publication   TIMESTAMPTZ,
  est_lu             BOOLEAN DEFAULT false,
  est_sauvegarde     BOOLEAN DEFAULT false,
  guid               TEXT UNIQUE,      -- dedup RSS
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les queries courantes
CREATE INDEX IF NOT EXISTS idx_veille_items_categorie ON veille_items(source_categorie);
CREATE INDEX IF NOT EXISTS idx_veille_items_lu ON veille_items(est_lu);
CREATE INDEX IF NOT EXISTS idx_veille_items_date ON veille_items(date_publication DESC);
CREATE INDEX IF NOT EXISTS idx_veille_items_sauvegarde ON veille_items(est_sauvegarde);

-- Pré-remplir les sources (RSS vérifiés)
INSERT INTO veille_sources (nom, url, categorie, favicon) VALUES
  -- Arrêtés officiels
  ('Légifrance — CEE', 'https://legifrss.github.io/?q=certificats+economies+energie&type=JORFTEXT', 'arrete', '🏛️'),
  -- CEE spécialisé
  ('ATEE / Club C2E', 'https://atee.fr/rss.xml', 'cee', '⚡'),
  ('Opéra Énergie', 'https://opera-energie.com/feed/', 'cee', '🔋'),
  ('ACCIONA Energía', 'https://solutions.acciona-energia.fr/feed/', 'cee', '♻️'),
  ('Gossement Avocats', 'https://www.gossement-avocats.com/blog/feed/', 'cee', '⚖️'),
  ('Actu-Environnement', 'https://www.actu-environnement.com/rss/all.xml', 'cee', '🌱'),
  ('Hellio', 'https://www.hellio.com/blog/feed/', 'cee', '💡'),
  -- Immobilier tertiaire / industrie
  ('Business Immo', 'https://www.businessimmo.com/rss/investissement/feed.xml', 'immo', '🏗️'),
  ('CFnews Immo', 'https://www.cfnewsimmo.net/rss/feed/sitemap', 'immo', '🏢'),
  ('Batiactu', 'https://www.batiactu.com/rss/edito.php', 'immo', '🏭'),
  -- Vidéos YouTube (flux RSS natif YouTube)
  ('ADEME', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCCrFH4BNKK6YMcvFYhMiFIg', 'video', '🎥'),
  ('Ministère Transition Écologique', 'https://www.youtube.com/feeds/videos.xml?channel_id=UC_4cgz6NYbmSGQ0_OBFt3Fw', 'video', '🎥')
ON CONFLICT DO NOTHING;

-- RLS : les utilisateurs authentifiés lisent tout, écrivent leurs états lu/sauvegardé
ALTER TABLE veille_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read veille_items" ON veille_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth update veille_items" ON veille_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "auth read veille_sources" ON veille_sources FOR SELECT USING (auth.role() = 'authenticated');
```

---

## Task 1 : API — veille-fetch.js (RSS parser + upsert)

**Fichiers :**
- Créer : `api/veille-fetch.js`

Ce endpoint est appelé par le cron Vercel ET manuellement depuis la page (bouton "Actualiser").
Il parse les flux RSS de toutes les sources actives, détecte les fiches CEE mentionnées, et upsert les nouveaux items dans Supabase.

- [ ] **Créer `api/veille-fetch.js`** avec le contenu suivant :

```js
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
    const guid = get('guid') || get('id') || link || `${title}-${pubDate}`

    if (title && guid) {
      items.push({
        title: title.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'"),
        link: link || null,
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
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
    if (token) {
      const { error } = await supabase.auth.getUser(token)
      if (error) return res.status(401).json({ error: 'unauthorized' })
    }
  }

  try {
    // 1. Charger toutes les sources actives
    const { data: sources, error: srcErr } = await supabase
      .from('veille_sources')
      .select('*')
      .eq('actif', true)

    if (srcErr) throw srcErr

    let totalNew = 0
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
              source_categorie: arrete && source.categorie !== 'arrete' ? 'arrete' : source.categorie,
              titre: item.title.slice(0, 500),
              url: item.link,
              description: item.description || null,
              fiches_impactees: fiches,
              date_publication: item.pubDate,
            }, { onConflict: 'guid', ignoreDuplicates: true })

          if (!upsertErr) totalNew++
        }

        // Mettre à jour derniere_maj de la source
        await supabase.from('veille_sources').update({ derniere_maj: new Date().toISOString() }).eq('id', source.id)

      } catch (e) {
        errors.push(`${source.nom}: ${e.message}`)
      }
    }

    return res.status(200).json({ new_items: totalNew, errors: errors.length ? errors : undefined })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
```

- [ ] **Tester manuellement** depuis le terminal :
```bash
cd /Users/mi2aeli/Documents/ELI/LYVNA/AF2E/projetclaude/picpus-cee
curl -X POST http://localhost:3000/api/veille-fetch
# Attendu : { "new_items": N } — N > 0 si les sources RSS répondent
```

---

## Task 2 : API — veille-summarize.js (résumé IA des arrêtés)

**Fichiers :**
- Créer : `api/veille-summarize.js`

Appel à la demande (bouton "Générer résumé" sur un item arrêté). Récupère le texte de l'URL, appelle Claude via le proxy existant, stocke le résultat.

- [ ] **Créer `api/veille-summarize.js`** :

```js
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
  if (item.resume_ia) return res.status(200).json({ resume_ia: item.resume_ia, points_cles: item.points_cles })

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

  // 3. Appel Claude
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
    })

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
```

---

## Task 3 : Hook — useVeille.js

**Fichiers :**
- Créer : `src/hooks/useVeille.js`

- [ ] **Créer `src/hooks/useVeille.js`** :

```js
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function useVeille() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false) // trigger RSS fetch
  const [newCount, setNewCount] = useState(0)

  const fetchItems = useCallback(async ({ categorie = null, onlySaved = false, onlyUnread = false } = {}) => {
    setLoading(true)
    try {
      let q = supabase
        .from('veille_items')
        .select('*')
        .order('date_publication', { ascending: false })
        .limit(100)

      if (categorie) q = q.eq('source_categorie', categorie)
      if (onlySaved) q = q.eq('est_sauvegarde', true)
      if (onlyUnread) q = q.eq('est_lu', false)

      const { data, error } = await q
      if (error) throw error
      setItems(data || [])
      setNewCount((data || []).filter(i => !i.est_lu).length)
    } catch (e) {
      console.error('useVeille fetchItems:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const markLu = useCallback(async (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, est_lu: true } : i))
    setNewCount(prev => Math.max(0, prev - 1))
    await supabase.from('veille_items').update({ est_lu: true }).eq('id', id)
  }, [])

  const toggleSauvegarde = useCallback(async (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, est_sauvegarde: !i.est_sauvegarde } : i))
    const item = items.find(i => i.id === id)
    if (item) await supabase.from('veille_items').update({ est_sauvegarde: !item.est_sauvegarde }).eq('id', id)
  }, [items])

  const triggerFetch = useCallback(async () => {
    setFetching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/veille-fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      })
      const result = await r.json()
      if (result.new_items > 0) await fetchItems()
      return result
    } catch (e) {
      console.error('triggerFetch:', e)
    } finally {
      setFetching(false)
    }
  }, [fetchItems])

  const generateSummary = useCallback(async (itemId) => {
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/veille-summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ item_id: itemId }),
    })
    const result = await r.json()
    if (result.resume_ia) {
      setItems(prev => prev.map(i => i.id === itemId
        ? { ...i, resume_ia: result.resume_ia, points_cles: result.points_cles, fiches_impactees: result.fiches_impactees }
        : i
      ))
    }
    return result
  }, [])

  return { items, loading, fetching, newCount, fetchItems, markLu, toggleSauvegarde, triggerFetch, generateSummary }
}
```

---

## Task 4 : Page — Veille.jsx

**Fichiers :**
- Créer : `src/pages/Veille.jsx`

Design "magazine" sombre, complètement différent du CRM. Mobile-first.
Palette propre à cette page (pas le `C` du CRM).

- [ ] **Créer `src/pages/Veille.jsx`** :

```jsx
import { useEffect, useState, useCallback } from 'react'
import useVeille from '../hooks/useVeille'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'

// Palette propre à la Veille — indépendante du thème CRM
const V = {
  bg:       '#080D19',
  card:     '#0F172A',
  cardHov:  '#1A2235',
  border:   '#1E2D45',
  text:     '#F1F5F9',
  textMid:  '#94A3B8',
  textSoft: '#475569',
  // Couleurs par catégorie
  arrete:   '#EF4444',
  cee:      '#F97316',
  immo:     '#10B981',
  video:    '#8B5CF6',
}

const CAT_LABELS = { arrete: 'Arrêté', cee: 'CEE', immo: 'Immo', video: 'Vidéo' }
const CAT_EMOJI  = { arrete: '🚨', cee: '📰', immo: '🏗️', video: '🎥' }
const TABS = [
  { key: null,     label: 'Tout' },
  { key: 'arrete', label: '🚨 Arrêtés' },
  { key: 'cee',    label: '📰 CEE' },
  { key: 'immo',   label: '🏗️ Immo' },
  { key: 'video',  label: '🎥 Vidéos' },
  { key: '__saved',label: '🔖 Sauvegardés' },
]

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1) return 'Il y a moins d\'1h'
  if (h < 24) return `Il y a ${h}h`
  if (d < 7) return `Il y a ${d}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// Carte arrêté — affichage spécial avec impact dossiers
function ArreteCard({ item, dossierFiches, onOpen, onToggleSave }) {
  const color = V.arrete
  const hasImpact = item.fiches_impactees?.some(f => dossierFiches.includes(f))
  const isNew = !item.est_lu

  return (
    <div
      onClick={() => onOpen(item)}
      style={{
        background: V.card,
        border: `1px solid ${isNew ? color : V.border}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        marginBottom: 10,
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
          🚨 Arrêté officiel
        </span>
        {isNew && (
          <span style={{ fontSize: 10, fontWeight: 700, background: color, color: '#fff', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
            NOUVEAU
          </span>
        )}
        <span style={{ fontSize: 11, color: V.textSoft, marginLeft: 'auto', flexShrink: 0 }}>
          {timeAgo(item.date_publication)}
        </span>
      </div>

      {/* Titre */}
      <div style={{ fontSize: 14, fontWeight: 600, color: V.text, lineHeight: 1.4, marginBottom: 8 }}>
        {item.titre}
      </div>

      {/* Impact dossiers */}
      {hasImpact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
          <span style={{ fontSize: 12 }}>⚡</span>
          <span style={{ fontSize: 12, color: '#FCA5A5', fontWeight: 600 }}>
            Impact sur tes dossiers : {item.fiches_impactees.filter(f => dossierFiches.includes(f)).join(', ')}
          </span>
        </div>
      )}

      {/* Fiches mentionnées */}
      {item.fiches_impactees?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {item.fiches_impactees.map(f => (
            <span key={f} style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: V.textSoft }}>{item.source_nom}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: V.arrete, fontWeight: 600 }}>Voir résumé →</span>
          <button
            onClick={e => { e.stopPropagation(); onToggleSave(item.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: item.est_sauvegarde ? 1 : 0.4 }}
          >🔖</button>
        </div>
      </div>
    </div>
  )
}

// Carte générique (articles, vidéos, immo)
function ItemCard({ item, onOpen, onToggleSave }) {
  const color = V[item.source_categorie] || V.cee
  const isNew = !item.est_lu

  return (
    <div
      onClick={() => onOpen(item)}
      style={{
        background: V.card,
        border: `1px solid ${isNew ? color + '60' : V.border}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        padding: '12px 14px',
        cursor: 'pointer',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase' }}>
          {CAT_EMOJI[item.source_categorie]} {CAT_LABELS[item.source_categorie] || item.source_categorie}
        </span>
        {isNew && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />}
        <span style={{ fontSize: 11, color: V.textSoft, marginLeft: 'auto' }}>{timeAgo(item.date_publication)}</span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: V.text, lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {item.titre}
      </div>

      {item.description && (
        <div style={{ fontSize: 12, color: V.textMid, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 6 }}>
          {item.description}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: V.textSoft }}>{item.source_nom}</span>
        <button
          onClick={e => { e.stopPropagation(); onToggleSave(item.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: item.est_sauvegarde ? 1 : 0.35 }}
        >🔖</button>
      </div>
    </div>
  )
}

// Modal détail d'un item
function ItemModal({ item, onClose, onGenerateSummary, dossierFiches, generating }) {
  if (!item) return null
  const color = V[item.source_categorie] || V.cee
  const hasImpact = item.fiches_impactees?.some(f => dossierFiches.includes(f))

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111827',
          border: `1px solid ${V.border}`,
          borderRadius: '16px 16px 0 0',
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '20px 20px 40px',
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: V.textSoft, borderRadius: 2, margin: '0 auto 16px' }} />

        {/* Catégorie + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>
            {CAT_EMOJI[item.source_categorie]} {CAT_LABELS[item.source_categorie]}
          </span>
          <span style={{ fontSize: 11, color: V.textSoft }}>
            {item.source_nom} · {item.date_publication ? new Date(item.date_publication).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
          </span>
        </div>

        {/* Titre */}
        <div style={{ fontSize: 17, fontWeight: 700, color: V.text, lineHeight: 1.4, marginBottom: 16 }}>
          {item.titre}
        </div>

        {/* Impact dossiers */}
        {hasImpact && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#FCA5A5', marginBottom: 4 }}>⚡ Impact sur tes dossiers actifs</div>
            <div style={{ fontSize: 12, color: '#FECACA' }}>
              Les fiches {item.fiches_impactees.filter(f => dossierFiches.includes(f)).join(', ')} de tes dossiers en cours sont concernées par cet arrêté.
            </div>
          </div>
        )}

        {/* Fiches CEE concernées */}
        {item.fiches_impactees?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: V.textSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Fiches CEE concernées</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {item.fiches_impactees.map(f => (
                <span key={f} style={{ fontSize: 11, background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', borderRadius: 6, padding: '3px 8px', fontWeight: 600 }}>{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Résumé IA */}
        {item.resume_ia ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: V.textSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>📋 Résumé</div>
            <div style={{ fontSize: 13, color: V.textMid, lineHeight: 1.6, marginBottom: 12 }}>{item.resume_ia}</div>
            {item.points_cles?.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: V.textSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Points clés</div>
                {item.points_cles.map((pt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0, minWidth: 20 }}>{i + 1}.</span>
                    <span style={{ fontSize: 13, color: V.text, lineHeight: 1.5 }}>{pt}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : item.description ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: V.textSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Description</div>
            <div style={{ fontSize: 13, color: V.textMid, lineHeight: 1.6 }}>{item.description}</div>
          </div>
        ) : null}

        {/* Bouton générer résumé (arrêtés sans résumé) */}
        {item.source_categorie === 'arrete' && !item.resume_ia && (
          <button
            onClick={() => onGenerateSummary(item.id)}
            disabled={generating}
            style={{
              width: '100%', padding: '12px', background: color, color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.7 : 1, marginBottom: 12, fontFamily: 'inherit',
            }}
          >
            {generating ? '⏳ Génération en cours…' : '✨ Générer le résumé IA'}
          </button>
        )}

        {/* Liens */}
        <div style={{ display: 'flex', gap: 10 }}>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              style={{ flex: 1, display: 'block', textAlign: 'center', padding: '10px', background: V.border, color: V.text, borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            >
              📄 Voir l'article complet
            </a>
          )}
          <button
            onClick={onClose}
            style={{ padding: '10px 16px', background: 'transparent', color: V.textMid, border: `1px solid ${V.border}`, borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Veille() {
  const { items, loading, fetching, newCount, fetchItems, markLu, toggleSauvegarde, triggerFetch, generateSummary } = useVeille()
  const { dossiers } = useStore()
  const [activeTab, setActiveTab] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [generating, setGenerating] = useState(false)

  // Fiches CEE actives dans les dossiers du CRM
  const dossierFiches = [...new Set(dossiers.map(d => d.fiche_cee).filter(Boolean))]

  useEffect(() => {
    const opts = activeTab === '__saved'
      ? { onlySaved: true }
      : { categorie: activeTab }
    fetchItems(opts)
  }, [activeTab])

  const handleOpen = useCallback(async (item) => {
    setSelectedItem(item)
    if (!item.est_lu) markLu(item.id)
  }, [markLu])

  const handleGenerateSummary = useCallback(async (itemId) => {
    setGenerating(true)
    const result = await generateSummary(itemId)
    if (result?.resume_ia) {
      setSelectedItem(prev => prev ? { ...prev, ...result } : prev)
    }
    setGenerating(false)
  }, [generateSummary])

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ minHeight: '100vh', background: V.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>

      {/* Header */}
      <div style={{ background: '#0A0F1E', borderBottom: `1px solid ${V.border}`, padding: '16px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: V.textSoft, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
                {today}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: V.text, letterSpacing: '-0.02em' }}>
                📡 Veille CEE
                {newCount > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, background: V.arrete, color: '#fff', borderRadius: 10, padding: '2px 8px' }}>
                    {newCount} nouveau{newCount > 1 ? 'x' : ''}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={triggerFetch}
              disabled={fetching}
              title="Actualiser les sources"
              style={{
                background: fetching ? V.border : '#1E293B',
                border: `1px solid ${V.border}`,
                color: V.textMid,
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                cursor: fetching ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                fontWeight: 600,
              }}
            >
              {fetching ? '⏳' : '🔄'} {fetching ? 'Actualisation…' : 'Actualiser'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs filtres */}
      <div style={{ background: '#0A0F1E', borderBottom: `1px solid ${V.border}`, overflowX: 'auto', position: 'sticky', top: 72, zIndex: 99 }}>
        <div style={{ display: 'flex', gap: 2, padding: '0 16px', maxWidth: 680, margin: '0 auto', minWidth: 'max-content' }}>
          {TABS.map(tab => (
            <button
              key={tab.key || 'all'}
              onClick={() => setActiveTab(tab.key === '__saved' ? '__saved' : tab.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === (tab.key === '__saved' ? '__saved' : tab.key) ? `2px solid ${V.text}` : '2px solid transparent',
                color: activeTab === (tab.key === '__saved' ? '__saved' : tab.key) ? V.text : V.textSoft,
                padding: '12px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                transition: 'color .15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 12px 80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: V.textSoft }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Chargement…</div>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, color: V.textMid, marginBottom: 8 }}>Aucun article pour l'instant</div>
            <div style={{ fontSize: 13, color: V.textSoft, marginBottom: 20 }}>Lance une première actualisation pour charger les sources</div>
            <button
              onClick={triggerFetch}
              disabled={fetching}
              style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {fetching ? '⏳ Chargement…' : '🔄 Charger les actualités'}
            </button>
          </div>
        ) : (
          items.map(item =>
            item.source_categorie === 'arrete' ? (
              <ArreteCard
                key={item.id}
                item={item}
                dossierFiches={dossierFiches}
                onOpen={handleOpen}
                onToggleSave={toggleSauvegarde}
              />
            ) : (
              <ItemCard
                key={item.id}
                item={item}
                onOpen={handleOpen}
                onToggleSave={toggleSauvegarde}
              />
            )
          )
        )}
      </div>

      {/* Modal détail */}
      {selectedItem && (
        <ItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onGenerateSummary={handleGenerateSummary}
          dossierFiches={dossierFiches}
          generating={generating}
        />
      )}
    </div>
  )
}
```

---

## Task 5 : Branchement — Router + Sidebar

**Fichiers :**
- Modifier : `src/router.jsx` (1 import + 1 route)
- Modifier : `src/components/AppSidebar.jsx` (1 import icon + 1 Item)

- [ ] **Dans `src/router.jsx`** — ajouter l'import et la route :

Ajouter après la ligne `import ExportMapping from './pages/ExportMapping'` :
```jsx
import Veille from './pages/Veille'
```

Ajouter avant `<Route path="/rapport/:token"` :
```jsx
<Route path="/veille" element={<WithLayout><Veille /></WithLayout>} />
```

- [ ] **Dans `src/components/AppSidebar.jsx`** — ajouter l'icône et l'item nav :

Ajouter dans les imports MUI Icons (après la ligne `import TableChartIcon...`) :
```jsx
import CellTowerIcon from '@mui/icons-material/CellTower'
```

Ajouter dans la `<List>` après l'item "Export personnalisé" (avant le premier `<Divider>`) :
```jsx
<Item icon={<CellTowerIcon fontSize="small" />} label="Veille CEE" path="/veille" />
```

---

## Task 6 : Cron Vercel — actualisation quotidienne

**Fichiers :**
- Modifier : `vercel.json`

- [ ] **Remplacer `vercel.json`** par :

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)",     "destination": "/index.html" }
  ],
  "crons": [
    {
      "path": "/api/veille-fetch",
      "schedule": "0 7 * * *"
    }
  ]
}
```

> **Note** : Les crons Vercel sont disponibles sur tous les plans (Hobby : 2 crons max). Le cron appelle `/api/veille-fetch` en GET chaque jour à 7h UTC (9h heure de Paris en été).

---

## Checklist de validation finale

Après l'implémentation complète, vérifier dans l'ordre :

- [ ] Page `/veille` accessible et design sombre bien affiché
- [ ] Bouton "Actualiser" → items chargés depuis au moins 2-3 sources
- [ ] Items catégorie "arrete" → `ArreteCard` avec bordure rouge
- [ ] Items autres catégories → `ItemCard` avec couleur par catégorie
- [ ] Badge "NOUVEAU" sur les items non lus, disparaît au clic
- [ ] Onglets filtres → filtre bien le feed
- [ ] Onglet "Sauvegardés" → affiche uniquement les bookmarkés
- [ ] Modal → s'ouvre au tap, handle en haut, se ferme sur overlay
- [ ] Bouton "Générer résumé IA" sur un arrêté → résumé + 5 points s'affichent
- [ ] Badge "⚡ Impact sur tes dossiers" → présent si fiches du dossier correspondent
- [ ] Mobile : tabs scrollables horizontalement, cards lisibles, modal bottom sheet
- [ ] Nav sidebar → item "Veille CEE" présent et route fonctionnelle
