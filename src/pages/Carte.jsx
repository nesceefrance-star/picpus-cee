import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import useStore from '../store/useStore'
import { useBreakpoint } from '../lib/useBreakpoint'

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Constantes ────────────────────────────────────────────────────────────────
const STATUTS = [
  { id: 'simulation',       label: 'Simulation',        color: '#7C3AED' },
  { id: 'prospect',         label: 'Prospect',           color: '#0369A1' },
  { id: 'contacte',         label: 'Contacté',           color: '#0891B2' },
  { id: 'visio_planifiee',  label: 'Visio planifiée',    color: '#0D9488' },
  { id: 'visio_effectuee',  label: 'Visio effectuée',    color: '#059669' },
  { id: 'visite_planifiee', label: 'Visite planifiée',   color: '#D97706' },
  { id: 'visite_effectuee', label: 'Visite effectuée',   color: '#EA580C' },
  { id: 'devis',            label: 'Devis envoyé',       color: '#7C3AED' },
  { id: 'ah',               label: 'AH signé',           color: '#16A34A' },
  { id: 'conforme',         label: 'Conforme',           color: '#15803D' },
  { id: 'facture',          label: 'Facturé',            color: '#64748B' },
  { id: 'perdu',            label: 'Marché perdu',       color: '#DC2626' },
]

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

const FICHE_LABELS = {
  'BAT-TH-116': 'GTB', 'BAT-TH-163': 'PAC Tertiaire', 'BAT-TH-142': 'Destrat Tertiaire',
  'IND-BA-110': 'Destrat Industrie', 'BAT-TH-125': 'VMC Simple', 'BAT-TH-126': 'VMC Double',
}

const OFFICE_ADDRESS = '80 Boulevard de Picpus, 75012 Paris'

// Cache module-level : clé = "dossierId:adresse" pour invalider si l'adresse change
const geoCache = new Map()

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m} min`
}

function fmtDist(meters) {
  if (!meters) return '—'
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

// ── Google Maps Directions API — voiture ─────────────────────────────────────
async function getGoogleRoute(olat, olng, dlat, dlng, unixDeparture) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key) return null
  try {
    const params = new URLSearchParams({
      origin:         `${olat},${olng}`,
      destination:    `${dlat},${dlng}`,
      mode:           'driving',
      departure_time: unixDeparture || 'now',
      traffic_model:  'best_guess',
      key,
    })
    const r = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`)
    const d = await r.json()
    if (d.status !== 'OK') return null
    const leg = d.routes[0].legs[0]
    return {
      duration: leg.duration_in_traffic?.value ?? leg.duration.value,
      distance: leg.distance.value,
      source: 'google',
    }
  } catch { return null }
}

