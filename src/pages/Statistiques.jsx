import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { useBreakpoint } from '../lib/useBreakpoint'
import { useAppTheme } from '../lib/theme'

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtK = (n) => {
  if (n == null || isNaN(n) || n === 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' M€'
  if (n >= 1_000) return Math.round(n / 1_000) + ' k€'
  return Math.round(n) + ' €'
}
const fmtGwh = (mwh) => {
  if (!mwh || isNaN(mwh) || mwh === 0) return '—'
  const gwh = mwh / 1_000
  if (gwh >= 1) return gwh.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' GWh'
  return mwh.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MWh'
}
const fmtJ = (n) => (n == null || isNaN(n)) ? '—' : `${Math.round(n)} j`
const pct  = (n, d) => d === 0 ? '—' : Math.round((n / d) * 100) + ' %'

// ── Constantes ────────────────────────────────────────────────────────────────
const FICHE_LABELS = {
  'BAT-TH-116': 'GTB',
  'BAT-TH-163': 'PAC Tertiaire',
  'BAT-TH-142': 'Destrat Tertiaire',
  'IND-BA-110': 'Destrat Industrie',
  'BAT-TH-125': 'VMC Simple flux',
  'BAT-TH-126': 'VMC Double flux',
}
const FICHE_COLORS = {
  'BAT-TH-116': '#7C3AED',
  'BAT-TH-163': '#0891B2',
  'BAT-TH-142': '#D97706',
  'IND-BA-110': '#EA580C',
  'BAT-TH-125': '#16A34A',
  'BAT-TH-126': '#0369A1',
}
const STATUTS_EN_COURS = ['visio_planifiee','visio_effectuee','visite_planifiee','visite_effectuee','devis','devis_valide','ah','travaux','depot_delegataire','conforme','facture']
const STATUTS_TRAVAUX  = ['travaux', 'depot_delegataire', 'conforme']
const STATUT_SIGNE     = ['ah', 'travaux', 'depot_delegataire', 'conforme', 'facture']
const PIPELINE_ORDER   = ['simulation','prospect','contacte','visio_planifiee','visio_effectuee','visite_planifiee','visite_effectuee','devis','ah','conforme','facture']
const STATUT_LABELS    = {
  simulation: 'Simulation', prospect: 'Prospect', contacte: 'Contacté',
  visio_planifiee: 'Visio planifiée', visio_effectuee: 'Visio effectuée',
  visite_planifiee: 'Visite planifiée', visite_effectuee: 'Visite effectuée',
  devis: 'Devis envoyé', ah: 'AH signé', conforme: 'Conforme', facture: 'Facturé',
}

// ── Composants ────────────────────────────────────────────────────────────────
function SectionTitle({ children, C }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
      {children}
    </div>
  )
}

function KpiCard({ label, value, color, sub, C }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || C.text, lineHeight: 1.1, marginBottom: sub ? 4 : 0 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textSoft }}>{sub}</div>}
    </div>
  )
}

