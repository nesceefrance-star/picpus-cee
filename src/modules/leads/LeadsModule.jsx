// src/modules/leads/LeadsModule.jsx
// ═══════════════════════════════════════════════════════════════════
//  MODULE QUALIFICATION LEADS — Composant principal
//  Stack : React 18 + Vite · Supabase · inline styles (palette C)
//  Standalone : s'intègre via <LeadsModule /> dans ton router
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback } from 'react';
import { useLeads } from './useLeads';

// ─── PALETTE (cohérente avec ton CRM) ────────────────────────────
const C = {
  bg:          '#0F1923',
  bgCard:      '#16212E',
  bgCardHover: '#1C2B3A',
  bgInput:     '#111C27',
  border:      '#1E2F40',
  borderLight: '#263A4E',
  accent:      '#00C6FF',
  accentSoft:  'rgba(0,198,255,0.10)',
  accentDim:   'rgba(0,198,255,0.06)',
  green:       '#00D09E',
  greenSoft:   'rgba(0,208,158,0.10)',
  orange:      '#FF8C42',
  orangeSoft:  'rgba(255,140,66,0.10)',
  red:         '#FF5A65',
  redSoft:     'rgba(255,90,101,0.10)',
  yellow:      '#FFD166',
  yellowSoft:  'rgba(255,209,102,0.10)',
  text:        '#E8F0F7',
  textSub:     '#7A99B0',
  textDim:     '#3D5570',
  linkedin:    '#0A66C2',
  lusha:       '#6E3FF3',
};

// ─── SCORE BADGE ─────────────────────────────────────────────────
const SCORE_CONFIG = [
  { min: 90, label: 'S1', color: C.green,  bg: C.greenSoft,  tip: 'Cible principale' },
  { min: 70, label: 'S2', color: C.accent, bg: C.accentSoft, tip: 'Cible secondaire' },
  { min: 40, label: 'S3', color: C.yellow, bg: C.yellowSoft, tip: 'Décideur général' },
  { min: 0,  label: 'S4', color: C.textSub,bg: 'rgba(122,153,176,0.08)', tip: 'Hors cible' },
];
function getScoreCfg(score) {
  return SCORE_CONFIG.find(c => score >= c.min) ?? SCORE_CONFIG[3];
}

// ─── STATUT COULEURS ─────────────────────────────────────────────
const STATUT_CFG = {
  'À qualifier':          { color: C.textSub,  bg: 'rgba(122,153,176,0.10)' },
  'Contacté':             { color: C.accent,   bg: C.accentSoft },
  'RDV planifié':         { color: C.yellow,   bg: C.yellowSoft },
  'Non qualifié':         { color: C.red,      bg: C.redSoft },
  'Converti en dossier':  { color: C.green,    bg: C.greenSoft },
};

