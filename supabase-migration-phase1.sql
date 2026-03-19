-- ============================================================
-- Migration Phase 1 — Suivi des appels
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================

-- Table appels
create table if not exists appels (
  id         uuid primary key default uuid_generate_v4(),
  dossier_id uuid references dossiers(id) on delete cascade,
  user_id    uuid references auth.users(id),
  date       timestamptz default now(),
  etat       text not null check (etat in ('nrp', 'rappel', 'joint', 'message_laisse')),
  rappel_at  timestamptz,
  note       text,
  created_at timestamptz default now()
);

alter table appels enable row level security;

create policy "Authenticated users" on appels
  for all using (auth.role() = 'authenticated');

create index if not exists idx_appels_dossier on appels(dossier_id);
