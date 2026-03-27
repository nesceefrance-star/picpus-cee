import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'
import { C } from './theme'
import VisiteRapportPDF from '../visite/VisiteRapportPDF'

const BUCKET = 'dossier-documents'

const CHECKLIST_ITEMS = [
  { id: 'devis',               label: 'Devis' },
  { id: 'plan_site',           label: 'Plan du site' },
  { id: 'fiche_technique',     label: 'Fiche(s) technique' },
  { id: 'capture_geoportail',  label: 'Capture Géoportail' },
  { id: 'attestation_qualite', label: 'Attestation qualité signataire' },
]

export default function DocumentsTab({ dossierId, dossier, session, onCountChange }) {
  const navigate = useNavigate()
  const { logActivite } = useStore()
  const fileInputRef = useRef(null)

  const [documents,      setDocuments]      = useState([])
  const [visites,        setVisites]        = useState([])
  const [loading,        setLoading]        = useState(false)
  const [uploading,      setUploading]      = useState(false)
  const [uploadError,    setUploadError]    = useState(null)
  const [dragOver,       setDragOver]       = useState(false)
  const [renamingDoc,    setRenamingDoc]    = useState(null)
  const [renameValue,    setRenameValue]    = useState('')
  const [checkedDocs,    setCheckedDocs]    = useState(new Set())
  const [emailingVer,    setEmailingVer]    = useState(false)
  const [ceeAnalyses,    setCeeAnalyses]    = useState([])
  const [docValidations, setDocValidations] = useState({})
  const [depotChecklist, setDepotChecklist] = useState({})
  const [docNotes,       setDocNotes]       = useState({})
  const [editingNote,    setEditingNote]    = useState(null) // fileName en cours d'édition
  const [noteValue,      setNoteValue]      = useState('')
  const [downloadingPdf, setDownloadingPdf] = useState(null) // visiteId en cours

  useEffect(() => { load() }, [dossierId])

  useEffect(() => {
    setDocValidations(dossier?.doc_validations || {})
    setDepotChecklist(dossier?.depot_checklist || {})
    setDocNotes(dossier?.doc_notes || {})
  }, [dossier?.id])

  const load = async () => {
    setLoading(true)
    const [storageRes, ceeRes, visitesRes] = await Promise.all([
      supabase.storage.from(BUCKET).list(dossierId, { sortBy: { column: 'created_at', order: 'desc' } }),
      supabase.from('cee_analyses').select('id, fiche, ref, result, created_at').eq('dossier_id', dossierId).order('created_at', { ascending: false }),
      supabase.from('visites_techniques').select('id, type_fiche, statut, created_at').eq('dossier_id', dossierId).order('created_at', { ascending: false }),
    ])
    if (!storageRes.error && storageRes.data) {
      const list = storageRes.data.filter(f => f.name !== '.emptyFolderPlaceholder')
      setDocuments(list)
      onCountChange?.(list.length)
    }
    setCeeAnalyses(ceeRes.data || [])
    setVisites(visitesRes.data || [])
    setLoading(false)
  }

  const uploadFiles = async (files) => {
    if (!files?.length) return
    setUploading(true); setUploadError(null)
    const errors = []
    for (const file of Array.from(files)) {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error } = await supabase.storage.from(BUCKET).upload(`${dossierId}/${safeName}`, file, { upsert: true })
      if (error) errors.push(`${file.name} : ${error.message}`)
    }
    if (errors.length) setUploadError(errors.join('\n'))
    if (fileInputRef.current) fileInputRef.current.value = ''
    await load()
    if (!errors.length) await logActivite(dossierId, 'document', `${Array.from(files).length} document(s) uploadé(s)`)
    setUploading(false)
  }

  const deleteDocument = async (fileName) => {
    if (!window.confirm(`Supprimer « ${fileName} » ?`)) return
    await supabase.storage.from(BUCKET).remove([`${dossierId}/${fileName}`])
    const newValidations = { ...docValidations }
    delete newValidations[fileName]
    const newNotes = { ...docNotes }
    delete newNotes[fileName]
    setDocValidations(newValidations)
    setDocNotes(newNotes)
    await supabase.from('dossiers').update({ doc_validations: newValidations, doc_notes: newNotes }).eq('id', dossierId)
    setDocuments(d => { const n = d.filter(f => f.name !== fileName); onCountChange?.(n.length); return n })
  }

  const downloadDocument = async (fileName) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(`${dossierId}/${fileName}`, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const forceDownloadDocument = async (fileName) => {
    const { data } = await supabase.storage.from(BUCKET).download(`${dossierId}/${fileName}`)
    if (!data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url; a.download = fileName.replace(/^\d+_/, '')
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const renameDocument = async (oldFileName, newDisplayName) => {
    const trimmed = newDisplayName.trim()
    if (!trimmed) return
    const ext = oldFileName.includes('.') ? oldFileName.split('.').pop() : ''
    const baseName = trimmed.includes('.') ? trimmed : ext ? `${trimmed}.${ext}` : trimmed
    const safeName = baseName.replace(/[^a-zA-Z0-9._\- ]/g, '_')
    const { error } = await supabase.storage.from(BUCKET).move(`${dossierId}/${oldFileName}`, `${dossierId}/${safeName}`)
    if (error) { setUploadError(`Renommage : ${error.message}`); return }
    setRenamingDoc(null)
    await load()
  }

  const setDocValidation = async (fileName, status) => {
    const newValidations = { ...docValidations, [fileName]: status }
    setDocValidations(newValidations)
    await supabase.from('dossiers').update({ doc_validations: newValidations }).eq('id', dossierId)
  }

  const toggleChecklist = async (itemId) => {
    const newChecklist = { ...depotChecklist, [itemId]: !depotChecklist[itemId] }
    setDepotChecklist(newChecklist)
    await supabase.from('dossiers').update({ depot_checklist: newChecklist }).eq('id', dossierId)
  }

  const startEditNote = (fileName) => {
    setEditingNote(fileName)
    setNoteValue(docNotes[fileName] || '')
  }

  const saveNote = async (fileName) => {
    const trimmed = noteValue.trim()
    const newNotes = { ...docNotes }
    if (trimmed) newNotes[fileName] = trimmed
    else delete newNotes[fileName]
    setDocNotes(newNotes)
    setEditingNote(null)
    await supabase.from('dossiers').update({ doc_notes: newNotes }).eq('id', dossierId)
  }

  const downloadVisitePDF = async (visiteId, typeFiche) => {
    setDownloadingPdf(visiteId)
    try {
      const { data: visiteData } = await supabase.from('visites_techniques').select('*').eq('id', visiteId).single()
      if (!visiteData) throw new Error('Visite introuvable')
      const blob = await pdf(
        <VisiteRapportPDF visite={visiteData} dossierRef={dossier?.ref} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport-vt-${typeFiche}-${visiteId.slice(0, 8)}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) { alert('Erreur génération PDF : ' + e.message) }
    setDownloadingPdf(null)
  }

  const emailDocumentsToVerificateur = async () => {
    if (checkedDocs.size === 0) return
    setEmailingVer(true)
    try {
      const fileList = await Promise.all(
        [...checkedDocs].map(async fn => {
          const { data } = await supabase.storage.from(BUCKET).createSignedUrl(`${dossierId}/${fn}`, 3600)
          return { name: fn.replace(/^\d+_/, ''), url: data?.signedUrl }
        })
      )
      const validFiles = fileList.filter(f => f.url)
      if (validFiles.length === 0) throw new Error('Impossible de générer les liens')
      setCheckedDocs(new Set())
      navigate('/hub', {
        state: {
          module: 'verificateur',
          prefill: { ref: dossier.ref || '', fiche: dossier.fiche_cee || 'BAT-TH-142', dossierId, files: validFiles },
        },
      })
    } catch (e) { alert('Erreur : ' + e.message) }
    setEmailingVer(false)
  }

  const isDepot = dossier?.statut === 'depot_delegataire'
  const checklistDone = CHECKLIST_ITEMS.filter(i => depotChecklist[i.id]).length

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>📎 Documents</span>
        <span style={{ fontSize: 11, color: C.textSoft }}>{documents.length} fichier{documents.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Checklist pièces requises */}
      <div style={{ marginBottom: 16, background: isDepot ? '#EFF6FF' : C.bg, border: `1px solid ${isDepot ? '#1D4ED8' : C.border}`, borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: isDepot ? '#1D4ED8' : C.textMid }}>
            📋 Pièces requises pour le dépôt délégitaire
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: checklistDone === CHECKLIST_ITEMS.length ? '#DCFCE7' : C.border, color: checklistDone === CHECKLIST_ITEMS.length ? '#16A34A' : C.textSoft }}>
            {checklistDone}/{CHECKLIST_ITEMS.length}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {CHECKLIST_ITEMS.map(item => {
            const checked = !!depotChecklist[item.id]
            return (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={checked} onChange={() => toggleChecklist(item.id)}
                  style={{ width: 15, height: 15, accentColor: '#16A34A', cursor: 'pointer', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: checked ? '#16A34A' : C.text, textDecoration: checked ? 'line-through' : 'none', fontWeight: checked ? 600 : 400 }}>
                  {item.label}
                </span>
                {checked && <span style={{ fontSize: 10, color: '#16A34A', fontWeight: 700 }}>✓ Déposé</span>}
              </label>
            )
          })}
        </div>
      </div>

      {/* Drag & drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
        onClick={() => fileInputRef.current?.click()}
        style={{ border: `2px dashed ${dragOver ? C.accent : C.border}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer', background: dragOver ? '#EFF6FF' : C.bg, transition: 'all .15s', marginBottom: 16, opacity: uploading ? .6 : 1 }}>
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => uploadFiles(e.target.files)} />
        {uploading ? (
          <div style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>⏳ Upload en cours…</div>
        ) : (
          <>
            <div style={{ fontSize: 24, marginBottom: 6 }}>☁️</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid }}>Glissez des fichiers ici ou cliquez pour parcourir</div>
            <div style={{ fontSize: 11, color: C.textSoft, marginTop: 4 }}>PDF, images, Word, Excel, ZIP… tous formats acceptés</div>
          </>
        )}
      </div>

      {uploadError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#DC2626', whiteSpace: 'pre-wrap' }}>
          ⚠️ Erreur upload : {uploadError}
          <button onClick={() => setUploadError(null)} style={{ float: 'right', background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Rapports visites techniques */}
      {visites.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textSoft, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Rapports visites techniques
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visites.map(v => {
              const isGen = downloadingPdf === v.id
              return (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>📊</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Rapport VT — {v.type_fiche}</div>
                    <div style={{ fontSize: 10, color: C.textSoft, marginTop: 1 }}>
                      {new Date(v.created_at).toLocaleDateString('fr-FR')} · {v.statut}
                    </div>
                  </div>
                  <button
                    onClick={() => downloadVisitePDF(v.id, v.type_fiche)}
                    disabled={isGen}
                    title="Télécharger le PDF"
                    style={{ background: isGen ? C.bg : C.accent, border: `1px solid ${isGen ? C.border : C.accent}`, color: isGen ? C.textSoft : '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: isGen ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: isGen ? .7 : 1 }}>
                    {isGen ? '⏳ Génération…' : '⬇ PDF'}
                  </button>
                  <button onClick={() => navigate(`/visites/${v.id}`)}
                    style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.accent, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    Voir →
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Liste documents uploadés */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '12px 0', color: C.textSoft, fontSize: 12 }}>Chargement…</div>
      ) : documents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '12px 0', color: C.textSoft, fontSize: 12 }}>Aucun document pour ce dossier.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {documents.map(doc => {
            const ext = doc.name.split('.').pop().toLowerCase()
            const icon = ['pdf'].includes(ext) ? '📄' : ['jpg','jpeg','png','gif','webp'].includes(ext) ? '🖼️' : ['doc','docx'].includes(ext) ? '📝' : ['xls','xlsx','csv'].includes(ext) ? '📊' : ['zip','rar','7z'].includes(ext) ? '🗜️' : '📎'
            const sizeKb = doc.metadata?.size ? (doc.metadata.size / 1024).toFixed(0) : null
            const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : null
            const displayName = doc.name.replace(/^\d+_/, '')
            const isChecked = checkedDocs.has(doc.name)
            const validation = docValidations[doc.name]
            const note = docNotes[doc.name]
            const isEditNote = editingNote === doc.name

            let borderColor = isChecked ? C.accent : validation === 'valide' ? '#86EFAC' : validation === 'invalide' ? '#FCA5A5' : C.border
            let bgColor = isChecked ? '#EFF6FF' : validation === 'valide' ? '#F0FDF4' : validation === 'invalide' ? '#FEF2F2' : C.bg

            return (
              <div key={doc.name} style={{ border: `1px solid ${borderColor}`, borderRadius: 8, overflow: 'hidden', transition: 'all .15s' }}>
                {/* Ligne principale */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: bgColor, padding: '9px 12px', flexWrap: 'wrap' }}>
                  <input type="checkbox" checked={isChecked}
                    onChange={() => setCheckedDocs(s => { const n = new Set(s); isChecked ? n.delete(doc.name) : n.add(doc.name); return n })}
                    style={{ flexShrink: 0, cursor: 'pointer', width: 14, height: 14, accentColor: C.accent }} />
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                  {renamingDoc === doc.name ? (
                    <>
                      <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') renameDocument(doc.name, renameValue); if (e.key === 'Escape') setRenamingDoc(null) }}
                        style={{ flex: 1, fontSize: 12, fontWeight: 600, background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '5px 8px', color: C.text, outline: 'none', fontFamily: 'inherit' }} />
                      <button onClick={() => renameDocument(doc.name, renameValue)}
                        style={{ background: '#16A34A', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, flexShrink: 0 }}>✓</button>
                      <button onClick={() => setRenamingDoc(null)}
                        style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
                    </>
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                        <div style={{ fontSize: 10, color: C.textSoft, marginTop: 1 }}>{[sizeKb ? `${sizeKb} Ko` : null, date].filter(Boolean).join(' · ')}</div>
                      </div>
                      <button onClick={() => { setRenamingDoc(doc.name); setRenameValue(displayName) }}
                        style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }} title="Renommer">✏️</button>
                      <button onClick={() => downloadDocument(doc.name)} title="Ouvrir"
                        style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.accent, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>👁</button>
                      <button onClick={() => forceDownloadDocument(doc.name)} title="Télécharger"
                        style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.accent, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, flexShrink: 0 }}>⬇</button>
                      <button
                        onClick={() => setDocValidation(doc.name, validation === 'valide' ? null : 'valide')}
                        title="Marquer valide"
                        style={{ background: validation === 'valide' ? '#16A34A' : 'transparent', border: `1px solid ${validation === 'valide' ? '#16A34A' : '#86EFAC'}`, color: validation === 'valide' ? '#fff' : '#16A34A', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, flexShrink: 0 }}>
                        ✓ Valide
                      </button>
                      <button
                        onClick={() => setDocValidation(doc.name, validation === 'invalide' ? null : 'invalide')}
                        title="Marquer invalide"
                        style={{ background: validation === 'invalide' ? '#DC2626' : 'transparent', border: `1px solid ${validation === 'invalide' ? '#DC2626' : '#FCA5A5'}`, color: validation === 'invalide' ? '#fff' : '#DC2626', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, flexShrink: 0 }}>
                        ✗ Invalide
                      </button>
                      <button
                        onClick={() => isEditNote ? setEditingNote(null) : startEditNote(doc.name)}
                        title="Ajouter une note"
                        style={{ background: note ? '#FFFBEB' : 'transparent', border: `1px solid ${note ? '#FCD34D' : C.border}`, color: note ? '#D97706' : C.textMid, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                        📝
                      </button>
                      <button onClick={() => deleteDocument(doc.name)}
                        style={{ background: 'transparent', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>🗑</button>
                    </>
                  )}
                </div>

                {/* Zone note existante (affichée si pas en mode édition) */}
                {note && !isEditNote && (
                  <div
                    onClick={() => startEditNote(doc.name)}
                    style={{ background: '#FFFBEB', borderTop: '1px solid #FCD34D', padding: '6px 12px 6px 44px', fontSize: 11, color: '#92400E', cursor: 'text', lineHeight: 1.5 }}>
                    <span style={{ color: '#D97706', fontWeight: 600, marginRight: 4 }}>📝</span>{note}
                  </div>
                )}

                {/* Zone édition note */}
                {isEditNote && (
                  <div style={{ background: '#FFFBEB', borderTop: '1px solid #FCD34D', padding: '8px 12px' }}>
                    <textarea
                      autoFocus
                      value={noteValue}
                      onChange={e => setNoteValue(e.target.value)}
                      placeholder="Ajouter une note (inconformité, précision…)"
                      rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #FCD34D', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: C.text, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingNote(null)}
                        style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Annuler
                      </button>
                      <button onClick={() => saveNote(doc.name)}
                        style={{ background: '#D97706', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Enregistrer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {checkedDocs.size > 0 && (
            <div style={{ marginTop: 8, background: '#EFF6FF', border: `1px solid ${C.accent}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>
                {checkedDocs.size} document{checkedDocs.size > 1 ? 's' : ''} sélectionné{checkedDocs.size > 1 ? 's' : ''} pour le vérificateur
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setCheckedDocs(new Set())}
                  style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Désélectionner</button>
                <button onClick={emailDocumentsToVerificateur} disabled={emailingVer}
                  style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: emailingVer ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, opacity: emailingVer ? .6 : 1 }}>
                  {emailingVer ? '⏳…' : '✓ Envoyer au vérificateur'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analyses CEE */}
      {ceeAnalyses.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🔍 Analyses CEE IA</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ceeAnalyses.map(a => {
              const avis = a.result?.avis || 'ATTENTION'
              const AVIS_STYLE = {
                CONFORME:  { bg: '#F0FDF4', border: '#86EFAC', color: '#16A34A', icon: '✅' },
                ATTENTION: { bg: '#FFFBEB', border: '#FCD34D', color: '#D97706', icon: '⚠️' },
                BLOQUANT:  { bg: '#FEF2F2', border: '#FCA5A5', color: '#DC2626', icon: '🚫' },
              }
              const st = AVIS_STYLE[avis] || AVIS_STYLE.ATTENTION
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: st.bg, borderRadius: 8, border: `1px solid ${st.border}` }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{st.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: st.color }}>{avis}</div>
                    <div style={{ fontSize: 11, color: C.textSoft, marginTop: 1 }}>
                      {a.fiche} · {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button onClick={() => navigate('/hub', { state: { module: 'verificateur', prefill: { dossierId, ref: dossier?.ref || '', fiche: a.fiche } } })}
                    style={{ background: C.surface, border: `1px solid ${st.border}`, color: st.color, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Voir →
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
