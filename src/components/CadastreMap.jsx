import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

function parcelleId(f) {
  return f?.properties?.id_parcelle || f?.properties?.idu || ''
}

// Charge les parcelles WFS dans la bbox visible
async function fetchParcellesInBbox(bounds) {
  const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()},CRS:84`
  const r = await fetch(
    `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
    `&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle` +
    `&OUTPUTFORMAT=application/json&COUNT=150&BBOX=${bbox}`
  )
  if (!r.ok) return []
  const d = await r.json()
  return d?.features || []
}

// Adapte la vue initiale
function FitBoundsOnce({ geojson }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (!geojson || done.current) return
    try {
      const layer = L.geoJSON(geojson)
      const bounds = layer.getBounds()
      if (bounds.isValid()) { map.fitBounds(bounds, { padding: [40, 40] }); done.current = true }
    } catch (_) {}
  }, [geojson, map])
  return null
}

// Charge automatiquement les parcelles à chaque déplacement/zoom (debounced)
function AutoLoader({ onFeatures, setLoading, minZoom = 15 }) {
  const map = useMap()
  const timer = useRef(null)

  const load = useCallback(() => {
    if (map.getZoom() < minZoom) return
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const feats = await fetchParcellesInBbox(map.getBounds())
        onFeatures(feats)
      } catch (_) {}
      setLoading(false)
    }, 600)
  }, [map, onFeatures, setLoading, minZoom])

  useMapEvents({ moveend: load, zoomend: load })

  // Charge dès l'apparition de la carte
  useEffect(() => { load() }, [load])

  return null
}

