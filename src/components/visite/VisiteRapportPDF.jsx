// VisiteRapportPDF.jsx — Rapport PDF visite technique (@react-pdf/renderer v4)
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { PHOTO_CATEGORIES } from './PhotoSection'

const ETAT_LABELS   = { bon: 'Bon état', moyen: 'État moyen', mauvais: 'Mauvais état', hors_service: 'Hors service' }
const COMBUST_LABELS = { gaz_naturel: 'Gaz naturel', gpl: 'GPL', fioul: 'Fioul', electricite: 'Électricité', bois_granules: 'Bois/Granulés', autre: 'Autre' }
const INSTAL_LABELS  = { chaudiere: 'Chaudière', aerotherme: 'Aérotherme', radiateur: 'Radiateur', generateur_air: 'Générateur air chaud', plancher_chauffant: 'Plancher chauffant', pompe_chaleur: 'Pompe à chaleur', autre: 'Autre' }
const BATIM_LABELS   = { atelier_industriel: 'Atelier industriel', entrepot_logistique: 'Entrepôt logistique', atelier_artisanal: 'Atelier artisanal', batiment_agricole: 'Bâtiment agricole', autre: 'Autre' }

const s = StyleSheet.create({
  page:       { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#0F172A', backgroundColor: '#FFFFFF' },
  // Header
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 14, borderBottom: '1.5 solid #2563EB' },
  headerLeft: { flex: 1 },
  badge:      { backgroundColor: '#2563EB', color: '#FFFFFF', padding: '4 10', borderRadius: 4, fontSize: 9, fontWeight: 'bold', alignSelf: 'flex-start', marginBottom: 6 },
  title:      { fontSize: 20, fontWeight: 'bold', color: '#0F172A', marginBottom: 4 },
  subtitle:   { fontSize: 10, color: '#64748B' },
  headerRight:{ alignItems: 'flex-end' },
  dateText:   { fontSize: 9, color: '#94A3B8' },
  refText:    { fontSize: 11, fontWeight: 'bold', color: '#2563EB', marginTop: 4 },
  // Sections
  section:    { marginBottom: 18 },
  sTitle:     { fontSize: 12, fontWeight: 'bold', color: '#1D4ED8', marginBottom: 8, paddingBottom: 5, borderBottom: '0.5 solid #BFDBFE' },
  // Grille de champs
  grid:       { flexDirection: 'row', flexWrap: 'wrap' },
  field:      { width: '50%', marginBottom: 7, paddingRight: 12 },
  fieldFull:  { width: '100%', marginBottom: 7 },
  fLabel:     { fontSize: 8, color: '#64748B', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  fValue:     { fontSize: 10, color: '#0F172A', fontWeight: 'bold' },
  // Highlight box
  highlight:  { backgroundColor: '#EFF6FF', padding: '10 14', borderRadius: 6, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  hLabel:     { fontSize: 8, color: '#1D4ED8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  hValue:     { fontSize: 18, fontWeight: 'bold', color: '#1D4ED8' },
  hSub:       { fontSize: 8, color: '#3B82F6', marginTop: 2 },
  // Photos
  photoCat:   { marginBottom: 16 },
  pCatTitle:  { fontSize: 11, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 },
  photoRow:   { flexDirection: 'row', flexWrap: 'wrap' },
  photoBox:   { width: '48%', marginRight: '2%', marginBottom: 10 },
  photoImg:   { width: '100%', height: 140, objectFit: 'cover', borderRadius: 4, backgroundColor: '#F1F5F9' },
  photoLbl:   { fontSize: 7, color: '#64748B', marginTop: 3, textAlign: 'center' },
  // Footer
  footer:     { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTop: '0.5 solid #E2E8F0', paddingTop: 8 },
  footerTxt:  { fontSize: 8, color: '#94A3B8' },
  // Statut
  statutValidee: { backgroundColor: '#DCFCE7', color: '#15803D', padding: '3 8', borderRadius: 4, fontSize: 9, fontWeight: 'bold' },
  statutBrouillon: { backgroundColor: '#FEF3C7', color: '#D97706', padding: '3 8', borderRadius: 4, fontSize: 9, fontWeight: 'bold' },
})

const val = (obj, key, fallback = '—') => {
  const v = obj?.[key]
  return (v !== undefined && v !== null && v !== '') ? String(v) : fallback
}

const fmtDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function VisiteRapportPDF({ visite, dossierRef }) {
  const d = visite?.donnees || {}
  const photos = visite?.photos || []
  const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  // kWh cumac
  const COEF = { convectif: { H1: 7200, H2: 8000, H3: 8500 }, radiatif: { H1: 2500, H2: 2800, H3: 3000 } }
  const z = d.zone_climatique
  const kwhCumac = z ? Math.round(
    (COEF.convectif[z] || 0) * (parseFloat(d.puissance_convectif_kw) || 0) +
    (COEF.radiatif[z]  || 0) * (parseFloat(d.puissance_radiatif_kw)  || 0)
  ) : 0

  // Photos par catégorie (uniquement celles qui ont des photos)
  const photosParCat = PHOTO_CATEGORIES.map(cat => ({
    ...cat,
    items: photos.filter(p => p.categorie === cat.id),
  })).filter(c => c.items.length > 0)

  return (
    <Document title={`Rapport visite — ${dossierRef || visite?.id}`} author="SOFT.IA">
      {/* ── PAGE 1 : Infos + Technique ── */}
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.badge}>RAPPORT DE VISITE TECHNIQUE</Text>
            <Text style={s.title}>{val(d, 'nom_site', val(d, 'raison_sociale', 'Site sans nom'))}</Text>
            <Text style={s.subtitle}>{val(d, 'adresse_site', 'Adresse non renseignée')}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.dateText}>Généré le {now}</Text>
            {dossierRef && <Text style={s.refText}>Dossier {dossierRef}</Text>}
            <View style={{ marginTop: 6 }}>
              <Text style={visite?.statut === 'validée' ? s.statutValidee : s.statutBrouillon}>
                {visite?.statut === 'validée' ? 'VALIDÉE' : 'BROUILLON'}
              </Text>
            </View>
          </View>
        </View>

        {/* Infos générales */}
        <View style={s.section}>
          <Text style={s.sTitle}>Informations générales</Text>
          <View style={s.grid}>
            <View style={s.field}><Text style={s.fLabel}>Raison sociale</Text><Text style={s.fValue}>{val(d, 'raison_sociale')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Date de visite</Text><Text style={s.fValue}>{fmtDate(d.date_visite)}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Contact sur site</Text><Text style={s.fValue}>{val(d, 'contact_nom')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Téléphone contact</Text><Text style={s.fValue}>{val(d, 'contact_tel')}</Text></View>
            <View style={s.fieldFull}><Text style={s.fLabel}>Adresse du site</Text><Text style={s.fValue}>{val(d, 'adresse_site')}</Text></View>
            {d.notes_acces && <View style={s.fieldFull}><Text style={s.fLabel}>Notes d'accès</Text><Text style={s.fValue}>{d.notes_acces}</Text></View>}
          </View>
        </View>

        {/* Équipements existants */}
        <View style={s.section}>
          <Text style={s.sTitle}>Équipements existants</Text>
          <View style={s.grid}>
            <View style={s.field}><Text style={s.fLabel}>Type d'installation</Text><Text style={s.fValue}>{INSTAL_LABELS[d.type_installation] || val(d, 'type_installation')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>État général</Text><Text style={s.fValue}>{ETAT_LABELS[d.etat_general] || val(d, 'etat_general')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Marque</Text><Text style={s.fValue}>{val(d, 'marque')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Modèle</Text><Text style={s.fValue}>{val(d, 'modele')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Année de fabrication</Text><Text style={s.fValue}>{val(d, 'annee_fabrication')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Puissance nominale</Text><Text style={s.fValue}>{val(d, 'puissance_nominale_kw') !== '—' ? `${d.puissance_nominale_kw} kW` : '—'}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Combustible actuel</Text><Text style={s.fValue}>{COMBUST_LABELS[d.combustible] || val(d, 'combustible')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Régulation</Text><Text style={s.fValue}>{val(d, 'regulation')}</Text></View>
          </View>
        </View>

        {/* Données techniques */}
        <View style={s.section}>
          <Text style={s.sTitle}>Données techniques — IND-BA-110</Text>
          <View style={s.grid}>
            <View style={s.field}><Text style={s.fLabel}>Zone climatique</Text><Text style={s.fValue}>{val(d, 'zone_climatique')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Type de bâtiment</Text><Text style={s.fValue}>{BATIM_LABELS[d.type_batiment] || val(d, 'type_batiment')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Surface chauffée</Text><Text style={s.fValue}>{val(d, 'surface_chauffee_m2') !== '—' ? `${d.surface_chauffee_m2} m²` : '—'}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Hauteur sous plafond</Text><Text style={s.fValue}>{val(d, 'hauteur_sous_plafond_m') !== '—' ? `${d.hauteur_sous_plafond_m} m` : '—'}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Puissance convectif</Text><Text style={s.fValue}>{val(d, 'puissance_convectif_kw') !== '—' ? `${d.puissance_convectif_kw} kW` : '—'}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Puissance radiatif</Text><Text style={s.fValue}>{val(d, 'puissance_radiatif_kw') !== '—' ? `${d.puissance_radiatif_kw} kW` : '—'}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Heures fonct. / an</Text><Text style={s.fValue}>{val(d, 'heures_fonctionnement') !== '—' ? `${d.heures_fonctionnement} h` : '—'}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Température consigne</Text><Text style={s.fValue}>{val(d, 'temperature_consigne') !== '—' ? `${d.temperature_consigne} °C` : '—'}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Isolation bâtiment</Text><Text style={s.fValue}>{val(d, 'isolation_batiment')}</Text></View>
          </View>

        </View>

        {/* Réseau électrique */}
        <View style={s.section}>
          <Text style={s.sTitle}>Réseau électrique</Text>
          <View style={s.grid}>
            <View style={s.field}><Text style={s.fLabel}>Localisation TGBT</Text><Text style={s.fValue}>{val(d, 'tgbt_localisation')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Marque TGBT</Text><Text style={s.fValue}>{val(d, 'tgbt_marque')}</Text></View>
            <View style={s.field}><Text style={s.fLabel}>Puissance dispo. TGBT</Text><Text style={s.fValue}>{val(d, 'tgbt_puissance_a') !== '—' ? `${d.tgbt_puissance_a} A` : '—'}</Text></View>
            <View style={s.fieldFull}>{d.tgbt_observations && <><Text style={s.fLabel}>Obs. TGBT</Text><Text style={s.fValue}>{d.tgbt_observations}</Text></>}</View>
            <View style={s.field}><Text style={s.fLabel}>Localisation TD</Text><Text style={s.fValue}>{val(d, 'td_localisation')}</Text></View>
            <View style={s.fieldFull}>{d.td_observations && <><Text style={s.fLabel}>Obs. TD</Text><Text style={s.fValue}>{d.td_observations}</Text></>}</View>
          </View>
        </View>

        {/* Observations générales */}
        {d.observations_generales && (
          <View style={s.section}>
            <Text style={s.sTitle}>Observations générales</Text>
            <Text style={{ fontSize: 10, color: '#0F172A', lineHeight: 1.6 }}>{d.observations_generales}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>SOFT.IA — Rapport de visite technique IND-BA-110</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ── PAGE(S) PHOTOS ── une page par catégorie non vide ── */}
      {photosParCat.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 20, paddingBottom: 10, borderBottom: '1 solid #E2E8F0' }}>
            Photos de visite
          </Text>
          {photosParCat.map(cat => (
            <View key={cat.id} style={s.photoCat} wrap={false}>
              <Text style={s.pCatTitle}>{cat.icon} {cat.label} ({cat.items.length})</Text>
              <View style={s.photoRow}>
                {cat.items.map((photo, i) => (
                  <View key={photo.id} style={[s.photoBox, i % 2 === 1 ? { marginRight: 0 } : {}]}>
                    <Image src={photo.url} style={s.photoImg} />
                    <Text style={s.photoLbl}>{new Date(photo.taken_at).toLocaleString('fr-FR')}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Footer */}
          <View style={s.footer} fixed>
            <Text style={s.footerTxt}>SOFT.IA — Rapport de visite technique IND-BA-110</Text>
            <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      )}
    </Document>
  )
}
