// src/pages/SuiviEquipe.jsx
// Vue admin — suivi de tous les dossiers actifs par commercial.
// Accessible uniquement aux admins.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Collapse from '@mui/material/Collapse'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import SaveIcon from '@mui/icons-material/Save'
import CheckIcon from '@mui/icons-material/Check'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

const STATUT_LABELS = {
  simulation: 'Simulation', prospect: 'Prospect', contacte: 'Contacté',
  visio_planifiee: 'Visio planifiée', visio_effectuee: 'Visio effectuée',
  visite_planifiee: 'Visite planifiée', visite_effectuee: 'Visite effectuée',
  devis: 'Devis envoyé', ah: 'AH signé', conforme: 'Conforme', facture: 'Facturé',
}

const STATUT_COLORS = {
  simulation: '#64748B', prospect: '#64748B', contacte: '#3B82F6',
  visio_planifiee: '#06B6D4', visio_effectuee: '#0D9488',
  visite_planifiee: '#F59E0B', visite_effectuee: '#EF6C00',
  devis: '#8B5CF6', ah: '#10B981', conforme: '#059669', facture: '#047857',
}

const EMAIL_TYPES = [
  { key: 'visio_creneaux', label: 'Créneaux visio',    statuts: ['contacte'] },
  { key: 'visio_confirm',  label: 'Confirmation visio', statuts: ['visio_planifiee'] },
  { key: 'post_visio',     label: 'Post-visio',         statuts: ['visio_effectuee'] },
  { key: 'visite_confirm', label: 'Confirmation visite',statuts: ['visite_planifiee'] },
  { key: 'envoi_devis',    label: 'Envoi de devis',     statuts: ['visite_effectuee'] },
  { key: 'relance',        label: 'Relance devis',      statuts: ['devis'] },
]

// ── Carte dossier ────────────────────────────────────────────────────────────

