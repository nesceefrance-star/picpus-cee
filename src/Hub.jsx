import { useState, useRef, useMemo, forwardRef, useCallback } from "react";

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
  "BAT-TH-142":"BAT-TH-142 — Déstratification d'air (tertiaire)",
  "BAT-TH-116":"BAT-TH-116 — Système GTB (tertiaire)",
  "IND-BA-110":"IND-BA-110 — Déstratification d'air (industrie)",
};

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

function VerificateurCEE() {
  const [fiche,setFiche]   = useState("BAT-TH-142");
  const [ref_,setRef_]     = useState("");
  const [fileAH,setFileAH] = useState(null);
  const [fileDev,setFileDev] = useState(null);
  const [step,setStep]     = useState("upload");
  const [loadMsg,setLoadMsg] = useState("");
  const [result,setResult] = useState(null);
  const [valid,setValid]   = useState({});
  const [notes,setNotes]   = useState({});
  const [openNote,setOpenNote] = useState(null);

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
      const prompt = `Tu es expert CEE français. Analyse ces 2 documents et génère un rapport JSON valide (sans backticks).
Structure: {"avis_global":"CONFORME|ATTENTION|BLOQUANT","resume":"synthèse 2-3 phrases","donnees_ah":{"beneficiaire":"","siren":"","adresse_site":"","signataire":"","fonction":"","date_engagement":"","date_realisation":"","ref_facture":"","nb_equipements":"","marque":"","reference_eq":"","professionnel":"","siret_pro":""},"donnees_devis":{"beneficiaire":"","adresse_site":"","date_document":"","ref_document":"","nb_equipements":"","marque":"","reference_eq":"","montant_ht":"","emetteur":""},"incoherences":[{"id":"inc_1","niveau":"CRITIQUE|ATTENTION|INFO","categorie":"Bénéficiaire|Adresse|Dates|Équipements|Références|Professionnel|Autre","titre":"","description":"","valeur_ah":"","valeur_devis":""}],"points_conformes":[{"id":"ok_1","categorie":"","titre":"","description":""}],"alertes_ah":[{"id":"al_1","niveau":"CRITIQUE|ATTENTION","titre":"","description":""}]}`;
      const resp = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:3000,messages:[{role:"user",content:[bc(b64AH,mtype(fileAH)),{type:"text",text:"[Document 1 — AH CEE, fiche "+fiche+"]"},bc(b64Dev,mtype(fileDev)),{type:"text",text:"[Document 2 — Devis/Facture]"},{type:"text",text:prompt}]}]})});
      const data = await resp.json();
      const parsed = JSON.parse(data.content.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim());
      setResult(parsed);
      const v={};
      [...(parsed.incoherences||[]),...(parsed.points_conformes||[]),...(parsed.alertes_ah||[])].forEach(i=>{v[i.id]="pending";});
      setValid(v); setStep("rapport");
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
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"18px",marginBottom:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:5}}>Référence dossier</label>
                <input value={ref_} onChange={e=>setRef_(e.target.value)} placeholder="PICPUS ENERGIE000114876" style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
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
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <button onClick={()=>{setStep("upload");setResult(null);setValid({});setFileAH(null);setFileDev(null);}}
                  style={{background:C.surface,border:`1px solid ${C.border}`,color:C.textMid,padding:"6px 14px",borderRadius:7,cursor:"pointer",fontSize:13}}>
                  ↺ Nouveau dossier
                </button>
                <span style={{fontSize:13,color:C.textMid,background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 12px"}}>{pct}% traité</span>
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
// MODULE 2 — CHECKLIST CEE
// ════════════════════════════════════════════════════════════════════════════
const FICHES_C = {"BAT-TH-142":{label:"BAT-TH-142",sections:[
  {id:"b",title:"Bénéficiaire",icon:"🏢",items:[{id:"b1",label:"Raison sociale renseignée"},{id:"b2",label:"Numéro SIREN (9 chiffres)"},{id:"b3",label:"Nom et prénom du signataire"},{id:"b4",label:"Fonction du signataire"},{id:"b5",label:"Adresse complète (rue, CP, ville)"},{id:"b6",label:"Email renseigné"},{id:"b7",label:"Case propriétaire/locataire cochée"},{id:"b8",label:"Signature et cachet présents"}]},
  {id:"site",title:"Site & Vérification",icon:"📍",items:[{id:"s1",label:"Adresse du site renseignée"},{id:"s2",label:"Adresse vérifiée sur Google Maps"},{id:"s3",label:"SIREN vérifié sur Pappers"},{id:"s4",label:"Raison sociale correspond au SIREN"},{id:"s5",label:"Type de local coché"}]},
  {id:"d",title:"Dates & Références",icon:"📅",items:[{id:"d1",label:"Date d'engagement renseignée (date devis)"},{id:"d2",label:"Date de réalisation renseignée (date facture)"},{id:"d3",label:"Réalisation postérieure à l'engagement"},{id:"d4",label:"Référence facture renseignée"},{id:"d5",label:"Référence dossier PICPUS présente"}]},
  {id:"t",title:"Technique",icon:"⚙️",items:[{id:"t1",label:"Hauteur sous plafond (h) ≥ 5 m renseignée"},{id:"t2",label:"Type d'écoulement coché (vertical/horizontal)"},{id:"t3",label:"Vitesse au sol conforme (0,1 à 0,3 m/s)"},{id:"t4",label:"Asservissement à mesure de température coché OUI"},{id:"t5",label:"Bruit < 45 dB au sol coché OUI"},{id:"t6",label:"Puissance chauffage convectif renseignée"},{id:"t7",label:"Nombre de déstratificateurs renseigné"},{id:"t8",label:"Marque et référence équipements renseignées"}]},
  {id:"p",title:"Professionnel installateur",icon:"👷",items:[{id:"p1",label:"Raison sociale de l'installateur renseignée"},{id:"p2",label:"SIRET installateur renseigné"},{id:"p3",label:"Certification RGE valide à la date des travaux"},{id:"p4",label:"N° certification RGE renseigné"},{id:"p5",label:"Signature et cachet installateur présents"}]},
]}};

function ChecklistCEE() {
  const [fiche,setFiche] = useState("BAT-TH-142");
  const [ref_,setRef_]   = useState("");
  const [checks,setChecks] = useState({});
  const def = FICHES_C[fiche];
  const allItems = def.sections.flatMap(s=>s.items);
  const ok  = allItems.filter(i=>checks[i.id]==="ok").length;
  const nok = allItems.filter(i=>checks[i.id]==="nok").length;
  const na  = allItems.filter(i=>checks[i.id]==="na").length;
  const done = ok+nok+na;
  const pct  = allItems.length>0 ? Math.round(done/allItems.length*100) : 0;
  const toggle = (id,st) => setChecks(p=>({...p,[id]:p[id]===st?undefined:st}));

  return (
    <div style={{height:"100%",overflowY:"auto",background:C.bg,padding:"24px 28px"}}>
      <div style={{maxWidth:820,margin:"0 auto"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
          <div>
            <h2 style={{...T.h2,margin:0,marginBottom:4}}>Checklist de conformité</h2>
            <p style={{...T.sm,margin:0}}>Vérification manuelle point par point</p>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <input value={ref_} onChange={e=>setRef_(e.target.value)} placeholder="Réf. dossier…"
              style={{border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 12px",color:C.text,fontSize:13,outline:"none",width:180}}/>
            <select value={fiche} onChange={e=>{setFiche(e.target.value);setChecks({});}}
              style={{border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 12px",color:C.text,fontSize:13,outline:"none",background:C.surface}}>
              {Object.keys(FICHES_C).map(k=><option key={k} value={k}>{k}</option>)}
            </select>
            <button onClick={()=>setChecks({})} style={{border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 12px",color:C.textMid,fontSize:13,background:C.surface,cursor:"pointer"}}>Réinitialiser</button>
          </div>
        </div>

        {/* Barre de progression */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:20}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:C.textMid,marginBottom:6}}>
              <span>Progression</span>
              <span style={{fontWeight:700,color:C.text}}>{pct}% — {done}/{allItems.length} points</span>
            </div>
            <div style={{background:C.bg,borderRadius:999,height:8}}>
              <div style={{height:"100%",borderRadius:999,width:`${pct}%`,background:nok>0?"#DC2626":pct===100?"#16A34A":C.accent,transition:"width .3s"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:16}}>
            {[{l:"Conforme",v:ok,c:"#16A34A"},{l:"Non conf.",v:nok,c:"#DC2626"},{l:"N/A",v:na,c:"#94A3B8"}].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:11,color:C.textSoft,marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sections */}
        {def.sections.map(sec=>{
          const secOk  = sec.items.filter(i=>checks[i.id]==="ok").length;
          const secNok = sec.items.filter(i=>checks[i.id]==="nok").length;
          return (
            <div key={sec.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:12,overflow:"hidden"}}>
              <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:18}}>{sec.icon}</span>
                <span style={{fontSize:15,fontWeight:700,color:C.text}}>{sec.title}</span>
                <div style={{marginLeft:"auto",display:"flex",gap:8}}>
                  {secNok>0 && <span style={{fontSize:12,color:"#DC2626",fontWeight:600}}>{secNok} NOK</span>}
                  <span style={{fontSize:12,color:"#16A34A",fontWeight:600}}>{secOk}/{sec.items.length} OK</span>
                </div>
              </div>
              {sec.items.map((item,idx)=>{
                const st = checks[item.id];
                return (
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",background:idx%2===0?C.surface:C.bg,borderBottom:idx<sec.items.length-1?`1px solid ${C.border}`:"none"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:st==="ok"?"#16A34A":st==="nok"?"#DC2626":st==="na"?"#94A3B8":"#E2E8F0",border:`2px solid ${st==="ok"?"#16A34A":st==="nok"?"#DC2626":st==="na"?"#94A3B8":"#CBD5E1"}`}}/>
                    <span style={{flex:1,fontSize:13,color:st==="nok"?"#DC2626":st==="ok"?"#16A34A":C.text,lineHeight:1.4}}>{item.label}</span>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      {[{s:"ok",l:"✓ Conforme"},{s:"nok",l:"✗ Non conf."},{s:"na",l:"N/A"}].map(btn=>(
                        <button key={btn.s} onClick={()=>toggle(item.id,btn.s)}
                          style={{padding:"5px 10px",borderRadius:6,fontSize:12,fontWeight:st===btn.s?700:400,cursor:"pointer",
                            border:`1.5px solid ${st===btn.s?(btn.s==="ok"?"#16A34A":btn.s==="nok"?"#DC2626":"#94A3B8"):C.border}`,
                            background:st===btn.s?(btn.s==="ok"?"#F0FDF4":btn.s==="nok"?"#FEF2F2":"#F8FAFC"):C.surface,
                            color:st===btn.s?(btn.s==="ok"?"#16A34A":btn.s==="nok"?"#DC2626":"#64748B"):C.textSoft}}>
                          {btn.l}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Résultat final */}
        {done===allItems.length && allItems.length>0 && (
          <div style={{marginTop:8,background:nok===0?"#F0FDF4":"#FEF2F2",border:`1.5px solid ${nok===0?"#86EFAC":"#FCA5A5"}`,borderRadius:10,padding:"20px 24px",textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:6}}>{nok===0?"✅":"⚠️"}</div>
            <div style={{fontSize:16,fontWeight:700,color:nok===0?"#16A34A":"#DC2626",marginBottom:4}}>{nok===0?"Dossier conforme !":`${nok} point(s) non conforme(s)`}</div>
            <div style={{fontSize:13,color:C.textMid}}>{ref_&&`${ref_} — `}{ok} conformes · {nok} non conformes · {na} N/A</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MODULE 3 — MARGES + DEVIS
// ════════════════════════════════════════════════════════════════════════════
const LIGNES_INIT = [
  {id:1,cat:"MATÉRIEL",    designation:"RAIL DE MONTAGE profil creux carré soudé 50x3mm S235JRH EN 10219-1",        qte:81, unite:"U",    puAchat:62.00,  margePct:30},
  {id:2,cat:"MATÉRIEL",    designation:"ALIMENTATION ARMOIRE SECONDAIRE — câble 3G10MM2 — disjoncteur 80A",          qte:8,  unite:"U",    puAchat:352.00, margePct:30},
  {id:3,cat:"MATÉRIEL",    designation:"ARMOIRE DIVISIONNAIRE DESTRATIFICATEURS",                                    qte:8,  unite:"U",    puAchat:1587.00,margePct:30},
  {id:4,cat:"MATÉRIEL",    designation:"KIT DE FIXATION câbles 3m (x4) Serre câble à vis Écrou et suspente",        qte:30, unite:"U",    puAchat:42.58,  margePct:30},
  {id:5,cat:"MATÉRIEL",    designation:"CABLAGE DESTRATIFICATEUR — câble RO2V 3G2.5MM2 100m — Tube IRL — Fixation", qte:30, unite:"U",    puAchat:106.58, margePct:30},
  {id:6,cat:"MAIN D'ŒUVRE",designation:"CRÉATION DES CHÂSSIS",                                                      qte:30, unite:"U",    puAchat:87.00,  margePct:25},
  {id:7,cat:"MAIN D'ŒUVRE",designation:"INSTALLATION ARMOIRE ET CABLAGE — pose armoire divisionnaire",              qte:8,  unite:"U",    puAchat:680.00, margePct:25},
  {id:8,cat:"MAIN D'ŒUVRE",designation:"INSTALLATION DES DESTRATIFICATEURS — pose supports, raccordement",          qte:30, unite:"U",    puAchat:580.00, margePct:25},
  {id:9,cat:"DIVERS",      designation:"LIVRAISON NACELLE — forfait livraison/enlèvement poids lourd",              qte:1,  unite:"U",    puAchat:330.00, margePct:20},
  {id:10,cat:"DIVERS",     designation:"LOCATION NACELLE ARTICULEE 15M roue blanche",                               qte:30, unite:"Jours",puAchat:165.00, margePct:20},
  {id:11,cat:"DIVERS",     designation:"DÉPLACEMENT — essence, péages, hébergement, repas",                         qte:1,  unite:"U",    puAchat:8674.00,margePct:0},
].map(l=>({...l,puVente:+(l.puAchat*(1+l.margePct/100)).toFixed(2),inclus:true}));

const CAT_S = {
  "MATÉRIEL":    {bg:"#EFF6FF",text:"#1D4ED8",border:"#BFDBFE"},
  "MAIN D'ŒUVRE":{bg:"#F0FDF4",text:"#15803D",border:"#BBF7D0"},
  "DIVERS":      {bg:"#FFFBEB",text:"#B45309",border:"#FDE68A"},
};
const MC2 = p => p>=20?"#16A34A":p>0?"#D97706":"#DC2626";

const DTH = {padding:"8px 8px",fontSize:12,fontWeight:700,textAlign:"center"};
const DTC = {padding:"5px 6px",borderBottom:"1px solid #F1F5F9",verticalAlign:"middle"};

const DevisPreview = forwardRef(function DP({lignes,cats,batPuVente,prime,stats},ref){
  const PAGE={background:"#fff",width:760,fontFamily:"Arial,Helvetica,sans-serif",fontSize:8,color:"#333",boxSizing:"border-box",padding:"12mm 14mm 14mm 14mm",flexShrink:0};
  const HR=()=><div style={{borderTop:"0.5px solid #ccc",margin:"5px 0"}}/>;
  const AF2E_LOGO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAYbBhsDASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAYHBAUIAwIB/8QATBABAAEDAgIDCA8GBQQCAwEBAAECAwQFEQYHEiExExZBUVKTsdEUIjI0NVNUYXFyc4GRkqEVI0JVssEzNmLC4UNjgtII8CSi8Rcm/8QAGwEBAAIDAQEAAAAAAAAAAAAAAAUGAwQHAgH/xAA5EQEAAQMCAQYNBAIDAQEAAAAAAQIDBAURIQYSMVFxkRMUFRYiMkFTYYGhseEzNMHRQlIjNfAkcv/aAAwDAQACEQMRAD8A4yAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z";
  const Hdr=()=>(
    <><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
      <div style={{display:"flex",flexDirection:"column",gap:2}}>
        <img src={AF2E_LOGO} alt="AF2E" style={{height:52,width:"auto",objectFit:"contain",objectPosition:"left",background:"transparent"}}/>
        <div style={{fontSize:6.5,color:"#333",lineHeight:1.6}}>AF2E AGENCE FRANÇAISE DES ECONOMIES D'ENERGIES<br/>2 Rue de la Darse — 94600 Choisy le Roi — SIRET 881 279 665 00023</div>
      </div>
      <div style={{textAlign:"right"}}><div style={{fontSize:10,fontWeight:800,color:"#111"}}>Devis 2025-07-1315</div>
        <div style={{fontSize:7,color:"#555",marginTop:2,lineHeight:1.7}}>Date : 22/07/2025 — N° PICPUS ENERGIE000114876</div></div>
    </div><HR/></>
  );
  const Ftr=()=>(<div style={{borderTop:"0.5px solid #ccc",marginTop:8,paddingTop:4,textAlign:"center",fontSize:6.5,color:"#888",lineHeight:1.5}}>AF2E — 2 RUE DE LA DARSE — 94600 CHOISY LE ROI — SIRET 881 279 665 00023 — TVA FR 238 812 796 65</div>);

  return (
    <div ref={ref} style={{display:"flex",flexDirection:"column",gap:10,width:760}}>
      {/* PAGE 1 */}
      <div style={PAGE}>
        <Hdr/>
        <div style={{display:"flex",gap:12,marginBottom:7}}>
          <div style={{flex:1}}><div style={{fontSize:9,fontWeight:800,color:"#111",marginBottom:2}}>KIABI LOGISTIQUE</div><div style={{fontSize:7,color:"#555",lineHeight:1.7}}>M. Fabien Van De Ginste — Responsable Technique & Sûreté<br/>59553 LAUWIN PLANQUE — SIRET : 34772795000094</div></div>
          <div style={{width:180,fontSize:7,color:"#555",lineHeight:1.7}}><strong>Site :</strong> 771 Rue de la Plaine, 59553 LAUWIN PLANQUE<br/><strong>Zone :</strong> H1 — Cat. : Tertiaire<br/><strong>Sous-traitant :</strong> DC LINK — RGE AU 084 742</div>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:7.5,marginBottom:6}}>
          <thead><tr style={{background:"#1E293B",color:"#fff"}}>
            <th style={{...DTH,textAlign:"left",borderBottom:"2px solid #2563EB",fontSize:7.5}}>Désignation</th>
            <th style={{...DTH,borderBottom:"2px solid #2563EB",fontSize:7.5}}>Qté</th>
            <th style={{...DTH,borderBottom:"2px solid #2563EB",fontSize:7.5}}>P.U. HT</th>
            <th style={{...DTH,borderBottom:"2px solid #2563EB",fontSize:7.5}}>TVA</th>
            <th style={{...DTH,borderBottom:"2px solid #2563EB",fontSize:7.5}}>Montant HT</th>
          </tr></thead>
          <tbody>
            <tr><td colSpan={5} style={{...DTC,background:"#EFF6FF",fontWeight:700,color:"#1E3A8A",fontSize:7,padding:"3px 5px",textTransform:"uppercase"}}>BAT-TH-142 — Déstratification d'air</td></tr>
            <tr style={{background:"#FAFAFA"}}>
              <td style={{...DTC,textAlign:"left",fontSize:7,lineHeight:1.4,maxWidth:280}}>TECH DES-14000 — Débit 14 000 m³/h — HSP 12m — 6 078 kW — Zone H1 — Asservissement : OUI</td>
              <td style={{...DTC,textAlign:"center"}}>{BAT_QTE}<br/><span style={{color:"#9CA3AF",fontSize:6}}>U</span></td>
              <td style={{...DTC,textAlign:"right"}}>{fmt(batPuVente)}</td>
              <td style={{...DTC,textAlign:"center"}}>20%</td>
              <td style={{...DTC,textAlign:"right",fontWeight:700}}>{fmt(BAT_QTE*batPuVente)}</td>
            </tr>
            {cats.map(cat=>{
              const cl=lignes.filter(l=>l.cat===cat);
              const cs=CAT_S[cat]||{bg:"#F5F5F5",text:"#333"};
              return[
                <tr key={"h"+cat}><td colSpan={5} style={{...DTC,background:cs.bg,fontWeight:700,color:cs.text,fontSize:7,padding:"3px 5px",textTransform:"uppercase"}}>{cat}</td></tr>,
                ...cl.map((l,ri)=><tr key={l.id} style={{background:ri%2===0?"#fff":"#FAFAFA"}}><td style={{...DTC,textAlign:"left",fontSize:7,lineHeight:1.3}}>{l.designation}</td><td style={{...DTC,textAlign:"center"}}>{fmt(l.qte)}<br/><span style={{color:"#9CA3AF",fontSize:6}}>{l.unite}</span></td><td style={{...DTC,textAlign:"right"}}>{fmt(l.puVente)}</td><td style={{...DTC,textAlign:"center"}}>20%</td><td style={{...DTC,textAlign:"right",fontWeight:600}}>{fmt(l.qte*l.puVente)}</td></tr>)
              ];
            })}
          </tbody>
        </table>
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <table style={{fontSize:7.5,borderCollapse:"collapse",width:240}}>
            <tbody>{[{l:"Total H.T",v:fmtE(stats.totalHT)},{l:"TVA (20%)",v:fmtE(stats.totalTVA)},{l:"Total T.T.C",v:fmtE(stats.totalTTC),bold:true,bt:true},{l:"Prime CEE (PICPUS ÉNERGIE)",v:"− "+fmtE(prime),color:"#16A34A",bt:true},{l:"Reste à charge T.T.C",v:fmtE(stats.resteTTC),bold:true,bt:true}].map((r,i)=>(
              <tr key={i} style={{borderTop:r.bt?"1px solid #333":"none"}}>
                <td style={{padding:"2px 5px",textAlign:"right",color:r.color||(r.bold?"#111":"#555"),fontWeight:r.bold?700:400}}>{r.l}</td>
                <td style={{padding:"2px 5px",textAlign:"right",color:r.color||(r.bold?"#111":"#555"),fontWeight:r.bold?700:400,minWidth:78}}>{r.v}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <Ftr/>
      </div>
      {/* PAGE 2 — CONDITIONS */}
      <div style={{...PAGE,minHeight:900}}>
        <Hdr/>
        <div style={{fontSize:11,fontWeight:800,color:"#111",marginBottom:7,borderBottom:"2px solid #2563EB",paddingBottom:3}}>Réserves et conditions</div>
        {[{t:"1. Portée du devis",c:"Établi sur la base des informations fournies. Toute modification substantielle fera l'objet d'un avenant signé avant exécution."},
          {t:"2. Conditions d'exécution",c:"Conformité NF C 15-100, NF EN 60439-4. Toute contrainte spécifique devra être signalée avant le début des travaux. Les délais sont indicatifs."},
          {t:"3. Travaux non inclus",c:"Modification de l'infrastructure électrique existante, génie civil, percement de murs. Toute prestation supplémentaire fera l'objet d'un avenant."},
          {t:"4. Stockage matériel",c:"Espace de stockage sécurisé à fournir par le client. Le client est responsable du matériel après livraison jusqu'à réception des travaux."},
          {t:"5. Site occupé",c:"Mesures de coordination et sécurité spécifiques requises. Planning d'intervention à valider. Retards liés à l'exploitation peuvent impacter les coûts."},
          {t:"6. Garanties",c:"Garantie constructeur sur les équipements. Main-d'œuvre garantie 2 ans à compter de la réception. Assurance décennale DC LINK n° AU 084 742 (valable 31/12/2026)."},
          {t:"7. Paiement",c:"Règlement comptant à réception de facture. Pénalités au taux légal + 5 points (art. L.441-10 Code de commerce). Indemnité forfaitaire 40 €."},
          {t:"8. Sous-traitance",c:"Le bénéficiaire accepte l'intervention de DC LINK (SIRET 98213416500017), mandatée par AF2E, titulaire du RGE n° AU 084 742 valable jusqu'au 31/12/2026."},
        ].map(({t,c})=><div key={t} style={{marginBottom:7}}><div style={{fontSize:7.5,fontWeight:800,color:"#1E293B",marginBottom:2,textDecoration:"underline"}}>{t}</div><div style={{fontSize:7,color:"#555",lineHeight:1.65}}>{c}</div></div>)}
        <div style={{borderTop:"0.5px solid #ccc",margin:"8px 0"}}/>
        <div style={{fontSize:8,fontWeight:800,color:"#111",margin:"4px 0 3px"}}>Termes et conditions CEE</div>
        <div style={{fontSize:7,color:"#555",lineHeight:1.7,marginBottom:5}}>Les travaux objet du présent document donneront lieu à une contribution financière de <strong>PICPUS ÉNERGIE</strong> (SIREN 533 333 118), sous réserve de la fourniture exclusive des documents CEE et de la validation du dossier. Montant estimé : <strong>{fmtE(prime)}</strong>.</div>
        <div style={{fontSize:8,fontWeight:800,color:"#111",margin:"4px 0 3px"}}>Attestation sur l'honneur</div>
        {["reçu du professionnel partenaire PICPUS ÉNERGIE les conseils adaptés à mes besoins","délégué l'exclusivité des CEE à PICPUS ÉNERGIE","que le bâtiment est existant depuis plus de 2 ans à la date d'engagement"].map((a,i)=><div key={i} style={{fontSize:7,color:"#555",lineHeight:1.6,paddingLeft:10}}>• {a}</div>)}
        <Ftr/>
      </div>
      {/* PAGE 3 — SIGNATURE */}
      <div style={{...PAGE,minHeight:760}}>
        <Hdr/>
        <div style={{fontSize:11,fontWeight:800,color:"#111",marginBottom:8,borderBottom:"2px solid #2563EB",paddingBottom:3}}>Acceptation du devis</div>
        <div style={{background:"#F8FAFC",border:"0.5px solid #E2E8F0",borderRadius:3,padding:"8px 10px",marginBottom:12,display:"flex",gap:20,flexWrap:"wrap"}}>
          {[{l:"Devis n°",v:"2025-07-1315"},{l:"Date",v:"22/07/2025"},{l:"Client",v:"KIABI LOGISTIQUE"},{l:"Total TTC",v:fmtE(stats.totalTTC)},{l:"Prime CEE",v:"− "+fmtE(prime)},{l:"Reste TTC",v:fmtE(stats.resteTTC),bold:true,color:"#16A34A"}].map(r=><div key={r.l}><div style={{fontSize:6.5,color:"#94A3B8",textTransform:"uppercase",letterSpacing:.4,marginBottom:1}}>{r.l}</div><div style={{fontSize:8.5,fontWeight:r.bold?800:600,color:r.color||"#111"}}>{r.v}</div></div>)}
        </div>
        {["Nom :","Prénom :","Fonction :"].map(f=><div key={f} style={{marginBottom:13}}><div style={{fontSize:8,fontWeight:700,color:"#111",marginBottom:2}}>{f}</div><div style={{borderBottom:"1px solid #999",width:"55%",height:17}}/></div>)}
        <div style={{fontSize:7,color:"#555",marginBottom:9}}>Date, Signature et cachet précédés des mentions manuscrites suivantes :</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13,marginBottom:13}}>
          {["1) Lu et approuvé :","2) Bon pour accord :","3) Date :","4) Signature :"].map(m=><div key={m}><div style={{fontSize:7.5,fontWeight:700,color:"#333",marginBottom:3}}>{m}</div><div style={{border:"0.5px solid #ccc",height:38,borderRadius:2,background:"#FAFAFA"}}/></div>)}
        </div>
        <div><div style={{fontSize:7.5,fontWeight:700,color:"#333",marginBottom:3}}>5) Cachet :</div><div style={{border:"0.5px solid #ccc",height:50,width:"46%",borderRadius:2,background:"#FAFAFA"}}/></div>
        <div style={{marginTop:12,padding:"7px 10px",background:"#FFFBEB",border:"0.5px solid #FCD34D",borderRadius:3,fontSize:7,color:"#78350F",lineHeight:1.65}}><strong>⚠ Important :</strong> Devis valable 30 jours. L'acceptation vaut commande ferme et engage le client à fournir tous les documents CEE requis avant tout début de travaux.</div>
        <Ftr/>
      </div>
    </div>
  );
});

function MargesDevis() {
  const [lignes,setLignes]         = useState(LIGNES_INIT);
  const [batPuVente,setBatPuVente] = useState(3600);
  const [prime,setPrime]           = useState(108000);
  const [tab,setTab]               = useState("marges");
  const printRef = useRef();

  const actives = lignes.filter(l=>l.inclus);
  const cats    = [...new Set(actives.map(l=>l.cat))];
  const stats   = useMemo(()=>{
    const achat   = actives.reduce((s,l)=>s+l.qte*l.puAchat,0);
    const sousTot = actives.reduce((s,l)=>s+l.qte*l.puVente,0);
    const totalHT = sousTot + BAT_QTE*batPuVente;
    const totalTVA= totalHT*.20; const totalTTC=totalHT+totalTVA;
    return{achat,sousTot,marge:sousTot-achat,margePct:achat>0?(sousTot-achat)/achat*100:0,margeNette:sousTot>0?(sousTot-achat)/sousTot*100:0,totalHT,totalTVA,totalTTC,resteHT:totalHT-prime,resteTTC:totalTTC-prime};
  },[actives,batPuVente,prime]);

  const upd=(id,field,value)=>setLignes(ls=>ls.map(l=>{
    if(l.id!==id)return l;
    const u={...l,[field]:["qte","puAchat","puVente","margePct"].includes(field)?Number(value)||0:value};
    if(field==="puVente"&&u.puAchat>0)u.margePct=+((u.puVente/u.puAchat-1)*100).toFixed(1);
    if(field==="margePct")u.puVente=+(u.puAchat*(1+Number(value)/100)).toFixed(2);
    if(field==="puAchat")u.puVente=+(Number(value)*(1+u.margePct/100)).toFixed(2);
    return u;
  }));
  const applyGlobal=pct=>setLignes(ls=>ls.map(l=>({...l,margePct:pct,puVente:+(l.puAchat*(1+pct/100)).toFixed(2)})));
  const exportPDF=()=>{const s=document.createElement("style");s.innerHTML=`@media print{body>*{display:none!important}#dp{display:block!important;position:fixed;top:0;left:0;width:100%}@page{size:A4;margin:0}}`;document.head.appendChild(s);printRef.current.id="dp";window.print();document.head.removeChild(s);printRef.current.id="";};

  const TH={padding:"9px 8px",fontSize:12,fontWeight:700,textAlign:"right",color:C.navText,whiteSpace:"nowrap"};
  const TD={padding:"6px 8px",borderBottom:`1px solid ${C.border}`,verticalAlign:"middle"};
  const INP={border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 6px",fontSize:12,background:C.surface,outline:"none",fontFamily:"inherit",color:C.text};

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg,fontFamily:"inherit"}}>
      {/* Toolbar */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"8px 16px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        {[["marges","📊 Marges"],["devis","📄 Aperçu devis"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)}
            style={{background:tab===v?C.accent:"transparent",color:tab===v?"#fff":C.textMid,border:`1px solid ${tab===v?C.accent:C.border}`,borderRadius:7,padding:"6px 14px",fontSize:13,fontWeight:tab===v?700:400,cursor:"pointer"}}>
            {l}
          </button>
        ))}
        <button onClick={exportPDF} style={{background:"#16A34A",color:"#fff",border:"none",borderRadius:7,padding:"6px 16px",fontSize:13,fontWeight:700,cursor:"pointer",marginLeft:"auto"}}>⬇ Imprimer / PDF</button>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* MARGES */}
        <div style={{width:tab==="marges"?"55%":"0%",minWidth:0,overflow:"auto",borderRight:`1px solid ${C.border}`,background:C.surface,display:"flex",flexDirection:"column",transition:"width .2s"}}>
          {/* KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            {[{label:"Coût achat",val:fmtE(stats.achat),color:C.textMid},{label:"Vente HT",val:fmtE(stats.totalHT),color:C.accent},{label:"Marge brute",val:fmtE(stats.marge),color:MC2(stats.margePct)},{label:"Taux de marque",val:stats.margeNette.toFixed(1)+"%",color:MC2(stats.margeNette)}].map(k=>(
              <div key={k.label} style={{padding:"10px 12px",borderRight:`1px solid ${C.border}`}}>
                <div style={{fontSize:10,color:C.textSoft,textTransform:"uppercase",letterSpacing:.4,fontWeight:600,marginBottom:3}}>{k.label}</div>
                <div style={{fontSize:15,fontWeight:800,color:k.color}}>{k.val}</div>
              </div>
            ))}
          </div>
          {/* Presets */}
          <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",flexShrink:0}}>
            <span style={{fontSize:12,color:C.textMid,fontWeight:600,marginRight:4}}>Marge globale :</span>
            {[0,10,15,20,25,30,40,50].map(p=>(
              <button key={p} onClick={()=>applyGlobal(p)}
                style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 10px",fontSize:12,fontWeight:600,cursor:"pointer",color:C.text}}>
                {p}%
              </button>
            ))}
          </div>
          {/* Tableau */}
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
              </tr></thead>
              <tbody>
                {cats.map(cat=>{
                  const cl=actives.filter(l=>l.cat===cat);
                  const cs=CAT_S[cat]||{bg:C.bg,text:C.text};
                  const ct=cl.reduce((s,l)=>s+l.qte*l.puVente,0);
                  return[
                    <tr key={"c"+cat}>
                      <td colSpan={6} style={{background:cs.bg,padding:"6px 10px",fontWeight:700,fontSize:11,color:cs.text,textTransform:"uppercase",border:`1px solid ${cs.border||C.border}`}}>{cat}</td>
                      <td style={{background:cs.bg,padding:"6px 10px",textAlign:"right",fontWeight:700,fontSize:11,color:cs.text,border:`1px solid ${cs.border||C.border}`}}>{fmt(ct)} €</td>
                    </tr>,
                    ...cl.map((l,ri)=>{
                      const mc=MC2(l.margePct);
                      return(
                        <tr key={l.id} style={{background:ri%2===0?C.surface:C.bg}}>
                          <td style={{...TD,textAlign:"center"}}><input type="checkbox" checked={l.inclus} onChange={e=>upd(l.id,"inclus",e.target.checked)} style={{cursor:"pointer",width:14,height:14}}/></td>
                          <td style={{...TD,maxWidth:200}}><div style={{fontSize:12,lineHeight:1.35,color:C.text}}>{l.designation.substring(0,70)}{l.designation.length>70?"…":""}</div><div style={{fontSize:10,color:C.textSoft,marginTop:1}}>{l.qte} {l.unite}</div></td>
                          <td style={{...TD,textAlign:"center"}}><input type="number" value={l.qte} onChange={e=>upd(l.id,"qte",e.target.value)} style={{...INP,width:40,textAlign:"center"}}/></td>
                          <td style={{...TD,textAlign:"right"}}><input type="number" value={l.puAchat} onChange={e=>upd(l.id,"puAchat",e.target.value)} style={{...INP,width:62,textAlign:"right",color:C.textMid}}/></td>
                          <td style={{...TD,textAlign:"center"}}>
                            <input type="number" value={l.margePct} onChange={e=>upd(l.id,"margePct",e.target.value)} style={{...INP,width:38,textAlign:"center",color:mc,fontWeight:700}}/>
                            <span style={{color:mc,fontSize:11,fontWeight:700,marginLeft:1}}>%</span>
                          </td>
                          <td style={{...TD,textAlign:"right"}}><input type="number" value={l.puVente} onChange={e=>upd(l.id,"puVente",e.target.value)} style={{...INP,width:62,textAlign:"right",fontWeight:700,color:C.accent}}/></td>
                          <td style={{...TD,textAlign:"right",fontWeight:700,color:C.text,fontSize:12}}>{fmt(l.qte*l.puVente)} €</td>
                        </tr>
                      );
                    })
                  ];
                })}
                {/* BAT-TH-142 */}
                <tr>
                  <td colSpan={6} style={{background:"#EFF6FF",padding:"6px 10px",fontWeight:700,fontSize:11,color:"#1D4ED8",textTransform:"uppercase",borderTop:`2px solid ${C.border}`}}>BAT-TH-142 — {BAT_QTE} unités</td>
                  <td style={{background:"#EFF6FF",padding:"6px 10px",textAlign:"right",color:"#1D4ED8",borderTop:`2px solid ${C.border}`}}>
                    <input type="number" value={batPuVente} onChange={e=>setBatPuVente(Number(e.target.value)||0)} style={{...INP,width:70,textAlign:"right",color:"#1D4ED8",fontWeight:700}}/>
                    <span style={{fontSize:11,marginLeft:2,color:"#1D4ED8"}}>€/U</span>
                  </td>
                </tr>
                {/* Prime CEE */}
                <tr>
                  <td colSpan={6} style={{background:"#F0FDF4",padding:"6px 10px",fontWeight:700,fontSize:11,color:"#15803D",textTransform:"uppercase"}}>Prime CEE — PICPUS ÉNERGIE</td>
                  <td style={{background:"#F0FDF4",padding:"6px 10px",textAlign:"right",color:"#15803D",fontWeight:700}}>
                    − <input type="number" value={prime} onChange={e=>setPrime(Number(e.target.value)||0)} style={{...INP,width:76,textAlign:"right",color:"#15803D",fontWeight:700}}/> €
                  </td>
                </tr>
                {/* Total */}
                <tr style={{background:C.nav}}>
                  <td colSpan={5} style={{padding:"9px 10px",color:C.navText,fontWeight:700,fontSize:13}}>TOTAL VENTE HT / RESTE À CHARGE TTC</td>
                  <td colSpan={2} style={{padding:"9px 10px",textAlign:"right",color:"#93C5FD",fontWeight:800,fontSize:13}}>{fmtE(stats.totalHT)} / {fmtE(stats.resteTTC)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* APERÇU DEVIS */}
        <div style={{flex:1,overflow:"auto",background:"#E2E8F0",display:"flex",flexDirection:"column",alignItems:"center",padding:"16px 12px",gap:0}}>
          <DevisPreview ref={printRef} lignes={actives} cats={cats} batPuVente={batPuVente} prime={prime} stats={stats}/>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// HUB
// ════════════════════════════════════════════════════════════════════════════
const MODULES = [
  {id:"verificateur",icon:"🔍",titre:"Vérificateur CEE",sousTitre:"Analyse IA de dossier",desc:"Uploadez l'AH et le devis, Claude détecte automatiquement toutes les incohérences et génère un rapport de conformité.",tags:["AH","Devis","IA","Rapport"],couleur:"#6366F1",actif:true},
  {id:"checklist",   icon:"✅",titre:"Checklist CEE",    sousTitre:"Vérification manuelle",   desc:"Contrôle point par point de l'AH : bénéficiaire, site, dates, technique, professionnel. Progression en temps réel.",tags:["Conformité","BAT-TH-142","Manuel"],couleur:"#16A34A",actif:true},
  {id:"marges",      icon:"📊",titre:"Marges × Devis",   sousTitre:"Calcul + export PDF",      desc:"Calculez vos marges sur le devis prestataire et générez le devis client AF2E (3 pages) en temps réel.",tags:["Marge","Devis AF2E","3 pages","PDF"],couleur:"#2563EB",actif:true},
  {id:"dimensionnement",icon:"📐",titre:"Dimensionnement",sousTitre:"Calcul déstratificateurs",desc:"Calcul automatique du nombre de déstratificateurs selon BAT-TH-142 : surface, hauteur, puissance → PDF.",tags:["Calcul","BAT-TH-142","PDF"],couleur:"#7C3AED",actif:false},
  {id:"rentabilite", icon:"📈",titre:"Rentabilité",      sousTitre:"Coût / CEE / Marge",       desc:"Volume CEE généré, coût acquisition, prime PICPUS estimée, ROI et analyse de rentabilité complète.",tags:["CEE","MWh cumac","ROI"],couleur:"#DB2777",actif:false},
  {id:"crm",         icon:"👥",titre:"CRM Prospects",    sousTitre:"Pipeline commercial",       desc:"Suivi des prospects et clients, relances Gmail automatiques, intégration Google Agenda.",tags:["Gmail","Agenda","Pipeline"],couleur:"#0369A1",actif:false},
];

const VUES = {verificateur:<VerificateurCEE/>,checklist:<ChecklistCEE/>,marges:<MargesDevis/>};

export default function PICPUSHub() {
  const [page, setPage] = useState(null);
  const current = page && MODULES.find(m=>m.id===page);

  // Vue module
  if (page && VUES[page]) return (
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
            <button key={m.id} onClick={()=>setPage(m.id)}
              style={{background:page===m.id?"#334155":"transparent",color:page===m.id?"#F1F5F9":"#64748B",border:`1px solid ${page===m.id?"#475569":"#334155"}`,borderRadius:7,padding:"4px 11px",fontSize:12,fontWeight:page===m.id?600:400,cursor:"pointer"}}>
              {m.icon} {m.titre}
            </button>
          ))}
        </div>
      </div>
      {/* Contenu module — overflow géré dans chaque module */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {VUES[page]}
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
                <div style={{fontSize:14,fontWeight:600,color:"#CBD5E1",lineHeight:1.2}}>ÉNERGIE</div>
                <div style={{fontSize:11,color:"#64748B"}}>SIREN 533 333 118</div>
              </div>
            </div>
            <div style={{fontSize:22,fontWeight:800,color:"#F8FAFC",marginBottom:4}}>Plateforme CEE — Outils internes</div>
            <div style={{fontSize:13,color:"#94A3B8"}}>Certificats d'Économies d'Énergie · Automatisation des processus</div>
          </div>
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

      {/* Grille */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"28px 32px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16,marginBottom:32}}>
          {MODULES.map(m=>(
            <div key={m.id} onClick={()=>m.actif&&setPage(m.id)}
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
            {[{n:"4",t:"Dimensionnement",d:"Calcul auto nb déstrats BAT-TH-142"},{n:"5",t:"Étude de rentabilité",d:"CEE généré / Marge PICPUS / ROI"},{n:"6",t:"CRM Prospects",d:"Gmail + Google Agenda"},{n:"7",t:"Assistant Visio",d:"Transcription → scoring prospect"},{n:"8",t:"Analyse fiche CEE",d:"Fiche + étude de marché auto"}].map(r=>(
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
          <span style={{fontSize:12,color:C.textSoft}}>PICPUS ÉNERGIE — Plateforme CEE interne — {new Date().toLocaleDateString("fr-FR")}</span>
          <span style={{fontSize:11,color:C.border}}>Développé avec Claude · Anthropic</span>
        </div>
      </div>
    </div>
  );
}
