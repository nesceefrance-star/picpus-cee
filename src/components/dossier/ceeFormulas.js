// ── Formules CEE ADEME ────────────────────────────────────────────────────────

// IND-BA-110
export const COEFFICIENTS_IND_110 = {
  convectif: { H1: 7200, H2: 8000, H3: 8500 },
  radiatif:  { H1: 2500, H2: 2800, H3: 3000 },
}

export const calculerCumac110 = ({ zone, pConvectif, pRadiatif }) => {
  const coeffConv = COEFFICIENTS_IND_110.convectif[zone] || 0
  const coeffRad  = COEFFICIENTS_IND_110.radiatif[zone]  || 0
  const kwhCumac  = Math.round(coeffConv * pConvectif + coeffRad * pRadiatif)
  return { kwhCumac, coeffConv, coeffRad }
}

// BAT-TH-142
export const COEFFICIENTS_142 = {
  sport_transport: {
    convectif: {
      H1: { '5-7': 900, '7-10': 2700, '10-15': 5100, '15-20': 7200, '20+': 8000 },
      H2: { '5-7': 1000, '7-10': 3100, '10-15': 5700, '15-20': 7800, '20+': 8600 },
      H3: { '5-7': 1300, '7-10': 4000, '10-15': 7000, '15-20': 9100, '20+': 9900 },
    },
    radiatif: {
      H1: { '5-7': 320, '7-10': 950, '10-15': 1800, '15-20': 2500, '20+': 2800 },
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
      H2: { '5-7': 240, '7-10': 790, '10-15': 1600, '15-20': 2200, '20+': 2500 },
      H3: { '5-7': 320, '7-10': 1000, '10-15': 1900, '15-20': 2500, '20+': 2800 },
    },
  },
}

export const getHauteurBracket = (h) => {
  if (h >= 5  && h < 7)  return '5-7'
  if (h >= 7  && h < 10) return '7-10'
  if (h >= 10 && h < 15) return '10-15'
  if (h >= 15 && h < 20) return '15-20'
  if (h >= 20)           return '20+'
  return null
}

export const calculerCumac142 = ({ typeLocal, zone, hauteur, pConvectif, pRadiatif }) => {
  const bracket = getHauteurBracket(hauteur)
  if (!bracket) return { kwhCumac: 0 }
  const coeffConv = COEFFICIENTS_142[typeLocal]?.convectif?.[zone]?.[bracket] || 0
  const coeffRad  = COEFFICIENTS_142[typeLocal]?.radiatif?.[zone]?.[bracket] || 0
  const kwhCumac  = Math.round(coeffConv * pConvectif + coeffRad * pRadiatif)
  return { kwhCumac, coeffConv, coeffRad, bracket }
}

// BAT-TH-163
export const COEFFICIENTS_163 = {
  pac_small: {
    'etas_111_126': { H1: 1100, H2: 900,  H3: 600 },
    'etas_126_175': { H1: 1200, H2: 1000, H3: 700 },
    'etas_175_plus': { H1: 1300, H2: 1000, H3: 700 },
  },
  pac_large: {
    'cop_3_4_4_5': { H1: 1100, H2: 900,  H3: 600 },
    'cop_4_5_plus': { H1: 1200, H2: 1000, H3: 700 },
  },
}

export const FACTEURS_SECTEUR_163 = {
  bureaux: 1.2, sante: 1.1, commerces: 0.9,
  enseignement: 0.8, hotellerie_restauration: 0.7, autres: 0.7,
}

export const calculerCumac163 = ({ zone, puissancePac, etasBracket, copBracket, surface, secteur }) => {
  const forfait = puissancePac === 'small'
    ? (COEFFICIENTS_163.pac_small[etasBracket]?.[zone] || 0)
    : (COEFFICIENTS_163.pac_large[copBracket]?.[zone] || 0)
  const facteurSecteur = FACTEURS_SECTEUR_163[secteur] || 0.7
  const kwhCumac = Math.round(forfait * surface * facteurSecteur)
  return { kwhCumac, forfait, facteurSecteur }
}

// BAT-TH-116 — Système GTB / BMS tertiaire
export const COEFFICIENTS_116 = {
  A: {
    bureaux:                 { chauffage: 400, refroidissement: 260, ecs: 16,  eclairage: 190, auxiliaires: 19 },
    enseignement:            { chauffage: 200, refroidissement: 71,  ecs: 89,  eclairage: 49,  auxiliaires: 8  },
    commerce:                { chauffage: 560, refroidissement: 160, ecs: 32,  eclairage: 23,  auxiliaires: 8  },
    hotellerie_restauration: { chauffage: 420, refroidissement: 71,  ecs: 34,  eclairage: 74,  auxiliaires: 8  },
    sante:                   { chauffage: 200, refroidissement: 71,  ecs: 95,  eclairage: 12,  auxiliaires: 28 },
    autres:                  { chauffage: 200, refroidissement: 71,  ecs: 16,  eclairage: 12,  auxiliaires: 8  },
  },
  B: {
    bureaux:                 { chauffage: 300, refroidissement: 130, ecs: 8,   eclairage: 100, auxiliaires: 10 },
    enseignement:            { chauffage: 120, refroidissement: 35,  ecs: 45,  eclairage: 24,  auxiliaires: 5  },
    commerce:                { chauffage: 300, refroidissement: 66,  ecs: 3,   eclairage: 23,  auxiliaires: 5  },
    hotellerie_restauration: { chauffage: 230, refroidissement: 35,  ecs: 17,  eclairage: 40,  auxiliaires: 5  },
    sante:                   { chauffage: 140, refroidissement: 35,  ecs: 48,  eclairage: 12,  auxiliaires: 18 },
    autres:                  { chauffage: 120, refroidissement: 35,  ecs: 3,   eclairage: 12,  auxiliaires: 5  },
  },
}
export const ZONE_COEFF_116 = { H1: 1.1, H2: 0.9, H3: 0.6 }
export const USAGES_116 = ['chauffage', 'refroidissement', 'ecs', 'eclairage', 'auxiliaires']
export const USAGES_116_LABELS = {
  chauffage: 'Chauffage', refroidissement: 'Refroidissement / Climatisation',
  ecs: 'Eau chaude sanitaire (ECS)', eclairage: 'Éclairage', auxiliaires: 'Auxiliaires',
}
export const BONIF_COEFF_116 = { none: 1, creation: 2, amelioration: 1.5 }

