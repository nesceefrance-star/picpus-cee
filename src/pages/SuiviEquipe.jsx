// src/pages/SuiviEquipe.jsx
// Vue admin — suivi de tous les dossiers actifs par commercial.
// Accessible uniquement aux admins.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'

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
        <Tab label="Dossiers actifs" sx={{ fontSize: 13, textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Style & Exemples" sx={{ fontSize: 13, textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      {tab === 0 && (
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

      {tab === 1 && <StyleExemplesTab session={session} />}
    </Box>
  )
}
