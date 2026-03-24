import { useEffect, useRef, useState } from 'react'
import CalendarPicker from '../CalendarPicker'
import useStore from '../../store/useStore'
import { C } from './theme'

export default function VisioTab({ dossierId, dossier, session, activeTab, initEmails, initAddress, initLink }) {
  const { updateDossier, logActivite } = useStore()
  const addressInputRef = useRef(null)

  const [provider, setProvider] = useState('meet')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(45)
  const [visiteDuration, setVisiteDuration] = useState(60)
  const [emails, setEmails] = useState(initEmails || '')
  const [linkInput, setLinkInput] = useState(initLink || '')
  const [link, setLink] = useState(initLink || '')
  const [savingLink, setSavingLink] = useState(false)
  const [linkSaved, setLinkSaved] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [visiteAddress, setVisiteAddress] = useState(initAddress || '')
  const [visiteInvit, setVisiteInvit] = useState('place') // 'place' | 'meet' | 'teams'
  const [visiteCreating, setVisiteCreating] = useState(false)
  const [visiteCreated, setVisiteCreated] = useState(false)
  const [visiteError, setVisiteError] = useState(null)

  // Google Places pour adresse visite
  useEffect(() => {
    if (activeTab !== 'visio' || provider !== 'visite' || !addressInputRef.current) return
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) return
    const attach = () => {
      if (!window.google?.maps?.places || !addressInputRef.current) return
      const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ['address'], componentRestrictions: { country: 'fr' },
      })
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (place.formatted_address) setVisiteAddress(place.formatted_address)
      })
    }
    if (window.google?.maps?.places) { attach(); return }
    if (document.querySelector(`script[src*="maps.googleapis.com"]`)) return
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    s.async = true; s.onload = attach
    document.head.appendChild(s)
  }, [activeTab, provider])

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📹 Visio</div>

      {/* Provider selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[
          { id: 'meet',   label: '🟢 Google Meet',     a: '#16A34A', bg: '#F0FDF4', t: '#15803D' },
          { id: 'teams',  label: '🟣 Teams',            a: '#5B5EA6', bg: '#EDEDFF', t: '#5B5EA6' },
          { id: 'visite', label: '🔧 Visite technique', a: '#D97706', bg: '#FFFBEB', t: '#92400E' },
        ].map(p => {
          const sel = provider === p.id
          return (
            <button key={p.id} onClick={() => setProvider(p.id)}
              style={{ flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: sel ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${sel ? p.a : C.border}`, background: sel ? p.bg : C.bg, color: sel ? p.t : C.textMid }}>
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Calendar */}
      <div style={{ marginBottom: 10 }}>
        <CalendarPicker session={session} selectedDate={date} selectedTime={time}
          onSelect={(d, t) => { setDate(d); setTime(t) }}
          duration={provider === 'visite' ? visiteDuration : 30} />
      </div>

      {date && time && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: '#EFF6FF', border: `1px solid ${C.accent}`, borderRadius: 7, padding: '7px 12px' }}>
          <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>
            📅 {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {time.replace(':', 'h')}
          </span>
          <button onClick={() => { setDate(''); setTime('') }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.textSoft, cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
        </div>
      )}

      {/* Durée */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 3 }}>Durée</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {provider === 'visite'
            ? [[60,'1h'],[90,'1h30'],[120,'2h'],[180,'3h'],[240,'4h']].map(([d, lbl]) => (
              <button key={d} onClick={() => setVisiteDuration(d)}
                style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: visiteDuration === d ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${visiteDuration === d ? '#D97706' : C.border}`, background: visiteDuration === d ? '#FFFBEB' : C.bg, color: visiteDuration === d ? '#92400E' : C.textMid }}>
                {lbl}
              </button>
            ))
            : [30, 45, 60, 90].map(d => (
              <button key={d} onClick={() => setDuration(d)}
                style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: duration === d ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${duration === d ? C.accent : C.border}`, background: duration === d ? '#EFF6FF' : C.bg, color: duration === d ? C.accent : C.textMid }}>
                {d < 60 ? `${d}min` : `${d / 60}h`}
              </button>
            ))
          }
        </div>
      </div>

      {/* Participants */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 3 }}>Participants (séparés par des virgules)</div>
        <textarea value={emails} onChange={e => setEmails(e.target.value)} rows={2}
          placeholder="client@exemple.com, collègue@picpus.fr"
          style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '7px 10px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'none', lineHeight: 1.5 }} />
      </div>

      {/* Google Meet */}
      {provider === 'meet' && (
        <button
          onClick={async () => {
            setCreating(true); setError(null)
            try {
              const start = new Date(`${date}T${time}:00`)
              const end   = new Date(start.getTime() + duration * 60000)
              const r = await fetch('/api/calendar?action=meet', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: `RDV ${dossier.prospects?.raison_sociale || 'Client'} — SOFT.IA`, startDateTime: start.toISOString(), endDateTime: end.toISOString(), emails: emails.split(',').map(e => e.trim()).filter(Boolean) }),
              })
              const d = await r.json()
              if (d.error === 'scope_missing') throw new Error('Scope manquant — reconnecte ton compte Google dans les paramètres')
              if (d.error) throw new Error(d.error)
              setLinkInput(d.meetLink); setLink(d.meetLink)
              await updateDossier(dossierId, { reunion_link: d.meetLink })
              await logActivite(dossierId, 'rdv', `Réunion Google Meet créée`)
              setLinkSaved(true); setTimeout(() => setLinkSaved(false), 3000)
            } catch (e) { setError(e.message) }
            setCreating(false)
          }}
          disabled={creating || !date || !time}
          style={{ width: '100%', padding: '9px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#16A34A', border: 'none', color: '#fff', marginBottom: error ? 8 : 10, opacity: creating ? .7 : 1 }}>
          {creating ? '⏳ Création en cours…' : '🟢 Créer la réunion Google Meet'}
        </button>
      )}

      {/* Teams */}
      {provider === 'teams' && (
        <div>
          <button onClick={() => window.open('https://teams.live.com', '_blank')}
            style={{ width: '100%', padding: '9px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#5B5EA6', border: 'none', color: '#fff', marginBottom: 6 }}>
            🟣 Ouvrir Teams
          </button>
          <div style={{ fontSize: 11, color: C.textSoft, textAlign: 'center', marginBottom: 10 }}>Crée ta réunion dans Teams, puis colle le lien ci-dessous</div>
        </div>
      )}

      {/* Visite technique */}
      {provider === 'visite' && (
        <div style={{ marginBottom: 10 }}>
          {/* Type d'invitation */}
          <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 4 }}>Type d'invitation</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[
              { id: 'place', label: '📍 Sur place',    a: '#D97706', bg: '#FFFBEB', t: '#92400E' },
              { id: 'meet',  label: '🟢 + Google Meet', a: '#16A34A', bg: '#F0FDF4', t: '#15803D' },
              { id: 'teams', label: '🟣 + Teams',       a: '#5B5EA6', bg: '#EDEDFF', t: '#5B5EA6' },
            ].map(p => {
              const sel = visiteInvit === p.id
              return (
                <button key={p.id} onClick={() => setVisiteInvit(p.id)}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 11, fontWeight: sel ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${sel ? p.a : C.border}`, background: sel ? p.bg : C.bg, color: sel ? p.t : C.textMid }}>
                  {p.label}
                </button>
              )
            })}
          </div>

          <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 3 }}>Adresse de la visite</div>
          <input ref={addressInputRef} value={visiteAddress} onChange={e => setVisiteAddress(e.target.value)}
            placeholder="12 rue de la Paix, 75001 Paris"
            style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />

          {/* Lien Teams manuel si choix Teams */}
          {visiteInvit === 'teams' && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.textSoft, marginBottom: 3 }}>Lien Teams (coller depuis l'app)</div>
              <input value={linkInput} onChange={e => setLinkInput(e.target.value)}
                placeholder="https://teams.microsoft.com/l/meetup-join/..."
                style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
            </div>
          )}

          <button
            onClick={async () => {
              setVisiteCreating(true); setVisiteError(null)
              try {
                const start = new Date(`${date}T${time}:00`)
                const end   = new Date(start.getTime() + visiteDuration * 60000)
                const subject = `Visite technique — ${dossier.prospects?.raison_sociale || 'Client'}`
                const emailList = emails.split(',').map(e => e.trim()).filter(Boolean)
                let meetLinkResult = null

                if (visiteInvit === 'meet') {
                  // Crée un événement Meet avec localisation
                  const r = await fetch('/api/calendar?action=meet', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subject, startDateTime: start.toISOString(), endDateTime: end.toISOString(), location: visiteAddress, emails: emailList }),
                  })
                  const d = await r.json()
                  if (d.error === 'scope_missing') throw new Error('Scope manquant — reconnecte ton compte Google dans les paramètres')
                  if (d.error) throw new Error(d.error)
                  meetLinkResult = d.meetLink
                } else {
                  // Sur place ou Teams : événement classique
                  const teamsLink = visiteInvit === 'teams' ? linkInput.trim() : undefined
                  const r = await fetch('/api/calendar?action=event', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subject, startDateTime: start.toISOString(), endDateTime: end.toISOString(), location: visiteAddress, teamsLink, emails: emailList }),
                  })
                  const d = await r.json()
                  if (d.error) throw new Error(d.error)
                }

                if (meetLinkResult) { setLinkInput(meetLinkResult); setLink(meetLinkResult); await updateDossier(dossierId, { reunion_link: meetLinkResult }) }
                await logActivite(dossierId, 'rdv', `Visite technique créée${visiteAddress ? ` — ${visiteAddress}` : ''}${visiteInvit === 'meet' ? ' + Meet' : visiteInvit === 'teams' ? ' + Teams' : ''}`)
                setVisiteCreated(true); setTimeout(() => setVisiteCreated(false), 4000)
              } catch (e) { setVisiteError(e.message) }
              setVisiteCreating(false)
            }}
            disabled={visiteCreating || !date || !time}
            style={{ width: '100%', padding: '9px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', color: '#fff', marginBottom: 6, background: visiteCreated ? '#16A34A' : '#D97706', opacity: visiteCreating ? .7 : 1 }}>
            {visiteCreating ? '⏳ Envoi…' : visiteCreated ? '✓ Invitation envoyée !' : '🔧 Créer la visite technique'}
          </button>
          {visiteError && <div style={{ fontSize: 12, color: '#DC2626' }}>⚠️ {visiteError}</div>}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 10 }}>⚠️ {error}</div>}

      {/* Coller lien Teams */}
      {provider === 'teams' && (
        <div style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 7, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: C.textMid, fontWeight: 600, marginBottom: 6 }}>Coller le lien de la réunion :</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={linkInput} onChange={e => { setLinkInput(e.target.value); setLinkSaved(false) }}
              placeholder="https://meet.google.com/xxx  ou  https://teams.microsoft.com/..."
              style={{ flex: 1, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, color: C.text, outline: 'none', fontFamily: 'inherit' }} />
            <button
              onClick={async () => {
                if (!linkInput.trim()) return
                setSavingLink(true)
                await updateDossier(dossierId, { reunion_link: linkInput.trim() })
                setLink(linkInput.trim()); setLinkSaved(true); setSavingLink(false)
                setTimeout(() => setLinkSaved(false), 3000)
              }}
              disabled={savingLink || !linkInput.trim()}
              style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: linkSaved ? '#16A34A' : C.accent, color: '#fff', whiteSpace: 'nowrap', opacity: savingLink ? .6 : 1 }}>
              {linkSaved ? '✓' : savingLink ? '…' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}

      {/* Lien sauvegardé */}
      {link && (
        <div style={{ marginTop: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 7, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: '#15803D', fontWeight: 700, marginBottom: 6 }}>🔗 Lien de réunion sauvegardé</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input readOnly value={link}
              style={{ flex: 1, background: '#fff', border: '1px solid #BBF7D0', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#166534', outline: 'none', fontFamily: 'monospace' }} />
            <button onClick={() => { navigator.clipboard.writeText(link).catch(() => {}); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) }}
              style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${linkCopied ? '#16A34A' : '#BBF7D0'}`, background: linkCopied ? '#DCFCE7' : '#fff', color: linkCopied ? '#16A34A' : '#166534', whiteSpace: 'nowrap' }}>
              {linkCopied ? '✓' : '⎘'}
            </button>
            <button onClick={() => window.open(link, '_blank')}
              style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid #BBF7D0', background: '#16A34A', color: '#fff', whiteSpace: 'nowrap' }}>
              Rejoindre
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
