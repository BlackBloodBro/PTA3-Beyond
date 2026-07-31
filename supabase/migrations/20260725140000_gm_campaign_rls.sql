-- Expands RLS so a campaign's GM can see and manage player data within that campaign, alongside
-- (not replacing) the existing owner-only policies. Postgres OR's multiple permissive policies
-- for the same command together, so these are purely additive.
--
-- Design boundary: GM gets SELECT + UPDATE on the core trainers/pokemon records (HP, stats, etc. --
-- the things a GM adjusts during play), and full manage (insert/update/delete) on the "attached"
-- active-state tables (items, moves, afflictions, passives, ownership links). GM does NOT get
-- INSERT/DELETE on trainers or pokemon themselves -- creating/deleting a trainer or a Pokemon stays
-- player-initiated (or owner-only for deletion). This is a judgment call, not a rule from the
-- source material -- easy to widen or narrow later if it doesn't match how play actually goes.

-- Helper: is auth.uid() the GM of the campaign a given trainer belongs to? (No-op / false for
-- standalone trainers with no campaign.) SECURITY DEFINER so its internal query bypasses RLS,
-- same reasoning as is_campaign_gm.
create or replace function is_campaign_gm_for_trainer(target_trainer_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from trainers t
    where t.id = target_trainer_id
      and t.campaign_id is not null
      and is_campaign_gm(t.campaign_id)
  );
$$;

-- Helper: same, but for a Pokemon (resolved via its current owner in trainers_pokemon).
create or replace function is_campaign_gm_for_pokemon(target_pokemon_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from trainers_pokemon tp
    join trainers t on t.id = tp.trainer_id
    where tp.pokemon_id = target_pokemon_id
      and t.campaign_id is not null
      and is_campaign_gm(t.campaign_id)
  );
$$;

-- trainers: view + adjust (HP, stats, etc.), not create/delete.
create policy "GM can view campaign trainers" on trainers
  for select using (is_campaign_gm_for_trainer(id));

create policy "GM can update campaign trainers" on trainers
  for update using (is_campaign_gm_for_trainer(id)) with check (is_campaign_gm_for_trainer(id));

-- pokemon: view + adjust (HP, nickname, etc.), not create/delete.
create policy "GM can view campaign pokemon" on pokemon
  for select using (is_campaign_gm_for_pokemon(id));

create policy "GM can update campaign pokemon" on pokemon
  for update using (is_campaign_gm_for_pokemon(id)) with check (is_campaign_gm_for_pokemon(id));

-- Attached active-state tables: full manage for the GM.
create policy "GM manages campaign trainers_pokemon" on trainers_pokemon
  for all using (is_campaign_gm_for_trainer(trainer_id)) with check (is_campaign_gm_for_trainer(trainer_id));

create policy "GM manages campaign pokemon_moves" on pokemon_moves
  for all using (is_campaign_gm_for_pokemon(pokemon_id)) with check (is_campaign_gm_for_pokemon(pokemon_id));

create policy "GM manages campaign pokemon_afflictions" on pokemon_afflictions
  for all using (is_campaign_gm_for_pokemon(pokemon_id)) with check (is_campaign_gm_for_pokemon(pokemon_id));

create policy "GM manages campaign pokemon_passives" on pokemon_passives
  for all using (is_campaign_gm_for_pokemon(pokemon_id)) with check (is_campaign_gm_for_pokemon(pokemon_id));

create policy "GM manages campaign trainer_moves" on trainer_moves
  for all using (is_campaign_gm_for_trainer(trainer_id)) with check (is_campaign_gm_for_trainer(trainer_id));

create policy "GM manages campaign trainers_items" on trainers_items
  for all using (is_campaign_gm_for_trainer(trainer_id)) with check (is_campaign_gm_for_trainer(trainer_id));
