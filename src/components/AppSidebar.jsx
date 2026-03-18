import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useStore from '../store/useStore'

// MUI
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'

// MUI Icons
import DashboardIcon from '@mui/icons-material/Dashboard'
import FolderIcon from '@mui/icons-material/Folder'
import BuildIcon from '@mui/icons-material/Build'
import SearchIcon from '@mui/icons-material/Search'
import ChecklistIcon from '@mui/icons-material/Checklist'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PeopleIcon from '@mui/icons-material/People'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import LogoutIcon from '@mui/icons-material/Logout'
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt'

const DRAWER_OPEN  = 240
const DRAWER_MINI  = 64

const DARK = {
  bg:        '#1E293B',
  bgHover:   '#273549',
  bgActive:  '#1d3a6e',
  border:    '#334155',
  text:      '#F8FAFC',
  textSoft:  '#94A3B8',
  accent:    '#3B82F6',
  accentBg:  '#1e3a6e',
}

export default function AppSidebar({ open, onToggle, mobileOpen, onMobileClose }) {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { profile, signOut } = useStore()
  const isAdmin    = profile?.role === 'admin'

  const [outilsOpen, setOutilsOpen] = useState(true)
  const [adminOpen,  setAdminOpen]  = useState(true)

  const currentPath   = location.pathname
  const currentModule = location.state?.module || null

  const isActive = (path, module) => {
    if (module) return currentPath === '/hub' && currentModule === module
    return currentPath === path
  }

  const go = (path, module) => {
    if (module) navigate(path, { state: { module }, replace: currentPath === path })
    else navigate(path)
    onMobileClose?.()
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = [profile?.prenom?.[0], profile?.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'

  // ── Item générique ──────────────────────────────────────────────────────────
  const Item = ({ icon, label, path, module, indent = false }) => {
    const active = isActive(path, module)
    const content = (
      <ListItemButton
        onClick={() => go(path, module)}
        sx={{
          borderRadius: '8px',
          mx: 1,
          mb: 0.3,
          pl: indent ? (open ? 3.5 : 1.5) : 1.5,
          minHeight: 42,
          background: active ? DARK.accentBg : 'transparent',
          '&:hover': { background: active ? DARK.accentBg : DARK.bgHover },
          transition: 'background .15s',
        }}
      >
        <ListItemIcon sx={{ minWidth: 36, color: active ? DARK.accent : DARK.textSoft }}>
          {icon}
        </ListItemIcon>
        {open && (
          <ListItemText
            primary={label}
            primaryTypographyProps={{
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              color: active ? '#fff' : DARK.text,
              fontFamily: "system-ui,'Segoe UI',Arial,sans-serif",
              noWrap: true,
            }}
          />
        )}
      </ListItemButton>
    )
    if (!open) return <Tooltip title={label} placement="right" arrow>{content}</Tooltip>
    return content
  }

  // ── Section titre ────────────────────────────────────────────────────────────
  const SectionHeader = ({ icon, label, expanded, onToggle: onSectionToggle }) => {
    const content = (
      <ListItemButton
        onClick={onSectionToggle}
        sx={{
          borderRadius: '8px', mx: 1, mb: 0.3, minHeight: 42,
          '&:hover': { background: DARK.bgHover },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36, color: DARK.textSoft }}>{icon}</ListItemIcon>
        {open && <>
          <ListItemText
            primary={label}
            primaryTypographyProps={{
              fontSize: 11, fontWeight: 700, color: DARK.textSoft,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              fontFamily: "system-ui,'Segoe UI',Arial,sans-serif",
            }}
          />
          {expanded ? <ExpandLessIcon sx={{ color: DARK.textSoft, fontSize: 16 }} /> : <ExpandMoreIcon sx={{ color: DARK.textSoft, fontSize: 16 }} />}
        </>}
      </ListItemButton>
    )
    if (!open) return <Tooltip title={label} placement="right" arrow>{content}</Tooltip>
    return content
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', background: DARK.bg, overflow: 'hidden' }}>

      {/* Logo + toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center', height: 56, px: 1.5, flexShrink: 0, borderBottom: `1px solid ${DARK.border}` }}>
        <ElectricBoltIcon sx={{ color: DARK.accent, fontSize: 24, flexShrink: 0 }} />
        {open && (
          <Typography sx={{ ml: 1.2, fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-.01em', flex: 1, fontFamily: 'inherit' }}>
            RÉGIE PICPUS
          </Typography>
        )}
        <Tooltip title={open ? 'Réduire' : 'Agrandir'} placement="right">
          <IconButton onClick={onToggle} size="small"
            sx={{ color: DARK.textSoft, ml: open ? 0 : 'auto', '&:hover': { color: '#fff', background: DARK.bgHover } }}>
            {open ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pt: 1, pb: 1,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { background: DARK.border, borderRadius: 2 },
      }}>
        <List dense disablePadding>

          {/* Tableau de bord */}
          <Item icon={<DashboardIcon fontSize="small" />} label="Tableau de bord" path="/" />

          {/* Dossiers */}
          <Item icon={<FolderIcon fontSize="small" />} label="Dossiers" path="/" />

          <Divider sx={{ my: 1, borderColor: DARK.border, mx: 2 }} />

          {/* Outils CEE */}
          <SectionHeader
            icon={<BuildIcon fontSize="small" />}
            label="Outils CEE"
            expanded={outilsOpen}
            onToggle={() => setOutilsOpen(o => !o)}
          />
          <Collapse in={open ? outilsOpen : true} timeout="auto" unmountOnExit>
            <Item icon={<SearchIcon fontSize="small" />}      label="Vérificateur CEE"     path="/hub" module="verificateur" indent />
            <Item icon={<ChecklistIcon fontSize="small" />}   label="Checklist CEE"        path="/hub" module="checklist"    indent />
            <Item icon={<ReceiptLongIcon fontSize="small" />} label="Générateur de devis"  path="/hub" module="marges"       indent />
          </Collapse>

          {/* Admin — Suivi équipe */}
          {isAdmin && <>
            <Divider sx={{ my: 1, borderColor: DARK.border, mx: 2 }} />
            <Item icon={<ForwardToInboxIcon fontSize="small" />} label="Suivi équipe" path="/suivi-equipe" />
          </>}

          {/* Admin */}
          {isAdmin && <>
            <Divider sx={{ my: 1, borderColor: DARK.border, mx: 2 }} />
            <SectionHeader
              icon={<AdminPanelSettingsIcon fontSize="small" />}
              label="Administration"
              expanded={adminOpen}
              onToggle={() => setAdminOpen(o => !o)}
            />
            <Collapse in={open ? adminOpen : true} timeout="auto" unmountOnExit>
              <Item icon={<PeopleIcon fontSize="small" />} label="Utilisateurs" path="/admin/users" indent />
            </Collapse>
          </>}

        </List>
      </Box>

      {/* Footer — profil + déconnexion */}
      <Box sx={{ borderTop: `1px solid ${DARK.border}`, p: 1, flexShrink: 0 }}>
        {open ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, px: 1, py: 0.8, borderRadius: 2, '&:hover': { background: DARK.bgHover }, cursor: 'default' }}>
            <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700, background: DARK.accent }}>
              {initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.prenom} {profile?.nom}
              </Typography>
              <Typography sx={{ fontSize: 11, color: DARK.textSoft, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.role === 'admin' ? 'Administrateur' : 'Commercial'}
              </Typography>
            </Box>
            <Tooltip title="Déconnexion" placement="top">
              <IconButton onClick={handleLogout} size="small"
                sx={{ color: DARK.textSoft, '&:hover': { color: '#FC8181', background: 'transparent' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Tooltip title={`${profile?.prenom} ${profile?.nom}`} placement="right">
              <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700, background: DARK.accent, cursor: 'default' }}>
                {initials}
              </Avatar>
            </Tooltip>
            <Tooltip title="Déconnexion" placement="right">
              <IconButton onClick={handleLogout} size="small"
                sx={{ color: DARK.textSoft, '&:hover': { color: '#FC8181' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  )

  return (
    <>
      {/* Desktop — sidebar permanente */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: open ? DRAWER_OPEN : DRAWER_MINI,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: open ? DRAWER_OPEN : DRAWER_MINI,
            boxSizing: 'border-box',
            background: DARK.bg,
            border: 'none',
            borderRight: `1px solid ${DARK.border}`,
            overflowX: 'hidden',
            transition: 'width .2s ease',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      {/* Mobile — overlay drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: DRAWER_OPEN,
            background: DARK.bg,
            border: 'none',
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  )
}
