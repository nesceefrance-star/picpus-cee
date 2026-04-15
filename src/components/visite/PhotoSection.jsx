// PhotoSection.jsx — Capture photo par catégorie + upload Supabase + sauvegarde appareil
import { useRef, useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export const PHOTO_CATEGORIES = [
  { id: 'vue_generale',        label: 'Vue générale',          icon: '🏭' },
  { id: 'chaufferie',          label: 'Chaufferie',             icon: '🔥' },
  { id: 'tgbt',                label: 'TGBT',                   icon: '⚡' },
  { id: 'td',                  label: 'TD',                     icon: '🔌' },
  { id: 'equipements',         label: 'Équipements existants',  icon: '🔧' },
  { id: 'plaque_constructeur', label: 'Plaque constructeur',    icon: '🏷️' },
  { id: 'compteur',            label: 'Compteur',               icon: '📊' },
  { id: 'apres_travaux',       label: 'Après travaux',          icon: '✅' },
  { id: 'autres',              label: 'Autres',                 icon: '📷' },
]

const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

const isIOSDevice = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))

const isIPadDevice = () =>
  /iPad/.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))

function compressImage(file, maxPx = 1600) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale  = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return }
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

async function saveToDevice(file) {
  try {
    const url = URL.createObjectURL(file)
    const a   = document.createElement('a')
    a.href = url; a.download = file.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  } catch { /* non supporté */ }
}

