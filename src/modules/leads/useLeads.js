// src/modules/leads/useLeads.js
// ═══════════════════════════════════════════════════════════════════
//  Hook central du module Qualification Leads
//  Gère : import Excel · Supabase CRUD · Cadastre IGN · Lusha API
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';

// ─── CONFIG ──────────────────────────────────────────────────────
const IGN_DELAY_MS = 400;

// ─── SCORING POSTES CEE ──────────────────────────────────────────
const POSTE_SCORES = [
  { patterns: ['directeur technique', 'dir. technique'],           score: 100 },
  { patterns: ['responsable énergie', 'resp. énergie', 'energy'],  score: 98  },
  { patterns: ['directeur maintenance', 'dir maintenance'],         score: 96  },
  { patterns: ['responsable maintenance'],                          score: 94  },
  { patterns: ['facility manager', 'facilities'],                   score: 92  },
  { patterns: ['hse', 'qhse', 'qse', 'hygiène sécurité'],          score: 90  },
  { patterns: ['directeur site', 'directeur usine', "directeur d'usine"], score: 85 },
  { patterns: ['responsable exploitation', 'resp exploitation'],   score: 83  },
  { patterns: ['responsable technique', 'resp. technique'],        score: 80  },
  { patterns: ['directeur des opérations', 'coo'],                 score: 78  },
  { patterns: ['responsable production', 'resp production'],       score: 75  },
  { patterns: ['directeur production'],                             score: 73  },
  { patterns: ['responsable travaux', 'conducteur travaux'],       score: 70  },
  { patterns: ['directeur général', 'dg ', 'dg,', 'dga'],         score: 60  },
  { patterns: ['président', 'president'],                          score: 55  },
  { patterns: ['gérant', 'gerant'],                                score: 50  },
  { patterns: ['general manager'],                                  score: 60  },
  { patterns: ['dirigeant'],                                       score: 45  },
  { patterns: ['directeur'],                                       score: 40  },
  { patterns: ['responsable achats', 'directeur achats'],          score: 30  },
  { patterns: ['responsable logistique'],                          score: 25  },
  { patterns: ['responsable qualité', 'resp qualité'],             score: 20  },
  { patterns: ['responsable rh', 'drh', 'ressources humaines'],   score: 5   },
  { patterns: ['commercial', 'vente'],                             score: 3   },
];

function scorePoste(fonction) {
  if (!fonction) return 0;
  const f = fonction.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const { patterns, score } of POSTE_SCORES) {
    if (patterns.some(p => f.includes(p.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
      return score;
    }
  }
  return 1;
}

// ─── PARSING EXCEL ───────────────────────────────────────────────
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const normalized = rows.map(row => {
          const r = {};
          Object.keys(row).forEach(k => { r[k.trim().toUpperCase()] = row[k]; });
          return r;
        });

        const societeMap = {};
        normalized.forEach(row => {
          const raison = (row['RAISON_SOCIALE'] || row['RAISON SOCIALE'] || '').trim();
          if (!raison) return;
          if (!societeMap[raison]) {
            societeMap[raison] = {
              raison_sociale: raison,
              adresse:        (row['ADRESSE_1'] || row['ADRESSE'] || '').trim(),
              cp:             String(row['CP'] || '').replace('.0','').padStart(5,'0'),
              ville:          (row['VILLE'] || row['CITY'] || '').trim(),
              web:            (row['WEB'] || '').trim(),
              activite:       (row['ACTIVITE'] || '').trim(),
              tel_societe:    (row['TEL SOCIETE'] || row['TEL'] || '').trim(),
              contacts:       [],
            };
          }
          const nom = (row['NOM'] || '').trim();
          if (nom) {
            const fonction = (row['FONCTION'] || '').trim();
            societeMap[raison].contacts.push({
              nom,
              prenom:          (row['PRENOM'] || '').trim(),
              fonction,
              tel_societe:     societeMap[raison].tel_societe,
              statut_original: (row['STATUT'] || '').trim(),
              score_poste:     scorePoste(fonction),
            });
          }
        });

        Object.values(societeMap).forEach(s => {
          s.contacts.sort((a, b) => b.score_poste - a.score_poste);
          s.contacts.forEach((c, i) => { c.rang_poste = i + 1; });
        });

        resolve(Object.values(societeMap));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── API IGN : GÉOCODAGE ─────────────────────────────────────────
async function geocodeAdresse({ adresse, cp, ville }) {
  const q = `${adresse} ${cp} ${ville}`.trim();
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&postcode=${cp}&limit=1`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Geocode HTTP ${res.status}`);
  const data = await res.json();
  const feat = data.features?.[0];
  if (!feat) return null;
  const [lon, lat] = feat.geometry.coordinates;
  return { lat, lon, score: feat.properties.score, label: feat.properties.label };
}

