import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import MenuIcon from '@mui/icons-material/Menu'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import AppSidebar from './AppSidebar'
import { useAppTheme } from '../lib/theme'
import useStore from '../store/useStore'
import { useLocation } from 'react-router-dom'

// Titres par route pour le header desktop
const PAGE_TITLES = {
  '/':             'Tableau de bord',
  '/dossiers':     'Dossiers',
  '/planning':     'Planning',
  '/statistiques': 'Statistiques',
  '/carte':        'Carte',
  '/leads':        'Qualification leads',
  '/simulateur':   'Simulateur rapide',
  '/emails':       'Générateur d\'emails',
  '/hub':          'Outils CEE',
  '/visites':      'Visites techniques',
  '/relances':     'Agent relances',
  '/assistante':   'Mon assistante',
  '/parametres':   'Paramètres',
  '/admin/users':  'Utilisateurs',
}

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const C            = useAppTheme()
  const { theme, toggleTheme } = useStore()
  const location     = useLocation()

  const pageTitle = (() => {
    const path = location.pathname
    if (PAGE_TITLES[path]) return PAGE_TITLES[path]
    if (path.startsWith('/dossier/'))  return 'Fiche dossier'
    if (path.startsWith('/visites/'))  return 'Visite technique'
    return ''
  })()

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>

      {/* Sidebar */}
      <AppSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Contenu principal */}
      <Box component="main" sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* ── Barre mobile ── */}
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          alignItems: 'center', height: 48, px: 1,
          background: '#1E293B', borderBottom: '1px solid #334155', flexShrink: 0,
        }}>
          <IconButton onClick={() => setMobileOpen(true)} size="small" sx={{ color: '#94A3B8', mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, flex: 1 }}>SOFT.IA</span>
          {/* Toggle thème — mobile */}
          <Tooltip title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
            <IconButton
              onClick={toggleTheme}
              size="small"
              sx={{ color: '#64748B', '&:hover': { color: '#94A3B8', background: 'rgba(255,255,255,.06)' } }}
            >
              {theme === 'dark'
                ? <LightModeIcon sx={{ fontSize: 18 }} />
                : <DarkModeIcon  sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* ── Barre desktop — titre + toggle thème ── */}
        <Box sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center', height: 44, px: 2.5,
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.textSoft, flex: 1 }}>
            {pageTitle}
          </span>
          {/* Toggle thème — discret */}
          <Tooltip title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
            <IconButton
              onClick={toggleTheme}
              size="small"
              sx={{
                color: C.textSoft,
                borderRadius: '8px',
                padding: '5px',
                '&:hover': { background: C.bg, color: C.textMid },
                transition: 'all .15s',
              }}
            >
              {theme === 'dark'
                ? <LightModeIcon sx={{ fontSize: 17 }} />
                : <DarkModeIcon  sx={{ fontSize: 17 }} />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Page rendue */}
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', background: C.bg }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
