// api/lusha.js — Proxy Vercel server-side pour l'API Lusha
// Lusha bloque les appels CORS directs depuis le navigateur.
import { setCors } from './_cors.js'

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const LUSHA_API_KEY = process.env.LUSHA_API_KEY
  if (!LUSHA_API_KEY) return res.status(500).json({ error: 'LUSHA_API_KEY non configurée' })

  const { linkedin_url, first_name, last_name, company } = req.body

  const endpoint = linkedin_url
    ? 'https://api.lusha.com/v2/person/linkedin'
    : 'https://api.lusha.com/v2/person'

  const body = linkedin_url
    ? { linkedin_url }
    : { first_name, last_name, company }

  try {
    const lushaRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api_key': LUSHA_API_KEY },
      body: JSON.stringify(body),
    })

    const data = await lushaRes.json()

    if (!lushaRes.ok) {
      return res.status(lushaRes.status).json({ error: data.message ?? 'Erreur Lusha', details: data })
    }

    return res.status(200).json({
      emails:       (data.emails  ?? []).map(e => e.email),
      phones:       (data.phones  ?? []).map(p => p.normalizedNumber ?? p.internationalNumber ?? '').filter(Boolean),
      linkedInUrl:  data.linkedInUrl ?? linkedin_url ?? null,
      jobTitle:     data.jobTitle    ?? null,
      companyName:  data.currentEmployer?.name ?? company,
      credits_used: data.credits_used ?? 1,
      _raw:         data,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
