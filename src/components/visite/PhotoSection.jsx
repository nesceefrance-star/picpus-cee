// PhotoSection.jsx — Capture photo par catégorie + upload Supabase + sauvegarde appareil
import { useRef, useState } from 'react'
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

// Compresse l'image à 1600px max et 85% qualité JPEG
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
      canvas.toBlob(blob => resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })), 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// Sauvegarde dans les photos de l'appareil (iOS: Share API, Android: download)
async function saveToDevice(file) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  try {
    if (isIOS && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: file.name })
    } else {
      const url = URL.createObjectURL(file)
      const a   = document.createElement('a')
      a.href     = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
  } catch { /* annulé par l'utilisateur ou non supporté */ }
}

export default function PhotoSection({ visiteId, photos = [], onPhotosChange, showCategories }) {
  const [uploading, setUploading] = useState({}) // { catId: bool }
  const [expanded,  setExpanded]  = useState({}) // { catId: bool }
  const [lightbox,  setLightbox]  = useState(null) // { url, label }
  const inputs = useRef({})

  const visibleCategories = showCategories
    ? PHOTO_CATEGORIES.filter(c => showCategories.includes(c.id))
    : PHOTO_CATEGORIES

  const byCategory = (catId) => photos.filter(p => p.categorie === catId)

  const handleFile = async (catId, file) => {
    if (!file || !visiteId) return
    setUploading(u => ({ ...u, [catId]: true }))
    try {
      const compressed = await compressImage(file)
      // Sauvegarde sur l'appareil d'abord
      await saveToDevice(compressed)
      // Upload Supabase Storage
      const path = `${visiteId}/${catId}/${Date.now()}_${compressed.name}`
      const { error } = await supabase.storage.from('visites-photos').upload(path, compressed, { contentType: 'image/jpeg' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('visites-photos').getPublicUrl(path)
      const newPhoto = { id: crypto.randomUUID(), categorie: catId, url: publicUrl, nom: compressed.name, taken_at: new Date().toISOString() }
      onPhotosChange([...photos, newPhoto])
    } catch (e) {
      alert('Erreur upload photo : ' + e.message)
    } finally {
      setUploading(u => ({ ...u, [catId]: false }))
      if (inputs.current[catId]) inputs.current[catId].value = ''
    }
  }

  const deletePhoto = async (photo) => {
    if (!confirm('Supprimer cette photo ?')) return
    const path = photo.url.split('/visites-photos/')[1]
    if (path) await supabase.storage.from('visites-photos').remove([path])
    onPhotosChange(photos.filter(p => p.id !== photo.id))
  }

  const totalCount = photos.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Compteur global */}
      <div style={{ fontSize: 13, color: C.textMid, fontWeight: 600 }}>
        {totalCount} photo{totalCount !== 1 ? 's' : ''} enregistrée{totalCount !== 1 ? 's' : ''}
      </div>

      {visibleCategories.map(cat => {
        const catPhotos = byCategory(cat.id)
        const isOpen    = expanded[cat.id] ?? catPhotos.length > 0
        const isUploading = uploading[cat.id]

        return (
          <div key={cat.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {/* Header catégorie */}
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

            {/* Contenu */}
            {isOpen && (
              <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.bg}` }}>
                {/* Grille photos */}
                {catPhotos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 12, marginTop: 12 }}>
                    {catPhotos.map(photo => (
                      <div key={photo.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1', background: C.bg }}>
                        <img
                          src={photo.url}
                          alt={photo.nom}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => setLightbox({ url: photo.url, label: cat.label })}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); deletePhoto(photo) }}
                          style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(220,38,38,0.85)', border: 'none', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bouton ajouter */}
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
                  disabled={isUploading || !visiteId}
                  style={{
                    background: isUploading ? C.bg : '#EFF6FF',
                    border: `1.5px dashed ${isUploading ? C.border : '#93C5FD'}`,
                    borderRadius: 8, padding: '10px 0', width: '100%',
                    color: isUploading ? C.textSoft : C.accent,
                    fontSize: 13, fontWeight: 600, cursor: isUploading ? 'wait' : 'pointer',
                    fontFamily: 'inherit', marginTop: catPhotos.length > 0 ? 0 : 12,
                  }}
                >
                  {isUploading ? '⏳ Upload en cours…' : '📷 Ajouter une photo'}
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
