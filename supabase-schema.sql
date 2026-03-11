-- ============================================================
-- PICPUS CEE — Schéma base de données
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================

-- Extension UUID
create extension if not exists "uuid-ossp";

-- ─── PROSPECTS ───────────────────────────────────────────────
create table if not exists prospects (
  id              uuid primary key default uuid_generate_v4(),
  raison_sociale  text not null,
  siren           text,
  siret           text,
  adresse         text,
  code_postal     text,
  ville           text,
  contact_nom     text,
  contact_email   text,
  contact_tel     text,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── DOSSIERS ────────────────────────────────────────────────
create table if not exists dossiers (
  id              uuid primary key default uuid_generate_v4(),
  ref             text unique not null,
  prospect_id     uuid references prospects(id) on delete cascade,
  fiche_cee       text not null default 'BAT-TH-142',
  statut          text not null default 'simulation'
                  check (statut in ('simulation','prospect','devis','ah','conforme','facture')),
  assigne_a       uuid references auth.users(id),
  prime_estimee   numeric(12,2),
  montant_devis   numeric(12,2),
  marge_pct       numeric(5,2),
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── SIMULATIONS ─────────────────────────────────────────────
create table if not exists simulations (
  id              uuid primary key default uuid_generate_v4(),
  dossier_id      uuid references dossiers(id) on delete cascade,
  fiche_cee       text not null,
  surface_m2      numeric(10,2),
  hauteur_m       numeric(5,2),
  zone_climatique text,
  nb_equipements  integer,
  puissance_kw    numeric(10,2),
  mwh_cumac       numeric(12,2),
  prime_estimee   numeric(12,2),
  prix_mwh        numeric(8,2),
  rentable        boolean,
  parametres      jsonb,
  created_at      timestamptz default now()
);

-- ─── DEVIS ───────────────────────────────────────────────────
create table if not exists devis (
  id              uuid primary key default uuid_generate_v4(),
  dossier_id      uuid references dossiers(id) on delete cascade,
  numero          text unique not null,
  date_devis      date default current_date,
  statut          text default 'brouillon'
                  check (statut in ('brouillon','envoye','accepte','refuse')),
  total_ht        numeric(12,2),
  tva             numeric(12,2),
  total_ttc       numeric(12,2),
  prime_cee       numeric(12,2),
  reste_ttc       numeric(12,2),
  lignes          jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── DOCUMENTS ───────────────────────────────────────────────
create table if not exists documents (
  id              uuid primary key default uuid_generate_v4(),
  dossier_id      uuid references dossiers(id) on delete cascade,
  type            text not null
                  check (type in ('ah','facture','devis_prestataire','devis_af2e','autre')),
  nom             text not null,
  storage_path    text,
  taille_bytes    bigint,
  created_at      timestamptz default now()
);

-- ─── ACTIVITES (historique CRM) ──────────────────────────────
create table if not exists activites (
  id              uuid primary key default uuid_generate_v4(),
  dossier_id      uuid references dossiers(id) on delete cascade,
  user_id         uuid references auth.users(id),
  type            text not null
                  check (type in ('note','appel','email','rdv','statut','document','devis')),
  contenu         text,
  created_at      timestamptz default now()
);

-- ─── INDEX ───────────────────────────────────────────────────
create index if not exists idx_dossiers_prospect on dossiers(prospect_id);
create index if not exists idx_dossiers_statut on dossiers(statut);
create index if not exists idx_dossiers_assigne on dossiers(assigne_a);
create index if not exists idx_activites_dossier on activites(dossier_id);
create index if not exists idx_simulations_dossier on simulations(dossier_id);

-- ─── TRIGGERS updated_at ─────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_prospects_updated
  before update on prospects
  for each row execute function update_updated_at();

create trigger trg_dossiers_updated
  before update on dossiers
  for each row execute function update_updated_at();

create trigger trg_devis_updated
  before update on devis
  for each row execute function update_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
alter table prospects  enable row level security;
alter table dossiers   enable row level security;
alter table simulations enable row level security;
alter table devis      enable row level security;
alter table documents  enable row level security;
alter table activites  enable row level security;

-- Politique : seuls les utilisateurs connectés accèdent aux données
create policy "Authenticated users" on prospects
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users" on dossiers
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users" on simulations
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users" on devis
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users" on documents
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users" on activites
  for all using (auth.role() = 'authenticated');
