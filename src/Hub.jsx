import { useState, useRef, useMemo, forwardRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import useStore from "./store/useStore";
import { refDefault, nextRef } from "./lib/genRef";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { DevisPDFDoc } from "./components/DevisPDF";

// ─── HELPERS ────────────────────────────────────────────────────────────────
const fmt  = n => Number(n||0).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtE = n => fmt(n)+" €";
const BAT_QTE = 30;

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
const C = {
  bg:       "#F4F6F9",
  surface:  "#FFFFFF",
  border:   "#E2E8F0",
  nav:      "#1E293B",
  navText:  "#F8FAFC",
  accent:   "#2563EB",
  accentL:  "#EFF6FF",
  text:     "#0F172A",
  textMid:  "#475569",
  textSoft: "#94A3B8",
  green:    "#16A34A",
  greenL:   "#DCFCE7",
  orange:   "#D97706",
  orangeL:  "#FEF3C7",
  red:      "#DC2626",
  redL:     "#FEE2E2",
  yellow:   "#CA8A04",
};

const T = {
  h1: { fontSize:22, fontWeight:800, color:C.text },
  h2: { fontSize:17, fontWeight:700, color:C.text },
  h3: { fontSize:14, fontWeight:700, color:C.text },
  body: { fontSize:14, color:C.text },
  sm:   { fontSize:12, color:C.textMid },
  xs:   { fontSize:11, color:C.textSoft },
};

// ════════════════════════════════════════════════════════════════════════════
// MODULE 1 — VÉRIFICATEUR CEE IA
// ════════════════════════════════════════════════════════════════════════════
const FICHES_V = {
  "BAT-TH-142":"BAT-TH-142 — Déstratification tertiaire",
  "IND-BA-110":"IND-BA-110 — Déstratification industrie",
  "BAT-TH-163":"BAT-TH-163 — PAC air/eau tertiaire",
};

// Fiches pour le générateur de devis
const FICHES_DEVIS = {
  "BAT-TH-142": "BAT-TH-142 — Déstratification tertiaire",
  "IND-BA-110": "IND-BA-110 — Déstratification industrie",
  "BAT-TH-116": "BAT-TH-116 — GTB",
  "AUTRE":      "Autre fiche",
};
// Fiches nécessitant l'ajout automatique du destratificateur
const FICHES_DESTRAT = ["BAT-TH-142", "IND-BA-110"];

// BAT-TH-116 — coefficients kWh/m² par classe, secteur, usage
const COEFFICIENTS_116 = {
  A: {
    bureaux:                 { chauffage:400, refroidissement:260, ecs:16,  eclairage:190, auxiliaires:19 },
    enseignement:            { chauffage:200, refroidissement:71,  ecs:89,  eclairage:49,  auxiliaires:8  },
    commerce:                { chauffage:560, refroidissement:160, ecs:32,  eclairage:23,  auxiliaires:8  },
    hotellerie_restauration: { chauffage:420, refroidissement:71,  ecs:34,  eclairage:74,  auxiliaires:8  },
    sante:                   { chauffage:200, refroidissement:71,  ecs:95,  eclairage:12,  auxiliaires:28 },
    autres:                  { chauffage:200, refroidissement:71,  ecs:16,  eclairage:12,  auxiliaires:8  },
  },
  B: {
    bureaux:                 { chauffage:300, refroidissement:130, ecs:8,   eclairage:100, auxiliaires:10 },
    enseignement:            { chauffage:120, refroidissement:35,  ecs:45,  eclairage:24,  auxiliaires:5  },
    commerce:                { chauffage:300, refroidissement:66,  ecs:3,   eclairage:23,  auxiliaires:5  },
    hotellerie_restauration: { chauffage:230, refroidissement:35,  ecs:17,  eclairage:40,  auxiliaires:5  },
    sante:                   { chauffage:140, refroidissement:35,  ecs:48,  eclairage:12,  auxiliaires:18 },
    autres:                  { chauffage:120, refroidissement:35,  ecs:3,   eclairage:12,  auxiliaires:5  },
  },
};
const ZONE_COEFF_116 = { H1:1.1, H2:0.9, H3:0.6 };
const BONIF_COEFF_116 = { none:1, creation:2, amelioration:1.5 };
const USAGES_116 = [
  { key:'chauffage',       label:'🔥 Chauffage' },
  { key:'refroidissement', label:'❄️ Refroid. / Clim.' },
  { key:'ecs',             label:'🚿 ECS' },
  { key:'eclairage',       label:'💡 Éclairage' },
  { key:'auxiliaires',     label:'⚙️ Auxiliaires' },
];
const SECTEURS_116 = [
  { id:'bureaux',                 label:'Bureaux' },
  { id:'enseignement',            label:'Enseignement' },
  { id:'commerce',                label:'Commerce' },
  { id:'hotellerie_restauration', label:'Hôtellerie / Restauration' },
  { id:'sante',                   label:'Santé' },
  { id:'autres',                  label:'Autres' },
];
const calculerCumac116Hub = ({ classe, secteur, zone, surfaces }) => {
  const coeffs = COEFFICIENTS_116[classe]?.[secteur];
  if (!coeffs) return 0;
  const zc = ZONE_COEFF_116[zone] || 0.9;
  return Math.round(Object.keys(surfaces).reduce((s, u) => s + (coeffs[u] || 0) * (parseFloat(surfaces[u]) || 0) * zc, 0));
};

// ─── GÉNÉRATION AUTOMATIQUE DU RELEVÉ TECHNIQUE ─────────────────────────────
function genereReleve({ ficheDevis, batQte, batDebit }) {
  const fiche  = ficheDevis || 'BAT-TH-142';
  const debit  = Number(batDebit || 14000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nb     = batQte ? `${batQte} unité${batQte > 1 ? 's' : ''}` : '[à compléter]';

  if (fiche === 'BAT-TH-142' || fiche === 'IND-BA-110') {
    return `${fiche} : Mise en place d'un système de déstratification d'air pour l'homogénéisation de la température de l'air d'un local de grande hauteur chauffé par un système convectif.
• Nombre d'unités : ${nb}
• Marque TECH, référence DES-14000
• Le système de déstratification d'air est asservi à une mesure de température de l'air dans la zone située entre le système de déstratification d'air et le plafond ou le faîtage
• Débit d'air : ${debit} m³/h
• Déstratification par écoulement d'air vertical : l'écoulement a une vitesse au sol à un mètre de hauteur de : 0,11 m/s
• Niveau du bruit au sol : 38,00 dB
• Puissance nominale du système de chauffage convectif du local P : [à compléter] kW`;
  }
  if (fiche === 'BAT-TH-163') {
    return `BAT-TH-163 : Installation d'une pompe à chaleur (PAC) air/eau pour le chauffage et/ou la production d'eau chaude sanitaire d'un bâtiment tertiaire.
• Marque : [à compléter], référence : [à compléter]
• Puissance nominale : [à compléter] kW
• Etas (PAC ≤ 400 kW) : [à compléter] % ou COP (PAC > 400 kW) : [à compléter]
• Surface chauffée : [à compléter] m²
• Secteur d'activité : [à compléter]`;
  }
  if (fiche === 'BAT-TH-116') {
    return `BAT-TH-116 : Mise en place d'un système de gestion technique du bâtiment (GTB) permettant de gérer et optimiser les consommations énergétiques du bâtiment.
• Classe d'efficacité énergétique : [A ou B]
• Secteur d'activité : [à compléter]
• Usages couverts : Chauffage / Refroidissement / ECS / Éclairage / Auxiliaires
• Surface totale gérée : [à compléter] m²`;
  }
  if (fiche === 'BAT-TH-125') {
    return `BAT-TH-125 : Installation d'un système de ventilation simple flux hygroréglable de type B dans un bâtiment tertiaire.
• Type de ventilation : [à compléter]
• Secteur d'activité : [à compléter]
• Surface ventilée : [à compléter] m²
• Marque : [à compléter], référence : [à compléter]`;
  }
  if (fiche === 'BAT-TH-126') {
    return `BAT-TH-126 : Installation d'un système de ventilation double flux avec échangeur à récupération de chaleur dans un bâtiment tertiaire.
• Type de ventilation : [à compléter]
• Secteur d'activité : [à compléter]
• Surface ventilée : [à compléter] m²
• Efficacité de l'échangeur : [à compléter] %
• Marque : [à compléter], référence : [à compléter]`;
  }
  if (fiche === 'BAT-EN-103') {
    return `BAT-EN-103 : Isolation de combles ou toiture d'un bâtiment tertiaire.
• Secteur d'activité : [à compléter]
• Surface isolée : [à compléter] m²
• Résistance thermique R : [à compléter] m²K/W
• Matériau isolant : [à compléter]
• Marque : [à compléter], référence : [à compléter]`;
  }
  return `${fiche} : [Description du système mis en place]\n• Marque : [à compléter]\n• Référence : [à compléter]\n• Caractéristiques principales : [à compléter]`;
}

const NIV = {
  CRITIQUE: { bg:"#FEF2F2", border:"#FCA5A5", badge:"#DC2626", text:"#7F1D1D" },
  ATTENTION:{ bg:"#FFFBEB", border:"#FCD34D", badge:"#D97706", text:"#78350F" },
  INFO:     { bg:"#EFF6FF", border:"#BFDBFE", badge:"#2563EB", text:"#1E3A8A" },
};

const AVIS = {
  CONFORME: { bg:"#F0FDF4", border:"#86EFAC", icon:"✅", label:"Dossier CONFORME",   color:"#16A34A" },
  ATTENTION:{ bg:"#FFFBEB", border:"#FCD34D", icon:"⚠️", label:"Points d'ATTENTION", color:"#D97706" },
  BLOQUANT: { bg:"#FEF2F2", border:"#FCA5A5", icon:"🚫", label:"Dossier BLOQUANT",   color:"#DC2626" },
};

function UploadZone({ label, sublabel, file, onFile }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  const onDrop = useCallback(e => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0]; if (f) onFile(f);
  }, [onFile]);
  return (
    <div onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={onDrop}
      onClick={()=>ref.current.click()}
      style={{border:`2px dashed ${drag?"#2563EB":file?"#16A34A":C.border}`,borderRadius:10,padding:"28px 16px",textAlign:"center",cursor:"pointer",background:drag?"#EFF6FF":file?"#F0FDF4":"#FAFBFC",transition:"all .2s"}}>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} onChange={e=>e.target.files[0]&&onFile(e.target.files[0])}/>
      <div style={{fontSize:28,marginBottom:8}}>{file?"✅":"📂"}</div>
      <div style={{fontSize:14,fontWeight:600,color:file?"#16A34A":C.text,marginBottom:4}}>{label}</div>
      <div style={{fontSize:12,color:C.textMid,marginBottom:8}}>{sublabel}</div>
      {file
        ? <span style={{fontSize:12,color:"#16A34A",background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:6,padding:"3px 10px"}}>{file.name}</span>
        : <span style={{fontSize:12,color:C.textSoft,border:`1px solid ${C.border}`,borderRadius:6,padding:"3px 10px"}}>PDF / JPG / PNG</span>}
    </div>
  );
}

