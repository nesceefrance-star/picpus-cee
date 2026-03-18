// src/pages/MonAssistante.jsx
// Mon assistante — deux onglets :
//   1. Dossiers actifs : génération d'emails par type, changement de statut
//   2. Style & Exemples : guide rédactionnel + exemples par type (partagés)

import { useState, useEffect, useCallback } from 'react'
import useStore from '../store/useStore'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Collapse from '@mui/material/Collapse'
import Tooltip from '@mui/material/Tooltip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'

// ── Config ──────────────────────────────────────────────────────────────────

const ACTIVE_STATUTS = [
  'contacte', 'visio_planifiee', 'visio_effectuee',
  'visite_planifiee', 'visite_effectuee', 'devis',
]

const ALL_STATUTS = [
  'simulation', 'prospect', 'contacte',
  'visio_planifiee', 'visio_effectuee',
  'visite_planifiee', 'visite_effectuee',
  'devis', 'ah', 'conforme', 'facture',
]

const STATUT_LABELS = {
  simulation:       'Simulation',
  prospect:         'Prospect',
  contacte:         'Contacté',
  visio_planifiee:  'Visio planifiée',
  visio_effectuee:  'Visio effectuée',
  visite_planifiee: 'Visite planifiée',
  visite_effectuee: 'Visite effectuée',
  devis:            'Devis envoyé',
  ah:               'AH signé',
  conforme:         'Conforme',
  facture:          'Facturé',
}

const STATUT_COLORS = {
  simulation:       '#64748B',
  prospect:         '#64748B',
  contacte:         '#3B82F6',
  visio_planifiee:  '#06B6D4',
  visio_effectuee:  '#0D9488',
  visite_planifiee: '#F59E0B',
  visite_effectuee: '#EF6C00',
  devis:            '#8B5CF6',
  ah:               '#10B981',
  conforme:         '#059669',
  facture:          '#047857',
}

const EMAIL_TYPES = [
  { key: 'visio_creneaux', label: 'Proposition créneaux visio',    statuts: ['contacte'],         needsSlots: true  },
  { key: 'visio_confirm',  label: 'Confirmation visio',            statuts: ['visio_planifiee'],  needsSlots: false },
  { key: 'post_visio',     label: 'Post-visio éléments',           statuts: ['visio_effectuee'],  needsSlots: false },
  { key: 'visite_confirm', label: 'Confirmation visite technique', statuts: ['visite_planifiee'], needsSlots: false },
  { key: 'envoi_devis',    label: 'Envoi de devis',                statuts: ['visite_effectuee'], needsSlots: false },
  { key: 'relance',        label: 'Relance devis',                 statuts: ['devis'],            needsSlots: false },
]

// Retourne les types d'emails disponibles pour un statut donné
function getEmailTypesForStatut(statut) {
  return EMAIL_TYPES.filter(t => t.statuts.includes(statut))
}

// ── Composant DossierCard ────────────────────────────────────────────────────

