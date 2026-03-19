-- Migration : table cee_analyses pour sauvegarder les analyses vérificateur CEE

create table if not exists cee_analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  dossier_id  uuid references dossiers(id) on delete set null,
  ref         text,
  fiche       text,
  result      jsonb not null,
  valid_state jsonb default '{}',
  notes_state jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_cee_analyses_user    on cee_analyses(user_id);
create index if not exists idx_cee_analyses_dossier on cee_analyses(dossier_id);

alter table cee_analyses enable row level security;

create policy "Users manage own cee_analyses"
  on cee_analyses for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