function Accordion({ title, count, countColor, children, collapsed=false }) {
  const [open, setOpen] = useState(!collapsed);
  return (
    <div style={{border:`1px solid ${C.border}`,borderRadius:8,marginBottom:10,overflow:"hidden"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 16px",background:C.surface,cursor:"pointer",userSelect:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:14,fontWeight:600,color:C.text}}>{title}</span>
          {count!=null && <span style={{background:countColor+"22",color:countColor,border:`1px solid ${countColor}44`,borderRadius:20,padding:"1px 9px",fontSize:12,fontWeight:700}}>{count}</span>}
        </div>
        <span style={{color:C.textSoft,fontSize:12}}>{open?"▲":"▼"}</span>
      </div>
      {open && <div style={{borderTop:`1px solid ${C.border}`}}>{children}</div>}
    </div>
  );
}

function PointCard({ item, cfg, val, note, onVal, onNote, openNote, toggleNote }) {
  return (
    <div style={{background:cfg.bg,borderLeft:`4px solid ${cfg.border}`,borderBottom:`1px solid ${C.border}`,padding:"14px 18px"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <span style={{background:cfg.badge+"22",color:cfg.badge,border:`1px solid ${cfg.badge}55`,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>{item.niveau||"INFO"}</span>
            {item.categorie && <span style={{fontSize:11,color:C.textMid,background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:"2px 8px"}}>{item.categorie}</span>}
          </div>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:3}}>{item.titre}</div>
          <div style={{fontSize:13,color:C.textMid,lineHeight:1.5}}>{item.description}</div>
          {(item.valeur_ah||item.valeur_devis) && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
              <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:6,padding:"7px 11px"}}>
                <div style={{fontSize:10,color:"#2563EB",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>AH</div>
                <div style={{fontSize:12,color:C.text}}>{item.valeur_ah||"—"}</div>
              </div>
              <div style={{background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:6,padding:"7px 11px"}}>
                <div style={{fontSize:10,color:"#DC2626",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>DEVIS</div>
                <div style={{fontSize:12,color:C.text}}>{item.valeur_devis||"—"}</div>
              </div>
            </div>
          )}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0,alignItems:"flex-end"}}>
          <div style={{display:"flex",gap:5}}>
            <button onClick={()=>onVal(val==="confirmed"?"pending":"confirmed")}
              style={{padding:"5px 11px",borderRadius:6,border:`1.5px solid ${val==="confirmed"?"#16A34A":C.border}`,background:val==="confirmed"?"#F0FDF4":C.surface,color:val==="confirmed"?"#16A34A":C.textSoft,fontSize:12,fontWeight:val==="confirmed"?700:400,cursor:"pointer"}}>
              ✓ OK
            </button>
            <button onClick={()=>onVal(val==="dismissed"?"pending":"dismissed")}
              style={{padding:"5px 11px",borderRadius:6,border:`1.5px solid ${val==="dismissed"?"#94A3B8":C.border}`,background:val==="dismissed"?"#F8FAFC":C.surface,color:val==="dismissed"?"#64748B":C.textSoft,fontSize:12,cursor:"pointer"}}>
              ↷ Skip
            </button>
            <button onClick={toggleNote}
              style={{padding:"5px 8px",borderRadius:6,border:`1.5px solid ${note?"#2563EB":C.border}`,background:note?"#EFF6FF":C.surface,color:note?"#2563EB":C.textSoft,fontSize:12,cursor:"pointer"}}>📝</button>
          </div>
          <div style={{fontSize:11,color:val==="confirmed"?"#16A34A":val==="dismissed"?"#94A3B8":C.textSoft}}>{val==="confirmed"?"✓ Confirmé":val==="dismissed"?"Ignoré":"En attente"}</div>
        </div>
      </div>
      {openNote && <textarea value={note} onChange={e=>onNote(e.target.value)} placeholder="Ajouter une observation…" rows={2}
        style={{marginTop:10,width:"100%",border:`1.5px solid #2563EB`,borderRadius:6,padding:"8px 11px",color:C.text,fontSize:13,fontFamily:"inherit",resize:"vertical",outline:"none",boxSizing:"border-box",background:"#F8FAFF"}}/>}
      {note && !openNote && <div style={{marginTop:8,fontSize:12,color:C.textMid,fontStyle:"italic",borderLeft:"3px solid #2563EB",paddingLeft:10}}>📝 {note}</div>}
    </div>
  );
}

function VerificateurCEE({ prefill }) {
  const { session } = useStore();
  const [fiche,setFiche]   = useState(prefill?.fiche || "BAT-TH-142");
  const [ref_,setRef_]     = useState(prefill?.ref || "");
  const [fileAH,setFileAH] = useState(null);
  const [fileDev,setFileDev] = useState(null);
  const [step,setStep]     = useState("upload");
  const [loadMsg,setLoadMsg] = useState("");
  const [result,setResult] = useState(null);
  const [valid,setValid]   = useState({});
  const [notes,setNotes]   = useState({});
  const [openNote,setOpenNote] = useState(null);
  const [prefillLoading, setPrefillLoading] = useState(!!prefill?.files?.length);
  const [analysisId, setAnalysisId] = useState(null);
  const [savedAnalyses, setSavedAnalyses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  // Charger les fichiers depuis les URLs signées Supabase
  useEffect(() => {
    if (!prefill?.files?.length) return;
    const load = async () => {
      try {
        const blobs = await Promise.all(
          prefill.files.map(f =>
            fetch(f.url).then(r => r.blob()).then(b => new File([b], f.name, { type: b.type || 'application/pdf' }))
          )
        );
        if (blobs[0]) setFileAH(blobs[0]);
        if (blobs[1]) setFileDev(blobs[1]);
      } catch { /* si erreur, l'utilisateur uploade manuellement */ }
      setPrefillLoading(false);
    };
    load();
  }, []);

  // Charger l'historique des analyses
  useEffect(() => {
    if (!session) return;
    let q = supabase.from('cee_analyses')
      .select('id, ref, fiche, result, valid_state, notes_state, created_at, updated_at')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (prefill?.dossierId) q = q.eq('dossier_id', prefill.dossierId);
    q.then(({ data }) => setSavedAnalyses(data || []));
  }, [session]);

  const loadAnalysis = (a) => {
    setRef_(a.ref || ''); setFiche(a.fiche || 'BAT-TH-142');
    setResult(a.result); setAnalysisId(a.id);
    const v = { ...(a.valid_state || {}) };
    [...(a.result?.incoherences||[]),...(a.result?.points_conformes||[]),...(a.result?.alertes_ah||[])].forEach(i => { if (!v[i.id]) v[i.id] = 'pending'; });
    setValid(v); setNotes(a.notes_state || {}); setStep('rapport');
  };

  const saveProgress = async () => {
    if (!analysisId || !session) return;
    setSaving(true);
    await supabase.from('cee_analyses').update({ valid_state: valid, notes_state: notes, updated_at: new Date().toISOString() }).eq('id', analysisId);
    setSaving(false); setSaveOk(true); setTimeout(() => setSaveOk(false), 2000);
  };

  const toB64 = f => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(f); });
  const mtype = f => f.type==="application/pdf"?"application/pdf":f.type||"image/jpeg";
  const bc    = (b64,mt) => mt==="application/pdf"
    ? {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}}
    : {type:"image",  source:{type:"base64",media_type:mt,data:b64}};

  const analyser = async () => {
    if (!fileAH||!fileDev) return;
    setStep("loading");
    const msgs = ["Lecture de l'AH…","Lecture du devis…","Comparaison…","Détection des écarts…","Génération du rapport…"];
    let mi=0; setLoadMsg(msgs[0]);
    const iv = setInterval(()=>{ mi=Math.min(mi+1,msgs.length-1); setLoadMsg(msgs[mi]); },1800);
    try {
      const [b64AH,b64Dev] = await Promise.all([toB64(fileAH),toB64(fileDev)]);
      const prompt = `RÉPONDS UNIQUEMENT AVEC LE JSON, aucun texte avant ou après, pas de backticks.
Expert CEE. Titres/descriptions max 80 caractères.
{"avis_global":"CONFORME|ATTENTION|BLOQUANT","resume":"1 phrase","donnees_ah":{"beneficiaire":"","siren":"","adresse_site":"","signataire":"","date_engagement":"","date_realisation":"","nb_equipements":"","marque":"","reference_eq":"","professionnel":"","siret_pro":""},"donnees_devis":{"beneficiaire":"","adresse_site":"","date_document":"","ref_document":"","nb_equipements":"","marque":"","reference_eq":"","montant_ht":"","emetteur":""},"incoherences":[{"id":"inc_1","niveau":"CRITIQUE|ATTENTION|INFO","categorie":"Bénéficiaire|Adresse|Dates|Équipements|Références|Professionnel|Autre","titre":"","description":"","valeur_ah":"","valeur_devis":""}],"points_conformes":[{"id":"ok_1","categorie":"","titre":""}],"alertes_ah":[{"id":"al_1","niveau":"CRITIQUE|ATTENTION","titre":"","description":""}]}`;
      const resp = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json","anthropic-beta":"pdfs-2024-09-25"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:4096,messages:[{role:"user",content:[bc(b64AH,mtype(fileAH)),{type:"text",text:"[AH CEE, fiche "+fiche+"]"},bc(b64Dev,mtype(fileDev)),{type:"text",text:"[Devis/Facture]"},{type:"text",text:prompt}]}]})});
      const data = await resp.json();
      if (data.error || !data.content) throw new Error(data.error?.message || data.error || "Réponse API invalide");
      const raw = data.content.map(b=>b.text||"").join("");
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Aucun JSON trouvé dans la réponse");
      const parsed = JSON.parse(match[0]);
      setResult(parsed);
      const v={};
      [...(parsed.incoherences||[]),...(parsed.points_conformes||[]),...(parsed.alertes_ah||[])].forEach(i=>{v[i.id]="pending";});
      setValid(v); setStep("rapport");
      // Auto-save
      if (session) {
        const { data: saved } = await supabase.from('cee_analyses').insert({
          user_id: session.user.id,
          dossier_id: prefill?.dossierId || null,
          ref: ref_, fiche, result: parsed, valid_state: v, notes_state: {},
        }).select('id').single();
        if (saved?.id) { setAnalysisId(saved.id); setSavedAnalyses(prev => [{ id: saved.id, ref: ref_, fiche, result: parsed, valid_state: v, notes_state: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev]); }
      }
    } catch(e) { setResult({error:e.message}); setStep("rapport"); }
    clearInterval(iv);
  };

  const allItems = result ? [...(result.incoherences||[]),...(result.alertes_ah||[]),...(result.points_conformes||[])] : [];
  const pct = allItems.length>0 ? Math.round((allItems.filter(i=>valid[i.id]!=="pending").length/allItems.length)*100) : 0;

  return (
    <div style={{height:"100%",overflowY:"auto",background:C.bg,padding:"24px 28px",fontFamily:"inherit"}}>
      <div style={{maxWidth:860,margin:"0 auto"}}>

        {step==="upload" && (
          <>
            <div style={{marginBottom:20}}>
              <h2 style={{...T.h2,marginBottom:4}}>Analyse de dossier CEE par IA</h2>
              <p style={{...T.sm,margin:0}}>Uploadez l'AH et le devis — Claude détecte automatiquement les incohérences entre les deux documents.</p>
              {prefill && (
                <div style={{marginTop:8,background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:7,padding:"7px 12px",fontSize:12,color:"#1D4ED8",display:"flex",alignItems:"center",gap:6}}>
                  📁 Documents pré-chargés depuis le dossier {prefill.ref}
                  {prefillLoading && <span style={{color:"#60A5FA"}}>— ⏳ chargement des fichiers…</span>}
                </div>
              )}
            </div>
            {savedAnalyses.length > 0 && (
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px",marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:10}}>📂 Analyses sauvegardées</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {savedAnalyses.map(a => {
                    const avis = a.result?.avis_global;
                    const avisColor = avis==="CONFORME"?"#16A34A":avis==="BLOQUANT"?"#DC2626":"#D97706";
                    const allItems = [...(a.result?.incoherences||[]),...(a.result?.points_conformes||[]),...(a.result?.alertes_ah||[])];
                    const done = allItems.filter(i => (a.valid_state||{})[i.id] !== 'pending').length;
                    return (
                      <div key={a.id} onClick={() => loadAnalysis(a)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:7,border:`1px solid ${C.border}`,cursor:"pointer",background:C.bg,transition:"background .1s"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#EFF6FF"} onMouseLeave={e=>e.currentTarget.style.background=C.bg}>
                        <span style={{fontSize:18}}>{avis==="CONFORME"?"✅":avis==="BLOQUANT"?"🚫":"⚠️"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:700,color:C.text}}>{a.ref || "(sans référence)"} <span style={{fontWeight:400,color:C.textMid}}>— {a.fiche}</span></div>
                          <div style={{fontSize:11,color:C.textSoft}}>{new Date(a.updated_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})} · {done}/{allItems.length} items traités</div>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,color:avisColor,background:avisColor+"18",border:`1px solid ${avisColor}44`,borderRadius:20,padding:"2px 8px",flexShrink:0}}>{avis||"—"}</span>
                        <span style={{fontSize:11,color:C.accent,flexShrink:0}}>Charger →</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"18px",marginBottom:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:5}}>Référence dossier</label>
                <input value={ref_} onChange={e=>setRef_(e.target.value)} placeholder="ex : référence dossier" style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:5}}>Fiche CEE</label>
                <select value={fiche} onChange={e=>setFiche(e.target.value)} style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",background:C.surface,boxSizing:"border-box"}}>
                  {Object.entries(FICHES_V).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
              <UploadZone label="Attestation sur l'Honneur" sublabel="Document AH signé" file={fileAH} onFile={setFileAH}/>
              <UploadZone label="Devis / Facture" sublabel="Document commercial" file={fileDev} onFile={setFileDev}/>
            </div>
            <button onClick={analyser} disabled={!fileAH||!fileDev}
              style={{width:"100%",padding:"13px",background:(!fileAH||!fileDev)?"#CBD5E1":C.accent,color:(!fileAH||!fileDev)?"#94A3B8":"#fff",border:"none",borderRadius:8,fontSize:14,fontWeight:700,cursor:(!fileAH||!fileDev)?"not-allowed":"pointer",transition:"background .2s"}}>
              🔍 Lancer l'analyse IA
            </button>
          </>
        )}

        {step==="loading" && (
          <div style={{textAlign:"center",padding:"80px 0"}}>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            <div style={{width:48,height:48,border:`4px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 20px"}}/>
            <div style={{fontSize:16,fontWeight:600,color:C.text,marginBottom:4}}>{loadMsg}</div>
            <div style={{fontSize:13,color:C.textMid}}>Analyse IA en cours…</div>
          </div>
        )}

        {step==="rapport" && result && !result.error && (()=>{
          const avis = AVIS[result.avis_global]||AVIS.ATTENTION;
          return (
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>{setStep("upload");setResult(null);setValid({});setFileAH(null);setFileDev(null);setAnalysisId(null);}}
                    style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textMid,padding:"6px 14px",borderRadius:7,cursor:"pointer",fontSize:13}}>
                    + Nouvelle analyse
                  </button>
                  <button onClick={()=>{setStep("upload");setFileAH(null);setFileDev(null);}}
                    style={{background:C.surface,border:`1px solid ${C.border}`,color:C.accent,padding:"6px 14px",borderRadius:7,cursor:"pointer",fontSize:13,fontWeight:600}}>
                    ↺ Régénérer
                  </button>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={saveProgress} disabled={saving||!analysisId}
                    style={{background:saveOk?"#F0FDF4":C.accent,border:`1px solid ${saveOk?"#86EFAC":C.accent}`,color:saveOk?"#16A34A":"#fff",padding:"6px 16px",borderRadius:7,cursor:(!analysisId||saving)?"not-allowed":"pointer",fontSize:13,fontWeight:700,opacity:(!analysisId||saving)?.6:1}}>
                    {saving?"⏳…":saveOk?"✓ Sauvegardé":"💾 Sauvegarder la revue"}
                  </button>
                  <span style={{fontSize:13,color:C.textMid,background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 12px"}}>{pct}% traité</span>
                </div>
              </div>
              <div style={{background:avis.bg,border:`1.5px solid ${avis.border}`,borderRadius:10,padding:"16px 20px",marginBottom:18,display:"flex",alignItems:"center",gap:14}}>
                <div style={{fontSize:32}}>{avis.icon}</div>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:avis.color}}>{avis.label}</div>
                  <div style={{fontSize:13,color:C.textMid,marginTop:3,lineHeight:1.5}}>{result.resume}</div>
                </div>
              </div>

              {/* Données extraites */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
                {[{title:"AH — Données extraites",data:result.donnees_ah,color:C.accent},{title:"Devis — Données extraites",data:result.donnees_devis,color:"#7C3AED"}].map(({title,data,color})=>(
                  <div key={title} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px"}}>
                    <div style={{fontSize:12,fontWeight:700,color,textTransform:"uppercase",letterSpacing:".05em",marginBottom:10,paddingBottom:6,borderBottom:`2px solid ${color}`}}>{title}</div>
                    {data && Object.entries(data).filter(([,v])=>v).map(([k,v])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${C.bg}`,gap:8}}>
                        <span style={{fontSize:11,color:C.textSoft,textTransform:"uppercase",whiteSpace:"nowrap"}}>{k.replace(/_/g," ")}</span>
                        <span style={{fontSize:12,color:C.text,textAlign:"right"}}>{v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {(result.incoherences||[]).length>0 && (
                <Accordion title="⚠️ Incohérences détectées" count={(result.incoherences||[]).length} countColor="#D97706">
                  {(result.incoherences||[]).map(i=><PointCard key={i.id} item={i} cfg={NIV[i.niveau]||NIV.INFO} val={valid[i.id]} note={notes[i.id]||""} onVal={v=>setValid(p=>({...p,[i.id]:v}))} onNote={v=>setNotes(p=>({...p,[i.id]:v}))} openNote={openNote===i.id} toggleNote={()=>setOpenNote(openNote===i.id?null:i.id)}/>)}
                </Accordion>
              )}
              {(result.alertes_ah||[]).length>0 && (
                <Accordion title="🚨 Alertes AH" count={(result.alertes_ah||[]).length} countColor="#DC2626">
                  {(result.alertes_ah||[]).map(i=><PointCard key={i.id} item={i} cfg={NIV[i.niveau]||NIV.INFO} val={valid[i.id]} note={notes[i.id]||""} onVal={v=>setValid(p=>({...p,[i.id]:v}))} onNote={v=>setNotes(p=>({...p,[i.id]:v}))} openNote={openNote===i.id} toggleNote={()=>setOpenNote(openNote===i.id?null:i.id)}/>)}
                </Accordion>
              )}
              {(result.points_conformes||[]).length>0 && (
                <Accordion title="✅ Points conformes" count={(result.points_conformes||[]).length} countColor="#16A34A" collapsed>
                  {(result.points_conformes||[]).map(i=><PointCard key={i.id} item={i} cfg={{bg:"#F0FDF4",border:"#86EFAC",badge:"#16A34A"}} val={valid[i.id]} note={notes[i.id]||""} onVal={v=>setValid(p=>({...p,[i.id]:v}))} onNote={v=>setNotes(p=>({...p,[i.id]:v}))} openNote={openNote===i.id} toggleNote={()=>setOpenNote(openNote===i.id?null:i.id)}/>)}
                </Accordion>
              )}
            </>
          );
        })()}

        {step==="rapport" && result?.error && (
          <div style={{background:"#FEF2F2",border:`1px solid #FCA5A5`,borderRadius:10,padding:"28px",textAlign:"center"}}>
            <div style={{fontSize:13,color:"#DC2626",marginBottom:14}}>⚠️ Erreur : {result.error}</div>
            <button onClick={()=>setStep("upload")} style={{background:C.surface,border:`1px solid ${C.border}`,color:C.text,padding:"7px 18px",borderRadius:7,cursor:"pointer",fontSize:13}}>← Retour</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MODULE 2 — MARGES + DEVIS (multi-devis)
// ════════════════════════════════════════════════════════════════════════════

const LIGNES_DEFAUT = [
  {id:1,cat:"MATÉRIEL",    designation:"RAIL DE MONTAGE profil creux carré soudé 50x3mm S235JRH EN 10219-1",        qte:1, unite:"U",    puAchat:62.00,  margePct:30},
  {id:2,cat:"MAIN D'ŒUVRE",designation:"INSTALLATION DES ÉQUIPEMENTS — pose supports, raccordement",                qte:1, unite:"U",    puAchat:580.00, margePct:25},
  {id:3,cat:"DIVERS",      designation:"DÉPLACEMENT — essence, péages, hébergement, repas",                         qte:1, unite:"U",    puAchat:500.00, margePct:0},
].map(l=>({...l,puVente:+(l.puAchat*(1+l.margePct/100)).toFixed(2),inclus:true}));

const CAT_S = {
  "MATÉRIEL":    {bg:"#EFF6FF",text:"#1D4ED8",border:"#BFDBFE"},
  "MAIN D'ŒUVRE":{bg:"#F0FDF4",text:"#15803D",border:"#BBF7D0"},
  "DIVERS":      {bg:"#FFFBEB",text:"#B45309",border:"#FDE68A"},
};
const MC2 = p => p>=20?"#16A34A":p>0?"#D97706":"#DC2626";

const DTH = {padding:"8px 8px",fontSize:12,fontWeight:700,textAlign:"center"};
const DTC = {padding:"5px 6px",borderBottom:"1px solid #F1F5F9",verticalAlign:"middle"};

// ── Écran liste des devis ──────────────────────────────────────────────────
function ListeDevis({ devis, onCreate, onOpen, onDelete, confirmDeleteId, onCancelDelete }) {
  return (
    <div style={{padding:"24px",height:"100%",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <h2 style={{...T.h2,margin:0,marginBottom:4}}>Mes devis</h2>
          <p style={{...T.sm,margin:0}}>{devis.length} devis · cliquez pour modifier</p>
        </div>
        <button onClick={onCreate}
          style={{background:C.accent,color:"#fff",border:"none",borderRadius:9,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
          ＋ Nouveau devis
        </button>
      </div>

      {devis.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 20px",color:C.textMid}}>
          <div style={{fontSize:48,marginBottom:12}}>📄</div>
          <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8}}>Aucun devis</div>
          <div style={{fontSize:13}}>Créez votre premier devis en cliquant sur le bouton ci-dessus</div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
          {devis.map(d => {
            const totalHT = d.lignes.filter(l=>l.inclus).reduce((s,l)=>s+l.qte*l.puVente,0) + (d.batQte||0)*(d.batPuVente||0);
            const coutAchat = d.lignes.filter(l=>l.inclus).reduce((s,l)=>s+l.qte*l.puAchat,0);
            const marge = totalHT - coutAchat;
            const margePct = totalHT > 0 ? (marge/totalHT*100) : 0;
            return (
              <div key={d.id}
                style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"18px",transition:"all .15s",position:"relative"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 4px 16px rgba(37,99,235,.1)"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>
                {/* Bouton supprimer / confirmer */}
                {confirmDeleteId === d.id ? (
                  <div style={{position:"absolute",top:8,right:8,display:"flex",gap:4,zIndex:10}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>onDelete(d.id)}
                      style={{background:"#DC2626",color:"#fff",border:"none",borderRadius:5,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      Supprimer
                    </button>
                    <button onClick={onCancelDelete}
                      style={{background:"#475569",color:"#fff",border:"none",borderRadius:5,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button onClick={e=>{e.stopPropagation();onDelete(d.id);}}
                    style={{position:"absolute",top:10,right:10,background:"transparent",border:"none",color:C.textSoft,cursor:"pointer",fontSize:15,padding:"2px 6px",borderRadius:5,lineHeight:1}}
                    title="Supprimer ce devis">✕</button>
                )}
                <div onClick={() => onOpen(d.id)} style={{cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:C.text,marginBottom:3}}>{d.nomClient || "Sans nom"}</div>
                      <div style={{fontSize:11,color:C.textSoft}}>Devis {d.refDevis || "—"} du {d.dateDevis || "—"}</div>
                    </div>
                    <span style={{background:MC2(margePct)+"22",color:MC2(margePct),border:`1px solid ${MC2(margePct)}44`,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,marginRight:20}}>
                      {margePct.toFixed(1)}% marge
                    </span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    {[
                      {l:"Total HT",v:fmtE(totalHT),c:C.accent},
                      {l:"Marge brute",v:fmtE(marge),c:MC2(margePct)},
                      {l:"Prime CEE",v:"−"+fmtE(d.prime||0),c:"#16A34A"},
                    ].map(k=>(
                      <div key={k.l} style={{background:C.bg,borderRadius:7,padding:"8px 10px"}}>
                        <div style={{fontSize:10,color:C.textSoft,marginBottom:2,textTransform:"uppercase",letterSpacing:.4}}>{k.l}</div>
                        <div style={{fontSize:13,fontWeight:700,color:k.c}}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:10,fontSize:11,color:C.textSoft}}>
                    {d.lignes.filter(l=>l.inclus).length} ligne{d.lignes.filter(l=>l.inclus).length>1?"s":""} · modifié {d.updatedAt ? new Date(d.updatedAt).toLocaleDateString("fr-FR") : "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Autocomplete client (SIRENE) ──────────────────────────────────────────
function ClientAutocomplete({ value, onChange, onSelect, style }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  const search = (q) => {
    onChange(q);
    clearTimeout(timer.current);
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&limit=6`);
        const data = await res.json();
        setSuggestions(data.results || []);
        setOpen(true);
      } catch { setSuggestions([]); }
    }, 350);
  };

  const select = (item) => {
    const siege = item.siege || {};
    const parts = [siege.numero_voie, siege.type_voie, siege.libelle_voie].filter(Boolean).join(' ');
    const adresseSiege = siege.adresse_complete || [parts, siege.code_postal, siege.libelle_commune].filter(Boolean).join(' ');
    onSelect({
      nomClient: item.nom_complet || item.nom_raison_sociale || '',
      siret: siege.siret || '',
      adresseSiege,
      codeNAF: item.activite_principale || '',
    });
    setSuggestions([]); setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <input value={value} onChange={e => search(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 250)}
        placeholder="KIABI LOGISTIQUE…" style={style} />
      {open && suggestions.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#FFF", border:`1px solid ${C.border}`, borderRadius:8, zIndex:300, boxShadow:"0 8px 24px rgba(0,0,0,.12)", maxHeight:210, overflowY:"auto" }}>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => select(s)}
              style={{ padding:"9px 13px", cursor:"pointer", borderBottom:`1px solid ${C.border}` }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{s.nom_complet || s.nom_raison_sociale}</div>
              <div style={{ fontSize:11, color:C.textMid, marginTop:2 }}>SIRET {s.siege?.siret || '—'} · {s.siege?.libelle_commune || ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Étape 1 — Infos client ────────────────────────────────────────────────
function ModalNouveauDevis({ onConfirm, onCancel }) {
  const [ficheDevis, setFicheDevis]   = useState("BAT-TH-142");
  const [nomClient, setNomClient]     = useState("");
  const [siret, setSiret]             = useState("");
  const [adresseSite, setAdresseSite] = useState("");
  const [refDevis, setRefDevis]       = useState(refDefault);
  useEffect(() => { nextRef('devis_hub', 'ref_devis').then(setRefDevis).catch(() => {}) }, []);
  const [dateDevis, setDateDevis]     = useState(new Date().toLocaleDateString("fr-FR"));
  const [nomContact, setNomContact]   = useState("");
  const [fonctionContact, setFonctionContact] = useState("");
  const [adresseSiege, setAdresseSiege] = useState("");
  const [telephoneClient, setTelephoneClient] = useState("");
  const [emailClient, setEmailClient] = useState("");
  const [codeNAF, setCodeNAF]         = useState("");
  const [destratDesignation, setDestratDesignation] = useState("DESTRATIFICATEUR TECH - 14000m3/h");
  const [destratPrix, setDestratPrix] = useState(650);

  // BAT-TH-116 simulation
  const [classe116, setClasse116]   = useState("A");
  const [secteur116, setSecteur116] = useState("bureaux");
  const [zone116, setZone116]       = useState("H2");
  const [bonif116, setBonif116]     = useState("none");
  const [surfs116, setSurfs116]     = useState({ chauffage:'', refroidissement:'', ecs:'', eclairage:'', auxiliaires:'' });
  const setSurf116 = (k, v) => setSurfs116(s => ({...s, [k]:v}));
  const kwhBase116 = calculerCumac116Hub({ classe:classe116, secteur:secteur116, zone:zone116, surfaces:surfs116 });
  const kwh116     = Math.round(kwhBase116 * BONIF_COEFF_116[bonif116]);

  const needsDestrat = FICHES_DESTRAT.includes(ficheDevis);

  const go = () => {
    if (!nomClient.trim()) return;
    onConfirm({ ficheDevis, nomClient, siret, adresseSite, refDevis, dateDevis, nomContact, fonctionContact, adresseSiege, telephoneClient, emailClient, codeNAF, destratDesignation, destratPrix,
      ...(ficheDevis === 'BAT-TH-116' ? { prime: kwh116, sim116: { classe:classe116, secteur:secteur116, zone:zone116, bonif:bonif116, surfs:surfs116, kwh:kwh116 } } : {}),
    });
  };

  const INP = {width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit"};
  const L = {display:"block",fontSize:11,fontWeight:600,color:C.textMid,marginBottom:4,textTransform:"uppercase",letterSpacing:.4};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}} onClick={onCancel}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"28px 32px",width:560,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 25px 60px rgba(0,0,0,.4)"}} onClick={e=>e.stopPropagation()}>
        {/* Steps */}
        <div style={{display:"flex",gap:0,marginBottom:20,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
          {["1 · Infos client","2 · Devis prestataire","3 · Marges & export"].map((s,i)=>(
            <div key={i} style={{flex:1,padding:"8px 6px",textAlign:"center",fontSize:11,fontWeight:i===0?700:500,background:i===0?C.accent:C.bg,color:i===0?"#fff":C.textSoft,borderRight:i<2?`1px solid ${C.border}`:"none"}}>
              {s}
            </div>
          ))}
        </div>
        <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:16}}>📄 Nouveau devis</div>

        {/* Fiche CEE */}
        <div style={{marginBottom:18,padding:"12px 14px",background:C.accentL,borderRadius:8,border:`1px solid #BFDBFE`}}>
          <label style={L}>Fiche CEE</label>
          <select value={ficheDevis} onChange={e=>setFicheDevis(e.target.value)} style={{...INP,background:C.surface,fontWeight:600}}>
            {Object.entries(FICHES_DEVIS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
          {/* Client avec autocomplete */}
          <div style={{gridColumn:"1/-1"}}>
            <label style={L}>Client * <span style={{fontSize:10,color:C.accent,fontWeight:400,textTransform:"none"}}>autocomplétion SIRET</span></label>
            <ClientAutocomplete
              value={nomClient}
              onChange={setNomClient}
              onSelect={s => { setNomClient(s.nomClient); if(s.siret) setSiret(s.siret); if(s.adresseSiege) setAdresseSiege(s.adresseSiege); if(s.codeNAF) setCodeNAF(s.codeNAF); }}
              style={INP}
            />
          </div>
          {[
            {l:"SIRET",v:siret,set:setSiret,ph:"347 727 950 00094"},
            {l:"Adresse site",v:adresseSite,set:setAdresseSite,ph:"771 Rue de la Plaine, 59553",full:true},
            {l:"Référence devis",v:refDevis,set:setRefDevis,ph:"2025-0001"},
            {l:"Date devis",v:dateDevis,set:setDateDevis,ph:"22/07/2025"},
            {l:"Contact (nom)",v:nomContact,set:setNomContact,ph:"M. Dupont"},
            {l:"Fonction contact",v:fonctionContact,set:setFonctionContact,ph:"Responsable Technique"},
            {l:"Adresse siège social",v:adresseSiege,set:setAdresseSiege,ph:"12 Rue de..., 75001 Paris",full:true},
            {l:"Code NAF",v:codeNAF,set:setCodeNAF,ph:"4690Z"},
            {l:"Téléphone",v:telephoneClient,set:setTelephoneClient,ph:"01 23 45 67 89"},
            {l:"Email",v:emailClient,set:setEmailClient,ph:"contact@societe.fr"},
          ].map(f=>(
            <div key={f.l} style={{gridColumn:f.full?"1/-1":"auto"}}>
              <label style={L}>{f.l}</label>
              <input value={f.v} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={INP}/>
            </div>
          ))}
        </div>

        {/* Config destratificateur — uniquement BAT-TH-142 / IND-BA-110 */}
        {needsDestrat && (
          <div style={{marginBottom:16,padding:"12px 14px",background:"#EFF6FF",borderRadius:8,border:"1px solid #BFDBFE"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#1D4ED8",marginBottom:10}}>⚙️ Destratificateur TECH (ajouté automatiquement)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10}}>
              <div>
                <label style={{...L,color:"#1D4ED8"}}>Désignation</label>
                <input value={destratDesignation} onChange={e=>setDestratDesignation(e.target.value)} style={{...INP,background:"#F8FAFF"}}/>
              </div>
              <div>
                <label style={{...L,color:"#1D4ED8"}}>Prix achat (€/U)</label>
                <input type="number" value={destratPrix} onChange={e=>setDestratPrix(Number(e.target.value)||0)} style={{...INP,width:90,background:"#F8FAFF"}}/>
              </div>
            </div>
          </div>
        )}

        {/* Simulation CEE — BAT-TH-116 */}
        {ficheDevis === 'BAT-TH-116' && (
          <div style={{marginBottom:16,padding:"14px 16px",background:"#F0F9FF",borderRadius:8,border:"1px solid #BAE6FD"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#0369A1",marginBottom:12}}>🖥️ Simulation CEE — GTB (BAT-TH-116)</div>

            {/* Classe A / B */}
            <div style={{marginBottom:10}}>
              <label style={{...L,color:"#0369A1"}}>Classe GTB</label>
              <div style={{display:"flex",gap:6}}>
                {["A","B"].map(c=>(
                  <button key={c} type="button" onClick={()=>setClasse116(c)}
                    style={{flex:1,padding:"7px",borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,
                      background:classe116===c?"#BFDBFE":C.bg,border:`1px solid ${classe116===c?"#2563EB":C.border}`,color:classe116===c?"#2563EB":C.textMid}}>
                    Classe {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Secteur */}
            <div style={{marginBottom:10}}>
              <label style={{...L,color:"#0369A1"}}>Secteur d'activité</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                {SECTEURS_116.map(s=>(
                  <button key={s.id} type="button" onClick={()=>setSecteur116(s.id)}
                    style={{padding:"6px 8px",borderRadius:7,cursor:"pointer",fontFamily:"inherit",textAlign:"center",
                      background:secteur116===s.id?"#EFF6FF":C.bg,border:`1px solid ${secteur116===s.id?"#2563EB":C.border}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:secteur116===s.id?"#2563EB":C.text}}>{s.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Zone climatique */}
            <div style={{marginBottom:10}}>
              <label style={{...L,color:"#0369A1"}}>Zone climatique</label>
              <div style={{display:"flex",gap:6}}>
                {["H1","H2","H3"].map(z=>(
                  <button key={z} type="button" onClick={()=>setZone116(z)}
                    style={{flex:1,padding:"7px",borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,
                      background:zone116===z?"#BFDBFE":C.bg,border:`1px solid ${zone116===z?"#2563EB":C.border}`,color:zone116===z?"#2563EB":C.textMid}}>
                    {z}
                  </button>
                ))}
              </div>
            </div>

            {/* Surfaces par usage avec badges coefficient */}
            <div style={{marginBottom:10}}>
              <label style={{...L,color:"#0369A1"}}>Surfaces gérées par usage (m²)</label>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {USAGES_116.map(u => {
                  const coeff = COEFFICIENTS_116[classe116]?.[secteur116]?.[u.key];
                  return (
                    <div key={u.key} style={{display:"grid",gridTemplateColumns:"1fr 90px",alignItems:"center",gap:8}}>
                      <div>
                        <span style={{fontSize:12,color:C.text}}>{u.label}</span>
                        {coeff != null && (
                          <span style={{marginLeft:6,fontSize:10,fontWeight:700,color:"#0369A1",background:"#E0F2FE",borderRadius:4,padding:"1px 5px"}}>
                            {coeff} kWh/m²
                          </span>
                        )}
                      </div>
                      <div style={{position:"relative"}}>
                        <input type="number" min="0" value={surfs116[u.key]} onChange={e=>setSurf116(u.key,e.target.value)} placeholder="0"
                          style={{...INP,padding:"6px 26px 6px 8px",fontSize:12,background:C.surface}}/>
                        <span style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",fontSize:10,color:C.textMid}}>m²</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bonification */}
            <div style={{marginBottom:10}}>
              <label style={{...L,color:"#0369A1"}}>Bonification</label>
              <div style={{display:"flex",gap:5}}>
                {[{v:"none",l:"Aucune ×1"},{v:"creation",l:"Création ×2"},{v:"amelioration",l:"Amélioration ×1,5"}].map(b=>(
                  <button key={b.v} type="button" onClick={()=>setBonif116(b.v)}
                    style={{flex:1,padding:"6px 4px",borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:700,textAlign:"center",
                      background:bonif116===b.v?"#BFDBFE":C.bg,border:`1px solid ${bonif116===b.v?"#2563EB":C.border}`,color:bonif116===b.v?"#2563EB":C.textMid}}>
                    {b.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Résultat kWh cumac */}
            {kwh116 > 0 && (
              <div style={{background:"#DCFCE7",border:"1px solid #86EFAC",borderRadius:7,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:11,color:"#15803D",marginBottom:2,textTransform:"uppercase",fontWeight:700}}>kWh cumac estimés</div>
                <div style={{fontSize:20,fontWeight:800,color:"#15803D"}}>{kwh116.toLocaleString("fr")} kWh</div>
                {bonif116 !== 'none' && (
                  <div style={{fontSize:10,color:"#4ADE80",marginTop:2}}>
                    Base : {kwhBase116.toLocaleString("fr")} × {BONIF_COEFF_116[bonif116]}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,borderRadius:8,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
          <button onClick={go} disabled={!nomClient.trim()} style={{flex:2,padding:"11px",background:C.accent,border:"none",color:"#fff",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:!nomClient.trim()?0.5:1}}>
            Suivant → Upload devis presta
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Étape 2 — Upload devis prestataire + extraction IA ────────────────────
function UploadPrestaDevis({ infosClient, onLignesExtracted, onSkip, onBack }) {
  const ficheCEE  = infosClient.ficheDevis || "BAT-TH-142";
  const avecCat   = FICHES_DESTRAT.includes(ficheCEE); // BAT-TH-142 / IND-BA-110 → catégorisation MATÉRIEL/MO/DIVERS

  const [file, setFile]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [preview, setPreview]     = useState(null);
  const [prestataire, setPrestataire] = useState(infosClient.sousTraitant || "");
  const [prestaList, setPrestaList]   = useState([]);
  const [selectedPrestaId, setSelectedPrestaId] = useState("");
  const fileRef = useRef();

  // Charger les prestataires depuis Supabase
  useEffect(() => {
    supabase.from("prestataires").select("*").order("nom").then(({ data }) => {
      if (data) setPrestaList(data);
    });
  }, []);

  // Quand on sélectionne un prestataire dans la liste
  const handleSelectPresta = (id) => {
    setSelectedPrestaId(id);
    if (!id) return;
    const p = prestaList.find(x => x.id === id);
    if (p) setPrestataire(p.nom);
  };

  // structure_devis du prestataire sélectionné (ou détection par nom pour retro-compat)
  const getStructureDevis = () => {
    if (selectedPrestaId) {
      const p = prestaList.find(x => x.id === selectedPrestaId);
      return p?.structure_devis || "standard";
    }
    // Fallback : détection OPEN GTC par nom (rétro-compatibilité)
    if (/open.?gtc/i.test(prestataire.trim())) return "par_sections";
    return "standard";
  };

  // Détecte la catégorie à partir de mots-clés (uniquement pour fiches avec destrat)
  const detectCat = txt => {
    const t = txt.toUpperCase();
    if (/POSE|INSTALL|CÂBLAGE|CABLAGE|MONTAGE|CRÉATION|CREATION|MAIN.D.OEUVRE|MO\b/.test(t)) return "MAIN D'ŒUVRE";
    if (/DÉPLACEMENT|DEPLACEMENT|NACELLE|LIVRAISON|TRANSPORT|LOCATION|FRAIS|FORFAIT DÉPL/.test(t)) return "DIVERS";
    return "MATÉRIEL";
  };

  const extraire = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      // Convertir le PDF en base64 (par chunks pour éviter stack overflow sur gros fichiers)
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let binary = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const b64 = btoa(binary);

      // Structure du devis selon le prestataire sélectionné (ou fallback regex)
      const structureDevis = getStructureDevis();
      const isParSections  = structureDevis === "par_sections";

      // Modèle : Sonnet pour docs complexes multi-pages (par_sections), Haiku pour fiches simples
      const model = isParSections ? "claude-sonnet-4-5" : "claude-haiku-4-5-20251001";

      // Prompt adapté selon le prestataire et la fiche CEE
      const promptTexte = isParSections
        ? `Ce PDF est un devis multi-pages du prestataire "${prestataire}" pour la fiche CEE ${ficheCEE}.

STRUCTURE DU DOCUMENT :
- Des TITRES DE TRANCHES (texte en gras coloré, SANS valeurs dans les colonnes Qté/Prix/Montant) : ex. "Supervision GTB - Reprise du poste de supervision existant", "Travaux sur les Aérothermes - TD gestion Aérothermes - 6 TD", "Travaux sur la Chaufferie", etc.
- Des LIGNES DE POSTES (avec Qté, Prix Unitaire HT, Montant HT) — les descriptions peuvent couvrir plusieurs lignes et regrouper plusieurs opérations dans un seul poste
- Des SOUS-TOTAUX (commençant par "Sous-total") et TOTAUX → À IGNORER
- ATTENTION DOUBLONS : certaines descriptions sont COUPÉES entre deux pages. La description commence en fin d'une page avec ses valeurs (Qté, Prix), et sa suite apparaît en début de la page suivante SANS valeurs. Il faut RECONSTITUER la description complète et ne créer QU'UNE SEULE ligne.

RÈGLES STRICTES :
1. Inclure chaque titre de tranche avec isSection: true, qte: 0, puAchat: 0, unite: ""
2. Inclure chaque ligne de poste avec isSection: false, ses vraies valeurs qte et puAchat
3. IGNORER : "Sous-total", "Total", TVA, "Net à payer", "Mode de règlement", en-têtes de colonnes ("Désignation", "Unité", "Qté"…), récapitulatifs, mentions légales, infos facturation
4. ASSEMBLER les descriptions coupées entre pages : si une description se termine en fin de page et continue en début de page suivante sans nouveau prix → c'est UNE SEULE ligne, prendre la description COMPLÈTE avec le prix de la première occurrence
5. NE JAMAIS DUPLIQUER une ligne (vérifier que chaque combinaison description+prix n'apparaît qu'une fois)
6. Conserver l'ORDRE EXACT du document
7. Ne jamais découper un poste en plusieurs lignes, ne jamais fusionner deux postes distincts
8. Conserver la description COMPLÈTE, y compris toutes les opérations regroupées dans un poste

FORMAT ATTENDU (tableau JSON, sans markdown, sans commentaires) :
[
  {"designation":"Supervision GTB - Reprise du poste de supervision existant","isSection":true,"qte":0,"puAchat":0,"unite":""},
  {"designation":"Licence EC-NET + Supervision Enyvision à installer sur le poste existant","isSection":false,"qte":1,"puAchat":4125.00,"unite":"U"},
  {"designation":"Installation du logiciel sur le poste de supervision\\nCréation de la navigation de la supervision Enyvision\\nTests, essais et mise en service des points sur la supervision","isSection":false,"qte":1,"puAchat":4095.00,"unite":"U"}
]`
        : avecCat
        ? `Devis du prestataire "${prestataire}" pour la fiche CEE ${ficheCEE}.
Analyse le tableau et extrais CHAQUE ligne produit/prestation (SAUF totaux, sous-totaux, TVA, acomptes, en-têtes).
IMPORTANT : conserve la désignation COMPLÈTE sans tronquer, même si elle est longue.
Pour chaque ligne, retourne un objet JSON avec :
- designation : string (description COMPLÈTE, ne tronque pas)
- qte : number
- puAchat : number (prix unitaire HT en euros)
- unite : string (U, ml, m², h, Forfait — "U" si non précisé)

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après, sans markdown.
Exemple : [{"designation":"Rail acier galvanisé 3m perforé","qte":30,"puAchat":62.47,"unite":"U"}]`
        : `Devis du prestataire "${prestataire}" pour la fiche CEE ${ficheCEE}.
Analyse le tableau et extrais CHAQUE ligne produit/prestation dans l'ORDRE du document (SAUF totaux, sous-totaux, TVA, acomptes, en-têtes).
IMPORTANT : conserve la désignation COMPLÈTE sans tronquer, même si elle est très longue.
Pour chaque ligne, retourne un objet JSON avec :
- designation : string (description COMPLÈTE et fidèle au document, ne tronque pas)
- qte : number
- puAchat : number (prix unitaire HT en euros)
- unite : string (U, ml, m², h, Forfait — "U" si non précisé)

Ne regroupe pas et ne catégorise pas les lignes. Conserve la structure et l'ordre exact du devis.
Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après, sans markdown.
Exemple : [{"designation":"Fourniture et pose isolation combles perdus laine de verre 200mm","qte":120,"puAchat":18.50,"unite":"m²"}]`;

      const resp = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-beta": "pdfs-2024-09-25" },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
              { type: "text", text: promptTexte },
            ],
          }],
        }),
      });

      const result = await resp.json();

      if (!resp.ok) {
        // Log complet pour diagnostic
        const errMsg = result?.error?.message || result?.message || JSON.stringify(result).substring(0, 300);
        throw new Error(`API ${resp.status} — ${errMsg}`);
      }
      const raw = result.content?.[0]?.text?.trim() || "";

      // Extraire le JSON : chercher le premier [ et le dernier ] dans la réponse brute
      const start = raw.indexOf('[');
      const end   = raw.lastIndexOf(']');
      if (start === -1 || end <= start) {
        const hint = raw.length > 100 && end === -1 ? " (réponse tronquée — trop de lignes ?)" : "";
        throw new Error("Réponse Claude invalide" + hint + " : " + raw.substring(0, 200));
      }

      const items = JSON.parse(raw.substring(start, end + 1));
      if (!Array.isArray(items) || items.length === 0) throw new Error("Aucune ligne extraite par Claude");

      const cent = v => Math.round(v * 100) / 100;
      const lignes = items
        .filter(it => it.isSection === true || (it.puAchat > 0 && it.designation?.length > 2))
        .map((it, idx) => {
          const isSec = it.isSection === true;
          const cat   = isSec ? "SECTION" : (avecCat ? detectCat(it.designation) : "MATÉRIEL");
          const marge = isSec ? 0 : (avecCat ? (cat === "MAIN D'ŒUVRE" ? 25 : cat === "DIVERS" ? 10 : 30) : 30);
          return {
            id: idx + 1,
            isSection: isSec,
            cat,
            designation: String(it.designation).substring(0, 600),
            qte:      isSec ? 0 : cent(Number(it.qte)     || 1),
            unite:    isSec ? ""  : (it.unite || "U"),
            puAchat:  isSec ? 0 : cent(Number(it.puAchat) || 0),
            margePct: marge,
            puVente:  isSec ? 0 : cent((Number(it.puAchat) || 0) * (1 + marge / 100)),
            inclus: true,
          };
        });

      if (lignes.length === 0) throw new Error("Aucune ligne valide extraite");
      setPreview(lignes);

    } catch (e) {
      setError("Erreur extraction : " + e.message);
    }
    setLoading(false);
  };

  const totalAchat = (preview || []).reduce((s, l) => s + l.qte * l.puAchat, 0);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"28px 32px",width:600,maxHeight:"85vh",overflow:"auto",boxShadow:"0 25px 60px rgba(0,0,0,.4)"}}>
        {/* Steps */}
        <div style={{display:"flex",gap:0,marginBottom:24,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
          {["1 · Infos client","2 · Devis prestataire","3 · Marges & export"].map((s,i)=>(
            <div key={i} style={{flex:1,padding:"8px 6px",textAlign:"center",fontSize:11,fontWeight:i===1?700:500,background:i===1?C.accent:i===0?"#E2E8F0":C.bg,color:i===1?"#fff":i===0?C.textSoft:C.textSoft,borderRight:i<2?`1px solid ${C.border}`:"none"}}>
              {i===0?"✓ "+s:s}
            </div>
          ))}
        </div>

        <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:4}}>📎 Devis prestataire</div>
        <div style={{fontSize:13,color:C.textMid,marginBottom:14}}>
          Client : <strong>{infosClient.nomClient}</strong> — {infosClient.refDevis}
          <span style={{marginLeft:10,background:C.accentL,color:C.accent,borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>{FICHES_DEVIS[ficheCEE] || ficheCEE}</span>
        </div>

        {/* Prestataire */}
        {!preview && (
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:C.textMid,marginBottom:4,textTransform:"uppercase",letterSpacing:.4}}>
              Prestataire (sous-traitant)
            </label>
            {prestaList.length > 0 ? (
              <>
                <select value={selectedPrestaId} onChange={e => handleSelectPresta(e.target.value)}
                  style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit",appearance:"auto",marginBottom:6}}>
                  <option value="">— Saisie manuelle —</option>
                  {prestaList.map(p => <option key={p.id} value={p.id}>{p.nom}{p.structure_devis === "par_sections" ? " ✨ Sonnet" : ""}</option>)}
                </select>
                {!selectedPrestaId && (
                  <input value={prestataire} onChange={e=>setPrestataire(e.target.value)} placeholder="Nom du prestataire…"
                    style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
                )}
                {selectedPrestaId && (() => {
                  const p = prestaList.find(x => x.id === selectedPrestaId);
                  return p ? (
                    <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:7,padding:"8px 12px",fontSize:12,color:"#1E3A8A"}}>
                      <strong>{p.nom}</strong>
                      {p.info_legal && <> — {p.info_legal}</>}
                      {p.rge_num && <> · RGE {p.rge_num}</>}
                      <br/>
                      <span style={{fontWeight:700,color: p.structure_devis === "par_sections" ? "#7C3AED" : "#16A34A"}}>
                        {p.structure_devis === "par_sections" ? "✨ Sonnet — extraction par tranches/sections" : "⚡ Haiku — extraction standard"}
                      </span>
                    </div>
                  ) : null;
                })()}
              </>
            ) : (
              <input value={prestataire} onChange={e=>setPrestataire(e.target.value)} placeholder="DC LINK, Nom du prestataire..."
                style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
            )}
            <div style={{fontSize:11,color:C.textSoft,marginTop:4}}>
              Gérer les prestataires dans <strong>Paramètres → Prestataires</strong>.
            </div>
          </div>
        )}

        {/* Zone upload */}
        {!preview && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if(f?.type==="application/pdf") setFile(f); }}
              onDragOver={e => e.preventDefault()}
              style={{border:`2px dashed ${file?C.accent:C.border}`,borderRadius:10,padding:"32px 20px",textAlign:"center",cursor:"pointer",background:file?C.accentL:C.bg,marginBottom:16,transition:"all .2s"}}>
              <div style={{fontSize:36,marginBottom:8}}>{file?"📄":"⬆️"}</div>
              <div style={{fontSize:14,fontWeight:700,color:file?C.accent:C.text}}>{file ? file.name : "Glissez le PDF ou cliquez pour sélectionner"}</div>
              <div style={{fontSize:12,color:C.textSoft,marginTop:4}}>{file ? `${(file.size/1024).toFixed(0)} Ko` : "Devis PDF du prestataire (DC LINK, sous-traitant...)"}</div>
              <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={e => setFile(e.target.files[0])}/>
            </div>
            {error && <div style={{background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:7,padding:"10px 14px",color:"#DC2626",fontSize:12,marginBottom:14}}>{error}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={onBack} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,borderRadius:8,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Retour</button>
              <button onClick={onSkip} style={{flex:1,padding:"11px",background:C.bg,border:`1px solid ${C.border}`,color:C.textMid,borderRadius:8,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Passer (saisie manuelle)</button>
              <button onClick={extraire} disabled={!file||loading} style={{flex:2,padding:"11px",background:file&&!loading?C.accent:"#94A3B8",border:"none",color:"#fff",borderRadius:8,fontSize:13,fontWeight:700,cursor:file&&!loading?"pointer":"not-allowed",fontFamily:"inherit"}}>
                {loading ? "⏳ Extraction IA en cours..." : "🤖 Extraire les lignes"}
              </button>
            </div>
          </>
        )}

        {/* Preview lignes extraites */}
        {preview && (
          <>
            <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#15803D"}}>✅ {preview.length} lignes extraites</div>
                <div style={{fontSize:12,color:"#16A34A"}}>Coût achat total : {fmtE(totalAchat)}</div>
              </div>
              <button onClick={() => setPreview(null)} style={{fontSize:11,color:C.textMid,background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 8px",cursor:"pointer",fontFamily:"inherit"}}>Ré-uploader</button>
            </div>
            <div style={{maxHeight:280,overflowY:"auto",marginBottom:16,border:`1px solid ${C.border}`,borderRadius:8}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:C.nav,color:C.navText}}>
                  <th style={{padding:"7px 10px",textAlign:"left"}}>Désignation</th>
                  <th style={{padding:"7px 8px",textAlign:"center"}}>Qté</th>
                  <th style={{padding:"7px 8px",textAlign:"right"}}>P.U. achat</th>
                  <th style={{padding:"7px 8px",textAlign:"right"}}>Total</th>
                </tr></thead>
                <tbody>
                  {preview.map((l,i) => (
                    <tr key={i} style={{background:i%2===0?C.surface:C.bg,borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"6px 10px"}}>
                        <div style={{fontSize:11,color:C.text}}>{l.designation}</div>
                        <span style={{fontSize:10,padding:"1px 5px",borderRadius:3,background:CAT_S[l.cat]?.bg,color:CAT_S[l.cat]?.text}}>{l.cat}</span>
                      </td>
                      <td style={{padding:"6px 8px",textAlign:"center",color:C.textMid}}>{l.qte} {l.unite}</td>
                      <td style={{padding:"6px 8px",textAlign:"right",color:C.textMid}}>{fmtE(l.puAchat)}</td>
                      <td style={{padding:"6px 8px",textAlign:"right",fontWeight:600,color:C.text}}>{fmtE(l.qte*l.puAchat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{fontSize:12,color:C.textMid,marginBottom:14,background:C.accentL,padding:"8px 12px",borderRadius:7,border:`1px solid #BFDBFE`}}>
              💡 Les marges seront appliquées automatiquement (30% matériel, 25% MO, 10% divers). Tu pourras tout ajuster dans l'éditeur.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={() => setPreview(null)} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,borderRadius:8,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Retour</button>
              <button onClick={() => onLignesExtracted(preview)} style={{flex:2,padding:"11px",background:C.accent,border:"none",color:"#fff",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                Ouvrir l'éditeur →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Éditeur d'un devis ─────────────────────────────────────────────────────
function EditeurDevis({ devisInit, onBack, onSave, onReupload, dossiersList = [] }) {
  const [devis, setDevis] = useState(devisInit);
  const [tab, setTab]     = useState("marges");
  const [editConfig, setEditConfig] = useState(null); // null | "client"|"prestataire"|"devis"|"societe"
  const printRef = useRef();

  const lignes   = devis.lignes;
  const setLignes = fn => setDevis(d => ({...d, lignes: fn(d.lignes), updatedAt: Date.now()}));
  const setBatPuVente = v => setDevis(d => ({...d, batPuVente: v, updatedAt: Date.now()}));
  const setBatQte = v => setDevis(d => ({...d, batQte: v, updatedAt: Date.now()}));

  const actives     = lignes.filter(l => l.inclus);
  const hasSections = lignes.some(l => l.isSection);
  const cats        = [...new Set(actives.filter(l => !l.isSection).map(l => l.cat))];
  // Prime CEE simulateur — référence interne, lecture seule
  const primeCEESimu = devis.prime || 0;
  const batPuVente = devis.batPuVente || 0;
  const batQte  = devis.batQte || 0;

  // Prime faciale : null = auto (= TTC), sinon valeur manuelle
  const [primeFaciale, setPrimeFaciale] = useState(devisInit.primeFaciale ?? null);

  // Sync primeFaciale dans l'objet devis pour que onSave() l'inclue
  useEffect(() => {
    setDevis(d => ({...d, primeFaciale, updatedAt: Date.now()}));
  }, [primeFaciale]);

  const stats = useMemo(() => {
    const sl       = actives.filter(l => !l.isSection);
    const achat    = sl.reduce((s,l) => s+l.qte*l.puAchat, 0);
    const sousTot  = sl.reduce((s,l) => s+l.qte*l.puVente, 0);
    const totalHT  = sousTot + batQte * batPuVente;
    const totalTVA = totalHT * .20;
    const totalTTC = totalHT + totalTVA;
    // Prime faciale effective : manuelle si saisie, sinon = TTC
    const effectivePrimeFaciale = primeFaciale !== null ? primeFaciale : totalTTC;
    return { achat, sousTot, marge: sousTot-achat, margePct: achat>0?(sousTot-achat)/achat*100:0, margeNette: sousTot>0?(sousTot-achat)/sousTot*100:0, totalHT, totalTVA, totalTTC, effectivePrimeFaciale, resteHT: totalHT-effectivePrimeFaciale, resteTTC: totalTTC-effectivePrimeFaciale };
  }, [actives, batPuVente, batQte, primeFaciale]);

  const upd = (id, field, value) => setLignes(ls => ls.map(l => {
    if (l.id !== id) return l;
    const toNum = v => parseFloat(parseFloat(v).toFixed(2)) || 0;
    const u = {...l, [field]: ["qte","puAchat","puVente","margePct"].includes(field) ? toNum(value) : value};
    if (field === "puVente" && u.puAchat>0) u.margePct = parseFloat(((u.puVente/u.puAchat-1)*100).toFixed(2));
    if (field === "margePct") u.puVente = parseFloat((u.puAchat*(1+toNum(value)/100)).toFixed(2));
    if (field === "puAchat") u.puVente = parseFloat((toNum(value)*(1+u.margePct/100)).toFixed(2));
    return u;
  }));

  const applyGlobal = pct => setLignes(ls => ls.map(l =>
    l.isSection ? l : {...l, margePct: pct, puVente: parseFloat((l.puAchat*(1+pct/100)).toFixed(2))}
  ));

  const addLigne = () => {
    const newId = Math.max(0, ...lignes.map(l=>l.id)) + 1;
    setLignes(ls => [...ls, {id:newId, cat:"MATÉRIEL", designation:"Nouvelle ligne", qte:1, unite:"U", puAchat:0, margePct:30, puVente:0, inclus:true}]);
  };

  const delLigne = id => setLignes(ls => ls.filter(l => l.id !== id));

  const [exporting, setExporting] = useState(false);
  const [savingToDossier, setSavingToDossier] = useState(false);
  const [savedToDossier, setSavedToDossier] = useState(false);

  const loadScript = src => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script"); s.src = src;
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });

  const exportPDF = async () => {
    setExporting(true);
    try {
      const doc = (
        <DevisPDFDoc
          devis={devis}
          lignes={actives}
          cats={cats}
          batPuVente={batPuVente}
          batQte={batQte}
          primeFaciale={stats.effectivePrimeFaciale}
          primeCEESimu={primeCEESimu}
          stats={stats}
          params={devis.pdfParams || {}}
        />
      );
      const blob = await pdf(doc).toBlob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `Devis_${devis.nomClient || "client"}_${devis.refDevis || "ref"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      alert("Erreur export PDF : " + e.message);
    }
    setExporting(false);
  };

  const saveToDossier = async () => {
    if (!devis.dossierId) {
      alert("Aucun dossier associé. Ouvrez Paramètres → onglet Devis pour en associer un.");
      return;
    }
    setSavingToDossier(true);
    try {
      const doc = (
        <DevisPDFDoc
          devis={devis}
          lignes={actives}
          cats={cats}
          batPuVente={batPuVente}
          batQte={batQte}
          primeFaciale={stats.effectivePrimeFaciale}
          primeCEESimu={primeCEESimu}
          stats={stats}
          params={devis.pdfParams || {}}
        />
      );
      const blob = await pdf(doc).toBlob();
      // Chercher les versions existantes dans le dossier
      const { data: existing } = await supabase.storage.from("dossier-documents").list(devis.dossierId);
      const prefix = `Devis_${(devis.refDevis || "ref").replace(/[^a-zA-Z0-9_-]/g, "_")}_v`;
      const maxVer = (existing || [])
        .filter(f => f.name.startsWith(prefix))
        .map(f => { const m = f.name.match(/_v(\d+)\.pdf$/); return m ? parseInt(m[1]) : 0; })
        .reduce((a, b) => Math.max(a, b), 0);
      const fileName = `${prefix}${maxVer + 1}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("dossier-documents")
        .upload(`${devis.dossierId}/${fileName}`, blob, { contentType: "application/pdf" });
      if (uploadError) throw new Error(uploadError.message);
      setSavedToDossier(true);
      setTimeout(() => setSavedToDossier(false), 3000);
    } catch(e) {
      alert("Erreur enregistrement dans le dossier : " + e.message);
    }
    setSavingToDossier(false);
  };

  const TH  = {padding:"9px 8px",fontSize:12,fontWeight:700,textAlign:"right",color:C.navText,whiteSpace:"nowrap"};
  const TD  = {padding:"6px 8px",borderBottom:`1px solid ${C.border}`,verticalAlign:"middle"};
  const INP = {border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 6px",fontSize:12,background:C.surface,outline:"none",fontFamily:"inherit",color:C.text};

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
      {/* Barre du haut */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"8px 16px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        <button onClick={() => { onSave({...devis, primeFaciale}); onBack(); }}
          style={{background:"transparent",border:"none",color:C.textMid,fontSize:13,cursor:"pointer",padding:"4px 8px",marginRight:4,fontFamily:"inherit"}}>
          ← Mes devis
        </button>
        <div style={{fontWeight:700,color:C.text,fontSize:14}}>{devis.nomClient}</div>
        <div style={{fontSize:11,color:C.textSoft,marginLeft:4}}>{devis.refDevis}</div>
        {onReupload && (
          <button onClick={onReupload}
            style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",color:C.textMid,marginLeft:4}}>
            📎 Re-uploader devis presta
          </button>
        )}

        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          {[["marges","📊 Marges"],["devis","📄 Aperçu"]].map(([v,l]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{background:tab===v?C.accent:"transparent",color:tab===v?"#fff":C.textMid,border:`1px solid ${tab===v?C.accent:C.border}`,borderRadius:7,padding:"6px 14px",fontSize:13,fontWeight:tab===v?700:400,cursor:"pointer"}}>
              {l}
            </button>
          ))}
          {devis.dossierId && (
            <button onClick={saveToDossier} disabled={savingToDossier}
              style={{background:savedToDossier?"#16A34A":savingToDossier?"#94A3B8":"#0F172A",color:"#fff",border:`1px solid ${savedToDossier?"#16A34A":"#334155"}`,borderRadius:7,padding:"6px 14px",fontSize:13,fontWeight:600,cursor:savingToDossier?"not-allowed":"pointer"}}>
              {savedToDossier ? "✓ Enregistré" : savingToDossier ? "⏳…" : "💾 Dossier"}
            </button>
          )}
          <button onClick={() => setEditConfig("client")}
            style={{background:C.bg,color:C.textMid,border:`1px solid ${C.border}`,borderRadius:7,padding:"6px 14px",fontSize:13,cursor:"pointer"}}>
            ⚙ Paramètres
          </button>
          <button onClick={exportPDF} disabled={exporting}
            style={{background:exporting?"#94A3B8":"#16A34A",color:"#fff",border:"none",borderRadius:7,padding:"6px 16px",fontSize:13,fontWeight:700,cursor:exporting?"not-allowed":"pointer"}}>
            {exporting ? "⏳ Export..." : "⬇ PDF"}
          </button>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* MARGES */}
        <div style={{width:tab==="marges"?"58%":"0%",minWidth:0,overflow:"auto",borderRight:`1px solid ${C.border}`,background:C.surface,display:"flex",flexDirection:"column",transition:"width .2s"}}>
          {/* KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            {[
              {label:"Coût achat",    val:fmtE(stats.achat),    color:C.textMid},
              {label:"Vente HT",      val:fmtE(stats.totalHT),  color:C.accent},
              {label:"Marge brute",   val:fmtE(stats.marge),    color:MC2(stats.margePct)},
              {label:"Taux de marque",val:stats.margeNette.toFixed(1)+"%",color:MC2(stats.margeNette)},
            ].map(k => (
              <div key={k.label} style={{padding:"10px 12px",borderRight:`1px solid ${C.border}`}}>
                <div style={{fontSize:10,color:C.textSoft,textTransform:"uppercase",letterSpacing:.4,fontWeight:600,marginBottom:3}}>{k.label}</div>
                <div style={{fontSize:15,fontWeight:800,color:k.color}}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Presets marge + saisie libre */}
          <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",flexShrink:0}}>
            <span style={{fontSize:12,color:C.textMid,fontWeight:600,marginRight:4}}>Marge globale :</span>
            {[0,10,15,20,25,30,40,50].map(p => (
              <button key={p} onClick={() => applyGlobal(p)}
                style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 10px",fontSize:12,fontWeight:600,cursor:"pointer",color:C.text}}>
                {p}%
              </button>
            ))}
            {/* Marge CEE auto : (primeCEESimu / 2) / TTC à 0% marge */}
            {primeCEESimu > 0 && stats.achat > 0 && (() => {
              const ttcZero = (stats.achat + batQte * batPuVente) * 1.20;
              const pCEE = parseFloat(((primeCEESimu / 2) / ttcZero * 100 - 100).toFixed(2));
              return (
                <button onClick={() => applyGlobal(pCEE)}
                  title={`(Prime CEE ${fmtE(primeCEESimu)} ÷ 2) ÷ TTC à 0% marge ${fmtE(ttcZero)}`}
                  style={{background:"#FEF9C3",border:"1px solid #EAB308",borderRadius:5,padding:"3px 10px",fontSize:12,fontWeight:700,cursor:"pointer",color:"#854D0E"}}>
                  CEE {pCEE}%
                </button>
              );
            })()}
            {/* Saisie manuelle */}
            <div style={{display:"flex",alignItems:"center",gap:4,marginLeft:4}}>
              <input
                type="number" min="0" max="999" step="0.1"
                placeholder="…"
                onKeyDown={e => { if (e.key === "Enter") { const v = parseFloat(e.target.value); if (!isNaN(v)) { applyGlobal(v); e.target.blur(); } } }}
                onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && e.target.value !== "") applyGlobal(v); }}
                style={{width:60,border:`1px solid ${C.accent}`,borderRadius:5,padding:"3px 6px",fontSize:12,fontWeight:700,color:C.accent,outline:"none",fontFamily:"inherit",background:"#EFF6FF",textAlign:"center"}}
              />
              <span style={{fontSize:11,color:C.textMid}}>%</span>
            </div>
            <button onClick={addLigne}
              style={{marginLeft:"auto",background:C.accent,color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              ＋ Ligne
            </button>
          </div>

          {/* Tableau lignes */}
          <div style={{overflow:"auto",flex:1}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:C.nav,position:"sticky",top:0,zIndex:2}}>
                <th style={{...TH,width:24,textAlign:"center"}}>✓</th>
                <th style={{...TH,textAlign:"left"}}>Désignation</th>
                <th style={TH}>Qté</th>
                <th style={TH}>Achat</th>
                <th style={TH}>Marge</th>
                <th style={TH}>Vente</th>
                <th style={TH}>Total HT</th>
                <th style={{...TH,width:24}}></th>
              </tr></thead>
              <tbody>
                {hasSections ? (
                  // ── Mode sections OPEN GTC : ordre original préservé ──
                  lignes.map((l, ri) => {
                    if (l.isSection) {
                      return (
                        <tr key={l.id}>
                          <td style={{...TD,textAlign:"center",color:C.textSoft,fontSize:11}}>—</td>
                          <td colSpan={6} style={{...TD,background:"#1E3A8A",color:"#fff",fontWeight:700,fontSize:11,letterSpacing:.3}}>
                            📁 {l.designation}
                          </td>
                          <td style={{...TD,textAlign:"center",background:"#1E3A8A"}}>
                            <button onClick={()=>delLigne(l.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#93C5FD",fontSize:14,padding:"2px"}}>✕</button>
                          </td>
                        </tr>
                      );
                    }
                    const mc = MC2(l.margePct);
                    return (
                      <tr key={l.id} style={{background:ri%2===0?C.surface:C.bg}}>
                        <td style={{...TD,textAlign:"center"}}>
                          <input type="checkbox" checked={l.inclus} onChange={e=>upd(l.id,"inclus",e.target.checked)} style={{cursor:"pointer",width:14,height:14}}/>
                        </td>
                        <td style={{...TD,minWidth:220,maxWidth:340}}>
                          <input value={l.designation} onChange={e=>upd(l.id,"designation",e.target.value)}
                            style={{...INP,width:"100%",fontSize:12,padding:"4px 6px"}}/>
                          <div style={{display:"flex",gap:4,marginTop:3}}>
                            <input value={l.unite} onChange={e=>upd(l.id,"unite",e.target.value)}
                              style={{...INP,width:42,fontSize:11,padding:"2px 5px"}}/>
                          </div>
                        </td>
                        <td style={{...TD,textAlign:"center"}}>
                          <input type="number" value={l.qte} onChange={e=>upd(l.id,"qte",e.target.value)} style={{...INP,width:54,textAlign:"center"}}/>
                        </td>
                        <td style={{...TD,textAlign:"right"}}>
                          <input type="number" value={l.puAchat} onChange={e=>upd(l.id,"puAchat",e.target.value)} style={{...INP,width:78,textAlign:"right",color:C.textMid}}/>
                        </td>
                        <td style={{...TD,textAlign:"center"}}>
                          <input type="number" value={l.margePct} onChange={e=>upd(l.id,"margePct",e.target.value)} style={{...INP,width:50,textAlign:"center",color:mc,fontWeight:700}}/>
                          <span style={{color:mc,fontSize:12,fontWeight:700,marginLeft:1}}>%</span>
                        </td>
                        <td style={{...TD,textAlign:"right"}}>
                          <input type="number" value={l.puVente} onChange={e=>upd(l.id,"puVente",e.target.value)} style={{...INP,width:78,textAlign:"right",fontWeight:700,color:C.accent}}/>
                        </td>
                        <td style={{...TD,textAlign:"right",fontWeight:700,color:C.text,fontSize:12}}>{fmt(l.qte*l.puVente)} €</td>
                        <td style={{...TD,textAlign:"center"}}>
                          <button onClick={()=>delLigne(l.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#DC2626",fontSize:14,padding:"2px"}}>✕</button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  // ── Mode catégories (MATÉRIEL / MO / DIVERS) ──
                  cats.map(cat => {
                    const cl = actives.filter(l => l.cat === cat);
                    const cs = CAT_S[cat] || {bg:C.bg,text:C.text,border:C.border};
                    const ct = cl.reduce((s,l) => s+l.qte*l.puVente, 0);
                    return [
                      <tr key={"c"+cat}>
                        <td colSpan={7} style={{background:cs.bg,padding:"6px 10px",fontWeight:700,fontSize:11,color:cs.text,textTransform:"uppercase",border:`1px solid ${cs.border}`}}>{cat}</td>
                        <td style={{background:cs.bg,padding:"6px 10px",textAlign:"right",fontWeight:700,fontSize:11,color:cs.text,border:`1px solid ${cs.border}`}}>{fmt(ct)} €</td>
                      </tr>,
                      ...cl.map((l, ri) => {
                        const mc = MC2(l.margePct);
                        return (
                          <tr key={l.id} style={{background:ri%2===0?C.surface:C.bg}}>
                            <td style={{...TD,textAlign:"center"}}>
                              <input type="checkbox" checked={l.inclus} onChange={e=>upd(l.id,"inclus",e.target.checked)} style={{cursor:"pointer",width:14,height:14}}/>
                            </td>
                            <td style={{...TD,minWidth:220,maxWidth:340}}>
                              <input value={l.designation} onChange={e=>upd(l.id,"designation",e.target.value)}
                                style={{...INP,width:"100%",fontSize:12,padding:"4px 6px"}}/>
                              <div style={{display:"flex",gap:4,marginTop:3}}>
                                <select value={l.cat} onChange={e=>upd(l.id,"cat",e.target.value)}
                                  style={{...INP,fontSize:11,padding:"2px 5px"}}>
                                  {["MATÉRIEL","MAIN D'ŒUVRE","DIVERS"].map(c=><option key={c}>{c}</option>)}
                                </select>
                                <input value={l.unite} onChange={e=>upd(l.id,"unite",e.target.value)}
                                  style={{...INP,width:42,fontSize:11,padding:"2px 5px"}}/>
                              </div>
                            </td>
                            <td style={{...TD,textAlign:"center"}}>
                              <input type="number" value={l.qte} onChange={e=>upd(l.id,"qte",e.target.value)} style={{...INP,width:54,textAlign:"center"}}/>
                            </td>
                            <td style={{...TD,textAlign:"right"}}>
                              <input type="number" value={l.puAchat} onChange={e=>upd(l.id,"puAchat",e.target.value)} style={{...INP,width:78,textAlign:"right",color:C.textMid}}/>
                            </td>
                            <td style={{...TD,textAlign:"center"}}>
                              <input type="number" value={l.margePct} onChange={e=>upd(l.id,"margePct",e.target.value)} style={{...INP,width:50,textAlign:"center",color:mc,fontWeight:700}}/>
                              <span style={{color:mc,fontSize:12,fontWeight:700,marginLeft:1}}>%</span>
                            </td>
                            <td style={{...TD,textAlign:"right"}}>
                              <input type="number" value={l.puVente} onChange={e=>upd(l.id,"puVente",e.target.value)} style={{...INP,width:78,textAlign:"right",fontWeight:700,color:C.accent}}/>
                            </td>
                            <td style={{...TD,textAlign:"right",fontWeight:700,color:C.text,fontSize:12}}>{fmt(l.qte*l.puVente)} €</td>
                            <td style={{...TD,textAlign:"center"}}>
                              <button onClick={()=>delLigne(l.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#DC2626",fontSize:14,padding:"2px"}}>✕</button>
                            </td>
                          </tr>
                        );
                      })
                    ];
                  })
                )}

                {/* BAT-TH ligne — rétro-compatibilité anciens devis uniquement */}
                {batQte > 0 && <tr>
                  <td colSpan={2} style={{background:"#EFF6FF",padding:"6px 10px",fontWeight:700,fontSize:11,color:"#1D4ED8",textTransform:"uppercase",borderTop:`2px solid ${C.border}`}}>
                    BAT-TH-142
                  </td>
                  <td style={{background:"#EFF6FF",padding:"6px 8px",borderTop:`2px solid ${C.border}`}}>
                    <input type="number" value={batQte} onChange={e=>setBatQte(Number(e.target.value)||0)} style={{...INP,width:40,textAlign:"center",color:"#1D4ED8"}}/>
                    <span style={{fontSize:10,color:"#1D4ED8",marginLeft:2}}>U</span>
                  </td>
                  <td colSpan={3} style={{background:"#EFF6FF",padding:"6px 8px",textAlign:"right",color:"#1D4ED8",borderTop:`2px solid ${C.border}`}}>
                    <span style={{fontSize:11,marginRight:4}}>P.U. :</span>
                    <input type="number" value={batPuVente} onChange={e=>setBatPuVente(Number(e.target.value)||0)} style={{...INP,width:70,textAlign:"right",color:"#1D4ED8",fontWeight:700}}/>
                    <span style={{fontSize:11,marginLeft:2,color:"#1D4ED8"}}>€/U</span>
                  </td>
                  <td style={{background:"#EFF6FF",padding:"6px 8px",textAlign:"right",fontWeight:700,color:"#1D4ED8",borderTop:`2px solid ${C.border}`}}>
                    {fmt(batQte*batPuVente)} €
                  </td>
                  <td style={{background:"#EFF6FF",borderTop:`2px solid ${C.border}`}}/>
                </tr>}

                {/* Prime CEE simulateur — référence lecture seule */}
                <tr>
                  <td colSpan={6} style={{background:"#F0FDF4",padding:"5px 10px",fontSize:10,color:"#15803D"}}>
                    <span style={{fontWeight:700,textTransform:"uppercase"}}>Prime CEE simulateur</span>
                    <span style={{fontWeight:400,marginLeft:6,fontSize:10,color:"#4ADE80"}}>(référence — lecture seule)</span>
                  </td>
                  <td style={{background:"#F0FDF4",padding:"5px 8px",textAlign:"right",color:"#15803D",fontWeight:700,fontSize:12}}>
                    {fmtE(primeCEESimu)}
                  </td>
                  <td style={{background:"#F0FDF4"}}/>
                </tr>
                {/* Prime faciale — éditable, auto = TTC */}
                <tr>
                  <td colSpan={5} style={{background:"#DCFCE7",padding:"6px 10px",fontWeight:700,fontSize:11,color:"#15803D",textTransform:"uppercase"}}>
                    Prime faciale (devis client)
                    {primeFaciale === null && <span style={{fontWeight:400,fontSize:10,color:"#4ADE80",marginLeft:6,textTransform:"none"}}>auto = TTC</span>}
                  </td>
                  <td colSpan={2} style={{background:"#DCFCE7",padding:"6px 8px",textAlign:"right",color:"#15803D",fontWeight:700}}>
                    − <input type="number"
                        value={primeFaciale !== null ? primeFaciale : stats.effectivePrimeFaciale.toFixed(2)}
                        onChange={e => setPrimeFaciale(Number(e.target.value) || 0)}
                        style={{...INP,width:84,textAlign:"right",color:"#15803D",fontWeight:700,background:"#F0FDF4"}}
                      /> €
                    {primeFaciale !== null && (
                      <button onClick={() => setPrimeFaciale(null)} title="Revenir à auto (= TTC)"
                        style={{marginLeft:6,background:"transparent",border:"1px solid #86EFAC",borderRadius:4,color:"#15803D",fontSize:11,cursor:"pointer",padding:"2px 6px",fontFamily:"inherit"}}>
                        ↺ Auto
                      </button>
                    )}
                  </td>
                  <td style={{background:"#DCFCE7"}}/>
                </tr>

                {/* Total */}
                <tr style={{background:C.nav}}>
                  <td colSpan={6} style={{padding:"9px 10px",color:C.navText,fontWeight:700,fontSize:13}}>TOTAL HT / RESTE TTC</td>
                  <td colSpan={2} style={{padding:"9px 10px",textAlign:"right",color:"#93C5FD",fontWeight:800,fontSize:13}}>{fmtE(stats.totalHT)} / {fmtE(stats.resteTTC)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* APERÇU DEVIS — PDFViewer react-pdf */}
        <div style={{flex:1,overflow:"hidden",background:"#E2E8F0",display:"flex",flexDirection:"column"}}>
          <PDFViewer width="100%" height="100%" style={{border:"none"}}>
            <DevisPDFDoc
              devis={devis}
              lignes={actives}
              cats={cats}
              batPuVente={batPuVente}
              batQte={batQte}
              primeFaciale={stats.effectivePrimeFaciale}
              primeCEESimu={primeCEESimu}
              stats={stats}
              params={devis.pdfParams || {}}
            />
          </PDFViewer>
        </div>
      </div>

      {/* Modal paramètres fusionné */}
      {editConfig && (
        <ModalDevisConfig
          devis={devis}
          initTab={editConfig}
          dossiersList={dossiersList}
          onSave={updates => {
            const next = {...devis, ...updates, updatedAt: Date.now()};
            setDevis(next);
            // Persist immédiatement en base (évite perte si l'user ne clique pas "← Mes devis")
            supabase.from("devis_hub").update(devisToRow(next)).eq("id", next.id)
              .then(({ error }) => { if (error) console.error("[Config save]", error.message); });
            setEditConfig(null);
          }}
          onCancel={() => setEditConfig(null)}
        />
      )}
    </div>
  );
}

// ── Modal paramètres devis — 4 onglets fusionnés ────────────────────────────
function ModalDevisConfig({ devis, initTab = "client", dossiersList = [], onSave, onCancel }) {
  const p = devis.pdfParams || {};
  const [activeTab, setActiveTab] = useState(initTab);
  const [prestaList, setPrestaList] = useState([]);
  useEffect(() => {
    supabase.from("prestataires").select("*").order("nom").then(({ data }) => { if (data) setPrestaList(data); });
  }, []);
  const [form, setForm] = useState({
    // Onglet Client
    nomClient:        devis.nomClient        || "",
    siret:            devis.siret            || "",
    codeNAF:          devis.codeNAF          || "",
    telephoneClient:  devis.telephoneClient  || "",
    emailClient:      devis.emailClient      || "",
    adresseSiege:     devis.adresseSiege     || "",
    nomContact:       devis.nomContact       || "",
    fonctionContact:  devis.fonctionContact  || "",
    // Onglet Prestataire
    sousTraitant:         devis.sousTraitant         || "DC LINK",
    rgeNum:               devis.rgeNum               || "AU 084 742",
    rgeValidite:          devis.rgeValidite           || "31/12/2026",
    adresseSite:          devis.adresseSite           || "",
    nomVisiteurVT:        p.nomVisiteurVT             || "",
    infoLegalPrestataire: p.infoLegalPrestataire      || "",
    // Onglet Devis
    ficheDevis:           devis.ficheDevis            || p.ficheDevis           || "BAT-TH-142",
    refDevis:             devis.refDevis             || "",
    dateDevis:            devis.dateDevis             || p.dateDevis            || "",
    dateVisiteTechnique:  p.dateVisiteTechnique       || "",
    validiteJours:        p.validiteJours             || 30,
    condPaiement:         p.condPaiement              || "Règlement comptant à réception de facture. Pénalités au taux légal + 5 points (art. L.441-10 Code de commerce). Indemnité forfaitaire 40 €.",
    mentionCEE:           p.mentionCEE                || "",
    cgv:                  p.cgv                       || "",
    mentionLegale:        p.mentionLegale             || "",
    mentionReleve:        p.mentionReleve             || "",
    // Onglet Délégataire
    delegataireNom:       p.delegataireNom            || "SOFT.IA",
    delegataireSiren:     p.delegataireSiren          || "533 333 118",
    // Dossier lié
    dossierId: devis.dossierId || "",
    // Onglet Société
    societeNom:     p.societeNom     || "AF2E",
    societeAdresse: p.societeAdresse || "2 Rue de la Darse — 94600 Choisy le Roi",
    societeSiret:   p.societeSiret   || "881 279 665 00023",
    societeTVA:     p.societeTVA     || "FR 238 812 796 65",
    rcs:            p.rcs            || "",
    capital:        p.capital        || "",
    assuranceLabel: p.assuranceLabel || "",
    numeroRGE:      p.numeroRGE      || "",
  });
  const set = (k, v) => setForm(f => ({...f, [k]: v}));
  const F = {width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit"};
  const L = {display:"block",fontSize:11,fontWeight:600,color:C.textMid,marginBottom:4,textTransform:"uppercase",letterSpacing:.4};

  const handleSave = () => {
    const selectedDossier = form.dossierId ? dossiersList.find(d => d.id === form.dossierId) : null;
    const primeFromDossier = selectedDossier?.prime_estimee ?? null;
    onSave({
      dossierId:       form.dossierId || null,
      // Met à jour la prime CEE si un dossier est associé et a une prime_estimee
      ...(primeFromDossier != null ? { prime: primeFromDossier } : {}),
      nomClient:       form.nomClient,
      siret:           form.siret,
      codeNAF:         form.codeNAF,
      telephoneClient: form.telephoneClient,
      emailClient:     form.emailClient,
      adresseSiege:    form.adresseSiege,
      nomContact:      form.nomContact,
      fonctionContact: form.fonctionContact,
      sousTraitant:    form.sousTraitant,
      rgeNum:          form.rgeNum,
      rgeValidite:     form.rgeValidite,
      adresseSite:     form.adresseSite,
      refDevis:        form.refDevis,
      dateDevis:       form.dateDevis,
      pdfParams: {
        ...p,
        ficheDevis:          form.ficheDevis,
        dateDevis:           form.dateDevis,
        dateVisiteTechnique: form.dateVisiteTechnique,
        validiteJours:       Number(form.validiteJours),
        condPaiement:        form.condPaiement,
        mentionCEE:          form.mentionCEE,
        cgv:                 form.cgv,
        mentionLegale:       form.mentionLegale,
        mentionReleve:       form.mentionReleve,
        nomVisiteurVT:       form.nomVisiteurVT,
        infoLegalPrestataire:form.infoLegalPrestataire,
        delegataireNom:      form.delegataireNom,
        delegataireSiren:    form.delegataireSiren,
        societeNom:          form.societeNom,
        societeAdresse:      form.societeAdresse,
        societeSiret:        form.societeSiret,
        societeTVA:          form.societeTVA,
        rcs:                 form.rcs,
        capital:             form.capital,
        assuranceLabel:      form.assuranceLabel,
        numeroRGE:           form.numeroRGE,
      },
    });
  };

  const TABS = [
    { id: "client",       label: "👤 Client" },
    { id: "prestataire",  label: "🔧 Prestataire" },
    { id: "devis",        label: "📄 Devis" },
    { id: "delegataire",  label: "🏦 Délégataire" },
    { id: "societe",      label: "🏢 Société" },
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}} onClick={onCancel}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,width:600,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 25px 60px rgba(0,0,0,.4)"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:"22px 28px 0",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:16}}>⚙️ Paramètres du devis</div>
          {/* Onglets */}
          <div style={{display:"flex",gap:0,borderBottom:`2px solid ${C.border}`}}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{padding:"8px 18px",fontSize:12,fontWeight:activeTab===t.id?700:500,cursor:"pointer",fontFamily:"inherit",background:"transparent",border:"none",
                  borderBottom:`2px solid ${activeTab===t.id?C.accent:"transparent"}`,
                  marginBottom:-2,color:activeTab===t.id?C.accent:C.textMid,transition:"all .15s"}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu scrollable */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 28px"}}>

          {/* ── Client ── */}
          {activeTab === "client" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {[
                {l:"Client *",             k:"nomClient",       ph:"KIABI LOGISTIQUE",       full:true},
                {l:"SIRET",                k:"siret",           ph:"347 727 950 00094"},
                {l:"Code NAF",             k:"codeNAF",         ph:"4690Z"},
                {l:"Téléphone",            k:"telephoneClient", ph:"01 23 45 67 89"},
                {l:"Email",                k:"emailClient",     ph:"contact@societe.fr"},
                {l:"Adresse siège social", k:"adresseSiege",    ph:"12 Rue de..., 75001 Paris", full:true},
                {l:"Contact (nom)",        k:"nomContact",      ph:"M. Dupont"},
                {l:"Fonction",             k:"fonctionContact", ph:"Responsable Technique"},
              ].map(f => (
                <div key={f.k} style={{gridColumn:f.full?"1/-1":"auto"}}>
                  <label style={L}>{f.l}</label>
                  <input value={form[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph} style={F}/>
                </div>
              ))}
            </div>
          )}

          {/* ── Prestataire ── */}
          {activeTab === "prestataire" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {/* Sélecteur prestataire enregistré */}
              {prestaList.length > 0 && (
                <div>
                  <label style={L}>Charger un prestataire enregistré</label>
                  <select defaultValue=""
                    onChange={e => {
                      const p = prestaList.find(x => x.id === e.target.value);
                      if (!p) return;
                      set("sousTraitant",         p.nom);
                      set("rgeNum",               p.rge_num      || "");
                      set("rgeValidite",           p.rge_validite || "");
                      set("infoLegalPrestataire",  p.info_legal   || "");
                    }}
                    style={{...F, appearance:"auto"}}>
                    <option value="">— Sélectionner pour remplir automatiquement —</option>
                    {prestaList.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                  <div style={{fontSize:11,color:C.textSoft,marginTop:4}}>
                    Les champs ci-dessous sont remplis automatiquement. Modifiez-les si besoin.
                  </div>
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {[
                  {l:"Sous-traitant / Poseur",  k:"sousTraitant",         ph:"DC LINK",                                               full:true},
                  {l:"N° RGE",                  k:"rgeNum",               ph:"AU 084 742"},
                  {l:"RGE valable jusqu'au",    k:"rgeValidite",           ph:"31/12/2026"},
                  {l:"Adresse du site (travaux)",k:"adresseSite",          ph:"771 Rue de la Plaine…",                                 full:true},
                  {l:"Info légal prestataire",   k:"infoLegalPrestataire", ph:"SARL DC LINK — SIRET 000 000 000 00000 — RCS Paris",    full:true},
                  {l:"Nom visiteur — Visite technique", k:"nomVisiteurVT", ph:"Jean Dupont",                                           full:true},
                ].map(f => (
                  <div key={f.k} style={{gridColumn:f.full?"1/-1":"auto"}}>
                    <label style={L}>{f.l}</label>
                    <input value={form[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph} style={F}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Devis ── */}
          {activeTab === "devis" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={L}>Fiche CEE</label>
                <select value={form.ficheDevis} onChange={e => set("ficheDevis", e.target.value)} style={{...F, appearance:"auto", fontWeight:600}}>
                  {Object.entries(FICHES_DEVIS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={L}>Dossier associé</label>
                <select value={form.dossierId || ""} onChange={e => set("dossierId", e.target.value || null)} style={{...F, appearance:"auto"}}>
                  <option value="">— Aucun —</option>
                  {dossiersList.map(d => (
                    <option key={d.id} value={d.id}>{d.ref}{d.prospects?.raison_sociale ? ` — ${d.prospects.raison_sociale}` : ""}</option>
                  ))}
                </select>
                {form.dossierId && (() => {
                  const d = dossiersList.find(x => x.id === form.dossierId);
                  return (
                    <div style={{marginTop:6,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:11,color:"#22C55E"}}>✓ Bouton "💾 Dossier" disponible dans l'éditeur.</span>
                      {d?.prime_estimee > 0
                        ? <span style={{fontSize:11,fontWeight:700,color:"#7C3AED",background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:5,padding:"2px 8px"}}>
                            Prime CEE : {Number(d.prime_estimee).toLocaleString("fr-FR")} € → sera chargée dans le devis
                          </span>
                        : <span style={{fontSize:11,color:"#94A3B8"}}>Aucune prime CEE enregistrée sur ce dossier.</span>
                      }
                    </div>
                  );
                })()}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {[
                  {l:"Référence devis",       k:"refDevis",            ph:"2025-0001"},
                  {l:"Date du devis",         k:"dateDevis",           ph:"22/07/2025"},
                  {l:"Date visite technique", k:"dateVisiteTechnique", ph:"15/03/2026"},
                  {l:"Validité (jours)",      k:"validiteJours",       ph:"30", type:"number"},
                ].map(f => (
                  <div key={f.k}>
                    <label style={L}>{f.l}</label>
                    <input type={f.type||"text"} value={form[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph} style={F}/>
                  </div>
                ))}
              </div>
              <div>
                <label style={L}>Conditions de paiement</label>
                <textarea value={form.condPaiement} onChange={e=>set("condPaiement",e.target.value)} rows={2} style={{...F,resize:"vertical"}}/>
              </div>
              <div>
                <label style={L}>Mention CEE (page 2) — vide = mention par défaut</label>
                <textarea value={form.mentionCEE} onChange={e=>set("mentionCEE",e.target.value)} rows={3}
                  placeholder="Les travaux objet du présent document donneront lieu..." style={{...F,resize:"vertical"}}/>
              </div>
              <div>
                <label style={L}>Conditions Générales de Vente (optionnel)</label>
                <textarea value={form.cgv} onChange={e=>set("cgv",e.target.value)} rows={4}
                  placeholder="Article 1 — Objet..." style={{...F,resize:"vertical"}}/>
              </div>
              <div>
                <label style={L}>Mentions légales supplémentaires (optionnel)</label>
                <textarea value={form.mentionLegale} onChange={e=>set("mentionLegale",e.target.value)} rows={3}
                  placeholder="Assurance décennale n°..." style={{...F,resize:"vertical"}}/>
              </div>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <label style={{...L,marginBottom:0}}>Relevé technique du site — Fiche CEE</label>
                  <button type="button"
                    onClick={() => set("mentionReleve", genereReleve({ ficheDevis: form.ficheDevis }))}
                    style={{fontSize:11,padding:"3px 10px",background:"#EFF6FF",border:"1px solid #BFDBFE",color:"#2563EB",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"}}>
                    ✨ Auto-générer
                  </button>
                  {form.mentionReleve && (
                    <button type="button" onClick={() => set("mentionReleve", "")}
                      style={{fontSize:11,padding:"3px 8px",background:"transparent",border:"1px solid #E2E8F0",color:"#94A3B8",borderRadius:6,cursor:"pointer",fontFamily:"inherit"}}>
                      Effacer
                    </button>
                  )}
                </div>
                <textarea value={form.mentionReleve} onChange={e=>set("mentionReleve",e.target.value)} rows={6}
                  placeholder="Cliquez sur « Auto-générer » ou saisissez le relevé technique manuellement…"
                  style={{...F,resize:"vertical",lineHeight:1.6,fontSize:12}}/>
              </div>
            </div>
          )}

          {/* ── Délégataire ── */}
          {activeTab === "delegataire" && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#1E3A8A",lineHeight:1.6}}>
                Le <strong>délégataire</strong> est l'organisme qui finance la prime CEE (ex&nbsp;: SOFT.IA, Effy, Hellio…). Son nom et SIREN apparaissent dans la clause légale CEE du devis.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={L}>Nom du délégataire</label>
                  <input value={form.delegataireNom} onChange={e=>set("delegataireNom",e.target.value)} placeholder="SOFT.IA" style={F}/>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={L}>SIREN du délégataire</label>
                  <input value={form.delegataireSiren} onChange={e=>set("delegataireSiren",e.target.value)} placeholder="533 333 118" style={F}/>
                </div>
              </div>
              {/* Générateur de mention CEE */}
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <label style={{...L,marginBottom:0}}>Mention CEE (clause légale)</label>
                  <button type="button"
                    onClick={() => {
                      const nom    = form.delegataireNom.trim()   || "SOFT.IA";
                      const siren  = form.delegataireSiren.trim() || "533 333 118";
                      const montant = form.mentionCEE.match(/Montant estimé.*?(\d[\d\s,]+€)/)?.[1];
                      set("mentionCEE",
                        `Les travaux objet du présent document donneront lieu à une contribution financière de ${nom} (SIREN ${siren}), sous réserve de la fourniture exclusive des documents CEE et de la validation du dossier. Montant estimé : [à compléter] €.`
                      );
                    }}
                    style={{fontSize:11,padding:"3px 10px",background:"#EFF6FF",border:"1px solid #BFDBFE",color:"#2563EB",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"}}>
                    ✨ Générer
                  </button>
                  {form.mentionCEE && (
                    <button type="button" onClick={() => set("mentionCEE","")}
                      style={{fontSize:11,padding:"3px 8px",background:"transparent",border:"1px solid #E2E8F0",color:"#94A3B8",borderRadius:6,cursor:"pointer",fontFamily:"inherit"}}>
                      Effacer
                    </button>
                  )}
                </div>
                <textarea value={form.mentionCEE} onChange={e=>set("mentionCEE",e.target.value)} rows={4}
                  placeholder={`Les travaux objet du présent document donneront lieu à une contribution financière de ${form.delegataireNom || "SOFT.IA"} (SIREN ${form.delegataireSiren || "533 333 118"}), sous réserve de la fourniture exclusive des documents CEE et de la validation du dossier. Montant estimé : [à compléter] €.`}
                  style={{...F,resize:"vertical",lineHeight:1.6,fontSize:12}}/>
                <div style={{fontSize:11,color:C.textSoft,marginTop:4}}>
                  Si vide, la mention par défaut avec SOFT.IA sera utilisée dans le devis.
                </div>
              </div>
            </div>
          )}

          {/* ── Société ── */}
          {activeTab === "societe" && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {[
                {l:"Nom société",               k:"societeNom",     ph:"AF2E"},
                {l:"N° document / RGE",         k:"numeroRGE",      ph:"000114876"},
                {l:"Adresse",                   k:"societeAdresse", ph:"2 Rue de la Darse…", full:true},
                {l:"SIRET",                     k:"societeSiret",   ph:"881 279 665 00023"},
                {l:"N° TVA intracommunautaire", k:"societeTVA",     ph:"FR 238 812 796 65"},
                {l:"RCS",                       k:"rcs",            ph:"Créteil B 881 279 665"},
                {l:"Capital social",            k:"capital",        ph:"10 000 €"},
                {l:"Assurance décennale",       k:"assuranceLabel", ph:"AXA n° 12345 valable 31/12/2026", full:true},
              ].map(f => (
                <div key={f.k} style={{gridColumn:f.full?"1/-1":"auto"}}>
                  <label style={L}>{f.l}</label>
                  <input value={form[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.ph} style={F}/>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"16px 28px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10,flexShrink:0}}>
          <button onClick={onCancel} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,borderRadius:8,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
          <button onClick={handleSave} style={{flex:2,padding:"11px",background:C.accent,border:"none",color:"#fff",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ── Aperçu devis dynamique (données du devis courant) ─────────────────────
const DevisPreviewDyn = forwardRef(function DPD({ devis, lignes, cats, batPuVente, batQte, primeFaciale, primeCEESimu, stats, params }, ref) {
  const PAGE = {background:"#fff",width:760,fontFamily:"Arial,Helvetica,sans-serif",fontSize:8,color:"#333",boxSizing:"border-box",padding:"12mm 14mm 14mm 14mm",flexShrink:0};
  const HR   = () => <div style={{borderTop:"0.5px solid #ccc",margin:"5px 0"}}/>;
  const AF2E_LOGO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH";

  const Hdr = () => (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          <div style={{fontWeight:800,fontSize:14,color:"#1E293B"}}>AF2E</div>
          <div style={{fontSize:6.5,color:"#333",lineHeight:1.6}}>AF2E AGENCE FRANÇAISE DES ECONOMIES D'ENERGIES<br/>2 Rue de la Darse — 94600 Choisy le Roi — SIRET 881 279 665 00023</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:10,fontWeight:800,color:"#111"}}>Devis {devis.refDevis||"—"} du {devis.dateDevis||"—"}</div>
          <div style={{fontSize:7,color:"#555",marginTop:2,lineHeight:1.7}}>{devis.numeroRGE ? `N° ${devis.numeroRGE}` : ""}</div>
        </div>
      </div>
      <HR/>
    </>
  );

  const Ftr = () => (
    <div style={{borderTop:"0.5px solid #ccc",marginTop:8,paddingTop:4,textAlign:"center",fontSize:6.5,color:"#888",lineHeight:1.5}}>
      AF2E — 2 RUE DE LA DARSE — 94600 CHOISY LE ROI — SIRET 881 279 665 00023 — TVA FR 238 812 796 65
    </div>
  );

  return (
    <div ref={ref} style={{display:"flex",flexDirection:"column",gap:10,width:760}}>
      {/* PAGE 1 */}
      <div style={PAGE}>
        <Hdr/>
        <div style={{display:"flex",gap:12,marginBottom:7}}>
          <div style={{flex:1}}>
            <div style={{fontSize:9,fontWeight:800,color:"#111",marginBottom:2}}>{devis.nomClient||"CLIENT"}</div>
            <div style={{fontSize:7,color:"#555",lineHeight:1.7}}>{devis.nomContact||""} {devis.fonctionContact?`— ${devis.fonctionContact}`:""}<br/>{devis.siret?`SIRET : ${devis.siret}`:""}</div>
          </div>
          <div style={{width:200,fontSize:7,color:"#555",lineHeight:1.7}}>
            <strong>Site :</strong> {devis.adresseSite||"—"}<br/>
            <strong>Sous-traitant :</strong> {devis.sousTraitant||"DC LINK"} — RGE {devis.rgeNum||"AU 084 742"}
          </div>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:7.5,marginBottom:6}}>
          <thead><tr style={{background:"#1E293B",color:"#fff"}}>
            {["Désignation","Qté","P.U. HT","TVA","Montant HT"].map((h,i)=>(
              <th key={h} style={{...DTH,textAlign:i===0?"left":"center",borderBottom:"2px solid #2563EB",fontSize:7.5}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {batQte > 0 && (
              <>
                <tr><td colSpan={5} style={{...DTC,background:"#EFF6FF",fontWeight:700,color:"#1E3A8A",fontSize:7,padding:"3px 5px",textTransform:"uppercase"}}>BAT-TH-142 — Déstratification d'air</td></tr>
                <tr style={{background:"#FAFAFA"}}>
                  <td style={{...DTC,textAlign:"left",fontSize:7,lineHeight:1.4,maxWidth:280}}>TECH DES-14000 — Débit 14 000 m³/h — Asservissement : OUI</td>
                  <td style={{...DTC,textAlign:"center"}}>{batQte}<br/><span style={{color:"#9CA3AF",fontSize:6}}>U</span></td>
                  <td style={{...DTC,textAlign:"right"}}>{fmt(batPuVente)}</td>
                  <td style={{...DTC,textAlign:"center"}}>20%</td>
                  <td style={{...DTC,textAlign:"right",fontWeight:700}}>{fmt(batQte*batPuVente)}</td>
                </tr>
              </>
            )}
            {cats.map(cat => {
              const cl = lignes.filter(l=>l.cat===cat);
              const cs = CAT_S[cat]||{bg:"#F5F5F5",text:"#333"};
              return [
                <tr key={"h"+cat}><td colSpan={5} style={{...DTC,background:cs.bg,fontWeight:700,color:cs.text,fontSize:7,padding:"3px 5px",textTransform:"uppercase"}}>{cat}</td></tr>,
                ...cl.map((l,ri)=>(
                  <tr key={l.id} style={{background:ri%2===0?"#fff":"#FAFAFA"}}>
                    <td style={{...DTC,textAlign:"left",fontSize:7,lineHeight:1.3}}>{l.designation}</td>
                    <td style={{...DTC,textAlign:"center"}}>{fmt(l.qte)}<br/><span style={{color:"#9CA3AF",fontSize:6}}>{l.unite}</span></td>
                    <td style={{...DTC,textAlign:"right"}}>{fmt(l.puVente)}</td>
                    <td style={{...DTC,textAlign:"center"}}>20%</td>
                    <td style={{...DTC,textAlign:"right",fontWeight:600}}>{fmt(l.qte*l.puVente)}</td>
                  </tr>
                ))
              ];
            })}
          </tbody>
        </table>
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <table style={{fontSize:7.5,borderCollapse:"collapse",width:240}}>
            <tbody>
              {[
                {l:"Total H.T",    v:fmtE(stats.totalHT)},
                {l:"TVA (20%)",    v:fmtE(stats.totalTVA)},
                {l:"Total T.T.C",  v:fmtE(stats.totalTTC),  bold:true,bt:true},
                {l:`Prime CEE (${params?.delegataireNom || "SOFT.IA"})`, v:"− "+fmtE(primeFaciale), color:"#16A34A",bt:true},
                {l:"Reste à charge T.T.C",       v:fmtE(stats.resteTTC), bold:true,bt:true},
              ].map((r,i) => (
                <tr key={i} style={{borderTop:r.bt?"1px solid #333":"none"}}>
                  <td style={{padding:"2px 5px",textAlign:"right",color:r.color||(r.bold?"#111":"#555"),fontWeight:r.bold?700:400}}>{r.l}</td>
                  <td style={{padding:"2px 5px",textAlign:"right",color:r.color||(r.bold?"#111":"#555"),fontWeight:r.bold?700:400,minWidth:78}}>{r.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Ftr/>
      </div>

      {/* PAGE 2 — CONDITIONS */}
      <div style={{...PAGE,minHeight:900}}>
        <Hdr/>
        <div style={{fontSize:11,fontWeight:800,color:"#111",marginBottom:7,borderBottom:"2px solid #2563EB",paddingBottom:3}}>Réserves et conditions</div>
        {[
          {t:"1. Portée du devis",c:"Établi sur la base des informations fournies. Toute modification substantielle fera l'objet d'un avenant signé avant exécution."},
          {t:"2. Conditions d'exécution",c:"Conformité NF C 15-100, NF EN 60439-4. Toute contrainte spécifique devra être signalée avant le début des travaux. Les délais sont indicatifs."},
          {t:"3. Travaux non inclus",c:"Modification de l'infrastructure électrique existante, génie civil, percement de murs. Toute prestation supplémentaire fera l'objet d'un avenant."},
          {t:"4. Stockage matériel",c:"Espace de stockage sécurisé à fournir par le client. Le client est responsable du matériel après livraison jusqu'à réception des travaux."},
          {t:"5. Site occupé",c:"Mesures de coordination et sécurité spécifiques requises. Planning d'intervention à valider. Retards liés à l'exploitation peuvent impacter les coûts."},
          {t:"6. Garanties",c:`Garantie constructeur sur les équipements. Main-d'œuvre garantie 2 ans à compter de la réception. Assurance décennale ${devis.sousTraitant||"DC LINK"} n° ${devis.rgeNum||"AU 084 742"} (valable ${devis.rgeValidite||"31/12/2026"}).`},
          {t:"7. Paiement",c:"Règlement comptant à réception de facture. Pénalités au taux légal + 5 points (art. L.441-10 Code de commerce). Indemnité forfaitaire 40 €."},
          {t:"8. Sous-traitance",c:`Le bénéficiaire accepte l'intervention de ${devis.sousTraitant||"DC LINK"}, mandatée par AF2E, titulaire du RGE n° ${devis.rgeNum||"AU 084 742"} valable jusqu'au ${devis.rgeValidite||"31/12/2026"}.`},
        ].map(({t,c}) => (
          <div key={t} style={{marginBottom:7}}>
            <div style={{fontSize:7.5,fontWeight:800,color:"#1E293B",marginBottom:2,textDecoration:"underline"}}>{t}</div>
            <div style={{fontSize:7,color:"#555",lineHeight:1.65}}>{c}</div>
          </div>
        ))}
        <div style={{borderTop:"0.5px solid #ccc",margin:"8px 0"}}/>
        <div style={{fontSize:8,fontWeight:800,color:"#111",margin:"4px 0 3px"}}>Termes et conditions CEE</div>
        <div style={{fontSize:7,color:"#555",lineHeight:1.7,marginBottom:5}}>
          {params?.mentionCEE
            ? params.mentionCEE
            : <>Les travaux objet du présent document donneront lieu à une contribution financière de <strong>{params?.delegataireNom || "SOFT.IA"}</strong> (SIREN {params?.delegataireSiren || "533 333 118"}), sous réserve de la fourniture exclusive des documents CEE et de la validation du dossier. Montant estimé : <strong>{fmtE(primeCEESimu || primeFaciale)}</strong>.</>
          }
        </div>
        <Ftr/>
      </div>

      {/* PAGE 3 — SIGNATURE */}
      <div style={{...PAGE,minHeight:760}}>
        <Hdr/>
        <div style={{fontSize:11,fontWeight:800,color:"#111",marginBottom:8,borderBottom:"2px solid #2563EB",paddingBottom:3}}>Acceptation du devis</div>
        <div style={{background:"#F8FAFC",border:"0.5px solid #E2E8F0",borderRadius:3,padding:"8px 10px",marginBottom:12,display:"flex",gap:20,flexWrap:"wrap"}}>
          {[
            {l:"Devis n°",v:devis.refDevis||"—"},
            {l:"Date",v:devis.dateDevis||"—"},
            {l:"Client",v:devis.nomClient||"—"},
            {l:"Total TTC",v:fmtE(stats.totalTTC)},
            {l:"Prime CEE",v:"− "+fmtE(primeFaciale)},
            {l:"Reste TTC",v:fmtE(stats.resteTTC),bold:true,color:"#16A34A"},
          ].map(r => (
            <div key={r.l}>
              <div style={{fontSize:6.5,color:"#94A3B8",textTransform:"uppercase",letterSpacing:.4,marginBottom:1}}>{r.l}</div>
              <div style={{fontSize:8.5,fontWeight:r.bold?800:600,color:r.color||"#111"}}>{r.v}</div>
            </div>
          ))}
        </div>
        {["Nom :","Prénom :","Fonction :"].map(f => (
          <div key={f} style={{marginBottom:13}}>
            <div style={{fontSize:8,fontWeight:700,color:"#111",marginBottom:2}}>{f}</div>
            <div style={{borderBottom:"1px solid #999",width:"55%",height:17}}/>
          </div>
        ))}
        <div style={{fontSize:7,color:"#555",marginBottom:9}}>Date, Signature et cachet précédés des mentions manuscrites suivantes :</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13,marginBottom:13}}>
          {["1) Lu et approuvé :","2) Bon pour accord :","3) Date :","4) Signature :"].map(m => (
            <div key={m}>
              <div style={{fontSize:7.5,fontWeight:700,color:"#333",marginBottom:3}}>{m}</div>
              <div style={{border:"0.5px solid #ccc",height:38,borderRadius:2,background:"#FAFAFA"}}/>
            </div>
          ))}
        </div>
        <div>
          <div style={{fontSize:7.5,fontWeight:700,color:"#333",marginBottom:3}}>5) Cachet :</div>
          <div style={{border:"0.5px solid #ccc",height:50,width:"46%",borderRadius:2,background:"#FAFAFA"}}/>
        </div>
        <div style={{marginTop:12,padding:"7px 10px",background:"#FFFBEB",border:"0.5px solid #FCD34D",borderRadius:3,fontSize:7,color:"#78350F",lineHeight:1.65}}>
          <strong>⚠ Important :</strong> Devis valable 30 jours. L'acceptation vaut commande ferme et engage le client à fournir tous les documents CEE requis avant tout début de travaux.
        </div>
        <Ftr/>
      </div>
    </div>
  );
});

// ── Composant principal MargesDevis ────────────────────────────────────────
const CACHE_KEY = "picpus_devis_cache";

const devisToRow = (d) => ({
  nom_client: d.nomClient,
  ref_devis: d.refDevis,
  date_devis: d.dateDevis,
  siret: d.siret,
  adresse_site: d.adresseSite,
  nom_contact: d.nomContact,
  fonction_contact: d.fonctionContact,
  sous_traitant: d.sousTraitant,
  rge_num: d.rgeNum,
  rge_validite: d.rgeValidite,
  lignes: d.lignes,
  bat_qte: d.batQte || 0,
  bat_pu_vente: d.batPuVente || 0,
  prime: d.prime || 0,
  updated_at: new Date().toISOString(),
  adresse_siege: d.adresseSiege || "",
  telephone_client: d.telephoneClient || "",
  email_client: d.emailClient || "",
  code_naf: d.codeNAF || "",
  pdf_params: d.pdfParams || {},
  dossier_id: d.dossierId || null,
  prime_faciale: d.primeFaciale ?? null,
});

const normalizeDevis = d => ({
  id: d.id,
  nomClient: d.nom_client,
  refDevis: d.ref_devis,
  dateDevis: d.date_devis,
  siret: d.siret,
  adresseSite: d.adresse_site,
  nomContact: d.nom_contact,
  fonctionContact: d.fonction_contact,
  sousTraitant: d.sous_traitant,
  rgeNum: d.rge_num,
  rgeValidite: d.rge_validite,
  lignes: d.lignes || [],
  batQte: d.bat_qte || 0,
  batPuVente: d.bat_pu_vente || 0,
  prime: d.prime || 0,
  primeFaciale: d.prime_faciale ?? null,
  createdAt: new Date(d.created_at).getTime(),
  updatedAt: new Date(d.updated_at).getTime(),
  adresseSiege: d.adresse_siege || "",
  telephoneClient: d.telephone_client || "",
  emailClient: d.email_client || "",
  codeNAF: d.code_naf || "",
  pdfParams: d.pdf_params || {},
  dossierId: d.dossier_id || null,
  ficheDevis: d.pdf_params?.ficheDevis || "BAT-TH-142",
});

function MargesDevis({ prefill }) {
  // Affiche immédiatement le cache localStorage pendant le chargement Supabase
  const [devisList, setDevisList] = useState(() => {
    try { const c = localStorage.getItem(CACHE_KEY); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [loading, setLoading]     = useState(true);
  const [vue, setVue]             = useState("liste");
  const [devisId, setDevisId]     = useState(null);
  const [step, setStep]           = useState(null);
  const [infosEnCours, setInfosEnCours] = useState(null);
  const [reuploadId, setReuploadId] = useState(null);
  const [dossiersList, setDossiersList] = useState([]);

  useEffect(() => {
    supabase.from("dossiers").select("id, ref, prime_estimee, montant_devis, fiche_cee, prospects(raison_sociale)").order("updated_at", { ascending: false }).limit(150)
      .then(({ data }) => { if (data) setDossiersList(data); });
  }, []);

  // Si on arrive depuis DossierDetail avec un prefill, sauter ModalNouveauDevis
  // et auto-fetch NAF + adresse siège depuis le SIRET
  useEffect(() => {
    if (!prefill || prefill.openDevisId) return; // openDevisId géré dans fetchDevis useEffect
    const enrichAndGo = async () => {
      let infos = { ...prefill };
      // Mapper ficheCee (SimulationCard) → ficheDevis (UploadPrestaDevis)
      if (infos.ficheCee && !infos.ficheDevis) infos.ficheDevis = infos.ficheCee;
      if (prefill.siret && !prefill.codeNAF) {
        try {
          const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(prefill.siret)}&per_page=1`);
          const d = await r.json();
          const e = d.results?.[0];
          if (e) {
            if (e.activite_principale) infos.codeNAF = e.activite_principale;
            if (e.siege?.adresse_complete && !infos.adresseSiege) infos.adresseSiege = e.siege.adresse_complete;
          }
        } catch (_) {}
      }
      setInfosEnCours(infos);
      setStep("upload");
    };
    enrichAndGo();
  }, []);

  // ── Chargement depuis Supabase (avec cache pour affichage instantané) ──
  const fetchDevis = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("devis_hub")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        const normalized = data.map(normalizeDevis);
        setDevisList(normalized);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(normalized)); } catch {}
      }
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    const openId = prefill?.openDevisId;
    fetchDevis().then(() => {
      if (openId) {
        setDevisId(openId);
        setVue("editeur");
      }
    });
  }, []);

  // ── Conversion camelCase → snake_case pour Supabase ───────────────────
  const toRow = devisToRow;

  // ── Créer un nouveau devis ────────────────────────────────────────────
  const creerDevis = async (infos, lignes) => {
    const { data: { user } } = await supabase.auth.getUser();
    let baseLignes = lignes ? [...lignes] : LIGNES_DEFAUT.map(l => ({...l}));
    // Ajouter la ligne destratificateur uniquement pour les fiches qui le nécessitent
    const ficheDevis = infos.ficheDevis || infos.ficheCee || "BAT-TH-142";
    if (FICHES_DESTRAT.includes(ficheDevis) && (infos.batQte || 0) > 0) {
      const puAchat = Number(infos.destratPrix) || 650;
      baseLignes = [
        {
          id: baseLignes.length + 1,
          cat: "MATÉRIEL",
          designation: infos.destratDesignation || `DESTRATIFICATEUR TECH - ${infos.batDebit || '14000'}m3/h`,
          qte: infos.batQte,
          unite: "U",
          puAchat,
          margePct: 0,
          puVente: puAchat,
          inclus: true,
        },
        ...baseLignes,
      ];
    }
    const row = {
      user_id: user.id,
      ...toRow({
        ...infos,
        lignes: baseLignes,
        batQte: 0,
        batPuVente: 0,
        prime: infos.prime || 0,
        pdfParams: { ...(infos.pdfParams || {}), ficheDevis },
      }),
    };
    const { data, error } = await supabase.from("devis_hub").insert(row).select().single();
    if (!error && data) {
      await fetchDevis();
      setDevisId(data.id);
      setVue("editeur");
    }
    setStep(null);
    setInfosEnCours(null);
  };

  // ── Re-uploader les lignes d'un devis existant ────────────────────────
  const reuploadLignes = async (id, lignes) => {
    await supabase.from("devis_hub")
      .update({ lignes, updated_at: new Date().toISOString() })
      .eq("id", id);
    await fetchDevis();
    setDevisId(id);
    setVue("editeur");
    setReuploadId(null);
    setStep(null);
  };

  // ── Sauvegarder un devis modifié ──────────────────────────────────────
  const handleSave = async (updatedDevis) => {
    const { error } = await supabase.from("devis_hub")
      .update(toRow(updatedDevis))
      .eq("id", updatedDevis.id);
    if (error) console.error("[handleSave] Supabase error:", error.message, error.details);
    const updated = devisList.map(d => d.id === updatedDevis.id ? updatedDevis : d);
    setDevisList(updated);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(updated)); } catch {}
  };

  // ── Supprimer un devis ────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDelete = async (id) => {
    if (confirmDeleteId !== id) return setConfirmDeleteId(id);
    await supabase.from("devis_hub").delete().eq("id", id);
    setDevisList(prev => prev.filter(d => d.id !== id));
    setConfirmDeleteId(null);
  };

  const devisEnCours = devisList.find(d => d.id === devisId);

  if (vue === "editeur" && devisEnCours) {
    return <EditeurDevis
      devisInit={devisEnCours}
      onBack={() => setVue("liste")}
      onSave={handleSave}
      onReupload={() => { setReuploadId(devisEnCours.id); setVue("liste"); setStep("reupload"); }}
      dossiersList={dossiersList}
    />;
  }

  if (loading && devisList.length === 0) return (
    <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid,fontSize:14}}>
      ⏳ Chargement des devis…
    </div>
  );

  return (
    <div style={{height:"100%",overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <ListeDevis
        devis={devisList}
        onCreate={() => setStep("infos")}
        onOpen={(id) => { setDevisId(id); setVue("editeur"); }}
        onDelete={handleDelete}
        confirmDeleteId={confirmDeleteId}
        onCancelDelete={() => setConfirmDeleteId(null)}
      />

      {/* Étape 1 — Infos client */}
      {step === "infos" && (
        <ModalNouveauDevis
          onConfirm={infos => { setInfosEnCours(infos); setStep("upload"); }}
          onCancel={() => setStep(null)}
        />
      )}

      {/* Étape 2 — Upload PDF prestataire (nouveau devis) */}
      {step === "upload" && infosEnCours && (
        <UploadPrestaDevis
          infosClient={infosEnCours}
          onLignesExtracted={lignes => creerDevis(infosEnCours, lignes)}
          onSkip={() => creerDevis(infosEnCours, null)}
          onBack={() => setStep("infos")}
        />
      )}

      {/* Re-upload PDF sur un devis existant */}
      {step === "reupload" && reuploadId && (
        <UploadPrestaDevis
          infosClient={devisList.find(d => d.id === reuploadId) || {}}
          onLignesExtracted={lignes => reuploadLignes(reuploadId, lignes)}
          onSkip={() => { setStep(null); setDevisId(reuploadId); setVue("editeur"); }}
          onBack={() => { setStep(null); setDevisId(reuploadId); setVue("editeur"); }}
        />
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════
// HUB
// ════════════════════════════════════════════════════════════════════════════

const MODULES = [
  {id:"verificateur",icon:"🔍",titre:"Vérificateur CEE",   sousTitre:"Analyse IA de dossier",   desc:"Uploadez l'AH et le devis, Claude détecte automatiquement toutes les incohérences et génère un rapport de conformité.",tags:["AH","Devis","IA","Rapport"],couleur:"#6366F1",actif:true},
  {id:"marges",      icon:"📊",titre:"Générateur de devis",sousTitre:"Marges + export PDF",      desc:"Calculez vos marges sur le devis prestataire et générez le devis client AF2E (3 pages) en temps réel.",tags:["Marge","Devis AF2E","3 pages","PDF"],couleur:"#2563EB",actif:true},
  {id:"visites",     icon:"🔧",titre:"Visites techniques", sousTitre:"Rapports terrain",         desc:"Gérez vos visites techniques terrain, photos, rapport PDF et suivi des dossiers IND-BA-110.",tags:["Visite","Photos","PDF","Terrain"],couleur:"#D97706",actif:true,href:"/visites"},
];

const renderModule = (page, prefill) => {
  if (page === "verificateur") return <VerificateurCEE prefill={prefill} />;
  if (page === "marges")       return <MargesDevis prefill={prefill} />;
  return null;
};

export default function AppHub() {
  const location = useLocation();
  const { module: initModule, prefill: initPrefill } = location.state || {};
  const navigate = useNavigate();
  const [page, setPage] = useState(initModule || null);
  const [prefill, setPrefill] = useState(initPrefill || null);
  const current = page && MODULES.find(m=>m.id===page);

  // Sync quand on navigue vers /hub depuis la sidebar (même composant, state différent)
  useEffect(() => {
    const { module: m, prefill: p } = location.state || {};
    if (m) { setPage(m); setPrefill(p || null); }
  }, [location.state]);

  // Vue module
  if (page && renderModule(page, prefill)) return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",fontFamily:"system-ui,'Segoe UI',Arial,sans-serif",background:C.bg}}>
      {/* Barre nav */}
      <div style={{background:C.nav,padding:"0 16px",height:48,display:"flex",alignItems:"center",gap:12,flexShrink:0,borderBottom:"3px solid "+C.accent}}>
        <button onClick={()=>setPage(null)}
          style={{background:"transparent",border:"1px solid #475569",color:"#CBD5E1",borderRadius:7,padding:"5px 13px",fontSize:13,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
          ← Accueil
        </button>
        <div style={{width:1,height:20,background:"#334155"}}/>
        <span style={{fontSize:17}}>{current.icon}</span>
        <span style={{color:C.navText,fontWeight:700,fontSize:15}}>{current.titre}</span>
        <span style={{color:"#64748B",fontSize:13}}>— {current.sousTitre}</span>
        {/* Raccourcis */}
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          {MODULES.filter(m=>m.actif).map(m=>(
            <button key={m.id} onClick={()=>m.href?navigate(m.href):setPage(m.id)}
              style={{background:page===m.id?"#334155":"transparent",color:page===m.id?"#F1F5F9":"#64748B",border:`1px solid ${page===m.id?"#475569":"#334155"}`,borderRadius:7,padding:"4px 11px",fontSize:12,fontWeight:page===m.id?600:400,cursor:"pointer"}}>
              {m.icon} {m.titre}
            </button>
          ))}
        </div>
      </div>
      {/* Contenu module — overflow géré dans chaque module */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {renderModule(page, prefill)}
      </div>
    </div>
  );

  // Vue Hub
  return (
    <div style={{fontFamily:"system-ui,'Segoe UI',Arial,sans-serif",background:C.bg,minHeight:"100vh"}}>
      {/* Header */}
      <div style={{background:C.nav,borderBottom:"3px solid "+C.accent,padding:"24px 32px 20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:1100,margin:"0 auto"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
              <span style={{fontSize:28,fontWeight:900,color:"#60A5FA",letterSpacing:2,lineHeight:1}}>PICPUS</span>
              <div style={{width:2,height:26,background:"#475569"}}/>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:"#CBD5E1",lineHeight:1.2}}>SOFT.IA</div>
              </div>
            </div>
            <div style={{fontSize:22,fontWeight:800,color:"#F8FAFC",marginBottom:4}}>Plateforme CEE — Outils internes</div>
            <div style={{fontSize:13,color:"#94A3B8"}}>Certificats d'Économies d'Énergie · Automatisation des processus</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:12}}>
            <button onClick={()=>window.location.href="/"}
              style={{background:"transparent",border:"1px solid #475569",color:"#94A3B8",borderRadius:7,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
              ← Dashboard
            </button>
            <div style={{display:"flex",gap:12}}>
            {[{n:MODULES.filter(m=>m.actif).length,l:"Disponibles",c:"#4ADE80"},{n:MODULES.filter(m=>!m.actif).length,l:"En développement",c:"#FCD34D"},{n:MODULES.length,l:"Total",c:"#94A3B8"}].map(s=>(
              <div key={s.l} style={{textAlign:"center",padding:"10px 18px",background:"#0F172A",borderRadius:10,border:"1px solid #334155"}}>
                <div style={{fontSize:22,fontWeight:800,color:s.c,lineHeight:1}}>{s.n}</div>
                <div style={{fontSize:11,color:"#64748B",marginTop:3,whiteSpace:"nowrap"}}>{s.l}</div>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grille */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 32px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16,marginBottom:32}}>
          {MODULES.map(m=>(
            <div key={m.id} onClick={()=>m.actif&&(m.href?navigate(m.href):setPage(m.id))}
              style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"20px",cursor:m.actif?"pointer":"default",opacity:m.actif?1:.65,position:"relative",transition:"all .15s",boxSizing:"border-box"}}
              onMouseEnter={e=>{if(m.actif){e.currentTarget.style.borderColor=m.couleur;e.currentTarget.style.boxShadow=`0 4px 16px rgba(0,0,0,.08)`;e.currentTarget.style.transform="translateY(-2px)";}}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>

              {/* Badge */}
              <div style={{position:"absolute",top:14,right:14}}>
                <span style={{background:m.actif?C.greenL:C.orangeL,color:m.actif?C.green:C.orange,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>{m.actif?"Disponible":"Bientôt"}</span>
              </div>

              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
                <div style={{width:44,height:44,borderRadius:10,background:`${m.couleur}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{m.icon}</div>
                <div style={{paddingRight:70}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.text,lineHeight:1.2}}>{m.titre}</div>
                  <div style={{fontSize:12,color:C.textMid,marginTop:3}}>{m.sousTitre}</div>
                </div>
              </div>
              <div style={{fontSize:13,color:C.textMid,lineHeight:1.6,marginBottom:14}}>{m.desc}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
                {m.tags.map(t=><span key={t} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.textMid,borderRadius:5,padding:"2px 9px",fontSize:11}}>{t}</span>)}
              </div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,textAlign:"right"}}>
                {m.actif
                  ? <span style={{color:m.couleur,fontSize:13,fontWeight:700}}>Ouvrir →</span>
                  : <span style={{color:C.textSoft,fontSize:12}}>🔒 En cours de développement</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Roadmap */}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:24}}>
          <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:14,textTransform:"uppercase",letterSpacing:.8}}>📋 Roadmap — Prochains modules</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:10}}>
            {[{n:"5",t:"Assistant visio",d:"Transcription → scoring prospect"},{n:"6",t:"Enrichissement Leads",d:"Données entreprises + scoring"}].map(r=>(
              <div key={r.n} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{width:24,height:24,borderRadius:6,background:C.bg,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:C.textMid,flexShrink:0}}>{r.n}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>{r.t}</div>
                  <div style={{fontSize:12,color:C.textMid}}>{r.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{marginTop:28,paddingTop:16,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:C.textSoft}}>SOFT.IA — Plateforme CEE interne — {new Date().toLocaleDateString("fr-FR")}</span>
          <span style={{fontSize:11,color:C.border}}>Développé avec Claude · Anthropic</span>
        </div>
      </div>
    </div>
  );
}
