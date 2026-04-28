// src/pages/Parametres.jsx
// Page paramètres — gestion des intégrations tierces (Google, Teams, Drive…)

import { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import PrestatairesSettings from '../components/PrestatairesSettings'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'

const DARK = {
  bg:       '#0F172A',
  surface:  '#1E293B',
  border:   '#334155',
  text:     '#F8FAFC',
  textMid:  '#94A3B8',
  textSoft: '#64748B',
  accent:   '#3B82F6',
}

function IntegrationCard({ icon, name, description, status, onConnect, onDisconnect, comingSoon, children }) {
  return (
    <Paper sx={{ background: DARK.surface, border: `1px solid ${DARK.border}`, borderRadius: 2, p: 2.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ fontSize: 28, flexShrink: 0, mt: 0.2 }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: DARK.text }}>{name}</Typography>
            {comingSoon && (
              <Chip label="Bientôt" size="small" sx={{ height: 18, fontSize: 10, background: '#1e3a6e', color: '#60A5FA' }} />
            )}
            {!comingSoon && status?.connected && (
              <Chip label="Connecté" size="small" color="success" sx={{ height: 20, fontSize: 11 }} />
            )}
            {!comingSoon && status?.loaded && !status?.connected && (
              <Chip label="Non connecté" size="small" sx={{ height: 20, fontSize: 11, background: '#334155', color: DARK.textMid }} />
            )}
          </Box>
          <Typography sx={{ fontSize: 12, color: DARK.textSoft, mb: status?.email ? 0.5 : 0 }}>
            {description}
          </Typography>
          {status?.email && (
            <Typography sx={{ fontSize: 12, color: DARK.textMid }}>
              Connecté en tant que <strong>{status.email}</strong>
            </Typography>
          )}
          {children}
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          {!comingSoon && status?.loaded && (
            status?.connected ? (
              <Button size="small" variant="outlined" color="error" onClick={onDisconnect}
                sx={{ fontSize: 11, textTransform: 'none' }}>
                Déconnecter
              </Button>
            ) : (
              <Button size="small" variant="contained" onClick={onConnect}
                sx={{ fontSize: 11, textTransform: 'none', background: DARK.accent }}>
                Connecter
              </Button>
            )
          )}
          {comingSoon && (
            <Button size="small" variant="outlined" disabled sx={{ fontSize: 11, textTransform: 'none' }}>
              À venir
            </Button>
          )}
        </Box>
      </Box>
    </Paper>
  )
}

