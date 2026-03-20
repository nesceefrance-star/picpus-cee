import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix icônes Leaflet cassées avec Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

function FitBounds({ geojson }) {
  const map = useMap()
  useEffect(() => {
    if (!geojson) return
    try {
      const layer = L.geoJSON(geojson)
      const bounds = layer.getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] })
    } catch (_) {}
  }, [geojson, map])
  return null
}

// Calcule le centroïde d'un feature GeoJSON
function centroid(feature) {
  try {
    const coords = feature.geometry?.coordinates
    if (!coords) return null
    const ring = Array.isArray(coords[0][0]) ? coords[0] : coords
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length
    const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length
    return [cx, cy]
  } catch { return null }
}

function parcelleId(f) {
  return f.properties?.id_parcelle || f.properties?.idu || ''
}

export default function CadastreMap({ adresse, codePostal, ville, siret, raisonSociale, dossierId }) {
  const CACHE_KEY = dossierId ? `cadastre_${dossierId}` : null

  const cached = (() => {
    if (!CACHE_KEY) return null
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) } catch { return null }
  })()

  const [state, setState]             = useState(cached ? 'done' : 'idle')
  const [parcelles, setParcelles]     = useState(cached?.parcelles || null)
  const [selectedIds, setSelectedIds] = useState(() => new Set(cached?.selectedIds || []))
  const [center, setCenter]           = useState(cached?.center    || null)
  const [errorMsg, setErrorMsg]       = useState('')
  const [sourceLabel, setSourceLabel] = useState(cached?.sourceLabel || '')
  const [rayon, setRayon]             = useState(cached?.rayon || 100) // mètres
  const [loadingMore, setLoadingMore] = useState(false)
  // Stocke les coords géocodées pour pouvoir recharger sans re-géocoder
  const [geoCoords, setGeoCoords]     = useState(cached?.geoCoords || null)
  const [refCadastre, setRefCadastre] = useState(cached?.refCadastre || null) // { section, insee }

  const fullAddress = adresse && !codePostal && !ville
    ? adresse
    : [adresse, codePostal, ville].filter(Boolean).join(' ')

  const toggleParcel = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      // Persiste la sélection dans le cache
      if (CACHE_KEY) {
        try {
          const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ...c, selectedIds: [...next] }))
        } catch {}
      }
      return next
    })
  }, [CACHE_KEY])

  // Charge les parcelles autour de coords avec un rayon donné
  const chargerParcelles = async (lon, lat, rayonM, ref, pointParcel, isFirstLoad) => {
    const D = rayonM / 100000 // degrés approximatifs
    let allFeatures = []

    if (ref?.section && ref?.insee) {
      const r = await fetch(`https://apicarto.ign.fr/api/cadastre/parcelle?code_insee=${ref.insee}&section=${ref.section}&_limit=200`)
      if (r.ok) {
        const d = await r.json()
        allFeatures = (d?.features || []).filter(f => {
          const c = centroid(f)
          return c && c[0] >= lon-D && c[0] <= lon+D && c[1] >= lat-D && c[1] <= lat+D
        })
      }
    }

    if (!allFeatures.length) {
      const bbox = `${lon-D},${lat-D},${lon+D},${lat+D},CRS:84`
      const r = await fetch(
        `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
        `&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle` +
        `&OUTPUTFORMAT=application/json&COUNT=100&BBOX=${bbox}`
      )
      if (r.ok) { const d = await r.json(); allFeatures = d?.features || [] }
    }

    if (pointParcel && !allFeatures.find(f => parcelleId(f) === parcelleId(pointParcel))) {
      allFeatures = [pointParcel, ...allFeatures]
    }

    return allFeatures
  }

  const rechercher = async () => {
    if (!fullAddress && !siret && !raisonSociale) return
    if (CACHE_KEY) try { localStorage.removeItem(CACHE_KEY) } catch {}
    setState('loading')
    setErrorMsg('')
    try {
      let lon, lat
      let newSourceLabel = ''

      // 1a. Priorité : adresse du site (BAN)
      if (fullAddress) {
        const geoRes  = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(fullAddress)}&limit=1`)
        const geoData = await geoRes.json()
        const feat    = geoData?.features?.[0]
        if (feat) {
          ;[lon, lat] = feat.geometry.coordinates
          newSourceLabel = '📍 Géocodage adresse du site'
        }
      }

      // 1b. Fallback SIRENE
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
      setGeoCoords([lon, lat])

      // Parcelle sous le point
      const geomParam = encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))
      let pointParcel = null
      const cadRes = await fetch(`https://apicarto.ign.fr/api/cadastre/parcelle?geom=${geomParam}`)
      if (cadRes.ok) {
        const d = await cadRes.json()
        if (d?.features?.length) pointParcel = d.features[0]
      }

      const ref = pointParcel ? {
        section: pointParcel.properties?.section,
        insee:   pointParcel.properties?.code_insee || pointParcel.properties?.com_abs,
      } : null
      setRefCadastre(ref)

      const allFeatures = await chargerParcelles(lon, lat, rayon, ref, pointParcel, true)
      if (!allFeatures.length) throw new Error("Aucune parcelle trouvée à cette adresse")

      const cadData = { type: 'FeatureCollection', features: allFeatures }
      setParcelles(cadData)

      const autoId = pointParcel ? parcelleId(pointParcel) : parcelleId(allFeatures[0])
      setSelectedIds(new Set(autoId ? [autoId] : []))

      setState('done')
      if (CACHE_KEY) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            parcelles: cadData, center: [lat, lon], sourceLabel: newSourceLabel,
            selectedIds: autoId ? [autoId] : [], rayon,
            geoCoords: [lon, lat], refCadastre: ref,
          }))
        } catch {}
      }
    } catch (e) {
      setErrorMsg(e.message || "Erreur lors de la recherche cadastrale")
      setState('error')
    }
  }

  const changerRayon = async (newRayon) => {
    if (!geoCoords) return
    setRayon(newRayon)
    setLoadingMore(true)
    try {
      const [lon, lat] = geoCoords
      const allFeatures = await chargerParcelles(lon, lat, newRayon, refCadastre, null, false)
      if (allFeatures.length) {
        const cadData = { type: 'FeatureCollection', features: allFeatures }
        setParcelles(cadData)
        if (CACHE_KEY) {
          try {
            const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ...c, parcelles: cadData, rayon: newRayon }))
          } catch {}
        }
      }
    } finally {
      setLoadingMore(false)
    }
  }

  const features      = parcelles?.features || []
  const selectedFeats = features.filter(f => selectedIds.has(parcelleId(f)))
  const selectedGeo   = selectedFeats.length ? { type: 'FeatureCollection', features: selectedFeats } : null

  // Style dynamique selon sélection
  const styleFor = (f) => {
    const sel = selectedIds.has(parcelleId(f))
    return sel
      ? { color: '#16A34A', weight: 2.5, fillColor: '#22C55E', fillOpacity: 0.35 }
      : { color: '#94A3B8', weight: 1.5, fillColor: '#CBD5E1', fillOpacity: 0.15 }
  }

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

      {/* Source */}
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

      {/* Erreur */}
      {state === 'error' && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Carte */}
      {state === 'done' && center && (
        <>
          {/* Rayon + instruction */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
            <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>
              Cliquez sur les parcelles du site pour les sélectionner / désélectionner
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: C.textSoft }}>Rayon :</span>
              {[100, 200, 300, 500].map(r => (
                <button
                  key={r}
                  onClick={() => changerRayon(r)}
                  disabled={loadingMore}
                  style={{
                    padding: '3px 8px', fontSize: 11, fontWeight: 600, borderRadius: 5,
                    cursor: loadingMore ? 'wait' : 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${rayon === r ? C.accent : C.border}`,
                    background: rayon === r ? '#EFF6FF' : 'transparent',
                    color: rayon === r ? C.accent : C.textSoft,
                  }}
                >{r}m</button>
              ))}
              {loadingMore && <span style={{ fontSize: 11, color: C.textSoft }}>⏳</span>}
            </div>
          </div>

          <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 12 }}>
            <MapContainer center={center} zoom={18} style={{ height: 300, width: '100%' }} scrollWheelZoom={false}>
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {parcelles && (
                <>
                  <GeoJSON
                    key={[...selectedIds].sort().join(',')}
                    data={parcelles}
                    style={styleFor}
                    onEachFeature={(feature, layer) => {
                      const id = parcelleId(feature)
                      layer.on('click', () => toggleParcel(id))
                      const p = feature.properties || {}
                      const num = p.numero || ''
                      const sec = p.section || ''
                      layer.bindTooltip(`Section ${sec} — n° ${num}`, { sticky: true, className: '' })
                    }}
                  />
                  <FitBounds geojson={selectedGeo || parcelles} />
                </>
              )}
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
              const p  = f.properties || {}
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
                      title="Copier toutes les références"
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
                        <button
                          onClick={() => navigator.clipboard.writeText(x.refOff)}
                          title="Copier"
                          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textSoft, borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                          ⧉
                        </button>
                        <button
                          onClick={() => toggleParcel(x.id)}
                          title="Désélectionner"
                          style={{ background: 'transparent', border: `1px solid #FCA5A5`, color: '#DC2626', borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lien Géoportail centré sur la sélection */}
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