// ── OSRM fallback (voiture, sans clé Google) ─────────────────────────────────
async function getOsrmRoute(olat, olng, dlat, dlng) {
  try {
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${olng},${olat};${dlng},${dlat}?overview=false`
    )
    const d = await r.json()
    if (d.code !== 'Ok' || !d.routes?.[0]) return null
    return { duration: d.routes[0].duration, distance: d.routes[0].distance, source: 'osrm' }
  } catch { return null }
}

// ── Google Maps Directions API — transit (train) ──────────────────────────────
const TRAIN_VEHICLE_TYPES = new Set([
  'HEAVY_RAIL', 'HIGH_SPEED_TRAIN', 'COMMUTER_TRAIN', 'RAIL',
  'LONG_DISTANCE_TRAIN', 'INTERCITY_BUS',
])

async function getGoogleTransit(olat, olng, dlat, dlng, unixTime, isArrival) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key) return { noKey: true }
  try {
    const params = new URLSearchParams({
      origin:       `${olat},${olng}`,
      destination:  `${dlat},${dlng}`,
      mode:         'transit',
      transit_mode: 'rail',
      key,
    })
    if (isArrival) params.set('arrival_time', unixTime)
    else           params.set('departure_time', unixTime || Math.floor(Date.now() / 1000))

    const r = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`)
    const d = await r.json()
    if (d.status !== 'OK' || !d.routes?.[0]) return null

    const leg = d.routes[0].legs[0]
    const steps = leg.steps || []

    const transitSteps = steps.filter(s => s.travel_mode === 'TRANSIT')
    if (!transitSteps.length) return null

    // Chercher les étapes train (hors metro/bus)
    const trainSteps = transitSteps.filter(s =>
      TRAIN_VEHICLE_TYPES.has(s.transit_details?.line?.vehicle?.type)
    )
    const mainSteps = trainSteps.length ? trainSteps : transitSteps

    const first = transitSteps[0]
    const last  = transitSteps[transitSteps.length - 1]

    // Ligne principale (TGV, TER, Intercités…)
    const mainLine = mainSteps[0]?.transit_details
    const lineName = mainLine?.line?.short_name || mainLine?.line?.name || null

    return {
      duration:      leg.duration.value,
      transfers:     transitSteps.length - 1,
      departStation: first?.transit_details?.departure_stop?.name || null,
      arriveStation: last?.transit_details?.arrival_stop?.name   || null,
      departTime:    first?.transit_details?.departure_time?.text || null,
      arriveTime:    last?.transit_details?.arrival_time?.text   || null,
      lineName,
      source: 'google',
    }
  } catch { return null }
}

// ── Icône colorée custom ──────────────────────────────────────────────────────
function createColoredIcon(color, size = 22) {
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:2.5px solid white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 2px 8px rgba(0,0,0,.35);
    "></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -(size + 4)],
  })
}

// ── Composant FlyTo ───────────────────────────────────────────────────────────
function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, 14, { duration: 1 })
  }, [target])
  return null
}