export default function Parametres() {
  const { session, user, profile } = useStore()
  const [activeTab, setActiveTab] = useState('integrations')

  const [googleStatus,   setGoogleStatus]   = useState({ connected: false, email: null, loaded: false })
  const [disconnecting,  setDisconnecting]  = useState(false)
  const [calendars,      setCalendars]      = useState([])
  const [calsLoading,    setCalsLoading]    = useState(false)
  const [calsSaved,      setCalsSaved]      = useState(false)

  useEffect(() => {
    if (!session) return
    fetch('/api/auth-google-status', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => {
        setGoogleStatus({ connected: d.connected, email: d.email, loaded: true })
        if (d.connected) loadCalendars()
      })
      .catch(() => setGoogleStatus(s => ({ ...s, loaded: true })))
  }, [session])

  const loadCalendars = async () => {
    setCalsLoading(true)
    try {
      const r = await fetch('/api/calendar?action=list', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const d = await r.json()
      setCalendars(d.calendars || [])
    } catch {}
    setCalsLoading(false)
  }

  const toggleCalendar = (id) => {
    setCalendars(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c))
    setCalsSaved(false)
  }

  const saveCalendars = async () => {
    const selected = calendars.filter(c => c.selected).map(c => c.id)
    await fetch('/api/calendar?action=list', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarIds: selected }),
    })
    setCalsSaved(true)
    setTimeout(() => setCalsSaved(false), 3000)
  }

  const connectGoogle = () => {
    window.location.href = `/api/auth-google?userId=${user?.id}`
  }

  const disconnectGoogle = async () => {
    setDisconnecting(true)
    // Supprime le token en BDD via supabase client-side
    const { supabase } = await import('../lib/supabase')
    await supabase.from('google_tokens').delete().eq('user_id', user?.id)
    setGoogleStatus({ connected: false, email: null, loaded: true })
    setDisconnecting(false)
  }

  return (
    <Box sx={{ minHeight: '100vh', background: DARK.bg, p: { xs: 2, md: 3 } }}>
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: DARK.text, mb: 0.5 }}>
          Paramètres
        </Typography>
      </Box>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${DARK.border}`, marginBottom: 24 }}>
        {[['integrations', '⚡ Intégrations'], ['prestataires', '🏗 Prestataires']].map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: '9px 20px', fontSize: 13, fontWeight: activeTab === t ? 700 : 500,
            cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${activeTab === t ? DARK.accent : 'transparent'}`,
            marginBottom: -2, color: activeTab === t ? DARK.accent : DARK.textMid, transition: 'all .15s',
          }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Onglet Prestataires ── */}
      {activeTab === 'prestataires' && <PrestatairesSettings />}

      {/* ── Onglet Intégrations ── */}
      {activeTab === 'integrations' && <>

      {/* Section Intégrations */}
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: DARK.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', mb: 1.5 }}>
        Intégrations
      </Typography>

      {/* Google */}
      <IntegrationCard
        icon="🔵"
        name="Google (Gmail · Calendar · Meet)"
        description="Génération d'emails, créneaux disponibles dans le calendrier, création de réunions Google Meet."
        status={googleStatus}
        onConnect={connectGoogle}
        onDisconnect={disconnectGoogle}
      >
        {!googleStatus.loaded && (
          <Box sx={{ mt: 0.5 }}><CircularProgress size={14} /></Box>
        )}
        {googleStatus.connected && (
          <Box sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: DARK.textMid }}>
                Agendas pris en compte pour les disponibilités
              </Typography>
              {calendars.length > 0 && (
                <Button size="small" variant={calsSaved ? 'contained' : 'outlined'} color={calsSaved ? 'success' : 'primary'}
                  onClick={saveCalendars} sx={{ fontSize: 11, textTransform: 'none', minWidth: 90 }}>
                  {calsSaved ? '✓ Sauvegardé' : 'Sauvegarder'}
                </Button>
              )}
            </Box>
            {calsLoading && <Typography sx={{ fontSize: 12, color: DARK.textSoft }}>Chargement…</Typography>}
            {calendars.map(cal => (
              <Box key={cal.id} onClick={() => toggleCalendar(cal.id)}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 1.5, cursor: 'pointer',
                  '&:hover': { background: '#273549' }, mb: 0.5, transition: 'background .1s' }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: cal.backgroundColor, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, color: cal.selected ? DARK.text : DARK.textSoft, flex: 1 }}>
                  {cal.summary}{cal.primary ? ' (principal)' : ''}
                </Typography>
                <Box sx={{ width: 16, height: 16, borderRadius: 0.5, border: `2px solid ${cal.selected ? '#3B82F6' : '#475569'}`,
                  background: cal.selected ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {cal.selected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </IntegrationCard>

      {/* Microsoft Teams */}
      <IntegrationCard
        icon="🟣"
        name="Microsoft Teams"
        description="Ouverture du formulaire de création de réunion Teams pré-rempli. Le lien de jointure est ensuite collé manuellement dans le dossier."
        status={{ loaded: true }}
        comingSoon={false}
        onConnect={() => {}}
      >
        <Box sx={{ mt: 1.5, background: '#1E293B', border: '1px solid #334155', borderRadius: 1.5, p: 1.5 }}>
          <Typography sx={{ fontSize: 12, color: DARK.textMid, lineHeight: 1.7 }}>
            Teams fonctionne en mode <strong style={{ color: DARK.text }}>formulaire pré-rempli</strong> — le CRM ouvre Teams avec la date, l'heure et les participants déjà renseignés. Tu confirmes dans Teams, puis tu colles le lien de jointure dans le dossier.
          </Typography>
          <Typography sx={{ fontSize: 11, color: DARK.textSoft, mt: 1 }}>
            La création automatique du lien (sans quitter le CRM) nécessite un compte Microsoft 365 professionnel.
          </Typography>
        </Box>
      </IntegrationCard>

      {/* Google Drive */}
      <IntegrationCard
        icon="🟡"
        name="Google Drive"
        description="Stockage et accès aux documents liés aux dossiers directement depuis le CRM."
        status={{ loaded: true }}
        comingSoon
      />

      <Divider sx={{ borderColor: DARK.border, my: 3 }} />

      {/* Section Compte */}
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: DARK.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', mb: 1.5 }}>
        Compte
      </Typography>
      <Paper sx={{ background: DARK.surface, border: `1px solid ${DARK.border}`, borderRadius: 2, p: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', background: DARK.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {[profile?.prenom?.[0], profile?.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'}
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: DARK.text }}>
              {profile?.prenom} {profile?.nom}
            </Typography>
            <Typography sx={{ fontSize: 12, color: DARK.textMid }}>{user?.email}</Typography>
            <Chip
              label={profile?.role === 'admin' ? 'Administrateur' : 'Commercial'}
              size="small"
              sx={{ mt: 0.5, height: 18, fontSize: 10, background: profile?.role === 'admin' ? '#1e3a6e' : '#1e293b', color: profile?.role === 'admin' ? '#60A5FA' : DARK.textMid }}
            />
          </Box>
        </Box>
      </Paper>
      </> /* fin onglet intégrations */}

    </Box>
    </Box>
  )
}
