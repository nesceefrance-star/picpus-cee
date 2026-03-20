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

// ── Palette claire ────────────────────────────────────────────────────────────
const C = {
  bg:       '#F1F5F9',
  surface:  '#FFFFFF',
  border:   '#E2E8F0',
  borderMid:'#CBD5E1',
  text:     '#0F172A',
  textMid:  '#475569',
  textSoft: '#94A3B8',
  hover:    '#F8FAFC',
}

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

  const statutColor = STATUT_COLORS[statut] || C.textSoft

  return (
    <Paper elevation={0} sx={{ mb: 1.5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden', transition: 'box-shadow .15s', '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,.07)' } }}>
      {/* Header */}
      <Box
        onClick={() => onToggleExpand(dossierId)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5, cursor: 'pointer', '&:hover': { background: C.hover }, transition: 'background .12s' }}
      >
        {/* Barre couleur statut */}
        <Box sx={{ width: 3, height: 36, borderRadius: 2, background: statutColor, flexShrink: 0 }} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.text }}>{dossierRef}</Typography>
            <Typography sx={{ fontSize: 13, color: C.textMid }}>{prospect?.raison_sociale}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.2, flexWrap: 'wrap', alignItems: 'center' }}>
            {commercial && (
              <Typography sx={{ fontSize: 11, color: C.textSoft }}>
                {commercial.prenom} {commercial.nom} ·
              </Typography>
            )}
            <Typography sx={{ fontSize: 11, color: C.textSoft }}>{ficheCee}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
          {relanceBucket && (
            <Chip label={relanceBucket} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700,
              background: relanceBucket === 'J+7' ? '#DBEAFE' : relanceBucket === 'J+14' ? '#EDE9FE' : '#FEE2E2',
              color:      relanceBucket === 'J+7' ? '#1D4ED8' : relanceBucket === 'J+14' ? '#6D28D9' : '#991B1B',
            }} />
          )}
          <Chip
            label={STATUT_LABELS[statut] || statut}
            size="small"
            sx={{ height: 22, fontSize: 11, fontWeight: 600,
              background: statutColor + '18',
              color: statutColor,
              border: `1px solid ${statutColor}44` }}
          />
          {daysSince > 0 && <Typography sx={{ fontSize: 11, color: C.textSoft }}>J+{daysSince}</Typography>}
          {totalGens > 0 && <Chip label={`${totalGens} email${totalGens > 1 ? 's' : ''}`} size="small" sx={{ height: 20, fontSize: 10, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }} />}
          {expanded ? <ExpandLessIcon sx={{ color: C.textSoft, fontSize: 18 }} /> : <ExpandMoreIcon sx={{ color: C.textSoft, fontSize: 18 }} />}
        </Box>
      </Box>

      {/* Détail */}
      <Collapse in={expanded}>
        <Box sx={{ px: 3, pb: 2.5, pt: 0.5 }}>
          <Divider sx={{ borderColor: C.border, mb: 1.5 }} />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {prospect?.contact_email && (
              <Typography sx={{ fontSize: 12, color: C.textMid }}>📧 {prospect.contact_email}</Typography>
            )}
            {prospect?.contact_tel && (
              <Typography sx={{ fontSize: 12, color: C.textMid }}>📞 {prospect.contact_tel}</Typography>
            )}
          </Box>
          {/* Historique activités */}
          {activiteHistory.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', mb: 1 }}>
                Historique
              </Typography>
              {activiteHistory.map((a, i) => {
                const ICON = { note: '📝', appel: '📞', email: '✉️', rdv: '📅', statut: '🔄', document: '📎', devis: '📄' }
                return (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 0.5, borderBottom: i < activiteHistory.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <Typography sx={{ fontSize: 12, color: a.type === 'statut' ? '#2563EB' : C.textMid }}>
                      {ICON[a.type] || '·'} {a.contenu}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: C.textSoft, flexShrink: 0, ml: 1 }}>
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
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', mb: 1 }}>
                Emails générés
              </Typography>
              {Object.entries(generations).map(([type, gen]) => {
                const typeConfig = EMAIL_TYPES.find(t => t.key === type)
                return (
                  <Box key={type} sx={{ mb: 1, p: 1.5, background: '#F8FAFC', borderRadius: 1.5, border: `1px solid ${C.border}` }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#2563EB' }}>
                        {typeConfig?.label || type}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: C.textSoft }}>
                        {new Date(gen.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                    {gen.subject && (
                      <Typography sx={{ fontSize: 11, color: C.textMid, fontStyle: 'italic', mb: 0.3 }}>
                        Objet : {gen.subject}
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: 12, color: C.textMid, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography sx={{ fontSize: 13, color: C.textMid }}>
          Guide et exemples partagés avec tous les commerciaux. Injectés dans le prompt Claude.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {saved && <Chip icon={<CheckIcon />} label="Sauvegardé" size="small" color="success" />}
          <Button variant="contained" size="small" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
            sx={{ textTransform: 'none', fontWeight: 600 }}>
            Sauvegarder
          </Button>
        </Box>
      </Box>
      {error && <Typography sx={{ fontSize: 12, color: '#DC2626', mb: 2 }}>{error}</Typography>}

      <Paper elevation={0} sx={{ background: C.surface, border: `1px solid ${C.border}`, p: 2.5, mb: 3, borderRadius: 2 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.text, mb: 1.5 }}>Guide rédactionnel global</Typography>
        <TextField fullWidth multiline minRows={6} value={guide} onChange={e => setGuide(e.target.value)}
          placeholder="Ton, formules clés, ce qu'il faut éviter…"
          sx={{ '& textarea': { fontSize: 13, lineHeight: 1.6 } }} />
      </Paper>

      <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', mb: 1.5 }}>
        Exemples par type
      </Typography>
      {EMAIL_TYPES.map(t => (
        <Paper key={t.key} elevation={0} sx={{ background: C.surface, border: `1px solid ${C.border}`, p: 2.5, mb: 2, borderRadius: 2 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: C.text, mb: 1 }}>{t.label}</Typography>
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

function KpiCard({ label, value, sub, color, icon }) {
  return (
    <Paper elevation={0} sx={{
      p: 2.5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2,
      display: 'flex', flexDirection: 'column', gap: 0.5,
      transition: 'box-shadow .15s', '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,.07)' }
    }}>
      <Typography sx={{ fontSize: 11, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}
      </Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 800, color: color || C.text, lineHeight: 1.1 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: 11, color: C.textSoft }}>{sub}</Typography>}
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

const sectionTitle = (label) => (
  <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.08em', mb: 1.5, mt: 3 }}>
    {label}
  </Typography>
)

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
        supabase.from('profiles').select('id, prenom, nom'),
        supabase.from('devis_hub').select('dossier_id, lignes, prime, bat_qte, bat_pu_vente, created_at'),
        supabase.from('simulations').select('dossier_id, mwh_cumac, created_at'),
      ])
      setStats({
        dossiers:    dossiersRes.data  || [],
        appels:      appelsRes.data    || [],
        activites:   activitesRes.data || [],
        profiles:    profilesRes.data  || [],
        devis:       devisRes.data     || [],
        simulations: simuRes.data      || [],
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress size={28} /></Box>
  if (!stats) return null

  const { dossiers, appels, activites, profiles, devis, simulations } = stats
  const now = new Date()
  const periodeConf = PERIODES.find(p => p.key === periode)
  const since = periodeConf?.ms ? new Date(now - periodeConf.ms) : null
  const inPeriode = (d) => !since || new Date(d.created_at) > since

  const byStatut = {}
  for (const d of dossiers) byStatut[d.statut] = (byStatut[d.statut] || 0) + 1

  const PIPELINE = ['simulation','prospect','contacte','visio_planifiee','visio_effectuee','visite_planifiee','visite_effectuee','devis','ah','conforme','facture']

  const appelsP    = appels.filter(inPeriode)
  const activitesP = activites.filter(inPeriode)
  const emailsP    = activitesP.filter(a => a.type === 'email').length
  const rdvsP      = activitesP.filter(a => a.type === 'rdv').length
  const docsP      = activitesP.filter(a => a.type === 'document').length
  const nouveauxP  = dossiers.filter(inPeriode).length

  const devisP = devis.filter(inPeriode)
  const finTotals = devisP.reduce((acc, dv) => {
    const { totalHT, marge, prime } = computeDevisFinancials(dv)
    return { ca: acc.ca + totalHT, marge: acc.marge + marge, prime: acc.prime + prime }
  }, { ca: 0, marge: 0, prime: 0 })
  const margePct = finTotals.ca > 0 ? (finTotals.marge / finTotals.ca * 100).toFixed(1) : '—'

  const totalMwh = simulations.filter(inPeriode).reduce((s, sim) => s + (sim.mwh_cumac || 0), 0)

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
  const uniqueAssignes = [...new Set(dossiers.map(d => d.assigne_a).filter(Boolean))]
  const perCommercial = uniqueAssignes.map(uid => {
    const p = profileMap[uid] || {}
    const myDossiers = dossiers.filter(d => d.assigne_a === uid)
    const myIds = new Set(myDossiers.map(d => d.id))
    const myDevis = devisP.filter(dv => myIds.has(dv.dossier_id))
    const myFin = myDevis.reduce((acc, dv) => {
      const { totalHT, marge, prime } = computeDevisFinancials(dv)
      return { ca: acc.ca + totalHT, marge: acc.marge + marge, prime: acc.prime + prime }
    }, { ca: 0, marge: 0, prime: 0 })
    const myMwh = simulations.filter(s => myIds.has(s.dossier_id) && inPeriode(s)).reduce((s, sim) => s + (sim.mwh_cumac || 0), 0)
    const nom = p.prenom || p.nom ? `${p.prenom || ''} ${p.nom || ''}`.trim() : uid.slice(0, 8)
    return {
      uid, nom,
      actifs:  myDossiers.filter(d => !['facture','archive'].includes(d.statut)).length,
      visios:  myDossiers.filter(d => d.statut === 'visio_planifiee').length,
      visites: myDossiers.filter(d => d.statut === 'visite_planifiee').length,
      devisN:  myDossiers.filter(d => d.statut === 'devis').length,
      ca: myFin.ca, marge: myFin.marge, prime: myFin.prime, mwh: myMwh,
      total: myDossiers.length,
    }
  }).sort((a, b) => b.ca - a.ca)

  return (
    <Box>
      {/* Filtre période */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {PERIODES.map(p => (
          <Chip key={p.key} label={p.label} size="small" onClick={() => setPeriode(p.key)}
            sx={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', height: 28,
              background: periode === p.key ? '#2563EB' : C.surface,
              color: periode === p.key ? '#fff' : C.textMid,
              border: `1px solid ${periode === p.key ? '#2563EB' : C.border}`,
              '&:hover': { background: periode === p.key ? '#1D4ED8' : C.hover },
            }}
          />
        ))}
        <Typography sx={{ fontSize: 11, color: C.textSoft, ml: 0.5 }}>
          {since ? `depuis le ${since.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : 'toutes périodes'}
        </Typography>
      </Box>

      {/* Pipeline actuel */}
      {sectionTitle('Pipeline actuel')}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
        <KpiCard label="Dossiers actifs"   value={dossiers.filter(d => !['facture','archive'].includes(d.statut)).length} color="#2563EB" icon="📁" />
        <KpiCard label="Visio planifiées"  value={byStatut['visio_planifiee']  || 0} color="#0891B2" icon="🎥" />
        <KpiCard label="Visite planifiées" value={byStatut['visite_planifiee'] || 0} color="#D97706" icon="🏠" />
        <KpiCard label="Devis envoyés"     value={byStatut['devis'] || 0}            color="#7C3AED" icon="📄" />
        <KpiCard label="AH signés"         value={byStatut['ah']    || 0}            color="#059669" icon="✅" />
        <KpiCard label="Facturés"          value={byStatut['facture'] || 0}          color="#047857" icon="💰" />
      </Box>

      {/* Financier */}
      {sectionTitle(`Financier — ${periodeConf?.label}`)}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
        <KpiCard label="CA devis"          value={fmtK(finTotals.ca)}    color="#2563EB" sub={`${devisP.length} devis`} icon="📊" />
        <KpiCard label="Marge brute"       value={fmtK(finTotals.marge)} color={finTotals.marge >= 0 ? '#059669' : '#DC2626'} sub={margePct !== '—' ? `${margePct}% du CA` : undefined} icon="📈" />
        <KpiCard label="Prime CEE"         value={fmtK(finTotals.prime)} color="#7C3AED" icon="⚡" />
        <KpiCard label="MWh cumac"         value={totalMwh > 0 ? `${totalMwh.toFixed(0)} MWh` : '—'} color="#D97706" icon="🔋" />
        <KpiCard label="Nouveaux dossiers" value={nouveauxP}             color={C.textMid} icon="🆕" />
      </Box>

      {/* Activité */}
      {sectionTitle(`Activité — ${periodeConf?.label}`)}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1.5 }}>
        <KpiCard label="Appels"    value={appelsP.length} color={C.textMid} icon="📞" />
        <KpiCard label="Emails"    value={emailsP}        color="#4F46E5"   icon="✉️" />
        <KpiCard label="RDV"       value={rdvsP}          color="#DB2777"   icon="📅" />
        <KpiCard label="Documents" value={docsP}          color="#78716C"   icon="📎" />
      </Box>

      {/* Pipeline détaillé */}
      {sectionTitle('Répartition pipeline')}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        {PIPELINE.map(s => {
          const n = byStatut[s] || 0; if (!n) return null
          return (
            <Chip key={s} size="small" label={`${STATUT_LABELS[s] || s} · ${n}`}
              sx={{ height: 26, fontSize: 11, fontWeight: 600,
                background: (STATUT_COLORS[s] || C.border) + '18',
                color: STATUT_COLORS[s] || C.textSoft,
                border: `1px solid ${(STATUT_COLORS[s] || C.borderMid)}44` }}
            />
          )
        })}
      </Box>

      {/* Par commercial */}
      {perCommercial.length > 0 && (
        <>
          {sectionTitle('Par commercial')}
          <Paper elevation={0} sx={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ overflowX: 'auto' }}>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <Box component="thead">
                  <Box component="tr" sx={{ background: '#F8FAFC', borderBottom: `1px solid ${C.border}` }}>
                    {['Commercial','Actifs','Visio','Visite','Devis','CA','Marge','Prime CEE','MWh cumac'].map(h => (
                      <Box component="th" key={h} sx={{
                        textAlign: h === 'Commercial' ? 'left' : 'right',
                        py: 1.2, px: 2, fontSize: 10, fontWeight: 700, color: C.textSoft,
                        textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap'
                      }}>{h}</Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {perCommercial.map((p, idx) => (
                    <Box component="tr" key={p.uid} sx={{
                      borderBottom: idx < perCommercial.length - 1 ? `1px solid ${C.border}` : 'none',
                      '&:hover': { background: C.hover }
                    }}>
                      {[
                        { v: p.nom,    align: 'left',  color: C.text,   fw: 700 },
                        { v: p.actifs, align: 'right', color: '#2563EB' },
                        { v: p.visios, align: 'right', color: '#0891B2' },
                        { v: p.visites,align: 'right', color: '#D97706' },
                        { v: p.devisN, align: 'right', color: '#7C3AED' },
                        { v: fmtK(p.ca),    align: 'right', color: '#2563EB' },
                        { v: fmtK(p.marge), align: 'right', color: p.marge >= 0 ? '#059669' : '#DC2626' },
                        { v: fmtK(p.prime), align: 'right', color: '#7C3AED' },
                        { v: p.mwh > 0 ? `${p.mwh.toFixed(0)} MWh` : '—', align: 'right', color: '#D97706' },
                      ].map((c, i) => (
                        <Box component="td" key={i} sx={{ py: 1.2, px: 2, textAlign: c.align, color: c.color, fontWeight: c.fw || 500, whiteSpace: 'nowrap', fontSize: 13 }}>{c.v}</Box>
                      ))}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Paper>
        </>
      )}
    </Box>
  )
}

// ── Onglet Activité équipe ────────────────────────────────────────────────────

const TYPE_ICON  = { note: '📝', appel: '📞', email: '✉️', rdv: '📅', statut: '🔄', document: '📎', devis: '📄' }
const TYPE_LABEL = { note: 'Note', appel: 'Appel', email: 'Email', rdv: 'RDV', statut: 'Statut', document: 'Document', devis: 'Devis' }
const TYPE_COLOR = { appel: '#0891B2', email: '#4F46E5', rdv: '#DB2777', document: '#78716C', devis: '#7C3AED', note: '#64748B', statut: '#2563EB' }

function ActiviteEquipeTab() {
  const [activites, setActivites]               = useState([])
  const [loading, setLoading]                   = useState(true)
  const [typeFilter, setTypeFilter]             = useState('all')
  const [commercialFilter, setCommercialFilter] = useState('all')
  const [profiles, setProfiles]                 = useState([])

  const fetchActivites = useCallback(async () => {
    setLoading(true)
    const [actRes, profRes] = await Promise.all([
      supabase.from('activites')
        .select('*, dossiers(ref, prospects(raison_sociale))')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('profiles').select('id, prenom, nom'),
    ])
    setActivites(actRes.data || [])
    setProfiles(profRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchActivites() }, [fetchActivites])

  const filtered = activites
    .filter(a => typeFilter === 'all' || a.type === typeFilter)
    .filter(a => commercialFilter === 'all' || a.user_id === commercialFilter)

  const filterChip = (active, label, onClick) => (
    <Chip label={label} size="small" onClick={onClick}
      sx={{ cursor: 'pointer', fontSize: 11, fontWeight: active ? 700 : 500, height: 26,
        background: active ? '#2563EB' : C.surface, color: active ? '#fff' : C.textMid,
        border: `1px solid ${active ? '#2563EB' : C.border}`,
        '&:hover': { background: active ? '#1D4ED8' : C.hover } }}
    />
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Typography sx={{ fontSize: 13, color: C.textMid }}>200 dernières activités de l'équipe</Typography>
        <Button variant="outlined" size="small" onClick={fetchActivites} disabled={loading}
          sx={{ fontSize: 12, textTransform: 'none', borderColor: C.border, color: C.textMid, '&:hover': { borderColor: C.borderMid } }}>
          ↻ Actualiser
        </Button>
      </Box>

      {/* Filtre par commercial */}
      {profiles.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography sx={{ fontSize: 11, color: C.textSoft, fontWeight: 600, mr: 0.5 }}>Commercial :</Typography>
          {filterChip(commercialFilter === 'all', 'Tous', () => setCommercialFilter('all'))}
          {profiles.map(p => filterChip(
            commercialFilter === p.id,
            `${p.prenom} ${p.nom}`,
            () => setCommercialFilter(p.id)
          ))}
        </Box>
      )}

      {/* Filtre par type */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {['all', 'appel', 'rdv', 'email', 'document', 'devis', 'note', 'statut'].map(t => (
          filterChip(
            typeFilter === t,
            t === 'all' ? 'Tout' : (TYPE_LABEL[t] || t),
            () => setTypeFilter(t)
          )
        ))}
      </Box>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress size={28} /></Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ fontSize: 14, color: C.textSoft }}>Aucune activité.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filtered.map(a => {
            const dossierRef = a.dossiers?.ref || '—'
            const societe    = a.dossiers?.prospects?.raison_sociale || ''
            const tColor     = TYPE_COLOR[a.type] || C.textSoft
            return (
              <Paper key={a.id} elevation={0} sx={{
                p: 1.5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2,
                display: 'flex', gap: 1.5, alignItems: 'flex-start',
                transition: 'box-shadow .12s', '&:hover': { boxShadow: '0 2px 6px rgba(0,0,0,.06)' }
              }}>
                <Box sx={{ width: 28, height: 28, borderRadius: 1.5, background: tColor + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
                  {TYPE_ICON[a.type] || '·'}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.3, flexWrap: 'wrap' }}>
                    <Chip label={dossierRef} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }} />
                    {societe && <Typography sx={{ fontSize: 11, color: C.textSoft }}>{societe}</Typography>}
                    <Chip label={TYPE_LABEL[a.type] || a.type} size="small" sx={{ height: 18, fontSize: 10, background: tColor + '15', color: tColor }} />
                  </Box>
                  <Typography sx={{ fontSize: 13, color: C.textMid }}>{a.contenu}</Typography>
                  <Typography sx={{ fontSize: 11, color: C.textSoft, mt: 0.3 }}>
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
  const [expandedSet, setExpandedSet] = useState(new Set())

  const toggleExpand = (id) => {
    setExpandedSet(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
    <Box sx={{ minHeight: '100vh', background: C.bg, py: { xs: 2, md: 4 }, px: { xs: 1.5, md: 3 } }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: C.text, mb: 0.5 }}>
            Suivi équipe
          </Typography>
          <Typography sx={{ fontSize: 13, color: C.textSoft }}>
            Vue admin — dossiers actifs de tous les commerciaux
          </Typography>
        </Box>

        {/* Tabs */}
        <Paper elevation={0} sx={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, mb: 3 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              px: 1,
              '& .MuiTab-root': { fontSize: 13, textTransform: 'none', fontWeight: 600, color: C.textMid, minHeight: 48 },
              '& .Mui-selected': { color: '#2563EB' },
              '& .MuiTabs-indicator': { backgroundColor: '#2563EB' },
            }}
          >
            <Tab label="📊 Dashboard" />
            <Tab label="Dossiers actifs" />
            <Tab label="Activité équipe" />
            <Tab label="Style & Exemples" />
          </Tabs>
        </Paper>

        {/* Contenu des onglets */}
        <Box>
          {tab === 0 && <DashboardTab />}

          {tab === 1 && (
            <>
              {commercials.length > 0 && (
                <Paper elevation={0} sx={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, px: 2, py: 1.5, mb: 2 }}>
                  <ToggleButtonGroup value={filter} exclusive onChange={(_, v) => { if (v) setFilter(v) }} size="small">
                    <ToggleButton value="all" sx={{ fontSize: 12, px: 1.5, textTransform: 'none', fontWeight: 600 }}>
                      Tous ({dossiers.length})
                    </ToggleButton>
                    {commercials.map(c => (
                      <ToggleButton key={c.id} value={c.id} sx={{ fontSize: 12, px: 1.5, textTransform: 'none', fontWeight: 600 }}>
                        {c.prenom} {c.nom} ({dossiers.filter(d => d.assigneA === c.id).length})
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Paper>
              )}

              {loading ? (
                <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress size={28} /></Box>
              ) : filteredDossiers.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography sx={{ fontSize: 14, color: C.textSoft }}>Aucun dossier actif.</Typography>
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
      </Box>
    </Box>
  )
}
