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
    const { linkedin_url, firstName, lastName, first_name, last_name, company } = req.body
    const endpoint = 'https://api.lusha.com/v2/person'
    const contact = {}
    if (linkedin_url) contact.linkedInUrl = linkedin_url
    if (firstName  || first_name)  contact.firstName = firstName  ?? first_name
    if (lastName   || last_name)   contact.lastName  = lastName   ?? last_name
    if (company) contact.company = company
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api_key': LUSHA_API_KEY },
        body: JSON.stringify({ contacts: [contact] }),
      })
      const data = await r.json()
      if (!r.ok) return res.status(r.status).json({ error: data.message ?? data.error ?? 'Erreur Lusha', details: data })
      // Lusha v2 renvoie { contacts: [{ emails, phones, ... }] }
      const c = data.contacts?.[0] ?? data
      return res.status(200).json({
        emails:       (c.emails  ?? []).map(e => e.email ?? e).filter(Boolean),
        phones:       (c.phones  ?? []).map(p => p.normalizedNumber ?? p.internationalNumber ?? p.number ?? '').filter(Boolean),
        linkedInUrl:  c.linkedInUrl ?? linkedin_url ?? null,
        jobTitle:     c.jobTitle    ?? null,
        firstName:    c.firstName   ?? firstName ?? first_name ?? null,
        lastName:     c.lastName    ?? lastName  ?? last_name  ?? null,
        company:      c.currentEmployer?.name ?? c.company ?? company ?? null,
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
