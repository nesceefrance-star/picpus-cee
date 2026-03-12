import { useState, useEffect, useRef } from 'react'
import useStore from '../store/useStore'

// ── Fiches CEE disponibles ────────────────────────────────────────────────────
const FICHES = [
  { id: 'BAT-TH-142', label: 'BAT-TH-142', desc: 'Déstratification d\'air chaud', icon: '🌀' },
  { id: 'BAT-TH-116', label: 'BAT-TH-116', desc: 'Système de GTB', icon: '🏗️' },
  { id: 'IND-BA-110', label: 'IND-BA-110', desc: 'Déstratification industrie', icon: '🏭' },
]

// ── Tables officielles BAT-TH-142 vA54.3 (kWh cumac par kW de chauffage) ─────
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
      H1: { '5-7': 210, '7-10': 700, '10-15': 1400, '15-20': 2000, '20+': 2300 },
      H2: { '5-7': 250, '7-10': 770, '10-15': 1500, '15-20': 2200, '20+': 2500 },
      H3: { '5-7': 320, '7-10': 980, '10-15': 1800, '15-20': 2500, '20+': 2800 },
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
  const kwhCumac  = Math.round(coeffConv * pConvectif + coeffRad * pRadiatif)
  return { kwhCumac, coeffConv, coeffRad, bracket }
}

const getZoneClimatique = (codePostal) => {
  const cp = parseInt(codePostal?.substring(0, 2) || '0')
  if ([97, 98].includes(cp) || [13, 83, 84, 30, 34, 11, 66].includes(cp)) return 'H3'
  if ([17, 16, 33, 40, 64, 65, 32, 31, 9, 12, 46, 47, 82, 81, 48,
       44, 85, 49, 53, 72, 37, 41, 28, 45, 36, 23, 87, 19, 15,
       43, 63, 3, 18, 58, 71, 21, 89, 10].includes(cp)) return 'H2'
  return 'H1'
}

const calculerNbDestrat = (hauteur, surface, debitUnitaire = 14000) => {
  if (!hauteur || !surface) return 0
  return Math.ceil((hauteur * surface * 0.7) / debitUnitaire)
}

// Puissance totale d'une liste d'équipements (quantité × puissance unitaire)
const puissanceTotale = (equipements) =>
  equipements.reduce((s, e) => s + (parseInt(e.quantite) || 0) * (parseFloat(e.puissance_unitaire_kw) || 0), 0)

const C = {
  bg: '#0F172A', surface: '#1E293B', border: '#334155',
  text: '#F1F5F9', textMid: '#94A3B8', textSoft: '#475569',
  accent: '#2563EB', green: '#16A34A',
}

function Field({ label, value, onChange, type = 'text', placeholder, required, suffix, disabled }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required} disabled={disabled}
          style={{ width: '100%', boxSizing: 'border-box', background: disabled ? '#0a1120' : C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: suffix ? '9px 44px 9px 12px' : '9px 12px', color: disabled ? C.textSoft : C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
        />
        {suffix && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMid }}>{suffix}</span>}
      </div>
    </div>
  )
}