// ── Géocodage BAN ─────────────────────────────────────────────────────────────
async function geocodeDossier(dossierId, addr) {
  if (!addr?.trim()) return null
  const cacheKey = `${dossierId}:${addr.trim().toLowerCase()}`
  if (geoCache.has(cacheKey)) return geoCache.get(cacheKey)
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(addr)}&limit=1`)
    const d = await r.json()
    const f = d.features?.[0]
    const result = f ? [f.geometry.coordinates[1], f.geometry.coordinates[0]] : null
    geoCache.set(cacheKey, result)
    return result
  } catch { return null }
}

async function geocodeBatch(dossiers) {
  const BATCH = 6
  const results = {}
  for (let i = 0; i < dossiers.length; i += BATCH) {
    const slice = dossiers.slice(i, i + BATCH)
    const resolved = await Promise.all(slice.map(async d => {
      const coords = await geocodeDossier(d.id, d.adresse_site)
      return [d.id, coords]
    }))
    for (const [id, c] of resolved) { if (c) results[id] = c }
  }
  return results
}

// ── Panneau Itinéraire ────────────────────────────────────────────────────────
function ItinerairePanel({ dossier, destCoords, onClose, isMobile }) {
  const now = new Date()
  const [origin,       setOrigin]       = useState('')
  const [suggestions,  setSuggestions]  = useState([])
  const [showSugg,     setShowSugg]     = useState(false)
  const [originCoords, setOriginCoords] = useState(null)
  const [date,         setDate]         = useState(now.toISOString().slice(0, 10))
  const [time,         setTime]         = useState(
    `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  )
  const [timeType,     setTimeType]     = useState('depart')
  const [car,          setCar]          = useState(null)   // { duration, distance, source }
  const [train,        setTrain]        = useState(null)   // navitia result
  const [loadingCar,   setLoadingCar]   = useState(false)
  const [loadingTrain, setLoadingTrain] = useState(false)
  const suggTimeout = useRef(null)

  const hasGoogleKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  // Construit le unix timestamp pour les APIs
  const getUnix = () => {
    const dt = new Date(`${date}T${time}:00`)
    return Math.floor(dt.getTime() / 1000)
  }

  const handleOriginInput = (val) => {
    setOrigin(val)
    setOriginCoords(null)
    setCar(null); setTrain(null)
    clearTimeout(suggTimeout.current)
    if (val.length < 3) { setSuggestions([]); setShowSugg(false); return }
    suggTimeout.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(val)}&limit=5`)
        const d = await r.json()
        setSuggestions(d.features || [])
        setShowSugg(true)
      } catch {}
    }, 300)
  }

  const selectSuggestion = (feat) => {
    setOrigin(feat.properties.label)
    setOriginCoords({ lat: feat.geometry.coordinates[1], lng: feat.geometry.coordinates[0] })
    setSuggestions([])
    setShowSugg(false)
  }

  // Pré-remplir avec l'adresse du bureau
  const fillOffice = () => {
    handleOriginInput(OFFICE_ADDRESS)
    // Géocode direct sans attendre la frappe
    clearTimeout(suggTimeout.current)
    fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(OFFICE_ADDRESS)}&limit=1`)
      .then(r => r.json())
      .then(d => {
        const f = d.features?.[0]
        if (f) {
          setOrigin(f.properties.label)
          setOriginCoords({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] })
          setSuggestions([])
        }
      })
      .catch(() => {})
  }

  const calculate = async (oc = originCoords) => {
    if (!oc || !destCoords) return
    const unix      = getUnix()
    const isArrival = timeType === 'arrivee'

    // ── Voiture (parallèle avec transit) ──
    setLoadingCar(true)
    setLoadingTrain(true)

    const [carResult, trainResult] = await Promise.all([
      // Voiture : Google si clé dispo, OSRM sinon
      (async () => {
        if (hasGoogleKey) {
          const g = await getGoogleRoute(oc.lat, oc.lng, destCoords[0], destCoords[1], isArrival ? undefined : unix)
          if (g) return g
        }
        return getOsrmRoute(oc.lat, oc.lng, destCoords[0], destCoords[1])
      })(),
      // Train : Google Transit (même clé)
      getGoogleTransit(oc.lat, oc.lng, destCoords[0], destCoords[1], unix, isArrival),
    ])

    setCar(carResult)
    setLoadingCar(false)
    setTrain(trainResult)
    setLoadingTrain(false)
  }

  useEffect(() => {
    if (originCoords && destCoords) calculate(originCoords)
  }, [originCoords])

  const gmapsUrl = (mode) => {
    const orig = origin ? encodeURIComponent(origin) : ''
    const dest = dossier.adresse_site ? encodeURIComponent(dossier.adresse_site) : ''
    return `https://www.google.com/maps/dir/?api=1&origin=${orig}&destination=${dest}&travelmode=${mode}`
  }

  const sncfUrl = () => {
    const from = train?.departStation ? encodeURIComponent(train.departStation) : ''
    const to   = train?.arriveStation ? encodeURIComponent(train.arriveStation) : ''
    const d    = date || ''
    if (from && to) {
      return `https://www.sncf-connect.com/app/home/shop/search?from=${from}&to=${to}&date=${d}&passengers=1`
    }
    return 'https://www.sncf-connect.com'
  }

  const statut = STATUTS.find(s => s.id === dossier.statut) || { label: dossier.statut, color: C.textSoft }

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0,
      width: isMobile ? '100%' : 340,
      height: '100%',
      background: C.surface,
      borderLeft: `1px solid ${C.border}`,
      zIndex: 1000,
      display: 'flex', flexDirection: 'column',
      boxShadow: '-6px 0 28px rgba(0,0,0,.14)',
      fontFamily: "system-ui,'Segoe UI',Arial,sans-serif",
    }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, background: '#F8FAFC' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>🧭 Itinéraire</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {dossier.prospects?.raison_sociale || dossier.ref}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: C.textSoft, padding: '0 0 0 10px', lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: statut.color, background: statut.color + '18', border: `1px solid ${statut.color}44`, borderRadius: 10, padding: '2px 7px', flexShrink: 0 }}>
            {statut.label}
          </span>
          <div style={{ fontSize: 10, color: C.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📍 {dossier.adresse_site || '—'}
          </div>
        </div>
      </div>

      {/* ── Corps scrollable ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Origine */}
        <div style={{ marginBottom: 10, position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Départ depuis
          </div>
          {/* Bouton Bureau */}
          <button
            onClick={fillOffice}
            style={{
              width: '100%', marginBottom: 6,
              background: '#EFF6FF', border: '1.5px solid #BFDBFE',
              borderRadius: 7, padding: '7px 10px',
              fontSize: 11, fontWeight: 700, color: '#1D4ED8',
              cursor: 'pointer', fontFamily: 'inherit',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            🏢 <span>Bureau — 80 Bd de Picpus, 75012 Paris</span>
          </button>
          <input
            value={origin}
            onChange={e => handleOriginInput(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 220)}
            placeholder="Ou saisir une autre adresse…"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: C.bg, border: `1.5px solid ${C.border}`,
              borderRadius: 8, padding: '9px 11px', fontSize: 12,
              color: C.text, fontFamily: 'inherit', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = C.accent }}
            onBlur={e => { e.target.style.borderColor = C.border }}
          />
          {showSugg && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.12)',
              zIndex: 20, overflow: 'hidden',
            }}>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onMouseDown={() => selectSuggestion(s)}
                  style={{ padding: '9px 12px', fontSize: 12, color: C.text, cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? `1px solid ${C.border}` : 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.bg }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.surface }}
                >
                  <div style={{ fontWeight: 600 }}>{s.properties.name}</div>
                  <div style={{ fontSize: 10, color: C.textSoft }}>{s.properties.postcode} {s.properties.city}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Date & Heure */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Date & heure
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ flex: 1, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: C.text, fontFamily: 'inherit', outline: 'none' }} />
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              style={{ flex: '0 0 96px', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: C.text, fontFamily: 'inherit', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 3 }}>
            {[['depart', '↗ Départ'], ['arrivee', '↙ Arrivée']].map(([val, lbl]) => (
              <button key={val} onClick={() => setTimeType(val)} style={{
                flex: 1, background: timeType === val ? C.accent : 'transparent',
                color: timeType === val ? '#fff' : C.textMid,
                border: 'none', borderRadius: 6, padding: '6px 0',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
              }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* ── Carte Voiture ── */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            🚗 Voiture
          </div>
          <div style={{
            background: car ? '#F0FDF4' : C.bg,
            border: `1.5px solid ${car ? '#86EFAC' : C.border}`,
            borderRadius: 10, padding: '14px 14px 12px',
          }}>
            {loadingCar ? (
              <div style={{ textAlign: 'center', color: C.textSoft, fontSize: 12, padding: '8px 0' }}>Calcul en cours…</div>
            ) : car ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#16A34A', lineHeight: 1 }}>
                    {fmtDuration(car.duration)}
                  </div>
                  <div style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }}>{fmtDist(car.distance)}</div>
                  {car.source === 'osrm' && (
                    <div style={{ fontSize: 9, color: C.textSoft, marginTop: 3, fontStyle: 'italic' }}>
                      estimatif · sans trafic
                      {!hasGoogleKey && <span> · <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>activer Google Maps</a></span>}
                    </div>
                  )}
                  {car.source === 'google' && (
                    <div style={{ fontSize: 9, color: '#16A34A', marginTop: 3 }}>✓ trafic temps réel Google</div>
                  )}
                </div>
                <a href={gmapsUrl('driving')} target="_blank" rel="noopener noreferrer"
                  style={{ flexShrink: 0, background: '#16A34A', color: '#fff', borderRadius: 7, padding: '8px 12px', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>
                  Maps →
                </a>
              </div>
            ) : originCoords ? (
              <div style={{ textAlign: 'center', color: '#DC2626', fontSize: 12 }}>Itinéraire indisponible</div>
            ) : (
              <div style={{ textAlign: 'center', color: C.textSoft, fontSize: 12 }}>Saisissez une adresse de départ</div>
            )}
          </div>
        </div>

        {/* ── Carte Train ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            🚄 Train / Transports
          </div>
          <div style={{
            background: train && !train.noKey ? '#EFF6FF' : C.bg,
            border: `1.5px solid ${train && !train.noKey && !loadingTrain ? '#93C5FD' : C.border}`,
            borderRadius: 10, padding: '14px 14px 12px',
          }}>
            {!hasGoogleKey ? (
              <div style={{ fontSize: 11, color: C.textMid, lineHeight: 1.5 }}>
                🔑 Clé <code>VITE_GOOGLE_MAPS_API_KEY</code> non configurée.
                <div style={{ marginTop: 4, fontSize: 10, color: C.textSoft }}>
                  Ajouter la clé dans .env et Vercel Dashboard.
                </div>
              </div>
            ) : loadingTrain ? (
              <div style={{ textAlign: 'center', color: C.textSoft, fontSize: 12, padding: '8px 0' }}>Recherche trajets…</div>
            ) : train && !train.noKey ? (
              <div>
                {/* Durée + correspondances + horaires */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: C.accent, lineHeight: 1 }}>
                      {fmtDuration(train.duration)}
                    </div>
                    <div style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }}>
                      {train.transfers === 0 ? 'Direct' : `${train.transfers} correspondance${train.transfers > 1 ? 's' : ''}`}
                      {train.lineName && <span style={{ marginLeft: 6, fontWeight: 700, color: C.accent }}>· {train.lineName}</span>}
                    </div>
                  </div>
                  {train.departTime && train.arriveTime && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
                        {train.departTime}
                      </div>
                      <div style={{ fontSize: 11, color: C.textSoft }}>→ {train.arriveTime}</div>
                    </div>
                  )}
                </div>

                {/* Gares */}
                {(train.departStation || train.arriveStation) && (
                  <div style={{ background: '#fff', border: '1px solid #BFDBFE', borderRadius: 7, padding: '8px 10px', marginBottom: 10, fontSize: 11, color: C.text, lineHeight: 1.6 }}>
                    {train.departStation && <div>🚉 <strong>Départ :</strong> {train.departStation}</div>}
                    {train.arriveStation && <div>🏁 <strong>Arrivée :</strong> {train.arriveStation}</div>}
                  </div>
                )}

                {/* Prix + lien SNCF */}
                <div style={{ fontSize: 10, color: C.textSoft, marginBottom: 8, fontStyle: 'italic' }}>
                  💶 Prix → voir sur SNCF Connect
                </div>
                <a href={sncfUrl()} target="_blank" rel="noopener noreferrer" style={{
                  display: 'block', width: '100%', boxSizing: 'border-box',
                  background: C.accent, color: '#fff', borderRadius: 7, padding: '9px 0',
                  fontSize: 12, fontWeight: 700, textDecoration: 'none', textAlign: 'center', fontFamily: 'inherit',
                }}>
                  Voir billets SNCF Connect →
                </a>
              </div>
            ) : originCoords ? (
              <div>
                <div style={{ textAlign: 'center', color: C.textSoft, fontSize: 12, marginBottom: 10 }}>
                  Aucun trajet trouvé
                </div>
                <a href={`https://www.sncf-connect.com/app/home/shop/search?date=${date}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', background: C.accent, color: '#fff', borderRadius: 7, padding: '8px 0', fontSize: 11, fontWeight: 700, textDecoration: 'none', textAlign: 'center', fontFamily: 'inherit' }}>
                  SNCF Connect →
                </a>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: C.textSoft, fontSize: 12 }}>Saisissez une adresse de départ</div>
            )}
          </div>
        </div>

        {/* Recalculer */}
        {originCoords && (
          <button
            onClick={() => calculate()}
            disabled={loadingCar || loadingTrain}
            style={{
              width: '100%', background: C.surface, border: `1.5px solid ${C.border}`,
              borderRadius: 8, padding: '9px 0', fontSize: 12,
              fontWeight: 600, color: C.textMid,
              cursor: loadingCar || loadingTrain ? 'default' : 'pointer', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg }}
            onMouseLeave={e => { e.currentTarget.style.background = C.surface }}
          >
            {loadingCar || loadingTrain ? '⏳ Calcul…' : '↺ Recalculer'}
          </button>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '8px 16px', borderTop: `1px solid ${C.border}`, flexShrink: 0, background: '#F8FAFC' }}>
        <div style={{ fontSize: 10, color: C.textSoft, textAlign: 'center' }}>
          {hasGoogleKey ? '✓ Google Maps — trafic réel + transit' : 'OSRM (estimatif) · clé Google requise pour le train'}
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Carte() {
  const navigate = useNavigate()
  const { isMobile } = useBreakpoint()
  const { dossiers, fetchDossiers, profile, user, profiles, fetchProfiles } = useStore()

  const [coordsMap,      setCoordsMap]      = useState({})
  const [geocoding,      setGeocoding]      = useState(false)
  const [flyTarget,      setFlyTarget]      = useState(null)
  const [filterStatut,   setFilterStatut]   = useState('all')
  const [filterFiche,    setFilterFiche]    = useState('all')
  const [panelOpen,      setPanelOpen]      = useState(!isMobile)
  const [hoveredId,      setHoveredId]      = useState(null)
  const [selectedDossier, setSelectedDossier] = useState(null)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!profile) return
    const init = async () => {
      await fetchDossiers()
      if (isAdmin) fetchProfiles()
    }
    init()
  }, [profile?.id])

  // Signature des adresses de travaux — se recalcule si une adresse est modifiée
  const addrSignature = (isAdmin ? dossiers : dossiers.filter(d => d.assigne_a === user?.id))
    .filter(d => d.statut !== 'perdu' && d.adresse_site)
    .map(d => `${d.id}:${d.adresse_site}`)
    .sort()
    .join('|')

  // Géocode à chaque changement d'adresse de chantier
  useEffect(() => {
    if (!addrSignature) return
    const myDossiers = isAdmin ? dossiers : dossiers.filter(d => d.assigne_a === user?.id)
    const toGeocode  = myDossiers.filter(d => d.statut !== 'perdu' && d.adresse_site)
    if (!toGeocode.length) return
    setGeocoding(true)
    geocodeBatch(toGeocode).then(results => {
      setCoordsMap(results)
      setGeocoding(false)
    })
  }, [addrSignature])

  const isAdmin_ = profile?.role === 'admin'
  const myDossiers = isAdmin_ ? dossiers : dossiers.filter(d => d.assigne_a === user?.id)
  const activeDossiers = myDossiers.filter(d => d.statut !== 'perdu')

  const fiches = [...new Set(activeDossiers.map(d => d.fiche_cee).filter(Boolean))]

  const filtered = activeDossiers.filter(d => {
    if (filterStatut !== 'all' && d.statut !== filterStatut) return false
    if (filterFiche  !== 'all' && d.fiche_cee !== filterFiche) return false
    return true
  })

  const mapped   = filtered.filter(d => coordsMap[d.id])
  const unmapped = filtered.length - mapped.length

  const getStatut = (id) => STATUTS.find(s => s.id === id) || { label: id, color: C.textSoft }

  const openItineraire = (d) => {
    setSelectedDossier(d)
    setFlyTarget(coordsMap[d.id])
    if (isMobile) setPanelOpen(false)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', fontFamily: "system-ui,'Segoe UI',Arial,sans-serif", overflow: 'hidden' }}>

      {/* ── Panneau latéral ── */}
      {(panelOpen || !isMobile) && (
        <div style={{
          width: isMobile ? '100%' : 300,
          flexShrink: 0,
          background: C.surface,
          borderRight: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: isMobile ? 'absolute' : 'relative',
          zIndex: isMobile ? 1000 : 1,
          height: '100%',
          boxShadow: isMobile ? '4px 0 20px rgba(0,0,0,.15)' : 'none',
        }}>
          {/* Header panneau */}
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>🗺 Carte des dossiers</div>
                <div style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }}>
                  {mapped.length} géolocalisé{mapped.length !== 1 ? 's' : ''}{unmapped > 0 ? ` · ${unmapped} sans adresse` : ''}
                  {geocoding && ' · géolocalisation…'}
                </div>
              </div>
              {isMobile && (
                <button onClick={() => setPanelOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: C.textSoft, padding: 4 }}>✕</button>
              )}
            </div>
            {/* Filtres */}
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
              style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 10px', fontSize: 12, color: C.text, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 6 }}>
              <option value="all">Tous les statuts</option>
              {STATUTS.filter(s => s.id !== 'perdu').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {fiches.length > 1 && (
              <select value={filterFiche} onChange={e => setFilterFiche(e.target.value)}
                style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 10px', fontSize: 12, color: C.text, fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value="all">Toutes les fiches</option>
                {fiches.map(f => <option key={f} value={f}>{f} — {FICHE_LABELS[f] || f}</option>)}
              </select>
            )}
          </div>

          {/* Légende statuts */}
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
            {STATUTS.filter(s => s.id !== 'perdu' && filtered.some(d => d.statut === s.id)).map(s => (
              <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: s.color }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                {s.label}
              </span>
            ))}
          </div>

          {/* Liste dossiers */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: C.textSoft, fontSize: 13 }}>Aucun dossier</div>
            ) : (
              filtered.map(d => {
                const statut    = getStatut(d.statut)
                const hasCoords = !!coordsMap[d.id]
                const isHovered = hoveredId === d.id
                const isSelected = selectedDossier?.id === d.id
                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      if (hasCoords) { setFlyTarget(coordsMap[d.id]); if (isMobile) setPanelOpen(false) }
                      else navigate(`/dossier/${d.id}`)
                    }}
                    onMouseEnter={() => setHoveredId(d.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      background: isSelected ? '#EFF6FF' : isHovered ? C.bg : C.surface,
                      border: `1px solid ${isSelected ? C.accent : isHovered ? C.accent : C.border}`,
                      borderLeft: `3px solid ${statut.color}`,
                      borderRadius: 8,
                      padding: '9px 11px',
                      marginBottom: 5,
                      cursor: 'pointer',
                      opacity: hasCoords ? 1 : 0.55,
                      transition: 'all .1s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.prospects?.raison_sociale || '—'}
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{d.ref}</div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: statut.color }}>{statut.label}</div>
                        {!hasCoords && <div style={{ fontSize: 9, color: C.textSoft }}>sans adresse</div>}
                        {hasCoords && <div style={{ fontSize: 9, color: '#16A34A' }}>📍 localisé</div>}
                      </div>
                    </div>
                    {d.adresse_site && (
                      <div style={{ fontSize: 10, color: C.textSoft, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.adresse_site}
                      </div>
                    )}
                    {d.fiche_cee && (
                      <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '1px 5px', borderRadius: 3, marginTop: 3 }}>
                        {d.fiche_cee}
                      </span>
                    )}
                    {/* Bouton itinéraire rapide */}
                    {hasCoords && (
                      <button
                        onClick={e => { e.stopPropagation(); openItineraire(d) }}
                        style={{
                          marginTop: 6, width: '100%',
                          background: isSelected ? C.accent : C.bg,
                          color: isSelected ? '#fff' : C.textMid,
                          border: `1px solid ${isSelected ? C.accent : C.border}`,
                          borderRadius: 5, padding: '4px 0',
                          fontSize: 10, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                          transition: 'all .15s',
                        }}
                      >
                        🧭 Itinéraire
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button onClick={() => navigate('/dossiers')} style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px', fontSize: 12, fontWeight: 600, color: C.text, cursor: 'pointer', fontFamily: 'inherit' }}>
              Voir tous les dossiers →
            </button>
          </div>
        </div>
      )}

      {/* ── Carte Leaflet + panneau itinéraire ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Bouton mobile ouvrir panneau */}
        {isMobile && !panelOpen && !selectedDossier && (
          <button
            onClick={() => setPanelOpen(true)}
            style={{ position: 'absolute', top: 12, left: 12, zIndex: 999, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: C.text, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
            ☰ Filtres · {mapped.length}
          </button>
        )}

        {/* Indicateur géocodage */}
        {geocoding && (
          <div style={{ position: 'absolute', top: 12, right: selectedDossier && !isMobile ? 352 : 12, zIndex: 999, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 11, color: C.textMid, boxShadow: '0 2px 8px rgba(0,0,0,.1)' }}>
            Géolocalisation…
          </div>
        )}

        <MapContainer
          center={[46.5, 2.3]}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          <FlyTo target={flyTarget} />

          {filtered.map(d => {
            const coords = coordsMap[d.id]
            if (!coords) return null
            const statut   = getStatut(d.statut)
            const isHov    = hoveredId === d.id
            const isSel    = selectedDossier?.id === d.id
            return (
              <Marker
                key={d.id}
                position={coords}
                icon={createColoredIcon(statut.color, isSel ? 30 : isHov ? 28 : 22)}
                eventHandlers={{
                  mouseover: () => setHoveredId(d.id),
                  mouseout:  () => setHoveredId(null),
                  click:     () => openItineraire(d),
                }}
              >
                <Popup>
                  <div style={{ fontFamily: "system-ui,'Segoe UI',Arial,sans-serif", minWidth: 190 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                      {d.prospects?.raison_sociale || '—'}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.accent, fontWeight: 700, marginBottom: 6 }}>{d.ref}</div>
                    <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: statut.color, background: statut.color + '18', border: `1px solid ${statut.color}44`, borderRadius: 10, padding: '2px 8px', marginBottom: 6 }}>
                      {statut.label}
                    </div>
                    {d.fiche_cee && (
                      <div style={{ fontSize: 10, color: '#1D4ED8', fontWeight: 700, marginBottom: 4 }}>{d.fiche_cee}</div>
                    )}
                    {d.adresse_site && (
                      <div style={{ fontSize: 10, color: C.textSoft, marginBottom: 8 }}>{d.adresse_site}</div>
                    )}
                    {d.prime_estimee > 0 && (
                      <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700, marginBottom: 8 }}>
                        {d.prime_estimee >= 1000 ? Math.round(d.prime_estimee / 1000) + ' k€' : Math.round(d.prime_estimee) + ' €'}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => openItineraire(d)}
                        style={{ flex: 1, background: '#F0FDF4', color: '#16A34A', border: '1.5px solid #86EFAC', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        🧭 Itinéraire
                      </button>
                      <button
                        onClick={() => navigate(`/dossier/${d.id}`)}
                        style={{ flex: 1, background: C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Ouvrir →
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>

        {/* ── Panneau itinéraire ── */}
        {selectedDossier && coordsMap[selectedDossier.id] && (
          <ItinerairePanel
            dossier={selectedDossier}
            destCoords={coordsMap[selectedDossier.id]}
            onClose={() => setSelectedDossier(null)}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  )
}
