import { useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useStore from '../store/useStore'
import { useAppTheme } from '../lib/theme'
import { useBreakpoint } from '../lib/useBreakpoint'

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

export default function AppPageHeader() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const C          = useAppTheme()
  const { profile, user, theme, toggleTheme, signOut } = useStore()
  const { isMobile } = useBreakpoint()
  const dropRef    = useRef(null)
  const [open, setOpen] = useState(false)

  const pageTitle = (() => {
    const p = location.pathname
    if (PAGE_TITLES[p]) return PAGE_TITLES[p]
    if (p.startsWith('/dossier/')) return 'Fiche dossier'
    if (p.startsWith('/visites/')) return 'Visite technique'
    return ''
  })()

  const initials = [profile?.prenom?.[0], profile?.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const fullName  = [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || user?.email || '—'
  const role      = profile?.role === 'admin' ? 'Administrateur' : 'Commercial'

  const handleLogout = async () => {
    setOpen(false)
    await signOut()
    navigate('/login')
  }

  const handleBlur = (e) => {
    if (!dropRef.current?.contains(e.relatedTarget)) setOpen(false)
  }

  return (
    <div style={{
      background: C.nav,
      borderBottom: '1px solid #334155',
      padding: `0 ${isMobile ? 12 : 24}px`,
      height: 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      flexShrink: 0,
      fontFamily: "system-ui,'Segoe UI',Arial,sans-serif",
    }}>

      {/* Titre de la page */}
      <span style={{ fontSize: isMobile ? 15 : 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {pageTitle}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, flexShrink: 0 }}>

        {/* Toggle thème */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#64748B', fontSize: 18, display: 'flex', alignItems: 'center',
            padding: '4px 6px', borderRadius: 6, lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = '#1E3A5F22' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'transparent' }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Séparateur */}
        {!isMobile && <div style={{ width: 1, height: 20, background: '#334155', flexShrink: 0 }} />}

        {/* Profil avec dropdown */}
        <div ref={dropRef} style={{ position: 'relative' }} onBlur={handleBlur} tabIndex={-1}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: open ? '#1E3A5F55' : 'transparent',
              border: `1px solid ${open ? '#334155' : 'transparent'}`,
              borderRadius: 8, padding: '4px 8px 4px 4px',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1E3A5F55'; e.currentTarget.style.borderColor = '#334155' }}
            onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
          >
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {initials}
            </div>
            {!isMobile && (
              <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>{fullName}</div>
                <div style={{ fontSize: 10, color: '#64748B' }}>{role}</div>
              </div>
            )}
            <span style={{ fontSize: 10, color: '#64748B', marginLeft: 2 }}>▾</span>
          </button>

          {/* Dropdown */}
          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: '#1E293B', border: '1px solid #334155',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.3)',
              minWidth: 200, zIndex: 9999, overflow: 'hidden',
              fontFamily: "system-ui,'Segoe UI',Arial,sans-serif",
            }}>
              {/* Infos profil */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #334155' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC' }}>{fullName}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{user?.email}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{role}</div>
              </div>
              {/* Paramètres */}
              <button
                onClick={() => { setOpen(false); navigate('/parametres') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px', background: 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  color: '#F8FAFC', fontSize: 13, textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#273549' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                ⚙️ Paramètres
              </button>
              {/* Séparateur */}
              <div style={{ height: 1, background: '#334155', margin: '0 8px' }} />
              {/* Déconnexion */}
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px', background: 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  color: '#FC8181', fontSize: 13, textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#3f1515' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                ↪ Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
