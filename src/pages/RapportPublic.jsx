// RapportPublic.jsx — Page publique de rapport (accessible sans connexion via token)
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PHOTO_CATEGORIES } from '../components/visite/PhotoSection'

const C = {
  bg: '#F8FAFC', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

const ETAT_LABELS    = { bon: 'Bon état', moyen: 'État moyen', mauvais: 'Mauvais état', hors_service: 'Hors service' }
const COMBUST_LABELS = { gaz_naturel: 'Gaz naturel', gpl: 'GPL', fioul: 'Fioul', electricite: 'Électricité', bois_granules: 'Bois/Granulés', autre: 'Autre' }
const INSTAL_LABELS  = { chaudiere: 'Chaudière', aerotherme: 'Aérotherme', radiateur: 'Radiateur', generateur_air: 'Générateur air chaud', plancher_chauffant: 'Plancher chauffant', pompe_chaleur: 'Pompe à chaleur', autre: 'Autre' }
const BATIM_LABELS   = { atelier_industriel: 'Atelier industriel', entrepot_logistique: 'Entrepôt logistique', atelier_artisanal: 'Atelier artisanal', batiment_agricole: 'Bâtiment agricole', autre: 'Autre' }
const REGUL_LABELS   = { aucune: 'Aucune', thermostat_simple: 'Thermostat simple', programmable: 'Thermostat programmable', gestion_technique: 'Gestion technique bâtiment' }

const getChaudieres = (d) => {
  if (Array.isArray(d.chaudieres) && d.chaudieres.length > 0) return d.chaudieres
  if (d.type_installation || d.marque) return [{
    type_installation: d.type_installation, marque: d.marque, modele: d.modele,
    annee_fabrication: d.annee_fabrication, puissance_nominale_kw: d.puissance_nominale_kw,
    combustible: d.combustible, temperature_consigne: d.temperature_consigne,
    heures_fonctionnement: d.heures_fonctionnement, etat_general: d.etat_general,
    regulation: d.regulation, bruleur: d.bruleur, bruleur_marque: d.bruleur_marque,
    bruleur_modele: d.bruleur_modele, plaque_constructeur_notes: d.plaque_constructeur_notes,
    puissance_convectif_kw: d.puissance_convectif_kw, puissance_radiatif_kw: d.puissance_radiatif_kw,
  }]
  return []
}

function Field({ label, value }) {
  if (!value || value === '—') return null
  return (
    <div style={{ padding: '8px 0', borderBottom: `1px solid ${C.bg}` }}>
      <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{value}</div>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  )
}

export default function RapportPublic() {
  const { token }  = useParams()
  const [visite,   setVisite]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    loadRapport()
  }, [token])

  const loadRapport = async () => {
    const { data } = await supabase
      .from('visites_techniques')
      .select('*, dossiers(ref, prospects(raison_sociale))')
      .eq('partage_token', token)
      .single()
    if (!data) { setNotFound(true); setLoading(false); return }
    setVisite(data)
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      <div style={{ textAlign: 'center', color: C.textSoft }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
        <div>Chargement du rapport…</div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      <div style={{ textAlign: 'center', color: C.textSoft }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>Rapport introuvable</div>
        <div>Ce lien est invalide ou a expiré.</div>
      </div>
    </div>
  )

  const d = visite.donnees || {}
  const photos = visite.photos || []
  const nom = d.nom_site || d.raison_sociale || visite.dossiers?.prospects?.raison_sociale || 'Site sans nom'

  const COEF = { convectif: { H1: 7200, H2: 8000, H3: 8500 }, radiatif: { H1: 2500, H2: 2800, H3: 3000 } }
  const z = d.zone_climatique
  const kwhCumac = z ? Math.round(
    (COEF.convectif[z] || 0) * (parseFloat(d.puissance_convectif_kw) || 0) +
    (COEF.radiatif[z]  || 0) * (parseFloat(d.puissance_radiatif_kw)  || 0)
  ) : 0

  const photosParCat = PHOTO_CATEGORIES.map(cat => ({
    ...cat, items: photos.filter(p => p.categorie === cat.id),
  })).filter(c => c.items.length > 0)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif", padding: '0 0 60px' }}>

      {/* Header */}
      <div style={{ background: '#1E293B', color: '#fff', padding: '20px 32px', marginBottom: 32 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>⚡ SOFT.IA — Rapport de visite technique</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{nom}</div>
            {d.adresse_site && <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 2 }}>{d.adresse_site}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              display: 'inline-block',
              background: visite.statut === 'validée' ? '#166534' : '#92400E',
              color: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700
            }}>
              {visite.statut === 'validée' ? '✓ Validée' : '✏ Brouillon'}
            </span>
            {visite.dossiers?.ref && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>Dossier {visite.dossiers.ref}</div>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 20px' }}>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {visite.rapport_url && (
            <a href={visite.rapport_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.accent, color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              ⬇ Télécharger le PDF
            </a>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, color: C.textSoft }}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''} · {Object.keys(d).filter(k => d[k]).length} champs renseignés
          </span>
        </div>

        {/* Infos générales */}
        <Section title="Informations générales" icon="📋">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 0 }}>
            <Field label="Raison sociale" value={d.raison_sociale} />
            <Field label="Date de visite" value={d.date_visite ? new Date(d.date_visite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null} />
            <Field label="Contact sur site" value={d.contact_nom} />
            <Field label="Téléphone" value={d.contact_tel} />
            <Field label="Adresse du site" value={d.adresse_site} />
            <Field label="Notes d'accès" value={d.notes_acces} />
          </div>
        </Section>

        {/* Chaufferie */}
        {getChaudieres(d).length > 0 && (
          <Section title="Chaufferie" icon="🔥">
            {getChaudieres(d).map((ch, idx) => (
              <div key={idx} style={{ marginBottom: idx < getChaudieres(d).length - 1 ? 20 : 0 }}>
                {getChaudieres(d).length > 1 && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textMid, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
                    Installation {idx + 1}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 0 }}>
                  <Field label="Type d'installation" value={INSTAL_LABELS[ch.type_installation] || ch.type_installation} />
                  <Field label="État général" value={ETAT_LABELS[ch.etat_general] || ch.etat_general} />
                  <Field label="Marque" value={ch.marque} />
                  <Field label="Modèle" value={ch.modele} />
                  <Field label="Année de fabrication" value={ch.annee_fabrication} />
                  <Field label="Puissance nominale" value={ch.puissance_nominale_kw ? `${ch.puissance_nominale_kw} kW` : null} />
                  <Field label="Combustible actuel" value={COMBUST_LABELS[ch.combustible] || ch.combustible} />
                  <Field label="Régulation" value={REGUL_LABELS[ch.regulation] || ch.regulation} />
                  <Field label="Température de consigne" value={ch.temperature_consigne ? `${ch.temperature_consigne} °C` : null} />
                  <Field label="Heures de fonctionnement / an" value={ch.heures_fonctionnement ? `${ch.heures_fonctionnement} h` : null} />
                  <Field label="Puissance convectif" value={ch.puissance_convectif_kw ? `${ch.puissance_convectif_kw} kW` : null} />
                  <Field label="Puissance radiatif" value={ch.puissance_radiatif_kw ? `${ch.puissance_radiatif_kw} kW` : null} />
                </div>
                {ch.plaque_constructeur_notes && (
                  <div style={{ marginTop: 8, padding: '10px 14px', background: C.bg, borderRadius: 8, fontSize: 13, color: C.text }}>
                    <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plaque constructeur</div>
                    {ch.plaque_constructeur_notes}
                  </div>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Données techniques */}
        <Section title="Données techniques" icon="⚡">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 0 }}>
            <Field label="Zone climatique" value={d.zone_climatique} />
            <Field label="Type de bâtiment" value={BATIM_LABELS[d.type_batiment] || d.type_batiment} />
            <Field label="Surface chauffée" value={d.surface_chauffee_m2 ? `${d.surface_chauffee_m2} m²` : null} />
            <Field label="Isolation bâtiment" value={d.isolation_batiment} />
            <Field label="Type de charpente" value={d.type_charpente === 'metallique' ? 'Métallique' : d.type_charpente === 'bois' ? 'Bois' : d.type_charpente === 'beton' ? 'Béton' : d.type_charpente} />
            <Field label="Type de toiture" value={d.type_toiture === 'plat' ? 'Plate/Terrasse' : d.type_toiture === 'double_pans' ? 'Double pans' : d.type_toiture === 'shed' ? 'Shed' : d.type_toiture === 'bac_acier' ? 'Bac acier' : d.type_toiture} />
          </div>
          {(d.zones_hauteur || []).length > 0 && (
            <div style={{ padding: '8px 0', borderBottom: `1px solid ${C.bg}` }}>
              <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hauteurs sous plafond</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {(d.zones_hauteur || []).map(zh => `${zh.zone || 'Zone'} : ${zh.hauteur_m || '?'} m`).join(' · ')}
              </div>
            </div>
          )}
          {kwhCumac > 0 && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 18px', marginTop: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 28 }}>⚡</span>
              <div>
                <div style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimation CEE — IND-BA-110</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1D4ED8' }}>{kwhCumac.toLocaleString('fr-FR')} kWh cumac</div>
                <div style={{ fontSize: 12, color: '#3B82F6' }}>Zone {z} · Convectif {d.puissance_convectif_kw || 0} kW · Radiatif {d.puissance_radiatif_kw || 0} kW</div>
              </div>
            </div>
          )}
        </Section>

        {/* Réseau électrique */}
        {(d.tgbt_localisation || d.tgbt_marque || d.td_localisation) && (
          <Section title="Réseau électrique" icon="⚡">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 0 }}>
              <Field label="Localisation TGBT" value={d.tgbt_localisation} />
              <Field label="Marque TGBT" value={d.tgbt_marque} />
              <Field label="Puissance disponible TGBT" value={d.tgbt_puissance_a ? `${d.tgbt_puissance_a} A` : null} />
              <Field label="Observations TGBT" value={d.tgbt_observations} />
              <Field label="Localisation TD" value={d.td_localisation} />
              <Field label="Observations TD" value={d.td_observations} />
            </div>
          </Section>
        )}

        {/* Observations */}
        {d.observations_generales && (
          <Section title="Observations et contrainte opérationnel" icon="📝">
            <p style={{ margin: 0, fontSize: 14, color: C.text, lineHeight: 1.7 }}>{d.observations_generales}</p>
          </Section>
        )}

        {/* Nacelle */}
        {(d.nacelle_disponible || d.passage_nacelle) && (
          <Section title="Nacelle et circulation" icon="🏗">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 0 }}>
              <Field label="Nacelle disponible" value={d.nacelle_disponible === 'oui' ? 'Oui' : d.nacelle_disponible === 'non' ? 'Non' : d.nacelle_disponible === 'a_prevoir' ? 'À prévoir' : d.nacelle_disponible} />
              <Field label="Type de nacelle" value={d.nacelle_type} />
              <Field label="Hauteur max" value={d.nacelle_hauteur_max ? `${d.nacelle_hauteur_max} m` : null} />
              <Field label="Passage de nacelle" value={d.passage_nacelle === 'libre' ? 'Libre' : d.passage_nacelle === 'zones_difficiles' ? 'Zones difficiles' : d.passage_nacelle === 'impossible' ? 'Impossible' : d.passage_nacelle} />
              <Field label="Observations" value={d.nacelle_observations} />
            </div>
          </Section>
        )}

        {/* Photos */}
        {photosParCat.length > 0 && (
          <Section title={`Photos (${photos.length})`} icon="📷">
            {photosParCat.map(cat => (
              <div key={cat.id} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textMid, marginBottom: 10 }}>
                  {cat.icon} {cat.label} <span style={{ fontWeight: 400, fontSize: 12, color: C.textSoft }}>({cat.items.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {cat.items.map(photo => (
                    <div key={photo.id} style={{ borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', background: C.bg, cursor: 'pointer' }}
                      onClick={() => setLightbox({ url: photo.url, label: cat.label })}>
                      <img src={photo.url} alt={cat.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 12, color: C.textSoft, marginTop: 32 }}>
          Rapport généré via <strong>SOFT.IA</strong> · Ce document est confidentiel
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={lightbox.url} alt={lightbox.label} style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  )
}