export default function CadastreMap({ adresse, codePostal, ville, siret, raisonSociale, dossierId }) {
  const CACHE_KEY = dossierId ? `cadastre_${dossierId}` : null

  const cached = (() => {
    if (!CACHE_KEY) return null
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) } catch { return null }
  })()

  const [state, setState]             = useState(cached ? 'done' : 'idle')
  // allFeatures : Map id → feature (accumulation)
  const [featMap, setFeatMap]         = useState(() => {
    const m = new Map()
    ;(cached?.parcelles?.features || []).forEach(f => m.set(parcelleId(f), f))
    return m
  })
  const [selectedIds, setSelectedIds] = useState(() => new Set(cached?.selectedIds || []))
  const [center, setCenter]           = useState(cached?.center || null)
  const [errorMsg, setErrorMsg]       = useState('')
  const [sourceLabel, setSourceLabel] = useState(cached?.sourceLabel || '')
  const [loadingMore, setLoadingMore] = useState(false)
  const initFeatureRef                = useRef(null) // parcelle sous le point, pour fitBounds

  const fullAddress = adresse && !codePostal && !ville
    ? adresse
    : [adresse, codePostal, ville].filter(Boolean).join(' ')

  // Appelé par AutoLoader à chaque déplacement
  const handleFeatures = useCallback((newFeats) => {
    if (!newFeats.length) return
    setFeatMap(prev => {
      const next = new Map(prev)
      let changed = false
      newFeats.forEach(f => {
        const id = parcelleId(f)
        if (id && !next.has(id)) { next.set(id, f); changed = true }
      })
      return changed ? next : prev
    })
  }, [])

  const toggleParcel = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      if (CACHE_KEY) {
        try {
          const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ...c, selectedIds: [...next] }))
        } catch {}
      }
      return next
    })
  }, [CACHE_KEY])

  const rechercher = async () => {
    if (!fullAddress && !siret && !raisonSociale) return
    if (CACHE_KEY) try { localStorage.removeItem(CACHE_KEY) } catch {}
    setState('loading')
    setErrorMsg('')
    setFeatMap(new Map())
    setSelectedIds(new Set())
    try {
      let lon, lat, newSourceLabel = ''

      if (fullAddress) {
        const geoRes  = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(fullAddress)}&limit=1`)
        const geoData = await geoRes.json()
        const feat    = geoData?.features?.[0]
        if (feat) { ;[lon, lat] = feat.geometry.coordinates; newSourceLabel = '📍 Géocodage adresse du site' }
      }

      if (!lat || !lon) {
        const sireneQ = siret?.replace(/\s/g,'') || raisonSociale
        if (sireneQ) {
          const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(sireneQ)}&per_page=1`)
          const d = await r.json()
          const etab = d?.results?.[0]?.siege
          if (etab?.latitude && etab?.longitude) {
            lat = parseFloat(etab.latitude); lon = parseFloat(etab.longitude)
            newSourceLabel = '📍 Localisation SIRENE (siège social)'
          }
        }
      }

      if (!lat || !lon) throw new Error("Adresse introuvable — renseignez l'adresse du site ou le SIRET")

      setSourceLabel(newSourceLabel)
      setCenter([lat, lon])

      // Parcelle directement sous le point → pré-sélection
      const geomParam = encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))
      const cadRes = await fetch(`https://apicarto.ign.fr/api/cadastre/parcelle?geom=${geomParam}`)
      if (cadRes.ok) {
        const d = await cadRes.json()
        const pf = d?.features?.[0]
        if (pf) {
          const id = parcelleId(pf)
          initFeatureRef.current = pf
          setFeatMap(new Map([[id, pf]]))
          setSelectedIds(new Set([id]))
        }
      }

      setState('done')
      if (CACHE_KEY) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            parcelles: { type: 'FeatureCollection', features: initFeatureRef.current ? [initFeatureRef.current] : [] },
            center: [lat, lon], sourceLabel: newSourceLabel,
            selectedIds: initFeatureRef.current ? [parcelleId(initFeatureRef.current)] : [],
          }))
        } catch {}
      }
    } catch (e) {
      setErrorMsg(e.message || "Erreur lors de la recherche cadastrale")
      setState('error')
    }
  }

  // Persistance des parcelles chargées (debounced)
  const persistTimer = useRef(null)
  useEffect(() => {
    if (!CACHE_KEY || state !== 'done') return
    clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          ...c,
          parcelles: { type: 'FeatureCollection', features: [...featMap.values()] },
        }))
      } catch {}
    }, 1000)
  }, [featMap, CACHE_KEY, state])

  const allFeatures   = [...featMap.values()]
  const cadData       = allFeatures.length ? { type: 'FeatureCollection', features: allFeatures } : null
  const selectedFeats = allFeatures.filter(f => selectedIds.has(parcelleId(f)))
  const initGeo       = initFeatureRef.current
    ? { type: 'FeatureCollection', features: [initFeatureRef.current] }
    : (allFeatures.length ? cadData : null)

  const styleFor = (f) => selectedIds.has(parcelleId(f))
    ? { color: '#16A34A', weight: 2.5, fillColor: '#22C55E', fillOpacity: 0.35 }
    : { color: '#94A3B8', weight: 1.5, fillColor: '#CBD5E1', fillOpacity: 0.12 }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>🗺 Parcelle cadastrale</span>
        <button
          onClick={rechercher}
          disabled={state === 'loading' || !fullAddress}
          style={{
            background: state === 'done' ? 'transparent' : C.accent,
            color: state === 'done' ? C.textMid : '#fff',
            border: state === 'done' ? `1px solid ${C.border}` : 'none',
            borderRadius: 7, padding: '5px 13px', fontSize: 12, fontWeight: 600,
            cursor: state === 'loading' || !fullAddress ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: !fullAddress ? .5 : 1,
          }}
        >
          {state === 'loading' ? '⏳ Recherche…' : state === 'done' ? '↺ Actualiser' : '🔍 Rechercher'}
        </button>
      </div>

      {(fullAddress || siret || raisonSociale) && (
        <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 8, fontStyle: 'italic' }}>
          {state === 'done' && sourceLabel ? sourceLabel + (fullAddress ? ` — ${fullAddress}` : '') : `📍 ${fullAddress || raisonSociale || ''}`}
        </div>
      )}
      {!fullAddress && (
        <div style={{ fontSize: 12, color: C.textSoft, marginBottom: 12 }}>
          Renseignez l'adresse du client pour lancer la recherche.
        </div>
      )}

      {state === 'error' && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {state === 'done' && center && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>
              Cliquez sur les parcelles du site pour les sélectionner / désélectionner
            </span>
            <span style={{ fontSize: 11, color: C.textSoft }}>
              {loadingMore ? '⏳ Chargement…' : `${allFeatures.length} parcelle${allFeatures.length > 1 ? 's' : ''} chargée${allFeatures.length > 1 ? 's' : ''}`}
            </span>
          </div>

          <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 12 }}>
            <MapContainer center={center} zoom={18} style={{ height: 320, width: '100%' }} scrollWheelZoom>
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {cadData && (
                <>
                  <GeoJSON
                    key={`${allFeatures.length}-${[...selectedIds].sort().join(',')}`}
                    data={cadData}
                    style={styleFor}
                    onEachFeature={(feature, layer) => {
                      const id = parcelleId(feature)
                      layer.on('click', () => toggleParcel(id))
                      const p = feature.properties || {}
                      layer.bindTooltip(`Section ${p.section || '—'} — n° ${p.numero || '—'}`, { sticky: true })
                    }}
                  />
                  <FitBoundsOnce geojson={initGeo} />
                </>
              )}
              <AutoLoader onFeatures={handleFeatures} setLoading={setLoadingMore} />
            </MapContainer>
          </div>

          {/* Résumé sélection */}
          {(() => {
            if (!selectedFeats.length) return (
              <div style={{ fontSize: 12, color: C.textSoft, textAlign: 'center', padding: '12px 0' }}>
                Aucune parcelle sélectionnée — cliquez sur la carte
              </div>
            )
            const parsed = selectedFeats.map(f => {
              const p = f.properties || {}
              const id = parcelleId(f)
              const prefixe = id.length >= 14 ? id.slice(5, 8) : (p.code_arr || p.prefixe || '000')
              const section = p.section || (id.length >= 14 ? id.slice(8, 10) : '—')
              const numero  = p.numero  || (id.length >= 14 ? id.slice(10, 14) : '—')
              const surface = p.contenance ? Math.round(p.contenance) : null
              const refOff  = `${prefixe} / ${section} / ${numero}`
              return { prefixe, section, numero, surface, refOff, id }
            })
            const totalSurface = parsed.reduce((s, x) => s + (x.surface || 0), 0)
            const allRefs = parsed.map(x => x.refOff).join('\n')

            return (
              <>
                <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#16A34A' }}>
                      {parsed.length} parcelle{parsed.length > 1 ? 's' : ''} sélectionnée{parsed.length > 1 ? 's' : ''}
                      {totalSurface > 0 && (
                        <span style={{ fontWeight: 400, color: C.textMid, marginLeft: 8 }}>
                          · Surface totale : <strong>{totalSurface.toLocaleString('fr-FR')} m²</strong>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(allRefs)}
                      style={{ background: '#16A34A', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      📋 Copier les refs
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {parsed.map((x, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', background: '#fff', border: '1px solid #86EFAC', borderRadius: 5, padding: '2px 8px', letterSpacing: '0.05em', flex: 1 }}>
                          {x.refOff}
                        </code>
                        {x.surface != null && <span style={{ fontSize: 11, color: C.textSoft, whiteSpace: 'nowrap' }}>{x.surface.toLocaleString('fr-FR')} m²</span>}
                        <button onClick={() => navigator.clipboard.writeText(x.refOff)}
                          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textSoft, borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>⧉</button>
                        <button onClick={() => toggleParcel(x.id)}
                          style={{ background: 'transparent', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <a href={`https://www.geoportail.gouv.fr/carte?c=${center[1]},${center[0]}&z=19&l0=CADASTRALPARCELS.PARCELLAIRE_EXPRESS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
                    Ouvrir dans Géoportail →
                  </a>
                </div>
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}
