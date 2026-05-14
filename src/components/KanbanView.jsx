import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const COLS = [
  { id: 'simulation',       label: 'Simulation',        color: '#7C3AED' },
  { id: 'prospect',         label: 'Prospect',           color: '#0369A1' },
  { id: 'contacte',         label: 'Contacté',           color: '#0891B2' },
  { id: 'visio_planifiee',  label: 'Visio planifiée',    color: '#0D9488' },
  { id: 'visio_effectuee',  label: 'Visio effectuée',    color: '#059669' },
  { id: 'visite_planifiee', label: 'Visite planifiée',   color: '#D97706' },
  { id: 'visite_effectuee', label: 'Visite effectuée',   color: '#EA580C' },
  { id: 'devis',            label: 'Devis envoyé',       color: '#7C3AED' },
  { id: 'ah',               label: 'AH signé',           color: '#16A34A' },
  { id: 'conforme',         label: 'Conforme',           color: '#15803D' },
  { id: 'facture',          label: 'Facturé',            color: '#64748B' },
]

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

const fmtK = (n) => {
  if (!n || isNaN(n) || n === 0) return null
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' M€'
  if (n >= 1_000) return Math.round(n / 1_000) + ' k€'
  return Math.round(n) + ' €'
}

function daysSince(d) { return Math.floor((Date.now() - new Date(d)) / 86400000) }

export default function KanbanView({ dossiers, onStatutChange, profiles, isAdmin }) {
  const navigate = useNavigate()
  const [draggingId,  setDraggingId]  = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)

  const profileName = (id) => {
    const p = (profiles || []).find(p => p.id === id)
    return p ? `${p.prenom || ''} ${p.nom || ''}`.trim() : null
  }

  const byCol = Object.fromEntries(COLS.map(c => [c.id, dossiers.filter(d => d.statut === c.id)]))

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
      <div style={{ display: 'flex', gap: 10, minWidth: 'max-content', alignItems: 'flex-start' }}>
        {COLS.map(col => {
          const cards = byCol[col.id] || []
          const isOver = dragOverCol === col.id
          return (
            <div
              key={col.id}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.id) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null) }}
              onDrop={e => {
                e.preventDefault()
                const id = e.dataTransfer.getData('dossier_id')
                const src = e.dataTransfer.getData('from_statut')
                if (id && src !== col.id) onStatutChange(id, col.id)
                setDraggingId(null); setDragOverCol(null)
              }}
              style={{
                width: 220,
                flexShrink: 0,
                background: isOver ? col.color + '14' : C.bg,
                border: `2px dashed ${isOver ? col.color : 'transparent'}`,
                borderRadius: 10,
                padding: '8px 6px',
                minHeight: 120,
                transition: 'all .15s',
              }}
            >
              {/* Header colonne */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 4px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '.05em', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {col.label}
                </span>
                {cards.length > 0 && (
                  <span style={{ background: col.color, color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    {cards.length}
                  </span>
                )}
              </div>

              {/* Cartes */}
              {cards.map(d => {
                const jPlus    = daysSince(d.created_at)
                const prime    = d.prime_estimee
                const stagnant = daysSince(d.updated_at) > 14
                const isDragging = draggingId === d.id
                return (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('dossier_id', d.id)
                      e.dataTransfer.setData('from_statut', d.statut)
                      e.dataTransfer.effectAllowed = 'move'
                      setDraggingId(d.id)
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                    onClick={() => navigate(`/dossier/${d.id}`)}
                    style={{
                      background: C.surface,
                      border: `1px solid ${stagnant ? '#FDE047' : C.border}`,
                      borderLeft: `3px solid ${stagnant ? '#D97706' : col.color}`,
                      borderRadius: 8,
                      padding: '10px 11px',
                      marginBottom: 6,
                      cursor: isDragging ? 'grabbing' : 'grab',
                      opacity: isDragging ? 0.35 : 1,
                      transition: 'opacity .12s, box-shadow .12s',
                      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                      userSelect: 'none',
                    }}
                    onMouseEnter={e => { if (!isDragging) e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.13)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)' }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.prospects?.raison_sociale || '—'}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: C.accent, fontWeight: 700, marginBottom: d.fiche_cee ? 5 : 3 }}>
                      {d.ref}
                    </div>
                    {d.fiche_cee && (
                      <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '1px 6px', borderRadius: 4, marginBottom: 5 }}>
                        {d.fiche_cee}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {prime > 0
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED' }}>{fmtK(prime)}</span>
                        : <span />
                      }
                      <span style={{
                        fontSize: 10,
                        color: jPlus > 14 ? '#DC2626' : jPlus > 7 ? '#D97706' : C.textSoft,
                        fontWeight: jPlus > 7 ? 700 : 400,
                      }}>
                        J+{jPlus}
                      </span>
                    </div>
                    {isAdmin && profileName(d.assigne_a) && (
                      <div style={{ fontSize: 10, color: C.textSoft, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        👤 {profileName(d.assigne_a)}
                      </div>
                    )}
                    {stagnant && (
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#D97706', marginTop: 3 }}>
                        ⏳ {daysSince(d.updated_at)}j sans activité
                      </div>
                    )}
                  </div>
                )
              })}

              {cards.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 8px', color: C.textSoft, fontSize: 11, borderRadius: 6 }}>
                  Vide
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
