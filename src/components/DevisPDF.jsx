import {
  Document, Page, Text, View, StyleSheet, Line, Svg, Image,
} from '@react-pdf/renderer'
import logoSrc from '../assets/logo.png'

// ─── Palette ────────────────────────────────────────────────────────────────
const BLUE   = '#2563EB'
const DARK   = '#1E293B'
const GRAY   = '#64748B'
const LGRAY  = '#F8FAFC'
const BORDER = '#E2E8F0'
const GREEN  = '#16A34A'

// ─── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:      { backgroundColor: '#fff', padding: '14mm 14mm 12mm 14mm', fontSize: 8, fontFamily: 'Helvetica', color: '#1E293B' },
  // Header
  hdrRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  company:   { fontSize: 14, fontFamily: 'Helvetica-Bold', color: DARK },
  compSub:   { fontSize: 6.5, color: GRAY, lineHeight: 1.5, marginTop: 2 },
  devisRef:  { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  devisMeta: { fontSize: 6.5, color: GRAY, textAlign: 'right', marginTop: 2, lineHeight: 1.5 },
  hr:        { borderBottomWidth: 0.5, borderBottomColor: BORDER, marginVertical: 5 },
  hrBlue:    { borderBottomWidth: 2, borderBottomColor: BLUE, marginBottom: 6 },
  // Client bloc
  clientRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  clientName:{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  clientSub: { fontSize: 7, color: GRAY, lineHeight: 1.6 },
  siteBox:   { width: 180, fontSize: 7, color: GRAY, lineHeight: 1.6 },
  // Table
  thRow:     { flexDirection: 'row', backgroundColor: DARK, paddingVertical: 4, paddingHorizontal: 5 },
  th:        { fontSize: 7.5, color: '#fff', fontFamily: 'Helvetica-Bold' },
  catRow:    { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 5 },
  catTxt:    { fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  tdRow:     { flexDirection: 'row', paddingVertical: 3.5, paddingHorizontal: 5 },
  td:        { fontSize: 7.5, color: '#333' },
  // Totaux
  totRow:    { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  totBox:    { width: 230 },
  totLine:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totLbl:    { fontSize: 7.5, color: GRAY },
  totVal:    { fontSize: 7.5, textAlign: 'right' },
  // Section titres
  sTitle:    { fontSize: 10, fontFamily: 'Helvetica-Bold', color: DARK, borderBottomWidth: 2, borderBottomColor: BLUE, paddingBottom: 3, marginBottom: 8 },
  // Conditions
  condTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2, textDecoration: 'underline' },
  condText:  { fontSize: 7, color: GRAY, lineHeight: 1.65, marginBottom: 6 },
  // Footer
  footer:    { borderTopWidth: 0.5, borderTopColor: BORDER, marginTop: 'auto', paddingTop: 5 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  footerTxt: { fontSize: 6.5, color: '#aaa', flex: 1 },
  footerPage:{ fontSize: 6.5, color: '#aaa', textAlign: 'right', flexShrink: 0, marginLeft: 8 },
  // Paraphe
  parapheBox:{ width: 80, borderWidth: 0.5, borderColor: BORDER, borderRadius: 2, padding: '3pt 5pt', marginLeft: 8, flexShrink: 0 },
  parapheLbl:{ fontSize: 5.5, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  parapheArea:{ height: 18 },
  // Récap signature
  recapBox:  { backgroundColor: LGRAY, borderWidth: 0.5, borderColor: BORDER, padding: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12 },
  recapItem: { minWidth: 90 },
  recapLbl:  { fontSize: 6, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1 },
  recapVal:  { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  // Champs signature
  sigLabel:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#333', marginBottom: 3 },
  sigLine:   { borderBottomWidth: 1, borderBottomColor: '#999', width: '55%', height: 18, marginBottom: 12 },
  sigBox:    { borderWidth: 0.5, borderColor: BORDER, height: 38, borderRadius: 2, backgroundColor: LGRAY, marginBottom: 2 },
  sigGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  sigGridItem:{ width: '47%' },
  // Alerte
  alertBox:  { marginTop: 10, padding: 7, backgroundColor: '#FFFBEB', borderWidth: 0.5, borderColor: '#FCD34D', borderRadius: 2 },
  alertText: { fontSize: 7, color: '#78350F', lineHeight: 1.65 },
})

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt  = n => {
  const num = Number(n || 0)
  const [int, dec] = num.toFixed(2).split('.')
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')
  return intFmt + ',' + dec
}
const fmtE = n => fmt(n) + ' €'

const CAT_COLORS = {
  'MATÉRIEL':     { bg: '#EFF6FF', text: '#1D4ED8' },
  "MAIN D'ŒUVRE": { bg: '#F0FDF4', text: '#15803D' },
  'DIVERS':       { bg: '#FFF7ED', text: '#C2410C' },
}

// ─── Sous-composants ────────────────────────────────────────────────────────
function HR() {
  return <View style={s.hr} />
}
function HRBlue() {
  return <View style={s.hrBlue} />
}

function Header({ devis, params }) {
  return (
    <>
      <View style={s.hdrRow}>
        <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <Image src={logoSrc} style={{ width: 90, height: 90, objectFit: 'contain' }} />
          <Text style={s.compSub}>
            {params.societeAdresse || '2 Rue de la Darse — 94600 Choisy le Roi'}{'\n'}
            SIRET {params.societeSiret || '881 279 665 00023'} — TVA {params.societeTVA || 'FR 238 812 796 65'}
          </Text>
        </View>
        <View>
          <Text style={s.devisRef}>Devis {devis.refDevis || '—'} du {params.dateDevis || devis.dateDevis || '—'}</Text>
          <Text style={s.devisMeta}>
            {params.numeroRGE ? `N° ${params.numeroRGE}` : ''}
          </Text>
        </View>
      </View>
      <HR />
    </>
  )
}

function Footer({ params }) {
  return (
    <View style={s.footer} fixed>
      <View style={s.footerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.footerTxt}>
            {params.societeNom || 'AF2E'} — {params.societeAdresse || '2 RUE DE LA DARSE — 94600 CHOISY LE ROI'} — SIRET {params.societeSiret || '881 279 665 00023'} — TVA {params.societeTVA || 'FR 238 812 796 65'}
          </Text>
          <Text style={[s.footerTxt, { marginTop: 1 }]}>
            {params.rcs ? `RCS ${params.rcs} — ` : ''}{params.capital ? `Capital ${params.capital} — ` : ''}Assurance décennale {params.assuranceNum || ''}
          </Text>
        </View>
        <View style={s.parapheBox}>
          <Text style={s.parapheLbl}>Paraphe</Text>
          <View style={s.parapheArea} />
        </View>
        <Text style={s.footerPage} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </View>
  )
}

function LigneTableau({ lignes, cats, batQte, batPuVente }) {
  return (
    <View>
      {/* En-tête tableau */}
      <View style={s.thRow}>
        <Text style={[s.th, { flex: 1 }]}>Désignation</Text>
        <Text style={[s.th, { width: 35, textAlign: 'center' }]}>Qté</Text>
        <Text style={[s.th, { width: 65, textAlign: 'right' }]}>P.U. HT</Text>
        <Text style={[s.th, { width: 35, textAlign: 'center' }]}>TVA</Text>
        <Text style={[s.th, { width: 70, textAlign: 'right' }]}>Montant HT</Text>
      </View>

      {/* Ligne BAT (rétro-compat anciens devis) */}
      {batQte > 0 && (
        <>
          <View style={[s.catRow, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[s.catTxt, { color: '#1D4ED8' }]}>BAT-TH-142 — Déstratification d'air</Text>
          </View>
          <View style={[s.tdRow, { backgroundColor: '#FAFAFA' }]}>
            <Text style={[s.td, { flex: 1, fontSize: 7, lineHeight: 1.4 }]}>TECH DES-14000 — Débit 14 000 m³/h — Asservissement : OUI</Text>
            <Text style={[s.td, { width: 35, textAlign: 'center' }]}>{batQte} U</Text>
            <Text style={[s.td, { width: 65, textAlign: 'right' }]}>{fmt(batPuVente)}</Text>
            <Text style={[s.td, { width: 35, textAlign: 'center' }]}>20%</Text>
            <Text style={[s.td, { width: 70, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmt(batQte * batPuVente)}</Text>
          </View>
        </>
      )}

      {/* Lignes par catégorie */}
      {cats.map(cat => {
        const cl = lignes.filter(l => l.cat === cat)
        const cc = CAT_COLORS[cat] || { bg: '#F5F5F5', text: '#333' }
        return [
          <View key={'h' + cat} style={[s.catRow, { backgroundColor: cc.bg }]}>
            <Text style={[s.catTxt, { color: cc.text }]}>{cat}</Text>
          </View>,
          ...cl.map((l, ri) => (
            <View key={l.id} style={[s.tdRow, { backgroundColor: ri % 2 === 0 ? '#fff' : '#FAFAFA' }]}>
              <Text style={[s.td, { flex: 1, fontSize: 7, lineHeight: 1.4 }]}>{l.designation}</Text>
              <Text style={[s.td, { width: 35, textAlign: 'center' }]}>{fmt(l.qte)} {l.unite}</Text>
              <Text style={[s.td, { width: 65, textAlign: 'right' }]}>{fmt(l.puVente)}</Text>
              <Text style={[s.td, { width: 35, textAlign: 'center' }]}>20%</Text>
              <Text style={[s.td, { width: 70, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmt(l.qte * l.puVente)}</Text>
            </View>
          )),
        ]
      })}
    </View>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export function DevisPDFDoc({ devis, lignes, cats, batPuVente, batQte, primeFaciale, primeCEESimu, stats, params = {} }) {

  const conditions = params.conditions || [
    { t: '1. Portée du devis', c: 'Établi sur la base des informations fournies. Toute modification substantielle fera l\'objet d\'un avenant signé avant exécution.' },
    { t: '2. Conditions d\'exécution', c: 'Conformité NF C 15-100, NF EN 60439-4. Toute contrainte spécifique devra être signalée avant le début des travaux. Les délais sont indicatifs.' },
    { t: '3. Travaux non inclus', c: 'Modification de l\'infrastructure électrique existante, génie civil, percement de murs. Toute prestation supplémentaire fera l\'objet d\'un avenant.' },
    { t: '4. Stockage matériel', c: 'Espace de stockage sécurisé à fournir par le client. Le client est responsable du matériel après livraison jusqu\'à réception des travaux.' },
    { t: '5. Site occupé', c: 'Mesures de coordination et sécurité spécifiques requises. Planning d\'intervention à valider. Retards liés à l\'exploitation peuvent impacter les coûts.' },
    { t: '6. Garanties', c: `Garantie constructeur sur les équipements. Main-d'œuvre garantie 2 ans à compter de la réception. Assurance décennale ${devis.sousTraitant || 'DC LINK'} n° ${devis.rgeNum || 'AU 084 742'} (valable ${devis.rgeValidite || '31/12/2026'}).` },
    { t: '7. Paiement', c: `${params.condPaiement || 'Règlement comptant à réception de facture. Pénalités au taux légal + 5 points (art. L.441-10 Code de commerce). Indemnité forfaitaire 40 €.'}` },
    { t: '8. Sous-traitance', c: `Le bénéficiaire accepte l'intervention de ${devis.sousTraitant || 'DC LINK'}, mandatée par ${params.societeNom || 'AF2E'}, titulaire du RGE n° ${devis.rgeNum || 'AU 084 742'} valable jusqu\'au ${devis.rgeValidite || '31/12/2026'}.` },
  ]

  const validite = params.validiteJours || 30

  return (
    <Document title={`Devis ${devis.refDevis || ''} — ${devis.nomClient || ''}`} author={params.societeNom || 'AF2E'}>

      {/* ════ PAGE 1 — DEVIS ════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <Header devis={devis} params={params} />

        {/* Ligne A: infos client (gauche) + destinataire (droite) */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
          {/* Gauche — infos administratives */}
          <View style={{ flex: 1 }}>
            <Text style={[s.clientSub, { fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 3 }]}>Informations client</Text>
            <Text style={s.clientSub}>Unité monétaire : Euro (€)</Text>
            {devis.siret ? <Text style={s.clientSub}>SIRET : {devis.siret}</Text> : null}
            {devis.codeNAF ? <Text style={s.clientSub}>Code NAF : {devis.codeNAF}</Text> : null}
            {devis.telephoneClient ? <Text style={s.clientSub}>Tél. : {devis.telephoneClient}</Text> : null}
            {devis.emailClient ? <Text style={s.clientSub}>Email : {devis.emailClient}</Text> : null}
          </View>
          {/* Droite — destinataire */}
          <View style={{ width: 200, borderLeftWidth: 0.5, borderLeftColor: '#E2E8F0', paddingLeft: 12 }}>
            <Text style={s.clientName}>{devis.nomClient || 'CLIENT'}</Text>
            {(devis.nomContact || devis.fonctionContact) ? (
              <Text style={s.clientSub}>
                À l'attention de {devis.nomContact || ''}{devis.fonctionContact ? ` — ${devis.fonctionContact}` : ''}
              </Text>
            ) : null}
            {devis.adresseSiege ? <Text style={[s.clientSub, { marginTop: 3 }]}>{devis.adresseSiege}</Text> : null}
          </View>
        </View>

        {/* Ligne B: site intervention */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 3, padding: '5pt 8pt', marginBottom: 8, flexDirection: 'row', gap: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={[s.clientSub, { fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 2 }]}>Adresse des travaux :</Text>
            <Text style={s.clientSub}>{devis.adresseSite || '—'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.clientSub}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Posé par : </Text>
              {devis.sousTraitant || 'DC LINK'}
            </Text>
            {params.dateVisiteTechnique ? (
              <Text style={[s.clientSub, { marginTop: 2 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Visite technique : </Text>
                Réalisée le {params.dateVisiteTechnique} par {devis.sousTraitant || 'DC LINK'}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Tableau */}
        <LigneTableau lignes={lignes} cats={cats} batQte={batQte} batPuVente={batPuVente} />

        {/* Totaux */}
        <View style={s.totRow}>
          <View style={s.totBox}>
            {[
              { l: 'Total H.T',              v: fmtE(stats.totalHT) },
              { l: 'TVA (20%)',              v: fmtE(stats.totalTVA) },
              { l: 'Total T.T.C',            v: fmtE(stats.totalTTC),     bold: true, bt: true },
              { l: `Prime CEE (SOFT.IA)`, v: '− ' + fmtE(primeFaciale), color: GREEN, bt: true },
              { l: 'Reste à charge T.T.C',  v: fmtE(stats.resteTTC),    bold: true, color: DARK, bt: true },
            ].map((r, i) => (
              <View key={i} style={[s.totLine, r.bt ? { borderTopWidth: 0.5, borderTopColor: '#ccc' } : {}]}>
                <Text style={[s.totLbl, r.bold ? { fontFamily: 'Helvetica-Bold', color: r.color || DARK } : { color: r.color || GRAY }]}>{r.l}</Text>
                <Text style={[s.totVal, r.bold ? { fontFamily: 'Helvetica-Bold', color: r.color || DARK } : { color: r.color || DARK }]}>{r.v}</Text>
              </View>
            ))}
          </View>
        </View>

        <Footer params={params} />
      </Page>

      {/* ════ PAGE 2 — CONDITIONS ════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <Header devis={devis} params={params} />

        <Text style={s.sTitle}>Réserves et conditions</Text>

        {conditions.map(({ t, c }) => (
          <View key={t} style={{ marginBottom: 7 }}>
            <Text style={s.condTitle}>{t}</Text>
            <Text style={s.condText}>{c}</Text>
          </View>
        ))}

        <HR />

        <Text style={[s.condTitle, { fontSize: 8, marginBottom: 3 }]}>Termes et conditions CEE</Text>
        <Text style={s.condText}>
          {params.mentionCEE ||
            `Les travaux objet du présent document donneront lieu à une contribution financière de SOFT.IA (SIREN 533 333 118), sous réserve de la fourniture exclusive des documents CEE et de la validation du dossier. Montant estimé : ${fmtE(primeCEESimu || primeFaciale)}.`}
        </Text>

        {params.cgv ? (
          <>
            <HR />
            <Text style={[s.condTitle, { fontSize: 8, marginBottom: 3 }]}>Conditions Générales de Vente</Text>
            <Text style={s.condText}>{params.cgv}</Text>
          </>
        ) : null}

        {params.mentionLegale ? (
          <>
            <HR />
            <Text style={[s.condTitle, { fontSize: 8, marginBottom: 3 }]}>Mentions légales</Text>
            <Text style={s.condText}>{params.mentionLegale}</Text>
          </>
        ) : null}

        <Footer params={params} />
      </Page>

      {/* ════ PAGE 3 — SIGNATURE ════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <Header devis={devis} params={params} />

        <Text style={s.sTitle}>Acceptation du devis</Text>

        {/* Récapitulatif */}
        <View style={s.recapBox}>
          {[
            { l: 'Devis n°',   v: devis.refDevis || '—' },
            { l: 'Date',       v: devis.dateDevis || '—' },
            { l: 'Visite tech.', v: params.dateVisiteTechnique || '—' },
            { l: 'Client',     v: devis.nomClient || '—' },
            { l: 'Total TTC',  v: fmtE(stats.totalTTC) },
            { l: 'Prime CEE',  v: '− ' + fmtE(primeFaciale) },
            { l: 'Reste TTC',  v: fmtE(stats.resteTTC), color: GREEN, bold: true },
          ].map(r => (
            <View key={r.l} style={s.recapItem}>
              <Text style={s.recapLbl}>{r.l}</Text>
              <Text style={[s.recapVal, { color: r.color || DARK, fontFamily: r.bold ? 'Helvetica-Bold' : 'Helvetica' }]}>{r.v}</Text>
            </View>
          ))}
        </View>

        {/* Champs identité */}
        {['Nom :', 'Prénom :', 'Fonction :'].map(f => (
          <View key={f}>
            <Text style={s.sigLabel}>{f}</Text>
            <View style={s.sigLine} />
          </View>
        ))}

        <Text style={[s.condText, { marginBottom: 8 }]}>Date, Signature et cachet précédés des mentions manuscrites suivantes :</Text>

        <View style={s.sigGrid}>
          {['1) Lu et approuvé :', '2) Bon pour accord :', '3) Date :', '4) Signature :'].map(m => (
            <View key={m} style={s.sigGridItem}>
              <Text style={s.sigLabel}>{m}</Text>
              <View style={s.sigBox} />
            </View>
          ))}
        </View>

        <View>
          <Text style={s.sigLabel}>5) Cachet :</Text>
          <View style={[s.sigBox, { width: '46%', height: 55 }]} />
        </View>

        <View style={s.alertBox}>
          <Text style={s.alertText}>
            ⚠ Important : Devis valable {validite} jours. L'acceptation vaut commande ferme et engage le client à fournir tous les documents CEE requis avant tout début de travaux.
          </Text>
        </View>

        <Footer params={params} />
      </Page>

    </Document>
  )
}
