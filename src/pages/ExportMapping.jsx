import { useState, useEffect, useRef } from 'react'
import { useAppTheme } from '../lib/theme'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUTS = [
  { id: 'simulation',       label: 'Simulation',       color: '#7C3AED' },
  { id: 'prospect',         label: 'Prospect',          color: '#0369A1' },
  { id: 'contacte',         label: 'Contacté',          color: '#0891B2' },
  { id: 'visio_planifiee',  label: 'Visio planifiée',   color: '#0D9488' },
  { id: 'visio_effectuee',  label: 'Visio effectuée',   color: '#059669' },
  { id: 'visite_planifiee', label: 'Visite planifiée',  color: '#D97706' },
  { id: 'visite_effectuee', label: 'Visite effectuée',  color: '#EA580C' },
  { id: 'devis',            label: 'Devis envoyé',      color: '#7C3AED' },
  { id: 'ah',               label: 'AH signé',          color: '#16A34A' },
  { id: 'conforme',         label: 'Conforme',          color: '#15803D' },
  { id: 'facture',          label: 'Facturé',           color: '#64748B' },
  { id: 'perdu',            label: 'Marché perdu',      color: '#DC2626' },
]
const STATUT_LABELS = Object.fromEntries(STATUTS.map(s => [s.id, s.label]))

const FICHE_META = {
  'BAT-TH-116': { label: 'GTB',              color: '#7C3AED' },
  'BAT-TH-163': { label: 'PAC Tertiaire',    color: '#0891B2' },
  'BAT-TH-142': { label: 'Destrat Tertiaire',color: '#D97706' },
  'IND-BA-110': { label: 'Destrat Industrie',color: '#EA580C' },
  'BAT-TH-125': { label: 'VMC Simple flux',  color: '#16A34A' },
  'BAT-TH-126': { label: 'VMC Double flux',  color: '#0369A1' },
}

// Champs disponibles groupés
const DOSSIER_FIELDS = [
  { id: '',                   label: '— Ne pas remplir —',      group: '' },
  { id: 'ref',                label: 'Référence dossier',       group: 'Dossier' },
  { id: 'statut',             label: 'Statut',                  group: 'Dossier' },
  { id: 'fiche_cee',          label: 'Fiche CEE',               group: 'Dossier' },
  { id: 'created_at',         label: 'Date création',           group: 'Dossier' },
  { id: 'raison_sociale',     label: 'Raison sociale',          group: 'Prospect' },
  { id: 'siret',              label: 'SIRET',                   group: 'Prospect' },
  { id: 'naf',                label: 'Code NAF',                group: 'Prospect' },
  { id: 'contact_nom',        label: 'Nom contact',             group: 'Prospect' },
  { id: 'contact_prenom',     label: 'Prénom contact',          group: 'Prospect' },
  { id: 'contact_tel',        label: 'Téléphone',               group: 'Prospect' },
  { id: 'contact_email',      label: 'Email',                   group: 'Prospect' },
  { id: 'adresse_siege',      label: 'Adresse siège',           group: 'Prospect' },
  { id: 'cp_siege',           label: 'CP siège',                group: 'Prospect' },
  { id: 'ville_siege',        label: 'Ville siège',             group: 'Prospect' },
  { id: 'adresse_site',       label: 'Adresse site complète',   group: 'Site travaux' },
  { id: 'adresse_site_rue',   label: 'Rue site',                group: 'Site travaux' },
  { id: 'adresse_site_cp',    label: 'CP site',                 group: 'Site travaux' },
  { id: 'adresse_site_ville', label: 'Ville site',              group: 'Site travaux' },
  { id: 'prime_estimee',      label: 'Prime brute (€)',         group: 'Financier' },
  { id: 'marge_nette',        label: 'Marge nette (€)',         group: 'Financier' },
  { id: 'mwh_cumac',          label: 'Volume CUMAC (MWh)',      group: 'CEE' },
  { id: 'superficie',         label: 'Superficie (m²)',         group: 'CEE' },
  { id: 'secteur',            label: "Secteur d'activité",      group: 'CEE' },
  { id: 'fonctionnalites',    label: 'Fonctionnalités',         group: 'CEE' },
  { id: 'zone_climatique',    label: 'Zone climatique',         group: 'CEE' },
]

const FIELD_GROUPS_ORDER = ['', 'Dossier', 'Prospect', 'Site travaux', 'Financier', 'CEE']

// ── Helpers extraction simulation.parametres ──────────────────────────────────

