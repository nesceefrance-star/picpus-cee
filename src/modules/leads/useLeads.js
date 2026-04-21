// src/modules/leads/useLeads.js
import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import useStore from '../../store/useStore';

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

function normCP(v) {
  return String(v || '').replace(/\.0$/, '').replace(/\s/g, '').padStart(5, '0');
}

function normStr(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export const CHAMPS_MAPPING = [
  { key: 'raison_sociale', label: 'Société *',          group: 'societe', req: true  },
  { key: 'adresse',        label: 'Adresse (rue)',       group: 'societe', req: false },
  { key: 'adresse_compl',  label: 'Complément adresse',  group: 'societe', req: false },
  { key: 'cp',             label: 'Code postal',         group: 'societe', req: false },
  { key: 'ville',          label: 'Ville',               group: 'societe', req: false },
  { key: 'siret',          label: 'SIRET / SIREN',       group: 'societe', req: false },
  { key: 'activite',       label: 'Activité / NAF',      group: 'societe', req: false },
  { key: 'tel_societe',    label: 'Tél. société',        group: 'societe', req: false },
  { key: 'web',            label: 'Site web',            group: 'societe', req: false },
  { key: 'commentaire',    label: 'Commentaire / Notes', group: 'societe', req: false },
  { key: 'nom',            label: 'Nom contact',         group: 'contact', req: false },
  { key: 'prenom',         label: 'Prénom contact',      group: 'contact', req: false },
  { key: 'fonction',       label: 'Fonction contact',    group: 'contact', req: false },
  { key: 'email',          label: 'Email contact',       group: 'contact', req: false },
  { key: 'tel_contact',    label: 'Tél. direct contact', group: 'contact', req: false },
];

export function detectMappingFuzzy(headers) {
  const PATTERNS = {
    raison_sociale: ['nom de l entreprise', 'raison sociale', 'company name', 'nom societe', 'denomination', 'etablissement'],
    adresse:        ['^rue$', '^adresse$', 'adresse 1', 'adresse principale', 'street', 'voie'],
    adresse_compl:  ['complement', 'adresse 2', 'lieu dit'],
    cp:             ['^cp$', 'code postal', 'postal code', 'zip'],
    ville:          ['^ville$', '^commune$', '^city$'],
    web:            ['site web', 'company url', '^web$', 'website'],
    activite:       ['libelle naf', 'libelle activite', '^activite$', '^secteur$'],
    tel_societe:    ['numero de telephone', 'telephone entreprise', 'tel societe', '^telephone$', '^tel$'],
    siret:          ['numero d enregistrement', '^siret$', '^siren$', 'n siret'],
    nom:            ['^nom$', 'last name', 'nom de famille'],
    prenom:         ['^prenom$', 'first name', 'firstname'],
    fonction:       ['libelle fonction', 'fonction locale', 'job title', '^fonction$', '^poste$'],
    email:          ['email direct', 'email dirigeant', 'mail direct'],
    tel_contact:    ['ligne directe', 'tel direct', 'tel contact'],
    commentaire:    ['commentaire', '^notes$', '^note$', 'observation', 'remarque'],
  };

  const mapping = {};
  const used = new Set();

  for (const [field, patterns] of Object.entries(PATTERNS)) {
    let bestHeader = null;
    let bestScore = -1;
    for (const header of headers) {
      if (used.has(header)) continue;
      const hn = normStr(header);
      for (const pat of patterns) {
        const isExact = pat.startsWith('^') && pat.endsWith('$');
        const pn = isExact ? pat.slice(1, -1) : pat;
        let score = -1;
        if (isExact) { if (hn === pn) score = 200; }
        else {
          if (hn === pn) score = 150;
          else if (hn.includes(pn) && pn.length > 3) score = pn.length;
          else if (pn.includes(hn) && hn.length > 3) score = hn.length - 1;
        }
        if (score > bestScore) { bestScore = score; bestHeader = header; }
      }
    }
    mapping[field] = bestScore >= 0 ? bestHeader : null;
    if (bestHeader) used.add(bestHeader);
  }
  return mapping;
}

export function analyserFichier(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) return reject(new Error('Fichier vide'));
        const headers = Object.keys(rows[0]);
        const mapping = detectMappingFuzzy(headers);
        resolve({ headers, mapping, sampleRows: rows.slice(0, 3), totalRows: rows.length, rows });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function buildSocieteMap(rows, mapping) {
  const get = (row, field) => {
    const col = mapping[field];
    if (!col) return '';
    const v = row[col];
    return (v !== undefined && v !== null) ? String(v).trim() : '';
  };
  const mappedCols = new Set(Object.values(mapping).filter(Boolean));
  const societeMap = {};

  for (const row of rows) {
    const raison = get(row, 'raison_sociale');
    if (!raison) continue;

    if (!societeMap[raison]) {
      const donnees_brutes = {};
      for (const [k, v] of Object.entries(row)) {
        if (!mappedCols.has(k) && v !== '' && v !== null) donnees_brutes[k] = v;
      }
      societeMap[raison] = {
        raison_sociale: raison,
        adresse: [get(row, 'adresse'), get(row, 'adresse_compl')].filter(Boolean).join(', '),
        cp:           normCP(get(row, 'cp')),
        ville:        get(row, 'ville'),
        web:          get(row, 'web'),
        activite:     get(row, 'activite'),
        tel_societe:  get(row, 'tel_societe'),
        siret_import: get(row, 'siret').replace(/\s/g, ''),
        commentaire:  get(row, 'commentaire'),
        donnees_brutes: Object.keys(donnees_brutes).length ? donnees_brutes : null,
        contacts: [],
      };
    }

    const nom    = get(row, 'nom');
    const prenom = get(row, 'prenom');
    if (!nom && !prenom) continue;

    const fonction = get(row, 'fonction');
    societeMap[raison].contacts.push({
      nom, prenom, fonction,
      email:           get(row, 'email'),
      tel_societe:     get(row, 'tel_contact') || societeMap[raison].tel_societe,
      statut_original: '',
      score_poste:     scorePoste(fonction),
    });
  }

  Object.values(societeMap).forEach(s => {
    s.contacts.sort((a, b) => b.score_poste - a.score_poste);
    s.contacts.forEach((c, i) => { c.rang_poste = i + 1; });
  });
  return Object.values(societeMap);
}

// ─── GEOCODAGE ───────────────────────────────────────────────────

// 1. SIRENE — GPS officiel de l'établissement (plus précis que BAN pour les entreprises)
async function geocodeSirene({ raison_sociale, cp }) {
  try {
    const q = encodeURIComponent(raison_sociale.trim());
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${q}&code_postal=${cp}&per_page=3&limite_matching_etablissements=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const etab = data.results?.[0]?.matching_etablissements?.[0];
    if (!etab?.latitude) return null;
    return {
      lat: parseFloat(etab.latitude), lon: parseFloat(etab.longitude),
      score: 1.0, label: etab.adresse ?? '',
      siret: etab.siret ?? null, source: 'sirene',
    };
  } catch { return null; }
}

// 2. BAN — fallback adresse textuelle
async function geocodeAdresse({ adresse, cp, ville }) {
  const q = `${adresse} ${cp} ${ville}`.trim();
  const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&postcode=${cp}&limit=1`);
  if (!res.ok) throw new Error(`Geocode HTTP ${res.status}`);
  const data = await res.json();
  const feat = data.features?.[0];
  if (!feat) return null;
  const [lon, lat] = feat.geometry.coordinates;
  return { lat, lon, score: feat.properties.score, label: feat.properties.label, source: 'ban' };
}

// ─── CADASTRE ────────────────────────────────────────────────────

async function fetchParcelle({ lat, lon }) {
  const res = await fetch(
    `https://apicarto.ign.fr/api/cadastre/parcelle?lon=${lon}&lat=${lat}&_limit=1`,
    { headers: { 'User-Agent': 'CEE-CRM/1.0' } }
  );
  if (!res.ok) throw new Error(`Parcelle HTTP ${res.status}`);
  const data = await res.json();
  const feat = data.features?.[0];
  if (!feat) return null;
  const p = feat.properties;
  return { id_parcelle: p.id ?? '', section_cadastrale: p.section ?? '', numero_parcelle: p.numero ?? '', surface_parcelle_m2: p.contenance ?? null };
}

