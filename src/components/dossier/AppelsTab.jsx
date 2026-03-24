import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'
import { C } from './theme'

const APPEL_ETAT_LABELS = { nrp: 'NRP', rappel: 'À rappeler', joint: 'Joint', message_laisse: 'Message laissé' }
const ETATS_CFG = {
  nrp:            { l: 'NRP',            col: '#DC2626', bg: '#FEE2E2' },
  message_laisse: { l: 'Message laissé', col: '#D97706', bg: '#FEF3C7' },
  rappel:         { l: 'À rappeler',     col: '#0891B2', bg: '#CFFAFE' },
  joint:          { l: 'Contacté',       col: '#16A34A', bg: '#DCFCE7' },
}

export default function AppelsTab({ dossierId, onCountChange }) {
  const { user, logActivite } = useStore()
  const [appels, setAppels] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [etat, setEtat] = useState('nrp')
  const [rappelAt, setRappelAt] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [dossierId])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('appels').select('*').eq('dossier_id', dossierId).order('created_at', { ascending: false })
    const list = data || []
    setAppels(list)
    onCountChange?.(list.length)
    setLoading(false)
  }

  const add = async () => {
    setSaving(true)
    await supabase.from('appels').insert({ dossier_id: dossierId, user_id: user?.id, etat, rappel_at: rappelAt || null, note: note || null })
    await logActivite(dossierId, 'appel', `Appel — ${APPEL_ETAT_LABELS[etat] || etat}${note ? ` — ${note}` : ''}`)
    setShowForm(false); setEtat('nrp'); setRappelAt(''); setNote('')
    setSaving(false)
    load()
  }

  const del = async (appelId) => {
    await supabase.from('appels').delete().eq('id', appelId)
    setAppels(a => { const n = a.filter(x => x.id !== appelId); onCountChange?.(n.length); return n })
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>📞 Suivi des appels</span>
        <button onClick={() => setShowForm(s => !s)}
          style={{ background: showForm ? C.bg : C.accent, border: `1px solid ${showForm ? C.border : C.accent}`, color: showForm ? C.textMid : '#fff', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
          {showForm ? 'Annuler' : '+ Nouvel appel'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px', marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .4 }}>Résultat de l'appel</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { v: 'nrp',            l: 'NRP',            col: '#DC2626', bg: '#FEE2E2' },
                { v: 'message_laisse', l: 'Message laissé', col: '#D97706', bg: '#FEF3C7' },
                { v: 'rappel',         l: 'À rappeler',     col: '#0891B2', bg: '#CFFAFE' },
                { v: 'joint',          l: 'Contacté',       col: '#16A34A', bg: '#DCFCE7' },
              ].map(o => (
                <button key={o.v} onClick={() => setEtat(o.v)}
                  style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: etat === o.v ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${etat === o.v ? o.col : C.border}`,
                    background: etat === o.v ? o.bg : C.surface,
                    color: etat === o.v ? o.col : C.textMid }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          {etat === 'rappel' && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>Date & heure de rappel</label>
              <input type="datetime-local" value={rappelAt} onChange={e => setRappelAt(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', fontSize: 13, color: C.text, outline: 'none', fontFamily: 'inherit' }} />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>Note (optionnel)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ex : répondeur, message laissé à la secrétaire…"
              style={{ width: '100%', boxSizing: 'border-box', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', fontSize: 13, color: C.text, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <button onClick={add} disabled={saving}
            style={{ width: '100%', padding: '9px', background: C.accent, border: 'none', color: '#fff', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? .6 : 1 }}>
            {saving ? '…' : "Enregistrer l'appel"}
          </button>
        </div>
      )}

      {appels.length > 0 && (() => {
        const last = appels[0]
        const days = Math.floor((Date.now() - new Date(last.created_at).getTime()) / 86400000)
        const ETATS = { nrp: 'NRP', message_laisse: 'Message laissé', rappel: 'À rappeler', joint: 'Contacté' }
        return (
          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 7, padding: '9px 14px', marginBottom: 14, fontSize: 12, color: '#15803D', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>Dernier appel :</span>
            <span>{days === 0 ? "Aujourd'hui" : days === 1 ? 'Hier' : `il y a ${days} jour${days > 1 ? 's' : ''}`}</span>
            <span>—</span>
            <span>{ETATS[last.etat] || last.etat}</span>
            {last.rappel_at && (
              <span style={{ color: '#0891B2', fontWeight: 600 }}>
                · Rappel le {new Date(last.rappel_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {new Date(last.rappel_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )
      })()}

      {loading ? (
        <div style={{ textAlign: 'center', color: C.textSoft, fontSize: 13, padding: '20px 0' }}>Chargement…</div>
      ) : appels.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.textSoft, fontSize: 13, padding: '20px 0' }}>Aucun appel enregistré pour ce dossier.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {appels.map((a, idx) => {
            const et = ETATS_CFG[a.etat] || { l: a.etat, col: C.textMid, bg: C.bg }
            const dateStr = new Date(a.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
            const daysAgo = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000)
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: idx === 0 ? C.surface : C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: et.bg, color: et.col, flexShrink: 0, marginTop: 1 }}>{et.l}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: C.textMid }}>
                    {dateStr}
                    <span style={{ fontSize: 10, color: C.textSoft, marginLeft: 8 }}>({daysAgo === 0 ? "aujourd'hui" : daysAgo === 1 ? 'hier' : `il y a ${daysAgo}j`})</span>
                  </div>
                  {a.rappel_at && (
                    <div style={{ fontSize: 12, color: '#0891B2', marginTop: 3, fontWeight: 600 }}>
                      📅 Rappeler le {new Date(a.rappel_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {new Date(a.rappel_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  {a.note && <div style={{ fontSize: 12, color: C.text, marginTop: 3, fontStyle: 'italic' }}>"{a.note}"</div>}
                </div>
                <button onClick={() => del(a.id)}
                  style={{ background: 'transparent', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: '0 2px' }}>×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