function DossierCard({ dossier, session, onStatusUpdated }) {
  const { dossierId, dossierRef, ficheCee, statut, statutDate, primeCee, montantDevis,
          daysSince, relanceBucket, prospect, generations } = dossier

  const [expanded,        setExpanded]        = useState(false)
  const [statusVal,       setStatusVal]        = useState(statut)
  const [statusDate,      setStatusDate]       = useState(
    statutDate ? new Date(statutDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  )
  const [savingStatus,    setSavingStatus]     = useState(false)
  const [statusMsg,       setStatusMsg]        = useState(null)

  const emailTypesForStatut = getEmailTypesForStatut(statut)
  const defaultType = emailTypesForStatut[0]?.key || null

  const [selectedType,    setSelectedType]     = useState(defaultType)
  const [generating,      setGenerating]       = useState(false)
  const [genError,        setGenError]         = useState(null)

  const savedGen = selectedType ? generations[selectedType] : null
  const [subject,         setSubject]          = useState(savedGen?.subject || '')
  const [body,            setBody]             = useState(savedGen?.body || '')

  const [loadingSlots,    setLoadingSlots]     = useState(false)
  const [slots,           setSlots]            = useState([])
  const [selectedSlots,   setSelectedSlots]    = useState([])
  const [slotsError,      setSlotsError]       = useState(null)
  const [slotsLoaded,     setSlotsLoaded]      = useState(false)

  const [copied,          setCopied]           = useState(false)

  const currentTypeConfig = EMAIL_TYPES.find(t => t.key === selectedType)
  const needsSlots = currentTypeConfig?.needsSlots && !body

  // Mettre à jour sujet/corps quand on change de type
  const handleTypeChange = (newType) => {
    setSelectedType(newType)
    setGenError(null)
    const gen = generations[newType]
    setSubject(gen?.subject || '')
    setBody(gen?.body || '')
    setSlots([])
    setSelectedSlots([])
    setSlotsLoaded(false)
  }

  // Charger les créneaux Google Calendar
  const loadSlots = async () => {
    setLoadingSlots(true)
    setSlotsError(null)
    try {
      const r = await fetch('/api/calendar?action=slots', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setSlots(d.slots || [])
      setSlotsLoaded(true)
    } catch (e) {
      setSlotsError(e.message)
    }
    setLoadingSlots(false)
  }

  // Générer l'email
  const handleGenerate = async () => {
    if (!selectedType) return
    setGenerating(true)
    setGenError(null)
    try {
      const body_ = {
        dossierId,
        type: selectedType,
        ...(selectedSlots.length ? { selectedSlots } : {}),
      }
      const r = await fetch('/api/email-generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body_),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setSubject(d.subject)
      setBody(d.body)
    } catch (e) {
      setGenError(e.message)
    }
    setGenerating(false)
  }

  // Copier dans le presse-papier
  const handleCopy = async () => {
    const text = subject ? `Objet : ${subject}\n\n${body}` : body
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Sauvegarder le statut
  const handleSaveStatus = async () => {
    setSavingStatus(true)
    setStatusMsg(null)
    try {
      const r = await fetch('/api/dossier-status-update', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dossierId,
          statut:      statusVal,
          statut_date: statusDate,
        }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setStatusMsg('ok')
      onStatusUpdated()
    } catch (e) {
      setStatusMsg(e.message)
    }
    setSavingStatus(false)
  }

  const hasChanged = statusVal !== statut || (statusDate && statusDate !== (statutDate ? new Date(statutDate).toISOString().split('T')[0] : ''))

  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null

  return (
    <Paper sx={{ mb: 2, background: '#1E293B', border: '1px solid #334155', borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        onClick={() => setExpanded(e => !e)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
          cursor: 'pointer',
          '&:hover': { background: '#273549' },
          transition: 'background .15s',
        }}
      >
        {/* Ref + prospect */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{dossierRef}</Typography>
            <Typography sx={{ fontSize: 13, color: '#94A3B8' }}>{prospect?.raison_sociale || '—'}</Typography>
            {prospect?.contact_nom && (
              <Typography sx={{ fontSize: 12, color: '#64748B' }}>· {prospect.contact_nom}</Typography>
            )}
          </Box>
          <Typography sx={{ fontSize: 11, color: '#64748B', mt: 0.2 }}>{ficheCee}</Typography>
        </Box>

        {/* Badges */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {relanceBucket && (
            <Chip
              label={relanceBucket}
              size="small"
              sx={{ height: 20, fontSize: 10, fontWeight: 700,
                background: relanceBucket === 'J+7' ? '#1d4ed8' : relanceBucket === 'J+14' ? '#6d28d9' : '#991b1b',
                color: '#fff' }}
            />
          )}
          <Chip
            label={STATUT_LABELS[statut] || statut}
            size="small"
            sx={{ height: 22, fontSize: 11, fontWeight: 600,
              background: (STATUT_COLORS[statut] || '#334155') + '33',
              color: STATUT_COLORS[statut] || '#94A3B8',
              border: `1px solid ${(STATUT_COLORS[statut] || '#334155')}55` }}
          />
          {daysSince > 0 && (
            <Typography sx={{ fontSize: 11, color: '#64748B' }}>J+{daysSince}</Typography>
          )}
          {expanded ? <ExpandLessIcon sx={{ color: '#64748B', fontSize: 18 }} /> : <ExpandMoreIcon sx={{ color: '#64748B', fontSize: 18 }} />}
        </Box>
      </Box>

      {/* Contenu expandable */}
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2, pt: 1 }}>
          <Divider sx={{ borderColor: '#334155', mb: 2 }} />

          {/* ── Changement de statut ── */}
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1 }}>
            Statut du dossier
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', flexWrap: 'wrap', mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel sx={{ fontSize: 13 }}>Statut</InputLabel>
              <Select
                value={statusVal}
                label="Statut"
                onChange={e => setStatusVal(e.target.value)}
                sx={{ fontSize: 13 }}
              >
                {ALL_STATUTS.map(s => (
                  <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{STATUT_LABELS[s] || s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Date de référence"
              type="date"
              size="small"
              value={statusDate}
              onChange={e => setStatusDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160, '& input': { fontSize: 13 } }}
            />
            <Button
              variant="contained"
              size="small"
              disabled={savingStatus || !hasChanged}
              onClick={handleSaveStatus}
              startIcon={savingStatus ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
              sx={{ fontSize: 12, height: 36 }}
            >
              Sauvegarder
            </Button>
            {statusMsg === 'ok' && (
              <Chip icon={<CheckIcon />} label="Sauvegardé" size="small" color="success" sx={{ height: 24 }} />
            )}
            {statusMsg && statusMsg !== 'ok' && (
              <Typography sx={{ fontSize: 12, color: '#FC8181' }}>{statusMsg}</Typography>
            )}
          </Box>

          <Divider sx={{ borderColor: '#334155', mb: 2 }} />

          {/* ── Génération email ── */}
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1 }}>
            Email à générer
          </Typography>

          {emailTypesForStatut.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: '#64748B', fontStyle: 'italic' }}>
              Aucun type d'email disponible pour ce statut.
            </Typography>
          ) : (
            <>
              {/* Sélection type */}
              <ToggleButtonGroup
                value={selectedType}
                exclusive
                onChange={(_, v) => { if (v) handleTypeChange(v) }}
                size="small"
                sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}
              >
                {emailTypesForStatut.map(t => (
                  <ToggleButton
                    key={t.key}
                    value={t.key}
                    sx={{
                      fontSize: 12, px: 1.5, py: 0.5, borderRadius: '6px !important',
                      border: '1px solid #334155 !important',
                      color: '#94A3B8',
                      '&.Mui-selected': { background: '#1d3a6e', color: '#60A5FA', borderColor: '#3B82F6 !important' },
                    }}
                  >
                    {t.label}
                    {generations[t.key] && (
                      <CheckIcon sx={{ fontSize: 12, ml: 0.5, color: '#10B981' }} />
                    )}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              {/* Créneaux Calendar (si visio_creneaux) */}
              {currentTypeConfig?.needsSlots && (
                <Box sx={{ mb: 1.5 }}>
                  {!slotsLoaded ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={loadingSlots ? <CircularProgress size={14} /> : <CalendarMonthIcon fontSize="small" />}
                      onClick={loadSlots}
                      disabled={loadingSlots}
                      sx={{ fontSize: 12 }}
                    >
                      {loadingSlots ? 'Chargement…' : 'Charger les créneaux disponibles'}
                    </Button>
                  ) : (
                    <Box>
                      <Typography sx={{ fontSize: 12, color: '#94A3B8', mb: 0.8 }}>
                        Sélectionne les créneaux à proposer :
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                        {slots.map((slot, i) => {
                          const isSelected = selectedSlots.some(s => s.start === slot.start)
                          return (
                            <Chip
                              key={i}
                              label={slot.label}
                              size="small"
                              clickable
                              onClick={() => setSelectedSlots(prev =>
                                isSelected ? prev.filter(s => s.start !== slot.start) : [...prev, slot]
                              )}
                              sx={{
                                fontSize: 11,
                                background: isSelected ? '#1d3a6e' : '#273549',
                                color: isSelected ? '#60A5FA' : '#94A3B8',
                                border: `1px solid ${isSelected ? '#3B82F6' : '#334155'}`,
                              }}
                            />
                          )
                        })}
                      </Box>
                    </Box>
                  )}
                  {slotsError && (
                    <Typography sx={{ fontSize: 12, color: '#FC8181', mt: 0.5 }}>{slotsError}</Typography>
                  )}
                </Box>
              )}

              {/* Bouton générer */}
              <Box sx={{ display: 'flex', gap: 1, mb: body ? 1.5 : 0 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleGenerate}
                  disabled={generating || (currentTypeConfig?.needsSlots && slotsLoaded && selectedSlots.length === 0)}
                  startIcon={generating ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <AutoAwesomeIcon fontSize="small" />}
                  sx={{ fontSize: 12 }}
                >
                  {generating ? 'Génération…' : body ? 'Régénérer' : 'Générer'}
                </Button>
                {savedGen && !body && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => { setSubject(savedGen.subject); setBody(savedGen.body) }}
                    sx={{ fontSize: 12 }}
                  >
                    Voir la dernière génération
                  </Button>
                )}
              </Box>

              {genError && (
                <Alert severity="error" sx={{ mt: 1, fontSize: 12 }}>{genError}</Alert>
              )}

              {/* Résultat */}
              {body && (
                <Box sx={{ mt: 1 }}>
                  {subject && (
                    <Box sx={{ mb: 1 }}>
                      <Typography sx={{ fontSize: 11, color: '#64748B', mb: 0.3 }}>Objet</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        sx={{ '& input': { fontSize: 13, fontWeight: 600 } }}
                      />
                    </Box>
                  )}
                  <Box sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontSize: 11, color: '#64748B', mb: 0.3 }}>Corps de l'email</Typography>
                    <TextField
                      fullWidth
                      multiline
                      minRows={5}
                      maxRows={16}
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      sx={{ '& textarea': { fontSize: 13, lineHeight: 1.6 } }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleCopy}
                      startIcon={copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                      color={copied ? 'success' : 'primary'}
                      sx={{ fontSize: 12 }}
                    >
                      {copied ? 'Copié !' : 'Copier tout'}
                    </Button>
                    {savedGen?.updated_at && (
                      <Typography sx={{ fontSize: 11, color: '#64748B' }}>
                        Généré le {new Date(savedGen.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </>
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
    fetch('/api/style-guide', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => {
        setGuide(d.guide || '')
        setExemples(d.exemples || {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [session])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const r = await fetch('/api/style-guide', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ guide, exemples }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#94A3B8' }}>
          Ce guide et ces exemples sont partagés entre tous les commerciaux.
          Ils sont injectés dans le prompt Claude à chaque génération.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {saved && <Chip icon={<CheckIcon />} label="Sauvegardé" size="small" color="success" />}
          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
          >
            Sauvegarder tout
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Guide rédactionnel */}
      <Paper sx={{ background: '#1E293B', border: '1px solid #334155', p: 2, mb: 3, borderRadius: 2 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', mb: 1.5 }}>
          Guide rédactionnel global
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={6}
          value={guide}
          onChange={e => setGuide(e.target.value)}
          placeholder="Ex : Tutoie les contacts, sois chaleureux, mets en valeur les économies d'énergie, utilise un vocabulaire simple..."
          sx={{ '& textarea': { fontSize: 13, lineHeight: 1.6 } }}
        />
      </Paper>

      {/* Exemples par type */}
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1.5 }}>
        Exemples par type d'email
      </Typography>

      {EMAIL_TYPES.map(t => (
        <Paper key={t.key} sx={{ background: '#1E293B', border: '1px solid #334155', p: 2, mb: 2, borderRadius: 2 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', mb: 1 }}>
            {t.label}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={5}
            value={exemples[t.key] || ''}
            onChange={e => setExemples(prev => ({ ...prev, [t.key]: e.target.value }))}
            placeholder={`Colle ici un exemple d'email "${t.label}" qui servira de référence à Claude…`}
            sx={{ '& textarea': { fontSize: 13, lineHeight: 1.6 } }}
          />
        </Paper>
      ))}
    </Box>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────

export default function MonAssistante() {
  const { session, profile } = useStore()
  const isAdmin = profile?.role === 'admin'

  const [tab,          setTab]          = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [dossiers,     setDossiers]     = useState([])
  const [commercials,  setCommercials]  = useState([])
  const [filter,       setFilter]       = useState('all')

  const [googleStatus, setGoogleStatus] = useState({ connected: false, email: '' })
  const [googleLoading,setGoogleLoading]= useState(true)

  const userId = session?.user?.id

  // Vérifier connexion Google
  useEffect(() => {
    if (!session) return
    fetch('/api/auth-google-status', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { setGoogleStatus(d); setGoogleLoading(false) })
      .catch(() => setGoogleLoading(false))
  }, [session])

  // Charger les dossiers actifs
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
    } catch (e) {
      // ignore en local sans API
    }
    setLoading(false)
  }, [session])

  useEffect(() => { fetchDossiers() }, [fetchDossiers])

  const filteredDossiers = filter === 'all'
    ? dossiers
    : dossiers.filter(d => d.assigneA === filter)

  const connectGmail = () => {
    window.location.href = `/api/auth-google?userId=${userId}`
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#F8FAFC', mb: 0.5 }}>
            Mon assistante
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#64748B' }}>
            Suivi des dossiers actifs · Génération d'emails personnalisés
          </Typography>
        </Box>

        {/* Statut Google Calendar */}
        {!googleLoading && (
          googleStatus.connected ? (
            <Chip
              icon={<LinkIcon fontSize="small" />}
              label={`Google · ${googleStatus.email}`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: 11 }}
            />
          ) : (
            <Tooltip title="Connecter Google pour les créneaux Calendar">
              <Button
                size="small"
                variant="outlined"
                startIcon={<LinkOffIcon fontSize="small" />}
                onClick={connectGmail}
                sx={{ fontSize: 12 }}
              >
                Connecter Google
              </Button>
            </Tooltip>
          )
        )}
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: '1px solid #334155' }}
      >
        <Tab label="Dossiers actifs" sx={{ fontSize: 13, textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Style & Exemples" sx={{ fontSize: 13, textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      {/* Tab 0 — Dossiers actifs */}
      {tab === 0 && (
        <>
          {/* Filtre commercial (admin) */}
          {isAdmin && commercials.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <ToggleButtonGroup
                value={filter}
                exclusive
                onChange={(_, v) => { if (v) setFilter(v) }}
                size="small"
              >
                <ToggleButton value="all" sx={{ fontSize: 12, px: 1.5 }}>Tous</ToggleButton>
                {commercials.map(c => (
                  <ToggleButton key={c.id} value={c.id} sx={{ fontSize: 12, px: 1.5 }}>
                    {c.prenom} {c.nom}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          {/* Liste */}
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress size={28} />
              <Typography sx={{ mt: 2, fontSize: 13, color: '#64748B' }}>Chargement des dossiers…</Typography>
            </Box>
          ) : filteredDossiers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography sx={{ fontSize: 14, color: '#64748B' }}>
                Aucun dossier actif pour le moment.
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#475569', mt: 1 }}>
                Les dossiers apparaissent ici dès qu'ils passent au statut "Contacté" ou au-delà.
              </Typography>
            </Box>
          ) : (
            <>
              <Typography sx={{ fontSize: 12, color: '#64748B', mb: 1.5 }}>
                {filteredDossiers.length} dossier{filteredDossiers.length > 1 ? 's' : ''} actif{filteredDossiers.length > 1 ? 's' : ''}
                {filter !== 'all' && ` · filtré par commercial`}
              </Typography>
              {filteredDossiers.map(d => (
                <DossierCard
                  key={d.dossierId}
                  dossier={d}
                  session={session}
                  onStatusUpdated={fetchDossiers}
                />
              ))}
            </>
          )}
        </>
      )}

      {/* Tab 1 — Style & Exemples */}
      {tab === 1 && <StyleExemplesTab session={session} />}
    </Box>
  )
}