function DossierRow({ dossier, expanded, onToggleExpand }) {
  const { dossierId, dossierRef, ficheCee, statut, daysSince, relanceBucket, prospect, commercial, generations } = dossier

  const emailTypes = EMAIL_TYPES.filter(t => t.statuts.includes(statut))
  const totalGens  = Object.keys(generations || {}).length

  const [activiteHistory, setActiviteHistory] = useState([])
  useEffect(() => {
    if (!expanded) return
    supabase.from('activites').select('type, contenu, created_at')
      .eq('dossier_id', dossierId).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setActiviteHistory(data || []))
  }, [expanded, dossierId])

  return (
    <Paper sx={{ mb: 1.5, background: '#1E293B', border: '1px solid #334155', borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        onClick={() => onToggleExpand(dossierId)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.2, cursor: 'pointer', '&:hover': { background: '#273549' }, transition: 'background .15s' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{dossierRef}</Typography>
            <Typography sx={{ fontSize: 13, color: '#94A3B8' }}>{prospect?.raison_sociale}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.2, flexWrap: 'wrap' }}>
            {commercial && (
              <Typography sx={{ fontSize: 11, color: '#64748B' }}>
                {commercial.prenom} {commercial.nom} ·
              </Typography>
            )}
            <Typography sx={{ fontSize: 11, color: '#64748B' }}>{ficheCee}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
          {relanceBucket && (
            <Chip label={relanceBucket} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700,
              background: relanceBucket === 'J+7' ? '#1d4ed8' : relanceBucket === 'J+14' ? '#6d28d9' : '#991b1b', color: '#fff' }} />
          )}
          <Chip
            label={STATUT_LABELS[statut] || statut}
            size="small"
            sx={{ height: 22, fontSize: 11, fontWeight: 600,
              background: (STATUT_COLORS[statut] || '#334155') + '33',
              color: STATUT_COLORS[statut] || '#94A3B8',
              border: `1px solid ${(STATUT_COLORS[statut] || '#334155')}55` }}
          />
          {daysSince > 0 && <Typography sx={{ fontSize: 11, color: '#64748B' }}>J+{daysSince}</Typography>}
          {totalGens > 0 && <Chip label={`${totalGens} email${totalGens > 1 ? 's' : ''}`} size="small" sx={{ height: 20, fontSize: 10, background: '#064e3b', color: '#6ee7b7' }} />}
          {expanded ? <ExpandLessIcon sx={{ color: '#64748B', fontSize: 18 }} /> : <ExpandMoreIcon sx={{ color: '#64748B', fontSize: 18 }} />}
        </Box>
      </Box>

      {/* Détail */}
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
          <Divider sx={{ borderColor: '#334155', mb: 1.5 }} />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {prospect?.contact_email && (
              <Typography sx={{ fontSize: 12, color: '#94A3B8' }}>📧 {prospect.contact_email}</Typography>
            )}
            {prospect?.contact_tel && (
              <Typography sx={{ fontSize: 12, color: '#94A3B8' }}>📞 {prospect.contact_tel}</Typography>
            )}
          </Box>
          {/* Historique activités */}
          {activiteHistory.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1 }}>
                Historique
              </Typography>
              {activiteHistory.map((a, i) => {
                const ICON = { note: '📝', appel: '📞', email: '✉️', rdv: '📅', statut: '🔄', document: '📎', devis: '📄' }
                return (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 0.4, borderBottom: i < activiteHistory.length - 1 ? '1px solid #1E293B' : 'none' }}>
                    <Typography sx={{ fontSize: 12, color: a.type === 'statut' ? '#60A5FA' : '#94A3B8' }}>
                      {ICON[a.type] || '·'} {a.contenu}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: '#475569', flexShrink: 0, ml: 1 }}>
                      {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          )}

          {/* Emails générés */}
          {Object.keys(generations || {}).length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1 }}>
                Emails générés
              </Typography>
              {Object.entries(generations).map(([type, gen]) => {
                const typeConfig = EMAIL_TYPES.find(t => t.key === type)
                return (
                  <Box key={type} sx={{ mb: 1, p: 1.2, background: '#0F172A', borderRadius: 1.5, border: '1px solid #1e293b' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#60A5FA' }}>
                        {typeConfig?.label || type}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: '#475569' }}>
                        {new Date(gen.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                    {gen.subject && (
                      <Typography sx={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', mb: 0.3 }}>
                        Objet : {gen.subject}
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: 12, color: '#64748B', whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {gen.body}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  )
}

// ── Onglet Style & Exemples ──────────────────────────────────────────────────

function StyleExemplesTab({ session }) {
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [guide,    setGuide]    = useState('')
  const [exemples, setExemples] = useState({})
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!session) return
    fetch('/api/style-guide', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => r.json())
      .then(d => { setGuide(d.guide || ''); setExemples(d.exemples || {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [session])

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const r = await fetch('/api/style-guide', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide, exemples }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: 13, color: '#94A3B8' }}>
          Guide et exemples partagés avec tous les commerciaux. Injectés dans le prompt Claude.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {saved && <Chip icon={<CheckIcon />} label="Sauvegardé" size="small" color="success" />}
          <Button variant="contained" size="small" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}>
            Sauvegarder
          </Button>
        </Box>
      </Box>
      {error && <Typography sx={{ fontSize: 12, color: '#FC8181', mb: 2 }}>{error}</Typography>}

      <Paper sx={{ background: '#1E293B', border: '1px solid #334155', p: 2, mb: 3, borderRadius: 2 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', mb: 1.5 }}>Guide rédactionnel global</Typography>
        <TextField fullWidth multiline minRows={6} value={guide} onChange={e => setGuide(e.target.value)}
          placeholder="Ton, formules clés, ce qu'il faut éviter…"
          sx={{ '& textarea': { fontSize: 13, lineHeight: 1.6 } }} />
      </Paper>

      <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1.5 }}>
        Exemples par type
      </Typography>
      {EMAIL_TYPES.map(t => (
        <Paper key={t.key} sx={{ background: '#1E293B', border: '1px solid #334155', p: 2, mb: 2, borderRadius: 2 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', mb: 1 }}>{t.label}</Typography>
          <TextField fullWidth multiline minRows={4} value={exemples[t.key] || ''}
            onChange={e => setExemples(prev => ({ ...prev, [t.key]: e.target.value }))}
            placeholder={`Exemple d'email "${t.label}"…`}
            sx={{ '& textarea': { fontSize: 13, lineHeight: 1.6 } }} />
        </Paper>
      ))}
    </Box>
  )
}

// ── Onglet Dashboard ─────────────────────────────────────────────────────────

const PERIODES = [
  { key: '7j',   label: '7 jours',  ms: 7  * 24 * 3600 * 1000 },
  { key: '30j',  label: '30 jours', ms: 30 * 24 * 3600 * 1000 },
  { key: '90j',  label: '3 mois',   ms: 90 * 24 * 3600 * 1000 },
  { key: 'tout', label: 'Tout',     ms: null },
]

const fmtK = (n) => {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' M€'
  if (n >= 1000)    return (n / 1000).toFixed(0) + ' k€'
  return n.toFixed(0) + ' €'
}

function KpiCard({ label, value, sub, color }) {
  return (
    <Paper sx={{ p: 1.5, background: '#1E293B', border: '1px solid #334155', borderRadius: 2 }}>
      <Typography sx={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: color || '#F1F5F9', lineHeight: 1.1 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 10, color: '#475569', mt: 0.3 }}>{sub}</Typography>}
    </Paper>
  )
}

function computeDevisFinancials(devis) {
  const lignes = (devis.lignes || []).filter(l => l.inclus !== false)
  const totalHT = lignes.reduce((s, l) => s + (l.puVente || 0) * (l.qte || 0), 0)
    + (devis.bat_qte || 0) * (devis.bat_pu_vente || 0)
  const achat = lignes.reduce((s, l) => s + (l.puAchat || 0) * (l.qte || 0), 0)
  return { totalHT, marge: totalHT - achat, prime: devis.prime || 0 }
}

function DashboardTab() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState('30j')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [dossiersRes, appelsRes, activitesRes, profilesRes, devisRes, simuRes] = await Promise.all([
        supabase.from('dossiers').select('id, statut, assigne_a, created_at'),
        supabase.from('appels').select('etat, created_at, dossier_id'),
        supabase.from('activites').select('type, created_at, user_id, dossier_id'),
        supabase.from('profiles').select('user_id, prenom, nom'),
        supabase.from('devis_hub').select('dossier_id, lignes, prime, bat_qte, bat_pu_vente, created_at'),
        supabase.from('simulations').select('dossier_id, mwh_cumac, created_at'),
      ])
      setStats({
        dossiers:  dossiersRes.data  || [],
        appels:    appelsRes.data    || [],
        activites: activitesRes.data || [],
        profiles:  profilesRes.data  || [],
        devis:     devisRes.data     || [],
        simulations: simuRes.data    || [],
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={24} /></Box>
  if (!stats) return null

  const { dossiers, appels, activites, profiles, devis, simulations } = stats
  const now = new Date()
  const periodeConf = PERIODES.find(p => p.key === periode)
  const since = periodeConf?.ms ? new Date(now - periodeConf.ms) : null
  const inPeriode = (d) => !since || new Date(d.created_at) > since

  const byStatut = {}
  for (const d of dossiers) byStatut[d.statut] = (byStatut[d.statut] || 0) + 1

  const PIPELINE = ['simulation','prospect','contacte','visio_planifiee','visio_effectuee','visite_planifiee','visite_effectuee','devis','ah','conforme','facture']

  // Activités filtrées par période
  const appelsP    = appels.filter(inPeriode)
  const activitesP = activites.filter(inPeriode)
  const emailsP    = activitesP.filter(a => a.type === 'email').length
  const rdvsP      = activitesP.filter(a => a.type === 'rdv').length
  const docsP      = activitesP.filter(a => a.type === 'document').length
  const nouveauxP  = dossiers.filter(inPeriode).length

  // Financier — devis filtrés par période
  const devisP = devis.filter(inPeriode)
  const finTotals = devisP.reduce((acc, dv) => {
    const { totalHT, marge, prime } = computeDevisFinancials(dv)
    return { ca: acc.ca + totalHT, marge: acc.marge + marge, prime: acc.prime + prime }
  }, { ca: 0, marge: 0, prime: 0 })
  const margePct = finTotals.ca > 0 ? (finTotals.marge / finTotals.ca * 100).toFixed(1) : '—'

  // MWh cumac — simulations filtrées par période
  const totalMwh = simulations.filter(inPeriode).reduce((s, sim) => s + (sim.mwh_cumac || 0), 0)

  // Par commercial
  const perCommercial = profiles.map(p => {
    const myDossiers = dossiers.filter(d => d.assigne_a === p.user_id)
    const myIds = new Set(myDossiers.map(d => d.id))
    const myDevis = devisP.filter(dv => myIds.has(dv.dossier_id))
    const myFin = myDevis.reduce((acc, dv) => {
      const { totalHT, marge, prime } = computeDevisFinancials(dv)
      return { ca: acc.ca + totalHT, marge: acc.marge + marge, prime: acc.prime + prime }
    }, { ca: 0, marge: 0, prime: 0 })
    const myMwh = simulations.filter(s => myIds.has(s.dossier_id) && inPeriode(s)).reduce((s, sim) => s + (sim.mwh_cumac || 0), 0)
    return {
      ...p,
      actifs:  myDossiers.filter(d => !['facture','archive'].includes(d.statut)).length,
      visios:  myDossiers.filter(d => d.statut === 'visio_planifiee').length,
      visites: myDossiers.filter(d => d.statut === 'visite_planifiee').length,
      devisN:  myDossiers.filter(d => d.statut === 'devis').length,
      ca: myFin.ca, marge: myFin.marge, prime: myFin.prime, mwh: myMwh,
      total: myDossiers.length,
    }
  }).filter(p => p.total > 0).sort((a, b) => b.ca - a.ca)

  const sectionTitle = (label) => (
    <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.08em', mb: 1.5, mt: 2.5 }}>
      {label}
    </Typography>
  )

  return (
    <Box>
      {/* Filtre période */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {PERIODES.map(p => (
          <Chip key={p.key} label={p.label} size="small" onClick={() => setPeriode(p.key)}
            sx={{ fontSize: 11, fontWeight: 600, cursor: 'pointer', height: 26,
              background: periode === p.key ? '#3B82F6' : '#1E293B',
              color: periode === p.key ? '#fff' : '#94A3B8',
              border: `1px solid ${periode === p.key ? '#3B82F6' : '#334155'}`,
              '&:hover': { background: periode === p.key ? '#2563EB' : '#273549' },
            }}
          />
        ))}
        <Typography sx={{ fontSize: 11, color: '#475569', alignSelf: 'center', ml: 1 }}>
          {since ? `depuis le ${since.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : 'toutes périodes'}
        </Typography>
      </Box>

      {/* Pipeline actuel */}
      {sectionTitle('Pipeline actuel')}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1.5, mb: 1 }}>
        <KpiCard label="Dossiers actifs"    value={dossiers.filter(d => !['facture','archive'].includes(d.statut)).length} color="#60A5FA" />
        <KpiCard label="Visio planifiées"   value={byStatut['visio_planifiee']  || 0} color="#06B6D4" />
        <KpiCard label="Visite planifiées"  value={byStatut['visite_planifiee'] || 0} color="#F59E0B" />
        <KpiCard label="Devis envoyés"      value={byStatut['devis'] || 0}            color="#8B5CF6" />
        <KpiCard label="AH signés"          value={byStatut['ah']    || 0}            color="#10B981" />
        <KpiCard label="Facturés"           value={byStatut['facture'] || 0}          color="#047857" />
      </Box>

      {/* Financier */}
      {sectionTitle(`Financier (${periodeConf?.label})`)}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5, mb: 1 }}>
        <KpiCard label="CA devis"    value={fmtK(finTotals.ca)}    color="#60A5FA" sub={`${devisP.length} devis`} />
        <KpiCard label="Marge brute" value={fmtK(finTotals.marge)} color={finTotals.marge >= 0 ? '#10B981' : '#EF4444'} sub={margePct !== '—' ? `${margePct}% du CA` : undefined} />
        <KpiCard label="Prime CEE"   value={fmtK(finTotals.prime)} color="#8B5CF6" />
        <KpiCard label="MWh cumac"   value={totalMwh > 0 ? `${totalMwh.toFixed(0)} MWh` : '—'} color="#F59E0B" />
        <KpiCard label="Nouveaux dossiers" value={nouveauxP} color="#64748B" />
      </Box>

      {/* Activité */}
      {sectionTitle(`Activité (${periodeConf?.label})`)}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1.5, mb: 1 }}>
        <KpiCard label="Appels"   value={appelsP.length} color="#64748B" />
        <KpiCard label="Emails"   value={emailsP}        color="#6366F1" />
        <KpiCard label="RDV"      value={rdvsP}          color="#EC4899" />
        <KpiCard label="Documents" value={docsP}         color="#78716C" />
      </Box>

      {/* Pipeline détaillé */}
      {sectionTitle('Répartition pipeline')}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        {PIPELINE.map(s => {
          const n = byStatut[s] || 0; if (!n) return null
          return (
            <Chip key={s} size="small" label={`${STATUT_LABELS[s] || s} · ${n}`}
              sx={{ height: 24, fontSize: 11, fontWeight: 600,
                background: (STATUT_COLORS[s] || '#334155') + '33',
                color: STATUT_COLORS[s] || '#94A3B8',
                border: `1px solid ${(STATUT_COLORS[s] || '#334155')}55` }}
            />
          )
        })}
      </Box>

      {/* Par commercial */}
      {perCommercial.length > 0 && (
        <>
          {sectionTitle('Par commercial')}
          <Box sx={{ overflowX: 'auto' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <Box component="thead">
                <Box component="tr" sx={{ color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {['Commercial','Actifs','Visio','Visite','Devis','CA','Marge','Prime CEE','MWh cumac'].map(h => (
                    <Box component="th" key={h} sx={{ textAlign: h === 'Commercial' ? 'left' : 'right', pb: 1, pr: 2, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {perCommercial.map(p => (
                  <Box component="tr" key={p.user_id} sx={{ borderTop: '1px solid #1E293B', '&:hover td': { background: '#273549' } }}>
                    {[
                      { v: `${p.prenom} ${p.nom}`, align: 'left',  color: '#F1F5F9', fw: 700 },
                      { v: p.actifs,  align: 'right', color: '#60A5FA' },
                      { v: p.visios,  align: 'right', color: '#06B6D4' },
                      { v: p.visites, align: 'right', color: '#F59E0B' },
                      { v: p.devisN,  align: 'right', color: '#8B5CF6' },
                      { v: fmtK(p.ca),    align: 'right', color: '#60A5FA' },
                      { v: fmtK(p.marge), align: 'right', color: p.marge >= 0 ? '#10B981' : '#EF4444' },
                      { v: fmtK(p.prime), align: 'right', color: '#8B5CF6' },
                      { v: p.mwh > 0 ? `${p.mwh.toFixed(0)} MWh` : '—', align: 'right', color: '#F59E0B' },
                    ].map((c, i) => (
                      <Box component="td" key={i} sx={{ py: 1, pr: 2, textAlign: c.align, color: c.color, fontWeight: c.fw || 400, whiteSpace: 'nowrap' }}>{c.v}</Box>
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </>
      )}
    </Box>
  )
}

// ── Onglet Activité équipe ────────────────────────────────────────────────────

const TYPE_ICON = { note: '📝', appel: '📞', email: '✉️', rdv: '📅', statut: '🔄', document: '📎', devis: '📄' }
const TYPE_LABEL = { note: 'Note', appel: 'Appel', email: 'Email', rdv: 'RDV', statut: 'Statut', document: 'Document', devis: 'Devis' }

function ActiviteEquipeTab() {
  const [activites, setActivites]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [typeFilter, setTypeFilter]   = useState('all')
  const [commercialFilter, setCommercialFilter] = useState('all')
  const [profiles, setProfiles]       = useState([])

  const fetchActivites = useCallback(async () => {
    setLoading(true)
    const [actRes, profRes] = await Promise.all([
      supabase.from('activites')
        .select('*, dossiers(ref, prospects(raison_sociale))')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('profiles').select('user_id, prenom, nom'),
    ])
    setActivites(actRes.data || [])
    setProfiles(profRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchActivites() }, [fetchActivites])

  const filtered = activites
    .filter(a => typeFilter === 'all' || a.type === typeFilter)
    .filter(a => commercialFilter === 'all' || a.user_id === commercialFilter)

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: 13, color: '#94A3B8' }}>100 dernières activités de l'équipe</Typography>
        <Button variant="outlined" size="small" onClick={fetchActivites} disabled={loading}
          sx={{ fontSize: 12, textTransform: 'none', borderColor: '#334155', color: '#94A3B8' }}>
          ↻ Actualiser
        </Button>
      </Box>

      {/* Filtre par commercial */}
      {profiles.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography sx={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Commercial :</Typography>
          {[{ user_id: 'all', prenom: 'Tous', nom: '' }, ...profiles].map(p => (
            <Chip key={p.user_id} size="small"
              label={p.user_id === 'all' ? 'Tous' : `${p.prenom} ${p.nom}`}
              onClick={() => setCommercialFilter(p.user_id)}
              sx={{ cursor: 'pointer', fontSize: 11, fontWeight: commercialFilter === p.user_id ? 700 : 400,
                background: commercialFilter === p.user_id ? '#2563EB' : '#1E293B',
                color: commercialFilter === p.user_id ? '#fff' : '#94A3B8',
                border: `1px solid ${commercialFilter === p.user_id ? '#2563EB' : '#334155'}` }}
            />
          ))}
        </Box>
      )}

      {/* Filtre par type */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
        {['all', 'appel', 'rdv', 'email', 'document', 'devis', 'note', 'statut'].map(t => (
          <Chip
            key={t}
            label={t === 'all' ? 'Tout' : (TYPE_LABEL[t] || t)}
            size="small"
            onClick={() => setTypeFilter(t)}
            sx={{
              cursor: 'pointer',
              background: typeFilter === t ? '#3B82F6' : '#1E293B',
              color: typeFilter === t ? '#fff' : '#94A3B8',
              border: `1px solid ${typeFilter === t ? '#3B82F6' : '#334155'}`,
              fontSize: 11,
              fontWeight: typeFilter === t ? 700 : 400,
            }}
          />
        ))}
      </Box>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={24} /></Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ fontSize: 14, color: '#64748B' }}>Aucune activité.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filtered.map(a => {
            const dossierRef = a.dossiers?.ref || '—'
            const societe = a.dossiers?.prospects?.raison_sociale || ''
            return (
              <Paper key={a.id} sx={{ p: 1.5, background: '#1E293B', border: '1px solid #334155', borderRadius: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Typography sx={{ fontSize: 16, lineHeight: '20px', flexShrink: 0 }}>{TYPE_ICON[a.type] || '·'}</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.3, flexWrap: 'wrap' }}>
                    <Chip label={dossierRef} size="small" sx={{ height: 18, fontSize: 10, background: '#0F172A', color: '#60A5FA', border: '1px solid #1E3A5F' }} />
                    {societe && <Typography sx={{ fontSize: 11, color: '#64748B' }}>{societe}</Typography>}
                    <Chip label={TYPE_LABEL[a.type] || a.type} size="small" sx={{ height: 18, fontSize: 10, background: '#0F172A', color: '#94A3B8', border: '1px solid #334155' }} />
                  </Box>
                  <Typography sx={{ fontSize: 12, color: '#CBD5E1' }}>{a.contenu}</Typography>
                  <Typography sx={{ fontSize: 11, color: '#475569', mt: 0.3 }}>
                    {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
              </Paper>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────

export default function SuiviEquipe() {
  const { session, profile } = useStore()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'

  const [tab,         setTab]         = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [dossiers,    setDossiers]    = useState([])
  const [commercials, setCommercials] = useState([])
  const [filter,      setFilter]      = useState('all')
  // Expanded state centralisé pour survivre aux re-fetches
  const [expandedSet, setExpandedSet] = useState(new Set())

  const toggleExpand = (id) => {
    setExpandedSet(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Rediriger les non-admins
  useEffect(() => {
    if (profile && !isAdmin) navigate('/', { replace: true })
  }, [profile, isAdmin])

  const fetchDossiers = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const r = await fetch('/api/relances-list', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await r.json()
      setDossiers(d.dossiers || [])
      setCommercials(d.commercials || [])
    } catch (e) { /* ignore en local */ }
    setLoading(false)
  }, [session])

  useEffect(() => { fetchDossiers() }, [fetchDossiers])

  const filteredDossiers = filter === 'all'
    ? dossiers
    : dossiers.filter(d => d.assigneA === filter)

  if (!isAdmin) return null

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#F8FAFC', mb: 0.5 }}>Suivi équipe</Typography>
        <Typography sx={{ fontSize: 13, color: '#64748B' }}>
          Vue admin — dossiers actifs de tous les commerciaux
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #334155' }}>
        <Tab label="📊 Dashboard" sx={{ fontSize: 13, textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Dossiers actifs" sx={{ fontSize: 13, textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Activité équipe" sx={{ fontSize: 13, textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Style & Exemples" sx={{ fontSize: 13, textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      {tab === 0 && <DashboardTab />}

      {tab === 1 && (
        <>
          {/* Filtre commercial */}
          {commercials.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <ToggleButtonGroup value={filter} exclusive onChange={(_, v) => { if (v) setFilter(v) }} size="small">
                <ToggleButton value="all" sx={{ fontSize: 12, px: 1.5 }}>Tous ({dossiers.length})</ToggleButton>
                {commercials.map(c => (
                  <ToggleButton key={c.id} value={c.id} sx={{ fontSize: 12, px: 1.5 }}>
                    {c.prenom} {c.nom} ({dossiers.filter(d => d.assigneA === c.id).length})
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
          ) : filteredDossiers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography sx={{ fontSize: 14, color: '#64748B' }}>Aucun dossier actif.</Typography>
            </Box>
          ) : (
            filteredDossiers.map(d => (
              <DossierRow
                key={d.dossierId}
                dossier={d}
                expanded={expandedSet.has(d.dossierId)}
                onToggleExpand={toggleExpand}
              />
            ))
          )}
        </>
      )}

      {tab === 2 && <ActiviteEquipeTab />}
      {tab === 3 && <StyleExemplesTab session={session} />}
    </Box>
  )
}
