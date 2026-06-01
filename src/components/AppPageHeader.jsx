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
  '/admin/users':   'Utilisateurs',
  '/export-mapping': 'Export personnalisé',
}

// Alertes stagnant uniquement entre Contacté et Devis envoyé (inclus)
// Au-delà (travaux, dépôt, conforme, facturé) pas besoin de relance
const STATUTS_STAGNANT = [
  'contacte',
  'visio_planifiee','visio_effectuee',
  'visite_planifiee','visite_effectuee',
  'devis',
]
const STATUT_LABELS = {
  simulation:        'Simulation',
  prospect:          'Prospect',
  contacte:          'Contacté',
  visio_planifiee:   'Visio planifiée',
  visio_effectuee:   'Visio effectuée',
  visite_planifiee:  'Visite planifiée',
  visite_effectuee:  'Visite effectuée',
  devis:             'Devis envoyé',
  devis_valide:      'Devis validé',
  travaux:           'Travaux en cours',
  depot_delegataire: 'Dépôt délégitaire',
  ah:                'AH signé',
  conforme:          'Conforme',
}

// ── Icônes SVG discrètes ─────────────────────────────────────────────────────
const IconSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const IconMoon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const IconBell = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

// ── Composant principal ──────────────────────────────────────────────────────
export default function AppPageHeader() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const C          = useAppTheme()
  const { profile, user, theme, toggleTheme, signOut, dossiers, taches } = useStore()
  const { isMobile } = useBreakpoint()

  const profileRef = useRef(null)
  const notifRef   = useRef(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen,   setNotifOpen]   = useState(false)

  // ── Page title ──────────────────────────────────────────────────────────────
  const pageTitle = (() => {
    const p = location.pathname
    if (PAGE_TITLES[p]) return PAGE_TITLES[p]
    if (p.startsWith('/dossier/')) return 'Fiche dossier'
    if (p.startsWith('/visites/')) return 'Visite technique'
    return ''
  })()

  // ── Profil ──────────────────────────────────────────────────────────────────
  const isAdmin  = profile?.role === 'admin'
  const initials = [profile?.prenom?.[0], profile?.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const fullName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || user?.email || '—'
  const role     = isAdmin ? 'Administrateur' : 'Commercial'

  // ── Alertes dossiers stagnants (+14j) ──────────────────────────────────────
  const myDossiers   = isAdmin ? dossiers : dossiers.filter(d => d.assigne_a === user?.id)
  const stagnantList = myDossiers.filter(d =>
    STATUTS_STAGNANT.includes(d.statut) &&
    Math.floor((Date.now() - new Date(d.updated_at)) / 86400000) > 14
  ).map(d => ({
    ...d,
    _type: 'dossier',
    jours: Math.floor((Date.now() - new Date(d.updated_at)) / 86400000),
    _label: d.prospects?.raison_sociale || d.ref || '—',
  })).sort((a, b) => b.jours - a.jours)

  // ── Tâches en retard (échéance dépassée, non terminées) ────────────────────
  const now = new Date()
  const overdueList = (taches || []).filter(t =>
    !t.done && t.echeance && new Date(t.echeance) < now
  ).map(t => ({
    ...t,
    _type: 'tache',
    jours: Math.floor((now - new Date(t.echeance)) / 86400000),
    _label: t.titre,
    _sub:   t.dossiers?.ref ? `${t.dossiers.ref}${t.dossiers.prospects?.raison_sociale ? ' — ' + t.dossiers.prospects.raison_sociale : ''}` : null,
  })).sort((a, b) => b.jours - a.jours)

  // ── Fin de travaux imminente (J-10 ou dépassée) ────────────────────────────
  const travauxAlertList = myDossiers.filter(d => {
    if (d.statut !== 'travaux' || !d.date_fin_travaux) return false
    const daysLeft = Math.floor((new Date(d.date_fin_travaux) - now) / 86400000)
    return daysLeft <= 10  // inclut J-10 et les dates dépassées
  }).map(d => {
    const daysLeft = Math.floor((new Date(d.date_fin_travaux) - now) / 86400000)
    return {
      ...d,
      _type: 'travaux',
      daysLeft,
      _label: d.prospects?.raison_sociale || d.ref || '—',
    }
  }).sort((a, b) => a.daysLeft - b.daysLeft)

  const notifCount = stagnantList.length + overdueList.length + travauxAlertList.length

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    setProfileOpen(false)
    await signOut()
    navigate('/login')
  }

  const blurProfile = (e) => {
    if (!profileRef.current?.contains(e.relatedTarget)) setProfileOpen(false)
  }
  const blurNotif = (e) => {
    if (!notifRef.current?.contains(e.relatedTarget)) setNotifOpen(false)
  }

  // ── Style helpers ────────────────────────────────────────────────────────────
  const iconBtn = (active = false) => ({
    background: active ? '#1E3A5F55' : 'transparent',
    border: `1px solid ${active ? '#334155' : 'transparent'}`,
    borderRadius: 7,
    cursor: 'pointer',
    color: '#64748B',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32,
    flexShrink: 0,
    position: 'relative',
    transition: 'all .15s',
  })

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
      <span style={{
        fontSize: isMobile ? 15 : 17, fontWeight: 800, color: '#fff',
        letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', flex: 1,
      }}>
        {pageTitle}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

        {/* ── Toggle thème discret ─────────────────────────────────────────── */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          style={iconBtn()}
          onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = '#1E3A5F55'; e.currentTarget.style.borderColor = '#334155' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>

        {/* ── Cloche notifications ─────────────────────────────────────────── */}
        <div ref={notifRef} style={{ position: 'relative' }} onBlur={blurNotif} tabIndex={-1}>
          <button
            onClick={() => { setNotifOpen(o => !o); setProfileOpen(false) }}
            title={notifCount > 0 ? `${notifCount} dossier${notifCount > 1 ? 's' : ''} stagnant${notifCount > 1 ? 's' : ''}` : 'Notifications'}
            style={iconBtn(notifOpen)}
            onMouseEnter={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = '#1E3A5F55'; e.currentTarget.style.borderColor = '#334155' }}
            onMouseLeave={e => { if (!notifOpen) { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
          >
            <IconBell />
            {/* Badge */}
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                background: '#DC2626', color: '#fff',
                borderRadius: '50%', width: 14, height: 14,
                fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}>
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          {/* Dropdown notifications */}
          {notifOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: '#1E293B', border: '1px solid #334155',
              borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,.35)',
              width: 320, maxHeight: 420, zIndex: 9999, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              fontFamily: "system-ui,'Segoe UI',Arial,sans-serif",
            }}>
              {/* En-tête */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC' }}>Alertes</span>
                {notifCount > 0 && (
                  <span style={{ fontSize: 11, color: '#64748B' }}>{notifCount} alerte{notifCount > 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Corps */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifCount === 0 ? (
                  <div style={{ padding: '20px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
                    <div style={{ fontSize: 13, color: '#64748B' }}>Aucune alerte — tout est à jour.</div>
                  </div>
                ) : (
                  <>
                    {/* ── Tâches en retard ── */}
                    {overdueList.length > 0 && (
                      <>
                        <div style={{ padding: '7px 14px 4px', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Tâches en retard ({overdueList.length})
                        </div>
                        {overdueList.map(t => (
                          <button
                            key={t.id}
                            onClick={() => { setNotifOpen(false); navigate('/') }}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              width: '100%', padding: '8px 14px', background: 'transparent',
                              border: 'none', borderBottom: '1px solid #1E3A5F',
                              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#273549' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>🔴</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {t._label}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#FCA5A5', background: '#3f1515', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
                                  {t.jours === 0 ? 'Auj.' : `+${t.jours}j`}
                                </span>
                              </div>
                              {t._sub && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t._sub}</div>}
                            </div>
                          </button>
                        ))}
                      </>
                    )}

                    {/* ── Fin de travaux imminente ── */}
                    {travauxAlertList.length > 0 && (
                      <>
                        <div style={{ padding: '7px 14px 4px', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Fin de travaux ({travauxAlertList.length})
                        </div>
                        {travauxAlertList.map(d => (
                          <button
                            key={d.id}
                            onClick={() => { setNotifOpen(false); navigate(`/dossier/${d.id}`) }}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              width: '100%', padding: '8px 14px', background: 'transparent',
                              border: 'none', borderBottom: '1px solid #1E3A5F',
                              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#273549' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>🔨</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {d.ref || d.id.slice(0, 8)}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 700,
                                  color: d.daysLeft < 0 ? '#FCA5A5' : d.daysLeft <= 3 ? '#FCD34D' : '#86EFAC',
                                  background: d.daysLeft < 0 ? '#3f1515' : d.daysLeft <= 3 ? '#3f2e00' : '#14351f',
                                  borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
                                  {d.daysLeft < 0 ? `Dépassé +${Math.abs(d.daysLeft)}j` : d.daysLeft === 0 ? "Auj." : `J-${d.daysLeft}`}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {d._label}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                                Fin prévue : {new Date(d.date_fin_travaux).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} — Préparer les docs CEE
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    )}

                    {/* ── Dossiers stagnants ── */}
                    {stagnantList.length > 0 && (
                      <>
                        <div style={{ padding: '7px 14px 4px', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Dossiers stagnants ({stagnantList.length})
                        </div>
                        {stagnantList.map(d => (
                          <button
                            key={d.id}
                            onClick={() => { setNotifOpen(false); navigate(`/dossier/${d.id}`) }}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              width: '100%', padding: '8px 14px', background: 'transparent',
                              border: 'none', borderBottom: '1px solid #1E3A5F',
                              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#273549' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {d.ref || d.id.slice(0, 8)}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#FCA5A5', background: '#3f1515', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
                                  {d.jours}j
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {d._label}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                                {STATUT_LABELS[d.statut] || d.statut}
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Footer — lien vers dossiers filtrés */}
              {stagnantList.length > 0 && (
                <div style={{ borderTop: '1px solid #334155', padding: '8px 14px' }}>
                  <button
                    onClick={() => { setNotifOpen(false); navigate('/dossiers') }}
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      color: '#60A5FA', fontSize: 12, cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'center',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#93C5FD' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#60A5FA' }}
                  >
                    Voir tous les dossiers →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Séparateur */}
        <div style={{ width: 1, height: 20, background: '#334155', flexShrink: 0, margin: '0 4px' }} />

        {/* ── Profil avec dropdown ─────────────────────────────────────────── */}
        <div ref={profileRef} style={{ position: 'relative' }} onBlur={blurProfile} tabIndex={-1}>
          <button
            onClick={() => { setProfileOpen(o => !o); setNotifOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: profileOpen ? '#1E3A5F55' : 'transparent',
              border: `1px solid ${profileOpen ? '#334155' : 'transparent'}`,
              borderRadius: 8, padding: '4px 8px 4px 4px',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1E3A5F55'; e.currentTarget.style.borderColor = '#334155' }}
            onMouseLeave={e => { if (!profileOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
          >
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

          {/* Dropdown profil */}
          {profileOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: '#1E293B', border: '1px solid #334155',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.3)',
              minWidth: 200, zIndex: 9999, overflow: 'hidden',
              fontFamily: "system-ui,'Segoe UI',Arial,sans-serif",
            }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #334155' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC' }}>{fullName}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{user?.email}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{role}</div>
              </div>
              <button
                onClick={() => { setProfileOpen(false); navigate('/parametres') }}
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
              <div style={{ height: 1, background: '#334155', margin: '0 8px' }} />
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
