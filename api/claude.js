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
    const fn = firstName ?? first_name ?? ''
    const ln = lastName  ?? last_name  ?? ''

    // Lusha v2 bulk — contactId obligatoire, champ linkedin = linkedinUrl (minuscule)
    const contact = { contactId: `c_${Date.now()}` }
    if (linkedin_url)   contact.linkedinUrl = linkedin_url.trim()
    if (fn)             contact.firstName   = fn
    if (ln)             contact.lastName    = ln
    if (company)        contact.company     = company

    try {
      const r = await fetch('https://api.lusha.com/v2/person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api_key': LUSHA_API_KEY },
        body: JSON.stringify({ contacts: [contact] }),
      })
      const data = await r.json()
      if (!r.ok) {
        const msg = data.message ?? data.error
          ?? (Array.isArray(data.errors) ? data.errors.join(', ') : null)
          ?? `Lusha HTTP ${r.status}`
        return res.status(r.status).json({ error: msg, details: data })
      }
      // Lusha v2 : contacts est un objet { contactId: { error, isCreditCharged, data: {...} } }
      const contactsObj = data.contacts ?? {}
      const firstKey    = Object.keys(contactsObj)[0]
      const entry       = firstKey ? contactsObj[firstKey] : {}
      const c           = entry.data ?? {}
      const companyId   = c.companyId
      const companyData = companyId ? (data.companies ?? {})[String(companyId)] : null

      // emails / phones : déjà des tableaux de strings dans Lusha v2
      const emails = Array.isArray(c.emails) ? c.emails.filter(Boolean) : []
      const phones = Array.isArray(c.phones) ? c.phones.filter(Boolean)
        : (c.phoneNumbers ?? []).map(p => p.number ?? '').filter(Boolean)

      return res.status(200).json({
        emails,
        phones,
        linkedInUrl:  c.socialLinks?.linkedin ?? linkedin_url ?? null,
        jobTitle:     c.jobTitle?.title ?? null,
        firstName:    c.firstName  ?? fn ?? null,
        lastName:     c.lastName   ?? ln ?? null,
        company:      companyData?.name ?? c.company ?? company ?? null,
        isCreditCharged: entry.isCreditCharged ?? null,
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
