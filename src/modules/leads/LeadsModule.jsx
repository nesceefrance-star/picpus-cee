// src/modules/leads/LeadsModule.jsx
import { useState, useRef, useCallback, lazy, Suspense } from 'react';
import { useLeads, CHAMPS_MAPPING } from './useLeads';
const CadastreMap = lazy(() => import('../../components/CadastreMap'));

const C = {
  bg: '#0F1923', bgCard: '#16212E', bgCardHover: '#1C2B3A', bgInput: '#111C27',
  border: '#1E2F40', borderLight: '#263A4E',
  accent: '#00C6FF', accentSoft: 'rgba(0,198,255,0.10)', accentDim: 'rgba(0,198,255,0.06)',
  green: '#00D09E', greenSoft: 'rgba(0,208,158,0.10)',
  orange: '#FF8C42', orangeSoft: 'rgba(255,140,66,0.10)',
  red: '#FF5A65', redSoft: 'rgba(255,90,101,0.10)',
  yellow: '#FFD166', yellowSoft: 'rgba(255,209,102,0.10)',
  purple: '#A78BFA', purpleSoft: 'rgba(167,139,250,0.10)',
  text: '#E8F0F7', textSub: '#7A99B0', textDim: '#3D5570',
  linkedin: '#0A66C2', lusha: '#6E3FF3',
};

const LEAD_TYPES = ['Industrie', 'Tertiaire', 'Commerce', 'Logistique', 'Santé', 'Hôtellerie', 'Enseignement', 'Autre'];

const SCORE_CONFIG = [
  { min: 90, label: 'S1', color: C.green,   bg: C.greenSoft,  tip: 'Cible principale' },
  { min: 70, label: 'S2', color: C.accent,  bg: C.accentSoft, tip: 'Cible secondaire' },
  { min: 40, label: 'S3', color: C.yellow,  bg: C.yellowSoft, tip: 'Décideur général' },
  { min: 0,  label: 'S4', color: C.textSub, bg: 'rgba(122,153,176,0.08)', tip: 'Hors cible' },
];
function getScoreCfg(score) { return SCORE_CONFIG.find(c => score >= c.min) ?? SCORE_CONFIG[3]; }

const STATUT_CFG = {
  'À qualifier':         { color: C.textSub, bg: 'rgba(122,153,176,0.10)' },
  'Contacté':            { color: C.accent,  bg: C.accentSoft },
  'RDV planifié':        { color: C.yellow,  bg: C.yellowSoft },
  'Non qualifié':        { color: C.red,     bg: C.redSoft },
  'Non pertinent':       { color: C.textDim, bg: 'rgba(61,85,112,0.15)' },
  'Converti en dossier': { color: C.green,   bg: C.greenSoft },
};

// ─── MICRO-COMPOSANTS ────────────────────────────────────────────
function Badge({ label, color, bg, size = 11 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20,
      fontSize: size, fontWeight: 700, color, background: bg, border: `1px solid ${color}30`, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function ScoreDot({ score }) {
  const cfg = getScoreCfg(score);
  return (
    <div title={`${cfg.tip} — score ${score}`} style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: cfg.bg, border: `2px solid ${cfg.color}50`,
      fontSize: 10, fontWeight: 800, color: cfg.color,
    }}>{cfg.label}</div>
  );
}

