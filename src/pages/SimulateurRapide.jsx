import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

// ── Fiches ──────────────────────────────────────────────────────────────────
const FICHES = [
  { id: 'BAT-TH-142', label: 'BAT-TH-142', desc: 'Déstratification tertiaire', icon: '🌀' },
  { id: 'IND-BA-110', label: 'IND-BA-110', desc: 'Déstratification industrie', icon: '🏭' },
  { id: 'BAT-TH-163', label: 'BAT-TH-163', desc: 'PAC air/eau tertiaire',      icon: '♨️' },
  { id: 'BAT-TH-125', label: 'BAT-TH-125', desc: 'Ventilation simple flux',    icon: '💨' },
  { id: 'BAT-TH-126', label: 'BAT-TH-126', desc: 'Ventilation double flux',    icon: '🔄' },
  { id: 'BAT-EN-103', label: 'BAT-EN-103', desc: 'Isolation plancher bas',      icon: '🧱' },
]

// ── Formules CEE ────────────────────────────────────────────────────────────
const COEFFICIENTS_142 = {
  sport_transport: {
    convectif: {
      H1: { '5-7': 900,  '7-10': 2700, '10-15': 5100, '15-20': 7200, '20+': 8000 },
      H2: { '5-7': 1000, '7-10': 3100, '10-15': 5700, '15-20': 7800, '20+': 8600 },
      H3: { '5-7': 1300, '7-10': 4000, '10-15': 7000, '15-20': 9100, '20+': 9900 },
    },
    radiatif: {
      H1: { '5-7': 320, '7-10': 950,  '10-15': 1800, '15-20': 2500, '20+': 2800 },
      H2: { '5-7': 350, '7-10': 1090, '10-15': 2000, '15-20': 2700, '20+': 3000 },
      H3: { '5-7': 460, '7-10': 1400, '10-15': 2500, '15-20': 3200, '20+': 3500 },
    },
  },
  commerce_loisirs: {
    convectif: {
      H1: { '5-7': 600, '7-10': 2000, '10-15': 4000, '15-20': 5800, '20+': 6700 },
      H2: { '5-7': 700, '7-10': 2200, '10-15': 4400, '15-20': 6300, '20+': 7100 },
      H3: { '5-7': 900, '7-10': 2800, '10-15': 5200, '15-20': 7200, '20+': 8000 },
    },
    radiatif: {
      H1: { '5-7': 210, '7-10': 700,  '10-15': 1400, '15-20': 2000, '20+': 2300 },
      H2: { '5-7': 240, '7-10': 790,  '10-15': 1600, '15-20': 2200, '20+': 2500 },
      H3: { '5-7': 320, '7-10': 1000, '10-15': 1900, '15-20': 2500, '20+': 2800 },
    },
  },
}
const getHauteurBracket = (h) => {
  if (h >= 20) return '20+'
  if (h >= 15) return '15-20'
  if (h >= 10) return '10-15'
  if (h >= 7)  return '7-10'
  if (h >= 5)  return '5-7'
  return null
}
const calculerCumac142 = ({ typeLocal, zone, hauteur, pConvectif, pRadiatif }) => {
  const bracket = getHauteurBracket(hauteur)
  if (!bracket) return { kwhCumac: 0 }
  const coeffConv = COEFFICIENTS_142[typeLocal]?.convectif?.[zone]?.[bracket] || 0
  const coeffRad  = COEFFICIENTS_142[typeLocal]?.radiatif?.[zone]?.[bracket] || 0
  return { kwhCumac: Math.round(coeffConv * pConvectif + coeffRad * pRadiatif), coeffConv, coeffRad, bracket }
}

const COEFF_110 = {
  convectif: { H1: 7200, H2: 8000, H3: 8500 },
  radiatif:  { H1: 2500, H2: 2800, H3: 3000 },
}
const calculerCumac110 = ({ zone, pConvectif, pRadiatif }) => {
  const coeffConv = COEFF_110.convectif[zone] || 0
  const coeffRad  = COEFF_110.radiatif[zone]  || 0
  return { kwhCumac: Math.round(coeffConv * pConvectif + coeffRad * pRadiatif), coeffConv, coeffRad }
}

const COEFFICIENTS_163 = {
  pac_small: {
    'etas_111_126':  { H1: 1100, H2: 900,  H3: 600 },
    'etas_126_175':  { H1: 1200, H2: 1000, H3: 700 },
    'etas_175_plus': { H1: 1300, H2: 1000, H3: 700 },
  },
  pac_large: {
    'cop_3_4_4_5': { H1: 1100, H2: 900,  H3: 600 },
    'cop_4_5_plus': { H1: 1200, H2: 1000, H3: 700 },
  },
}
const FACTEURS_SECTEUR_163 = {
  bureaux: 1.2, sante: 1.1, commerces: 0.9,
  enseignement: 0.8, hotellerie_restauration: 0.7, autres: 0.7,
}
const calculerCumac163 = ({ zone, puissancePac, etasBracket, copBracket, surface, secteur }) => {
  const forfait = puissancePac === 'small'
    ? (COEFFICIENTS_163.pac_small[etasBracket]?.[zone] || 0)
    : (COEFFICIENTS_163.pac_large[copBracket]?.[zone] || 0)
  const facteurSecteur = FACTEURS_SECTEUR_163[secteur] || 0.7
  return { kwhCumac: Math.round(forfait * surface * facteurSecteur), forfait, facteurSecteur }
}

