# ÉTAT DU PROJET PICPUS CEE
> Ce fichier est la source de vérité. Claude doit le lire en PREMIER à chaque session.
> Mis à jour : 2026-03-12

---

## 🏗️ Infrastructure
- **URL prod** : https://picpus-cee.vercel.app
- **Repo** : https://github.com/nesceefrance-star/picpus-cee.git (privé)
- **Supabase** : `lgqscucrmsakifbqmkag` — eu-west-1
- **Utilisateurs** : `nes.cee.france@gmail.com` (admin), `nathaniel@af2e-eco.fr` (commercial)

---

## 📁 Fichiers et leur état actuel

### `src/Hub.jsx` — 1613 lignes
- Header : **RÉGIE PICPUS** (plus PICPUS ÉNERGIE, plus SIREN dans le header)
- Bouton **← Dashboard** en haut à droite
- Module Marges x Devis → stockage **Supabase** (`devis_hub`)
- Cache localStorage pour affichage instantané
- Suppression inline (sans window.confirm)
- Re-upload PDF prestataire
- Export PDF via html2canvas+jsPDF
- Extraction PDF via pdf.js local

### `src/pages/Dashboard.jsx` — 452 lignes
- **Fond clair** (#F1F5F9 / blanc)
- **Nav sombre** (#1E293B) avec boutons : Dashboard, Outils Hub, 👥 Utilisateurs (admin only)
- **Bouton Utilisateurs** visible uniquement si `profile.role === 'admin'`
- Modal "Nouveau dossier" : inputs inline (plus de composant Field interne → plus de bug perte de focus)
- **Autocomplete SIREN** via api.gouv.fr (gratuit, sans clé API)
- **Autocomplete adresse** via api-adresse.data.gouv.fr (gratuit, sans clé API)

### `src/pages/Login.jsx`
- Pure onClick (plus de form natif → fonctionne sur iPad/Safari)
- useNavigate → redirection explicite après login
- Mode reset password avec redirectTo vers /reset-password

### `src/pages/ResetPassword.jsx` — NOUVEAU
- Page de reset password créée
- Écoute `PASSWORD_RECOVERY` via onAuthStateChange
- Formulaire saisie nouveau mot de passe + confirmation

### `src/router.jsx`
- Route `/reset-password` ajoutée
- Timeout AuthGuard : 8s (au lieu de 3s pour mobile)
- onAuthStateChange déclenche `finish()` immédiatement

### `api/claude.js`
- Proxy serverless Vercel pour API Anthropic
- Non utilisé actuellement (remplacé par pdf.js local)
- ANTHROPIC_API_KEY configurée dans Vercel env vars

---

## 🗄️ Tables Supabase

| Table | Description |
|-------|-------------|
| `prospects` | Entreprises prospects |
| `dossiers` | Dossiers CEE avec statut pipeline |
| `activites` | Journal d'activités |
| `devis` | (ancienne table, remplacée) |
| `devis_hub` | **Devis module Marges** — multi-appareils avec RLS |
| `documents` | Documents uploadés |
| `simulations` | Simulations CEE |
| `profiles` | Profils utilisateurs (role: admin/commercial) |

### Politique RLS `devis_hub`
- Chaque user voit/modifie/supprime uniquement ses propres devis
- `user_id` = `auth.uid()`

---

## 🎨 Design tokens

```js
// Dashboard (fond clair)
bg: '#F1F5F9', surface: '#FFFFFF', border: '#E2E8F0'
text: '#0F172A', textMid: '#475569', textSoft: '#94A3B8'
nav: '#1E293B' // nav reste sombre

// Hub (fond sombre)
bg: '#F4F6F9', surface: '#FFFFFF', border: '#E2E8F0'
nav: '#1E293B', navText: '#F8FAFC', accent: '#2563EB'
```

---

## 📋 Statuts pipeline
`simulation → prospect → devis → ah → conforme → facture`

---

## 🔐 Auth Supabase
- Redirect URL reset password : `https://picpus-cee.vercel.app/reset-password` ✅ configurée
- Rôles : `admin` (tous dossiers) / `commercial` (ses dossiers)

---

## ✅ Fonctionnalités actives dans le Hub
1. Vérificateur CEE (IA — nécessite crédits API)
2. Checklist CEE (manuel)
3. **Marges x Devis** (Supabase, pdf.js, export PDF)

## 🔜 En développement
4. Dimensionnement BAT-TH-142
5. Rentabilité
6. CRM Prospects

---

## ⚠️ Instructions pour Claude en début de session
1. **Lire ce fichier en PREMIER**
2. Pour tout fichier à modifier : chercher dans `/mnt/user-data/outputs/` d'abord
3. Si le fichier n'est pas dans outputs : demander à l'utilisateur de faire `git pull` et de re-uploader le fichier
4. Ne jamais utiliser `/home/claude/picpus-v2/src/` comme source — c'est une copie ancienne
