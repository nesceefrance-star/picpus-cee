import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'
import { C } from './theme'

export default function HistoriqueTab({ dossierId }) {
  const { profiles } = useStore()
  const [activites, setActivites] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [dossierId])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('activites').select('*').eq('dossier_id', dossierId).order('created_at', { ascending: false }).limit(50)
    setActivites(data || [])
    setLoading(false)
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>📋 Historique des activités</span>
        <button onClick={load} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>↻ Actualiser</button>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: C.textSoft, fontSize: 13, padding: '20px 0' }}>Chargement…</div>
      ) : activites.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.textSoft, fontSize: 13, padding: '20px 0' }}>Aucune activité enregistrée.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activites.map(a => {
            const TYPE_ICON = { note: '📝', appel: '📞', email: '✉️', rdv: '📅', statut: '🔄', document: '📎', devis: '📄' }
            const auteur = profiles.find(p => p.user_id === a.user_id || p.id === a.user_id)
            return (
              <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 16, flexShrink: 0, lineHeight: '20px' }}>{TYPE_ICON[a.type] || '·'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text }}>{a.contenu}</div>
                  <div style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }}>
                    {auteur ? `${auteur.prenom || ''} ${auteur.nom || ''}`.trim() || 'Utilisateur' : 'Utilisateur'}
                    {' · '}
                    {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
