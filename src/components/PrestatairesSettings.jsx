// src/components/PrestatairesSettings.jsx
// Gestion des prestataires CEE (sous-traitants / poseurs)
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const D = {
  bg: '#0F172A', surface: '#1E293B', border: '#334155',
  text: '#F8FAFC', textMid: '#94A3B8', textSoft: '#64748B',
  accent: '#3B82F6', green: '#22C55E', red: '#EF4444',
}

const F = { width: '100%', boxSizing: 'border-box', background: '#0F172A', border: `1px solid ${D.border}`, borderRadius: 7, padding: '9px 12px', color: D.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }
const L = { display: 'block', fontSize: 11, fontWeight: 600, color: D.textMid, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }

const EMPTY = { nom: '', info_legal: '', rge_num: '', rge_validite: '', structure_devis: 'standard' }

export default function PrestatairesSettings() {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // null | {id, ...fields} | 'new'
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState(EMPTY)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('prestataires').select('*').order('nom')
    if (data) setList(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => { setForm(EMPTY); setEditing('new') }
  const openEdit = (p) => { setForm({ nom: p.nom, info_legal: p.info_legal || '', rge_num: p.rge_num || '', rge_validite: p.rge_validite || '', structure_devis: p.structure_devis || 'standard' }); setEditing(p.id) }
  const cancel = () => { setEditing(null); setForm(EMPTY) }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.nom.trim()) return
    setSaving(true)
    const payload = { nom: form.nom.trim(), info_legal: form.info_legal, rge_num: form.rge_num, rge_validite: form.rge_validite, structure_devis: form.structure_devis, updated_at: new Date().toISOString() }
    if (editing === 'new') {
      await supabase.from('prestataires').insert(payload)
    } else {
      await supabase.from('prestataires').update(payload).eq('id', editing)
    }
    setSaving(false)
    setEditing(null)
    setForm(EMPTY)
    load()
  }

  const del = async (id) => {
    if (!confirm('Supprimer ce prestataire ?')) return
    await supabase.from('prestataires').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: D.text }}>🏗 Prestataires / Sous-traitants</div>
          <div style={{ fontSize: 12, color: D.textSoft, marginTop: 2 }}>Gérez vos prestataires CEE. Les infos sont disponibles dans la création de devis et les visites techniques.</div>
        </div>
        <button onClick={openNew} style={{ background: D.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          ＋ Nouveau
        </button>
      </div>

      {/* Formulaire création / édition */}
      {editing !== null && (
        <div style={{ background: D.surface, border: `1px solid ${D.accent}`, borderRadius: 10, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: D.text, marginBottom: 14 }}>
            {editing === 'new' ? '➕ Nouveau prestataire' : '✏️ Modifier le prestataire'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={L}>Nom *</label>
              <input value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="OPEN GTC, DC LINK…" style={F} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={L}>Info légale (affiché dans «&nbsp;Posé par&nbsp;» du devis)</label>
              <input value={form.info_legal} onChange={e => set('info_legal', e.target.value)} placeholder="SARL OPEN GTC — SIRET 825 230 345 00027 — Code APE : 4321A" style={F} />
            </div>
            <div>
              <label style={L}>N° RGE</label>
              <input value={form.rge_num} onChange={e => set('rge_num', e.target.value)} placeholder="AU 084 742" style={F} />
            </div>
            <div>
              <label style={L}>RGE valable jusqu'au</label>
              <input value={form.rge_validite} onChange={e => set('rge_validite', e.target.value)} placeholder="31/12/2026" style={F} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={L}>Structure des devis</label>
              <select value={form.structure_devis} onChange={e => set('structure_devis', e.target.value)}
                style={{ ...F, appearance: 'auto' }}>
                <option value="standard">Standard — par catégories (Matériel / Main d'œuvre / Divers) — Haiku</option>
                <option value="par_sections">Par tranches / sections (ex : OPEN GTC, GTB multi-lots) — Sonnet</option>
              </select>
              <div style={{ fontSize: 11, color: D.textSoft, marginTop: 5, lineHeight: 1.6 }}>
                {form.structure_devis === 'par_sections'
                  ? '✨ Sonnet sera utilisé pour l\'extraction — meilleure précision sur les PDFs multi-pages avec titres de tranches.'
                  : '⚡ Haiku sera utilisé — rapide et économique pour les devis simples.'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={cancel} style={{ flex: 1, padding: '9px', background: 'transparent', border: `1px solid ${D.border}`, color: D.textMid, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
            <button onClick={save} disabled={saving || !form.nom.trim()} style={{ flex: 2, padding: '9px', background: saving ? '#475569' : D.accent, border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? '⏳ Enregistrement…' : '💾 Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div style={{ color: D.textSoft, fontSize: 13, textAlign: 'center', padding: 24 }}>Chargement…</div>
      ) : list.length === 0 ? (
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: 24, textAlign: 'center', color: D.textSoft, fontSize: 13 }}>
          Aucun prestataire. Cliquez sur «&nbsp;＋ Nouveau&nbsp;» pour en ajouter un.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(p => (
            <div key={p.id} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: D.text }}>{p.nom}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: p.structure_devis === 'par_sections' ? '#1e3a6e' : '#1a2f1a',
                    color: p.structure_devis === 'par_sections' ? '#60A5FA' : '#4ade80' }}>
                    {p.structure_devis === 'par_sections' ? 'Sonnet · Par tranches' : 'Haiku · Standard'}
                  </span>
                </div>
                {p.info_legal && <div style={{ fontSize: 12, color: D.textSoft, marginBottom: 2 }}>{p.info_legal}</div>}
                {(p.rge_num || p.rge_validite) && (
                  <div style={{ fontSize: 11, color: D.textMid }}>
                    RGE {p.rge_num || '—'}{p.rge_validite ? ` · valable ${p.rge_validite}` : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(p)} style={{ background: 'transparent', border: `1px solid ${D.border}`, color: D.textMid, borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✏️</button>
                <button onClick={() => del(p.id)} style={{ background: 'transparent', border: `1px solid #7f1d1d`, color: D.red, borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