const COEFFICIENTS_125 = {
  modulee_proportionnelle: { H1: 770,  H2: 630, H3: 420 },
  modulee_presence:        { H1: 690,  H2: 560, H3: 380 },
  debit_constant:          { H1: 400,  H2: 330, H3: 220 },
}
const FACTEURS_SECTEUR_125 = {
  modulee_proportionnelle: { bureaux: 0.48, enseignement: 1, restauration: 0.59, autres: 0.54 },
  modulee_presence:        { bureaux: 0.40, enseignement: 1, restauration: 0.45, autres: 0.51 },
  debit_constant:          { bureaux: 0.40, enseignement: 1, restauration: 0.53, autres: 0.58 },
}
const calculerCumac125 = ({ zone, typeVentil, secteur, surface }) => {
  const coeff = COEFFICIENTS_125[typeVentil]?.[zone] || 0
  const fs    = FACTEURS_SECTEUR_125[typeVentil]?.[secteur] || 1
  return { kwhCumac: Math.round(coeff * fs * surface), coeff, facteurSecteur: fs }
}

const COEFFICIENTS_126 = {
  modulee_proportionnelle: { H1: 1000, H2: 830, H3: 560 },
  modulee_presence:        { H1: 970,  H2: 800, H3: 530 },
  debit_constant:          { H1: 850,  H2: 700, H3: 460 },
}
const FACTEURS_SECTEUR_126 = {
  modulee_proportionnelle: { bureaux: 0.53, enseignement: 1, restauration: 0.68, sportif: 0.22, autres: 0.71, salles_250: 1.88 },
  modulee_presence:        { bureaux: 0.51, enseignement: 1, restauration: 0.63, sportif: 0.17, autres: 0.71 },
  debit_constant:          { bureaux: 0.48, enseignement: 1, restauration: 0.61, sportif: 0.52, autres: 0.71, salles_250: 1.44 },
}
const calculerCumac126 = ({ zone, typeVentil, secteur, surface }) => {
  const coeff = COEFFICIENTS_126[typeVentil]?.[zone] || 0
  const fs    = FACTEURS_SECTEUR_126[typeVentil]?.[secteur] || 1
  return { kwhCumac: Math.round(coeff * fs * surface), coeff, facteurSecteur: fs }
}

const COEFFICIENTS_103 = { H1: 5200, H2: 4200, H3: 2800 }
const FACTEURS_SECTEUR_103 = {
  bureaux_enseignement_commerces: 0.6,
  hotellerie_restauration: 0.7,
  sante: 1.2,
  autres: 0.6,
}
const LABELS_SECTEUR_103 = {
  bureaux_enseignement_commerces: 'Bureaux / Enseignement / Commerces',
  hotellerie_restauration: 'Hôtellerie / Restauration',
  sante: 'Santé',
  autres: 'Autres secteurs',
}
const calculerCumac103 = ({ zone, secteur, surface }) => {
  const coeff = COEFFICIENTS_103[zone] || 0
  const fs    = FACTEURS_SECTEUR_103[secteur] || 0.6
  return { kwhCumac: Math.round(coeff * fs * surface), coeff, facteurSecteur: fs }
}

const puissanceTotale = (eqs) =>
  eqs.reduce((s, e) => s + (parseInt(e.quantite) || 0) * (parseFloat(e.puissance_unitaire_kw) || 0), 0)

const calculerNbDestrat = (hauteur, surface, debitUnitaire = 14000) => {
  if (!hauteur || !surface) return 0
  return Math.ceil((hauteur * surface * 0.7) / debitUnitaire)
}

const fmt = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('fr')
const fmtEur = (n) => {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(Math.round(n))
  const sign = n < 0 ? '-' : ''
  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1).replace('.', ',') + ' M€'
  if (abs >= 1000)    return sign + Math.round(abs / 1000) + ' k€'
  return sign + abs + ' €'
}

// ── État initial ─────────────────────────────────────────────────────────────
const INIT_FORM = {
  fiche_cee: 'BAT-TH-142',
  zone_climatique: 'H1',
  // Déstratification (142 + 110)
  type_local: 'sport_transport',
  surface_m2: '',
  hauteur_m: '',
  eqs_conv: [
    { label: 'Chaudières',  quantite: '', puissance_unitaire_kw: '' },
    { label: 'Aérothermes', quantite: '', puissance_unitaire_kw: '' },
  ],
  eqs_rad: [],
  debit_unitaire: '14000',
  nb_destrat_manuel: '',
  cout_unitaire_destrat: '2750',
  // BAT-TH-163
  puissance_pac: 'small',
  etas_bracket: 'etas_111_126',
  cop_bracket: 'cop_3_4_4_5',
  secteur_163: 'bureaux',
  cout_installation_163: '',
  bonification_163: false,
  // BAT-TH-125 / BAT-TH-126
  type_ventil: 'modulee_proportionnelle',
  secteur_ventil: 'enseignement',
  surface_ventilee: '',
  cout_installation_ventil: '',
  // BAT-EN-103
  secteur_103: 'bureaux_enseignement_commerces',
  surface_isolant_103: '',
  resistance_r_103: '',
  cout_installation_103: '',
}