function RaisonSocialeAutocomplete({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const timer = useRef(null)

  const search = (q) => {
    onChange(q)
    clearTimeout(timer.current)
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&limit=6`)
        const data = await res.json()
        setSuggestions(data.results || [])
        setOpen(true)
      } catch { setSuggestions([]) }
    }, 350)
  }

  const select = (item) => {
    const siege = item.siege || {}
    onSelect({
      raison_sociale: item.nom_complet || item.nom_raison_sociale || '',
      siret: siege.siret || '',
      adresse: [siege.numero_voie, siege.type_voie, siege.libelle_voie].filter(Boolean).join(' '),
      code_postal: siege.code_postal || '',
      ville: siege.libelle_commune || '',
    })
    setSuggestions([]); setOpen(false)
  }

  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
        Raison sociale <span style={{ color: '#EF4444' }}>*</span>
        <span style={{ marginLeft: 6, fontSize: 10, color: '#60A5FA', fontWeight: 400, textTransform: 'none' }}>autocomplétion SIRET</span>
      </label>
      <input value={value} onChange={e => search(e.target.value)} onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="KIABI LOGISTIQUE…"
        style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0F172A', border: `1px solid ${C.border}`, borderRadius: 8, zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,.5)', maxHeight: 220, overflowY: 'auto' }}>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => select(s)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.nom_complet || s.nom_raison_sociale}</div>
              <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>SIRET {s.siege?.siret || '—'} · {s.siege?.libelle_commune || ''} ({s.siege?.code_postal || ''})</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdresseAutocomplete({ label, value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const timer = useRef(null)

  const search = (q) => {
    onChange(q)
    clearTimeout(timer.current)
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`)
        const data = await res.json()
        setSuggestions(data.features || [])
        setOpen(true)
      } catch { setSuggestions([]) }
    }, 300)
  }

  const select = (feat) => {
    const p = feat.properties
    onSelect({ adresse_site: p.name + ', ' + p.city, code_postal_site: p.postcode || '', ville_site: p.city || '' })
    onChange(p.label || '')
    setSuggestions([]); setOpen(false)
  }

  return (
    <div style={{ position: 'relative', marginBottom: 14, gridColumn: '1/-1' }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
        {label}
        <span style={{ marginLeft: 6, fontSize: 10, color: '#60A5FA', fontWeight: 400, textTransform: 'none' }}>autocomplétion adresse</span>
      </label>
      <input value={value} onChange={e => search(e.target.value)} onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="771 Rue de la Plaine, Lauwin-Planque…"
        style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0F172A', border: `1px solid ${C.border}`, borderRadius: 8, zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
          {suggestions.map((f, i) => (
            <div key={i} onClick={() => select(f)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {f.properties.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Ligne équipement : label | quantité | puissance unitaire | total auto ─────
function LigneEquipement({ eq, onChange, onRemove, canRemove }) {
  const total = (parseInt(eq.quantite) || 0) * (parseFloat(eq.puissance_unitaire_kw) || 0)
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
      <input value={eq.label} onChange={e => onChange({ ...eq, label: e.target.value })}
        placeholder="Type d'équipement"
        style={{ flex: 2, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
      <div style={{ position: 'relative', width: 64 }}>
        <input type="number" value={eq.quantite} onChange={e => onChange({ ...eq, quantite: e.target.value })}
          placeholder="Qté" min="0"
          style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 6px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
      </div>
      <div style={{ position: 'relative', width: 100 }}>
        <input type="number" value={eq.puissance_unitaire_kw} onChange={e => onChange({ ...eq, puissance_unitaire_kw: e.target.value })}
          placeholder="kW/u"
          style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 28px 8px 8px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
        <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: C.textMid }}>kW</span>
      </div>
      <div style={{ width: 72, textAlign: 'right', fontSize: 12, fontWeight: 700, color: total > 0 ? '#60A5FA' : C.textSoft }}>
        {total > 0 ? `= ${total} kW` : '—'}
      </div>
      {canRemove && (
        <button type="button" onClick={onRemove}
          style={{ background: 'transparent', border: `1px solid #450a0a`, color: '#EF4444', borderRadius: 6, padding: '5px 7px', fontSize: 11, cursor: 'pointer' }}>✕</button>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function NouveauDossierWizard({ onClose, onCreate }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { createProspect, createDossier, createSimulation, user, profiles, fetchProfiles } = useStore()

  useEffect(() => { fetchProfiles() }, [])

  // Étape 1 — Client
  const [client, setClient] = useState({
    raison_sociale: '', siret: '', adresse: '', code_postal: '', ville: '',
    contact_nom: '', contact_email: '', contact_tel: '',
  })
  const setC = (k, v) => setClient(c => ({ ...c, [k]: v }))

  // Étape 2 — Données techniques
  const [tech, setTech] = useState({
    fiche_cee: 'BAT-TH-142',
    type_local: 'sport_transport',
    adresse_site_label: '', adresse_site: '', code_postal_site: '', ville_site: '',
    zone_climatique: '',
    surface_m2: '', hauteur_m: '',
    // Équipements convectifs : quantité × puissance unitaire
    equipements_convectifs: [
      { label: 'Chaudières',  quantite: '', puissance_unitaire_kw: '' },
      { label: 'Aérothermes', quantite: '', puissance_unitaire_kw: '' },
    ],
    // Équipements radiatifs (optionnel)
    equipements_radiatifs: [],
    // Déstratificateurs
    debit_unitaire: '14000',
    nb_destrat_calcule: 0,
    nb_destrat_manuel: '',
    cout_unitaire_destrat: '2750',
  })
  const setT = (k, v) => setTech(t => ({ ...t, [k]: v }))

  const [prixMwh, setPrixMwh] = useState('7.5')
  const [simulation, setSimulation] = useState(null)
  const [assigneA, setAssigneA] = useState(user?.id || '')

  const commerciaux = profiles.filter(p => ['admin', 'commercial'].includes(p.role))

  // Puissances totales
  const pConvectif = puissanceTotale(tech.equipements_convectifs)
  const pRadiatif  = puissanceTotale(tech.equipements_radiatifs)
  const pTotal     = pConvectif + pRadiatif

  const detecterZone = (cp) => {
    const zone = getZoneClimatique(cp)
    setTech(t => ({ ...t, zone_climatique: zone, code_postal_site: cp }))
  }

  // Recalcul nb destrats auto
  useEffect(() => {
    const h = parseFloat(tech.hauteur_m) || 0
    const s = parseFloat(tech.surface_m2) || 0
    const debit = parseInt(tech.debit_unitaire) || 14000
    if (h > 0 && s > 0) setTech(t => ({ ...t, nb_destrat_calcule: calculerNbDestrat(h, s, debit) }))
    else setTech(t => ({ ...t, nb_destrat_calcule: 0 }))
  }, [tech.hauteur_m, tech.surface_m2, tech.debit_unitaire])

  const nbDestratEffectif = parseInt(tech.nb_destrat_manuel) || tech.nb_destrat_calcule || 0

  const updateEquipConv = (i, eq) =>
    setTech(t => ({ ...t, equipements_convectifs: t.equipements_convectifs.map((e, j) => j === i ? eq : e) }))
  const removeEquipConv = (i) =>
    setTech(t => ({ ...t, equipements_convectifs: t.equipements_convectifs.filter((_, j) => j !== i) }))
  const addEquipConv = () =>
    setTech(t => ({ ...t, equipements_convectifs: [...t.equipements_convectifs, { label: `Équipement ${t.equipements_convectifs.length + 1}`, quantite: '', puissance_unitaire_kw: '' }] }))

  const updateEquipRad = (i, eq) =>
    setTech(t => ({ ...t, equipements_radiatifs: t.equipements_radiatifs.map((e, j) => j === i ? eq : e) }))
  const removeEquipRad = (i) =>
    setTech(t => ({ ...t, equipements_radiatifs: t.equipements_radiatifs.filter((_, j) => j !== i) }))
  const addEquipRad = () =>
    setTech(t => ({ ...t, equipements_radiatifs: [...t.equipements_radiatifs, { label: `Équipement ${t.equipements_radiatifs.length + 1}`, quantite: '', puissance_unitaire_kw: '' }] }))

  const calculerSimulation = () => {
    const prix   = parseFloat(prixMwh) || 7.5
    const hauteur = parseFloat(tech.hauteur_m) || 0
    const cout   = parseFloat(tech.cout_unitaire_destrat) || 2750

    let kwhCumac = 0
    let details  = {}

    if (tech.fiche_cee === 'BAT-TH-142') {
      const res = calculerCumac142({
        typeLocal: tech.type_local,
        zone: tech.zone_climatique || 'H2',
        hauteur,
        pConvectif,
        pRadiatif,
      })
      kwhCumac = res.kwhCumac
      details = res
    }
    // BAT-TH-116 et IND-BA-110 : calcul à implémenter selon leurs fiches ADEME
    // Pour l'instant on retourne 0 avec un message

    const prime     = Math.round(kwhCumac * (prix / 1000) * 100) / 100
    const coutTotal = nbDestratEffectif * cout
    const marge     = Math.round((prime - coutTotal) * 100) / 100

    setSimulation({ kwhCumac, mwhCumac: Math.round(kwhCumac / 100) / 10, prixMwh: prix, prime, coutTotal, marge, rentable: marge > 0, nbDestrat: nbDestratEffectif, pConvectif, pRadiatif, ...details })
    setStep(3)
  }

  const canCalculer = tech.zone_climatique && tech.hauteur_m && parseFloat(tech.hauteur_m) >= 5

  const submit = async () => {
    setLoading(true); setError(null)
    try {
      const { data: prospect, error: e1 } = await createProspect({
        raison_sociale: client.raison_sociale, siret: client.siret,
        adresse: client.adresse, code_postal: client.code_postal, ville: client.ville,
        contact_nom: client.contact_nom, contact_email: client.contact_email, contact_tel: client.contact_tel,
      })
      if (e1) throw new Error(e1.message || e1.details || JSON.stringify(e1))
      if (!prospect) throw new Error('Prospect non créé (vérifiez les permissions Supabase)')

      const ref = `PICPUS-${Date.now().toString().slice(-6)}`
      const { data: dossier, error: e2 } = await createDossier({
        prospect_id: prospect.id,
        fiche_cee: tech.fiche_cee,
        statut: simulation?.marge > 0 ? 'prospect' : 'simulation',
        assigne_a: assigneA || user?.id,
        ref,
        prime_estimee: simulation?.prime ?? null,
        montant_devis: simulation?.coutTotal ?? null,
        notes: `Zone ${tech.zone_climatique} | h=${tech.hauteur_m}m | ${tech.surface_m2}m² | ${nbDestratEffectif} destrats | P_conv=${pConvectif}kW P_rad=${pRadiatif}kW | ${simulation?.kwhCumac?.toLocaleString('fr')} kWh cumac | Marge: ${simulation?.marge}€`,
      })
      if (e2) throw new Error(e2.message || e2.details || JSON.stringify(e2))
      if (!dossier) throw new Error('Dossier non créé (vérifiez les permissions Supabase)')

      // Simulation : erreur non bloquante (le dossier est déjà créé)
      const { error: e3 } = await createSimulation({
        dossier_id: dossier.id,
        fiche_cee: tech.fiche_cee,
        hauteur_m: parseFloat(tech.hauteur_m) || null,
        zone_climatique: tech.zone_climatique,
        nb_equipements: nbDestratEffectif,
        puissance_kw: pTotal,
        mwh_cumac: simulation?.mwhCumac,
        prime_estimee: simulation?.prime,
        prix_mwh: simulation?.prixMwh,
        rentable: simulation?.rentable,
        parametres: {
          type_local: tech.type_local,
          surface_m2: parseFloat(tech.surface_m2) || null,
          equipements_convectifs: tech.equipements_convectifs,
          equipements_radiatifs: tech.equipements_radiatifs,
          p_convectif: pConvectif,
          p_radiatif: pRadiatif,
          kwh_cumac: simulation?.kwhCumac,
          debit_unitaire: tech.debit_unitaire,
          nb_destrat_calcule: tech.nb_destrat_calcule,
          nb_destrat_manuel: tech.nb_destrat_manuel,
          cout_unitaire_destrat: tech.cout_unitaire_destrat,
          cout_total: simulation?.coutTotal,
          marge: simulation?.marge,
        },
      })
      if (e3) console.warn('Simulation non sauvegardée :', e3.message || e3)

      setLoading(false)
      onCreate(dossier)
      onClose()
    } catch (e) {
      console.error('Erreur création dossier :', e)
      setError(e.message || String(e) || 'Erreur inconnue')
      setLoading(false)
    }
  }

  const stepLabels = ['Informations client', 'Données techniques', 'Simulation & Validation']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: 640, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 30px 70px rgba(0,0,0,.7)' }} onClick={e => e.stopPropagation()}>

        {/* Header stepper */}
        <div style={{ padding: '22px 28px 16px', position: 'sticky', top: 0, background: C.surface, zIndex: 10, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>➕ Nouveau dossier CEE</div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMid, fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'flex' }}>
            {stepLabels.map((label, i) => {
              const n = i + 1; const active = step === n; const done = step > n
              return (
                <div key={n} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                  {i > 0 && <div style={{ position: 'absolute', left: 0, top: 13, width: '50%', height: 2, background: done || active ? C.accent : C.border }} />}
                  {i < 2 && <div style={{ position: 'absolute', right: 0, top: 13, width: '50%', height: 2, background: done ? C.accent : C.border }} />}
                  <div style={{ width: 26, height: 26, borderRadius: '50%', margin: '0 auto 5px', background: active ? C.accent : done ? '#16A34A' : C.bg, border: `2px solid ${active ? C.accent : done ? '#16A34A' : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: active || done ? '#fff' : C.textSoft, position: 'relative', zIndex: 1 }}>
                    {done ? '✓' : n}
                  </div>
                  <div style={{ fontSize: 10, color: active ? C.text : C.textSoft, fontWeight: active ? 600 : 400 }}>{label}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '20px 28px 28px' }}>

          {/* ── Étape 1 : Client ── */}
          {step === 1 && (
            <>
              <RaisonSocialeAutocomplete value={client.raison_sociale} onChange={v => setC('raison_sociale', v)}
                onSelect={d => setClient(c => ({ ...c, raison_sociale: d.raison_sociale, siret: d.siret || c.siret, adresse: d.adresse || c.adresse, code_postal: d.code_postal || c.code_postal, ville: d.ville || c.ville }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="SIRET" value={client.siret} onChange={v => setC('siret', v)} placeholder="34772795000094" />
                <Field label="Ville" value={client.ville} onChange={v => setC('ville', v)} placeholder="Lauwin-Planque" />
                <div style={{ gridColumn: '1/-1' }}><Field label="Adresse" value={client.adresse} onChange={v => setC('adresse', v)} placeholder="771 Rue de la Plaine" /></div>
                <Field label="Code postal" value={client.code_postal} onChange={v => setC('code_postal', v)} placeholder="59553" />
                <Field label="Contact" value={client.contact_nom} onChange={v => setC('contact_nom', v)} placeholder="Fabien Van De Ginste" />
                <Field label="Email contact" value={client.contact_email} onChange={v => setC('contact_email', v)} type="email" placeholder="contact@societe.fr" />
                <Field label="Téléphone" value={client.contact_tel} onChange={v => setC('contact_tel', v)} placeholder="06 XX XX XX XX" />
              </div>
              <button disabled={!client.raison_sociale} onClick={() => setStep(2)}
                style={{ width: '100%', padding: '12px', background: C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8, opacity: !client.raison_sociale ? .5 : 1 }}>
                Suivant →
              </button>
            </>
          )}

          {/* ── Étape 2 : Données techniques ── */}
          {step === 2 && (
            <>
              {/* Fiche CEE */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .4 }}>Fiche CEE *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {FICHES.map(f => (
                    <button key={f.id} type="button" onClick={() => setT('fiche_cee', f.id)}
                      style={{ flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', background: tech.fiche_cee === f.id ? '#172033' : C.bg, border: `1px solid ${tech.fiche_cee === f.id ? C.accent : C.border}` }}>
                      <div style={{ fontSize: 16, marginBottom: 3 }}>{f.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: tech.fiche_cee === f.id ? '#60A5FA' : C.text }}>{f.label}</div>
                      <div style={{ fontSize: 10, color: C.textSoft, marginTop: 2 }}>{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Type de local (BAT-TH-142 uniquement) */}
              {tech.fiche_cee === 'BAT-TH-142' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .4 }}>Type de local *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { id: 'sport_transport',  label: '🏟️ Sport / Transport',    desc: 'Hall sportif, entrepôt, gare…' },
                      { id: 'commerce_loisirs', label: '🏬 Commerce / Spectacles', desc: 'Grande surface, salle de spectacle, église…' },
                    ].map(t => (
                      <button key={t.id} type="button" onClick={() => setT('type_local', t.id)}
                        style={{ flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: tech.type_local === t.id ? '#172033' : C.bg, border: `1px solid ${tech.type_local === t.id ? C.accent : C.border}` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: tech.type_local === t.id ? '#60A5FA' : C.text }}>{t.label}</div>
                        <div style={{ fontSize: 10, color: C.textSoft, marginTop: 2 }}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Adresse + Zone */}
              <AdresseAutocomplete label="Adresse du site" value={tech.adresse_site_label} onChange={v => setT('adresse_site_label', v)}
                onSelect={d => { setTech(t => ({ ...t, ...d, adresse_site_label: d.adresse_site + ', ' + d.code_postal_site })); detecterZone(d.code_postal_site) }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Code postal site</label>
                  <input value={tech.code_postal_site} onChange={e => detecterZone(e.target.value)} placeholder="59553"
                    style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Zone climatique</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['H1', 'H2', 'H3'].map(z => (
                      <button key={z} type="button" onClick={() => setT('zone_climatique', z)}
                        style={{ flex: 1, padding: '9px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: tech.zone_climatique === z ? '#1e3a5f' : C.bg, border: `1px solid ${tech.zone_climatique === z ? C.accent : C.border}`, color: tech.zone_climatique === z ? '#60A5FA' : C.textMid }}>
                        {z}
                      </button>
                    ))}
                  </div>
                  {tech.zone_climatique && <div style={{ fontSize: 10, color: '#60A5FA', marginTop: 4 }}>✓ Zone {tech.zone_climatique} détectée</div>}
                </div>
                <Field label="Surface du site" value={tech.surface_m2} onChange={v => setT('surface_m2', v)} type="number" placeholder="5000" suffix="m²" />
                <Field label="Hauteur sous plafond" value={tech.hauteur_m} onChange={v => setT('hauteur_m', v)} type="number" placeholder="12" suffix="m" required />
              </div>

              {/* Équipements convectifs */}
              <div style={{ background: '#0a1a2e', border: '1px solid #1e3a5f', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#60A5FA' }}>🌀 Chauffage convectif</span>
                    <span style={{ fontSize: 10, color: C.textSoft, marginLeft: 8 }}>chaudière, aérotherme, rooftop, CTA…</span>
                  </div>
                  <button type="button" onClick={addEquipConv}
                    style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>+ Ajouter</button>
                </div>
                {/* En-têtes colonnes */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 4, paddingLeft: 2 }}>
                  <span style={{ flex: 2, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3 }}>Équipement</span>
                  <span style={{ width: 64, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3, textAlign: 'center' }}>Qté</span>
                  <span style={{ width: 100, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3 }}>kW / unité</span>
                  <span style={{ width: 72, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3, textAlign: 'right' }}>Total</span>
                  <span style={{ width: 26 }} />
                </div>
                {tech.equipements_convectifs.map((eq, i) => (
                  <LigneEquipement key={i} eq={eq}
                    onChange={eq => updateEquipConv(i, eq)}
                    onRemove={() => removeEquipConv(i)}
                    canRemove={tech.equipements_convectifs.length > 1} />
                ))}
                {pConvectif > 0 && (
                  <div style={{ fontSize: 11, color: '#60A5FA', marginTop: 4, textAlign: 'right' }}>
                    P convectif total : <strong>{pConvectif.toLocaleString('fr')} kW</strong>
                  </div>
                )}
              </div>

              {/* Équipements radiatifs */}
              <div style={{ background: '#0a1a2e', border: '1px solid #1e3a5f', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fb923c' }}>☀️ Chauffage radiatif</span>
                    <span style={{ fontSize: 10, color: C.textSoft, marginLeft: 8 }}>cassettes, panneaux radiants… (optionnel)</span>
                  </div>
                  <button type="button" onClick={addEquipRad}
                    style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>+ Ajouter</button>
                </div>
                {tech.equipements_radiatifs.length === 0 && (
                  <div style={{ fontSize: 12, color: C.textSoft, fontStyle: 'italic' }}>Aucun équipement radiatif</div>
                )}
                {tech.equipements_radiatifs.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <span style={{ flex: 2, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3 }}>Équipement</span>
                    <span style={{ width: 64, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3, textAlign: 'center' }}>Qté</span>
                    <span style={{ width: 100, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3 }}>kW / unité</span>
                    <span style={{ width: 72, fontSize: 10, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .3, textAlign: 'right' }}>Total</span>
                    <span style={{ width: 26 }} />
                  </div>
                )}
                {tech.equipements_radiatifs.map((eq, i) => (
                  <LigneEquipement key={i} eq={eq}
                    onChange={eq => updateEquipRad(i, eq)}
                    onRemove={() => removeEquipRad(i)}
                    canRemove={true} />
                ))}
                {pRadiatif > 0 && (
                  <div style={{ fontSize: 11, color: '#fb923c', marginTop: 4, textAlign: 'right' }}>
                    P radiatif total : <strong>{pRadiatif.toLocaleString('fr')} kW</strong>
                  </div>
                )}
              </div>

              {/* Déstratificateurs */}
              <div style={{ background: '#0a1a2e', border: '1px solid #1e3a5f', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#60A5FA', marginBottom: 12 }}>🌀 Déstratificateurs</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginBottom: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Débit unitaire</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['14000', '8500'].map(d => (
                        <button key={d} type="button" onClick={() => setT('debit_unitaire', d)}
                          style={{ flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: tech.debit_unitaire === d ? '#1e3a5f' : C.bg, border: `1px solid ${tech.debit_unitaire === d ? C.accent : C.border}`, color: tech.debit_unitaire === d ? '#60A5FA' : C.textMid }}>
                          {parseInt(d).toLocaleString('fr')} m³/h
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Nb calculé auto</label>
                    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', fontSize: 13, fontWeight: 700, color: '#60A5FA', minHeight: 38 }}>
                      {tech.nb_destrat_calcule > 0 ? (
                        <>
                          {tech.nb_destrat_calcule}
                          <span style={{ fontSize: 10, color: C.textSoft, fontWeight: 400, marginLeft: 6 }}>
                            = ⌈{tech.surface_m2}×{tech.hauteur_m}×0,7÷{parseInt(tech.debit_unitaire).toLocaleString('fr')}⌉
                          </span>
                        </>
                      ) : (
                        <span style={{ color: C.textSoft, fontWeight: 400, fontSize: 12 }}>Saisir surface et hauteur</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Nb destrats (manuel)</label>
                    <input type="number" value={tech.nb_destrat_manuel} onChange={e => setT('nb_destrat_manuel', e.target.value)}
                      placeholder={tech.nb_destrat_calcule || 'auto'}
                      style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                    <div style={{ fontSize: 10, color: C.textSoft, marginTop: 3 }}>Laisser vide = calcul auto</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Coût unitaire</label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" value={tech.cout_unitaire_destrat} onChange={e => setT('cout_unitaire_destrat', e.target.value)} placeholder="2750"
                        style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 28px 9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMid }}>€</span>
                    </div>
                  </div>
                </div>
                {nbDestratEffectif > 0 && tech.cout_unitaire_destrat && (
                  <div style={{ padding: '8px 12px', background: '#0F172A', borderRadius: 7, fontSize: 12, color: C.textMid }}>
                    Coût total prestation : <strong style={{ color: '#fb923c' }}>{(nbDestratEffectif * parseFloat(tech.cout_unitaire_destrat || 0)).toLocaleString('fr')} €</strong>
                    <span style={{ marginLeft: 8 }}>({nbDestratEffectif} × {parseFloat(tech.cout_unitaire_destrat || 0).toLocaleString('fr')} €)</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Retour</button>
                <button disabled={!canCalculer} onClick={calculerSimulation}
                  style={{ flex: 2, padding: '11px', background: C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !canCalculer ? .5 : 1 }}>
                  Calculer la simulation →
                </button>
              </div>
            </>
          )}

          {/* ── Étape 3 : Simulation ── */}
          {step === 3 && simulation && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, background: '#0a1a2e', border: '1px solid #1e3a5f', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, color: C.textMid, flex: 1 }}>💰 Prix de valorisation MWh cumac</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" value={prixMwh} onChange={e => setPrixMwh(e.target.value)} step="0.1" min="1"
                    style={{ width: 75, background: C.bg, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '6px 8px', color: '#60A5FA', fontSize: 14, fontWeight: 700, outline: 'none', fontFamily: 'inherit', textAlign: 'right' }} />
                  <span style={{ fontSize: 12, color: C.textMid }}>€/MWh</span>
                  <button onClick={calculerSimulation} style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Recalculer</button>
                </div>
              </div>

              {/* Résumé technique */}
              <div style={{ background: '#0a1120', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: C.textMid, lineHeight: 1.7 }}>
                Zone <strong style={{ color: C.text }}>{tech.zone_climatique}</strong>
                {' · '} h = <strong style={{ color: C.text }}>{tech.hauteur_m} m</strong>
                {' · '} {tech.surface_m2 ? <>{tech.surface_m2} m²{' · '}</> : ''}
                {tech.type_local === 'sport_transport' ? 'Sport/Transport' : 'Commerce/Spectacles'}
                {pConvectif > 0 && <> · <span style={{ color: '#60A5FA' }}>P_conv = {pConvectif} kW</span></>}
                {pRadiatif > 0  && <> · <span style={{ color: '#fb923c' }}>P_rad = {pRadiatif} kW</span></>}
                {simulation.coeffConv > 0 && <> · coeff = <strong style={{ color: C.text }}>{simulation.coeffConv}</strong> kWh/kW ({simulation.bracket})</>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'kWh cumac', value: `${simulation.kwhCumac?.toLocaleString('fr')} kWh`, color: '#94A3B8', icon: '📊', sub: `${simulation.coeffConv||0} × ${pConvectif} kW${pRadiatif > 0 ? ` + ${simulation.coeffRad||0} × ${pRadiatif} kW` : ''}` },
                  { label: 'Prime CEE brute', value: `${simulation.prime?.toLocaleString('fr')} €`, color: '#a78bfa', icon: '💶', sub: `${simulation.kwhCumac?.toLocaleString('fr')} kWh × ${simulation.prixMwh}/1000` },
                  { label: 'Coût prestation', value: `${simulation.coutTotal?.toLocaleString('fr')} €`, color: '#fb923c', icon: '🔧', sub: `${simulation.nbDestrat} destrats × ${parseFloat(tech.cout_unitaire_destrat).toLocaleString('fr')} €` },
                  { label: 'Marge nette', value: `${simulation.marge?.toLocaleString('fr')} €`, color: simulation.marge > 0 ? '#4ade80' : '#ef4444', icon: simulation.marge > 0 ? '✅' : '❌', sub: 'Prime − Coût prestation' },
                ].map(item => (
                  <div key={item.label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, color: C.textSoft, marginBottom: 4 }}>{item.icon} {item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: 10, color: C.textSoft, marginTop: 3 }}>{item.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: simulation.marge > 0 ? '#052e16' : '#1c0a00', border: `1px solid ${simulation.marge > 0 ? '#166534' : '#92400e'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
                <strong style={{ color: simulation.marge > 0 ? '#4ade80' : '#fb923c' }}>{simulation.marge > 0 ? '✅ Opération rentable' : '⚠️ Opération déficitaire'}</strong>
                <span style={{ color: C.textMid, marginLeft: 8 }}>{client.raison_sociale} · Zone {tech.zone_climatique} · h={tech.hauteur_m}m</span>
              </div>

              {commerciaux.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>Assigner à</label>
                  <select value={assigneA} onChange={e => setAssigneA(e.target.value)}
                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                    {commerciaux.map(p => <option key={p.id} value={p.id}>{p.prenom || ''} {p.nom || p.email}{p.id === user?.id ? ' (moi)' : ''}</option>)}
                  </select>
                </div>
              )}

              {error && <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', color: '#fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Retour</button>
                <button onClick={submit} disabled={loading}
                  style={{ flex: 2, padding: '11px', background: simulation.marge > 0 ? '#16A34A' : C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Création…' : simulation.marge > 0 ? '✅ Créer le dossier' : '📁 Créer quand même'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
