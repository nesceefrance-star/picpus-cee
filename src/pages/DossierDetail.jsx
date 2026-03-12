import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB', nav: '#1E293B',
}

const STATUTS = [
  { id: 'simulation', label: 'Simulation',   color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'prospect',   label: 'Prospect',     color: '#0369A1', bg: '#DBEAFE' },
  { id: 'devis',      label: 'Devis envoyé', color: '#D97706', bg: '#FEF3C7' },
  { id: 'ah',         label: 'AH en cours',  color: '#DC2626', bg: '#FEE2E2' },
  { id: 'conforme',   label: 'Conforme',     color: '#16A34A', bg: '#DCFCE7' },
  { id: 'facture',    label: 'Facturé',      color: '#64748B', bg: '#F1F5F9' },
]

const getZoneClimatique = (cp) => {
  const n = parseInt(cp?.substring(0, 2) || '0')
  if ([97,98,13,83,84,30,34,11,66].includes(n)) return 'H3'
  if ([17,16,33,40,64,65,32,31,9,12,46,47,82,81,48,44,85,49,53,72,37,41,28,45,36,23,87,19,15,43,63,3,18,58,71,21,89,10].includes(n)) return 'H2'
  return 'H1'
}

const calculerNbDestrat = (h, s, debit = 14000) =>
  Math.ceil((h * s * 0.7) / debit)

const calculerMWhCumac142 = ({ nb, puissance, zone, hauteur }) => {
  const fz = { H1: 2.5, H2: 2.1, H3: 1.6 }[zone] || 2.1
  const fh = hauteur >= 10 ? 1.15 : hauteur >= 8 ? 1.08 : 1.0
  return Math.round(nb * puissance * fz * fh * 15 * 0.8 * 10) / 10
}

function Field({ label, value, onChange, type = 'text', placeholder, suffix }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={type} value={value ?? ''} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: suffix ? '9px 44px 9px 12px' : '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
        {suffix && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMid }}>{suffix}</span>}
      </div>
    </div>
  )
}

function InfoRow({ label, value, color }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 8, paddingBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.textSoft, width: 110, flexShrink: 0, paddingTop: 1, textTransform: 'uppercase', letterSpacing: .3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: color ? 700 : 400, color: color || C.text }}>{value}</span>
    </div>
  )
}

