import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import MenuIcon from '@mui/icons-material/Menu'
import AppSidebar from './AppSidebar'

export default function AppLayout({ children }) {
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const [mobileOpen,   setMobileOpen]   = useState(false)

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
      <Box
        component="main"
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Barre mobile uniquement — hamburger */}
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          alignItems: 'center',
          height: 48,
          px: 1,
          background: '#1E293B',
          borderBottom: '1px solid #334155',
          flexShrink: 0,
        }}>
          <IconButton onClick={() => setMobileOpen(true)} size="small"
            sx={{ color: '#94A3B8', mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>SOFT.IA</span>
        </Box>

        {/* Page rendue */}
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', background: '#F1F5F9' }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