const SECTEUR_LABELS = {
  bureaux: 'Bureaux', commerce: 'Commerce', enseignement: 'Enseignement',
  sante: 'Santé', hotellerie: 'Hôtellerie', restauration: 'Restauration',
  industrie: 'Industrie', logistique: 'Logistique', autre: 'Autre',
}

function parseAdresse(str) {
  if (!str) return { adresse: '', cp: '', ville: '' }
  const m = str.match(/^(.*?)[,\s]+(\d{5})[,\s]+(.+)$/)
  if (m) return { adresse: m[1].trim(), cp: m[2], ville: m[3].trim() }
  return { adresse: str.trim(), cp: '', ville: '' }
}

function getSuperficie(entry) {
  if (!entry) return ''
  const p = entry.parametres || {}
  if (p.surface_m2 != null && p.surface_m2 !== '') return p.surface_m2
  if (p.surface_ventilee != null && p.surface_ventilee !== '') return p.surface_ventilee
  if (p.surface_isolant != null && p.surface_isolant !== '') return p.surface_isolant
  if (p.surfaces && typeof p.surfaces === 'object') return Number(p.surfaces.chauffage) || ''
  return ''
}

function getSecteur(entry) {
  if (!entry) return ''
  const s = entry.parametres?.secteur
  if (!s) return ''
  return SECTEUR_LABELS[s] || s
}

function getFonctionnalites(entry) {
  if (!entry) return ''
  const p = entry.parametres || {}
  const f = entry.fiche_cee || ''
  if (f === 'BAT-TH-116' && p.surfaces && typeof p.surfaces === 'object') {
    const LABELS = { chauffage: 'Chauffage', refroidissement: 'Refroidissement', ecs: 'ECS', eclairage: 'Éclairage', auxiliaires: 'Auxiliaires' }
    return Object.entries(p.surfaces).filter(([, v]) => Number(v) > 0).map(([k]) => LABELS[k] || k).join(', ')
  }
  if (f === 'BAT-TH-163') return 'Chauffage / Climatisation (PAC)'
  if (f === 'BAT-TH-142') return 'Chauffage (Destratification)'
  if (f === 'IND-BA-110') return 'Récupération chaleur air comprimé'
  if (f === 'BAT-TH-125') return 'Ventilation simple flux'
  if (f === 'BAT-TH-126') return 'Ventilation double flux'
  return ''
}

