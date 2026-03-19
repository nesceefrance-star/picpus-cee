-- ============================================================
-- Migration Phase 2 — Devis liés aux dossiers (Feature 7)
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================

-- Ajouter la colonne dossier_id dans devis_hub
alter table devis_hub
  add column if not exists dossier_id uuid references dossiers(id) on delete set null;

create index if not exists idx_devis_hub_dossier on devis_hub(dossier_id);
