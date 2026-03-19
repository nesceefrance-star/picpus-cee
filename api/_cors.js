// api/_cors.js — Helper CORS commun (préfixe _ = non exposé comme route Vercel)
const ALLOWED = [
  'https://picpus-cee.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

export function setCors(req, res) {
  const origin = req.headers.origin
  if (ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE')
  res.setHeader('Vary', 'Origin')
}
