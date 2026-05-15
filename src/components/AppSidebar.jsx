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
import Typography from '@mui/material/Typography'

// MUI Icons
import DashboardIcon from '@mui/icons-material/Dashboard'
import FolderIcon from '@mui/icons-material/Folder'
import BuildIcon from '@mui/icons-material/Build'
import SearchIcon from '@mui/icons-material/Search'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PeopleIcon from '@mui/icons-material/People'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt'
import EngineeringIcon from '@mui/icons-material/Engineering'
import SettingsIcon from '@mui/icons-material/Settings'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import BoltIcon from '@mui/icons-material/Bolt'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'
import BarChartIcon from '@mui/icons-material/BarChart'
import MapIcon from '@mui/icons-material/Map'

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

const STATUTS_STAGNANT = ['visio_planifiee','visio_effectuee','visite_planifiee','visite_effectuee','devis','ah']

export default function AppSidebar({ open, onToggle, mobileOpen, onMobileClose }) {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { profile, dossiers, user } = useStore()
  const isAdmin    = profile?.role === 'admin'

  // Badge alertes : dossiers stagnants (+14j sans activité, statuts actifs)
  const myDossiers = isAdmin ? dossiers : dossiers.filter(d => d.assigne_a === user?.id)
  const stagnantCount = myDossiers.filter(d =>
    STATUTS_STAGNANT.includes(d.statut) &&
    Math.floor((Date.now() - new Date(d.updated_at)) / 86400000) > 14
  ).length

  const [outilsOpen,       setOutilsOpen]       = useState(true)
  const [prospectionOpen,  setProspectionOpen]  = useState(true)
  const [adminOpen,        setAdminOpen]        = useState(true)

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

  // ── Item générique ──────────────────────────────────────────────────────────
  const Item = ({ icon, label, path, module, indent = false, badge = 0 }) => {
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
          <>
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
            {badge > 0 && (
              <Box sx={{ background: '#DC2626', color: '#fff', borderRadius: 10, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, px: 0.6, ml: 0.5, flexShrink: 0 }}>
                {badge > 99 ? '99+' : badge}
              </Box>
            )}
          </>
        )}
      </ListItemButton>
    )
    if (!open) return <Tooltip title={badge > 0 ? `${label} (${badge} alertes)` : label} placement="right" arrow>{content}</Tooltip>
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

      {/* Logo — sans toggle (géré par la top bar) */}
      <Box sx={{ display: 'flex', alignItems: 'center', height: 52, px: 1.5, flexShrink: 0, borderBottom: `1px solid ${DARK.border}` }}>
        <ElectricBoltIcon sx={{ color: DARK.accent, fontSize: 22, flexShrink: 0 }} />
        {open && (
          <Typography sx={{ ml: 1.2, fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-.01em', fontFamily: 'inherit' }}>
            SOFT.IA
          </Typography>
        )}
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
          <Item icon={<FolderIcon fontSize="small" />} label="Dossiers" path="/dossiers" badge={stagnantCount} />

          {/* Planning */}
          <Item icon={<CalendarMonthIcon fontSize="small" />} label="Planning" path="/planning" />

          {/* Statistiques */}
          <Item icon={<BarChartIcon fontSize="small" />} label="Statistiques" path="/statistiques" />

          {/* Carte */}
          <Item icon={<MapIcon fontSize="small" />} label="Carte" path="/carte" />

          <Divider sx={{ my: 1, borderColor: DARK.border, mx: 2 }} />

          {/* Prospection */}
          <SectionHeader
            icon={<TravelExploreIcon fontSize="small" />}
            label="Prospection"
            expanded={prospectionOpen}
            onToggle={() => setProspectionOpen(o => !o)}
          />
          <Collapse in={open ? prospectionOpen : true} timeout="auto" unmountOnExit>
            <Item icon={<TravelExploreIcon fontSize="small" />} label="Qualification leads" path="/leads" indent />
          </Collapse>

          <Divider sx={{ my: 1, borderColor: DARK.border, mx: 2 }} />

          {/* Outils CEE */}
          <SectionHeader
            icon={<BuildIcon fontSize="small" />}
            label="Outils CEE"
            expanded={outilsOpen}
            onToggle={() => setOutilsOpen(o => !o)}
          />
          <Collapse in={open ? outilsOpen : true} timeout="auto" unmountOnExit>
            <Item icon={<BoltIcon fontSize="small" />}           label="Simulateur rapide"    path="/simulateur"                indent />
            <Item icon={<ForwardToInboxIcon fontSize="small" />} label="Générateur d'emails" path="/emails"                   indent />
            <Item icon={<SearchIcon fontSize="small" />}        label="Vérificateur CEE"     path="/hub" module="verificateur" indent />
            <Item icon={<ReceiptLongIcon fontSize="small" />}  label="Générateur de devis"  path="/hub" module="marges"       indent />
            <Item icon={<EngineeringIcon fontSize="small" />}  label="Visites techniques"   path="/visites"                   indent />
          </Collapse>

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

      {/* Footer — paramètres uniquement (profil/logout dans la top bar) */}
      <Box sx={{ borderTop: `1px solid ${DARK.border}`, p: 1, flexShrink: 0 }}>
        <Item icon={<SettingsIcon fontSize="small" />} label="Paramètres" path="/parametres" />
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
