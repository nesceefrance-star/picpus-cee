# CLAUDE.md — Contexte projet RÉGIE PICPUS / CRM CEE

## Présentation

CRM métier pour la gestion de dossiers **CEE (Certificats d'Économie d'Énergie)** de la société **RÉGIE PICPUS** (filiale SOFT.IA / LYVNA / ELI). L'application permet de gérer les prospects, dossiers, devis, visites techniques et documents associés.

**Déployé sur** : Vercel (frontend) + Supabase (BaaS)
**Repo GitHub** : `nesceefrance-star/picpus-cee`

---

## Stack technique

| Couche | Techno |
|---|---|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| State global | Zustand (`src/store/useStore.js`) |
| Backend/BDD | Supabase (PostgreSQL + Auth + Storage) |
| PDF | @react-pdf/renderer |
| Cartes | Leaflet + react-leaflet |
| UI base | MUI v7 (utilisé a minima — attention : injecte du CSS global blanc sur les textes) |
| Hosting | Vercel |

**Important** : MUI est présent mais on évite de l'utiliser pour les nouveaux composants. Tout le style est en **inline styles React** avec la palette `C` définie localement dans chaque fichier.

---

## Palette de couleurs (convention dans tous les fichiers)

```js
const C = {
  bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0',
  text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8',
  accent: '#2563EB',
}
```

Toujours définir `C` localement en haut de chaque fichier. Ne jamais utiliser de classes CSS ou de fichiers `.css` sauf pour Leaflet.

---

## Structure des fichiers

```
src/
├── pages/
│   ├── Dashboard.jsx          — tableau de bord
│   ├── Dossiers.jsx           — liste des dossiers
│   ├── DossierDetail.jsx      — fiche dossier complète (prospect, devis, cadastre, notes)
│   ├── VisitesTechniques.jsx  — liste des visites
│   ├── VisiteTechniqueDetail.jsx — formulaire visite technique
│   ├── AgentRelance.jsx       — agent IA de relance
│   ├── MonAssistante.jsx      — assistant IA
│   ├── SuiviEquipe.jsx        — suivi commercial équipe
│   ├── AdminUsers.jsx         — gestion utilisateurs
│   └── Parametres.jsx
├── components/
│   ├── NouveauDossierWizard.jsx — wizard création dossier (multi-étapes)
│   ├── CadastreMap.jsx          — carte parcelles cadastrales interactive
│   ├── DevisPDF.jsx             — génération PDF devis
│   ├── EmailSection.jsx         — envoi emails
│   ├── AppLayout.jsx / AppSidebar.jsx
│   └── visite/
│       ├── PhotoSection.jsx         — upload photos par catégorie (Supabase Storage)
│       ├── VisiteFormIND110.jsx     — formulaire fiche IND-BA-110
│       └── VisiteRapportPDF.jsx     — PDF rapport visite
├── store/useStore.js            — état global Zustand
└── lib/supabase.js              — client Supabase
```

---

## Tables Supabase principales

| Table | Rôle |
|---|---|
| `profiles` | Utilisateurs (id = auth.uid, role: admin/commercial) |
| `prospects` | Clients (raison_sociale, siret, adresse, code_postal, ville, contact_nom, contact_tel, contact_email, naf) |
| `dossiers` | Dossiers CEE (ref YYYY-MM-NNN, prospect_id, statut, assigne_a, type_fiche, adresse_site, fiche_locked) |
| `devis_hub` | Données devis liées à un dossier (dossier_id, montant, tva, etc.) |
| `simulations` | Simulations CEE (dossier_id, type_fiche, données) |
| `visites_techniques` | Visites (dossier_id, type_fiche, statut, donnees jsonb, photos jsonb) |
| `activites` | Journal d'activité (dossier_id, user_id, type, contenu) |

**Colonne importante** : `dossiers.adresse_site TEXT` — adresse du site des travaux (différente de l'adresse du prospect). Ajoutée via : `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS adresse_site TEXT;`

**Storage Supabase** : bucket `visites-photos` — photos organisées par `{visiteId}/{categorie}/{timestamp}.jpg`

---

## Fiches CEE gérées

- **BAT-TH-163** — Rénovation thermique bâtiment tertiaire
- **BAT-TH-142** — Système de gestion technique du bâtiment
- **IND-BA-110** — Récupération de chaleur sur air comprimé

---

## Références CEE

Format de référence dossier : `YYYY-MM-NNN` (ex: `2025-03-001`) — séquentiel par mois, sans préfixe.

---

## APIs externes utilisées (toutes gratuites)

| API | Usage |
|---|---|
| `api-adresse.data.gouv.fr` | Autocomplétion adresses (BAN) |
| `apicarto.ign.fr/api/cadastre/parcelle` | Parcelles cadastrales au point GPS |
| `data.geopf.fr/wfs/ows` | WFS parcelles cadastrales par bbox (chargement dynamique) |
| `recherche-entreprises.api.gouv.fr` | Lookup SIRET/SIRENE |
| Tuiles OpenStreetMap | Fond de carte Leaflet |

---

## Comportements importants à connaître

### Autocomplétion adresses (BAN)
L'API BAN retourne parfois des résultats de type `street` sans numéro de rue. Le numéro est extrait du texte saisi par l'utilisateur et injecté dans le label :
```js
const buildLabel = (feat) => {
  const num = queryRef.current.match(/^(\d+[a-zA-Z]?)/)?.[1]
  if (num && feat.properties.type !== 'housenumber' && !feat.properties.label.startsWith(num))
    return num + ' ' + feat.properties.label
  return feat.properties.label || ''
}
```

### iOS/iPadOS — upload photos
- iPadOS 13+ se présente comme `Macintosh` dans le userAgent → détection via `maxTouchPoints > 1`
- Sur iOS/iPadOS : skip compression (canvas.toBlob instable) et skip saveToDevice
- Upload via FileReader (arrayBuffer() instable sur iOS Safari)

### Dropdowns sur iOS
Les suggestions d'autocomplétion utilisent `onTouchEnd={e => { e.preventDefault(); handler() }}` + timeout de 350ms sur `onBlur` pour éviter la fermeture prématurée avant le clic.

### CadastreMap
- Géocode d'abord l'`adresse_site` (BAN), fallback SIRENE si absent
- Chargement dynamique WFS : toutes les parcelles visibles à l'écran, rechargement au déplacement/zoom
- Sélection manuelle par clic — seules les parcelles sélectionnées apparaissent dans le résumé
- Persistance sélection dans `localStorage` (clé `cadastre_{dossierId}`)

---

## Conventions de développement

- **Pas de fichiers CSS** (sauf `leaflet/dist/leaflet.css`) — inline styles uniquement
- **Pas de composants MUI** pour les nouveaux éléments — trop de conflits de style
- **fontFamily: 'inherit'** sur tous les boutons et inputs
- **Pas de `async/await` dans les useEffect** — extraire dans une fonction nommée
- Les sauvegardes Supabase se font toujours sur `dossiers` (pas `devis_hub`) pour `adresse_site`
- Toujours vérifier qu'une ligne existe avant UPDATE (préférer UPSERT si incertain)
