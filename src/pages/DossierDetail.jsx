import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import EmailSection from '../components/EmailSection'
import ClientCard from '../components/dossier/ClientCard'
import SimulationCard from '../components/dossier/SimulationCard'
import AppelsTab from '../components/dossier/AppelsTab'
import HistoriqueTab from '../components/dossier/HistoriqueTab'
import DocumentsTab from '../components/dossier/DocumentsTab'
import VisioTab from '../components/dossier/VisioTab'
import VisitesTab from '../components/dossier/VisitesTab'

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB', nav: '#1E293B',
}

const STATUTS = [
  { id: 'simulation',       label: 'Simulation',        color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'prospect',         label: 'Prospect',          color: '#0369A1', bg: '#DBEAFE' },
  { id: 'contacte',         label: 'Contacté',          color: '#0891B2', bg: '#CFFAFE' },
  { id: 'visio_planifiee',  label: 'Visio planifiée',   color: '#0D9488', bg: '#CCFBF1' },
  { id: 'visio_effectuee',  label: 'Visio effectuée',   color: '#059669', bg: '#D1FAE5' },
  { id: 'visite_planifiee', label: 'Visite planifiée',  color: '#D97706', bg: '#FEF3C7' },
  { id: 'visite_effectuee', label: 'Visite effectuée',  color: '#EA580C', bg: '#FFEDD5' },
  { id: 'devis',            label: 'Devis envoyé',      color: '#9333EA', bg: '#F3E8FF' },
  { id: 'ah',               label: 'AH en cours',       color: '#DC2626', bg: '#FEE2E2' },
  { id: 'conforme',         label: 'Conforme',          color: '#16A34A', bg: '#DCFCE7' },
  { id: 'facture',          label: 'Facturé',           color: '#64748B', bg: '#F1F5F9' },
]

