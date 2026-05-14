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
const pct = (n, d) => d === 0 ? '—' : Math.round((n / d) * 100) + ' %'

// ── Fiches CEE — labels métier ───────────────────────────────────────────────
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

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, sub, C }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || C.text, lineHeight: 1.1, marginBottom: sub ? 4 : 0 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textSoft }}>{sub}</div>}
    </div>
  )
}

// ── Fiche Card ────────────────────────────────────────────────────────────────
function FicheCard({ fiche, stats, C, isMobile }) {
  const label = FICHE_LABELS[fiche] || fiche
  const color = FICHE_COLORS[fiche] || '#2563EB'
  const cols = isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)'
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      {/* Header fiche */}
      <div style={{ background: color + '15', borderBottom: `1px solid ${color}33`, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ background: color, color: '#fff', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 800, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fiche}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color, fontWeight: 700 }}>{stats.total} dossier{stats.total > 1 ? 's' : ''}</span>
      </div>
      {/* Métriques */}
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 0 }}>
        {[
          { lbl: 'En cours',       val: stats.enCours,       c: '#0369A1' },
          { lbl: 'CA prévisionnel',val: fmtK(stats.primePrev), c: '#7C3AED' },
          { lbl: 'CA encaissé',    val: fmtK(stats.primeEnc),  c: '#16A34A' },
          { lbl: 'Marges nettes',  val: fmtK(stats.marge),     c: stats.marge >= 0 ? '#059669' : '#DC2626' },
          { lbl: 'Volume CUMAC',   val: fmtGwh(stats.mwh),     c: '#0891B2' },
        ].map((m, i) => (
          <div key={m.lbl} style={{
            padding: '12px 14px',
            borderRight: i < 4 && !isMobile ? `1px solid ${C.border}` : 'none',
            borderTop: isMobile && i >= 2 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{m.lbl}</div>
            <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: m.c }}>{m.val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Statistiques() {
  const C = useAppTheme()
  const { isMobile, isCompact } = useBreakpoint()
  const { profile, user, dossiers, fetchDossiers } = useStore()

  const [simuMap, setSimuMap]   = useState({})
  const [loading, setLoading]   = useState(true)

  // Récupère dossiers si pas encore chargés
  useEffect(() => {
    if (!profile) return
    const init = async () => {
      await fetchDossiers()
      const { data } = await supabase.from('simulations').select('dossier_id, mwh_cumac')
      if (data) {
        const map = {}
        for (const s of data) {
          if (!map[s.dossier_id]) map[s.dossier_id] = s.mwh_cumac
        }
        setSimuMap(map)
      }
      setLoading(false)
    }
    init()
  }, [profile?.id])

  // Filtre par commercial si pas admin
  const isAdmin = profile?.role === 'admin'
  const myDossiers = isAdmin
    ? dossiers
    : dossiers.filter(d => d.assigne_a === user?.id)

  // Dossiers actifs (hors perdu)
  const activeDossiers = myDossiers.filter(d => d.statut !== 'perdu')

  // ── Calcul stats globales ──
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
      mwh:        acc.mwh        + mwh,
    }
  }, { total: 0, enCours: 0, travaux: 0, signe: 0, primePrev: 0, primeEnc: 0, marge: 0, mwh: 0 })

  const perdu = myDossiers.filter(d => d.statut === 'perdu').length
  const tauxConversion = pct(globalStats.signe, globalStats.total + perdu)

  // ── Calcul stats par fiche ──
  const ficheStats = {}
  for (const d of activeDossiers) {
    const f = d.fiche_cee
    if (!f) continue
    if (!ficheStats[f]) ficheStats[f] = { total: 0, enCours: 0, primePrev: 0, primeEnc: 0, marge: 0, mwh: 0 }
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
    ficheStats[f].mwh       += mwh
  }

  // Ordre d'affichage : fiches connues d'abord, puis les autres
  const FICHE_ORDER = Object.keys(FICHE_LABELS)
  const fichesAvecDossiers = [
    ...FICHE_ORDER.filter(f => ficheStats[f]),
    ...Object.keys(ficheStats).filter(f => !FICHE_ORDER.includes(f)),
  ]

  const kpiCols = isMobile ? 'repeat(2, 1fr)' : isCompact ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)'

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: isMobile ? 20 : 28 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, color: C.text }}>Statistiques</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textSoft }}>
          {isAdmin ? 'Tous les commerciaux' : 'Mes dossiers'} · {activeDossiers.length} dossier{activeDossiers.length !== 1 ? 's' : ''} actifs
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: C.textSoft, padding: 60 }}>Chargement…</div>
      ) : (
        <>
          {/* ── KPIs globaux ── */}
          <div style={{ marginBottom: isMobile ? 8 : 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Vue globale</div>
            <div style={{ display: 'grid', gridTemplateColumns: kpiCols, gap: isMobile ? 8 : 10, marginBottom: isMobile ? 16 : 24 }}>
              <KpiCard label="Dossiers en cours"  value={globalStats.enCours}          color={C.accent}    sub="visio planifiée → facturé" C={C} />
              <KpiCard label="CA prévisionnel"     value={fmtK(globalStats.primePrev)}  color="#7C3AED"     sub="Primes brutes hors facturé" C={C} />
              <KpiCard label="CA encaissé"         value={fmtK(globalStats.primeEnc)}   color="#16A34A"     sub="Primes brutes facturées" C={C} />
              <KpiCard label="Marges nettes"       value={fmtK(globalStats.marge)}      color={globalStats.marge >= 0 ? '#059669' : '#DC2626'} sub="Prime nette − coût install." C={C} />
              <KpiCard label="Travaux en cours"    value={globalStats.travaux}          color="#C2410C"     sub="Travaux → conforme" C={C} />
              <KpiCard label="Volume CUMAC total"  value={fmtGwh(globalStats.mwh)}     color="#0891B2"     sub="Volume CEE tous dossiers" C={C} />
            </div>

            {/* Ligne métriques complémentaires */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 8 : 10, marginBottom: isMobile ? 16 : 24 }}>
              <KpiCard label="Total dossiers actifs"   value={globalStats.total}            color={C.text}   sub="Hors dossiers perdus" C={C} />
              <KpiCard label="Dossiers signés"         value={globalStats.signe}            color="#15803D"  sub="AH signé → facturé" C={C} />
              <KpiCard label="Dossiers perdus"         value={perdu}                        color="#DC2626"  sub="Hors pipeline" C={C} />
              <KpiCard label="Taux de conversion"      value={tauxConversion}               color="#0D9488"  sub="Signés / total leads" C={C} />
            </div>
          </div>

          {/* ── Stats par fiche ── */}
          {fichesAvecDossiers.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Par fiche CEE
              </div>
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
        </>
      )}
    </div>
  )
}