// ─── API IGN : PARCELLE CADASTRALE ───────────────────────────────
async function fetchParcelle({ lat, lon }) {
  const url = `https://apicarto.ign.fr/api/cadastre/parcelle?lon=${lon}&lat=${lat}&_limit=1`;
  const res  = await fetch(url, { headers: { 'User-Agent': 'CEE-CRM/1.0' } });
  if (!res.ok) throw new Error(`Parcelle HTTP ${res.status}`);
  const data = await res.json();
  const feat = data.features?.[0];
  if (!feat) return null;
  const p = feat.properties;
  return {
    id_parcelle:         p.id ?? '',
    section_cadastrale:  p.section ?? '',
    numero_parcelle:     p.numero ?? '',
    surface_parcelle_m2: p.contenance ?? null,
  };
}

// ─── API IGN : BÂTIMENTS BDTOPO ──────────────────────────────────
async function fetchBatiments({ lat, lon, rayon = 120 }) {
  const dLat = rayon / 111320;
  const dLon = rayon / (111320 * Math.cos((lat * Math.PI) / 180));
  const bbox = `${lon-dLon},${lat-dLat},${lon+dLon},${lat+dLat}`;

  const url = new URL('https://data.geopf.fr/wfs/ows');
  url.searchParams.set('SERVICE',      'WFS');
  url.searchParams.set('VERSION',      '2.0.0');
  url.searchParams.set('REQUEST',      'GetFeature');
  url.searchParams.set('TYPENAMES',   'BDTOPO_V3:batiment');
  url.searchParams.set('BBOX',         `${bbox},EPSG:4326`);
  url.searchParams.set('OUTPUTFORMAT','application/json');
  url.searchParams.set('COUNT',        '50');

  const res  = await fetch(url.toString());
  if (!res.ok) throw new Error(`BDTOPO HTTP ${res.status}`);
  const data = await res.json();
  const feats = data.features ?? [];
  if (!feats.length) return { nb_batiments: 0, surface_bati_m2: 0, surface_bati_max_m2: 0 };

  const surfaces = feats.map(f => {
    const s = f.properties?.superficie_au_sol ?? f.properties?.surface_au_sol;
    if (s && s > 0) return s;
    if (f.geometry?.type === 'Polygon') {
      const coords = f.geometry.coordinates[0];
      let area = 0;
      for (let i = 0; i < coords.length; i++) {
        const j = (i + 1) % coords.length;
        area += coords[i][0] * coords[j][1];
        area -= coords[j][0] * coords[i][1];
      }
      const m2 = Math.abs(area) / 2 * 111320 ** 2 * Math.cos((lat * Math.PI) / 180);
      return m2 > 10 ? Math.round(m2) : 0;
    }
    return 0;
  }).filter(s => s > 0);

  return {
    nb_batiments:       feats.length,
    surface_bati_m2:    Math.round(surfaces.reduce((a, b) => a + b, 0)),
    surface_bati_max_m2: surfaces.length ? Math.round(Math.max(...surfaces)) : 0,
  };
}

