import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import Snackbar from '@mui/material/Snackbar'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'

import EmailIcon from '@mui/icons-material/Email'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import LinkIcon from '@mui/icons-material/Link'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PersonIcon from '@mui/icons-material/Person'
import FilterListIcon from '@mui/icons-material/FilterList'

const DARK = {
  bg:       '#0F172A',
  paper:    '#1E293B',
  border:   '#334155',
  text:     '#F8FAFC',
  soft:     '#94A3B8',
  accent:   '#3B82F6',
}

const BUCKETS = {
  'J+7':   { label: 'J+7',   color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)'  },
  'J+14':  { label: 'J+14',  color: '#F97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.3)'  },
  'J+20+': { label: 'J+20+', color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)'   },
}

const TON_OPTIONS     = [{ v: 'chaleureux', l: 'Chaleureux' }, { v: 'neutre', l: 'Neutre' }, { v: 'ferme', l: 'Ferme' }]
const ARGUMENT_OPTIONS = [
  { v: 'roi',         l: 'ROI + prime CEE' },
  { v: 'urgence',     l: 'Urgence délais' },
  { v: 'reassurance', l: 'Réassurance process' },
]
const LONGUEUR_OPTIONS = [{ v: 'court', l: 'Court (3-4 lignes)' }, { v: 'moyen', l: 'Moyen (6-8 lignes)' }, { v: 'long', l: 'Long (10-12 lignes)' }]

function fmt(n) {
  if (!n) return '—'
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' €'
}

