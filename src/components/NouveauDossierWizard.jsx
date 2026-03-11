import { useState } from 'react'
import useStore from '../store/useStore'

// Mapping code postal → zone climatique
const getZoneClimatique = (codePostal) => {
  const cp = parseInt(codePostal?.substring(0, 2) || '0')
  // H3 - DOM-TOM et régions côtières méditerranéennes
  if ([97, 98].includes(cp) || [13, 83, 84, 30, 34, 11, 66].includes(cp)) return 'H3'
  // H2 - Centre, Ouest, Sud-Ouest
  if ([17, 16, 33, 40, 64, 65, 32, 31, 9, 12, 46, 47, 82, 81, 48,
       44, 85, 49, 53, 72, 37, 41, 28, 45, 36, 23, 87, 19, 15,
       43, 63, 3, 18, 58, 71, 21, 89, 10].includes(cp)) return 'H2'
  // H1 - Nord, Est, Montagne
  return 'H1'
}

// Prix MWh cumac par zone (€/MWh cumac, tarifs indicatifs 2024-2025)
const PRIX_MWH = { H1: 8.5, H2: 7.2, H3: 5.8 }

// Calcul MWh cumac BAT-TH-142
const calculerMWhCumac = ({ nbEquipements, puissanceUnitaire, zoneClimatique, hauteur }) => {
  // Facteur correctif selon hauteur (>6m requis pour BAT-TH-142)
  const facteurHauteur = hauteur >= 10 ? 1.15 : hauteur >= 8 ? 1.08 : 1.0
  // Durée de vie : 15 ans, facteur zone
  const facteurZone = { H1: 2.5, H2: 2.1, H3: 1.6 }[zoneClimatique] || 2.1
  const mwh = nbEquipements * puissanceUnitaire * facteurZone * facteurHauteur * 0.8
  return Math.round(mwh * 10) / 10
}

const C = {
  bg: '#0F172A', surface: '#1E293B', border: '#334155',
  text: '#F1F5F9', textMid: '#94A3B8', textSoft: '#475569',
  accent: '#2563EB', green: '#16A34A',
}

function Field({ label, value, onChange, type = 'text', placeholder, required, suffix }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7,
            padding: suffix ? '9px 44px 9px 12px' : '9px 12px',
            color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
        />
        {suffix && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMid }}>{suffix}</span>}
      </div>
    </div>
  )
}

