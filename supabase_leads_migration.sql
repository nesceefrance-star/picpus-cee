-- ═══════════════════════════════════════════════════════════════
--  MIGRATION LEADS — suppression + recréation propre
--  À exécuter dans Supabase > SQL Editor
--  ⚠ Supprime les données existantes (test only)
-- ═══════════════════════════════════════════════════════════════

-- Suppression dans l'ordre (enfants d'abord)
DROP TABLE IF EXISTS public.leads_contacts CASCADE;
DROP TABLE IF EXISTS public.leads_import    CASCADE;
DROP TABLE IF EXISTS public.leads_batches   CASCADE;

-- ── 1. leads_batches ────────────────────────────────────────────
CREATE TABLE public.leads_batches (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT now(),
  nom          TEXT        NOT NULL,
  lead_type    TEXT,
  fichier_nom  TEXT,
  nb_societes  INT         DEFAULT 0,
  nb_contacts  INT         DEFAULT 0,
  assigne_a    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.leads_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_batches_admin" ON public.leads_batches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "leads_batches_own_select" ON public.leads_batches
  FOR SELECT USING (assigne_a = auth.uid());

-- ── 2. leads_import ─────────────────────────────────────────────
CREATE TABLE public.leads_import (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at           TIMESTAMPTZ DEFAULT now(),
  batch_id             UUID        REFERENCES public.leads_batches(id) ON DELETE CASCADE,
  import_batch_id      UUID,
  assigne_a            UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  raison_sociale       TEXT,
  adresse              TEXT,
  cp                   TEXT,
  ville                TEXT,
  web                  TEXT,
  activite             TEXT,
  tel_societe          TEXT,
  statut_qualification TEXT        DEFAULT 'À qualifier',
  cadastre_fetched     BOOLEAN     DEFAULT false,
  cadastre_fetched_at  TIMESTAMPTZ,
  lat                  DOUBLE PRECISION,
  lon                  DOUBLE PRECISION,
  geocode_score        DOUBLE PRECISION,
  adresse_normalisee   TEXT,
  lien_geoportail      TEXT,
  lien_googlemaps      TEXT,
  id_parcelle          TEXT,
  section_cadastrale   TEXT,
  numero_parcelle      TEXT,
  surface_parcelle_m2  INT,
  nb_batiments         INT,
  surface_bati_m2      INT,
  surface_bati_max_m2  INT
);

ALTER TABLE public.leads_import ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_import_admin" ON public.leads_import
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "leads_import_own_select" ON public.leads_import
  FOR SELECT USING (assigne_a = auth.uid());

CREATE POLICY "leads_import_own_update" ON public.leads_import
  FOR UPDATE USING (assigne_a = auth.uid());

-- ── 3. leads_contacts ───────────────────────────────────────────
CREATE TABLE public.leads_contacts (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT now(),
  import_id           UUID        REFERENCES public.leads_import(id) ON DELETE CASCADE,
  nom                 TEXT,
  prenom              TEXT,
  fonction            TEXT,
  tel_societe         TEXT,
  statut_original     TEXT,
  score_poste         INT         DEFAULT 0,
  rang_poste          INT,
  linkedin_url        TEXT,
  linkedin_fetched_at TIMESTAMPTZ,
  lusha_fetched       BOOLEAN     DEFAULT false,
  lusha_fetched_at    TIMESTAMPTZ,
  lusha_email         TEXT,
  lusha_phone         TEXT,
  lusha_mobile        TEXT,
  lusha_raw           JSONB,
  lusha_credits_used  INT         DEFAULT 0
);

ALTER TABLE public.leads_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_contacts_admin" ON public.leads_contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "leads_contacts_own_select" ON public.leads_contacts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leads_import WHERE id = import_id AND assigne_a = auth.uid())
  );

CREATE POLICY "leads_contacts_own_update" ON public.leads_contacts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.leads_import WHERE id = import_id AND assigne_a = auth.uid())
  );

-- ── 4. Rafraîchir le cache PostgREST ────────────────────────────
NOTIFY pgrst, 'reload schema';