function daysAgo(isoDate) {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000)
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Carte d'une relance ──────────────────────────────────────────────────────
function RelanceCard({ relance, apiHeaders, onDraftCreated }) {
  const [open,       setOpen]       = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result,     setResult]     = useState(null)
  const [params,     setParams]     = useState({ ton: 'chaleureux', argument: 'roi', longueur: 'moyen', attachPdf: false })
  const [err,        setErr]        = useState(null)

  const bucket      = BUCKETS[relance.bucket]
  const hasDraft    = result || relance.lastRelance // brouillon existant (session ou DB)
  const borderColor = hasDraft ? 'rgba(34,197,94,0.3)' : bucket.border
  const bgColor     = hasDraft ? 'rgba(34,197,94,0.04)' : bucket.bg

  const handleGenerate = async () => {
    setGenerating(true)
    setErr(null)
    try {
      const res = await fetch('/api/email-draft-create', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ dossierId: relance.dossierId, ...params }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error + (data.detail ? ' — ' + JSON.stringify(data.detail) : ''))
      setResult(data)
      setOpen(false)
      onDraftCreated?.()
    } catch (e) {
      setErr(e.message)
    }
    setGenerating(false)
  }

  return (
    <Box sx={{
      border: `1px solid ${borderColor}`,
      borderRadius: 2,
      background: bgColor,
      mb: 1.5,
      overflow: 'hidden',
      transition: 'border-color .2s, background .2s',
    }}>
      {/* Header de la carte */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5 }}>
        {/* Badge bucket */}
        <Chip
          label={relance.bucket}
          size="small"
          sx={{ background: bucket.bg, color: bucket.color, border: `1px solid ${bucket.border}`, fontWeight: 700, fontSize: 11, minWidth: 48 }}
        />

        {/* Infos prospect */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: DARK.text, lineHeight: 1.3 }}>
            {relance.prospect?.raison_sociale}
          </Typography>
          <Typography sx={{ fontSize: 12, color: DARK.soft }}>
            {relance.prospect?.contact_nom && `${relance.prospect.contact_nom} · `}
            {relance.ficheCee} · {relance.dossierRef}
          </Typography>
        </Box>

        {/* Montants */}
        <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: DARK.text }}>{fmt(relance.montantDevis)}</Typography>
          <Typography sx={{ fontSize: 11, color: '#22C55E' }}>Prime : {fmt(relance.primeCee)}</Typography>
        </Box>

        {/* Jours + relances */}
        <Box sx={{ textAlign: 'center', minWidth: 56 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: bucket.color, lineHeight: 1 }}>{relance.daysSince}</Typography>
          <Typography sx={{ fontSize: 10, color: DARK.soft }}>jours</Typography>
          {relance.relancesDone > 0 && (
            <Typography sx={{ fontSize: 10, color: DARK.soft }}>{relance.relancesDone} relance{relance.relancesDone > 1 ? 's' : ''}</Typography>
          )}
        </Box>

        {/* Commercial (admin only) */}
        {relance.commercial && (
          <Tooltip title={`${relance.commercial.prenom} ${relance.commercial.nom}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: DARK.soft, fontSize: 12 }}>
              <PersonIcon fontSize="small" />
              {relance.commercial.prenom?.[0]}{relance.commercial.nom?.[0]}
            </Box>
          </Tooltip>
        )}

        {/* Bouton Générer (toujours visible) */}
        <Button
          size="small"
          variant="outlined"
          startIcon={open ? <ExpandLessIcon fontSize="small" /> : <EmailIcon fontSize="small" />}
          onClick={() => setOpen(o => !o)}
          sx={{ color: DARK.accent, borderColor: 'rgba(59,130,246,0.4)', fontSize: 12, whiteSpace: 'nowrap',
            '&:hover': { borderColor: DARK.accent, background: 'rgba(59,130,246,0.08)' } }}
        >
          {open ? 'Fermer' : 'Générer'}
        </Button>
      </Box>

      {/* Notification brouillon — persistante (DB) ou session */}
      {hasDraft && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Divider sx={{ borderColor: DARK.border, mb: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ color: '#22C55E', fontSize: 15 }} />
              <Typography sx={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>
                {result
                  ? `Brouillon #${result.relanceNum} créé — ${fmtDate(new Date().toISOString())}`
                  : `Dernier brouillon : ${fmtDate(relance.lastRelance.date)}`
                }
              </Typography>
            </Box>
            {result && (
              <Button
                size="small"
                href={result.gmailUrl}
                target="_blank"
                startIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                sx={{ fontSize: 11, color: '#22C55E', p: 0, minWidth: 0, textTransform: 'none',
                  '&:hover': { background: 'transparent', textDecoration: 'underline' } }}
              >
                Ouvrir dans Gmail
              </Button>
            )}
          </Box>
          {result && (
            <Typography sx={{ fontSize: 11, color: DARK.soft, mt: 0.3 }}>
              Objet : <b style={{ color: DARK.text }}>{result.objet}</b>
            </Typography>
          )}
          {!result && relance.lastRelance?.contenu && (
            <Typography sx={{ fontSize: 11, color: DARK.soft, mt: 0.3 }}>
              {relance.lastRelance.contenu}
            </Typography>
          )}
        </Box>
      )}

      {/* Formulaire de génération */}
      <Collapse in={open}>
        <Divider sx={{ borderColor: DARK.border }} />
        <Box sx={{ px: 2, py: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-end' }}>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel sx={{ fontSize: 12, color: DARK.soft }}>Ton</InputLabel>
            <Select value={params.ton} label="Ton" onChange={e => setParams(p => ({ ...p, ton: e.target.value }))}
              sx={{ fontSize: 12, color: DARK.text, '& .MuiOutlinedInput-notchedOutline': { borderColor: DARK.border } }}>
              {TON_OPTIONS.map(o => <MenuItem key={o.v} value={o.v} sx={{ fontSize: 12 }}>{o.l}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel sx={{ fontSize: 12, color: DARK.soft }}>Argument</InputLabel>
            <Select value={params.argument} label="Argument" onChange={e => setParams(p => ({ ...p, argument: e.target.value }))}
              sx={{ fontSize: 12, color: DARK.text, '& .MuiOutlinedInput-notchedOutline': { borderColor: DARK.border } }}>
              {ARGUMENT_OPTIONS.map(o => <MenuItem key={o.v} value={o.v} sx={{ fontSize: 12 }}>{o.l}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel sx={{ fontSize: 12, color: DARK.soft }}>Longueur</InputLabel>
            <Select value={params.longueur} label="Longueur" onChange={e => setParams(p => ({ ...p, longueur: e.target.value }))}
              sx={{ fontSize: 12, color: DARK.text, '& .MuiOutlinedInput-notchedOutline': { borderColor: DARK.border } }}>
              {LONGUEUR_OPTIONS.map(o => <MenuItem key={o.v} value={o.v} sx={{ fontSize: 12 }}>{o.l}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={params.attachPdf}
                onChange={e => setParams(p => ({ ...p, attachPdf: e.target.checked }))}
                size="small"
                sx={{ color: DARK.soft, '&.Mui-checked': { color: DARK.accent } }}
              />
            }
            label={<Typography sx={{ fontSize: 12, color: DARK.soft }}>Joindre présentation PDF</Typography>}
            sx={{ m: 0 }}
          />

          <Button
            variant="contained"
            size="small"
            onClick={handleGenerate}
            disabled={generating}
            startIcon={generating ? <CircularProgress size={14} color="inherit" /> : <EmailIcon fontSize="small" />}
            sx={{ background: DARK.accent, fontSize: 12, '&:hover': { background: '#2563EB' }, ml: 'auto' }}
          >
            {generating ? 'Génération…' : 'Créer le brouillon'}
          </Button>

          {err && <Typography sx={{ fontSize: 11, color: '#EF4444', width: '100%' }}>⚠ {err}</Typography>}
        </Box>
      </Collapse>
    </Box>
  )
}

// ─── Section par bucket ───────────────────────────────────────────────────────
function BucketSection({ bucketKey, relances, apiHeaders, onDraftCreated }) {
  const cfg = BUCKETS[bucketKey]
  if (!relances.length) return null

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box sx={{ width: 3, height: 20, borderRadius: 2, background: cfg.color }} />
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {cfg.label}
        </Typography>
        <Chip label={relances.length} size="small"
          sx={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontSize: 11, height: 20 }} />
      </Box>
      {relances.map(r => (
        <RelanceCard key={r.devisId} relance={r} apiHeaders={apiHeaders} onDraftCreated={onDraftCreated} />
      ))}
    </Box>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function AgentRelance() {
  const { session, profile } = useStore()
  const location = useLocation()
  const isAdmin  = profile?.role === 'admin'

  const [googleStatus,       setGoogleStatus]       = useState(null) // null = loading
  const [relances,           setRelances]           = useState(null)
  const [commercials,        setCommercials]        = useState([])
  const [loadingRelances,    setLoadingRelances]    = useState(true)
  const [filterCommercial,   setFilterCommercial]   = useState('all')
  const [snackbar,           setSnackbar]           = useState(null) // message

  const apiHeaders = {
    Authorization:  `Bearer ${session?.access_token}`,
    'Content-Type': 'application/json',
  }

  const checkGoogle = useCallback(async () => {
    try {
      const r = await fetch('/api/auth-google-status', { headers: apiHeaders })
      if (!r.ok) throw new Error()
      const d = await r.json()
      setGoogleStatus(d)
      if (location.search.includes('google=connected') && d.connected) {
        setSnackbar(`Gmail connecté : ${d.email}`)
      }
    } catch {
      setGoogleStatus({ connected: false, email: null })
    }
  }, [session?.access_token])

  const fetchRelances = useCallback(async () => {
    setLoadingRelances(true)
    try {
      const r = await fetch('/api/relances-list', { headers: apiHeaders })
      if (!r.ok) throw new Error()
      const d = await r.json()
      setRelances(d.relances || [])
      setCommercials(d.commercials || [])
    } catch {
      setRelances([])
    }
    setLoadingRelances(false)
  }, [session?.access_token])

  useEffect(() => {
    if (!session?.access_token) return
    checkGoogle()
    fetchRelances()
  }, [session?.access_token])

  // Filtrage par commercial (admin)
  const filtered = (relances || []).filter(r =>
    filterCommercial === 'all' || r.assigneA === filterCommercial
  )

  const byBucket = {
    'J+7':   filtered.filter(r => r.bucket === 'J+7'),
    'J+14':  filtered.filter(r => r.bucket === 'J+14'),
    'J+20+': filtered.filter(r => r.bucket === 'J+20+'),
  }

  const totalRelances = filtered.length

  const handleDraftCreated = () => {
    setSnackbar('Brouillon créé — retrouvez-le dans Gmail Brouillons')
  }

  const connectGmail = () => {
    if (!session?.user?.id) return
    window.location.href = `/api/auth-google?userId=${session.user.id}`
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: DARK.text }}>Agent Relances</Typography>
          <Typography sx={{ fontSize: 13, color: DARK.soft, mt: 0.3 }}>
            Brouillons Gmail générés par IA — vous gardez le contrôle de l'envoi
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Statut Gmail */}
          {googleStatus === null ? (
            <CircularProgress size={16} sx={{ color: DARK.soft }} />
          ) : googleStatus.connected ? (
            <Chip
              icon={<EmailIcon sx={{ fontSize: 14 }} />}
              label={googleStatus.email}
              size="small"
              sx={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', fontSize: 11 }}
            />
          ) : (
            <Button
              variant="outlined"
              size="small"
              startIcon={<LinkIcon fontSize="small" />}
              onClick={connectGmail}
              sx={{ color: DARK.accent, borderColor: 'rgba(59,130,246,0.4)', fontSize: 12 }}
            >
              Connecter Gmail
            </Button>
          )}

          <Tooltip title="Actualiser">
            <IconButton size="small" onClick={fetchRelances}
              sx={{ color: DARK.soft, '&:hover': { color: DARK.text } }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Alerte si Gmail non connecté */}
      {googleStatus && !googleStatus.connected && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: 13, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
          Connectez votre Gmail pour pouvoir créer des brouillons. Vous pouvez tout de même consulter les relances en attente.
        </Alert>
      )}

      {/* Filtre commercial (admin) */}
      {isAdmin && commercials.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <FilterListIcon sx={{ color: DARK.soft, fontSize: 18 }} />
          <Typography sx={{ fontSize: 12, color: DARK.soft }}>Vue :</Typography>
          <Select
            value={filterCommercial}
            onChange={e => setFilterCommercial(e.target.value)}
            size="small"
            sx={{ fontSize: 12, color: DARK.text, minWidth: 180,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: DARK.border } }}
          >
            <MenuItem value="all" sx={{ fontSize: 12 }}>Tous les commerciaux ({relances?.length || 0})</MenuItem>
            {commercials.map(c => {
              const count = (relances || []).filter(r => r.assigneA === c.id).length
              return (
                <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12 }}>
                  {c.prenom} {c.nom} ({count})
                </MenuItem>
              )
            })}
          </Select>
        </Box>
      )}

      {/* Stats rapides */}
      {!loadingRelances && totalRelances > 0 && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {Object.entries(byBucket).map(([key, items]) => {
            if (!items.length) return null
            const cfg = BUCKETS[key]
            return (
              <Box key={key} sx={{
                flex: '0 0 auto', px: 2, py: 1, borderRadius: 2,
                background: cfg.bg, border: `1px solid ${cfg.border}`,
                display: 'flex', alignItems: 'center', gap: 1,
              }}>
                <Typography sx={{ fontSize: 20, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{items.length}</Typography>
                <Typography sx={{ fontSize: 12, color: cfg.color }}>{key}</Typography>
              </Box>
            )
          })}
          <Box sx={{ flex: '0 0 auto', px: 2, py: 1, borderRadius: 2, background: 'rgba(148,163,184,0.08)', border: `1px solid ${DARK.border}`, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: DARK.text, lineHeight: 1 }}>{totalRelances}</Typography>
            <Typography sx={{ fontSize: 12, color: DARK.soft }}>total</Typography>
          </Box>
        </Box>
      )}

      {/* Contenu principal */}
      {loadingRelances ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: DARK.accent }} />
        </Box>
      ) : totalRelances === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: DARK.soft }}>
          <EmailIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
          <Typography sx={{ fontSize: 14 }}>Aucune relance en attente</Typography>
          <Typography sx={{ fontSize: 12, mt: 0.5 }}>Les devis envoyés depuis 7+ jours sans réponse apparaîtront ici</Typography>
        </Box>
      ) : (
        <>
          {Object.entries(byBucket).map(([key, items]) => (
            <BucketSection
              key={key}
              bucketKey={key}
              relances={items}
              apiHeaders={apiHeaders}
              onDraftCreated={handleDraftCreated}
            />
          ))}
        </>
      )}

      {/* Snackbar */}
      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </Box>
  )
}