export default function DossierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentDossier, user, profile, updateDossier, updateProspect, fetchSimulations, createSimulation, profiles, fetchProfiles } = useStore()

  const [dossier, setDossier] = useState(null)
  const [simulation, setSimulation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingStatut, setSavingStatut] = useState(false)

  const [editProspect, setEditProspect] = useState(false)
  const [pForm, setPForm] = useState({})
  const setP = (k, v) => setPForm(f => ({ ...f, [k]: v }))

  const [editSimu, setEditSimu] = useState(false)
  const [sForm, setSForm] = useState({})
  const setS = (k, v) => setSForm(f => ({ ...f, [k]: v }))
  const [simuResult, setSimuResult] = useState(null)
  const [savingSimu, setSavingSimu] = useState(false)

  useEffect(() => {
    fetchProfiles()
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    let d = currentDossier?.id === id ? currentDossier : null
    if (!d) {
      const { data } = await supabase.from('dossiers').select('*, prospects(*)').eq('id', id).single()
      d = data
    }
    if (d) {
      setDossier(d)
      const sims = await fetchSimulations(d.id)
      const sim = sims[0] || null
      setSimulation(sim)
      setPForm(d.prospects || {})
      if (sim) {
        const p = sim.parametres || {}
        setSForm({
          fiche_cee: sim.fiche_cee || 'BAT-TH-142',
          surface_m2: sim.surface_m2 ?? '',
          hauteur_m: sim.hauteur_m ?? '',
          zone_climatique: sim.zone_climatique || '',
          nb_destrat_manuel: p.nb_destrat_manuel || '',
          debit_unitaire: p.debit_unitaire || '14000',
          cout_unitaire_destrat: p.cout_unitaire_destrat || '2750',
          puissance_destrat_kw: '0.214',
          prix_mwh: sim.prix_mwh ?? '7.5',
        })
      } else {
        setSForm({ fiche_cee: d.fiche_cee || 'BAT-TH-142', surface_m2: '', hauteur_m: '', zone_climatique: '', nb_destrat_manuel: '', debit_unitaire: '14000', cout_unitaire_destrat: '2750', puissance_destrat_kw: '0.214', prix_mwh: '7.5' })
      }
    }
    setLoading(false)
  }

  const changeStatut = async (statut) => {
    setSavingStatut(true)
    const { data } = await updateDossier(id, { statut })
    if (data) setDossier(data)
    setSavingStatut(false)
  }

  const saveProspect = async () => {
    const { raison_sociale, siret, adresse, code_postal, ville, contact_nom, contact_email, contact_tel } = pForm
    const data = await updateProspect(dossier.prospects.id, { raison_sociale, siret, adresse, code_postal, ville, contact_nom, contact_email, contact_tel })
    if (data) setDossier(d => ({ ...d, prospects: data }))
    setEditProspect(false)
  }

  const calculerSimuLocal = () => {
    const h = parseFloat(sForm.hauteur_m) || 0
    const s = parseFloat(sForm.surface_m2) || 0
    const debit = parseInt(sForm.debit_unitaire) || 14000
    const zone = sForm.zone_climatique || 'H2'
    const prix = parseFloat(sForm.prix_mwh) || 7.5
    const puissance = parseFloat(sForm.puissance_destrat_kw) || 0.214
    const cout = parseFloat(sForm.cout_unitaire_destrat) || 2750
    const nbCalc = h > 0 && s > 0 ? calculerNbDestrat(h, s, debit) : 0
    const nb = parseInt(sForm.nb_destrat_manuel) || nbCalc
    const mwh = calculerMWhCumac142({ nb, puissance, zone, hauteur: h })
    const prime = Math.round(mwh * prix * 100) / 100
    const coutTotal = nb * cout
    const marge = Math.round((prime - coutTotal) * 100) / 100
    setSimuResult({ mwh, prime, coutTotal, marge, rentable: marge > 0, nb, nbCalc })
  }

  const saveSimulation = async () => {
    if (!simuResult) return
    setSavingSimu(true)
    const payload = {
      dossier_id: id,
      fiche_cee: sForm.fiche_cee,
      surface_m2: parseFloat(sForm.surface_m2) || null,
      hauteur_m: parseFloat(sForm.hauteur_m) || null,
      zone_climatique: sForm.zone_climatique,
      nb_equipements: simuResult.nb,
      mwh_cumac: simuResult.mwh,
      prime_estimee: simuResult.prime,
      prix_mwh: parseFloat(sForm.prix_mwh),
      rentable: simuResult.rentable,
      parametres: { ...sForm, nb_destrat_calcule: simuResult.nbCalc, cout_total: simuResult.coutTotal, marge: simuResult.marge },
    }
    await createSimulation(payload)
    const { data: updatedDossier } = await updateDossier(id, { prime_estimee: simuResult.prime, montant_devis: simuResult.coutTotal })
    if (updatedDossier) setDossier(updatedDossier)
    const sims = await fetchSimulations(id)
    setSimulation(sims[0] || null)
    setSimuResult(null)
    setEditSimu(false)
    setSavingSimu(false)
  }

  const assignedProfile = profiles.find(p => p.id === dossier?.assigne_a)
  const assignedName = assignedProfile
    ? (`${assignedProfile.prenom || ''} ${assignedProfile.nom || ''}`.trim() || assignedProfile.email)
    : (dossier?.assigne_a ? dossier.assigne_a.slice(0, 8) + '…' : '—')

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      <span style={{ color: C.textMid, fontSize: 14 }}>Chargement…</span>
    </div>
  )

  if (!dossier) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      <span style={{ color: C.text, fontSize: 16 }}>Dossier introuvable</span>
      <button onClick={() => navigate('/')} style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>← Retour</button>
    </div>
  )

  const statutInfo = STATUTS.find(s => s.id === dossier.statut) || STATUTS[0]
  const sim = simulation
  const simParams = sim?.parametres || {}

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      {/* Nav */}
      <div style={{ background: C.nav, borderBottom: '1px solid #334155', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '5px 10px', borderRadius: 6 }}>← Dashboard</button>
          <span style={{ color: '#334155' }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#60A5FA', fontFamily: 'monospace' }}>{dossier.ref}</span>
          <span style={{ fontSize: 13, color: '#94A3B8' }}>{dossier.prospects?.raison_sociale}</span>
        </div>
        <span style={{ fontSize: 12, color: '#64748B' }}>{user?.email}</span>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 6px' }}>
              {dossier.prospects?.raison_sociale || '—'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: C.textMid, fontFamily: 'monospace' }}>{dossier.ref}</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ fontSize: 12, color: C.textMid }}>{dossier.fiche_cee}</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ fontSize: 12, color: C.textMid }}>Assigné à {assignedName}</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: statutInfo.bg, color: statutInfo.color }}>{statutInfo.label}</span>
            </div>
          </div>
          {/* Changement de statut */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUTS.map(s => (
              <button key={s.id} onClick={() => changeStatut(s.id)} disabled={savingStatut || dossier.statut === s.id}
                style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: dossier.statut === s.id ? 'default' : 'pointer', fontFamily: 'inherit', border: `1px solid ${s.color}`, background: dossier.statut === s.id ? s.bg : 'transparent', color: s.color, opacity: savingStatut ? .6 : 1, transition: 'all .1s' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* ── Prospect card ── */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>👤 Informations client</span>
              {!editProspect
                ? <button onClick={() => setEditProspect(true)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Modifier</button>
                : <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setEditProspect(false)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                    <button onClick={saveProspect} style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Enregistrer</button>
                  </div>
              }
            </div>

            {editProspect ? (
              <>
                <Field label="Raison sociale" value={pForm.raison_sociale} onChange={v => setP('raison_sociale', v)} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                  <Field label="SIRET" value={pForm.siret} onChange={v => setP('siret', v)} />
                  <Field label="Ville" value={pForm.ville} onChange={v => setP('ville', v)} />
                  <div style={{ gridColumn: '1/-1' }}><Field label="Adresse" value={pForm.adresse} onChange={v => setP('adresse', v)} /></div>
                  <Field label="Code postal" value={pForm.code_postal} onChange={v => setP('code_postal', v)} />
                  <Field label="Contact" value={pForm.contact_nom} onChange={v => setP('contact_nom', v)} />
                  <Field label="Email" value={pForm.contact_email} onChange={v => setP('contact_email', v)} type="email" />
                  <Field label="Téléphone" value={pForm.contact_tel} onChange={v => setP('contact_tel', v)} />
                </div>
              </>
            ) : (
              <div>
                <InfoRow label="SIRET" value={dossier.prospects?.siret} />
                <InfoRow label="Adresse" value={dossier.prospects?.adresse} />
                <InfoRow label="Ville" value={[dossier.prospects?.code_postal, dossier.prospects?.ville].filter(Boolean).join(' ') || null} />
                <InfoRow label="Contact" value={dossier.prospects?.contact_nom} />
                <InfoRow label="Email" value={dossier.prospects?.contact_email} />
                <InfoRow label="Tél" value={dossier.prospects?.contact_tel} />
              </div>
            )}
          </div>

          {/* ── Simulation card ── */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>⚡ Simulation CEE</span>
              {!editSimu
                ? <button onClick={() => setEditSimu(true)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{sim ? 'Modifier' : 'Créer'}</button>
                : <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setEditSimu(false); setSimuResult(null) }} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                    {simuResult && <button onClick={saveSimulation} disabled={savingSimu} style={{ background: '#16A34A', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>{savingSimu ? 'Sauvegarde…' : 'Sauvegarder'}</button>}
                  </div>
              }
            </div>

            {/* Lecture */}
            {!editSimu && !sim && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: C.textSoft, fontSize: 13 }}>
                Aucune simulation enregistrée.
              </div>
            )}

            {!editSimu && sim && (
              <div>
                <InfoRow label="Fiche CEE" value={sim.fiche_cee} />
                <InfoRow label="Surface" value={sim.surface_m2 != null ? `${sim.surface_m2} m²` : null} />
                <InfoRow label="Hauteur" value={sim.hauteur_m != null ? `${sim.hauteur_m} m` : null} />
                <InfoRow label="Zone" value={sim.zone_climatique} />
                <InfoRow label="Nb destrats" value={sim.nb_equipements} />
                <InfoRow label="MWh cumac" value={sim.mwh_cumac != null ? `${sim.mwh_cumac} MWh` : null} />
                <div style={{ height: 1, background: C.border, margin: '10px 0' }} />
                <InfoRow label="Prime CEE" value={sim.prime_estimee != null ? `${Number(sim.prime_estimee).toLocaleString('fr')} €` : null} color="#7C3AED" />
                <InfoRow label="Coût prestation" value={simParams.cout_total != null ? `${Number(simParams.cout_total).toLocaleString('fr')} €` : null} color="#D97706" />
                <InfoRow label="Marge nette" value={simParams.marge != null ? `${Number(simParams.marge).toLocaleString('fr')} €` : null} color={simParams.marge >= 0 ? '#16A34A' : '#DC2626'} />
                <InfoRow label="Prix MWh" value={sim.prix_mwh != null ? `${sim.prix_mwh} €/MWh` : null} />
              </div>
            )}

            {/* Édition */}
            {editSimu && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                  <Field label="Surface" value={String(sForm.surface_m2 ?? '')} onChange={v => setS('surface_m2', v)} type="number" placeholder="5000" suffix="m²" />
                  <Field label="Hauteur" value={String(sForm.hauteur_m ?? '')} onChange={v => setS('hauteur_m', v)} type="number" placeholder="12" suffix="m" />
                  <Field label="Débit unitaire" value={String(sForm.debit_unitaire ?? '')} onChange={v => setS('debit_unitaire', v)} type="number" placeholder="14000" suffix="m³/h" />
                  <Field label="Nb destrats (manuel)" value={String(sForm.nb_destrat_manuel ?? '')} onChange={v => setS('nb_destrat_manuel', v)} type="number" placeholder="auto" />
                  <Field label="Coût unitaire destrat" value={String(sForm.cout_unitaire_destrat ?? '')} onChange={v => setS('cout_unitaire_destrat', v)} type="number" suffix="€" />
                  <Field label="Prix MWh" value={String(sForm.prix_mwh ?? '')} onChange={v => setS('prix_mwh', v)} type="number" suffix="€/MWh" />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .4 }}>Zone climatique</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['H1', 'H2', 'H3'].map(z => (
                      <button key={z} type="button" onClick={() => setS('zone_climatique', z)}
                        style={{ flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: sForm.zone_climatique === z ? '#EFF6FF' : C.bg, border: `1px solid ${sForm.zone_climatique === z ? C.accent : C.border}`, color: sForm.zone_climatique === z ? C.accent : C.textMid }}>
                        {z}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={calculerSimuLocal}
                  style={{ width: '100%', padding: '10px', background: C.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: simuResult ? 12 : 0 }}>
                  Recalculer ⟳
                </button>
                {simuResult && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    {[
                      { label: '⚡ MWh cumac', value: `${simuResult.mwh} MWh`, color: C.accent },
                      { label: '💶 Prime CEE', value: `${simuResult.prime.toLocaleString('fr')} €`, color: '#7C3AED' },
                      { label: '🔧 Coût prestation', value: `${simuResult.coutTotal.toLocaleString('fr')} €`, color: '#D97706' },
                      { label: simuResult.rentable ? '✅ Marge nette' : '❌ Marge nette', value: `${simuResult.marge.toLocaleString('fr')} €`, color: simuResult.rentable ? '#16A34A' : '#DC2626' },
                    ].map(item => (
                      <div key={item.label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: C.textSoft, marginBottom: 3 }}>{item.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {dossier.notes && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 22px', marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>📝 Notes</div>
            <div style={{ fontSize: 13, color: C.textMid, whiteSpace: 'pre-wrap' }}>{dossier.notes}</div>
          </div>
        )}
      </div>
    </div>
  )
}
