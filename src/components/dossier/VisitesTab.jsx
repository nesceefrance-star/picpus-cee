import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { C } from './theme'

export default function VisitesTab({ dossierId, dossierRaisonSociale, onCountChange }) {
  const navigate = useNavigate()
  const [visites, setVisites] = useState([])
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => { load() }, [dossierId])

  const load = async () => {
    const { data } = await supabase
      .from('visites_techniques')
      .select('id, type_fiche, statut, donnees, photos, rapport_url, created_at, updated_at')
      .eq('dossier_id', dossierId)
      .order('created_at', { ascending: false })
    const list = data || []
    setVisites(list)
    onCountChange?.(list.length)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {visites.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🔧</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid, marginBottom: 8 }}>Aucune visite technique liée</div>
          <button onClick={() => navigate(`/visites/new?dossier=${dossierId}`)}
            style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Créer une visite technique
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => navigate(`/visites/new?dossier=${dossierId}`)}
              style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Nouvelle visite
            </button>
          </div>
          {visites.map(v => {
            const photos = v.photos || []
            const nom = v.donnees?.nom_site || v.donnees?.raison_sociale || dossierRaisonSociale || ''
            const date = new Date(v.updated_at).toLocaleDateString('fr-FR')
            const statutCfg = v.statut === 'validée'
              ? { bg: '#DCFCE7', color: '#15803D', label: '✓ Validée' }
              : { bg: '#FEF3C7', color: '#D97706', label: '✏ Brouillon' }
            return (
              <div key={v.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${C.bg}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{nom || 'Visite technique'}</div>
                    <div style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }}>Mise à jour le {date} · {photos.length} photo{photos.length !== 1 ? 's' : ''}</div>
                  </div>
                  <span style={{ background: '#EFF6FF', color: '#1D4ED8', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{v.type_fiche}</span>
                  <span style={{ background: statutCfg.bg, color: statutCfg.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{statutCfg.label}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {v.rapport_url && (
                      <a href={v.rapport_url} target="_blank" rel="noopener noreferrer"
                        style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        📄 PDF
                      </a>
                    )}
                    <button onClick={() => navigate(`/visites/${v.id}`)}
                      style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      Ouvrir →
                    </button>
                  </div>
                </div>
                {photos.length > 0 && (
                  <div style={{ padding: '14px 18px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.textMid, marginBottom: 10 }}>Photos ({photos.length})</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
                      {photos.map(photo => (
                        <div key={photo.id} style={{ position: 'relative', borderRadius: 7, overflow: 'hidden', aspectRatio: '1', background: C.bg, cursor: 'pointer' }}
                          onClick={() => setLightbox({ url: photo.url, label: photo.nom })}>
                          <img src={photo.url} alt={photo.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {photo.categorie && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 9, padding: '2px 4px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {photo.categorie.replace(/_/g, ' ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={lightbox.url} alt={lightbox.label} style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
          <button onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  )
}