export default function NouveauDossierWizard({ onClose, onCreate }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { createProspect, createDossier, createSimulation, user, profiles } = useStore()

  // Étape 1 - Infos client
  const [client, setClient] = useState({
    raison_sociale: '', siren: '', siret: '',
    adresse: '', code_postal: '', ville: '',
    contact_nom: '', contact_email: '', contact_tel: '',
  })

  // Étape 2 - Infos techniques BAT-TH-142
  const [tech, setTech] = useState({
    fiche_cee: 'BAT-TH-142',
    surface_m2: '',
    hauteur_m: '',
    nb_equipements: '',
    puissance_unitaire_kw: '',
    zone_climatique: '',
    adresse_site: '',
    code_postal_site: '',
  })

  // Étape 3 - Simulation calculée
  const [simulation, setSimulation] = useState(null)
  const [assigneA, setAssigneA] = useState(user?.id || '')

  const commerciaux = profiles.filter(p => ['admin', 'commercial'].includes(p.role))

  // Détection auto zone climatique
  const detecterZone = (cp) => {
    const zone = getZoneClimatique(cp)
    setTech(t => ({ ...t, zone_climatique: zone, code_postal_site: cp }))
  }

  // Calcul simulation à l'étape 3
  const calculerSimulation = () => {
    const mwh = calculerMWhCumac({
      nbEquipements: parseInt(tech.nb_equipements) || 0,
      puissanceUnitaire: parseFloat(tech.puissance_unitaire_kw) || 0,
      zoneClimatique: tech.zone_climatique || 'H2',
      hauteur: parseFloat(tech.hauteur_m) || 0,
    })
    const prixMwh = PRIX_MWH[tech.zone_climatique || 'H2']
    const prime = Math.round(mwh * prixMwh * 100) / 100
    const rentable = prime > 10000
    setSimulation({ mwh, prixMwh, prime, rentable })
  }

  const goToStep = (n) => {
    if (n === 3) calculerSimulation()
    setStep(n)
  }

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      // Créer prospect
      const { data: prospect, error: e1 } = await createProspect({
        raison_sociale: client.raison_sociale,
        siren: client.siren, siret: client.siret,
        adresse: client.adresse, code_postal: client.code_postal, ville: client.ville,
        contact_nom: client.contact_nom, contact_email: client.contact_email, contact_tel: client.contact_tel,
      })
      if (e1) throw e1

      // Créer dossier
      const ref = `PICPUS-${Date.now().toString().slice(-6)}`
      const { data: dossier, error: e2 } = await createDossier({
        prospect_id: prospect.id,
        fiche_cee: tech.fiche_cee,
        statut: simulation?.rentable ? 'prospect' : 'simulation',
        assigne_a: assigneA || user?.id,
        ref,
        prime_estimee: simulation?.prime,
        notes: `Zone ${tech.zone_climatique} | ${tech.nb_equipements} équipements | ${tech.surface_m2}m²`,
      })
      if (e2) throw e2

      // Créer simulation
      await createSimulation({
        dossier_id: dossier.id,
        fiche_cee: tech.fiche_cee,
        surface_m2: parseFloat(tech.surface_m2) || null,
        hauteur_m: parseFloat(tech.hauteur_m) || null,
        zone_climatique: tech.zone_climatique,
        nb_equipements: parseInt(tech.nb_equipements) || null,
        puissance_kw: parseFloat(tech.puissance_unitaire_kw) * (parseInt(tech.nb_equipements) || 1),
        mwh_cumac: simulation?.mwh,
        prime_estimee: simulation?.prime,
        prix_mwh: simulation?.prixMwh,
        rentable: simulation?.rentable,
        parametres: { adresse_site: tech.adresse_site, code_postal_site: tech.code_postal_site },
      })

      setLoading(false)
      onCreate(dossier)
      onClose()
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  const stepLabels = ['Informations client', 'Données techniques', 'Simulation & Validation']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,.6)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>➕ Nouveau dossier CEE</div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMid, fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>

          {/* Stepper */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
            {stepLabels.map((label, i) => {
              const n = i + 1
              const active = step === n
              const done = step > n
              return (
                <div key={n} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                  {i > 0 && <div style={{ position: 'absolute', left: 0, top: 14, width: '50%', height: 2, background: done || active ? C.accent : C.border }} />}
                  {i < 2 && <div style={{ position: 'absolute', right: 0, top: 14, width: '50%', height: 2, background: done ? C.accent : C.border }} />}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', margin: '0 auto 6px',
                    background: active ? C.accent : done ? '#16A34A' : C.bg,
                    border: `2px solid ${active ? C.accent : done ? '#16A34A' : C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: active || done ? '#fff' : C.textSoft,
                    position: 'relative', zIndex: 1,
                  }}>
                    {done ? '✓' : n}
                  </div>
                  <div style={{ fontSize: 10, color: active ? C.text : C.textSoft, fontWeight: active ? 600 : 400 }}>{label}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '0 28px 28px' }}>

          {/* ── ÉTAPE 1 : Infos client ── */}
          {step === 1 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <Field label="Raison sociale" value={client.raison_sociale} onChange={v => setClient(c => ({ ...c, raison_sociale: v }))} placeholder="KIABI LOGISTIQUE" required />
                </div>
                <Field label="SIREN" value={client.siren} onChange={v => setClient(c => ({ ...c, siren: v }))} placeholder="347 727 950" />
                <Field label="SIRET" value={client.siret} onChange={v => setClient(c => ({ ...c, siret: v }))} placeholder="34772795000094" />
                <div style={{ gridColumn: '1/-1' }}>
                  <Field label="Adresse" value={client.adresse} onChange={v => setClient(c => ({ ...c, adresse: v }))} placeholder="771 Rue de la Plaine" />
                </div>
                <Field label="Code postal" value={client.code_postal} onChange={v => setClient(c => ({ ...c, code_postal: v }))} placeholder="59553" />
                <Field label="Ville" value={client.ville} onChange={v => setClient(c => ({ ...c, ville: v }))} placeholder="Lauwin-Planque" />
                <Field label="Contact" value={client.contact_nom} onChange={v => setClient(c => ({ ...c, contact_nom: v }))} placeholder="Fabien Van De Ginste" />
                <Field label="Email contact" value={client.contact_email} onChange={v => setClient(c => ({ ...c, contact_email: v }))} type="email" placeholder="f.vdg@kiabi.fr" />
                <div style={{ gridColumn: '1/-1' }}>
                  <Field label="Téléphone" value={client.contact_tel} onChange={v => setClient(c => ({ ...c, contact_tel: v }))} placeholder="06 XX XX XX XX" />
                </div>
              </div>
              <button disabled={!client.raison_sociale} onClick={() => goToStep(2)} style={{ width: '100%', padding: '12px', background: C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8, opacity: !client.raison_sociale ? .5 : 1 }}>
                Suivant →
              </button>
            </>
          )}

          {/* ── ÉTAPE 2 : Données techniques BAT-TH-142 ── */}
          {step === 2 && (
            <>
              <div style={{ background: '#172033', border: '1px solid #1e3a5f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#60A5FA' }}>
                📋 Fiche <strong>BAT-TH-142</strong> — Déstratification d'air chaud
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <Field label="Adresse du site" value={tech.adresse_site} onChange={v => setTech(t => ({ ...t, adresse_site: v }))} placeholder="771 Rue de la Plaine, Lauwin-Planque" />
                </div>

                {/* Code postal avec détection auto zone */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
                    Code postal site <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input value={tech.code_postal_site}
                    onChange={e => detecterZone(e.target.value)}
                    placeholder="59553"
                    style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Zone climatique auto */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
                    Zone climatique
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['H1', 'H2', 'H3'].map(z => (
                      <button key={z} type="button" onClick={() => setTech(t => ({ ...t, zone_climatique: z }))} style={{
                        flex: 1, padding: '9px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 13, fontWeight: 700,
                        background: tech.zone_climatique === z ? '#1e3a5f' : C.bg,
                        border: `1px solid ${tech.zone_climatique === z ? '#2563EB' : C.border}`,
                        color: tech.zone_climatique === z ? '#60A5FA' : C.textMid,
                      }}>
                        {z}
                      </button>
                    ))}
                  </div>
                  {tech.zone_climatique && (
                    <div style={{ fontSize: 11, color: '#60A5FA', marginTop: 4 }}>
                      ✓ Détectée automatiquement • {PRIX_MWH[tech.zone_climatique]} €/MWh cumac
                    </div>
                  )}
                </div>

                <Field label="Surface du site" value={tech.surface_m2} onChange={v => setTech(t => ({ ...t, surface_m2: v }))} type="number" placeholder="5000" suffix="m²" />
                <Field label="Hauteur sous plafond" value={tech.hauteur_m} onChange={v => setTech(t => ({ ...t, hauteur_m: v }))} type="number" placeholder="12" suffix="m" />
                <Field label="Nombre d'aérothermes" value={tech.nb_equipements} onChange={v => setTech(t => ({ ...t, nb_equipements: v }))} type="number" placeholder="29" required />
                <Field label="Puissance unitaire" value={tech.puissance_unitaire_kw} onChange={v => setTech(t => ({ ...t, puissance_unitaire_kw: v }))} type="number" placeholder="6.08" suffix="kW" />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ← Retour
                </button>
                <button disabled={!tech.nb_equipements || !tech.zone_climatique} onClick={() => goToStep(3)} style={{ flex: 2, padding: '11px', background: C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!tech.nb_equipements || !tech.zone_climatique) ? .5 : 1 }}>
                  Calculer la simulation →
                </button>
              </div>
            </>
          )}

          {/* ── ÉTAPE 3 : Simulation & Validation ── */}
          {step === 3 && simulation && (
            <>
              {/* Résultat simulation */}
              <div style={{
                background: simulation.rentable ? '#052e16' : '#1c0a00',
                border: `1px solid ${simulation.rentable ? '#166534' : '#92400e'}`,
                borderRadius: 10, padding: '16px 20px', marginBottom: 20,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: simulation.rentable ? '#4ade80' : '#fb923c', marginBottom: 10 }}>
                  {simulation.rentable ? '✅ Opération rentable' : '⚠️ Rentabilité à confirmer'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'MWh cumac', value: `${simulation.mwh.toLocaleString('fr')} MWh`, color: '#60A5FA' },
                    { label: `Prix MWh (Zone ${tech.zone_climatique})`, value: `${simulation.prixMwh} €/MWh`, color: C.textMid },
                    { label: 'Prime CEE estimée', value: `${simulation.prime.toLocaleString('fr')} €`, color: simulation.rentable ? '#4ade80' : '#fb923c' },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: 10, color: C.textSoft, marginTop: 2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Récap client */}
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>📋 Récapitulatif</div>
                <div style={{ color: C.textMid }}>
                  <span style={{ color: C.text }}>{client.raison_sociale}</span> — {tech.nb_equipements} aérothermes {tech.puissance_unitaire_kw}kW — Zone {tech.zone_climatique} — {tech.surface_m2}m²
                </div>
              </div>

              {/* Assignation */}
              {commerciaux.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
                    Assigner à
                  </label>
                  <select value={assigneA} onChange={e => setAssigneA(e.target.value)} style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                    {commerciaux.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.prenom || ''} {p.nom || p.email}{p.id === user?.id ? ' (moi)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', color: '#fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ← Retour
                </button>
                <button onClick={submit} disabled={loading} style={{ flex: 2, padding: '11px', background: simulation.rentable ? '#16A34A' : C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Création…' : simulation.rentable ? '✅ Créer le dossier' : '📁 Créer quand même'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
