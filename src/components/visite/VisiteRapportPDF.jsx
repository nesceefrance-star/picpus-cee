// VisiteRapportPDF.jsx — Rapport PDF visite technique (@react-pdf/renderer v4)
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { PHOTO_CATEGORIES } from './PhotoSection'

const ETAT_LABELS    = { bon: 'Bon état', moyen: 'État moyen', mauvais: 'Mauvais état', hors_service: 'Hors service' }
const COMBUST_LABELS = { gaz_naturel: 'Gaz naturel', gpl: 'GPL', fioul: 'Fioul', electricite: 'Électricité', bois_granules: 'Bois/Granulés', autre: 'Autre' }
const INSTAL_LABELS  = { chaudiere: 'Chaudière', aerotherme: 'Aérotherme', radiateur: 'Radiateur', generateur_air: 'Générateur air chaud', plancher_chauffant: 'Plancher chauffant', pompe_chaleur: 'Pompe à chaleur', autre: 'Autre' }
const BATIM_LABELS   = { atelier_industriel: 'Atelier industriel', entrepot_logistique: 'Entrepôt logistique', atelier_artisanal: 'Atelier artisanal', batiment_agricole: 'Bâtiment agricole', autre: 'Autre' }
const REGUL_LABELS   = { aucune: 'Aucune', thermostat_simple: 'Thermostat simple', programmable: 'Thermostat programmable', gestion_technique: 'Gestion technique bâtiment' }
const ISOL_LABELS    = {
  toiture_terrasse: 'Toiture terrasse', combles_perdus: 'Combles perdus',
  combles_amenages: 'Combles aménagés', murs_interieurs: 'Murs intérieurs',
  murs_exterieurs: 'Murs extérieurs', planchers_bas: 'Planchers bas',
}

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
  section:    { marginBottom: 16 },
  sTitle:     { fontSize: 12, fontWeight: 'bold', color: '#1D4ED8', marginBottom: 8, paddingBottom: 5, borderBottom: '0.5 solid #BFDBFE' },
  subTitle:   { fontSize: 10, fontWeight: 'bold', color: '#475569', marginBottom: 6, marginTop: 4 },
  // Grille de champs
  grid:       { flexDirection: 'row', flexWrap: 'wrap' },
  field:      { width: '50%', marginBottom: 7, paddingRight: 12 },
  fieldFull:  { width: '100%', marginBottom: 7 },
  field33:    { width: '33%', marginBottom: 7, paddingRight: 10 },
  fLabel:     { fontSize: 8, color: '#64748B', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  fValue:     { fontSize: 10, color: '#0F172A', fontWeight: 'bold' },
  // Highlight box (kWh cumac)
  highlight:  { backgroundColor: '#EFF6FF', padding: '10 14', borderRadius: 6, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  hLabel:     { fontSize: 8, color: '#1D4ED8', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  hValue:     { fontSize: 18, fontWeight: 'bold', color: '#1D4ED8' },
  hSub:       { fontSize: 8, color: '#3B82F6', marginTop: 2 },
  // Isolation chips
  isolChip:   { backgroundColor: '#F0FDF4', borderRadius: 4, padding: '3 8', marginRight: 6, marginBottom: 5 },
  isolText:   { fontSize: 9, color: '#15803D', fontWeight: 'bold' },
  // Plaque constructeur / notes longues
  noteBox:    { backgroundColor: '#F8FAFC', borderRadius: 4, padding: '8 10', marginTop: 4 },
  noteText:   { fontSize: 9, color: '#334155', lineHeight: 1.5 },
  // Photos
  photoCat:   { marginBottom: 16 },
  pCatTitle:  { fontSize: 11, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 },
  photoRow:   { flexDirection: 'row', marginBottom: 10 },
  photoBox:   { width: '48%', marginRight: '2%' },
  photoBoxLast: { width: '48%', marginRight: 0 },
  photoImg:   { width: '100%', height: 155, objectFit: 'cover', borderRadius: 4, backgroundColor: '#F1F5F9' },
  photoLbl:   { fontSize: 7, color: '#64748B', marginTop: 3, textAlign: 'center' },
  // Footer
  footer:     { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTop: '0.5 solid #E2E8F0', paddingTop: 8 },
  footerTxt:  { fontSize: 8, color: '#94A3B8' },
  // Statut
  statutValidee:   { backgroundColor: '#DCFCE7', color: '#15803D', padding: '3 8', borderRadius: 4, fontSize: 9, fontWeight: 'bold' },
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

// Regroupe un tableau en rangées de N éléments
const chunk = (arr, n) => {
  const result = []
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n))
  return result
}

// ── Composants réutilisables ─────────────────────────────────────────────────
const Field = ({ label, value, full, col33 }) => {
  if (value === '—' || !value) return null
  return (
    <View style={full ? s.fieldFull : col33 ? s.field33 : s.field}>
      <Text style={s.fLabel}>{label}</Text>
      <Text style={s.fValue}>{value}</Text>
    </View>
  )
}

const SectionTitle = ({ children }) => <Text style={s.sTitle}>{children}</Text>
const SubTitle     = ({ children }) => <Text style={s.subTitle}>{children}</Text>

export default function VisiteRapportPDF({ visite, dossierRef }) {
  const d      = visite?.donnees || {}
  const photos = (visite?.photos || []).filter(p => !p._status) // exclure photos locales non uploadées
  const now    = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  // kWh cumac IND-BA-110
  const COEF = { convectif: { H1: 7200, H2: 8000, H3: 8500 }, radiatif: { H1: 2500, H2: 2800, H3: 3000 } }
  const z = d.zone_climatique
  const kwhCumac = z ? Math.round(
    (COEF.convectif[z] || 0) * (parseFloat(d.puissance_convectif_kw) || 0) +
    (COEF.radiatif[z]  || 0) * (parseFloat(d.puissance_radiatif_kw)  || 0)
  ) : 0

  // Photos par catégorie (uniquement non vides)
  const photosParCat = PHOTO_CATEGORIES.map(cat => ({
    ...cat,
    items: photos.filter(p => p.categorie === cat.id),
  })).filter(c => c.items.length > 0)

  // Isolation : types cochés
  const isolTypes = ['toiture_terrasse','combles_perdus','combles_amenages','murs_interieurs','murs_exterieurs','planchers_bas']
    .filter(id => d[`isol_${id}`])
    .map(id => ({ id, label: ISOL_LABELS[id], surface: d[`isol_${id}_surface`] }))

  const fiches = (d.fiches || []).join(' / ') || '—'

  return (
    <Document title={`Rapport visite — ${dossierRef || visite?.id}`} author="SOFT.IA">

      {/* ══════════════════════════════════════════════════════════════
          PAGE 1 — Infos + Chaufferie / TGBT / TD
      ══════════════════════════════════════════════════════════════ */}
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
          <SectionTitle>Informations générales</SectionTitle>
          <View style={s.grid}>
            <Field label="Raison sociale"   value={val(d, 'raison_sociale')} />
            <Field label="Date de visite"   value={fmtDate(d.date_visite)} />
            <Field label="Contact sur site" value={val(d, 'contact_nom')} />
            <Field label="Téléphone contact" value={val(d, 'contact_tel')} />
            <Field label="Fiches CEE"       value={fiches} full />
            <Field label="Adresse du site"  value={val(d, 'adresse_site')} full />
            {d.notes_acces && <Field label="Notes d'accès" value={d.notes_acces} full />}
          </View>
        </View>

        {/* Chaufferie — Production */}
        {(d.type_installation || d.marque || d.puissance_nominale_kw) && (
          <View style={s.section}>
            <SectionTitle>Chaufferie</SectionTitle>

            <SubTitle>Production</SubTitle>
            <View style={s.grid}>
              <Field label="Type d'installation"   value={INSTAL_LABELS[d.type_installation] || val(d, 'type_installation')} />
              <Field label="État général"          value={ETAT_LABELS[d.etat_general] || val(d, 'etat_general')} />
              <Field label="Marque"                value={val(d, 'marque')} />
              <Field label="Modèle / Référence"    value={val(d, 'modele')} />
              <Field label="Année de fabrication"  value={val(d, 'annee_fabrication')} />
              <Field label="Puissance nominale"    value={d.puissance_nominale_kw ? `${d.puissance_nominale_kw} kW` : null} />
              <Field label="Combustible actuel"    value={COMBUST_LABELS[d.combustible] || val(d, 'combustible')} />
              <Field label="Régulation"            value={REGUL_LABELS[d.regulation] || val(d, 'regulation')} />
              <Field label="Température de consigne" value={d.temperature_consigne ? `${d.temperature_consigne} °C` : null} />
              <Field label="Heures de fonctionnement / an" value={d.heures_fonctionnement ? `${d.heures_fonctionnement} h` : null} />
              {d.bruleur === 'oui' && <>
                <Field label="Marque brûleur"  value={val(d, 'bruleur_marque')} />
                <Field label="Modèle brûleur"  value={val(d, 'bruleur_modele')} />
              </>}
            </View>

            {d.plaque_constructeur_notes && (
              <View>
                <Text style={s.fLabel}>Plaque constructeur</Text>
                <View style={s.noteBox}>
                  <Text style={s.noteText}>{d.plaque_constructeur_notes}</Text>
                </View>
              </View>
            )}

            {(d.chauf_nb_aerothermes || d.chauf_puissance_aero_kw || d.chauf_distribution_obs) && (
              <View style={{ marginTop: 8 }}>
                <SubTitle>Distribution</SubTitle>
                <View style={s.grid}>
                  <Field label="Nombre d'aérothèmes" value={val(d, 'chauf_nb_aerothermes')} />
                  <Field label="Puissance / aérothème" value={d.chauf_puissance_aero_kw ? `${d.chauf_puissance_aero_kw} kW` : null} />
                  {d.chauf_distribution_obs && <Field label="Observations distribution" value={d.chauf_distribution_obs} full />}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Réseau électrique */}
        {(d.tgbt_localisation || d.tgbt_marque || d.td_localisation) && (
          <View style={s.section}>
            <SectionTitle>Réseau électrique</SectionTitle>
            <View style={s.grid}>
              <Field label="Localisation TGBT"     value={val(d, 'tgbt_localisation')} />
              <Field label="Marque TGBT"           value={val(d, 'tgbt_marque')} />
              <Field label="Puissance dispo. TGBT" value={d.tgbt_puissance_a ? `${d.tgbt_puissance_a} A` : null} />
              {d.tgbt_observations && <Field label="Obs. TGBT" value={d.tgbt_observations} full />}
              <Field label="Localisation TD" value={val(d, 'td_localisation')} />
              {d.td_observations && <Field label="Obs. TD" value={d.td_observations} full />}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>SOFT.IA — Rapport de visite technique</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════════════
          PAGE 2 — Données techniques + Ventilation + Isolation + Observations
      ══════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>

        {/* Données techniques */}
        {(d.zone_climatique || d.surface_chauffee_m2 || d.puissance_convectif_kw) && (
          <View style={s.section}>
            <SectionTitle>Données techniques{fiches !== '—' ? ` — ${fiches}` : ''}</SectionTitle>
            <View style={s.grid}>
              <Field label="Zone climatique"     value={val(d, 'zone_climatique')} />
              <Field label="Type de bâtiment"    value={BATIM_LABELS[d.type_batiment] || val(d, 'type_batiment')} />
              <Field label="Surface chauffée"    value={d.surface_chauffee_m2 ? `${d.surface_chauffee_m2} m²` : null} />
              <Field label="Hauteur sous plafond" value={d.hauteur_sous_plafond_m ? `${d.hauteur_sous_plafond_m} m` : null} />
              <Field label="Puissance convectif" value={d.puissance_convectif_kw ? `${d.puissance_convectif_kw} kW` : null} />
              <Field label="Puissance radiatif"  value={d.puissance_radiatif_kw ? `${d.puissance_radiatif_kw} kW` : null} />
              <Field label="Isolation bâtiment"  value={val(d, 'isolation_batiment')} />
            </View>

            {kwhCumac > 0 && (
              <View style={s.highlight}>
                <View>
                  <Text style={s.hLabel}>Estimation kWh cumac</Text>
                  <Text style={s.hValue}>{kwhCumac.toLocaleString('fr-FR')} kWh</Text>
                  <Text style={s.hSub}>Zone {z} · Convectif {d.puissance_convectif_kw || 0} kW · Radiatif {d.puissance_radiatif_kw || 0} kW</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Ventilation */}
        {(d.ventil_simple_qty || d.ventil_double_qty) && (
          <View style={s.section}>
            <SectionTitle>Ventilation</SectionTitle>

            {(d.ventil_simple_qty || d.ventil_simple_marque) && (
              <View style={{ marginBottom: 8 }}>
                <SubTitle>Simple flux</SubTitle>
                <View style={s.grid}>
                  <Field label="Quantité d'unités"  value={val(d, 'ventil_simple_qty')} />
                  <Field label="Marque"             value={val(d, 'ventil_simple_marque')} />
                  <Field label="Débit d'air"        value={d.ventil_simple_debit ? `${d.ventil_simple_debit} m³/h` : null} />
                  <Field label="Surface ventilée"   value={d.ventil_simple_surface ? `${d.ventil_simple_surface} m²` : null} />
                </View>
              </View>
            )}

            {(d.ventil_double_qty || d.ventil_double_marque) && (
              <View>
                <SubTitle>Double flux / CTA</SubTitle>
                <View style={s.grid}>
                  <Field label="Quantité d'unités" value={val(d, 'ventil_double_qty')} />
                  <Field label="Marque"            value={val(d, 'ventil_double_marque')} />
                  <Field label="Débit d'air"       value={d.ventil_double_debit ? `${d.ventil_double_debit} m³/h` : null} />
                  <Field label="Surface ventilée"  value={d.ventil_double_surface ? `${d.ventil_double_surface} m²` : null} />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Isolation */}
        {isolTypes.length > 0 && (
          <View style={s.section}>
            <SectionTitle>Isolation</SectionTitle>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              {isolTypes.map(type => (
                <View key={type.id} style={s.isolChip}>
                  <Text style={s.isolText}>
                    {type.label}{type.surface ? ` — ${type.surface} m²` : ''}
                  </Text>
                </View>
              ))}
            </View>
            {d.isolation_observations && (
              <Field label="Observations isolation" value={d.isolation_observations} full />
            )}
          </View>
        )}

        {/* Observations générales */}
        {d.observations_generales && (
          <View style={s.section}>
            <SectionTitle>Observations générales</SectionTitle>
            <View style={s.noteBox}>
              <Text style={s.noteText}>{d.observations_generales}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>SOFT.IA — Rapport de visite technique</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════════════
          PAGES PHOTOS — une page par catégorie, rangées de 2
      ══════════════════════════════════════════════════════════════ */}
      {photosParCat.map(cat => (
        <Page key={cat.id} size="A4" style={s.page}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 16, paddingBottom: 8, borderBottom: '1 solid #E2E8F0' }}>
            {cat.icon} {cat.label} ({cat.items.length} photo{cat.items.length !== 1 ? 's' : ''})
          </Text>

          {chunk(cat.items, 2).map((row, ri) => (
            <View key={ri} style={s.photoRow} wrap={false}>
              {row.map((photo, i) => (
                <View key={photo.id} style={i === 0 ? s.photoBox : s.photoBoxLast}>
                  <Image src={photo.url} style={s.photoImg} />
                  <Text style={s.photoLbl}>{new Date(photo.taken_at).toLocaleString('fr-FR')}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={s.footer} fixed>
            <Text style={s.footerTxt}>SOFT.IA — Rapport de visite technique</Text>
            <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}

    </Document>
  )
}