function Btn({ onClick, disabled, loading: isLoading, icon, label, color = C.accent, small = false }) {
  return (
    <button onClick={onClick} disabled={disabled || isLoading} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: small ? '4px 10px' : '6px 13px', borderRadius: 7,
      border: `1px solid ${color}30`, background: `${color}12`, color,
      fontSize: small ? 11 : 12, fontWeight: 700,
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, transition: 'all .15s', whiteSpace: 'nowrap', fontFamily: 'inherit',
    }}
      onMouseEnter={e => { if (!disabled && !isLoading) e.currentTarget.style.background = `${color}22`; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}12`; }}>
      {isLoading
        ? <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: `2px solid ${color}40`, borderTopColor: color, animation: 'spin .7s linear infinite' }} />
        : icon}
      {label}
    </button>
  );
}

// ─── MODAL ÉTAPE 1 : infos batch + sélection fichier ─────────────
function ImportModal({ onClose, onAnalyser, analyseEnCours, profiles, isAdmin }) {
  const [nom,      setNom]      = useState('');
  const [leadType, setLeadType] = useState('Industrie');
  const [assigneA, setAssigneA] = useState('');
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !nom.trim()) return;
    await onAnalyser(file, { nom: nom.trim(), leadType, assigneA: assigneA || null });
    e.target.value = '';
  };

  const inpStyle = {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8,
    border: `1px solid ${C.borderLight}`, background: C.bgInput, color: C.text,
    fontSize: 13, outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.borderLight}`, borderRadius: 14, padding: '28px 32px', width: 440, maxWidth: '95vw' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 20 }}>📥 Nouvel import de leads</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textSub, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Nom du batch *</div>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="ex : Industrie IDF Q2 2026" style={inpStyle} autoFocus />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textSub, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Type de lead</div>
            <select value={leadType} onChange={e => setLeadType(e.target.value)} style={{ ...inpStyle, cursor: 'pointer' }}>
              {LEAD_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {isAdmin && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textSub, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Assigné à</div>
              <select value={assigneA} onChange={e => setAssigneA(e.target.value)} style={{ ...inpStyle, cursor: 'pointer' }}>
                <option value="">— Moi-même —</option>
                {profiles.filter(p => p.role !== 'admin' || p.id).map(p => (
                  <option key={p.id} value={p.id}>{p.prenom} {p.nom} {p.role === 'admin' ? '(admin)' : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ background: C.accentDim, border: `1px dashed ${C.accent}40`, borderRadius: 8, padding: 14, textAlign: 'center', marginTop: 4 }}>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 10 }}>
              Fichier Excel (.xlsx / .xls) — n'importe quelle structure<br />
              <span style={{ color: C.textDim, fontSize: 11 }}>Le mapping des colonnes sera détecté automatiquement</span>
            </div>
            <button onClick={() => { if (nom.trim()) fileRef.current.click(); }}
              disabled={!nom.trim() || analyseEnCours}
              style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: nom.trim() && !analyseEnCours ? C.accent : C.borderLight, color: nom.trim() && !analyseEnCours ? C.bg : C.textDim, fontWeight: 800, fontSize: 13, cursor: nom.trim() && !analyseEnCours ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              {analyseEnCours ? '⏳ Analyse en cours…' : '📂 Choisir un fichier'}
            </button>
            {!nom.trim() && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>Renseignez d'abord le nom du batch</div>}
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
        <button onClick={onClose} style={{ marginTop: 16, width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSub, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── MODAL ÉTAPE 2 : validation du mapping ────────────────────────
function MappingModal({ analyseData, onImport, onCancel, importing }) {
  const { headers, mapping: detected, sampleRows, totalRows } = analyseData;
  const [mapping, setMapping] = useState({ ...detected });

  const sample = sampleRows?.[0] ?? {};
  const inpStyle = { padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.borderLight}`, background: C.bgInput, color: C.text, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', width: '100%' };

  const groups = [
    { key: 'societe', label: '🏢 Société' },
    { key: 'contact', label: '👤 Contact' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.borderLight}`, borderRadius: 14, width: 680, maxWidth: '98vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>🗂 Correspondance des colonnes</div>
          <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>
            {totalRows} ligne{totalRows > 1 ? 's' : ''} détectée{totalRows > 1 ? 's' : ''} · Vérifie les correspondances et corrige si nécessaire
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {groups.map(grp => (
            <div key={grp.key} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{grp.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CHAMPS_MAPPING.filter(c => c.group === grp.key).map(champ => {
                  const colonne = mapping[champ.key];
                  const exemple = colonne ? String(sample[colonne] ?? '').slice(0, 60) : '';
                  return (
                    <div key={champ.key} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 10, alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: colonne ? C.accentDim : 'transparent', border: `1px solid ${colonne ? C.borderLight : C.border}` }}>
                      <div style={{ fontSize: 12, color: colonne ? C.text : C.textDim, fontWeight: champ.req ? 700 : 500 }}>
                        {champ.label}
                      </div>
                      <select value={colonne ?? ''} onChange={e => setMapping(m => ({ ...m, [champ.key]: e.target.value || null }))} style={inpStyle}>
                        <option value="">— Ignorer —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <div style={{ fontSize: 11, color: C.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exemple || <span style={{ color: C.textDim, fontStyle: 'italic' }}>—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSub, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Annuler
          </button>
          <button onClick={() => onImport(mapping)} disabled={!mapping.raison_sociale || importing}
            style={{ flex: 1, padding: '9px 20px', borderRadius: 8, border: 'none', background: mapping.raison_sociale && !importing ? C.accent : C.borderLight, color: mapping.raison_sociale && !importing ? C.bg : C.textDim, fontWeight: 800, fontSize: 13, cursor: mapping.raison_sociale && !importing ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            {importing ? '⏳ Import en cours…' : `✅ Importer ${totalRows} lignes`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PANEL HISTORIQUE BATCHES ─────────────────────────────────────
function BatchPanel({ batches, selectedBatchId, onSelect, onDelete, onReassign, isAdmin, profiles, loadingBatches }) {
  const [reassigning, setReassigning] = useState(null);

  const typeColor = (t) => {
    const map = { Industrie: C.orange, Tertiaire: C.accent, Commerce: C.yellow, Logistique: C.purple, Santé: C.green };
    return map[t] || C.textSub;
  };

  return (
    <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0, borderRight: `1px solid ${C.border}`, minHeight: 0 }}>
      {/* Header panel */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Imports ({batches.length})
        </div>
      </div>

      {/* Tous les leads */}
      <button onClick={() => onSelect(null)} style={{
        padding: '10px 16px', border: 'none', borderBottom: `1px solid ${C.border}`,
        background: selectedBatchId === null ? C.accentDim : 'transparent',
        color: selectedBatchId === null ? C.accent : C.textSub,
        textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
        borderLeft: `3px solid ${selectedBatchId === null ? C.accent : 'transparent'}`,
      }}>
        🗂 Tous mes leads
      </button>

      {/* Liste batches */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loadingBatches ? (
          <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>Chargement…</div>
        ) : batches.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12 }}>Aucun import</div>
        ) : (
          batches.map(b => {
            const active = selectedBatchId === b.id;
            const tc = typeColor(b.lead_type);
            return (
              <div key={b.id} style={{
                borderBottom: `1px solid ${C.border}`,
                borderLeft: `3px solid ${active ? C.accent : 'transparent'}`,
                background: active ? C.accentDim : 'transparent',
                transition: 'background .15s',
              }}>
                <div onClick={() => onSelect(b.id)} style={{ padding: '10px 14px', cursor: 'pointer' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.parentElement.style.background = C.bgCardHover; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.parentElement.style.background = 'transparent'; }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: active ? C.accent : C.text, lineHeight: 1.3 }}>{b.nom}</div>
                    <button onClick={e => { e.stopPropagation(); if (confirm(`Supprimer l'import "${b.nom}" et toutes ses sociétés ?`)) onDelete(b.id); }}
                      style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0 }}
                      title="Supprimer">🗑</button>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                    <Badge label={b.lead_type} color={tc} bg={`${tc}15`} size={10} />
                    <Badge label={`${b.nb_societes} soc.`} color={C.textSub} bg="rgba(122,153,176,0.08)" size={10} />
                    <Badge label={`${b.nb_contacts} ct.`} color={C.textSub} bg="rgba(122,153,176,0.08)" size={10} />
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim }}>
                    {new Date(b.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {b.assignee && <span style={{ marginLeft: 6, color: C.purple }}>→ {b.assignee.prenom} {b.assignee.nom}</span>}
                  </div>

                  {/* Réassignation admin */}
                  {isAdmin && (
                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 6 }}>
                      {reassigning === b.id ? (
                        <select
                          autoFocus
                          defaultValue={b.assigne_a}
                          onBlur={() => setReassigning(null)}
                          onChange={e => { onReassign(b.id, e.target.value); setReassigning(null); }}
                          style={{ width: '100%', fontSize: 11, padding: '3px 6px', borderRadius: 5, border: `1px solid ${C.borderLight}`, background: C.bgInput, color: C.text, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
                          {profiles.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                        </select>
                      ) : (
                        <button onClick={() => setReassigning(b.id)} style={{ fontSize: 10, background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 7px', color: C.textDim, cursor: 'pointer', fontFamily: 'inherit' }}>
                          ↗ Réassigner
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── LIGNE CONTACT ────────────────────────────────────────────────
function ContactRow({ contact, societeNom, onLusha, lushaLoading, onSetLinkedin }) {
  const [editingLi, setEditingLi] = useState(false);
  const [liInput,   setLiInput]   = useState(contact.linkedin_url ?? '');

  const handleOpenLinkedin = () => {
    if (contact.linkedin_url) window.open(contact.linkedin_url, '_blank');
    else window.open(`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`"${contact.prenom} ${contact.nom}" "${societeNom}"`)}`, '_blank');
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8,
      background: contact.rang_poste === 1 ? C.accentDim : 'transparent',
      border: `1px solid ${contact.rang_poste === 1 ? C.borderLight : 'transparent'}`,
    }}>
      <ScoreDot score={contact.score_poste ?? 0} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{contact.prenom} {contact.nom}</span>
          <span style={{ fontSize: 11, color: C.textSub }}>{contact.fonction}</span>
          {contact.rang_poste === 1 && <Badge label="Cible prioritaire" color={C.green} bg={C.greenSoft} />}
        </div>
        {contact.lusha_fetched && (
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            {contact.lusha_email && <a href={`mailto:${contact.lusha_email}`} style={{ fontSize: 12, color: C.accent, textDecoration: 'none' }}>✉ {contact.lusha_email}</a>}
            {contact.lusha_phone && <a href={`tel:${contact.lusha_phone}`} style={{ fontSize: 12, color: C.green, textDecoration: 'none' }}>☎ {contact.lusha_phone}</a>}
            {contact.lusha_mobile && contact.lusha_mobile !== contact.lusha_phone && <a href={`tel:${contact.lusha_mobile}`} style={{ fontSize: 12, color: C.yellow, textDecoration: 'none' }}>📱 {contact.lusha_mobile}</a>}
          </div>
        )}
        {editingLi && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <input value={liInput} onChange={e => setLiInput(e.target.value)} placeholder="https://linkedin.com/in/..."
              style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.borderLight}`, background: C.bgInput, color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
              onKeyDown={e => { if (e.key === 'Enter') { onSetLinkedin(contact.id, liInput); setEditingLi(false); } if (e.key === 'Escape') setEditingLi(false); }} autoFocus />
            <Btn onClick={() => { onSetLinkedin(contact.id, liInput); setEditingLi(false); }} icon="✓" label="OK" color={C.green} small />
            <Btn onClick={() => setEditingLi(false)} icon="✕" label="" color={C.red} small />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Btn onClick={handleOpenLinkedin}
          icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>}
          label={contact.linkedin_url ? 'Profil' : 'Chercher'} color={C.linkedin} small />
        <Btn onClick={() => setEditingLi(true)} icon="🔗" label="URL" color={C.textSub} small />
        <Btn onClick={() => onLusha(contact.id)} loading={lushaLoading[contact.id]} icon="📞" label={contact.lusha_fetched ? 'Actualiser' : 'Lusha'} color={C.lusha} small />
      </div>
    </div>
  );
}

// ─── CARTE SOCIÉTÉ ────────────────────────────────────────────────
function SocieteCard({ soc, cadastreLoading, lushaLoading, onCadastre, onLusha, onSetLinkedin, onStatut, onConvertir }) {
  const [open,    setOpen]    = useState(false);
  const [showMap, setShowMap] = useState(false);
  const statCfg = STATUT_CFG[soc.statut_qualification] ?? STATUT_CFG['À qualifier'];
  const contactsCibles = soc.contacts?.filter(c => (c.score_poste ?? 0) >= 70) ?? [];

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${open ? C.borderLight : C.border}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color .2s' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}>
        <ScoreDot score={soc.contacts?.[0]?.score_poste ?? 0} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{soc.raison_sociale}</span>
            <Badge label={soc.statut_qualification} color={statCfg.color} bg={statCfg.bg} />
            {soc.cadastre_fetched && soc.surface_bati_m2 > 0 && <Badge label={`🏗 ${soc.surface_bati_m2.toLocaleString()} m²`} color={C.yellow} bg={C.yellowSoft} />}
          </div>
          <div style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>
            📍 {soc.ville} {soc.cp} · {soc.activite}
            {soc.web && <a href={soc.web} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, color: C.accent, textDecoration: 'none' }} onClick={e => e.stopPropagation()}>🌐 Site</a>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {contactsCibles.length > 0 && <Badge label={`${contactsCibles.length} cible${contactsCibles.length > 1 ? 's' : ''}`} color={C.green} bg={C.greenSoft} />}
          <Badge label={`${soc.contacts?.length ?? 0} ct.`} color={C.textSub} bg="rgba(122,153,176,0.08)" />
          <span style={{ fontSize: 16, color: C.textDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 8, padding: '10px 18px', flexWrap: 'wrap', alignItems: 'center', background: C.bgInput, borderBottom: `1px solid ${C.border}` }}>
            <select value={soc.statut_qualification} onChange={e => { e.stopPropagation(); onStatut(soc.id, e.target.value); }}
              style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.borderLight}`, background: C.bgCard, color: C.text, fontSize: 12, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
              {Object.keys(STATUT_CFG).map(s => <option key={s}>{s}</option>)}
            </select>
            <Btn onClick={() => onCadastre(soc.id)} loading={cadastreLoading[soc.id]} icon="📐" label={soc.cadastre_fetched ? 'Recalculer' : 'Cadastre'} color={C.yellow} />
            <Btn onClick={() => { setShowMap(m => !m); if (!open) setOpen(true); }} icon="🗺" label={showMap ? 'Masquer carte' : 'Carte parcelles'} color={C.purple} />
            {soc.lien_geoportail && <Btn onClick={() => window.open(soc.lien_geoportail, '_blank')} icon="🌍" label="Géoportail" color={C.orange} />}
            {soc.lien_googlemaps && <Btn onClick={() => window.open(soc.lien_googlemaps, '_blank')} icon="🛰" label="Satellite" color={C.accent} />}
            <div style={{ marginLeft: 'auto' }}>
              <Btn onClick={() => onConvertir(soc.id)} icon="📁" label="Convertir en dossier" color={C.green} disabled={soc.statut_qualification === 'Converti en dossier'} />
            </div>
          </div>

          {soc.cadastre_fetched && (
            <div style={{ display: 'flex', gap: 16, padding: '10px 18px', background: `${C.yellow}08`, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {[
                { label: 'Parcelle', value: `${soc.section_cadastrale ?? '?'}${soc.numero_parcelle ?? '?'}` },
                { label: 'Surface parcelle', value: soc.surface_parcelle_m2 ? `${soc.surface_parcelle_m2.toLocaleString()} m²` : '—' },
                { label: soc.geocode_methode === 'exact' ? 'Emprise bâtiment ✓' : 'Emprise zone 30m', value: soc.surface_bati_m2 ? `${soc.surface_bati_m2.toLocaleString()} m²` : '—' },
                { label: 'Bâtiments', value: soc.nb_batiments ?? '—' },
                { label: 'SIRET', value: soc.siret ?? '—' },
                { label: 'Source GPS', value: soc.geocode_source === 'sirene' ? '📍 SIRENE' : '📍 BAN' },
                { label: 'Adresse normalisée', value: soc.adresse_normalisee ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ minWidth: 110 }}>
                  <div style={{ fontSize: 10, color: C.textSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: label.includes('SIRENE') || label === 'Source GPS' ? C.green : C.text, marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {showMap && (
            <div style={{ padding: '0 18px 14px' }}>
              <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: C.textSub, fontSize: 12 }}>Chargement carte…</div>}>
                <CadastreMap
                  adresse={soc.adresse}
                  codePostal={soc.cp}
                  ville={soc.ville}
                  siret={soc.siret ?? ''}
                  raisonSociale={soc.raison_sociale}
                  dossierId={`lead_${soc.id}`}
                />
              </Suspense>
            </div>
          )}

          <div style={{ padding: '10px 18px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: C.textDim }}>Score poste :</span>
              {SCORE_CONFIG.map(c => <Badge key={c.label} label={`${c.label} ${c.tip}`} color={c.color} bg={c.bg} size={10} />)}
            </div>
            {(soc.contacts ?? []).map(contact => (
              <ContactRow key={contact.id} contact={contact} societeNom={soc.raison_sociale}
                onLusha={onLusha} lushaLoading={lushaLoading} onSetLinkedin={onSetLinkedin} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MODULE PRINCIPAL ─────────────────────────────────────────────
export default function LeadsModule() {
  const {
    batches, loadingBatches, selectedBatchId, selectBatch, reassignerBatch, supprimerBatch,
    societes, societesBrutes, loading, importing, error,
    cadastreLoading, lushaLoading,
    searchQuery, setSearchQuery, filterStatut, setFilterStatut, sortBy, setSortBy,
    importerExcel, analyserImport, clearAnalyse, analyseData, analyseEnCours,
    enrichirCadastre, enrichirLusha,
    setLinkedinUrl, setStatutSociete, convertirEnDossier,
    profiles, isAdmin,
  } = useLeads();

  const [showImportModal, setShowImportModal] = useState(false);
  const [importMsg,       setImportMsg]       = useState(null);

  const handleAnalyser = useCallback(async (file, opts) => {
    setShowImportModal(false);
    await analyserImport(file, opts);
  }, [analyserImport]);

  const handleImport = useCallback(async (mapping) => {
    setImportMsg(null);
    try {
      const { imported, batch } = await importerExcel(mapping);
      setImportMsg({ type: 'ok', text: `✅ ${imported} société(s) importée(s) dans "${batch.nom}"` });
    } catch (e) {
      setImportMsg({ type: 'err', text: `❌ Import échoué : ${e.message}` });
    }
  }, [importerExcel]);

  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  const stats = {
    total:     societesBrutes.length,
    cibles:    societesBrutes.filter(s => s.contacts?.some(c => (c.score_poste ?? 0) >= 90)).length,
    enrichies: societesBrutes.filter(s => s.cadastre_fetched).length,
    lusha:     societesBrutes.reduce((acc, s) => acc + (s.contacts?.filter(c => c.lusha_fetched).length ?? 0), 0),
  };

  const STATUTS_FILTRE = ['Tous', ...Object.keys(STATUT_CFG)];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'DM Sans', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={{ background: 'linear-gradient(135deg, #0A1420 0%, #0F1923 100%)', borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text, letterSpacing: '-0.03em' }}>
            Qualification <span style={{ color: C.accent }}>Leads</span>
            {selectedBatch && <span style={{ fontSize: 13, fontWeight: 500, color: C.textSub, marginLeft: 10 }}>· {selectedBatch.nom}</span>}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowImportModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: C.accent, color: C.bg, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          📥 Nouvel import
        </button>
      </div>

      {/* ── Body (split: panel gauche + contenu) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Panel historique batches */}
        <BatchPanel
          batches={batches} selectedBatchId={selectedBatchId} loadingBatches={loadingBatches}
          onSelect={selectBatch} onDelete={supprimerBatch} onReassign={reassignerBatch}
          isAdmin={isAdmin} profiles={profiles}
        />

        {/* Contenu principal */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {importMsg && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: importMsg.type === 'ok' ? C.greenSoft : C.redSoft,
              color: importMsg.type === 'ok' ? C.green : C.red,
              border: `1px solid ${importMsg.type === 'ok' ? C.green : C.red}30` }}>
              {importMsg.text}
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: C.redSoft, color: C.red, border: `1px solid ${C.red}30` }}>
              ⚠ {error}
            </div>
          )}

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
            {[
              { label: 'Sociétés', value: stats.total, color: C.text },
              { label: 'Cibles S1', value: stats.cibles, color: C.green },
              { label: 'Cadastres', value: stats.enrichies, color: C.yellow },
              { label: 'Lusha', value: stats.lusha, color: C.lusha },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, color: C.textSub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 3, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Filtres */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍  Rechercher société, ville, activité..."
              style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.bgInput, color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.bgInput, color: C.text, fontSize: 12, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
              {STATUTS_FILTRE.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.bgInput, color: C.text, fontSize: 12, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
              <option value="score">🎯 Meilleure cible</option>
              <option value="surface">🏗 Surface bâtiment</option>
              <option value="statut">📋 Statut avancement</option>
              <option value="date">📅 Date import</option>
            </select>
            <div style={{ fontSize: 12, color: C.textSub, padding: '7px 12px', background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <b style={{ color: C.text }}>{societes.length}</b> société{societes.length > 1 ? 's' : ''}
            </div>
          </div>

          {/* Liste sociétés */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.textSub }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.accent, animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
              Chargement…
            </div>
          ) : societes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 24px', background: C.bgCard, borderRadius: 14, border: `1px dashed ${C.borderLight}`, color: C.textSub }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>
                {selectedBatchId ? 'Aucune société dans cet import' : 'Aucun lead trouvé'}
              </div>
              <div style={{ fontSize: 13 }}>
                {selectedBatchId ? 'Cet import est vide ou ne vous est pas assigné.' : 'Commencez par importer un fichier Excel.'}
              </div>
              <button onClick={() => setShowImportModal(true)}
                style={{ marginTop: 16, padding: '9px 20px', borderRadius: 8, background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}30`, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                📥 Nouvel import
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {societes.map(soc => (
                <SocieteCard key={soc.id} soc={soc}
                  cadastreLoading={cadastreLoading} lushaLoading={lushaLoading}
                  onCadastre={enrichirCadastre} onLusha={enrichirLusha}
                  onSetLinkedin={setLinkedinUrl} onStatut={setStatutSociete} onConvertir={convertirEnDossier} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal étape 1 : infos batch */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onAnalyser={handleAnalyser}
          analyseEnCours={analyseEnCours}
          profiles={profiles}
          isAdmin={isAdmin}
        />
      )}

      {/* Modal étape 2 : validation mapping */}
      {analyseData && !analyseEnCours && (
        <MappingModal
          analyseData={analyseData}
          onImport={handleImport}
          onCancel={clearAnalyse}
          importing={importing}
        />
      )}
    </div>
  );
}