// Bbox 10 m — équivalent point-in-polygon, compatible CORS
async function fetchBatimentExact({ lat, lon }) {
  try {
    const r = 10;
    const dLat = r / 111320;
    const dLon = r / (111320 * Math.cos((lat * Math.PI) / 180));
    const bbox = `${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}`;
    const url = new URL('https://data.geopf.fr/wfs/ows');
    url.searchParams.set('SERVICE', 'WFS'); url.searchParams.set('VERSION', '2.0.0');
    url.searchParams.set('REQUEST', 'GetFeature'); url.searchParams.set('TYPENAMES', 'BDTOPO_V3:batiment');
    url.searchParams.set('BBOX', `${bbox},EPSG:4326`);
    url.searchParams.set('OUTPUTFORMAT', 'application/json'); url.searchParams.set('COUNT', '5');
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const feats = data.features ?? [];
    if (!feats.length) return null;
    const surfaces = feats.map(f => f.properties?.superficie_au_sol ?? 0).filter(s => s > 0);
    return {
      nb_batiments: feats.length,
      surface_bati_m2: Math.round(surfaces.reduce((a, b) => a + b, 0)),
      surface_bati_max_m2: surfaces.length ? Math.round(Math.max(...surfaces)) : 0,
      batiment_usage: feats[0]?.properties?.usage_1 ?? null,
      geocode_methode: 'exact',
    };
  } catch { return null; }
}

