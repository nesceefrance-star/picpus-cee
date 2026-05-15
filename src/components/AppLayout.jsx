import { useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import MenuIcon from '@mui/icons-material/Menu'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import AppSidebar from './AppSidebar'
import { useAppTheme } from '../lib/theme'
import useStore from '../store/useStore'

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
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const C = useAppTheme()
  const { theme, toggleTheme, profile, signOut } = useStore()
  const location  = useLocation()
  const navigate  = useNavigate()

  const pageTitle = (() => {
    const p = location.pathname
    if (PAGE_TITLES[p]) return PAGE_TITLES[p]
    if (p.startsWith('/dossier/')) return 'Fiche dossier'
    if (p.startsWith('/visites/')) return 'Visite technique'
    return ''
  })()

  const initials = [profile?.prenom?.[0], profile?.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const fullName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || '—'
  const role     = profile?.role === 'admin' ? 'Administrateur' : 'Commercial'

  const handleLogout = async () => {
    setDropdownOpen(false)
    await signOut()
    navigate('/login')
  }

  // Fermer le dropdown si clic hors
  const handleDropdownToggle = () => setDropdownOpen(o => !o)
  const handleBlurDropdown   = (e) => {
    if (!dropdownRef.current?.contains(e.relatedTarget)) setDropdownOpen(false)
  }

  const TOP_H = 52 // hauteur de la top bar en px

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', flexDirection: 'column', fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>

      {/* ── TOP BAR UNIQUE ────────────────────────────────────────────────── */}
      <Box sx={{
        height: TOP_H,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        px: 1,
        gap: 1,
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        zIndex: 1201,
      }}>
        {/* Bouton sidebar — desktop = toggle open/close, mobile = ouvre overlay */}
        <Tooltip title={sidebarOpen ? 'Réduire' : 'Agrandir'} placement="bottom">
          <IconButton
            onClick={() => { window.innerWidth < 900 ? setMobileOpen(true) : setSidebarOpen(o => !o) }}
            size="small"
            sx={{ color: C.textSoft, '&:hover': { background: C.bg, color: C.text } }}
          >
            {window.innerWidth < 900
              ? <MenuIcon fontSize="small" />
              : sidebarOpen
                ? <ChevronLeftIcon fontSize="small" />
                : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Titre de la page */}
        <span style={{ fontSize: 15, fontWeight: 700, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pageTitle}
        </span>

        {/* Toggle thème — discret */}
        <Tooltip title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'} placement="bottom">
          <IconButton
            onClick={toggleTheme}
            size="small"
            sx={{ color: C.textSoft, '&:hover': { background: C.bg, color: C.text } }}
          >
            {theme === 'dark'
              ? <LightModeIcon sx={{ fontSize: 18 }} />
              : <DarkModeIcon  sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>

        {/* Profil avec dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }} onBlur={handleBlurDropdown} tabIndex={-1}>
          <button
            onClick={handleDropdownToggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: `1px solid ${dropdownOpen ? C.border : 'transparent'}`,
              borderRadius: 8, padding: '4px 8px 4px 4px',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.borderColor = C.border }}
            onMouseLeave={e => { if (!dropdownOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
          >
            <Avatar sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700, background: '#2563EB', flexShrink: 0 }}>
              {initials}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>{fullName}</div>
              <div style={{ fontSize: 10, color: C.textSoft }}>{role}</div>
            </Box>
            <span style={{ fontSize: 10, color: C.textSoft, marginLeft: 2 }}>▾</span>
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.14)',
              minWidth: 180, zIndex: 9999, overflow: 'hidden',
              fontFamily: "system-ui,'Segoe UI',Arial,sans-serif",
            }}>
              {/* Infos profil */}
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fullName}</div>
                <div style={{ fontSize: 11, color: C.textSoft, marginTop: 1 }}>{role}</div>
              </div>
              {/* Paramètres */}
              <button
                onClick={() => { setDropdownOpen(false); navigate('/parametres') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px', background: 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  color: C.text, fontSize: 13, textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.bg }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <SettingsIcon sx={{ fontSize: 16, color: C.textSoft }} />
                Paramètres
              </button>
              {/* Séparateur */}
              <div style={{ height: 1, background: C.border, margin: '0 8px' }} />
              {/* Déconnexion */}
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px', background: 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  color: '#DC2626', fontSize: 13, textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <LogoutIcon sx={{ fontSize: 16, color: '#DC2626' }} />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </Box>

      {/* ── LAYOUT PRINCIPAL ─────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar */}
        <AppSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Contenu */}
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', background: C.bg, minWidth: 0 }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
