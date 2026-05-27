import { useEffect, useState, useCallback } from 'react'
import useVeille from '../hooks/useVeille'
import useStore from '../store/useStore'
import { useAppTheme } from '../lib/theme'

// Couleurs catégories — identiques en light et dark
const CAT_COLORS = { arrete: '#EF4444', cee: '#F97316', immo: '#10B981', video: '#8B5CF6' }
const CAT_LABELS = { arrete: 'Arrêté', cee: 'CEE', immo: 'Immo', video: 'Vidéo' }
const CAT_EMOJI  = { arrete: '🚨', cee: '📰', immo: '🏗️', video: '🎥' }
const TABS = [
  { key: null,      label: 'Tout' },
  { key: 'arrete',  label: '🚨 Arrêtés' },
  { key: 'cee',     label: '📰 CEE' },
  { key: 'immo',    label: '🏗️ Immo' },
  { key: 'video',   label: '🎥 Vidéos' },
  { key: '__saved', label: '🔖 Sauvegardés' },
]

function buildV(P, isDark) {
  return {
    bg:       P.bg,
    card:     P.surface,
    border:   P.border,
    text:     P.text,
    textMid:  P.textMid,
    textSoft: P.textSoft,
    headerBg: isDark ? '#0A0F1E' : P.surface,
    modalBg:  isDark ? '#111827' : P.surface,
    btnBg:    isDark ? '#1E293B' : P.bg,
    ...CAT_COLORS,
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1) return "Il y a moins d'1h"
  if (h < 24) return `Il y a ${h}h`
  if (d < 7)  return `Il y a ${d}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function ArreteCard({ item, dossierFiches, onOpen, onToggleSave, V }) {
  const color = V.arrete
  const hasImpact = item.fiches_impactees?.some(f => dossierFiches.includes(f))
  const isNew = !item.est_lu
  return (
    <div onClick={() => onOpen(item)} style={{ background: V.card, border: `1px solid ${isNew ? color : V.border}`, borderLeft: `3px solid ${color}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>🚨 Arrêté officiel</span>
        {isNew && <span style={{ fontSize: 10, fontWeight: 700, background: color, color: '#fff', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>NOUVEAU</span>}
        <span style={{ fontSize: 11, color: V.textSoft, marginLeft: 'auto', flexShrink: 0 }}>{timeAgo(item.date_publication)}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: V.text, lineHeight: 1.4, marginBottom: 8 }}>{item.titre}</div>
      {hasImpact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
          <span style={{ fontSize: 12 }}>⚡</span>
          <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>Impact sur tes dossiers : {item.fiches_impactees.filter(f => dossierFiches.includes(f)).join(', ')}</span>
        </div>
      )}
      {item.fiches_impactees?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {item.fiches_impactees.map(f => (
            <span key={f} style={{ fontSize: 10, background: 'rgba(239,68,68,0.12)', color: '#DC2626', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>{f}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: V.textSoft }}>{item.source_nom}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color, fontWeight: 600 }}>Voir résumé →</span>
          <button onClick={e => { e.stopPropagation(); onToggleSave(item.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: item.est_sauvegarde ? 1 : 0.4 }}>🔖</button>
        </div>
      </div>
    </div>
  )
}

function ItemCard({ item, onOpen, onToggleSave, V }) {
  const color = CAT_COLORS[item.source_categorie] || CAT_COLORS.cee
  const isNew = !item.est_lu
  return (
    <div onClick={() => onOpen(item)} style={{ background: V.card, border: `1px solid ${isNew ? color + '60' : V.border}`, borderLeft: `3px solid ${color}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase' }}>{CAT_EMOJI[item.source_categorie]} {CAT_LABELS[item.source_categorie] || item.source_categorie}</span>
        {isNew && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />}
        <span style={{ fontSize: 11, color: V.textSoft, marginLeft: 'auto' }}>{timeAgo(item.date_publication)}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: V.text, lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.titre}</div>
      {item.description && (
        <div style={{ fontSize: 12, color: V.textMid, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 6 }}>{item.description}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: V.textSoft }}>{item.source_nom}</span>
        <button onClick={e => { e.stopPropagation(); onToggleSave(item.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: item.est_sauvegarde ? 1 : 0.35 }}>🔖</button>
      </div>
    </div>
  )
}

function ItemModal({ item, onClose, onGenerateSummary, dossierFiches, generating, V }) {
  if (!item) return null
  const color = CAT_COLORS[item.source_categorie] || CAT_COLORS.cee
  const hasImpact = item.fiches_impactees?.some(f => dossierFiches.includes(f))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: V.modalBg, border: `1px solid ${V.border}`, borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: '20px 20px 40px' }}>
        <div style={{ width: 36, height: 4, background: V.textSoft, borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>{CAT_EMOJI[item.source_categorie]} {CAT_LABELS[item.source_categorie]}</span>
          <span style={{ fontSize: 11, color: V.textSoft }}>{item.source_nom} · {item.date_publication ? new Date(item.date_publication).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: V.text, lineHeight: 1.4, marginBottom: 16 }}>{item.titre}</div>
        {hasImpact && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 4 }}>⚡ Impact sur tes dossiers actifs</div>
            <div style={{ fontSize: 12, color: '#EF4444' }}>Les fiches {item.fiches_impactees.filter(f => dossierFiches.includes(f)).join(', ')} de tes dossiers en cours sont concernées par cet arrêté.</div>
          </div>
        )}
        {item.fiches_impactees?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: V.textSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Fiches CEE concernées</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {item.fiches_impactees.map(f => <span key={f} style={{ fontSize: 11, background: 'rgba(239,68,68,0.1)', color: '#DC2626', borderRadius: 6, padding: '3px 8px', fontWeight: 600 }}>{f}</span>)}
            </div>
          </div>
        )}
        {item.resume_ia ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: V.textSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>📋 Résumé</div>
            <div style={{ fontSize: 13, color: V.textMid, lineHeight: 1.6, marginBottom: 12 }}>{item.resume_ia}</div>
            {item.points_cles?.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: V.textSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Points clés</div>
                {item.points_cles.map((pt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0, minWidth: 20 }}>{i + 1}.</span>
                    <span style={{ fontSize: 13, color: V.text, lineHeight: 1.5 }}>{pt}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : item.description ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: V.textSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Description</div>
            <div style={{ fontSize: 13, color: V.textMid, lineHeight: 1.6 }}>{item.description}</div>
          </div>
        ) : null}
        {item.source_categorie === 'arrete' && !item.resume_ia && (
          <button onClick={() => onGenerateSummary(item.id)} disabled={generating}
            style={{ width: '100%', padding: '12px', background: color, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.7 : 1, marginBottom: 12, fontFamily: 'inherit' }}>
            {generating ? '⏳ Génération en cours…' : '✨ Générer le résumé IA'}
          </button>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer"
              style={{ flex: 1, display: 'block', textAlign: 'center', padding: '10px', background: V.border, color: V.text, borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              📄 Voir l'article complet
            </a>
          )}
          <button onClick={onClose} style={{ padding: '10px 16px', background: 'transparent', color: V.textMid, border: `1px solid ${V.border}`, borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

export default function Veille() {
  const { items, loading, fetching, newCount, fetchItems, markLu, toggleSauvegarde, triggerFetch, generateSummary } = useVeille()
  const { dossiers } = useStore()
  const P = useAppTheme()
  const theme = useStore(s => s.theme)
  const isDark = theme === 'dark'
  const V = buildV(P, isDark)

  const [activeTab, setActiveTab] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [generating, setGenerating] = useState(false)

  const dossierFiches = [...new Set(dossiers.map(d => d.fiche_cee).filter(Boolean))]

  useEffect(() => {
    const opts = activeTab === '__saved' ? { onlySaved: true } : { categorie: activeTab }
    fetchItems(opts)
  }, [activeTab])

  const handleOpen = useCallback(async (item) => {
    setSelectedItem(item)
    if (!item.est_lu) markLu(item.id)
  }, [markLu])

  const handleGenerateSummary = useCallback(async (itemId) => {
    setGenerating(true)
    const result = await generateSummary(itemId)
    if (result?.resume_ia) setSelectedItem(prev => prev ? { ...prev, ...result } : prev)
    setGenerating(false)
  }, [generateSummary])

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const tabKey = k => k === '__saved' ? '__saved' : k

  return (
    <div style={{ minHeight: '100vh', background: V.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>

      {/* Header sticky */}
      <div style={{ background: V.headerBg, borderBottom: `1px solid ${V.border}`, padding: '16px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: V.textSoft, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>{today}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: V.text, letterSpacing: '-0.02em' }}>
              📡 Veille CEE
              {newCount > 0 && (
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, background: V.arrete, color: '#fff', borderRadius: 10, padding: '2px 8px' }}>
                  {newCount} nouveau{newCount > 1 ? 'x' : ''}
                </span>
              )}
            </div>
          </div>
          <button onClick={triggerFetch} disabled={fetching} title="Actualiser les sources"
            style={{ background: fetching ? V.border : V.btnBg, border: `1px solid ${V.border}`, color: V.textMid, borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: fetching ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            {fetching ? '⏳' : '🔄'} {fetching ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* Tabs filtres sticky */}
      <div style={{ background: V.headerBg, borderBottom: `1px solid ${V.border}`, overflowX: 'auto', position: 'sticky', top: 72, zIndex: 99 }}>
        <div style={{ display: 'flex', gap: 2, padding: '0 16px', maxWidth: 680, margin: '0 auto', minWidth: 'max-content' }}>
          {TABS.map(tab => {
            const k = tabKey(tab.key)
            const active = activeTab === k
            return (
              <button key={k || 'all'} onClick={() => setActiveTab(k)}
                style={{ background: 'none', border: 'none', borderBottom: active ? `2px solid ${V.text}` : '2px solid transparent', color: active ? V.text : V.textSoft, padding: '12px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'color .15s' }}>
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Feed */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 12px 80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: V.textSoft }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Chargement…</div>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, color: V.textMid, marginBottom: 8 }}>Aucun article pour l'instant</div>
            <div style={{ fontSize: 13, color: V.textSoft, marginBottom: 20 }}>Lance une première actualisation pour charger les sources</div>
            <button onClick={triggerFetch} disabled={fetching}
              style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {fetching ? '⏳ Chargement…' : '🔄 Charger les actualités'}
            </button>
          </div>
        ) : (
          items.map(item =>
            item.source_categorie === 'arrete' ? (
              <ArreteCard key={item.id} item={item} dossierFiches={dossierFiches} onOpen={handleOpen} onToggleSave={toggleSauvegarde} V={V} />
            ) : (
              <ItemCard key={item.id} item={item} onOpen={handleOpen} onToggleSave={toggleSauvegarde} V={V} />
            )
          )
        )}
      </div>

      {selectedItem && (
        <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} onGenerateSummary={handleGenerateSummary} dossierFiches={dossierFiches} generating={generating} V={V} />
      )}
    </div>
  )
}