export const calculerCumac116 = ({ classe, secteur, zone, surfaces }) => {
  const coeffs = COEFFICIENTS_116[classe]?.[secteur]
  if (!coeffs) return { kwhCumac: 0, zoneCoeff: 0, details: {} }
  const zoneCoeff = ZONE_COEFF_116[zone] || 0.9
  const details = {}
  let kwhCumac = 0
  USAGES_116.forEach(usage => {
    const surf = parseFloat(surfaces?.[usage]) || 0
    if (surf > 0) {
      const kwh = Math.round(coeffs[usage] * surf * zoneCoeff)
      kwhCumac += kwh
      details[`kwh_${usage}`] = kwh
    }
  })
  return { kwhCumac: Math.round(kwhCumac), zoneCoeff, details }
}

// BAT-TH-125 — Ventilation double flux tertiaire (< 10 000 m²)
export const COEFFICIENTS_125 = {
  modulee_proportionnelle: { H1: 770,  H2: 630, H3: 420 },
  modulee_presence:        { H1: 690,  H2: 560, H3: 380 },
  debit_constant:          { H1: 400,  H2: 330, H3: 220 },
}
export const FACTEURS_SECTEUR_125 = {
  modulee_proportionnelle: { bureaux: 0.48, enseignement: 1, restauration: 0.59, autres: 0.54 },
  modulee_presence:        { bureaux: 0.40, enseignement: 1, restauration: 0.45, autres: 0.51 },
  debit_constant:          { bureaux: 0.40, enseignement: 1, restauration: 0.53, autres: 0.58 },
}
export const calculerCumac125 = ({ zone, typeVentil, secteur, surface }) => {
  const coeff = COEFFICIENTS_125[typeVentil]?.[zone] || 0
  const facteurSecteur = FACTEURS_SECTEUR_125[typeVentil]?.[secteur] || 1
  return { kwhCumac: Math.round(coeff * facteurSecteur * surface), coeff, facteurSecteur }
}

// BAT-TH-126 — Ventilation double flux tertiaire (≥ 10 000 m²)
export const COEFFICIENTS_126 = {
  modulee_proportionnelle: { H1: 1000, H2: 830, H3: 560 },
  modulee_presence:        { H1: 970,  H2: 800, H3: 530 },
  debit_constant:          { H1: 850,  H2: 700, H3: 460 },
}
export const FACTEURS_SECTEUR_126 = {
  modulee_proportionnelle: { bureaux: 0.53, enseignement: 1, restauration: 0.68, sportif: 0.22, autres: 0.71, salles_250: 1.88 },
  modulee_presence:        { bureaux: 0.51, enseignement: 1, restauration: 0.63, sportif: 0.17, autres: 0.71 },
  debit_constant:          { bureaux: 0.48, enseignement: 1, restauration: 0.61, sportif: 0.52, autres: 0.71, salles_250: 1.44 },
}
export const calculerCumac126 = ({ zone, typeVentil, secteur, surface }) => {
  const coeff = COEFFICIENTS_126[typeVentil]?.[zone] || 0
  const facteurSecteur = FACTEURS_SECTEUR_126[typeVentil]?.[secteur] || 1
  return { kwhCumac: Math.round(coeff * facteurSecteur * surface), coeff, facteurSecteur }
}

// BAT-EN-103 — Isolation de toiture ou de combles
export const COEFFICIENTS_103 = { H1: 5200, H2: 4200, H3: 2800 }
export const FACTEURS_SECTEUR_103 = {
  bureaux_enseignement_commerces: 0.6,
  hotellerie_restauration: 0.7,
  sante: 1.2,
  autres: 0.6,
}
export const LABELS_SECTEUR_103 = {
  bureaux_enseignement_commerces: 'Bureaux / Enseignement / Commerces',
  hotellerie_restauration: 'Hôtellerie / Restauration',
  sante: 'Santé',
  autres: 'Autres secteurs',
}
export const calculerCumac103 = ({ zone, secteur, surface }) => {
  const coeff = COEFFICIENTS_103[zone] || 0
  const facteurSecteur = FACTEURS_SECTEUR_103[secteur] || 0.6
  return { kwhCumac: Math.round(coeff * facteurSecteur * surface), coeff, facteurSecteur }
}

export const eqPuissance = (eq) => {
  if (eq.puissance_unitaire_kw != null && eq.quantite != null) {
    return (parseFloat(eq.quantite) || 0) * (parseFloat(eq.puissance_unitaire_kw) || 0)
  }
  return parseFloat(eq.puissance_kw) || 0
}
