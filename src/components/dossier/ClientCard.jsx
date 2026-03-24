import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'
import CadastreMap from '../CadastreMap'
import { C, Field, InfoRow } from './theme'

export default function ClientCard({ dossier, dossierId, adresseSiteInit, onSaved }) {
  const { updateProspect } = useStore()

  const [editing, setEditing] = useState(false)
  const [pForm, setPForm] = useState(dossier.prospects || {})
  const setP = (k, v) => setPForm(f => ({ ...f, [k]: v }))

  const [adresseSite, setAdresseSite] = useState(adresseSiteInit || '')
  const [adresseLabel, setAdresseLabel] = useState(adresseSiteInit || '')
  const [adresseForm, setAdresseForm] = useState(adresseSiteInit || '')
  const [adresseSugg, setAdresseSugg] = useState([])
  const timerRef = useRef(null)

  const searchAdresse = (q) => {
    setAdresseLabel(q); setAdresseForm(q)
    clearTimeout(timerRef.current)
    if (q.length < 3) { setAdresseSugg([]); return }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`)
        const data = await res.json()
        setAdresseSugg(data.features || [])
      } catch { setAdresseSugg([]) }
    }, 300)
  }

  const buildLabel = (feat) => {
    const p = feat.properties
    const num = adresseLabel.match(/^(\d+[a-zA-Z]?)/)?.[1]
    if (num && p.type !== 'housenumber' && !p.label.startsWith(num)) return num + ' ' + p.label
    return p.label || ''
  }

  const selectAdresse = (feat) => {
    const label = buildLabel(feat)
    setAdresseForm(label); setAdresseLabel(label); setAdresseSugg([])
  }

  const save = async () => {
    const { raison_sociale, siret, adresse, code_postal, ville, contact_nom, contact_email, contact_tel } = pForm
    const [prospectData] = await Promise.all([
      updateProspect(dossier.prospects.id, { raison_sociale, siret, adresse, code_postal, ville, contact_nom, contact_email, contact_tel }),
      adresseForm
        ? supabase.from('dossiers').update({ adresse_site: adresseForm }).eq('id', dossierId)
        : Promise.resolve(),
    ])
    if (adresseForm) setAdresseSite(adresseForm)
    setEditing(false)
    onSaved?.(prospectData, adresseForm || adresseSite)
  }

  const p = dossier.prospects || {}

  return (
    <>
      {/* Client info card */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Informations client</span>
          {!editing
            ? <button onClick={() => setEditing(true)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Modifier</button>
            : <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditing(false)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                <button onClick={save} style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Enregistrer</button>
              </div>
          }
        </div>

        {editing ? (
          <>
            <Field label="Raison sociale" value={pForm.raison_sociale} onChange={v => setP('raison_sociale', v)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <Field label="SIRET" value={pForm.siret} onChange={v => setP('siret', v)} />
              <Field label="Ville" value={pForm.ville} onChange={v => setP('ville', v)} />
              <div style={{ gridColumn: '1/-1' }}><Field label="Adresse" value={pForm.adresse} onChange={v => setP('adresse', v)} /></div>
              <Field label="Code postal" value={pForm.code_postal} onChange={v => setP('code_postal', v)} />
            </div>

            {/* Adresse site autocomplete */}
            <div style={{ position: 'relative', margin: '10px 0 4px' }}>
              <div style={{ height: 1, background: C.border, marginBottom: 10 }} />
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textMid, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .4 }}>
                Adresse du site
                <span style={{ marginLeft: 6, fontSize: 10, color: C.accent, fontWeight: 400, textTransform: 'none' }}>autocomplétion</span>
              </label>
              <input value={adresseLabel} onChange={e => searchAdresse(e.target.value)}
                onBlur={() => setTimeout(() => setAdresseSugg([]), 350)}
                placeholder="771 Rue de la Plaine, 59553 Lauwin-Planque…"
                style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              {adresseSugg.length > 0 && (
                <div onMouseDown={e => e.preventDefault()}
                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
                  {adresseSugg.map((f, i) => (
                    <div key={i} onClick={() => selectAdresse(f)} onTouchEnd={e => { e.preventDefault(); selectAdresse(f) }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text }}
                      onMouseEnter={e => e.currentTarget.style.background = C.bg}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {buildLabel(f)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ height: 1, background: C.border, margin: '10px 0' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <Field label="Contact" value={pForm.contact_nom} onChange={v => setP('contact_nom', v)} />
              <Field label="Téléphone" value={pForm.contact_tel} onChange={v => setP('contact_tel', v)} />
              <div style={{ gridColumn: '1/-1' }}><Field label="Email" value={pForm.contact_email} onChange={v => setP('contact_email', v)} type="email" /></div>
            </div>
          </>
        ) : (
          <div>
            <InfoRow label="Raison sociale" value={p.raison_sociale} />
            <InfoRow label="SIRET" value={p.siret} />
            <InfoRow label="Adresse société" value={[p.adresse, p.code_postal, p.ville].filter(Boolean).join(', ') || null} />
            {adresseSite && (
              <>
                <div style={{ height: 1, background: C.border, margin: '8px 0' }} />
                <InfoRow label="Adresse site" value={adresseSite} color={C.accent} />
              </>
            )}
            <div style={{ height: 1, background: C.border, margin: '8px 0' }} />
            <InfoRow label="Contact" value={p.contact_nom} />
            <InfoRow label="Email" value={p.contact_email} />
            <InfoRow label="Tél" value={p.contact_tel} />
          </div>
        )}
      </div>

      {/* Cadastre */}
      <CadastreMap
        dossierId={dossierId}
        adresse={adresseLabel || adresseSite || [p.adresse, p.code_postal, p.ville].filter(Boolean).join(', ')}
        siret={p.siret}
        raisonSociale={p.raison_sociale}
      />
    </>
  )
}
