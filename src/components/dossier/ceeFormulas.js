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

export const eqPuissance = (eq) => {
  if (eq.puissance_unitaire_kw != null && eq.quantite != null) {
    return (parseFloat(eq.quantite) || 0) * (parseFloat(eq.puissance_unitaire_kw) || 0)
  }
  return parseFloat(eq.puissance_kw) || 0
}