// Fallback : rayon réduit (30 m) si le point est hors bâtiment (rue, parking…)
async function fetchBatimentsProches({ lat, lon, rayon = 30 }) {
  const dLat = rayon / 111320;
  const dLon = rayon / (111320 * Math.cos((lat * Math.PI) / 180));
  const bbox = `${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}`;
  const url = new URL('https://data.geopf.fr/wfs/ows');
  url.searchParams.set('SERVICE', 'WFS'); url.searchParams.set('VERSION', '2.0.0');
  url.searchParams.set('REQUEST', 'GetFeature'); url.searchParams.set('TYPENAMES', 'BDTOPO_V3:batiment');
  url.searchParams.set('BBOX', `${bbox},EPSG:4326`); url.searchParams.set('OUTPUTFORMAT', 'application/json');
  url.searchParams.set('COUNT', '10');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`BDTOPO HTTP ${res.status}`);
  const data = await res.json();
  const feats = data.features ?? [];
  if (!feats.length) return { nb_batiments: 0, surface_bati_m2: 0, surface_bati_max_m2: 0, geocode_methode: 'rayon_30m' };
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
      return Math.abs(area) / 2 * 111320 ** 2 * Math.cos((lat * Math.PI) / 180) > 10
        ? Math.round(Math.abs(area) / 2 * 111320 ** 2 * Math.cos((lat * Math.PI) / 180))
        : 0;
    }
    return 0;
  }).filter(s => s > 0);
  return {
    nb_batiments: feats.length,
    surface_bati_m2: Math.round(surfaces.reduce((a, b) => a + b, 0)),
    surface_bati_max_m2: surfaces.length ? Math.round(Math.max(...surfaces)) : 0,
    geocode_methode: 'rayon_30m',
  };
}

// ─── LUSHA ───────────────────────────────────────────────────────

async function fetchLusha({ prenom, nom, societe, linkedinUrl }) {
  const body = linkedinUrl
    ? { action: 'lusha', linkedin_url: linkedinUrl }
    : { action: 'lusha', firstName: prenom, lastName: nom, company: societe };
  const res = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? data.message ?? `Lusha HTTP ${res.status} — ${JSON.stringify(data)}`);
  return data;
}

