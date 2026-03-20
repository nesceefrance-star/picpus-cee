import { useState, useEffect } from 'react'
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

// Adapte la vue de la carte à la parcelle
function FitBounds({ geojson }) {
  const map = useMap()
  useEffect(() => {
    if (!geojson) return
    try {
      const layer = L.geoJSON(geojson)
      const bounds = layer.getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] })
    } catch (_) {}
  }, [geojson, map])
  return null
}

export default function CadastreMap({ adresse, codePostal, ville, siret, raisonSociale }) {
  const [state, setState]         = useState('idle') // idle | loading | done | error
  const [parcelles, setParcelles] = useState(null)   // GeoJSON FeatureCollection
  const [center, setCenter]       = useState(null)   // [lat, lng]
  const [errorMsg, setErrorMsg]   = useState('')

  // adresse peut être une chaîne complète (adresse_site) ou être complétée par codePostal/ville
  const fullAddress = adresse && !codePostal && !ville
    ? adresse
    : [adresse, codePostal, ville].filter(Boolean).join(' ')

  const [sourceLabel, setSourceLabel] = useState('')

  const rechercher = async () => {
    if (!fullAddress && !siret && !raisonSociale) return
    setState('loading')
    setErrorMsg('')
    try {
      let lon, lat

      // 1a. Priorité : SIRET ou raison sociale → coordonnées précises au bâtiment (base SIRENE)
      const sireneQ = siret?.replace(/\s/g,'') || raisonSociale
      if (sireneQ) {
        const sireneRes = await fetch(
          `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(sireneQ)}&per_page=1`
        )
        const sireneData = await sireneRes.json()
        const etab = sireneData?.results?.[0]?.siege
        if (etab?.latitude && etab?.longitude) {
          lat = parseFloat(etab.latitude)
          lon = parseFloat(etab.longitude)
          setSourceLabel('📍 Localisation SIRENE (précision bâtiment)')
        }
      }

      // 1b. Fallback : géocodage de l'adresse du site
      if (!lat || !lon) {
        if (!fullAddress) throw new Error("Adresse introuvable — renseignez l'adresse du site ou le SIRET")
        const geoRes = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(fullAddress)}&limit=1`
        )
        const geoData = await geoRes.json()
        const feat = geoData?.features?.[0]
        if (!feat) throw new Error("Adresse introuvable")
        ;[lon, lat] = feat.geometry.coordinates
        setSourceLabel('📍 Géocodage adresse')
      }

      setCenter([lat, lon])

      // 2. Parcelle cadastrale : point précis via apicarto IGN
      const geomParam = encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lon, lat] }))
      let cadData = null
      const cadRes = await fetch(`https://apicarto.ign.fr/api/cadastre/parcelle?geom=${geomParam}`)
      if (cadRes.ok) cadData = await cadRes.json()

      // Fallback bbox 30m si le point tombe sur la voirie
      if (!cadData?.features?.length) {
        const d = 0.0003 // ~30m
        const bbox = `${lon-d},${lat-d},${lon+d},${lat+d},CRS:84`
        const wfsRes = await fetch(
          `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
          `&TYPENAMES=CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle` +
          `&OUTPUTFORMAT=application/json&COUNT=5&BBOX=${bbox}`
        )
        if (wfsRes.ok) cadData = await wfsRes.json()
      }

      if (!cadData?.features?.length) throw new Error("Aucune parcelle trouvée à cette adresse")

      setParcelles(cadData)
      setState('done')
    } catch (e) {
      setErrorMsg(e.message || "Erreur lors de la recherche cadastrale")
      setState('error')
    }
  }

  const parcelleStyle = {
    color: '#2563EB',
    weight: 2.5,
    fillColor: '#3B82F6',
    fillOpacity: 0.18,
  }

  const features = parcelles?.features || []

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

      {/* Source utilisée */}
      {(fullAddress || siret || raisonSociale) && (
        <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 12, fontStyle: 'italic' }}>
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
          <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, marginBottom: 12 }}>
            <MapContainer
              center={center}
              zoom={18}
              style={{ height: 280, width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {parcelles && (
                <>
                  <GeoJSON data={parcelles} style={parcelleStyle} />
                  <FitBounds geojson={parcelles} />
                </>
              )}
            </MapContainer>
          </div>

          {/* Infos parcelles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {features.map((f, i) => {
              const p = f.properties || {}
              // PARCELLAIRE_EXPRESS WFS: id_parcelle, section, numero, contenance, commune
              // apicarto fallbacks: nom_com, code_insee, prefixe
              const section   = p.section || '—'
              const numero    = p.numero  || '—'
              const idParc    = p.id_parcelle || p.idu || [p.code_insee || p.commune, p.section, p.numero].filter(Boolean).join(' ')
              const commune   = p.nom_com || p.com_nom || p.commune_name || idParc?.slice(0, 5) || '—'
              // contenance en m² (WFS = m², parfois en ares = diviser par 100)
              const surface   = p.contenance ? Math.round(p.contenance) : null
              return (
                <div key={i} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', marginBottom: 3 }}>
                        Parcelle {section} {numero}
                      </div>
                      {idParc && <div style={{ fontSize: 10, color: C.textSoft, fontFamily: 'monospace', marginBottom: 2 }}>{idParc}</div>}
                      {surface != null && <div style={{ fontSize: 11, color: C.textMid }}>Surface : <strong>{surface.toLocaleString('fr-FR')} m²</strong></div>}
                    </div>
                    <a
                      href={`https://www.geoportail.gouv.fr/carte?c=${center[1]},${center[0]}&z=19&l0=CADASTRALPARCELS.PARCELLAIRE_EXPRESS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: C.accent, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: 8 }}
                    >
                      Géoportail →
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