function FicheCard({ fiche, stats, C, isMobile }) {
  const label      = FICHE_LABELS[fiche] || fiche
  const color      = FICHE_COLORS[fiche] || '#2563EB'
  const commission = Math.round((stats.margeEnc || 0) * 0.5 * 100) / 100

  const metrics = isMobile
    ? [
        { lbl: 'En cours',       val: stats.enCours,            c: '#0369A1' },
        { lbl: 'CA prévis.',     val: fmtK(stats.primePrev),    c: '#7C3AED' },
        { lbl: 'CA encaissé',    val: fmtK(stats.primeEnc),     c: '#16A34A' },
        { lbl: 'Marge encaissée',val: fmtK(stats.margeEnc),     c: stats.margeEnc >= 0 ? '#0D9488' : '#DC2626' },
        { lbl: 'Commission 50%', val: fmtK(commission),         c: '#F59E0B' },
        { lbl: 'CUMAC',          val: fmtGwh(stats.mwh),        c: '#0891B2' },
      ]
    : [
        { lbl: 'En cours',           val: stats.enCours,            c: '#0369A1' },
        { lbl: 'CA prévisionnel',    val: fmtK(stats.primePrev),    c: '#7C3AED' },
        { lbl: 'CA encaissé',        val: fmtK(stats.primeEnc),     c: '#16A34A' },
        { lbl: 'Marge nette totale', val: fmtK(stats.marge),        c: stats.marge >= 0 ? '#059669' : '#DC2626' },
        { lbl: 'Marge encaissée',    val: fmtK(stats.margeEnc),     c: stats.margeEnc >= 0 ? '#0D9488' : '#DC2626' },
        { lbl: 'Commission 50%',     val: fmtK(commission),         c: '#F59E0B' },
        { lbl: 'Volume CUMAC',       val: fmtGwh(stats.mwh),        c: '#0891B2' },
      ]

  const cols = metrics.length
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: color + '15', borderBottom: `1px solid ${color}33`, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ background: color, color: '#fff', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 800, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fiche}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color, fontWeight: 700 }}>{stats.total} dossier{stats.total > 1 ? 's' : ''}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : `repeat(${cols}, 1fr)`, gap: 0 }}>
        {metrics.map((m, i) => (
          <div key={m.lbl} style={{
            padding: isMobile ? '10px 10px' : '12px 14px',
            borderRight: i < cols - 1 && !isMobile ? `1px solid ${C.border}` : 'none',
            borderTop: isMobile && i >= 3 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{m.lbl}</div>
            <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: m.c }}>{m.val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section Par commercial (admin only) ──────────────────────────────────────
function CommercialSection({ dossiers, simuMap, profiles, C, isMobile }) {
  const [sortCol, setSortCol] = useState('primePrev')
  const [sortDir, setSortDir] = useState('desc')

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  const assignes   = [...new Set(dossiers.map(d => d.assigne_a).filter(Boolean))]

  const rows = assignes.map(uid => {
    const p    = profileMap[uid] || {}
    const nom  = [p.prenom, p.nom].filter(Boolean).join(' ') || uid.slice(0, 8)
    const mine = dossiers.filter(d => d.assigne_a === uid)
    const active = mine.filter(d => d.statut !== 'perdu')
    const perdu  = mine.filter(d => d.statut === 'perdu').length

    const stats = active.reduce((acc, d) => {
      const prime = d.prime_estimee || 0
      const cout  = d.montant_devis || 0
      const marge = prime > 0 ? Math.round((prime * 0.9 - cout) * 100) / 100 : 0
      const mwh   = simuMap[d.id] || 0
      const isFacture = d.statut === 'facture'
      return {
        total:     acc.total + 1,
        enCours:   acc.enCours   + (STATUTS_EN_COURS.includes(d.statut) ? 1 : 0),
        signe:     acc.signe     + (STATUT_SIGNE.includes(d.statut) ? 1 : 0),
        travaux:   acc.travaux   + (STATUTS_TRAVAUX.includes(d.statut) ? 1 : 0),
        primePrev: acc.primePrev + (prime > 0 && !isFacture ? prime : 0),
        primeEnc:  acc.primeEnc  + (prime > 0 && isFacture  ? prime : 0),
        marge:     acc.marge     + marge,
        margeEnc:  acc.margeEnc  + (isFacture && prime > 0 ? marge : 0),
        mwh:       acc.mwh       + mwh,
      }
    }, { total: 0, enCours: 0, signe: 0, travaux: 0, primePrev: 0, primeEnc: 0, marge: 0, margeEnc: 0, mwh: 0 })

    const commission = Math.round(stats.margeEnc * 0.5 * 100) / 100
    return { uid, nom, ...stats, commission, perdu, taux: pct(stats.signe, stats.total + perdu) }
  })

  const COLS = isMobile
    ? [
        { lbl: 'Commercial',    key: 'nom',        align: 'left',  fmt: v => v, color: C.text },
        { lbl: 'En cours',      key: 'enCours',    align: 'right', fmt: v => v, color: '#0369A1' },
        { lbl: 'CA prévis',     key: 'primePrev',  align: 'right', fmt: fmtK,   color: '#7C3AED' },
        { lbl: 'Commission',    key: 'commission', align: 'right', fmt: fmtK,   color: '#F59E0B' },
      ]
    : [
        { lbl: 'Commercial',      key: 'nom',        align: 'left',  fmt: v => v, color: C.text },
        { lbl: 'Actifs',          key: 'total',      align: 'right', fmt: v => v, color: C.textMid },
        { lbl: 'En cours',        key: 'enCours',    align: 'right', fmt: v => v, color: '#0369A1' },
        { lbl: 'Signés',          key: 'signe',      align: 'right', fmt: v => v, color: '#15803D' },
        { lbl: 'Perdus',          key: 'perdu',      align: 'right', fmt: v => v, color: '#DC2626' },
        { lbl: 'CA prévisionnel', key: 'primePrev',  align: 'right', fmt: fmtK,   color: '#7C3AED' },
        { lbl: 'CA encaissé',     key: 'primeEnc',   align: 'right', fmt: fmtK,   color: '#16A34A' },
        { lbl: 'Marge encaissée', key: 'margeEnc',   align: 'right', fmt: fmtK,   color: '#0D9488' },
        { lbl: 'Commission 50%',  key: 'commission', align: 'right', fmt: fmtK,   color: '#F59E0B' },
        { lbl: 'CUMAC',           key: 'mwh',        align: 'right', fmt: fmtGwh, color: '#0891B2' },
        { lbl: 'Taux conv.',      key: 'taux',       align: 'right', fmt: v => v, color: '#0D9488' },
      ]

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol]
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    const an = parseFloat(av) || 0, bn = parseFloat(bv) || 0
    return sortDir === 'asc' ? an - bn : bn - an
  })

  const toggleSort = (key) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('desc') }
  }

  if (rows.length === 0) return null

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: `${isMobile ? '1fr' : '160px'} repeat(${COLS.length - 1}, 1fr)`, background: C.bg, borderBottom: `1px solid ${C.border}`, padding: '10px 16px' }}>
        {COLS.map(col => (
          <div key={col.key} onClick={() => toggleSort(col.key)}
            style={{ fontSize: 10, fontWeight: 700, color: sortCol === col.key ? C.accent : C.textSoft, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: col.align, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
            {col.lbl}{sortCol === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
          </div>
        ))}
      </div>
      {sorted.map((row, i) => (
        <div key={row.uid}
          style={{ display: 'grid', gridTemplateColumns: `${isMobile ? '1fr' : '160px'} repeat(${COLS.length - 1}, 1fr)`, padding: '12px 16px', borderBottom: i < sorted.length - 1 ? `1px solid ${C.bg}` : 'none', alignItems: 'center' }}>
          {COLS.map((col, ci) => (
            <div key={col.key} style={{ fontSize: 13, fontWeight: ci === 0 ? 700 : 500, color: ci === 0 ? C.text : col.color, textAlign: col.align, whiteSpace: 'nowrap' }}>
              {col.fmt(row[col.key])}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Section Temporalité (admin only) ─────────────────────────────────────────
function TemporaliteSection({ dossiers, C, isMobile }) {
  const now = Date.now()
  const daysDiff = (a, b) => Math.floor((a - new Date(b)) / 86400000)

  // Stats par statut (dossiers actifs, hors perdu)
  const active = dossiers.filter(d => d.statut !== 'perdu')
  const byStatut = {}
  for (const d of active) {
    if (!byStatut[d.statut]) byStatut[d.statut] = { count: 0, totalAge: 0, totalInStatus: 0 }
    byStatut[d.statut].count++
    byStatut[d.statut].totalAge      += daysDiff(now, d.created_at)
    byStatut[d.statut].totalInStatus += daysDiff(now, d.updated_at)
  }

  // Dossiers facturés — durée totale de cycle
  const factures   = dossiers.filter(d => d.statut === 'facture')
  const avgClose   = factures.length > 0
    ? Math.round(factures.reduce((s, d) => s + daysDiff(new Date(d.updated_at), d.created_at), 0) / factures.length)
    : null

  // Dossiers stagnants (en cours, updated_at > 30j)
  const stagnants  = active.filter(d => STATUTS_EN_COURS.includes(d.statut) && daysDiff(now, d.updated_at) > 30)
  const stagnants7 = active.filter(d => STATUTS_EN_COURS.includes(d.statut) && daysDiff(now, d.updated_at) > 7)

  const statuts = PIPELINE_ORDER.filter(s => byStatut[s])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPIs temporels */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 8 : 10 }}>
        <KpiCard label="Durée moy. cycle complet" value={avgClose != null ? fmtJ(avgClose) : '—'} color="#7C3AED" sub={`sur ${factures.length} dossier${factures.length !== 1 ? 's' : ''} facturé${factures.length !== 1 ? 's' : ''}`} C={C} />
        <KpiCard label="Dossiers stagnants +7j"   value={stagnants7.length}  color="#D97706" sub="en cours sans activité" C={C} />
        <KpiCard label="Dossiers stagnants +30j"  value={stagnants.length}   color="#DC2626" sub="en cours sans activité" C={C} />
        <KpiCard label="Âge moyen pipeline"       value={fmtJ(active.length > 0 ? active.reduce((s, d) => s + daysDiff(now, d.created_at), 0) / active.length : 0)} color="#0891B2" sub="tous dossiers actifs" C={C} />
      </div>

      {/* Tableau durée par statut */}
      {statuts.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : '200px 1fr 1fr 1fr', background: C.bg, borderBottom: `1px solid ${C.border}`, padding: '10px 16px', gap: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.05em' }}>Statut</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'right' }}>Dossiers</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'right' }}>Âge moy. pipeline</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'right' }}>Moy. dans ce statut</div>
          </div>
          {statuts.map((s, i) => {
            const st  = byStatut[s]
            const avgAge    = st.count > 0 ? Math.round(st.totalAge / st.count) : 0
            const avgStatus = st.count > 0 ? Math.round(st.totalInStatus / st.count) : 0
            const isStagnant = avgStatus > 30
            return (
              <div key={s} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : '200px 1fr 1fr 1fr', padding: '11px 16px', borderBottom: i < statuts.length - 1 ? `1px solid ${C.bg}` : 'none', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{STATUT_LABELS[s] || s}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, textAlign: 'right' }}>{st.count}</div>
                <div style={{ fontSize: 13, color: C.textMid, textAlign: 'right' }}>{fmtJ(avgAge)}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isStagnant ? '#DC2626' : '#059669', textAlign: 'right' }}>
                  {fmtJ(avgStatus)}{isStagnant ? ' ⚠️' : ''}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dossiers stagnants */}
      {stagnants.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>⚠️ {stagnants.length} dossier{stagnants.length > 1 ? 's' : ''} sans activité depuis +30 jours</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {stagnants.map(d => (
              <span key={d.id} style={{ background: '#fff', border: '1px solid #FCA5A5', borderRadius: 6, padding: '3px 10px', fontSize: 12, color: '#991B1B' }}>
                {d.ref} · {STATUT_LABELS[d.statut] || d.statut} · {daysDiff(now, d.updated_at)}j
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Statistiques() {
  const C = useAppTheme()
  const { isMobile, isCompact } = useBreakpoint()
  const { profile, user, dossiers, fetchDossiers, profiles, fetchProfiles } = useStore()

  const [simuMap, setSimuMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const init = async () => {
      await fetchDossiers()
      if (profile.role === 'admin') await fetchProfiles()
      // On récupère les simulations triées du plus récent au plus ancien.
      // Pour chaque dossier, on prend la dernière simulation uniquement.
      // Les dossiers "perdu" sont exclus via activeDossiers (pas ici).
      const { data } = await supabase
        .from('simulations')
        .select('dossier_id, mwh_cumac')
        .order('created_at', { ascending: false })
      if (data) {
        const map = {}
        for (const s of data) {
          if (s.mwh_cumac && !map[s.dossier_id]) map[s.dossier_id] = s.mwh_cumac
        }
        setSimuMap(map)
      }
      setLoading(false)
    }
    init()
  }, [profile?.id])

  const isAdmin    = profile?.role === 'admin'
  const myDossiers = isAdmin
    ? dossiers
    : dossiers.filter(d => d.assigne_a === user?.id)

  const activeDossiers = myDossiers.filter(d => d.statut !== 'perdu')
  const perdu          = myDossiers.filter(d => d.statut === 'perdu').length

  // Financiers globaux
  const globalStats = activeDossiers.reduce((acc, d) => {
    const prime = d.prime_estimee || 0
    const cout  = d.montant_devis || 0
    const marge = prime > 0 ? Math.round((prime * 0.9 - cout) * 100) / 100 : 0
    const mwh   = simuMap[d.id] || 0
    const isFacture = d.statut === 'facture'
    return {
      total:      acc.total + 1,
      enCours:    acc.enCours    + (STATUTS_EN_COURS.includes(d.statut) ? 1 : 0),
      travaux:    acc.travaux    + (STATUTS_TRAVAUX.includes(d.statut) ? 1 : 0),
      signe:      acc.signe      + (STATUT_SIGNE.includes(d.statut) ? 1 : 0),
      primePrev:  acc.primePrev  + (prime > 0 && !isFacture ? prime : 0),
      primeEnc:   acc.primeEnc   + (prime > 0 && isFacture  ? prime : 0),
      marge:      acc.marge      + marge,
      margeEnc:   acc.margeEnc   + (isFacture && prime > 0 ? marge : 0),
      mwh:        acc.mwh        + mwh,
    }
  }, { total: 0, enCours: 0, travaux: 0, signe: 0, primePrev: 0, primeEnc: 0, marge: 0, margeEnc: 0, mwh: 0 })

  const tauxConversion = pct(globalStats.signe, globalStats.total + perdu)
  const commissionGlobal = Math.round(globalStats.margeEnc * 0.5 * 100) / 100
  const kpiCols = isMobile ? 'repeat(2, 1fr)' : isCompact ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)'

  // Par fiche
  const ficheStats = {}
  for (const d of activeDossiers) {
    const f = d.fiche_cee
    if (!f) continue
    if (!ficheStats[f]) ficheStats[f] = { total: 0, enCours: 0, primePrev: 0, primeEnc: 0, marge: 0, margeEnc: 0, mwh: 0 }
    const prime = d.prime_estimee || 0
    const cout  = d.montant_devis || 0
    const marge = prime > 0 ? Math.round((prime * 0.9 - cout) * 100) / 100 : 0
    const mwh   = simuMap[d.id] || 0
    const isFacture = d.statut === 'facture'
    ficheStats[f].total     += 1
    ficheStats[f].enCours   += STATUTS_EN_COURS.includes(d.statut) ? 1 : 0
    ficheStats[f].primePrev += prime > 0 && !isFacture ? prime : 0
    ficheStats[f].primeEnc  += prime > 0 && isFacture  ? prime : 0
    ficheStats[f].marge     += marge
    ficheStats[f].margeEnc  += isFacture && prime > 0 ? marge : 0
    ficheStats[f].mwh       += mwh
  }

  const FICHE_ORDER = Object.keys(FICHE_LABELS)
  const fichesAvecDossiers = [
    ...FICHE_ORDER.filter(f => ficheStats[f]),
    ...Object.keys(ficheStats).filter(f => !FICHE_ORDER.includes(f)),
  ]

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: isMobile ? 20 : 28 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, color: C.text }}>Statistiques</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textSoft }}>
          {isAdmin ? 'Tous les commerciaux' : 'Mes dossiers'} · {activeDossiers.length} dossier{activeDossiers.length !== 1 ? 's' : ''} actifs
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: C.textSoft, padding: 60 }}>Chargement…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 24 : 32 }}>

          {/* ── KPIs globaux ── */}
          <div>
            <SectionTitle C={C}>Vue globale</SectionTitle>
            {/* Ligne 1 — Pipeline */}
            <div style={{ display: 'grid', gridTemplateColumns: kpiCols, gap: isMobile ? 8 : 10, marginBottom: isMobile ? 8 : 10 }}>
              <KpiCard label="Dossiers en cours"     value={globalStats.enCours}          color={C.accent}    sub="Visio planifiée → facturé" C={C} />
              <KpiCard label="CA prévisionnel"        value={fmtK(globalStats.primePrev)}  color="#7C3AED"     sub="Primes brutes hors facturé" C={C} />
              <KpiCard label="CA encaissé"            value={fmtK(globalStats.primeEnc)}   color="#16A34A"     sub="Primes brutes facturées" C={C} />
              <KpiCard label="Volume CUMAC total"     value={fmtGwh(globalStats.mwh)}     color="#0891B2"     sub="Volume CEE tous dossiers" C={C} />
            </div>
            {/* Ligne 2 — Financier encaissé */}
            <div style={{ display: 'grid', gridTemplateColumns: kpiCols, gap: isMobile ? 8 : 10, marginBottom: isMobile ? 8 : 10 }}>
              <KpiCard label="Marge nette totale"     value={fmtK(globalStats.marge)}     color={globalStats.marge >= 0 ? '#059669' : '#DC2626'} sub="Prime nette − coût install." C={C} />
              <KpiCard label="Marge nette encaissée"  value={fmtK(globalStats.margeEnc)}  color={globalStats.margeEnc >= 0 ? '#0D9488' : '#DC2626'} sub="Sur dossiers facturés uniquement" C={C} />
              <KpiCard label="Commission commercial"  value={fmtK(commissionGlobal)}      color="#F59E0B"     sub="50 % de la marge encaissée" C={C} />
              <KpiCard label="Travaux en cours"       value={globalStats.travaux}          color="#C2410C"     sub="Travaux → conforme" C={C} />
            </div>
            {/* Ligne 3 — Conversions */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 8 : 10 }}>
              <KpiCard label="Total actifs"    value={globalStats.total}   color={C.text}   sub="Hors dossiers perdus" C={C} />
              <KpiCard label="Dossiers signés" value={globalStats.signe}   color="#15803D"  sub="AH signé → facturé" C={C} />
              <KpiCard label="Dossiers perdus" value={perdu}               color="#DC2626"  sub="Hors pipeline" C={C} />
              <KpiCard label="Taux conversion" value={tauxConversion}      color="#0D9488"  sub="Signés / total leads" C={C} />
            </div>
          </div>

          {/* ── Par commercial (admin) ── */}
          {isAdmin && (profiles || []).length > 0 && (
            <div>
              <SectionTitle C={C}>Par commercial</SectionTitle>
              <CommercialSection
                dossiers={myDossiers}
                simuMap={simuMap}
                profiles={profiles}
                C={C}
                isMobile={isMobile}
              />
            </div>
          )}

          {/* ── Temporalité (admin) ── */}
          {isAdmin && (
            <div>
              <SectionTitle C={C}>Temporalité & Vélocité</SectionTitle>
              <TemporaliteSection dossiers={myDossiers} C={C} isMobile={isMobile} />
            </div>
          )}

          {/* ── Par fiche ── */}
          {fichesAvecDossiers.length > 0 && (
            <div>
              <SectionTitle C={C}>Par fiche CEE</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {fichesAvecDossiers.map(fiche => (
                  <FicheCard key={fiche} fiche={fiche} stats={ficheStats[fiche]} C={C} isMobile={isMobile} />
                ))}
              </div>
            </div>
          )}

          {fichesAvecDossiers.length === 0 && (
            <div style={{ textAlign: 'center', color: C.textSoft, padding: 40 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
              <div style={{ fontWeight: 600 }}>Aucune donnée par fiche</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Créez des dossiers avec une fiche CEE pour voir les statistiques détaillées.</div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
