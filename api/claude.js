import { setCors } from './_cors.js'

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Proxy Lusha (action=lusha dans le body) ───────────────────
  if (req.body?.action === 'lusha') {
    const LUSHA_API_KEY = process.env.LUSHA_API_KEY
    if (!LUSHA_API_KEY) return res.status(500).json({ error: 'LUSHA_API_KEY non configurée' })
    const { linkedin_url, first_name, last_name, company } = req.body
    const endpoint = linkedin_url ? 'https://api.lusha.com/v2/person/linkedin' : 'https://api.lusha.com/v2/person'
    const body = linkedin_url ? { linkedin_url } : { first_name, last_name, company }
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api_key': LUSHA_API_KEY },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data.message ?? 'Erreur Lusha', details: data })
      return res.status(200).json({
        emails:       (data.emails  ?? []).map(e => e.email),
        phones:       (data.phones  ?? []).map(p => p.normalizedNumber ?? p.internationalNumber ?? '').filter(Boolean),
        linkedInUrl:  data.linkedInUrl ?? linkedin_url ?? null,
        jobTitle:     data.jobTitle    ?? null,
        companyName:  data.currentEmployer?.name ?? company,
        credits_used: data.credits_used ?? 1,
        _raw:         data,
      })
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  // ── Proxy Anthropic (défaut) ──────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY non configurée" });

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
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