// ─── HOOK PRINCIPAL ──────────────────────────────────────────────
export function useLeads() {
  const { profile, profiles, fetchProfiles } = useStore();
  const isAdmin = profile?.role === 'admin';

  const [batches,         setBatches]         = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null); // null = tous
  const [societes,        setSocietes]        = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [loadingBatches,  setLoadingBatches]  = useState(false);
  const [importing,       setImporting]       = useState(false);
  const [cadastreLoading, setCadastreLoading] = useState({});
  const [lushaLoading,    setLushaLoading]    = useState({});
  const [error,           setError]           = useState(null);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [filterStatut,    setFilterStatut]    = useState('Tous');
  const [sortBy,          setSortBy]          = useState('score');

  const [analyseData,    setAnalyseData]    = useState(null);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);

  // Charger la liste des utilisateurs (pour l'assignation admin)
  useEffect(() => { if (isAdmin && !profiles.length) fetchProfiles(); }, [isAdmin]);

  // ── Chargement batches ──────────────────────────────────────────
  const loadBatches = useCallback(async () => {
    if (!profile) return;
    setLoadingBatches(true);
    try {
      let q = supabase.from('leads_batches').select(`
        id, created_at, nom, lead_type, fichier_nom, nb_societes, nb_contacts,
        assigne_a, created_by,
        assignee:profiles!leads_batches_assigne_a_fkey(id, nom, prenom),
        creator:profiles!leads_batches_created_by_fkey(id, nom, prenom)
      `).order('created_at', { ascending: false });
      if (!isAdmin) q = q.eq('assigne_a', profile.id);
      const { data, error: e } = await q;
      if (e) throw e;
      setBatches(data || []);
    } catch (e) { setError(e.message); }
    setLoadingBatches(false);
  }, [profile, isAdmin]);

  // ── Chargement sociétés ─────────────────────────────────────────
  const loadSocietes = useCallback(async (batchId = selectedBatchId) => {
    if (!profile) return;
    setLoading(true); setError(null);
    try {
      let q = supabase.from('leads_import').select('*').order('created_at', { ascending: false });
      if (batchId) q = q.eq('batch_id', batchId);
      else if (!isAdmin) q = q.eq('assigne_a', profile.id);
      const { data: imports, error: e1 } = await q;
      if (e1) throw e1;

      if (!imports?.length) { setSocietes([]); setLoading(false); return; }

      const ids = imports.map(i => i.id);
      const { data: contacts, error: e2 } = await supabase
        .from('leads_contacts').select('*').in('import_id', ids).order('rang_poste');
      if (e2) throw e2;

      const assembled = imports.map(imp => ({
        ...imp,
        contacts: (contacts || []).filter(c => c.import_id === imp.id).sort((a,b) => (a.rang_poste??99)-(b.rang_poste??99)),
      }));
      setSocietes(assembled);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [profile, isAdmin, selectedBatchId]);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { loadSocietes(selectedBatchId); }, [selectedBatchId, profile?.id]);

  // ── Sélectionner un batch ───────────────────────────────────────
  const selectBatch = useCallback((batchId) => {
    setSelectedBatchId(batchId);
    setSearchQuery('');
    setFilterStatut('Tous');
  }, []);

  // ── Analyse fichier (étape 1) ───────────────────────────────────
  const analyserImport = useCallback(async (file, opts) => {
    setAnalyseEnCours(true); setError(null);
    try {
      const data = await analyserFichier(file);
      setAnalyseData({ ...data, file, opts });
    } catch (e) { setError(e.message); }
    setAnalyseEnCours(false);
  }, []);

  const clearAnalyse = useCallback(() => setAnalyseData(null), []);

  // ── Import avec mapping validé (étape 2) ────────────────────────
  const importerExcel = useCallback(async (mapping) => {
    if (!analyseData) throw new Error('Pas de fichier analysé');
    setImporting(true); setError(null);
    try {
      const { rows, opts } = analyseData;
      const parsed = buildSocieteMap(rows, mapping);
      const targetUser = opts.assigneA || profile?.id;

      const { data: batch, error: eBatch } = await supabase
        .from('leads_batches')
        .insert({
          nom:         opts.nom,
          lead_type:   opts.leadType,
          fichier_nom: analyseData.file?.name,
          assigne_a:   targetUser,
          created_by:  profile?.id,
          nb_societes: parsed.length,
          nb_contacts: parsed.reduce((a, s) => a + s.contacts.length, 0),
        })
        .select().single();
      if (eBatch) throw eBatch;

      for (const soc of parsed) {
        const { data: imp, error: eImp } = await supabase
          .from('leads_import')
          .insert({
            raison_sociale: soc.raison_sociale, adresse: soc.adresse,
            cp: soc.cp, ville: soc.ville, web: soc.web, activite: soc.activite,
            tel_societe: soc.tel_societe,
            siret: soc.siret_import || null,
            commentaire: soc.commentaire || null,
            donnees_brutes: soc.donnees_brutes,
            batch_id:       batch.id,
            assigne_a:      targetUser,
            import_batch_id: batch.id,
          })
          .select().single();
        if (eImp) throw eImp;

        if (soc.contacts.length) {
          const { error: eCont } = await supabase.from('leads_contacts').insert(
            soc.contacts.map(c => ({
              import_id: imp.id, nom: c.nom, prenom: c.prenom, fonction: c.fonction,
              tel_societe: c.tel_societe, statut_original: c.statut_original,
              score_poste: c.score_poste, rang_poste: c.rang_poste,
              email: c.email || null,
            }))
          );
          if (eCont) throw eCont;
        }
      }

      setAnalyseData(null);
      await loadBatches();
      setSelectedBatchId(batch.id);
      return { imported: parsed.length, batch };
    } catch (e) { setError(e.message); throw e; }
    finally { setImporting(false); }
  }, [analyseData, profile, loadBatches]);

  // ── Réassigner un batch (admin) ─────────────────────────────────
  const reassignerBatch = useCallback(async (batchId, newUserId) => {
    const { error: e } = await supabase.from('leads_batches').update({ assigne_a: newUserId }).eq('id', batchId);
    if (e) { setError(e.message); return; }
    // Mettre à jour aussi les sociétés du batch
    await supabase.from('leads_import').update({ assigne_a: newUserId }).eq('batch_id', batchId);
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, assigne_a: newUserId } : b));
  }, []);

  // ── Supprimer un batch ──────────────────────────────────────────
  const supprimerBatch = useCallback(async (batchId) => {
    const { error: e } = await supabase.from('leads_batches').delete().eq('id', batchId);
    if (e) { setError(e.message); return; }
    setBatches(prev => prev.filter(b => b.id !== batchId));
    if (selectedBatchId === batchId) { setSelectedBatchId(null); setSocietes([]); }
  }, [selectedBatchId]);

  // ── Enrichissement cadastral ────────────────────────────────────
  const enrichirCadastre = useCallback(async (importId) => {
    setCadastreLoading(prev => ({ ...prev, [importId]: true }));
    setError(null);
    try {
      const soc = societes.find(s => s.id === importId);
      if (!soc) throw new Error('Société non trouvée');

      // 1. Géocodage : SIRENE d'abord (GPS officiel), sinon BAN
      let geo = await geocodeSirene({ raison_sociale: soc.raison_sociale, cp: soc.cp });
      if (!geo) geo = await geocodeAdresse({ adresse: soc.adresse, cp: soc.cp, ville: soc.ville });
      if (!geo) throw new Error('Adresse introuvable (SIRENE + BAN)');

      await new Promise(r => setTimeout(r, IGN_DELAY_MS));

      // 2. Parcelle cadastrale au point exact
      const parcelle = await fetchParcelle({ lat: geo.lat, lon: geo.lon });

      await new Promise(r => setTimeout(r, IGN_DELAY_MS));

      // 3. Bâtiment : point-in-polygon d'abord, rayon 30m en fallback
      let bati = await fetchBatimentExact({ lat: geo.lat, lon: geo.lon });
      if (!bati || bati.surface_bati_m2 === 0) {
        bati = await fetchBatimentsProches({ lat: geo.lat, lon: geo.lon, rayon: 30 });
      }

      const lienGeoportail = `https://www.geoportail.gouv.fr/carte?c=${geo.lon},${geo.lat}&z=19&l0=CADASTRALPARCELS.PARCELLAIRE_EXPRESS::GEOPORTAIL:OGC:WMTS(1)&l1=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`;
      const lienGoogleMaps = `https://www.google.com/maps/@${geo.lat},${geo.lon},19z/data=!3m1!1e3`;

      const patch = {
        cadastre_fetched: true, cadastre_fetched_at: new Date().toISOString(),
        lat: geo.lat, lon: geo.lon, geocode_score: geo.score, adresse_normalisee: geo.label,
        geocode_source: geo.source ?? 'ban',
        siret: geo.siret ?? null,
        lien_geoportail: lienGeoportail, lien_googlemaps: lienGoogleMaps,
        ...(parcelle ?? {}), ...(bati ?? {}),
      };
      const { error: eUp } = await supabase.from('leads_import').update(patch).eq('id', importId);
      if (eUp) throw eUp;
      setSocietes(prev => prev.map(s => s.id === importId ? { ...s, ...patch } : s));
    } catch (e) { setError(`Cadastre : ${e.message}`); }
    setCadastreLoading(prev => ({ ...prev, [importId]: false }));
  }, [societes]);

  // ── Enrichissement Lusha ────────────────────────────────────────
  const enrichirLusha = useCallback(async (contactId) => {
    setLushaLoading(prev => ({ ...prev, [contactId]: true }));
    setError(null);
    try {
      const contact = societes.flatMap(s => s.contacts).find(c => c.id === contactId);
      if (!contact) throw new Error('Contact non trouvé');
      const soc = societes.find(s => s.id === contact.import_id);
      const result = await fetchLusha({ prenom: contact.prenom, nom: contact.nom, societe: soc?.raison_sociale ?? '', linkedinUrl: contact.linkedin_url ?? null });
      const patch = { lusha_fetched: true, lusha_fetched_at: new Date().toISOString(), lusha_email: result.emails?.[0] ?? null, lusha_phone: result.phones?.[0] ?? null, lusha_mobile: result.phones?.[1] ?? null, lusha_raw: result, lusha_credits_used: result.credits_used ?? 1 };
      const { error: eUp } = await supabase.from('leads_contacts').update(patch).eq('id', contactId);
      if (eUp) throw eUp;
      setSocietes(prev => prev.map(s => ({ ...s, contacts: s.contacts.map(c => c.id === contactId ? { ...c, ...patch } : c) })));
    } catch (e) { setError(`Lusha : ${e.message}`); }
    setLushaLoading(prev => ({ ...prev, [contactId]: false }));
  }, [societes]);

  // ── LinkedIn & Statut ───────────────────────────────────────────
  const setLinkedinUrl = useCallback(async (contactId, url) => {
    await supabase.from('leads_contacts').update({ linkedin_url: url, linkedin_fetched_at: new Date().toISOString() }).eq('id', contactId);
    setSocietes(prev => prev.map(s => ({ ...s, contacts: s.contacts.map(c => c.id === contactId ? { ...c, linkedin_url: url } : c) })));
  }, []);

  const setStatutSociete = useCallback(async (importId, statut) => {
    await supabase.from('leads_import').update({ statut_qualification: statut }).eq('id', importId);
    setSocietes(prev => prev.map(s => s.id === importId ? { ...s, statut_qualification: statut } : s));
  }, []);

  const convertirEnDossier = useCallback(async (importId) => {
    await supabase.from('leads_import').update({ statut_qualification: 'Converti en dossier' }).eq('id', importId);
    setSocietes(prev => prev.map(s => s.id === importId ? { ...s, statut_qualification: 'Converti en dossier' } : s));
  }, []);

  // ── Filtrage + tri ──────────────────────────────────────────────
  const societesFiltrees = societes
    .filter(s => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || [s.raison_sociale, s.ville, s.activite].some(v => v?.toLowerCase().includes(q));
      const matchStatut = filterStatut === 'Tous' || s.statut_qualification === filterStatut;
      return matchSearch && matchStatut;
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        const sa = a.contacts?.[0]?.score_poste ?? 0;
        const sb = b.contacts?.[0]?.score_poste ?? 0;
        return sb - sa;
      }
      if (sortBy === 'surface') {
        return (b.surface_bati_m2 ?? 0) - (a.surface_bati_m2 ?? 0);
      }
      if (sortBy === 'statut') {
        const order = ['Converti en dossier','RDV planifié','Contacté','À qualifier','Non qualifié','Non pertinent'];
        return order.indexOf(a.statut_qualification) - order.indexOf(b.statut_qualification);
      }
      // date (défaut)
      return new Date(b.created_at) - new Date(a.created_at);
    });

  return {
    // Batches
    batches, loadingBatches, selectedBatchId, selectBatch,
    reassignerBatch, supprimerBatch,
    // Sociétés
    societes: societesFiltrees, societesBrutes: societes,
    loading, importing, cadastreLoading, lushaLoading, error,
    searchQuery, setSearchQuery, filterStatut, setFilterStatut, sortBy, setSortBy,
    // Actions
    importerExcel, analyserImport, clearAnalyse, analyseData, analyseEnCours,
    enrichirCadastre, enrichirLusha,
    setLinkedinUrl, setStatutSociete, convertirEnDossier,
    refresh: () => { loadBatches(); loadSocietes(selectedBatchId); },
    // Utilisateurs (pour admin)
    profiles, isAdmin,
  };
}
