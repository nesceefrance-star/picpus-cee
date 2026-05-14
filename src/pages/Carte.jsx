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

// Cache module-level pour les géocodages
const geoCache = new Map()

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
async function geocodeAddress(addr) {
  if (!addr?.trim()) return null
  const key = addr.trim().toLowerCase()
  if (geoCache.has(key)) return geoCache.get(key)
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(addr)}&limit=1`)
    const d = await r.json()
    const f = d.features?.[0]
    const result = f ? [f.geometry.coordinates[1], f.geometry.coordinates[0]] : null
    geoCache.set(key, result)
    return result
  } catch { return null }
}

async function geocodeBatch(dossiers) {
  const BATCH = 6
  const results = {}
  for (let i = 0; i < dossiers.length; i += BATCH) {
    const slice = dossiers.slice(i, i + BATCH)
    const resolved = await Promise.all(slice.map(async d => {
      const addr = d.adresse_site
      const coords = await geocodeAddress(addr)
      return [d.id, coords]
    }))
    for (const [id, c] of resolved) { if (c) results[id] = c }
  }
  return results
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Carte() {
  const navigate = useNavigate()
  const { isMobile } = useBreakpoint()
  const { dossiers, fetchDossiers, profile, user, profiles, fetchProfiles } = useStore()

  const [coordsMap, setCoordsMap]   = useState({})
  const [geocoding, setGeocoding]   = useState(false)
  const [flyTarget, setFlyTarget]   = useState(null)
  const [filterStatut, setFilterStatut] = useState('all')
  const [filterFiche,  setFilterFiche]  = useState('all')
  const [panelOpen,    setPanelOpen]    = useState(!isMobile)
  const [hoveredId,    setHoveredId]    = useState(null)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!profile) return
    const init = async () => {
      await fetchDossiers()
      if (isAdmin) fetchProfiles()
    }
    init()
  }, [profile?.id])

  // Géocode quand les dossiers sont chargés
  useEffect(() => {
    if (!dossiers.length) return
    const myDossiers = isAdmin ? dossiers : dossiers.filter(d => d.assigne_a === user?.id)
    const toGeocode  = myDossiers.filter(d => d.statut !== 'perdu' && d.adresse_site)
    if (!toGeocode.length) return
    setGeocoding(true)
    geocodeBatch(toGeocode).then(results => {
      setCoordsMap(prev => ({ ...prev, ...results }))
      setGeocoding(false)
    })
  }, [dossiers.length, profile?.id])

  const isAdmin_ = profile?.role === 'admin'
  const myDossiers = isAdmin_ ? dossiers : dossiers.filter(d => d.assigne_a === user?.id)
  const activeDossiers = myDossiers.filter(d => d.statut !== 'perdu')

  const fiches = [...new Set(activeDossiers.map(d => d.fiche_cee).filter(Boolean))]

  const filtered = activeDossiers.filter(d => {
    if (filterStatut !== 'all' && d.statut !== filterStatut) return false
    if (filterFiche  !== 'all' && d.fiche_cee !== filterFiche) return false
    return true
  })

  const mapped = filtered.filter(d => coordsMap[d.id])
  const unmapped = filtered.length - mapped.length

  const getStatut = (id) => STATUTS.find(s => s.id === id) || { label: id, color: C.textSoft }

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
                const statut  = getStatut(d.statut)
                const hasCoords = !!coordsMap[d.id]
                const isHovered = hoveredId === d.id
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
                      background: isHovered ? C.bg : C.surface,
                      border: `1px solid ${isHovered ? C.accent : C.border}`,
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

      {/* ── Carte Leaflet ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Bouton mobile ouvrir panneau */}
        {isMobile && !panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            style={{ position: 'absolute', top: 12, left: 12, zIndex: 999, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: C.text, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
            ☰ Filtres · {mapped.length}
          </button>
        )}

        {/* Indicateur géocodage */}
        {geocoding && (
          <div style={{ position: 'absolute', top: isMobile ? 12 : 12, right: 12, zIndex: 999, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 11, color: C.textMid, boxShadow: '0 2px 8px rgba(0,0,0,.1)' }}>
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
            const statut = getStatut(d.statut)
            const isHov  = hoveredId === d.id
            return (
              <Marker
                key={d.id}
                position={coords}
                icon={createColoredIcon(statut.color, isHov ? 28 : 22)}
                eventHandlers={{
                  mouseover: () => setHoveredId(d.id),
                  mouseout:  () => setHoveredId(null),
                }}
              >
                <Popup>
                  <div style={{ fontFamily: "system-ui,'Segoe UI',Arial,sans-serif", minWidth: 180 }}>
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
                    <button
                      onClick={() => navigate(`/dossier/${d.id}`)}
                      style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                      Ouvrir le dossier →
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
