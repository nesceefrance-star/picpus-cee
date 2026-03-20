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

          {/* Résumé global */}
          {(() => {
            const parsed = features.map(f => {
              const p = f.properties || {}
              const id    = p.id_parcelle || p.idu || ''
              // id_parcelle = deptcode(2) + commune(3) + prefixe(3) + section(2) + numero(4)
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
                {/* Bloc résumé */}
                <div style={{ background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8' }}>
                      {parsed.length} parcelle{parsed.length > 1 ? 's' : ''} trouvée{parsed.length > 1 ? 's' : ''}
                      {totalSurface > 0 && <span style={{ fontWeight: 400, color: C.textMid, marginLeft: 8 }}>· Surface totale : <strong>{totalSurface.toLocaleString('fr-FR')} m²</strong></span>}
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(allRefs) }}
                      title="Copier toutes les références"
                      style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      📋 Copier les refs
                    </button>
                  </div>
                  {/* Liste refs copiables */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {parsed.map((x, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', background: '#fff', border: '1px solid #BFDBFE', borderRadius: 5, padding: '2px 8px', letterSpacing: '0.05em', flex: 1 }}>
                          {x.refOff}
                        </code>
                        {x.surface != null && <span style={{ fontSize: 11, color: C.textSoft, whiteSpace: 'nowrap' }}>{x.surface.toLocaleString('fr-FR')} m²</span>}
                        <button
                          onClick={() => navigator.clipboard.writeText(x.refOff)}
                          title="Copier"
                          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textSoft, borderRadius: 5, padding: '2px 7px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                          ⧉
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Détail par parcelle */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {parsed.map((x, i) => (
                    <div key={i} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8' }}>Section {x.section} — n° {x.numero}</span>
                        {x.id && <div style={{ fontSize: 10, color: C.textSoft, fontFamily: 'monospace', marginTop: 1 }}>{x.id}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {x.surface != null && <span style={{ fontSize: 11, color: C.textMid }}><strong>{x.surface.toLocaleString('fr-FR')}</strong> m²</span>}
                        <a href={`https://www.geoportail.gouv.fr/carte?c=${center[1]},${center[0]}&z=19&l0=CADASTRALPARCELS.PARCELLAIRE_EXPRESS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
                          Géoportail →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}
