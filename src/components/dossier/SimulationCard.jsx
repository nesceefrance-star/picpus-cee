import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'
import { refDefault } from '../../lib/genRef'
import { C, Field, InfoRow } from './theme'
import {
  calculerCumac110, calculerCumac142, calculerCumac163,
  FACTEURS_SECTEUR_163, eqPuissance,
} from './ceeFormulas'

function switchFicheDefault(ficheId) {
  if (ficheId === 'IND-BA-110') {
    return { fiche_cee: 'IND-BA-110', zone_climatique: '', eqs_conv: [], eqs_rad: [], surface_m2: '', hauteur_m: '', debit_unitaire: '14000', nb_destrat: '', cout_unitaire_destrat: '2750', prix_mwh: '7.5' }
  }
  if (ficheId === 'BAT-TH-163') {
    return { fiche_cee: 'BAT-TH-163', zone_climatique: '', surface_m2: '', puissance_pac: 'small', etas_bracket: 'etas_111_126', cop_bracket: 'cop_3_4_4_5', secteur_163: 'bureaux', cout_installation_163: '', bonification_x3: false, prix_mwh: '7.5' }
  }
  return { fiche_cee: 'BAT-TH-142', zone_climatique: '', type_local: 'sport_transport', hauteur_m: '', eqs_conv: [], eqs_rad: [], nb_destrat: '', cout_unitaire_destrat: '2750', prix_mwh: '7.5' }
}