// ─── MICRO-COMPOSANTS ────────────────────────────────────────────
function Badge({ label, color, bg, size = 11 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20,
      fontSize: size, fontWeight: 700, letterSpacing: '0.03em',
      color, background: bg, border: `1px solid ${color}30`,
      whiteSpace: 'nowrap',
    }}>{label}</span>
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
      padding: small ? '4px 10px' : '6px 13px',
      borderRadius: 7, border: `1px solid ${color}30`,
      background: `${color}12`, color,
      fontSize: small ? 11 : 12, fontWeight: 700, cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, transition: 'all .15s', whiteSpace: 'nowrap',
      fontFamily: 'inherit',
    }}
    onMouseEnter={e => { if (!disabled && !isLoading) e.currentTarget.style.background = `${color}22`; }}
    onMouseLeave={e => { e.currentTarget.style.background = `${color}12`; }}>
      {isLoading
        ? <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: `2px solid ${color}40`, borderTopColor: color, animation: 'spin .7s linear infinite' }}/>
        : icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, color = C.accent }) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: '14px 18px',
    }}>
      <div style={{ fontSize: 10, color: C.textSub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ─── LIGNE CONTACT ────────────────────────────────────────────────
function ContactRow({ contact, societeNom, onLusha, lushaLoading, onSetLinkedin }) {
  const [editingLi, setEditingLi] = useState(false);
  const [liInput,   setLiInput]   = useState(contact.linkedin_url ?? '');

  const handleOpenLinkedin = () => {
    if (contact.linkedin_url) {
      window.open(contact.linkedin_url, '_blank');
    } else {
      const q = encodeURIComponent(`"${contact.prenom} ${contact.nom}" "${societeNom}"`);
      window.open(`https://www.linkedin.com/search/results/people/?keywords=${q}`, '_blank');
    }
  };

  const handleSaveLinkedin = async () => {
    await onSetLinkedin(contact.id, liInput);
    setEditingLi(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 8,
      background: contact.rang_poste === 1 ? C.accentDim : 'transparent',
      border: `1px solid ${contact.rang_poste === 1 ? C.borderLight : 'transparent'}`,
      transition: 'background .15s',
    }}>
      <ScoreDot score={contact.score_poste ?? 0} />

      {/* Identité */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
            {contact.prenom} {contact.nom}
          </span>
          <span style={{ fontSize: 11, color: C.textSub }}>{contact.fonction}</span>
          {contact.rang_poste === 1 && (
            <Badge label="Cible prioritaire" color={C.green} bg={C.greenSoft} />
          )}
        </div>

        {contact.lusha_fetched && (
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            {contact.lusha_email && (
              <a href={`mailto:${contact.lusha_email}`} style={{ fontSize: 12, color: C.accent, textDecoration: 'none' }}>
                ✉ {contact.lusha_email}
              </a>
            )}
            {contact.lusha_phone && (
              <a href={`tel:${contact.lusha_phone}`} style={{ fontSize: 12, color: C.green, textDecoration: 'none' }}>
                ☎ {contact.lusha_phone}
              </a>
            )}
            {contact.lusha_mobile && contact.lusha_mobile !== contact.lusha_phone && (
              <a href={`tel:${contact.lusha_mobile}`} style={{ fontSize: 12, color: C.yellow, textDecoration: 'none' }}>
                📱 {contact.lusha_mobile}
              </a>
            )}
          </div>
        )}

        {editingLi && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <input
              value={liInput}
              onChange={e => setLiInput(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              style={{
                flex: 1, padding: '4px 8px', borderRadius: 6,
                border: `1px solid ${C.borderLight}`, background: C.bgInput,
                color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit',
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveLinkedin(); if (e.key === 'Escape') setEditingLi(false); }}
              autoFocus
            />
            <Btn onClick={handleSaveLinkedin} icon="✓" label="OK" color={C.green} small />
            <Btn onClick={() => setEditingLi(false)} icon="✕" label="" color={C.red} small />
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Btn
          onClick={handleOpenLinkedin}
          icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>}
          label={contact.linkedin_url ? 'Profil' : 'Chercher'}
          color={C.linkedin}
          small
        />
        <Btn onClick={() => setEditingLi(true)} icon="🔗" label="URL" color={C.textSub} small />
        <Btn
          onClick={() => onLusha(contact.id)}
          loading={lushaLoading[contact.id]}
          icon="📞"
          label={contact.lusha_fetched ? 'Actualiser' : 'Lusha'}
          color={C.lusha}
          small
        />
      </div>
    </div>
  );
}

// ─── CARTE SOCIÉTÉ ────────────────────────────────────────────────
function SocieteCard({ soc, cadastreLoading, lushaLoading, onCadastre, onLusha, onSetLinkedin, onStatut, onConvertir }) {
  const [open, setOpen] = useState(false);
  const statCfg = STATUT_CFG[soc.statut_qualification] ?? STATUT_CFG['À qualifier'];
  const contactsCibles = soc.contacts?.filter(c => (c.score_poste ?? 0) >= 70) ?? [];
  const isCadastreLoading = cadastreLoading[soc.id];

  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${open ? C.borderLight : C.border}`,
      borderRadius: 12, overflow: 'hidden', transition: 'border-color .2s',
    }}>
      {/* ── Header ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}
      >
        <ScoreDot score={soc.contacts?.[0]?.score_poste ?? 0} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{soc.raison_sociale}</span>
            <Badge label={soc.statut_qualification} color={statCfg.color} bg={statCfg.bg} />
            {soc.cadastre_fetched && soc.surface_bati_m2 > 0 && (
              <Badge label={`🏗 ${soc.surface_bati_m2.toLocaleString()} m²`} color={C.yellow} bg={C.yellowSoft} />
            )}
            {soc.cadastre_fetched && soc.surface_parcelle_m2 > 0 && (
              <Badge label={`🌍 ${soc.surface_parcelle_m2.toLocaleString()} m² parcelle`} color={C.green} bg={C.greenSoft} />
            )}
          </div>
          <div style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>
            📍 {soc.ville} {soc.cp} · {soc.activite}
            {soc.web && (
              <a href={soc.web} target="_blank" rel="noopener noreferrer"
                style={{ marginLeft: 8, color: C.accent, textDecoration: 'none' }}
                onClick={e => e.stopPropagation()}>
                🌐 Site
              </a>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {contactsCibles.length > 0 && (
            <Badge label={`${contactsCibles.length} cible${contactsCibles.length > 1 ? 's' : ''}`} color={C.green} bg={C.greenSoft} />
          )}
          <Badge label={`${soc.contacts?.length ?? 0} contact${(soc.contacts?.length ?? 0) > 1 ? 's' : ''}`} color={C.textSub} bg="rgba(122,153,176,0.08)" />
          <span style={{ fontSize: 16, color: C.textDim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
        </div>
      </div>

      {/* ── Expanded ── */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {/* Barre d'actions */}
          <div style={{
            display: 'flex', gap: 8, padding: '10px 18px', flexWrap: 'wrap', alignItems: 'center',
            background: C.bgInput, borderBottom: `1px solid ${C.border}`,
          }}>
            <select
              value={soc.statut_qualification}
              onChange={e => { e.stopPropagation(); onStatut(soc.id, e.target.value); }}
              style={{
                padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.borderLight}`,
                background: C.bgCard, color: C.text, fontSize: 12, cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
              }}
            >
              {Object.keys(STATUT_CFG).map(s => <option key={s}>{s}</option>)}
            </select>

            <Btn
              onClick={() => onCadastre(soc.id)}
              loading={isCadastreLoading}
              icon="📐"
              label={soc.cadastre_fetched ? 'Recalculer cadastre' : 'Calculer cadastre'}
              color={C.yellow}
            />

            {soc.lien_geoportail && (
              <Btn onClick={() => window.open(soc.lien_geoportail, '_blank')} icon="🗺" label="Géoportail" color={C.orange} />
            )}

            <div style={{ marginLeft: 'auto' }}>
              <Btn
                onClick={() => onConvertir(soc.id)}
                icon="📁"
                label="Convertir en dossier"
                color={C.green}
                disabled={soc.statut_qualification === 'Converti en dossier'}
              />
            </div>
          </div>

          {/* Résultats cadastre */}
          {soc.cadastre_fetched && (
            <div style={{
              display: 'flex', gap: 16, padding: '10px 18px',
              background: `${C.yellow}08`, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap',
            }}>
              {[
                { label: 'Parcelle', value: `${soc.section_cadastrale ?? '?'}${soc.numero_parcelle ?? '?'}` },
                { label: 'Surface parcelle', value: soc.surface_parcelle_m2 ? `${soc.surface_parcelle_m2.toLocaleString()} m²` : '—' },
                { label: 'Emprise bâtie', value: soc.surface_bati_m2 ? `${soc.surface_bati_m2.toLocaleString()} m²` : '—' },
                { label: 'Bâtiments', value: soc.nb_batiments ?? '—' },
                { label: 'Adresse normalisée', value: soc.adresse_normalisee ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ minWidth: 120 }}>
                  <div style={{ fontSize: 10, color: C.textSub, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Liste contacts */}
          <div style={{ padding: '10px 18px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: C.textDim }}>Score poste CEE :</span>
              {SCORE_CONFIG.map(c => (
                <Badge key={c.label} label={`${c.label} — ${c.tip}`} color={c.color} bg={c.bg} size={10} />
              ))}
            </div>
            {(soc.contacts ?? []).map(contact => (
              <ContactRow
                key={contact.id}
                contact={contact}
                societeNom={soc.raison_sociale}
                onLusha={onLusha}
                lushaLoading={lushaLoading}
                onSetLinkedin={onSetLinkedin}
              />
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
    societes, loading, importing, cadastreLoading, lushaLoading, error,
    searchQuery, setSearchQuery, filterStatut, setFilterStatut,
    importerExcel, enrichirCadastre, enrichirLusha,
    setLinkedinUrl, setStatutSociete, convertirEnDossier,
    societesBrutes,
  } = useLeads();

  const fileRef  = useRef();
  const [importMsg, setImportMsg] = useState(null);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportMsg(null);
    try {
      const { imported } = await importerExcel(file);
      setImportMsg({ type: 'ok', text: `✅ ${imported} société(s) importée(s) avec succès` });
    } catch (err) {
      setImportMsg({ type: 'err', text: `❌ Import échoué : ${err.message}` });
    }
    e.target.value = '';
  }, [importerExcel]);

  const stats = {
    total:     societesBrutes.length,
    cibles:    societesBrutes.filter(s => s.contacts?.some(c => (c.score_poste ?? 0) >= 90)).length,
    enrichies: societesBrutes.filter(s => s.cadastre_fetched).length,
    lusha:     societesBrutes.reduce((acc, s) => acc + (s.contacts?.filter(c => c.lusha_fetched).length ?? 0), 0),
  };

  const STATUTS_FILTRE = ['Tous', ...Object.keys(STATUT_CFG)];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0A1420 0%, #0F1923 100%)',
        borderBottom: `1px solid ${C.border}`,
        padding: '20px 32px',
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: '-0.03em' }}>
            Qualification <span style={{ color: C.accent }}>Leads</span>
          </div>
          <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
            Module indépendant · Prospects CEE non dossiers
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => fileRef.current.click()}
          disabled={importing}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8,
            background: importing ? C.accentSoft : C.accent, color: importing ? C.accent : C.bg,
            border: 'none', fontWeight: 800, fontSize: 13, cursor: importing ? 'not-allowed' : 'pointer',
            transition: 'all .15s', fontFamily: 'inherit',
          }}
        >
          {importing
            ? <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.accent}40`, borderTopColor: C.accent, animation: 'spin .7s linear infinite' }}/>
            : '📥'}
          {importing ? 'Import en cours...' : 'Importer Excel'}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
        {importMsg && (
          <div style={{
            marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13,
            background: importMsg.type === 'ok' ? C.greenSoft : C.redSoft,
            color: importMsg.type === 'ok' ? C.green : C.red,
            border: `1px solid ${importMsg.type === 'ok' ? C.green : C.red}30`,
          }}>
            {importMsg.text}
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, background: C.redSoft, color: C.red, border: `1px solid ${C.red}30` }}>
            ⚠ {error}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <StatCard label="Sociétés importées" value={stats.total} color={C.text} />
          <StatCard label="Cibles S1 (score ≥90)" value={stats.cibles} color={C.green} />
          <StatCard label="Cadastres calculés" value={stats.enrichies} color={C.yellow} />
          <StatCard label="Contacts Lusha enrichis" value={stats.lusha} color={C.lusha} />
        </div>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍  Rechercher société, ville, activité..."
            style={{
              flex: 1, minWidth: 220, padding: '9px 14px', borderRadius: 8,
              border: `1.5px solid ${C.border}`, background: C.bgInput,
              color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
            }}
          />
          <select
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}
            style={{
              padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`,
              background: C.bgInput, color: C.text, fontSize: 12, cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
            }}
          >
            {STATUTS_FILTRE.map(s => <option key={s}>{s}</option>)}
          </select>
          <div style={{ fontSize: 12, color: C.textSub, padding: '8px 12px', background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}` }}>
            <b style={{ color: C.text }}>{societes.length}</b> société{societes.length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.textSub }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${C.border}`, borderTopColor: C.accent, animation: 'spin .8s linear infinite', margin: '0 auto 12px' }}/>
            Chargement des prospects...
          </div>
        ) : societes.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: C.bgCard, borderRadius: 14, border: `1px dashed ${C.borderLight}`, color: C.textSub,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>Aucun prospect importé</div>
            <div style={{ fontSize: 13 }}>Importez votre fichier Excel pour démarrer la qualification</div>
            <button
              onClick={() => fileRef.current.click()}
              style={{
                marginTop: 18, padding: '10px 22px', borderRadius: 8,
                background: C.accentSoft, color: C.accent,
                border: `1px solid ${C.accent}30`, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              📥 Importer un fichier
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {societes.map(soc => (
              <SocieteCard
                key={soc.id}
                soc={soc}
                cadastreLoading={cadastreLoading}
                lushaLoading={lushaLoading}
                onCadastre={enrichirCadastre}
                onLusha={enrichirLusha}
                onSetLinkedin={setLinkedinUrl}
                onStatut={setStatutSociete}
                onConvertir={convertirEnDossier}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
