-- [[Feature - Add Egg hatching logic]]: an in-progress Egg is tracked separately from a real `pokemon`
-- row -- the species is already known (chosen at grant/Breeding-Check time, on trainers_items.pokedex_id)
-- but the actual Pokemon only gets created once hatching completes. `sleeps_required` is derived once,
-- at start (species' egg_hatch_rate, capped at 3 for a Trainer with Hatcher), not recomputed later, so
-- a Trainer gaining/losing Hatcher mid-hatch doesn't retroactively change an already-started Egg.
-- `inherited_nature_id` carries a bred Egg's pre-chosen nature (trainers_items.nature_id, per
-- [[Feature - Add a Pokemon Breeding Check mechanic]]) through to the Hatch action -- null for a
-- GM-granted/manually-tagged Egg, which gets the normal fully-random nature roll instead.
create table pokemon_eggs (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references trainers(id) on delete cascade,
  -- Provenance only (which Bag stack this came from) -- not on delete cascade, since the Egg's own
  -- trainers_items row is (partially or fully) consumed the moment this row is created and may not
  -- exist anymore; this row is the source of truth for an in-progress hatch from that point on.
  trainers_item_id uuid references trainers_items(id) on delete set null,
  pokedex_id int not null references pokedex(id),
  inherited_nature_id int references natures(id),
  sleeps_completed int not null default 0,
  sleeps_required int not null,
  started_at timestamptz not null default now()
);

create index on pokemon_eggs (trainer_id);

alter table pokemon_eggs enable row level security;

-- Same owner-or-campaign-GM manage pattern as trainers_items (gm_campaign_rls.sql's
-- is_campaign_gm_for_trainer, reused as-is).
create policy "Owner manages pokemon_eggs" on pokemon_eggs
  for all using (
    auth.uid() = (select user_id from trainers where id = pokemon_eggs.trainer_id)
  ) with check (
    auth.uid() = (select user_id from trainers where id = pokemon_eggs.trainer_id)
  );

create policy "GM manages campaign pokemon_eggs" on pokemon_eggs
  for all using (is_campaign_gm_for_trainer(trainer_id)) with check (is_campaign_gm_for_trainer(trainer_id));