export default function SimulationCard({ dossier, dossierId, simulation, sFormInit, onSaved }) {
  const navigate = useNavigate()
  const { fetchSimulations, createSimulation, updateDossier } = useStore()

  const [editSimu, setEditSimu] = useState(false)
  const [simuStep, setSimuStep] = useState(1)
  const [sForm, setSForm] = useState(sFormInit || switchFicheDefault(dossier.fiche_cee))
  const setS = (k, v) => setSForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (sFormInit) setSForm(sFormInit)
  }, [sFormInit])
  const [simuResult, setSimuResult] = useState(null)
  const [savingSimu, setSavingSimu] = useState(false)

  const sim = simulation
  const simParams = sim?.parametres || {}

  const canCalculerLocal = sForm.zone_climatique && (
    sForm.fiche_cee === 'IND-BA-110' ? true
    : sForm.fiche_cee === 'BAT-TH-163' ? (sForm.surface_m2 && parseFloat(sForm.surface_m2) > 0)
    : (sForm.hauteur_m && parseFloat(sForm.hauteur_m) >= 5)
  )

  const calculerSimuLocal = () => {
    const prix = parseFloat(sForm.prix_mwh) || 7.5
    const cout = parseFloat(sForm.cout_unitaire_destrat) || 2750
    const zone = sForm.zone_climatique || 'H2'

    if (sForm.fiche_cee === 'IND-BA-110') {
      const pConv   = (sForm.eqs_conv || []).reduce((s, e) => s + eqPuissance(e), 0)
      const pRad    = (sForm.eqs_rad  || []).reduce((s, e) => s + eqPuissance(e), 0)
      const surface = parseFloat(sForm.surface_m2) || 0
      const h       = parseFloat(sForm.hauteur_m) || 0
      const debit   = parseFloat(sForm.debit_unitaire) || 14000
      const nbAuto  = (surface > 0 && h > 0) ? Math.ceil((surface * h * 0.7) / debit) : 0
      const nb      = parseInt(sForm.nb_destrat) || nbAuto
      const { kwhCumac } = calculerCumac110({ zone, pConvectif: pConv, pRadiatif: pRad })
      const prime = Math.round(kwhCumac * (prix / 1000) * 100) / 100
      const mwh   = Math.round(kwhCumac / 1000 * 10) / 10
      const coutTotal = nb * cout
      const marge = Math.round((prime - coutTotal) * 100) / 100
      setSimuResult({ fiche: 'IND-BA-110', kwhCumac, mwh, prime, coutTotal, marge, rentable: marge > 0, nb, nbAuto, pConv, pRad })

    } else if (sForm.fiche_cee === 'BAT-TH-163') {
      const res = calculerCumac163({ zone, puissancePac: sForm.puissance_pac, etasBracket: sForm.etas_bracket, copBracket: sForm.cop_bracket, surface: parseFloat(sForm.surface_m2) || 0, secteur: sForm.secteur_163 })
      const kwhCumacBase = res.kwhCumac
      const kwhCumac = sForm.bonification_x3 ? kwhCumacBase * 3 : kwhCumacBase
      const prime = Math.round(kwhCumac * (prix / 1000) * 100) / 100
      const primeNette = Math.round(prime * 0.9 * 100) / 100
      const coutTotal = parseFloat(sForm.cout_installation_163) || 0
      const margeNette = Math.round((primeNette - coutTotal) * 100) / 100
      setSimuResult({ fiche: 'BAT-TH-163', kwhCumac, kwhCumacBase, prime, primeNette, coutTotal, marge: margeNette, rentable: margeNette > 0, forfait: res.forfait, facteurSecteur: res.facteurSecteur })

    } else {
      const h     = parseFloat(sForm.hauteur_m) || 0
      const nb    = parseInt(sForm.nb_destrat) || 0
      const pConv = (sForm.eqs_conv || []).reduce((s, e) => s + eqPuissance(e), 0)
      const pRad  = (sForm.eqs_rad  || []).reduce((s, e) => s + eqPuissance(e), 0)
      const { kwhCumac } = calculerCumac142({ typeLocal: sForm.type_local, zone, hauteur: h, pConvectif: pConv, pRadiatif: pRad })
      const prime     = Math.round(kwhCumac * (prix / 1000) * 100) / 100
      const mwh       = Math.round(kwhCumac / 1000 * 10) / 10
      const coutTotal = nb * cout
      const marge     = Math.round((prime - coutTotal) * 100) / 100
      setSimuResult({ fiche: 'BAT-TH-142', kwhCumac, mwh, prime, coutTotal, marge, rentable: marge > 0, nb, pConv, pRad })
    }
  }

  const saveSimulation = async () => {
    if (!simuResult) return
    setSavingSimu(true)
    const is110 = sForm.fiche_cee === 'IND-BA-110'
    const is163 = sForm.fiche_cee === 'BAT-TH-163'
    const parametres163 = { puissance_pac: sForm.puissance_pac, etas_bracket: sForm.etas_bracket, cop_bracket: sForm.cop_bracket, secteur: sForm.secteur_163, surface_m2: sForm.surface_m2, bonification_x3: sForm.bonification_x3, kwh_cumac: simuResult.kwhCumac, kwh_cumac_base: simuResult.kwhCumacBase, forfait: simuResult.forfait, facteur_secteur: simuResult.facteurSecteur, cout_installation: sForm.cout_installation_163, cout_total: simuResult.coutTotal, marge: simuResult.marge }
    const payload = {
      dossier_id: dossierId,
      fiche_cee: sForm.fiche_cee || 'BAT-TH-142',
      hauteur_m: parseFloat(sForm.hauteur_m) || null,
      zone_climatique: sForm.zone_climatique,
      nb_equipements: is163 ? 1 : simuResult.nb,
      puissance_kw: is163 ? null : simuResult.pConv + simuResult.pRad,
      mwh_cumac: is163 ? Math.round(simuResult.kwhCumac / 100) / 10 : simuResult.mwh,
      prime_estimee: simuResult.prime,
      prix_mwh: parseFloat(sForm.prix_mwh),
      rentable: simuResult.rentable,
      parametres: is163 ? parametres163 : is110 ? {
        eqs_conv: sForm.eqs_conv, eqs_rad: sForm.eqs_rad, p_convectif: simuResult.pConv, p_radiatif: simuResult.pRad,
        surface_m2: sForm.surface_m2, debit_unitaire: sForm.debit_unitaire, kwh_cumac: simuResult.kwhCumac,
        nb_destrat: simuResult.nb, cout_unitaire_destrat: sForm.cout_unitaire_destrat, cout_total: simuResult.coutTotal, marge: simuResult.marge,
      } : {
        type_local: sForm.type_local, eqs_conv: sForm.eqs_conv, eqs_rad: sForm.eqs_rad,
        p_convectif: simuResult.pConv, p_radiatif: simuResult.pRad, kwh_cumac: simuResult.kwhCumac,
        nb_destrat: simuResult.nb, cout_unitaire_destrat: sForm.cout_unitaire_destrat, cout_total: simuResult.coutTotal, marge: simuResult.marge,
      },
    }
    await createSimulation(payload)
    const { data: updatedDossier } = await updateDossier(dossierId, { prime_estimee: simuResult.prime, montant_devis: simuResult.coutTotal })
    const sims = await fetchSimulations(dossierId)
    setSimuResult(null); setEditSimu(false); setSavingSimu(false)
    onSaved?.(sims[0] || null, updatedDossier)
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>⚡ Simulation CEE</span>
        {!editSimu
          ? <button onClick={() => { setSimuStep(1); setEditSimu(true) }} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{sim ? 'Modifier' : 'Créer'}</button>
          : <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setEditSimu(false); setSimuResult(null); setSimuStep(1) }} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              {simuResult && <button onClick={saveSimulation} disabled={savingSimu} style={{ background: '#16A34A', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>{savingSimu ? 'Sauvegarde…' : 'Sauvegarder'}</button>}
            </div>
        }
      </div>

      {/* ── Vue lecture ── */}
      {!editSimu && !sim && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: C.textSoft, fontSize: 13 }}>Aucune simulation enregistrée.</div>
      )}

      {!editSimu && sim && (
        <div>
          <InfoRow label="Fiche CEE" value={sim.fiche_cee} />
          {sim.fiche_cee === 'IND-BA-110' ? <>
            <InfoRow label="Zone" value={sim.zone_climatique} />
            <InfoRow label="P convectif" value={simParams.p_convectif != null ? `${simParams.p_convectif} kW` : null} />
            <InfoRow label="P radiatif"  value={simParams.p_radiatif  != null ? `${simParams.p_radiatif}  kW` : null} />
            <InfoRow label="Surface"     value={simParams.surface_m2  ? `${simParams.surface_m2} m²` : null} />
            <InfoRow label="Hauteur"     value={sim.hauteur_m != null  ? `${sim.hauteur_m} m` : null} />
            <InfoRow label="Débit"       value={simParams.debit_unitaire ? `${Number(simParams.debit_unitaire).toLocaleString('fr')} m³/h` : null} />
          </> : sim.fiche_cee === 'BAT-TH-163' ? <>
            <InfoRow label="Zone"        value={sim.zone_climatique} />
            <InfoRow label="Surface"     value={simParams.surface_m2 ? `${simParams.surface_m2} m²` : null} />
            <InfoRow label="PAC"         value={simParams.puissance_pac === 'small' ? '≤ 400 kW' : simParams.puissance_pac === 'large' ? '> 400 kW' : null} />
            <InfoRow label="Bracket"     value={simParams.puissance_pac === 'small' ? (simParams.etas_bracket||'').replace(/_/g,' ') : (simParams.cop_bracket||'').replace(/_/g,' ')} />
            <InfoRow label="Secteur"     value={simParams.secteur} />
            <InfoRow label="Forfait"     value={simParams.forfait != null ? `${simParams.forfait} kWh/m²` : null} />
            <InfoRow label="Bonification" value={simParams.bonification_x3 ? '×3 ACTIF' : null} color="#4ade80" />
          </> : <>
            <InfoRow label="Type local"  value={simParams.type_local === 'sport_transport' ? 'Sport / Transport' : simParams.type_local === 'commerce_loisirs' ? 'Commerce / Loisirs' : null} />
            <InfoRow label="Hauteur"     value={sim.hauteur_m != null ? `${sim.hauteur_m} m` : null} />
            <InfoRow label="Zone"        value={sim.zone_climatique} />
            <InfoRow label="P convectif" value={simParams.p_convectif != null ? `${simParams.p_convectif} kW` : null} />
            <InfoRow label="P radiatif"  value={simParams.p_radiatif  != null ? `${simParams.p_radiatif}  kW` : null} />
          </>}
          {sim.fiche_cee !== 'BAT-TH-163' && <InfoRow label="Nb destrats" value={sim.nb_equipements} />}
          <InfoRow label="kWh cumac" value={simParams.kwh_cumac != null ? `${Number(simParams.kwh_cumac).toLocaleString('fr')} kWh` : null} />
          <InfoRow label="MWh cumac" value={sim.mwh_cumac != null ? `${sim.mwh_cumac} MWh` : null} />
          <div style={{ height: 1, background: C.border, margin: '10px 0' }} />
          <InfoRow label="Prime CEE" value={sim.prime_estimee != null ? `${Number(sim.prime_estimee).toLocaleString('fr')} €` : null} color="#7C3AED" />
          <InfoRow label="Coût prestation" value={simParams.cout_total != null ? `${Number(simParams.cout_total).toLocaleString('fr')} €` : null} color="#D97706" />
          <InfoRow label="Marge nette" value={simParams.marge != null ? `${Number(simParams.marge).toLocaleString('fr')} €` : null} color={simParams.marge >= 0 ? '#16A34A' : '#DC2626'} />
          <InfoRow label="Prix MWh" value={sim.prix_mwh != null ? `${sim.prix_mwh} €/MWh` : null} />
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            <button
              onClick={() => navigate('/hub', { state: { module: 'marges', prefill: {
                nomClient: dossier.prospects?.raison_sociale || '', siret: dossier.prospects?.siret || '',
                adresseSite: [dossier.prospects?.adresse, dossier.prospects?.code_postal, dossier.prospects?.ville].filter(Boolean).join(', '),
                nomContact: dossier.prospects?.contact_nom || '', fonctionContact: '',
                telephoneClient: dossier.prospects?.contact_tel || '', emailClient: dossier.prospects?.contact_email || '',
                refDevis: dossier.ref || refDefault(), dateDevis: new Date().toLocaleDateString('fr-FR'),
                prime: sim.prime_estimee || 0, batQte: sim.nb_equipements || 0,
                batPuVente: simParams.cout_unitaire_destrat ? parseFloat(simParams.cout_unitaire_destrat) : 0,
                batDebit: simParams.debit_unitaire || '14000', ficheCee: sim.fiche_cee || 'BAT-TH-142',
              }}})}
              style={{ width: '100%', padding: '10px', background: C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              📄 Créer un devis à partir d'un devis prestataire
            </button>
          </div>
        </div>
      )}

      {/* ── Wizard édition ── */}
      {editSimu && (
        <div>
          {/* Barre progression */}
          <div style={{ display:'flex', gap:3, marginBottom:10 }}>
            {[1,2,3,4].map(s => (
              <div key={s} style={{ flex:1, height:3, borderRadius:2, background: simuStep >= s ? C.accent : C.border, transition:'background .2s' }} />
            ))}
          </div>
          <div style={{ fontSize:11, color:C.textSoft, marginBottom:14 }}>
            Étape {simuStep}/4 — {['Fiche CEE','Informations client','Informations du site','Résultats'][simuStep-1]}
          </div>

          {/* Étape 1 */}
          {simuStep === 1 && (
            <>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>① Fiche CEE du dossier</label>
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:8, background: C.bg, border:`1px solid ${C.accent}`, borderRadius:8, padding:'12px 16px' }}>
                  <span style={{ fontSize:14, fontWeight:800, color:'#60A5FA' }}>{sForm.fiche_cee || dossier.fiche_cee}</span>
                  <span style={{ fontSize:11, color:C.textSoft }}>— verrouillé (défini à la création du dossier)</span>
                </div>
              </div>
              <button onClick={() => setSimuStep(2)}
                style={{ width:'100%', padding:'10px', background:C.accent, border:'none', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                Suivant →
              </button>
            </>
          )}

          {/* Étape 2 */}
          {simuStep === 2 && (
            <>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>② Informations client</label>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>Zone climatique</label>
                <div style={{ display:'flex', gap:6 }}>
                  {['H1','H2','H3'].map(z => (
                    <button key={z} type="button" onClick={() => setS('zone_climatique', z)}
                      style={{ flex:1, padding:'10px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700,
                        background: sForm.zone_climatique === z ? '#EFF6FF' : C.bg,
                        border: `1px solid ${sForm.zone_climatique === z ? C.accent : C.border}`,
                        color: sForm.zone_climatique === z ? C.accent : C.textMid }}>{z}</button>
                  ))}
                </div>
              </div>
              {sForm.fiche_cee === 'BAT-TH-142' && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>Type de local</label>
                  <div style={{ display:'flex', gap:6 }}>
                    {[{ id:'sport_transport', label:'🏟️ Sport / Transport' }, { id:'commerce_loisirs', label:'🏬 Commerce / Loisirs' }].map(t => (
                      <button key={t.id} type="button" onClick={() => setS('type_local', t.id)}
                        style={{ flex:1, padding:'9px 6px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600,
                          background: sForm.type_local === t.id ? '#EFF6FF' : C.bg,
                          border: `1px solid ${sForm.type_local === t.id ? C.accent : C.border}`,
                          color: sForm.type_local === t.id ? C.accent : C.textMid }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display:'flex', gap:6, marginTop:4 }}>
                <button onClick={() => setSimuStep(1)} style={{ flex:1, padding:'9px', background:'transparent', border:`1px solid ${C.border}`, color:C.textMid, borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>← Retour</button>
                <button onClick={() => setSimuStep(3)} disabled={!sForm.zone_climatique}
                  style={{ flex:2, padding:'9px', background: sForm.zone_climatique ? C.accent : C.border, border:'none', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, cursor: sForm.zone_climatique ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
                  Suivant →
                </button>
              </div>
            </>
          )}

          {/* Étape 3 */}
          {simuStep === 3 && (
            <>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>③ Informations du site</label>

              {sForm.fiche_cee === 'BAT-TH-142' && (
                <Field label="Hauteur sous plafond" value={String(sForm.hauteur_m ?? '')} onChange={v => setS('hauteur_m', v)} type="number" placeholder="Ex: 10" suffix="m" />
              )}

              {sForm.fiche_cee === 'IND-BA-110' && <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
                  <Field label="Surface" value={String(sForm.surface_m2??'')} onChange={v=>setS('surface_m2',v)} type="number" placeholder="Ex: 2000" suffix="m²"/>
                  <Field label="Hauteur" value={String(sForm.hauteur_m??'')} onChange={v=>setS('hauteur_m',v)} type="number" placeholder="Ex: 8" suffix="m"/>
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:6, textTransform:'uppercase', letterSpacing:.4 }}>Débit unitaire destrat</label>
                  <div style={{ display:'flex', gap:6 }}>
                    {[{id:'14000',label:'14 000 m³/h'},{id:'8500',label:'8 500 m³/h'}].map(d=>(
                      <button key={d.id} type="button" onClick={()=>setS('debit_unitaire',d.id)}
                        style={{flex:1,padding:'8px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,
                          background:sForm.debit_unitaire===d.id?'#EFF6FF':C.bg,
                          border:`1px solid ${sForm.debit_unitaire===d.id?C.accent:C.border}`,
                          color:sForm.debit_unitaire===d.id?C.accent:C.textMid}}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {sForm.surface_m2 && sForm.hauteur_m && (
                    <div style={{marginTop:6,fontSize:11,color:C.textMid}}>
                      → Nb destrats estimé : <strong>{Math.ceil((parseFloat(sForm.surface_m2)*parseFloat(sForm.hauteur_m)*0.7)/parseFloat(sForm.debit_unitaire||14000))}</strong>
                    </div>
                  )}
                </div>
              </>}

              {sForm.fiche_cee === 'BAT-TH-163' && (
                <div style={{ background: '#F0F7FF', border: `1px solid #BFDBFE`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 14 }}>♨️ PAC air/eau tertiaire</div>
                  <Field label="Surface du site" value={String(sForm.surface_m2??'')} onChange={v=>setS('surface_m2',v)} type="number" placeholder="Ex: 2000" suffix="m²"/>
                  {/* Puissance PAC */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>Puissance PAC *</label>
                    <div style={{ display:'flex', gap:8 }}>
                      {[{id:'small',label:'≤ 400 kW',desc:'Bracket par Etas'},{id:'large',label:'> 400 kW',desc:'Bracket par COP'}].map(t=>(
                        <button key={t.id} type="button" onClick={()=>setS('puissance_pac',t.id)}
                          style={{flex:1,padding:'10px 12px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',textAlign:'center',
                            background:sForm.puissance_pac===t.id?'#EFF6FF':C.surface,
                            border:`1px solid ${sForm.puissance_pac===t.id?C.accent:C.border}`}}>
                          <div style={{fontSize:13,fontWeight:700,color:sForm.puissance_pac===t.id?C.accent:C.text}}>{t.label}</div>
                          <div style={{fontSize:10,color:C.textSoft,marginTop:2}}>{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {sForm.puissance_pac === 'small' && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>Bracket Etas *</label>
                      <div style={{ display:'flex', gap:8 }}>
                        {[{id:'etas_111_126',label:'111% ≤ Etas < 126%'},{id:'etas_126_175',label:'126% ≤ Etas < 175%'},{id:'etas_175_plus',label:'Etas ≥ 175%'}].map(b=>(
                          <button key={b.id} type="button" onClick={()=>setS('etas_bracket',b.id)}
                            style={{flex:1,padding:'8px 6px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:700,
                              background:sForm.etas_bracket===b.id?'#EFF6FF':C.surface,
                              border:`1px solid ${sForm.etas_bracket===b.id?C.accent:C.border}`,
                              color:sForm.etas_bracket===b.id?C.accent:C.textMid}}>
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {sForm.puissance_pac === 'large' && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>Bracket COP *</label>
                      <div style={{ display:'flex', gap:8 }}>
                        {[{id:'cop_3_4_4_5',label:'3,4 ≤ COP < 4,5'},{id:'cop_4_5_plus',label:'COP ≥ 4,5'}].map(b=>(
                          <button key={b.id} type="button" onClick={()=>setS('cop_bracket',b.id)}
                            style={{flex:1,padding:'8px 6px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:700,
                              background:sForm.cop_bracket===b.id?'#EFF6FF':C.surface,
                              border:`1px solid ${sForm.cop_bracket===b.id?C.accent:C.border}`,
                              color:sForm.cop_bracket===b.id?C.accent:C.textMid}}>
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Secteur */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>Secteur d'activité *</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                      {[
                        {id:'bureaux',label:'Bureaux',facteur:'×1,2'},
                        {id:'sante',label:'Santé',facteur:'×1,1'},
                        {id:'commerces',label:'Commerces',facteur:'×0,9'},
                        {id:'enseignement',label:'Enseignement',facteur:'×0,8'},
                        {id:'hotellerie_restauration',label:'Hôtellerie / Restauration',facteur:'×0,7'},
                        {id:'autres',label:'Autres',facteur:'×0,7'},
                      ].map(s=>(
                        <button key={s.id} type="button" onClick={()=>setS('secteur_163',s.id)}
                          style={{padding:'8px 6px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',textAlign:'center',
                            background:sForm.secteur_163===s.id?'#EFF6FF':C.surface,
                            border:`1px solid ${sForm.secteur_163===s.id?C.accent:C.border}`}}>
                          <div style={{fontSize:11,fontWeight:700,color:sForm.secteur_163===s.id?C.accent:C.text}}>{s.label}</div>
                          <div style={{fontSize:10,color:sForm.secteur_163===s.id?C.accent:C.textSoft}}>{s.facteur}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Coût + Bonification */}
                  <div style={{ marginBottom: 14, position:'relative' }}>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:C.textMid, marginBottom:5, textTransform:'uppercase', letterSpacing:.4 }}>Coût installation</label>
                    <input type="number" value={sForm.cout_installation_163??''} onChange={e=>setS('cout_installation_163',e.target.value)} placeholder="ex : 45000"
                      style={{width:'100%',boxSizing:'border-box',background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'9px 28px 9px 12px',color:C.text,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
                    <span style={{position:'absolute',right:10,bottom:10,fontSize:12,color:C.textMid}}>€</span>
                  </div>
                  <div onClick={()=>setS('bonification_x3',!sForm.bonification_x3)}
                    style={{display:'flex',alignItems:'center',gap:10,background:sForm.bonification_x3?'#F0FDF4':C.surface,border:`1px solid ${sForm.bonification_x3?'#86EFAC':C.border}`,borderRadius:8,padding:'10px 12px',cursor:'pointer',userSelect:'none'}}>
                    <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${sForm.bonification_x3?'#16A34A':C.border}`,background:sForm.bonification_x3?'#16A34A':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {sForm.bonification_x3 && <span style={{color:'#fff',fontSize:12,fontWeight:900,lineHeight:1}}>✓</span>}
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:sForm.bonification_x3?'#16A34A':C.text}}>Bonification ×3</div>
                      <div style={{fontSize:10,color:C.textSoft}}>Multiplie le volume cumac par 3</div>
                    </div>
                    {sForm.bonification_x3 && <span style={{fontSize:11,fontWeight:700,color:'#16A34A',background:'#DCFCE7',borderRadius:5,padding:'2px 7px',marginLeft:'auto'}}>×3 ACTIF</span>}
                  </div>
                </div>
              )}

              {/* Équipements BAT-TH-142 + IND-BA-110 */}
              {sForm.fiche_cee !== 'BAT-TH-163' && (<>
                <div style={{ fontSize:11, fontWeight:600, color:C.textMid, marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>🌀 Chauffage convectif</div>
                {(sForm.eqs_conv || []).map((eq, i) => {
                  const upd = p => setS('eqs_conv', sForm.eqs_conv.map((x,j) => j===i ? {...x,...p} : x))
                  return (
                    <div key={i} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center' }}>
                      <input value={eq.label??''} onChange={e=>upd({label:e.target.value})} style={{flex:2,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 10px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                      <input type="number" value={eq.quantite??''} onChange={e=>upd({quantite:e.target.value})} placeholder="Qté" style={{width:60,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 8px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                      <span style={{fontSize:11,color:C.textSoft}}>×</span>
                      <input type="number" value={eq.puissance_unitaire_kw??''} onChange={e=>upd({puissance_unitaire_kw:e.target.value})} placeholder="kW" style={{width:72,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 8px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                      <button onClick={()=>setS('eqs_conv',sForm.eqs_conv.filter((_,j)=>j!==i))} style={{background:'transparent',border:`1px solid ${C.border}`,color:'#EF4444',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer'}}>✕</button>
                    </div>
                  )
                })}
                <button onClick={()=>setS('eqs_conv',[...(sForm.eqs_conv||[]),{label:'Chaudière aérothermique',quantite:'',puissance_unitaire_kw:''}])}
                  style={{background:'transparent',border:`1px solid ${C.border}`,color:C.textMid,borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit',marginBottom:14}}>+ Ajouter convectif</button>

                <div style={{ fontSize:11, fontWeight:600, color:C.textMid, marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>☀️ Chauffage radiatif</div>
                {(sForm.eqs_rad || []).map((eq, i) => {
                  const upd = p => setS('eqs_rad', sForm.eqs_rad.map((x,j) => j===i ? {...x,...p} : x))
                  return (
                    <div key={i} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center' }}>
                      <input value={eq.label??''} onChange={e=>upd({label:e.target.value})} style={{flex:2,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 10px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                      <input type="number" value={eq.quantite??''} onChange={e=>upd({quantite:e.target.value})} placeholder="Qté" style={{width:60,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 8px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                      <span style={{fontSize:11,color:C.textSoft}}>×</span>
                      <input type="number" value={eq.puissance_unitaire_kw??''} onChange={e=>upd({puissance_unitaire_kw:e.target.value})} placeholder="kW" style={{width:72,background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:'7px 8px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                      <button onClick={()=>setS('eqs_rad',sForm.eqs_rad.filter((_,j)=>j!==i))} style={{background:'transparent',border:`1px solid ${C.border}`,color:'#EF4444',borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer'}}>✕</button>
                    </div>
                  )
                })}
                <button onClick={()=>setS('eqs_rad',[...(sForm.eqs_rad||[]),{label:'Équipement radiatif',quantite:'',puissance_unitaire_kw:''}])}
                  style={{background:'transparent',border:`1px solid ${C.border}`,color:C.textMid,borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit',marginBottom:14}}>+ Ajouter radiatif</button>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
                  <Field label="Nb déstratificateurs" value={String(sForm.nb_destrat??'')} onChange={v=>setS('nb_destrat',v)} type="number" placeholder="Ex: 4"/>
                  <Field label="Coût unitaire destrat" value={String(sForm.cout_unitaire_destrat??'')} onChange={v=>setS('cout_unitaire_destrat',v)} type="number" suffix="€"/>
                </div>
              </>)}

              <Field label="Prix MWh" value={String(sForm.prix_mwh??'')} onChange={v=>setS('prix_mwh',v)} type="number" suffix="€/MWh"/>

              <div style={{ display:'flex', gap:6, marginTop:4 }}>
                <button onClick={() => setSimuStep(2)} style={{ flex:1, padding:'9px', background:'transparent', border:`1px solid ${C.border}`, color:C.textMid, borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>← Retour</button>
                <button onClick={() => { setSimuResult(null); setSimuStep(4) }}
                  style={{ flex:2, padding:'9px', background:C.accent, border:'none', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  Suivant →
                </button>
              </div>
            </>
          )}

          {/* Étape 4 */}
          {simuStep === 4 && (
            <>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.textMid, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>④ Résultats</label>
              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12, color:C.textMid }}>
                <span style={{ fontWeight:700, color:C.text }}>{sForm.fiche_cee}</span>
                {' · '}Zone <strong>{sForm.zone_climatique || '—'}</strong>
                {sForm.fiche_cee === 'BAT-TH-142' && <> · <strong>{sForm.type_local === 'sport_transport' ? 'Sport/Transport' : 'Commerce/Loisirs'}</strong></>}
                {sForm.fiche_cee === 'BAT-TH-163' ? <>
                  {' · '}{sForm.surface_m2} m²
                  {' · '}{sForm.puissance_pac === 'small' ? '≤400 kW' : '>400 kW'}
                  {' · '}<span style={{color:'#60A5FA'}}>{sForm.puissance_pac === 'small' ? (sForm.etas_bracket||'').replace(/_/g,' ') : (sForm.cop_bracket||'').replace(/_/g,' ')}</span>
                  {' · '}{sForm.secteur_163} (×{FACTEURS_SECTEUR_163[sForm.secteur_163]})
                  {sForm.bonification_x3 && <span style={{color:'#4ade80',fontWeight:700}}> · ×3 ACTIF</span>}
                </> : <>
                  {' · '}Hauteur <strong>{sForm.hauteur_m || '—'} m</strong><br/>
                  <span>Convectif : <strong>{(sForm.eqs_conv||[]).reduce((s,e)=>s+eqPuissance(e),0).toFixed(1)} kW</strong></span>
                  {' · '}
                  <span>Radiatif : <strong>{(sForm.eqs_rad||[]).reduce((s,e)=>s+eqPuissance(e),0).toFixed(1)} kW</strong></span>
                </>}
              </div>

              <button onClick={calculerSimuLocal} disabled={!canCalculerLocal}
                style={{ width:'100%', padding:'10px', background:C.accent, border:'none', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, cursor: canCalculerLocal ? 'pointer' : 'not-allowed', fontFamily:'inherit', marginBottom: simuResult ? 12 : 0, opacity: canCalculerLocal ? 1 : .5 }}>
                Calculer ⟳
              </button>

              {simuResult && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
                  {simuResult.fiche === 'BAT-TH-163' ? <>
                    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>📊 kWh cumac{simuResult.kwhCumacBase !== simuResult.kwhCumac ? ` (×3)` : ''}</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#94A3B8' }}>{simuResult.kwhCumac?.toLocaleString('fr')} kWh</div>
                      {simuResult.kwhCumacBase !== simuResult.kwhCumac && <div style={{fontSize:10,color:C.textSoft,marginTop:2}}>base : {simuResult.kwhCumacBase?.toLocaleString('fr')} kWh</div>}
                    </div>
                    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>💶 Prime brute</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#a78bfa' }}>{simuResult.prime?.toLocaleString('fr')} €</div>
                    </div>
                    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>💵 Prime nette (hors TVA 10%)</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#818cf8' }}>{simuResult.primeNette?.toLocaleString('fr')} €</div>
                      <div style={{fontSize:10,color:C.textSoft,marginTop:2}}>{simuResult.prime?.toLocaleString('fr')} € × 0,9</div>
                    </div>
                    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>🔧 Coût installation</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#fb923c' }}>{simuResult.coutTotal?.toLocaleString('fr')} €</div>
                    </div>
                    <div style={{ gridColumn:'1/-1', background: simuResult.rentable ? '#F0FDF4' : '#FEF2F2', border:`1px solid ${simuResult.rentable ? '#86EFAC' : '#FECACA'}`, borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>{simuResult.rentable ? '✅' : '❌'} Marge nette</div>
                      <div style={{ fontSize:20, fontWeight:800, color: simuResult.rentable ? '#16A34A' : '#DC2626' }}>{simuResult.marge?.toLocaleString('fr')} €</div>
                      <div style={{fontSize:10,color:C.textSoft,marginTop:2}}>Prime nette ({simuResult.primeNette?.toLocaleString('fr')} €) − Coût ({simuResult.coutTotal?.toLocaleString('fr')} €)</div>
                    </div>
                  </> : <>
                    {[
                      { label: 'kWh cumac',    value: `${simuResult.kwhCumac?.toLocaleString('fr')} kWh`, color: '#94A3B8' },
                      { label: '⚡ MWh cumac',  value: `${simuResult.mwh} MWh`,                           color: C.accent  },
                      { label: '💶 Prime CEE',  value: `${simuResult.prime.toLocaleString('fr')} €`,       color: '#7C3AED' },
                      { label: '🔧 Coût',       value: `${simuResult.coutTotal.toLocaleString('fr')} €`,   color: '#D97706' },
                      { label: simuResult.rentable ? '✅ Marge nette' : '❌ Marge nette',
                        value: `${simuResult.marge.toLocaleString('fr')} €`,
                        color: simuResult.rentable ? '#16A34A' : '#DC2626' },
                    ].map(item => (
                      <div key={item.label} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
                        <div style={{ fontSize:10, color:C.textSoft, marginBottom:3 }}>{item.label}</div>
                        <div style={{ fontSize:16, fontWeight:800, color:item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </>}
                </div>
              )}

              <div style={{ display:'flex', gap:6, marginTop:12 }}>
                <button onClick={() => setSimuStep(3)} style={{ flex:1, padding:'9px', background:'transparent', border:`1px solid ${C.border}`, color:C.textMid, borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>← Retour</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