export default function PhotoSection({ visiteId, photos = [], onPhotosChange, showCategories }) {
  // localPhotos = photos en cours d'upload (pending/uploading/error) — n'existent que localement
  const [localPhotos, setLocalPhotos] = useState([])
  const [expanded,    setExpanded]    = useState({})
  const [lightbox,    setLightbox]    = useState(null)
  const inputs      = useRef({})
  const pendingRef  = useRef({})  // { tempId: { catId, file, localUrl } }
  const photosRef   = useRef(photos)

  useEffect(() => { photosRef.current = photos }, [photos])

  const visibleCategories = showCategories
    ? PHOTO_CATEGORIES.filter(c => showCategories.includes(c.id))
    : PHOTO_CATEGORIES

  // Photos affichées = photos uploadées (props) + photos locales en attente
  const allPhotos   = [...photos, ...localPhotos]
  const byCategory  = (catId) => allPhotos.filter(p => p.categorie === catId)

  // ── Upload en arrière-plan ─────────────────────────────────────────────────
  const doUpload = useCallback(async (tempId, catId, file, localUrl) => {
    if (!visiteId) return
    setLocalPhotos(prev => prev.map(p => p.id === tempId ? { ...p, _status: 'uploading' } : p))
    try {
      const ios  = isIOSDevice()
      const ipad = isIPadDevice()
      if (!ios) await saveToDevice(file)
      let toUpload = file
      if (!ipad) {
        try { toUpload = await compressImage(file) } catch { toUpload = file }
      }
      const ext  = (toUpload.type || 'image/jpeg').includes('png') ? 'png' : 'jpg'
      const path = `${visiteId}/${catId}/${Date.now()}.${ext}`
      const buf  = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Lecture fichier échouée'))
        reader.readAsArrayBuffer(toUpload)
      })
      const { error } = await supabase.storage
        .from('visites-photos')
        .upload(path, buf, { contentType: toUpload.type || 'image/jpeg', upsert: false })
      if (error) throw new Error(error.message || JSON.stringify(error))

      const { data: { publicUrl } } = supabase.storage.from('visites-photos').getPublicUrl(path)
      const newPhoto = {
        id: crypto.randomUUID(), categorie: catId,
        url: publicUrl, nom: file.name, taken_at: new Date().toISOString(),
      }
      // Succès : retirer de localPhotos, ajouter aux photos réelles
      setLocalPhotos(prev => prev.filter(p => p.id !== tempId))
      URL.revokeObjectURL(localUrl)
      delete pendingRef.current[tempId]
      onPhotosChange([...photosRef.current, newPhoto])
    } catch (e) {
      setLocalPhotos(prev => prev.map(p =>
        p.id === tempId ? { ...p, _status: 'error', _error: e.message } : p
      ))
    }
  }, [visiteId, onPhotosChange])

  // Retry auto quand connexion rétablie
  useEffect(() => {
    const retry = () => {
      Object.entries(pendingRef.current).forEach(([tempId, { catId, file, localUrl }]) => {
        setLocalPhotos(prev => {
          const p = prev.find(lp => lp.id === tempId)
          if (p?._status === 'error') doUpload(tempId, catId, file, localUrl)
          return prev
        })
      })
    }
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [doUpload])

  // ── Prise de photo ─────────────────────────────────────────────────────────
  const handleFile = (catId, file) => {
    if (!file || !visiteId) return
    const localUrl = URL.createObjectURL(file)
    const tempId   = crypto.randomUUID()
    pendingRef.current[tempId] = { catId, file, localUrl }
    setLocalPhotos(prev => [...prev, {
      id: tempId, categorie: catId,
      url: localUrl, nom: file.name,
      taken_at: new Date().toISOString(), _status: 'pending',
    }])
    if (inputs.current[catId]) inputs.current[catId].value = ''
    doUpload(tempId, catId, file, localUrl)
  }

  // ── Retry manuel ─────────────────────────────────────────────────────────
  const retryPhoto = (photo) => {
    const pending = pendingRef.current[photo.id]
    if (pending) doUpload(photo.id, pending.catId, pending.file, pending.localUrl)
  }

  // ── Suppression ───────────────────────────────────────────────────────────
  const deletePhoto = async (photo) => {
    if (!confirm('Supprimer cette photo ?')) return
    if (photo._status) {
      // Photo locale non uploadée — juste retirer de l'état local
      const pending = pendingRef.current[photo.id]
      if (pending) URL.revokeObjectURL(pending.localUrl)
      delete pendingRef.current[photo.id]
      setLocalPhotos(prev => prev.filter(p => p.id !== photo.id))
      return
    }
    const path = photo.url.split('/visites-photos/')[1]
    if (path) await supabase.storage.from('visites-photos').remove([path])
    onPhotosChange(photos.filter(p => p.id !== photo.id))
  }

  // ── Compte (uploadées + locales) ──────────────────────────────────────────
  const pendingCount = localPhotos.length
  const totalCount   = photos.length + pendingCount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Compteur global + badge sync */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: C.textMid, fontWeight: 600 }}>
          {totalCount} photo{totalCount !== 1 ? 's' : ''} enregistrée{totalCount !== 1 ? 's' : ''}
        </span>
        {pendingCount > 0 && (
          <span style={{ background: '#FEF3C7', color: '#D97706', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
            ⏳ {pendingCount} en cours…
          </span>
        )}
      </div>

      {visibleCategories.map(cat => {
        const catPhotos = byCategory(cat.id)
        const isOpen    = expanded[cat.id] ?? catPhotos.length > 0
        const uploading = localPhotos.some(p => p.categorie === cat.id && p._status === 'uploading')

        return (
          <div key={cat.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div
              onClick={() => setExpanded(e => ({ ...e, [cat.id]: !isOpen }))}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
            >
              <span style={{ fontSize: 18 }}>{cat.icon}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text }}>{cat.label}</span>
              {catPhotos.length > 0 && (
                <span style={{ background: '#DBEAFE', color: '#1D4ED8', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  {catPhotos.length}
                </span>
              )}
              <span style={{ fontSize: 11, color: C.textSoft }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.bg}` }}>
                {catPhotos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 12, marginTop: 12 }}>
                    {catPhotos.map(photo => {
                      const isPending  = photo._status === 'pending' || photo._status === 'uploading'
                      const isError    = photo._status === 'error'
                      return (
                        <div key={photo.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1', background: C.bg, opacity: isPending ? 0.7 : 1 }}>
                          <img
                            src={photo.url}
                            alt={photo.nom}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: isError ? 'default' : 'pointer' }}
                            onClick={() => !photo._status && setLightbox({ url: photo.url, label: cat.label })}
                          />
                          {/* Overlay upload en cours */}
                          {isPending && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 20, animation: 'spin 1s linear infinite' }}>⏳</span>
                            </div>
                          )}
                          {/* Overlay erreur + bouton retry */}
                          {isError && (
                            <div
                              onClick={() => retryPhoto(photo)}
                              style={{ position: 'absolute', inset: 0, background: 'rgba(220,38,38,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 2 }}
                            >
                              <span style={{ fontSize: 18 }}>⚠️</span>
                              <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>Réessayer</span>
                            </div>
                          )}
                          {/* Bouton suppression (masqué si upload en cours) */}
                          {!isPending && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deletePhoto(photo) }}
                              style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(220,38,38,0.85)', border: 'none', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <input
                  ref={el => inputs.current[cat.id] = el}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={e => handleFile(cat.id, e.target.files[0])}
                />
                <button
                  onClick={() => inputs.current[cat.id]?.click()}
                  disabled={!visiteId}
                  style={{
                    background: uploading ? C.bg : '#EFF6FF',
                    border: `1.5px dashed ${uploading ? C.border : '#93C5FD'}`,
                    borderRadius: 8, padding: '10px 0', width: '100%',
                    color: uploading ? C.textSoft : C.accent,
                    fontSize: 13, fontWeight: 600, cursor: !visiteId ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', marginTop: catPhotos.length > 0 ? 0 : 12,
                  }}
                >
                  {uploading ? '⏳ Upload en cours…' : '📷 Ajouter une photo'}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <img src={lightbox.url} alt={lightbox.label} style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
          <button
            onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 36, height: 36, fontSize: 18, cursor: 'pointer' }}
          >✕</button>
        </div>
      )}
    </div>
  )
}