const RESET_PER_FICHE = {
  fiche_cee: '', zone_climatique: 'H1',
  type_local: 'sport_transport',
  surface_m2: '', hauteur_m: '',
  eqs_conv: [
    { label: 'Chaudières',  quantite: '', puissance_unitaire_kw: '' },
    { label: 'Aérothermes', quantite: '', puissance_unitaire_kw: '' },
  ],
  eqs_rad: [],
  debit_unitaire: '14000', nb_destrat_manuel: '', cout_unitaire_destrat: '2750',
  puissance_pac: 'small', etas_bracket: 'etas_111_126', cop_bracket: 'cop_3_4_4_5',
  secteur_163: 'bureaux', cout_installation_163: '', bonification_163: false,
  type_ventil: 'modulee_proportionnelle', secteur_ventil: 'enseignement',
  surface_ventilee: '', cout_installation_ventil: '',
  secteur_103: 'bureaux_enseignement_commerces', surface_isolant_103: '',
  resistance_r_103: '', cout_installation_103: '',
}

// ── Sous-composants ──────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .4 }}>
      {children}
    </label>
  )
}

function NumInput({ value, onChange, placeholder, suffix }) {
  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: suffix ? '9px 36px 9px 12px' : '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
      {suffix && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMid }}>{suffix}</span>}
    </div>
  )
}

function BtnGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          style={{ flex: 1, minWidth: 0, padding: '8px 6px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
            background: value === o.id ? '#EFF6FF' : C.bg,
            border: `1px solid ${value === o.id ? C.accent : C.border}` }}>
          {o.icon && <div style={{ fontSize: 14, marginBottom: 2 }}>{o.icon}</div>}
          <div style={{ fontSize: 11, fontWeight: 700, color: value === o.id ? '#2563EB' : C.text }}>{o.label}</div>
          {o.sub && <div style={{ fontSize: 10, color: C.textSoft, marginTop: 1 }}>{o.sub}</div>}
        </button>
      ))}
    </div>
  )
}