function getZoneClimatique(entry) {
  if (!entry) return ''
  const p = entry.parametres || {}
  return p.zone_climatique || p.zone || ''
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExportMapping() {
  const C          = useAppTheme()
  const { dossiers, user, profile } = useStore()
  const fileInputRef = useRef(null)

  const [isDragging,       setIsDragging]       = useState(false)
  const [step,             setStep]             = useState(1)        // 1 | 2 | 3
  const [templateHeaders,  setTemplateHeaders]  = useState([])
  const [templateName,     setTemplateName]     = useState('')
  const [mapping,          setMapping]          = useState({})       // { colHeader: fieldId }
  const [simuMap,          setSimuMap]          = useState({})
  const [filterFiche,      setFilterFiche]      = useState('all')
  const [filterStatut,     setFilterStatut]     = useState('all')
  const [previewAll,       setPreviewAll]       = useState(false)

  const isAdmin    = profile?.role === 'admin'
  const myDossiers = isAdmin ? dossiers : dossiers.filter(d => d.assigne_a === user?.id)
  const fiches     = [...new Set(myDossiers.map(d => d.fiche_cee).filter(Boolean))]

  // ── Chargement simulations ────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return
    const load = async () => {
      const { data } = await supabase
        .from('simulations')
        .select('dossier_id, mwh_cumac, fiche_cee, parametres')
        .order('created_at', { ascending: false })
      if (!data) return
      const map = {}
      for (const s of data) {
        if (!map[s.dossier_id]) map[s.dossier_id] = { mwh_cumac: s.mwh_cumac, fiche_cee: s.fiche_cee, parametres: s.parametres }
      }
      setSimuMap(map)
    }
    load()
  }, [user?.id])

  // ── Sauvegarde mapping en localStorage ───────────────────────────────────

  useEffect(() => {
    if (templateHeaders.length === 0) return
    try { localStorage.setItem(`picpus_exmap_${templateHeaders.join('|')}`, JSON.stringify(mapping)) } catch {}
  }, [mapping, templateHeaders])

  // ── Lecture du fichier template ───────────────────────────────────────────

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) parseTemplate(file)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseTemplate(file)
  }

  const parseTemplate = async (file) => {
    setTemplateName(file.name)
    const ext = file.name.split('.').pop().toLowerCase()
    let headers = []

    if (ext === 'csv') {
      const text = await file.text()
      const firstLine = text.split('\n')[0]
      const sep = firstLine.includes(';') ? ';' : ','
      headers = firstLine.split(sep).map(h => h.trim().replace(/^[﻿"']|["']$/g, '')).filter(Boolean)
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { type: 'array' })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
      headers = (rows[0] || []).map(h => String(h ?? '').trim()).filter(Boolean)
    }

    if (headers.length === 0) return
    setTemplateHeaders(headers)

    try {
      const saved = localStorage.getItem(`picpus_exmap_${headers.join('|')}`)
      setMapping(saved ? JSON.parse(saved) : {})
    } catch { setMapping({}) }

    setStep(2)
  }

  // ── Valeur d'un champ pour un dossier ────────────────────────────────────

  const getValue = (d, fieldId) => {
    const p    = d.prospects || {}
    const simu = simuMap[d.id]
    const site = parseAdresse(d.adresse_site)
    switch (fieldId) {
      case 'ref':                return d.ref || ''
      case 'statut':             return STATUT_LABELS[d.statut] || d.statut || ''
      case 'fiche_cee':          return d.fiche_cee || ''
      case 'created_at':         return d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : ''
      case 'raison_sociale':     return p.raison_sociale || ''
      case 'siret':              return p.siret || ''
      case 'naf':                return p.naf || ''
      case 'contact_nom':        return p.contact_nom || ''
      case 'contact_prenom':     return p.contact_prenom || ''
      case 'contact_tel':        return p.contact_tel || ''
      case 'contact_email':      return p.contact_email || ''
      case 'adresse_siege':      return p.adresse || ''
      case 'cp_siege':           return p.code_postal || ''
      case 'ville_siege':        return p.ville || ''
      case 'adresse_site':       return d.adresse_site || ''
      case 'adresse_site_rue':   return site.adresse
      case 'adresse_site_cp':    return site.cp
      case 'adresse_site_ville': return site.ville
      case 'prime_estimee':      return d.prime_estimee ?? ''
      case 'marge_nette': {
        const prime = d.prime_estimee || 0
        const cout  = d.montant_devis  || 0
        return prime > 0 ? Math.round((prime * 0.9 - cout) * 100) / 100 : ''
      }
      case 'mwh_cumac':        return simu?.mwh_cumac ?? ''
      case 'superficie':       return getSuperficie(simu)
      case 'secteur':          return getSecteur(simu)
      case 'fonctionnalites':  return getFonctionnalites(simu)
      case 'zone_climatique':  return getZoneClimatique(simu)
      default:                 return ''
    }
  }

  // ── Filtrage + génération lignes ──────────────────────────────────────────

  const filteredDossiers = myDossiers.filter(d => {
    if (filterFiche  !== 'all' && d.fiche_cee !== filterFiche)  return false
    if (filterStatut !== 'all' && d.statut    !== filterStatut) return false
    return true
  })

  const buildRows = () => filteredDossiers.map(d =>
    templateHeaders.map(h => {
      const fieldId = mapping[h] || ''
      return fieldId ? getValue(d, fieldId) : ''
    })
  )

  // ── Téléchargement CSV ────────────────────────────────────────────────────

  const downloadCSV = () => {
    const rows = buildRows()
    const esc  = (v) => { const s = String(v ?? ''); return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s }
    const csv  = '﻿' + [templateHeaders.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\n')
    trigger(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `export_${today()}.csv`)
  }

  // ── Téléchargement XLSX ───────────────────────────────────────────────────

  const downloadXLSX = () => {
    const rows = buildRows()
    const data = [templateHeaders, ...rows.map(r => r.map(v => v ?? ''))]
    const ws   = XLSX.utils.aoa_to_sheet(data)
    const wb   = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Export')
    XLSX.writeFile(wb, `export_${today()}.xlsx`)
  }

  const today   = () => new Date().toISOString().slice(0, 10)
  const trigger = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Dérivés UI ────────────────────────────────────────────────────────────

  const mappedCount  = templateHeaders.filter(h => mapping[h]).length
  const allRows      = step === 3 ? buildRows() : []
  const displayRows  = previewAll ? allRows : allRows.slice(0, 5)

  const fieldLabel = (id) => DOSSIER_FIELDS.find(f => f.id === id)?.label || id

  const resetTemplate = () => { setStep(1); setTemplateHeaders([]); setTemplateName(''); setMapping({}) }

  // INP style réutilisable
  const INP = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 12px', color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', cursor: 'pointer' }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "system-ui,'Segoe UI',Arial,sans-serif" }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0, marginBottom: 4 }}>Export personnalisé</h1>
          <p style={{ fontSize: 13, color: C.textMid, margin: 0 }}>
            Importez votre modèle de tableau, mappez les colonnes et téléchargez vos données
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36 }}>
          {[
            { n: 1, label: 'Import modèle' },
            { n: 2, label: 'Mapping colonnes' },
            { n: 3, label: 'Aperçu & export' },
          ].map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                cursor: step > s.n ? 'pointer' : 'default' }}
                onClick={() => step > s.n && setStep(s.n)}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: step > s.n ? C.accent : step === s.n ? C.accent : C.border,
                  color: step >= s.n ? '#fff' : C.textSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  border: `2px solid ${step >= s.n ? C.accent : C.border}`,
                  transition: 'all .25s', flexShrink: 0,
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: step >= s.n ? C.accent : C.textSoft, whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div style={{ flex: 1, height: 2, background: step > s.n ? C.accent : C.border, transition: 'background .25s', margin: '0 8px', marginBottom: 16 }} />
              )}
            </div>
          ))}
        </div>

        {/* ── ÉTAPE 1 : Import ── */}
        {step === 1 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '32px 36px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Importer votre modèle de tableau</div>
            <div style={{ fontSize: 13, color: C.textMid, marginBottom: 28 }}>
              Chargez un fichier <strong>CSV</strong> ou <strong>Excel (.xlsx)</strong> dont la première ligne contient les en-têtes de colonnes à remplir. Le mapping sera mémorisé automatiquement pour la prochaine fois.
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? C.accent : C.border}`,
                borderRadius: 14, padding: '52px 24px', textAlign: 'center', cursor: 'pointer',
                background: isDragging ? C.accent + '0a' : C.bg,
                transition: 'all .18s',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 14 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                Glissez votre modèle ici
              </div>
              <div style={{ fontSize: 13, color: C.textSoft, marginBottom: 18 }}>ou cliquez pour parcourir vos fichiers</div>
              <div style={{ display: 'inline-flex', background: C.accent, color: '#fff', borderRadius: 9, padding: '10px 24px', fontSize: 13, fontWeight: 700, alignItems: 'center', gap: 7 }}>
                📂 Choisir un fichier
              </div>
              <div style={{ fontSize: 11, color: C.textSoft, marginTop: 14 }}>CSV, XLSX, XLS — première ligne = en-têtes</div>
            </div>

            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
        )}

        {/* ── ÉTAPE 2 : Mapping ── */}
        {step === 2 && (
          <div>
            {/* Info fichier */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 20px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>
                  Mapper les {templateHeaders.length} colonnes
                </div>
                <div style={{ fontSize: 12, color: C.textSoft }}>
                  Fichier : <span style={{ color: C.textMid, fontWeight: 600 }}>{templateName}</span>
                  {' · '}
                  <button onClick={resetTemplate} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'inherit' }}>
                    Changer de fichier
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, color: C.textMid }}>
                  <span style={{ color: mappedCount > 0 ? '#16A34A' : C.textSoft, fontWeight: 700, fontSize: 18 }}>{mappedCount}</span>
                  <span style={{ color: C.textSoft }}> / {templateHeaders.length} mappées</span>
                </div>
                <button onClick={() => setStep(3)} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Aperçu →
                </button>
              </div>
            </div>

            {/* Table mapping */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr', gap: 12, padding: '10px 16px', background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, color: C.textSoft, textTransform: 'uppercase', letterSpacing: .5 }}>
                <span>#</span>
                <span>Colonne du modèle</span>
                <span>Donnée dossier à insérer</span>
              </div>

              {templateHeaders.map((h, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr', gap: 12, padding: '10px 16px', borderBottom: i < templateHeaders.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center', background: i % 2 === 0 ? C.surface : C.bg }}>
                  <span style={{ fontSize: 11, color: C.textSoft, fontWeight: 700 }}>{i + 1}</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h}>
                    {h}
                  </div>
                  <select
                    value={mapping[h] || ''}
                    onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                    style={{ ...INP, color: mapping[h] ? C.text : C.textSoft }}
                  >
                    {FIELD_GROUPS_ORDER.map(group => {
                      const fields = DOSSIER_FIELDS.filter(f => f.group === group)
                      if (group === '') return fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)
                      return (
                        <optgroup key={group} label={group}>
                          {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </optgroup>
                      )
                    })}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={() => setStep(3)} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 9, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Voir l'aperçu →
              </button>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 3 : Aperçu & export ── */}
        {step === 3 && (
          <div>
            {/* Filtres */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Filtrer les dossiers</div>

              {/* Fiche tags */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {['all', ...fiches].map(f => {
                  const meta   = FICHE_META[f]
                  const color  = meta?.color || C.accent
                  const label  = f === 'all' ? 'Toutes fiches' : (meta?.label || f)
                  const active = filterFiche === f
                  const count  = f === 'all' ? myDossiers.length : myDossiers.filter(d => d.fiche_cee === f).length
                  return (
                    <button key={f} onClick={() => setFilterFiche(f)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: active ? color : C.bg,
                      color: active ? '#fff' : (f === 'all' ? C.textSoft : color),
                      border: `1px solid ${active ? 'transparent' : (f === 'all' ? C.border : color + '66')}`,
                      borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {label}
                      <span style={{ fontSize: 10, background: active ? 'rgba(255,255,255,.2)' : color + '22', color: active ? '#fff' : color, borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>{count}</span>
                    </button>
                  )
                })}
              </div>

              {/* Statut tags */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {[{ id: 'all', label: 'Tous statuts', color: C.accent }, ...STATUTS].map(s => {
                  const active = filterStatut === s.id
                  const color  = s.id === 'all' ? C.accent : s.color
                  const count  = s.id === 'all' ? myDossiers.length : myDossiers.filter(d => d.statut === s.id).length
                  if (count === 0 && s.id !== 'all') return null
                  return (
                    <button key={s.id} onClick={() => setFilterStatut(s.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: active ? color : C.bg,
                      color: active ? '#fff' : color,
                      border: `1px solid ${active ? 'transparent' : color + '55'}`,
                      borderRadius: 20, padding: '4px 11px', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      {s.label}
                      <span style={{ fontSize: 10, background: active ? 'rgba(255,255,255,.2)' : color + '22', color: active ? '#fff' : color, borderRadius: 10, padding: '1px 5px', fontWeight: 700 }}>{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Barre résumé + boutons export */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: C.textMid }}>
                <strong style={{ color: C.text }}>{filteredDossiers.length}</strong> dossier{filteredDossiers.length !== 1 ? 's' : ''}
                {' · '}
                <strong style={{ color: C.text }}>{templateHeaders.length}</strong> colonnes
                {' · '}
                <strong style={{ color: C.accent }}>{mappedCount}</strong> mappées
                <span style={{ marginLeft: 8 }}>·</span>
                <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 13, padding: '0 6px', fontFamily: 'inherit' }}>
                  Modifier le mapping
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={downloadCSV} disabled={filteredDossiers.length === 0}
                  style={{ background: C.surface, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: filteredDossiers.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⬇︎ CSV
                </button>
                <button onClick={downloadXLSX} disabled={filteredDossiers.length === 0}
                  style={{ background: filteredDossiers.length === 0 ? C.border : '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: filteredDossiers.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⬇︎ Excel (.xlsx)
                </button>
              </div>
            </div>

            {/* Tableau aperçu */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'auto' }}>
                  <thead>
                    <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                      {templateHeaders.map((h, i) => (
                        <th key={i} style={{ padding: '9px 13px', textAlign: 'left', whiteSpace: 'nowrap', borderRight: i < templateHeaders.length - 1 ? `1px solid ${C.border}` : 'none', minWidth: 100 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: mapping[h] ? C.text : C.textSoft }}>{h}</div>
                          {mapping[h] ? (
                            <div style={{ fontSize: 10, color: C.accent, fontWeight: 500, marginTop: 2 }}>↳ {fieldLabel(mapping[h])}</div>
                          ) : (
                            <div style={{ fontSize: 10, color: C.textSoft, fontStyle: 'italic', marginTop: 2 }}>non mappée</div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.length === 0 ? (
                      <tr>
                        <td colSpan={templateHeaders.length} style={{ padding: '40px 16px', textAlign: 'center', color: C.textSoft, fontSize: 13 }}>
                          Aucun dossier correspondant
                        </td>
                      </tr>
                    ) : displayRows.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: `1px solid ${C.border}`, background: ri % 2 === 0 ? C.surface : C.bg }}>
                        {row.map((val, ci) => (
                          <td key={ci} style={{ padding: '9px 13px', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', borderRight: ci < row.length - 1 ? `1px solid ${C.border}` : 'none', color: val !== '' ? C.text : C.textSoft, fontStyle: val !== '' ? 'normal' : 'italic' }}>
                            {val !== '' ? String(val) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {allRows.length > 5 && (
                <div style={{ padding: '10px 16px', background: C.bg, borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
                  <button onClick={() => setPreviewAll(p => !p)} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                    {previewAll
                      ? `▲ Réduire (afficher 5 lignes)`
                      : `▼ Afficher les ${allRows.length} lignes`}
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