export default function DossierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentDossier, user, profile, session, updateDossier, fetchSimulations, profiles, fetchProfiles, logActivite } = useStore()

  const [dossier,       setDossier]       = useState(null)
  const [simulation,    setSimulation]    = useState(null)
  const [adresseSite,   setAdresseSite]   = useState('')
  const [sFormInit,     setSFormInit]     = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [savingStatut,  setSavingStatut]  = useState(false)
  const [statutForm,    setStatutForm]    = useState({ statut: '', date: new Date().toISOString().split('T')[0] })
  const [statutSaved,   setStatutSaved]   = useState(false)
  const [pendingStatut, setPendingStatut] = useState(null)
  const [activeTab,     setActiveTab]     = useState('dossier')
  const [savingAssigne, setSavingAssigne] = useState(false)
  const [notesForm,     setNotesForm]     = useState('')
  const [savingNotes,   setSavingNotes]   = useState(false)
  const [notesSaved,    setNotesSaved]    = useState(false)

  // Badge counts for tabs (loaded lazily by sub-components)
  const [appelCount,   setAppelCount]   = useState(0)
  const [visiteCount,  setVisiteCount]  = useState(0)
  const [docCount,     setDocCount]     = useState(0)

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
    // Adresse site
    const adr = d?.adresse_site || null
    if (adr) {
      setAdresseSite(adr)
    } else {
      const { data: devisRes } = await supabase.from('devis_hub').select('adresse_site').eq('dossier_id', id).not('adresse_site', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (devisRes?.adresse_site) setAdresseSite(devisRes.adresse_site)
    }
    if (d) {
      setDossier(d)
      setNotesForm(d.notes || '')
      if (d.reunion_link) { /* stored in VisioTab */ }
      setStatutForm({
        statut: d.statut || 'simulation',
        date: d.statut_date ? new Date(d.statut_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      })
      const sims = await fetchSimulations(d.id)
      const sim = sims[0] || null
      setSimulation(sim)
      // Build sForm initial state from saved simulation
      if (sim) {
        const p = sim.parametres || {}
        const fiche = sim.fiche_cee || 'BAT-TH-142'
        if (fiche === 'IND-BA-110') {
          setSFormInit({ fiche_cee: 'IND-BA-110', zone_climatique: sim.zone_climatique || '', eqs_conv: p.eqs_conv || [], eqs_rad: p.eqs_rad || [], surface_m2: p.surface_m2 ?? '', hauteur_m: sim.hauteur_m ?? '', debit_unitaire: p.debit_unitaire || '14000', nb_destrat: p.nb_destrat ?? '', cout_unitaire_destrat: p.cout_unitaire_destrat || '2750', prix_mwh: sim.prix_mwh ?? '7.5' })
        } else if (fiche === 'BAT-TH-163') {
          setSFormInit({ fiche_cee: 'BAT-TH-163', zone_climatique: sim.zone_climatique || '', surface_m2: p.surface_m2 ?? '', puissance_pac: p.puissance_pac || 'small', etas_bracket: p.etas_bracket || 'etas_111_126', cop_bracket: p.cop_bracket || 'cop_3_4_4_5', secteur_163: p.secteur || 'bureaux', cout_installation_163: p.cout_installation || '', bonification_x3: p.bonification_x3 || false, prix_mwh: sim.prix_mwh ?? '7.5' })
        } else {
          setSFormInit({ fiche_cee: 'BAT-TH-142', zone_climatique: sim.zone_climatique || '', type_local: p.type_local || 'sport_transport', hauteur_m: sim.hauteur_m ?? '', eqs_conv: p.eqs_conv || [], eqs_rad: p.eqs_rad || [], nb_destrat: p.nb_destrat ?? '', cout_unitaire_destrat: p.cout_unitaire_destrat || '2750', prix_mwh: sim.prix_mwh ?? '7.5' })
        }
      }
    }
    setLoading(false)
  }

  const changeStatut = async () => {
    if (!session) return
    setSavingStatut(true); setStatutSaved(false)
    try {
      const r = await fetch('/api/dossier-status-update', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossierId: id, statut: statutForm.statut, statut_date: statutForm.date }),
      })
      const d = await r.json()
      if (d.dossier) {
        setDossier(prev => ({ ...prev, statut: d.dossier.statut, statut_date: d.dossier.statut_date }))
        await logActivite(id, 'statut', `Statut → ${d.dossier.statut}${statutForm.date ? ` (${new Date(statutForm.date).toLocaleDateString('fr-FR')})` : ''}`)
      }
      setStatutSaved(true); setPendingStatut(null)
      setTimeout(() => setStatutSaved(false), 3000)
    } catch { /* ignore */ }
    setSavingStatut(false)
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    const { data } = await updateDossier(id, { notes: notesForm })
    if (data) setDossier(prev => ({ ...prev, notes: notesForm }))
    setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2000)
    setSavingNotes(false)
  }

  const changeAssignation = async (newUserId) => {
    setSavingAssigne(true)
    const { data } = await updateDossier(id, { assigne_a: newUserId })
    if (data) setDossier(data)
    setSavingAssigne(false)
  }

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
  const assignedProfile = profiles.find(p => p.id === dossier.assigne_a)
  const assignedName = assignedProfile
    ? (`${assignedProfile.prenom || ''} ${assignedProfile.nom || ''}`.trim() || assignedProfile.email)
    : (dossier.assigne_a ? dossier.assigne_a.slice(0, 8) + '…' : '—')

  const initEmails = [user?.email, dossier.prospects?.contact_email].filter(Boolean).join(', ')
  const initAddress = [dossier.prospects?.adresse, dossier.prospects?.code_postal, dossier.prospects?.ville].filter(Boolean).join(', ')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      {/* Nav */}
      <div style={{ background: C.nav, borderBottom: '1px solid #334155', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '5px 10px', borderRadius: 6 }}>← Dashboard</button>
          <span style={{ color: '#334155' }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#60A5FA', fontFamily: 'monospace' }}>{dossier.ref}</span>
          <span style={{ fontSize: 13, color: '#94A3B8' }}>{dossier.prospects?.raison_sociale}</span>
        </div>
        <span style={{ fontSize: 12, color: '#64748B' }}>{user?.email}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>{dossier.prospects?.raison_sociale || '—'}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.textSoft, fontFamily: 'monospace', background: C.bg, padding: '2px 7px', borderRadius: 4, border: `1px solid ${C.border}` }}>{dossier.ref}</span>
              <span style={{ fontSize: 11, color: C.textMid }}>{dossier.fiche_cee}</span>
              <span style={{ color: C.border }}>·</span>
              <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 700, background: statutInfo.bg, color: statutInfo.color }}>{statutInfo.label}</span>
              {dossier.statut_date && (
                <span style={{ fontSize: 11, color: C.textSoft }}>
                  depuis le {new Date(dossier.statut_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </span>
              )}
            </div>
          </div>
          {/* Assignation */}
          <div>
            {profile?.role === 'admin' ? (
              <select value={dossier.assigne_a || ''} onChange={e => changeAssignation(e.target.value)} disabled={savingAssigne}
                style={{ fontSize: 12, color: C.text, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', opacity: savingAssigne ? .6 : 1 }}>
                <option value="">— Non assigné —</option>
                {profiles.filter(p => ['admin', 'commercial'].includes(p.role)).map(p => (
                  <option key={p.id} value={p.id}>{(`${p.prenom || ''} ${p.nom || ''}`.trim()) || p.email}</option>
                ))}
              </select>
            ) : dossier.assigne_a !== user?.id ? (
              <button onClick={() => changeAssignation(user?.id)} disabled={savingAssigne}
                style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: '#EFF6FF', border: `1px solid ${C.accent}44`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', opacity: savingAssigne ? .6 : 1 }}>
                {savingAssigne ? '…' : "M'attribuer"}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: C.textMid }}>Assigné à vous</span>
            )}
          </div>
        </div>

        {/* Pipeline statuts */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
            {STATUTS.map((s, i) => {
              const currentIdx = STATUTS.findIndex(x => x.id === dossier.statut)
              const isDone    = i < currentIdx
              const isCurrent = i === currentIdx
              const isPending = pendingStatut === s.id
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                  {i > 0 && <div style={{ width: 24, height: 3, background: isDone ? s.color : C.border, marginTop: 11, transition: 'background .2s' }} />}
                  <button
                    onClick={() => {
                      if (s.id === dossier.statut) { setPendingStatut(null); return }
                      setPendingStatut(s.id)
                      setStatutForm({ statut: s.id, date: new Date().toISOString().split('T')[0] })
                    }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: isPending ? `${s.color}11` : 'transparent', border: isPending ? `1px solid ${s.color}44` : '1px solid transparent', cursor: 'pointer', padding: '6px 8px', borderRadius: 10, transition: 'all .15s', minWidth: 60 }}
                  >
                    <div style={{ width: isCurrent ? 22 : 14, height: isCurrent ? 22 : 14, borderRadius: '50%', flexShrink: 0, background: isCurrent ? s.color : isDone ? s.color + '99' : '#E2E8F0', border: isCurrent ? `4px solid ${s.color}33` : 'none', boxShadow: isCurrent ? `0 0 0 3px ${s.color}22` : 'none', boxSizing: 'border-box', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isDone && <span style={{ fontSize: 8, color: '#fff', fontWeight: 900 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 10, color: isCurrent ? s.color : isDone ? C.textMid : C.textSoft, fontWeight: isCurrent ? 800 : isDone ? 500 : 400, whiteSpace: 'nowrap', textAlign: 'center', maxWidth: 64, lineHeight: 1.3 }}>
                      {s.label}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
          {pendingStatut && (() => {
            const s = STATUTS.find(x => x.id === pendingStatut)
            return (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Passer à <span style={{ color: s.color }}>{s.label}</span></span>
                <input type="date" value={statutForm.date} onChange={e => setStatutForm(f => ({ ...f, date: e.target.value }))}
                  style={{ fontSize: 12, color: C.text, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 10px', fontFamily: 'inherit' }} />
                <button onClick={changeStatut} disabled={savingStatut}
                  style={{ padding: '6px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: savingStatut ? 'not-allowed' : 'pointer', fontFamily: 'inherit', border: 'none', background: s.color, color: '#fff', opacity: savingStatut ? .6 : 1 }}>
                  {savingStatut ? '…' : 'Confirmer'}
                </button>
                <button onClick={() => setPendingStatut(null)}
                  style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${C.border}`, background: 'transparent', color: C.textMid }}>
                  Annuler
                </button>
                {statutSaved && <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>✓ Mis à jour</span>}
              </div>
            )
          })()}
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: `2px solid ${C.border}` }}>
          {[
            { id: 'dossier',    label: '📋 Dossier',    badge: null },
            { id: 'appels',     label: '📞 Appels',     badge: appelCount > 0 ? String(appelCount) : null },
            { id: 'historique', label: '📋 Historique', badge: null },
            { id: 'visio',      label: '📹 Visio / VT', badge: null },
            { id: 'visites',    label: '🔧 Visites',    badge: visiteCount > 0 ? String(visiteCount) : null },
            { id: 'documents',  label: '📎 Documents',  badge: docCount > 0 ? String(docCount) : null },
            ...(['contacte','visio_planifiee','visio_effectuee','visite_planifiee','visite_effectuee','devis'].includes(dossier.statut) ? [{ id: 'email', label: '✉️ Email', badge: null }] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === t.id ? C.accent : 'transparent'}`, marginBottom: -2, color: activeTab === t.id ? C.accent : C.textMid, transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.label}
              {t.badge && (
                <span style={{ fontSize: 10, fontWeight: 700, background: activeTab === t.id ? C.accent : C.border, color: activeTab === t.id ? '#fff' : C.textMid, borderRadius: 10, padding: '1px 6px' }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Dossier ── */}
        {activeTab === 'dossier' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, alignItems: 'start' }}>
            {/* Colonne gauche */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ClientCard
                dossier={dossier}
                dossierId={id}
                adresseSiteInit={adresseSite}
                onSaved={(newProspect, newAdresse) => {
                  if (newProspect) setDossier(d => ({ ...d, prospects: newProspect }))
                  if (newAdresse) setAdresseSite(newAdresse)
                }}
              />
              {/* Notes */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Notes</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {notesSaved && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>✓ Sauvegardé</span>}
                    <button onClick={saveNotes} disabled={savingNotes}
                      style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: savingNotes ? 'not-allowed' : 'pointer', fontFamily: 'inherit', border: 'none', background: C.accent, color: '#fff', opacity: savingNotes ? .6 : 1 }}>
                      {savingNotes ? '…' : 'Sauvegarder'}
                    </button>
                  </div>
                </div>
                <textarea value={notesForm} onChange={e => setNotesForm(e.target.value)}
                  placeholder="Ajoute des notes sur ce dossier…" rows={6}
                  style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, lineHeight: 1.6, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
            </div>

            {/* Colonne droite : Simulation */}
            <div>
              <SimulationCard
                dossier={dossier}
                dossierId={id}
                simulation={simulation}
                sFormInit={sFormInit}
                onSaved={(newSim, updatedDossier) => {
                  setSimulation(newSim)
                  if (updatedDossier) setDossier(updatedDossier)
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'historique' && <HistoriqueTab dossierId={id} />}

        {activeTab === 'appels' && <AppelsTab dossierId={id} onCountChange={setAppelCount} />}

        {activeTab === 'visites' && (
          <VisitesTab
            dossierId={id}
            dossierRaisonSociale={dossier.prospects?.raison_sociale}
            onCountChange={setVisiteCount}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentsTab
            dossierId={id}
            dossier={dossier}
            session={session}
            onCountChange={setDocCount}
          />
        )}

        {activeTab === 'visio' && (
          <VisioTab
            dossierId={id}
            dossier={dossier}
            session={session}
            activeTab={activeTab}
            initEmails={initEmails}
            initAddress={initAddress}
            initLink={dossier.reunion_link || ''}
          />
        )}

        {activeTab === 'email' && (
          <EmailSection dossierId={id} statut={dossier.statut} />
        )}

      </div>
      </div>
    </div>
  )
}
