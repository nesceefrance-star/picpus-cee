import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

import { FICHES_CEE } from './VisiteTechniqueDetail'

function StatutBadge({ statut }) {
  const cfg = statut === 'validée'
    ? { bg: '#DCFCE7', color: '#15803D', label: '✓ Validée' }
    : { bg: '#FEF3C7', color: '#D97706', label: '✏ Brouillon' }
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

export default function VisitesTechniques() {
  const navigate   = useNavigate()
  const { profile } = useStore()
  const [visites,   setVisites]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterStatut, setFilterStatut] = useState('')

  useEffect(() => {
    if (!profile) return
    loadVisites()
  }, [profile?.id])

  const loadVisites = async () => {
    setLoading(true)
    let query = supabase
      .from('visites_techniques')
      .select('id, created_at, updated_at, statut, type_fiche, donnees, photos, dossier_id')
      .order('updated_at', { ascending: false })
    if (profile?.role !== 'admin') query = query.eq('assigne_a', profile.id)
    const { data: vData } = await query
    if (!vData?.length) { setVisites([]); setLoading(false); return }

    // Charge les dossiers liés + leurs prospects séparément
    const dossierIds = [...new Set(vData.map(v => v.dossier_id).filter(Boolean))]
    let dossierMap = {}
    if (dossierIds.length) {
      const { data: dos } = await supabase.from('dossiers')
        .select('id, ref, prospect_id').in('id', dossierIds)
      const prospectIds = [...new Set((dos || []).map(d => d.prospect_id).filter(Boolean))]
      let prospectMap = {}
      if (prospectIds.length) {
        const { data: pros } = await supabase.from('prospects')
          .select('id, raison_sociale').in('id', prospectIds)
        ;(pros || []).forEach(p => { prospectMap[p.id] = p.raison_sociale })
      }
      ;(dos || []).forEach(d => {
        dossierMap[d.id] = { ref: d.ref, prospects: { raison_sociale: prospectMap[d.prospect_id] || '' } }
      })
    }
    setVisites(vData.map(v => ({ ...v, dossiers: dossierMap[v.dossier_id] || null })))
    setLoading(false)
  }

  const handleNew = async () => {
    navigate('/visites/new')
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Supprimer cette visite ? Les photos associées seront conservées dans le stockage.')) return
    await supabase.from('visites_techniques').delete().eq('id', id)
    setVisites(v => v.filter(x => x.id !== id))
  }

  const filtered = visites.filter(v => {
    const nom = v.donnees?.nom_site || v.donnees?.raison_sociale || v.dossiers?.prospects?.raison_sociale || ''
    const matchSearch = !search || nom.toLowerCase().includes(search.toLowerCase()) || v.dossiers?.ref?.toLowerCase().includes(search.toLowerCase())
    const matchStatut = !filterStatut || v.statut === filterStatut
    return matchSearch && matchStatut
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>Visites techniques</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textSoft }}>{visites.length} visite{visites.length !== 1 ? 's' : ''} au total</p>
        </div>
        <button
          onClick={handleNew}
          style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Nouvelle visite
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher un site, un dossier…"
          style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', fontSize: 13, color: C.text, outline: 'none', fontFamily: 'inherit' }}
        />
        <select
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value)}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', fontSize: 13, color: C.text, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          <option value="">Tous les statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="validée">Validée</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', color: C.textSoft, padding: 40 }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.textSoft, padding: 60 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucune visite trouvée</div>
          <div style={{ fontSize: 13 }}>Créez une nouvelle visite technique pour commencer.</div>
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* Entêtes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px 80px 80px 44px', gap: 0, background: C.bg, borderBottom: `1px solid ${C.border}`, padding: '10px 18px', fontSize: 11, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Site / Dossier</span>
            <span>Fiche CEE</span>
            <span>Statut</span>
            <span>Photos</span>
            <span>Mise à jour</span>
            <span />
          </div>

          {filtered.map((v, i) => {
            const nom = v.donnees?.nom_site || v.donnees?.raison_sociale || v.dossiers?.prospects?.raison_sociale || 'Sans nom'
            const updatedAt = new Date(v.updated_at).toLocaleDateString('fr-FR')
            return (
              <div
                key={v.id}
                onClick={() => navigate(`/visites/${v.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 130px 100px 80px 80px 44px',
                  gap: 0, padding: '13px 18px', cursor: 'pointer',
                  borderBottom: i < filtered.length - 1 ? `1px solid ${C.bg}` : 'none',
                  alignItems: 'center',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{nom}</div>
                  {v.donnees?.adresse_site && <div style={{ fontSize: 11, color: C.textSoft, marginTop: 1 }}>{v.donnees.adresse_site}</div>}
                  {v.dossiers?.ref && <div style={{ fontSize: 11, color: C.accent, marginTop: 1 }}>📁 {v.dossiers.ref}</div>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(v.donnees?.fiches?.length ? v.donnees.fiches : [v.type_fiche].filter(Boolean)).map(f => (
                    <span key={f} style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                      {f}
                    </span>
                  ))}
                </div>
                <StatutBadge statut={v.statut} />
                <span style={{ fontSize: 12, color: C.textMid }}>
                  {(v.photos || []).length} 📷
                </span>
                <span style={{ fontSize: 12, color: C.textSoft }}>{updatedAt}</span>
                <button
                  onClick={e => handleDelete(e, v.id)}
                  style={{ background: 'transparent', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 15, padding: 4 }}
                  title="Supprimer"
                >🗑</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