function LigneEquip({ eq, onChange, onRemove, canRemove }) {
  const total = (parseInt(eq.quantite) || 0) * (parseFloat(eq.puissance_unitaire_kw) || 0)
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
      <input value={eq.label} onChange={e => onChange({ ...eq, label: e.target.value })} placeholder="Équipement"
        style={{ flex: 2, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
      <input type="number" value={eq.quantite} onChange={e => onChange({ ...eq, quantite: e.target.value })} placeholder="Qté" min="1"
        style={{ width: 52, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 6px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
      <div style={{ position: 'relative', width: 90 }}>
        <input type="number" value={eq.puissance_unitaire_kw} onChange={e => onChange({ ...eq, puissance_unitaire_kw: e.target.value })} placeholder="kW"
          style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 26px 7px 8px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
        <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: C.textMid }}>kW</span>
      </div>
      <div style={{ width: 64, textAlign: 'right', fontSize: 12, fontWeight: 700, color: total > 0 ? '#2563EB' : C.textSoft }}>
        {total > 0 ? `${total} kW` : '—'}
      </div>
      {canRemove
        ? <button type="button" onClick={onRemove} style={{ background: 'transparent', border: `1px solid #FECACA`, color: '#DC2626', borderRadius: 5, padding: '4px 6px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        : <div style={{ width: 28 }} />
      }
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function SimulateurRapide() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INIT_FORM)
  const [prixMwh, setPrixMwh] = useState('7.5')

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const switchFiche = (id) => {
    setForm({ ...RESET_PER_FICHE, fiche_cee: id })
  }

  const pConvectif = useMemo(() => puissanceTotale(form.eqs_conv), [form.eqs_conv])
  const pRadiatif  = useMemo(() => puissanceTotale(form.eqs_rad),  [form.eqs_rad])

  const nbDestratCalc = useMemo(() => {
    const h = parseFloat(form.hauteur_m) || 0
    const s = parseFloat(form.surface_m2) || 0
    return h > 0 && s > 0 ? calculerNbDestrat(h, s, parseInt(form.debit_unitaire) || 14000) : 0
  }, [form.hauteur_m, form.surface_m2, form.debit_unitaire])

  const nbDestrat = parseInt(form.nb_destrat_manuel) || nbDestratCalc

  const results = useMemo(() => {
    const prix = parseFloat(prixMwh) || 7.5
    const zone = form.zone_climatique
    let kwhCumac = 0
    let coutTotal = 0

    if (form.fiche_cee === 'BAT-TH-142') {
      const r = calculerCumac142({ typeLocal: form.type_local, zone, hauteur: parseFloat(form.hauteur_m) || 0, pConvectif, pRadiatif })
      kwhCumac = r.kwhCumac
      coutTotal = nbDestrat * (parseFloat(form.cout_unitaire_destrat) || 0)
    } else if (form.fiche_cee === 'IND-BA-110') {
      const r = calculerCumac110({ zone, pConvectif, pRadiatif })
      kwhCumac = r.kwhCumac
      coutTotal = nbDestrat * (parseFloat(form.cout_unitaire_destrat) || 0)
    } else if (form.fiche_cee === 'BAT-TH-163') {
      const r = calculerCumac163({ zone, puissancePac: form.puissance_pac, etasBracket: form.etas_bracket, copBracket: form.cop_bracket, surface: parseFloat(form.surface_m2) || 0, secteur: form.secteur_163 })
      kwhCumac = form.bonification_163 ? r.kwhCumac * 3 : r.kwhCumac
      coutTotal = parseFloat(form.cout_installation_163) || 0
    } else if (form.fiche_cee === 'BAT-TH-125') {
      const r = calculerCumac125({ zone, typeVentil: form.type_ventil, secteur: form.secteur_ventil, surface: parseFloat(form.surface_ventilee) || 0 })
      kwhCumac = r.kwhCumac
      coutTotal = parseFloat(form.cout_installation_ventil) || 0
    } else if (form.fiche_cee === 'BAT-TH-126') {
      const r = calculerCumac126({ zone, typeVentil: form.type_ventil, secteur: form.secteur_ventil, surface: parseFloat(form.surface_ventilee) || 0 })
      kwhCumac = r.kwhCumac
      coutTotal = parseFloat(form.cout_installation_ventil) || 0
    } else if (form.fiche_cee === 'BAT-EN-103') {
      const r = calculerCumac103({ zone, secteur: form.secteur_103, surface: parseFloat(form.surface_isolant_103) || 0 })
      kwhCumac = r.kwhCumac
      coutTotal = parseFloat(form.cout_installation_103) || 0
    }

    const mwhCumac   = Math.round(kwhCumac / 100) / 10
    const primeBrute  = Math.round(mwhCumac * prix)
    const primeNette  = Math.round(primeBrute * 0.9)
    const marge       = primeNette - coutTotal
    const rentable    = coutTotal > 0 ? marge > 0 : null

    return { kwhCumac, mwhCumac, primeBrute, primeNette, coutTotal, marge, rentable }
  }, [form, prixMwh, pConvectif, pRadiatif, nbDestrat])

  const handleCreerDossier = () => {
    navigate('/dossiers', {
      state: {
        openWizard: true,
        prefillFiche: form.fiche_cee,
        prefillTech: { ...form, nb_destrat_calcule: nbDestratCalc },
        prefillPrixMwh: prixMwh,
      },
    })
  }

  const isDestrat   = form.fiche_cee === 'BAT-TH-142' || form.fiche_cee === 'IND-BA-110'
  const is163       = form.fiche_cee === 'BAT-TH-163'
  const isVentil    = form.fiche_cee === 'BAT-TH-125' || form.fiche_cee === 'BAT-TH-126'
  const isIsolation = form.fiche_cee === 'BAT-EN-103'

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '24px 24px 40px', fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>⚡ Simulateur rapide CEE</div>
        <div style={{ fontSize: 13, color: C.textMid, marginTop: 4 }}>
          Calculez instantanément la rentabilité d'une opération sans créer de dossier client.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', maxWidth: 1100 }}>

        {/* ── Formulaire ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Sélection fiche */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>1. Sélectionnez la fiche CEE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {FICHES.map(f => (
                <button key={f.id} type="button" onClick={() => switchFiche(f.id)}
                  style={{ padding: '14px 10px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                    background: form.fiche_cee === f.id ? '#EFF6FF' : C.bg,
                    border: `2px solid ${form.fiche_cee === f.id ? C.accent : C.border}` }}>
                  <div style={{ fontSize: 20, marginBottom: 5 }}>{f.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: form.fiche_cee === f.id ? '#2563EB' : C.text }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: C.textSoft, marginTop: 2, lineHeight: 1.3 }}>{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Zone climatique */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>2. Zone climatique</div>
            <BtnGroup
              options={[
                { id: 'H1', label: 'H1', sub: 'Nord / Est' },
                { id: 'H2', label: 'H2', sub: 'Centre / Ouest' },
                { id: 'H3', label: 'H3', sub: 'Sud / Méditerranée' },
              ]}
              value={form.zone_climatique}
              onChange={v => setF('zone_climatique', v)}
            />
          </div>

          {/* Données techniques */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
              3. Données techniques — {FICHES.find(f => f.id === form.fiche_cee)?.icon} {form.fiche_cee}
            </div>

            {/* ── Déstratification (BAT-TH-142 + IND-BA-110) ── */}
            {isDestrat && (<>

              {/* Type de local (142 uniquement) */}
              {form.fiche_cee === 'BAT-TH-142' && (
                <div style={{ marginBottom: 14 }}>
                  <Label>Type de local</Label>
                  <BtnGroup
                    options={[
                      { id: 'sport_transport',  label: '🏟️ Sport / Transport',    sub: 'Hall sportif, entrepôt, gare…' },
                      { id: 'commerce_loisirs', label: '🏬 Commerce / Spectacles', sub: 'Grande surface, église…' },
                    ]}
                    value={form.type_local}
                    onChange={v => setF('type_local', v)}
                  />
                </div>
              )}

              {/* Surface + Hauteur */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div>
                  <Label>Surface du site</Label>
                  <NumInput value={form.surface_m2} onChange={v => setF('surface_m2', v)} placeholder="ex : 2000" suffix="m²" />
                </div>
                <div>
                  <Label>Hauteur sous plafond</Label>
                  <NumInput value={form.hauteur_m} onChange={v => setF('hauteur_m', v)} placeholder="ex : 8" suffix="m" />
                </div>
              </div>

              {/* Équipements convectifs */}
              <Card title="🌀 Chauffage convectif (chaudière, aérotherme, rooftop…)">
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, paddingLeft: 2 }}>
                  <span style={{ flex: 2, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3 }}>Équipement</span>
                  <span style={{ width: 52, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3, textAlign: 'center' }}>Qté</span>
                  <span style={{ width: 90, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3 }}>kW/unité</span>
                  <span style={{ width: 64, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3, textAlign: 'right' }}>Total</span>
                  <div style={{ width: 28 }} />
                </div>
                {form.eqs_conv.map((eq, i) => (
                  <LigneEquip key={i} eq={eq}
                    onChange={eq => setForm(f => ({ ...f, eqs_conv: f.eqs_conv.map((e, j) => j === i ? eq : e) }))}
                    onRemove={() => setForm(f => ({ ...f, eqs_conv: f.eqs_conv.filter((_, j) => j !== i) }))}
                    canRemove={form.eqs_conv.length > 1} />
                ))}
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, eqs_conv: [...f.eqs_conv, { label: '', quantite: '', puissance_unitaire_kw: '' }] }))}
                  style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                  + Ajouter
                </button>
                {pConvectif > 0 && (
                  <div style={{ fontSize: 11, color: '#2563EB', marginTop: 6, textAlign: 'right' }}>
                    P convectif total : <strong>{pConvectif.toLocaleString('fr')} kW</strong>
                  </div>
                )}
              </Card>

              {/* Équipements radiatifs */}
              <Card title="☀️ Chauffage radiatif (cassettes, panneaux radiants…) — optionnel">
                {form.eqs_rad.length === 0 && (
                  <div style={{ fontSize: 12, color: C.textSoft, fontStyle: 'italic', marginBottom: 6 }}>Aucun équipement radiatif</div>
                )}
                {form.eqs_rad.map((eq, i) => (
                  <LigneEquip key={i} eq={eq}
                    onChange={eq => setForm(f => ({ ...f, eqs_rad: f.eqs_rad.map((e, j) => j === i ? eq : e) }))}
                    onRemove={() => setForm(f => ({ ...f, eqs_rad: f.eqs_rad.filter((_, j) => j !== i) }))}
                    canRemove={true} />
                ))}
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, eqs_rad: [...f.eqs_rad, { label: '', quantite: '', puissance_unitaire_kw: '' }] }))}
                  style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Ajouter
                </button>
                {pRadiatif > 0 && (
                  <div style={{ fontSize: 11, color: '#D97706', marginTop: 6, textAlign: 'right' }}>
                    P radiatif total : <strong>{pRadiatif.toLocaleString('fr')} kW</strong>
                  </div>
                )}
              </Card>

              {/* Déstratificateurs */}
              <Card title="🌀 Déstratificateurs">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <div>
                    <Label>Débit unitaire</Label>
                    <BtnGroup
                      options={[
                        { id: '14000', label: '14 000 m³/h' },
                        { id: '8500',  label: '8 500 m³/h' },
                      ]}
                      value={form.debit_unitaire}
                      onChange={v => setF('debit_unitaire', v)}
                    />
                  </div>
                  <div>
                    <Label>Nb calculé auto</Label>
                    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', fontSize: 13, fontWeight: 700, color: '#2563EB', minHeight: 38, marginBottom: 14 }}>
                      {nbDestratCalc > 0 ? (
                        <>{nbDestratCalc} <span style={{ fontSize: 10, color: C.textSoft, fontWeight: 400, marginLeft: 4 }}>= ⌈{form.surface_m2}×{form.hauteur_m}×0,7÷{parseInt(form.debit_unitaire).toLocaleString('fr')}⌉</span></>
                      ) : <span style={{ color: C.textSoft, fontWeight: 400, fontSize: 12 }}>Saisir surface et hauteur</span>}
                    </div>
                  </div>
                  <div>
                    <Label>Nb destrats (manuel)</Label>
                    <NumInput value={form.nb_destrat_manuel} onChange={v => setF('nb_destrat_manuel', v)} placeholder={nbDestratCalc || 'auto'} />
                    <div style={{ fontSize: 10, color: C.textSoft, marginTop: -10, marginBottom: 14 }}>Laisser vide = calcul auto</div>
                  </div>
                  <div>
                    <Label>Coût unitaire</Label>
                    <NumInput value={form.cout_unitaire_destrat} onChange={v => setF('cout_unitaire_destrat', v)} placeholder="2750" suffix="€" />
                  </div>
                </div>
                {nbDestrat > 0 && form.cout_unitaire_destrat && (
                  <div style={{ padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, color: C.textMid }}>
                    Coût total prestation : <strong style={{ color: '#D97706' }}>{(nbDestrat * parseFloat(form.cout_unitaire_destrat || 0)).toLocaleString('fr')} €</strong>
                    <span style={{ marginLeft: 8 }}>({nbDestrat} × {parseFloat(form.cout_unitaire_destrat || 0).toLocaleString('fr')} €)</span>
                  </div>
                )}
              </Card>
            </>)}

            {/* ── PAC air/eau (BAT-TH-163) ── */}
            {is163 && (<>
              {/* Puissance PAC */}
              <div style={{ marginBottom: 14 }}>
                <Label>Puissance PAC</Label>
                <BtnGroup
                  options={[
                    { id: 'small', label: '≤ 400 kW', sub: 'Bracket par Etas' },
                    { id: 'large', label: '> 400 kW', sub: 'Bracket par COP' },
                  ]}
                  value={form.puissance_pac}
                  onChange={v => setF('puissance_pac', v)}
                />
              </div>

              {/* Etas (small) */}
              {form.puissance_pac === 'small' && (
                <div style={{ marginBottom: 14 }}>
                  <Label>Etas de la PAC</Label>
                  <BtnGroup
                    options={[
                      { id: 'etas_111_126',  label: '111% ≤ Etas < 126%' },
                      { id: 'etas_126_175',  label: '126% ≤ Etas < 175%' },
                      { id: 'etas_175_plus', label: 'Etas ≥ 175%' },
                    ]}
                    value={form.etas_bracket}
                    onChange={v => setF('etas_bracket', v)}
                  />
                </div>
              )}

              {/* COP (large) */}
              {form.puissance_pac === 'large' && (
                <div style={{ marginBottom: 14 }}>
                  <Label>COP de la PAC</Label>
                  <BtnGroup
                    options={[
                      { id: 'cop_3_4_4_5',  label: '3,4 ≤ COP < 4,5' },
                      { id: 'cop_4_5_plus', label: 'COP ≥ 4,5' },
                    ]}
                    value={form.cop_bracket}
                    onChange={v => setF('cop_bracket', v)}
                  />
                </div>
              )}

              {/* Surface */}
              <div style={{ marginBottom: 14 }}>
                <Label>Surface du site</Label>
                <NumInput value={form.surface_m2} onChange={v => setF('surface_m2', v)} placeholder="ex : 1200" suffix="m²" />
              </div>

              {/* Secteur */}
              <div style={{ marginBottom: 14 }}>
                <Label>Secteur d'activité</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    { id: 'bureaux',               label: 'Bureaux',         facteur: '×1,2' },
                    { id: 'sante',                  label: 'Santé',           facteur: '×1,1' },
                    { id: 'commerces',              label: 'Commerces',       facteur: '×0,9' },
                    { id: 'enseignement',           label: 'Enseignement',    facteur: '×0,8' },
                    { id: 'hotellerie_restauration',label: 'Hôtel. / Restau.',facteur: '×0,7' },
                    { id: 'autres',                 label: 'Autres',          facteur: '×0,7' },
                  ].map(s => (
                    <button key={s.id} type="button" onClick={() => setF('secteur_163', s.id)}
                      style={{ padding: '8px 6px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                        background: form.secteur_163 === s.id ? '#EFF6FF' : C.bg,
                        border: `1px solid ${form.secteur_163 === s.id ? C.accent : C.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: form.secteur_163 === s.id ? '#2563EB' : C.text }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: form.secteur_163 === s.id ? '#2563EB' : C.textSoft }}>{s.facteur}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Coût installation */}
              <div style={{ marginBottom: 14 }}>
                <Label>Coût installation PAC</Label>
                <NumInput value={form.cout_installation_163} onChange={v => setF('cout_installation_163', v)} placeholder="ex : 45000" suffix="€" />
              </div>

              {/* Bonification ×3 */}
              <div onClick={() => setF('bonification_163', !form.bonification_163)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: form.bonification_163 ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${form.bonification_163 ? '#86EFAC' : C.border}`, borderRadius: 8, padding: '11px 16px', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${form.bonification_163 ? '#16A34A' : C.border}`, background: form.bonification_163 ? '#16A34A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                  {form.bonification_163 && <span style={{ color: '#fff', fontSize: 13, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: form.bonification_163 ? '#16A34A' : C.text }}>Bonification ×3</div>
                  <div style={{ fontSize: 11, color: C.textSoft }}>Multiplie le volume cumac par 3</div>
                </div>
                {form.bonification_163 && <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#DCFCE7', borderRadius: 5, padding: '3px 8px', marginLeft: 'auto' }}>×3 ACTIF</span>}
              </div>
            </>)}

            {/* ── Ventilation (BAT-TH-125 + BAT-TH-126) ── */}
            {isVentil && (<>
              {/* Type ventilation */}
              <div style={{ marginBottom: 14 }}>
                <Label>Type de ventilation</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { id: 'modulee_proportionnelle', label: 'Modulée proportionnelle',        desc: 'Variable selon CO₂ ou nombre d\'occupants' },
                    { id: 'modulee_presence',        label: 'Modulée à détection de présence', desc: 'Asservie à des capteurs de présence' },
                    { id: 'debit_constant',          label: 'Débit d\'air constant',           desc: 'Débit fixe nominal' },
                  ].filter(t => !(form.fiche_cee === 'BAT-TH-126' && form.secteur_ventil === 'salles_250' && t.id === 'modulee_presence'))
                   .map(t => (
                    <button key={t.id} type="button" onClick={() => setF('type_ventil', t.id)}
                      style={{ padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        background: form.type_ventil === t.id ? '#EFF6FF' : C.bg,
                        border: `1px solid ${form.type_ventil === t.id ? C.accent : C.border}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: form.type_ventil === t.id ? '#2563EB' : C.text }}>{t.label}</div>
                      <div style={{ fontSize: 10, color: C.textSoft, marginTop: 1 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Secteur */}
              <div style={{ marginBottom: 14 }}>
                <Label>Secteur d'activité</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { id: 'bureaux',      label: 'Bureaux' },
                    { id: 'enseignement', label: 'Enseignement (×1)' },
                    { id: 'restauration', label: 'Restauration' },
                    ...(form.fiche_cee === 'BAT-TH-126' ? [
                      { id: 'sportif',    label: 'Établissement sportif' },
                      { id: 'salles_250', label: 'Salles > 250 m³', disabled: form.type_ventil === 'modulee_presence' },
                    ] : []),
                    { id: 'autres', label: 'Autres locaux' },
                  ].map(s => (
                    <button key={s.id} type="button" disabled={s.disabled}
                      onClick={() => !s.disabled && setF('secteur_ventil', s.id)}
                      style={{ padding: '8px 10px', borderRadius: 7, cursor: s.disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', textAlign: 'center', opacity: s.disabled ? .4 : 1,
                        background: form.secteur_ventil === s.id ? '#EFF6FF' : C.bg,
                        border: `1px solid ${form.secteur_ventil === s.id ? C.accent : C.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: form.secteur_ventil === s.id ? '#2563EB' : C.text }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: C.textSoft, marginTop: 1 }}>
                        ×{(form.fiche_cee === 'BAT-TH-125' ? FACTEURS_SECTEUR_125 : FACTEURS_SECTEUR_126)[form.type_ventil]?.[s.id] ?? '—'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Surface + coût */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div>
                  <Label>Surface ventilée</Label>
                  <NumInput value={form.surface_ventilee} onChange={v => setF('surface_ventilee', v)} placeholder="ex : 800" suffix="m²" />
                </div>
                <div>
                  <Label>Coût installation</Label>
                  <NumInput value={form.cout_installation_ventil} onChange={v => setF('cout_installation_ventil', v)} placeholder="ex : 25000" suffix="€" />
                </div>
              </div>
            </>)}

            {/* ── Isolation plancher bas (BAT-EN-103) ── */}
            {isIsolation && (<>
              {/* Résistance thermique R */}
              <div style={{ marginBottom: 14 }}>
                <Label>Résistance thermique R (m².K/W)</Label>
                <NumInput
                  value={form.resistance_r_103}
                  onChange={v => setF('resistance_r_103', v)}
                  placeholder="ex : 3.5"
                  suffix="m².K/W"
                />
                {parseFloat(form.resistance_r_103) > 0 && parseFloat(form.resistance_r_103) < 3 && (
                  <div style={{ fontSize: 11, color: '#DC2626', marginTop: -8, marginBottom: 8 }}>⚠️ R doit être ≥ 3 m².K/W pour l'éligibilité CEE</div>
                )}
                {parseFloat(form.resistance_r_103) >= 3 && (
                  <div style={{ fontSize: 11, color: '#16A34A', marginTop: -8, marginBottom: 8 }}>✓ R conforme (≥ 3 m².K/W)</div>
                )}
              </div>

              {/* Secteur */}
              <div style={{ marginBottom: 14 }}>
                <Label>Secteur d'activité</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {Object.entries(LABELS_SECTEUR_103).map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setF('secteur_103', id)}
                      style={{ padding: '8px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                        background: form.secteur_103 === id ? '#EFF6FF' : C.bg,
                        border: `1px solid ${form.secteur_103 === id ? C.accent : C.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: form.secteur_103 === id ? '#2563EB' : C.text }}>{label}</div>
                      <div style={{ fontSize: 10, color: C.textSoft, marginTop: 1 }}>×{FACTEURS_SECTEUR_103[id]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Surface + coût */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div>
                  <Label>Surface d'isolant</Label>
                  <NumInput value={form.surface_isolant_103} onChange={v => setF('surface_isolant_103', v)} placeholder="ex : 500" suffix="m²" />
                </div>
                <div>
                  <Label>Coût installation</Label>
                  <NumInput value={form.cout_installation_103} onChange={v => setF('cout_installation_103', v)} placeholder="ex : 18000" suffix="€" />
                </div>
              </div>
            </>)}
          </div>
        </div>

        {/* ── Panel résultats (sticky) ──────────────────────────────────── */}
        <div style={{ width: 300, flexShrink: 0, position: 'sticky', top: 24 }}>

          {/* Prix MWh */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8, fontWeight: 600 }}>Prix de valorisation MWh cumac</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" value={prixMwh} onChange={e => setPrixMwh(e.target.value)} step="0.1" min="1"
                style={{ flex: 1, background: C.bg, border: `1px solid ${C.accent}`, borderRadius: 7, padding: '8px 10px', color: '#2563EB', fontSize: 16, fontWeight: 800, outline: 'none', fontFamily: 'inherit', textAlign: 'right' }} />
              <span style={{ fontSize: 13, color: C.textMid, fontWeight: 600 }}>€/MWh</span>
            </div>
          </div>

          {/* Résultats */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 18px', marginBottom: 12 }}>

            {/* kWh cumac */}
            <div style={{ textAlign: 'center', padding: '12px 0 16px', borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.textSoft, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Volume CUMAC</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: results.kwhCumac > 0 ? C.accent : C.textSoft, lineHeight: 1 }}>
                {results.kwhCumac > 0 ? fmt(results.kwhCumac) : '—'}
              </div>
              <div style={{ fontSize: 12, color: C.textSoft, marginTop: 2 }}>kWh cumac</div>
              {results.mwhCumac > 0 && (
                <div style={{ fontSize: 13, color: C.textMid, fontWeight: 700, marginTop: 4 }}>= {results.mwhCumac.toLocaleString('fr')} MWh</div>
              )}
            </div>

            {/* Lignes financières */}
            {[
              { label: 'Prime brute', value: results.primeBrute,  color: '#2563EB', note: `${results.mwhCumac} MWh × ${prixMwh} €` },
              { label: 'Prime nette (×0,9)',    value: results.primeNette,  color: '#059669', note: 'TVA déduite' },
              { label: 'Coût installation',     value: results.coutTotal,   color: '#D97706', note: null },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: C.textMid, fontWeight: 600 }}>{row.label}</div>
                  {row.note && <div style={{ fontSize: 10, color: C.textSoft }}>{row.note}</div>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: row.value > 0 ? row.color : C.textSoft }}>
                  {row.value > 0 ? fmtEur(row.value) : '—'}
                </div>
              </div>
            ))}

            {/* Séparateur */}
            <div style={{ borderTop: `2px solid ${C.border}`, margin: '10px 0 12px' }} />

            {/* Marge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Marge nette</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: results.marge > 0 ? '#16A34A' : results.marge < 0 ? '#DC2626' : C.textSoft }}>
                {results.coutTotal > 0 ? fmtEur(results.marge) : '—'}
              </div>
            </div>

            {/* Badge rentabilité */}
            {results.rentable !== null && (
              <div style={{ textAlign: 'center', padding: '8px 12px', borderRadius: 8, background: results.rentable ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${results.rentable ? '#86EFAC' : '#FECACA'}`, marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: results.rentable ? '#16A34A' : '#DC2626' }}>
                  {results.rentable ? '✓ Opération rentable' : '✗ Opération non rentable'}
                </div>
                {!results.rentable && results.marge < 0 && (
                  <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>
                    Écart : {fmtEur(Math.abs(results.marge))} à combler
                  </div>
                )}
              </div>
            )}
            {results.rentable === null && results.kwhCumac > 0 && (
              <div style={{ textAlign: 'center', padding: '8px 12px', borderRadius: 8, background: '#F8FAFC', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, color: C.textSoft }}>Saisir le coût d'installation pour voir la rentabilité</div>
              </div>
            )}
            {results.kwhCumac === 0 && (
              <div style={{ textAlign: 'center', padding: '8px 12px', borderRadius: 8, background: '#F8FAFC', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, color: C.textSoft }}>Renseignez les données techniques pour voir le résultat</div>
              </div>
            )}
          </div>

          {/* CTA Créer dossier */}
          <button onClick={handleCreerDossier} disabled={results.kwhCumac === 0}
            style={{ width: '100%', padding: '13px 16px', background: results.kwhCumac > 0 ? C.accent : '#CBD5E1', border: 'none', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: results.kwhCumac > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', lineHeight: 1.3, transition: 'background .15s' }}>
            ➕ Créer le dossier client
            <div style={{ fontSize: 11, fontWeight: 400, opacity: .85, marginTop: 3 }}>Compléter avec infos client &amp; site →</div>
          </button>
          {results.kwhCumac === 0 && (
            <div style={{ fontSize: 11, color: C.textSoft, textAlign: 'center', marginTop: 6 }}>
              Renseignez d'abord les données techniques
            </div>
          )}

          {/* Reset */}
          <button onClick={() => setForm(INIT_FORM)}
            style={{ width: '100%', marginTop: 8, padding: '9px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Réinitialiser
          </button>
        </div>
      </div>
    </div>
  )
}
