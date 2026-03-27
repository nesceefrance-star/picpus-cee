-- ============================================================
-- Migration Phase 3 — Process commercial complet
-- Nouveaux statuts + colonnes dépôt délégitaire
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================

-- 1. Mettre à jour la contrainte de statut (ajout des nouveaux statuts, suppression 'ah')
alter table dossiers drop constraint if exists dossiers_statut_check;

alter table dossiers add constraint dossiers_statut_check
  check (statut in (
    'simulation', 'prospect', 'contacte',
    'visio_planifiee', 'visio_effectuee',
    'visite_planifiee', 'visite_effectuee',
    'devis', 'devis_valide', 'travaux',
    'depot_delegataire', 'conforme', 'facture',
    'ah'  -- conservé temporairement pour les dossiers existants
  ));

-- 2. Ajouter les colonnes pour la gestion documentaire
alter table dossiers
  add column if not exists doc_validations  jsonb default '{}',
  add column if not exists depot_checklist  jsonb default '{}',
  add column if not exists doc_notes        jsonb default '{}';

-- 3. Index pour les nouvelles colonnes (optionnel, utile si filtrage)
-- create index if not exists idx_dossiers_statut on dossiers(statut);