// ─── API LUSHA (via proxy /api/lusha) ────────────────────────────
async function fetchLusha({ prenom, nom, societe, linkedinUrl }) {
  const body = linkedinUrl
    ? { linkedin_url: linkedinUrl }
    : { first_name: prenom, last_name: nom, company: societe };

  const res = await fetch('/api/lusha', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Lusha HTTP ${res.status}`);
  return res.json();
}

// ─── HOOK PRINCIPAL ──────────────────────────────────────────────
export function useLeads() {
  const [societes,        setSocietes]        = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [importing,       setImporting]       = useState(false);
  const [cadastreLoading, setCadastreLoading] = useState({});
  const [lushaLoading,    setLushaLoading]    = useState({});
  const [error,           setError]           = useState(null);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [filterStatut,    setFilterStatut]    = useState('Tous');

  const loadSocietes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: imports, error: e1 } = await supabase
        .from('leads_import')
        .select('*')
        .order('created_at', { ascending: false });
      if (e1) throw e1;

      const { data: contacts, error: e2 } = await supabase
        .from('leads_contacts')
        .select('*')
        .order('rang_poste', { ascending: true });
      if (e2) throw e2;

      const assembled = (imports || []).map(imp => ({
        ...imp,
        contacts: (contacts || [])
          .filter(c => c.import_id === imp.id)
          .sort((a, b) => (a.rang_poste ?? 99) - (b.rang_poste ?? 99)),
      }));
      setSocietes(assembled);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSocietes(); }, [loadSocietes]);

  const importerExcel = useCallback(async (file) => {
    setImporting(true);
    setError(null);
    try {
      const parsed  = await parseExcelFile(file);
      const batchId = crypto.randomUUID();

      for (const soc of parsed) {
        const { data: imp, error: eImp } = await supabase
          .from('leads_import')
          .insert({
            raison_sociale:  soc.raison_sociale,
            adresse:         soc.adresse,
            cp:              soc.cp,
            ville:           soc.ville,
            web:             soc.web,
            activite:        soc.activite,
            tel_societe:     soc.tel_societe,
            import_batch_id: batchId,
          })
          .select()
          .single();
        if (eImp) throw eImp;

        if (soc.contacts.length) {
          const { error: eCont } = await supabase
            .from('leads_contacts')
            .insert(soc.contacts.map(c => ({
              import_id:       imp.id,
              nom:             c.nom,
              prenom:          c.prenom,
              fonction:        c.fonction,
              tel_societe:     c.tel_societe,
              statut_original: c.statut_original,
              score_poste:     c.score_poste,
              rang_poste:      c.rang_poste,
            })));
          if (eCont) throw eCont;
        }
      }

      await loadSocietes();
      return { imported: parsed.length, batchId };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setImporting(false);
    }
  }, [loadSocietes]);

  const enrichirCadastre = useCallback(async (importId) => {
    setCadastreLoading(prev => ({ ...prev, [importId]: true }));
    setError(null);
    try {
      const soc = societes.find(s => s.id === importId);
      if (!soc) throw new Error('Société non trouvée');

      const geo = await geocodeAdresse({ adresse: soc.adresse, cp: soc.cp, ville: soc.ville });
      if (!geo) throw new Error('Adresse introuvable (géocodage)');
      await new Promise(r => setTimeout(r, IGN_DELAY_MS));

      const parcelle = await fetchParcelle({ lat: geo.lat, lon: geo.lon });
      await new Promise(r => setTimeout(r, IGN_DELAY_MS));

      const bati = await fetchBatiments({ lat: geo.lat, lon: geo.lon });

      const lienGeoportail = `https://www.geoportail.gouv.fr/carte?c=${geo.lon},${geo.lat}&z=19&l0=CADASTRALPARCELS.PARCELLAIRE_EXPRESS::GEOPORTAIL:OGC:WMTS(1)&l1=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`;

      const patch = {
        cadastre_fetched:    true,
        cadastre_fetched_at: new Date().toISOString(),
        lat:                 geo.lat,
        lon:                 geo.lon,
        geocode_score:       geo.score,
        adresse_normalisee:  geo.label,
        lien_geoportail:     lienGeoportail,
        ...(parcelle ?? {}),
        ...(bati      ?? {}),
      };
      const { error: eUp } = await supabase.from('leads_import').update(patch).eq('id', importId);
      if (eUp) throw eUp;

      setSocietes(prev => prev.map(s => s.id === importId ? { ...s, ...patch } : s));
    } catch (err) {
      setError(`Cadastre : ${err.message}`);
    } finally {
      setCadastreLoading(prev => ({ ...prev, [importId]: false }));
    }
  }, [societes]);

  const enrichirLusha = useCallback(async (contactId) => {
    setLushaLoading(prev => ({ ...prev, [contactId]: true }));
    setError(null);
    try {
      const contact = societes.flatMap(s => s.contacts).find(c => c.id === contactId);
      if (!contact) throw new Error('Contact non trouvé');
      const soc = societes.find(s => s.id === contact.import_id);

      const result = await fetchLusha({
        prenom:      contact.prenom,
        nom:         contact.nom,
        societe:     soc?.raison_sociale ?? '',
        linkedinUrl: contact.linkedin_url ?? null,
      });

      const patch = {
        lusha_fetched:      true,
        lusha_fetched_at:   new Date().toISOString(),
        lusha_email:        result.emails?.[0] ?? null,
        lusha_phone:        result.phones?.[0] ?? null,
        lusha_mobile:       result.phones?.[1] ?? null,
        lusha_raw:          result,
        lusha_credits_used: result.credits_used ?? 1,
      };
      const { error: eUp } = await supabase.from('leads_contacts').update(patch).eq('id', contactId);
      if (eUp) throw eUp;

      setSocietes(prev => prev.map(s => ({
        ...s,
        contacts: s.contacts.map(c => c.id === contactId ? { ...c, ...patch } : c),
      })));
    } catch (err) {
      setError(`Lusha : ${err.message}`);
    } finally {
      setLushaLoading(prev => ({ ...prev, [contactId]: false }));
    }
  }, [societes]);

  const setLinkedinUrl = useCallback(async (contactId, url) => {
    const { error: eUp } = await supabase
      .from('leads_contacts')
      .update({ linkedin_url: url, linkedin_fetched_at: new Date().toISOString() })
      .eq('id', contactId);
    if (eUp) { setError(eUp.message); return; }
    setSocietes(prev => prev.map(s => ({
      ...s,
      contacts: s.contacts.map(c => c.id === contactId ? { ...c, linkedin_url: url } : c),
    })));
  }, []);

  const setStatutSociete = useCallback(async (importId, statut) => {
    const { error: eUp } = await supabase
      .from('leads_import')
      .update({ statut_qualification: statut })
      .eq('id', importId);
    if (eUp) { setError(eUp.message); return; }
    setSocietes(prev => prev.map(s => s.id === importId ? { ...s, statut_qualification: statut } : s));
  }, []);

  const convertirEnDossier = useCallback(async (importId) => {
    await supabase
      .from('leads_import')
      .update({ statut_qualification: 'Converti en dossier' })
      .eq('id', importId);
    setSocietes(prev => prev.map(s =>
      s.id === importId ? { ...s, statut_qualification: 'Converti en dossier' } : s
    ));
  }, []);

  const societesFiltrees = societes.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || [s.raison_sociale, s.ville, s.activite]
      .some(v => v?.toLowerCase().includes(q));
    const matchStatut = filterStatut === 'Tous' || s.statut_qualification === filterStatut;
    return matchSearch && matchStatut;
  });

  return {
    societes: societesFiltrees,
    societesBrutes: societes,
    loading,
    importing,
    cadastreLoading,
    lushaLoading,
    error,
    searchQuery, setSearchQuery,
    filterStatut, setFilterStatut,
    importerExcel,
    enrichirCadastre,
    enrichirLusha,
    setLinkedinUrl,
    setStatutSociete,
    convertirEnDossier,
    refresh: loadSocietes,
  };
}
