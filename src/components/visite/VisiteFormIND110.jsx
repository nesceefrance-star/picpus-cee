// VisiteFormIND110.jsx — Formulaire technique visite IND-BA-110 (chauffage industriel)
const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}

const INP = {
  width: '100%', boxSizing: 'border-box',
  background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 7, padding: '9px 12px',
  color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
}

const SEL = { ...INP, cursor: 'pointer' }

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid }}>
        {label}
        {hint && <span style={{ fontSize: 11, fontWeight: 400, color: C.textSoft, marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Section({ title, color = '#1D4ED8', bg = '#EFF6FF', border = '#BFDBFE', children }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 4, height: 18, background: color, borderRadius: 2 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color }}>  {title}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {children}
      </div>
    </div>
  )
}

export default function VisiteFormIND110({ donnees, onChange }) {
  const set = (key, val) => onChange({ ...donnees, [key]: val })
  const v = (key, def = '') => donnees?.[key] ?? def

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Équipements existants */}
      <Section title="Équipements existants" color="#7C3AED">
        <Field label="Type d'installation">
          <select style={SEL} value={v('type_installation')} onChange={e => set('type_installation', e.target.value)}>
            <option value="">— Sélectionner —</option>
            <option value="chaudiere">Chaudière</option>
            <option value="aerotherme">Aérotherme</option>
            <option value="radiateur">Radiateur</option>
            <option value="generateur_air">Générateur air chaud</option>
            <option value="plancher_chauffant">Plancher chauffant</option>
            <option value="pompe_chaleur">Pompe à chaleur</option>
            <option value="autre">Autre</option>
          </select>
        </Field>
        {v('type_installation') === 'autre' && (
          <Field label="Précisez">
            <input style={INP} value={v('type_installation_autre')} onChange={e => set('type_installation_autre', e.target.value)} placeholder="Type d'installation" />
          </Field>
        )}
        <Field label="Marque">
          <input style={INP} value={v('marque')} onChange={e => set('marque', e.target.value)} placeholder="Ex: De Dietrich" />
        </Field>
        <Field label="Modèle / Référence">
          <input style={INP} value={v('modele')} onChange={e => set('modele', e.target.value)} placeholder="Ex: Vitodens 200-W" />
        </Field>
        <Field label="Année de fabrication">
          <input style={INP} type="number" min="1950" max="2030" value={v('annee_fabrication')} onChange={e => set('annee_fabrication', e.target.value)} placeholder="Ex: 2008" />
        </Field>
        <Field label="Puissance nominale (kW)">
          <input style={INP} type="number" min="0" step="0.1" value={v('puissance_nominale_kw')} onChange={e => set('puissance_nominale_kw', e.target.value)} placeholder="Ex: 150" />
        </Field>
        <Field label="Combustible actuel">
          <select style={SEL} value={v('combustible')} onChange={e => set('combustible', e.target.value)}>
            <option value="">— Sélectionner —</option>
            <option value="gaz_naturel">Gaz naturel</option>
            <option value="gpl">GPL</option>
            <option value="fioul">Fioul</option>
            <option value="electricite">Électricité</option>
            <option value="bois_granules">Bois / Granulés</option>
            <option value="autre">Autre</option>
          </select>
        </Field>
        <Field label="État général">
          <select style={SEL} value={v('etat_general')} onChange={e => set('etat_general', e.target.value)}>
            <option value="">— Sélectionner —</option>
            <option value="bon">Bon état</option>
            <option value="moyen">État moyen</option>
            <option value="mauvais">Mauvais état</option>
            <option value="hors_service">Hors service</option>
          </select>
        </Field>
        <Field label="Présence d'un brûleur ?" hint="(chaudière)">
          <select style={SEL} value={v('bruleur')} onChange={e => set('bruleur', e.target.value)}>
            <option value="">— Sélectionner —</option>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
        </Field>
        {v('bruleur') === 'oui' && <>
          <Field label="Marque brûleur">
            <input style={INP} value={v('bruleur_marque')} onChange={e => set('bruleur_marque', e.target.value)} placeholder="Ex: Riello" />
          </Field>
          <Field label="Modèle brûleur">
            <input style={INP} value={v('bruleur_modele')} onChange={e => set('bruleur_modele', e.target.value)} placeholder="Modèle" />
          </Field>
        </>}
        <Field label="Régulation existante ?">
          <select style={SEL} value={v('regulation')} onChange={e => set('regulation', e.target.value)}>
            <option value="">— Sélectionner —</option>
            <option value="aucune">Aucune</option>
            <option value="thermostat_simple">Thermostat simple</option>
            <option value="programmable">Thermostat programmable</option>
            <option value="gestion_technique">Gestion technique bâtiment</option>
          </select>
        </Field>
      </Section>

      {/* Données techniques CEE */}
      <Section title="Données techniques CEE — IND-BA-110" color="#0369A1">
        <Field label="Zone climatique" hint="(pour calcul kWh cumac)">
          <select style={SEL} value={v('zone_climatique')} onChange={e => set('zone_climatique', e.target.value)}>
            <option value="">— Sélectionner —</option>
            <option value="H1">H1 — Nord / Est (Paris, Strasbourg…)</option>
            <option value="H2">H2 — Centre / Ouest (Lyon, Nantes…)</option>
            <option value="H3">H3 — Sud / Méditerranée (Marseille, Nice…)</option>
          </select>
        </Field>
        <Field label="Surface chauffée (m²)">
          <input style={INP} type="number" min="0" value={v('surface_chauffee_m2')} onChange={e => set('surface_chauffee_m2', e.target.value)} placeholder="Ex: 1200" />
        </Field>
        <Field label="Hauteur sous plafond (m)">
          <input style={INP} type="number" min="0" step="0.1" value={v('hauteur_sous_plafond_m')} onChange={e => set('hauteur_sous_plafond_m', e.target.value)} placeholder="Ex: 6" />
        </Field>
        <Field label="Type de bâtiment">
          <select style={SEL} value={v('type_batiment')} onChange={e => set('type_batiment', e.target.value)}>
            <option value="">— Sélectionner —</option>
            <option value="atelier_industriel">Atelier industriel</option>
            <option value="entrepot_logistique">Entrepôt logistique</option>
            <option value="atelier_artisanal">Atelier artisanal</option>
            <option value="batiment_agricole">Bâtiment agricole</option>
            <option value="autre">Autre</option>
          </select>
        </Field>
        <Field label="Puissance convectif à installer (kW)" hint="(aérothermes, soufflantes)">
          <input style={INP} type="number" min="0" step="0.5" value={v('puissance_convectif_kw')} onChange={e => set('puissance_convectif_kw', e.target.value)} placeholder="Ex: 80" />
        </Field>
        <Field label="Puissance radiatif à installer (kW)" hint="(panneaux rayonnants)">
          <input style={INP} type="number" min="0" step="0.5" value={v('puissance_radiatif_kw')} onChange={e => set('puissance_radiatif_kw', e.target.value)} placeholder="Ex: 40" />
        </Field>
        <Field label="Heures de fonctionnement / an">
          <input style={INP} type="number" min="0" max="8760" value={v('heures_fonctionnement')} onChange={e => set('heures_fonctionnement', e.target.value)} placeholder="Ex: 3000" />
        </Field>
        <Field label="Température de consigne (°C)">
          <input style={INP} type="number" min="5" max="30" value={v('temperature_consigne')} onChange={e => set('temperature_consigne', e.target.value)} placeholder="Ex: 16" />
        </Field>
        <Field label="Isolation du bâtiment">
          <select style={SEL} value={v('isolation_batiment')} onChange={e => set('isolation_batiment', e.target.value)}>
            <option value="">— Sélectionner —</option>
            <option value="bonne">Bonne (double vitrage, isolation toiture)</option>
            <option value="partielle">Partielle</option>
            <option value="faible">Faible / Non isolé</option>
          </select>
        </Field>

        {/* Récapitulatif kWh cumac */}
        {v('zone_climatique') && (parseFloat(v('puissance_convectif_kw')) > 0 || parseFloat(v('puissance_radiatif_kw')) > 0) && (() => {
          const COEF = {
            convectif: { H1: 7200, H2: 8000, H3: 8500 },
            radiatif:  { H1: 2500, H2: 2800, H3: 3000 },
          }
          const z = v('zone_climatique')
          const kwhCumac = Math.round(
            (COEF.convectif[z] || 0) * (parseFloat(v('puissance_convectif_kw')) || 0) +
            (COEF.radiatif[z]  || 0) * (parseFloat(v('puissance_radiatif_kw'))  || 0)
          )
          return (
            <div style={{ gridColumn: '1 / -1', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚡</span>
              <div>
                <div style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimation kWh cumac IND-BA-110</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1D4ED8' }}>
                  {kwhCumac.toLocaleString('fr-FR')} kWh
                </div>
                <div style={{ fontSize: 11, color: '#3B82F6' }}>Zone {z} · Convectif {v('puissance_convectif_kw') || 0} kW · Radiatif {v('puissance_radiatif_kw') || 0} kW</div>
              </div>
            </div>
          )
        })()}
      </Section>

      {/* Réseau électrique */}
      <Section title="Réseau électrique" color="#0D9488">
        <Field label="Localisation TGBT">
          <input style={INP} value={v('tgbt_localisation')} onChange={e => set('tgbt_localisation', e.target.value)} placeholder="Ex: Local technique RDC" />
        </Field>
        <Field label="Marque TGBT">
          <input style={INP} value={v('tgbt_marque')} onChange={e => set('tgbt_marque', e.target.value)} placeholder="Ex: Schneider" />
        </Field>
        <Field label="Puissance disponible TGBT (A)">
          <input style={INP} type="number" min="0" value={v('tgbt_puissance_a')} onChange={e => set('tgbt_puissance_a', e.target.value)} placeholder="Ex: 400" />
        </Field>
        <Field label="Observations TGBT">
          <textarea style={{ ...INP, resize: 'vertical', minHeight: 60 }} value={v('tgbt_observations')} onChange={e => set('tgbt_observations', e.target.value)} placeholder="Observations…" />
        </Field>
        <Field label="Localisation TD (tableau divisionnaire)">
          <input style={INP} value={v('td_localisation')} onChange={e => set('td_localisation', e.target.value)} placeholder="Ex: Atelier nord" />
        </Field>
        <Field label="Observations TD">
          <textarea style={{ ...INP, resize: 'vertical', minHeight: 60 }} value={v('td_observations')} onChange={e => set('td_observations', e.target.value)} placeholder="Observations…" />
        </Field>
      </Section>

      {/* Observations générales */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ width: 4, height: 18, background: '#64748B', borderRadius: 2 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>  Observations générales</span>
        </div>
        <textarea
          style={{ ...INP, resize: 'vertical', minHeight: 100 }}
          value={v('observations_generales')}
          onChange={e => set('observations_generales', e.target.value)}
          placeholder="Remarques, contraintes d'accès, points d'attention particuliers…"
        />
      </div>

    </div>
  )
}
