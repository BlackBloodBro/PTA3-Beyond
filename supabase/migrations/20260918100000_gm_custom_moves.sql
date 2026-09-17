-- [[Feature - GM Custom - Moves]]: lets a GM add custom Moves scoped to their own Campaign, alongside
-- the global Move catalog -- same shape as [[Feature - GM Custom - Pokemon]]/[[Feature - GM Custom -
-- Items]]/[[Feature - GM Custom - Afflictions]]: one shared `moves` table with a nullable campaign_id
-- (null = global reference data, set = that Campaign's own custom Move).

alter table moves add column campaign_id uuid references campaigns(id) on delete cascade;
create index on moves (campaign_id);

-- Replaces the flat unique(name) -- global names still can't collide with each other, but two
-- Campaigns (or a Campaign and the global catalog) can each freely have their own same-named custom
-- Move.
alter table moves drop constraint moves_name_key;
create unique index moves_name_global_key on moves (name) where campaign_id is null;
create unique index moves_name_campaign_key on moves (campaign_id, name) where campaign_id is not null;

-- Helper: does target_move_id belong to a Campaign auth.uid() GMs? Backs write access to a custom
-- Move and (via the block below) its moves_proficiencies rows.
create or replace function is_campaign_gm_for_move(target_move_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from moves m
    where m.id = target_move_id and m.campaign_id is not null and is_campaign_gm(m.campaign_id)
  );
$$;

-- Helper: does target_move_id belong to a Campaign auth.uid() has joined (a player, not the GM --
-- matching is_campaign_member's own "player" meaning)? Backs member read access.
create or replace function is_campaign_member_for_move(target_move_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from moves m
    where m.id = target_move_id and m.campaign_id is not null and is_campaign_member(m.campaign_id)
  );
$$;

-- Helper: is target_move_id a global (not Campaign-scoped) Move? Backs public read access on
-- moves_proficiencies, mirroring moves' own "campaign_id is null" public policy below.
create or replace function is_global_move(target_move_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from moves m where m.id = target_move_id and m.campaign_id is null);
$$;

-- moves and moves_proficiencies were both covered by the generic "world-readable, service-role-only
-- writes" loop (20260724120000) -- no longer accurate now that a Move can be Campaign-owned, so both
-- are pulled out into these bespoke policies instead: global rows stay public-read same as before, a
-- Campaign's own custom Move is visible to that Campaign's GM + members only, and only that Campaign's
-- GM can write it. moves_proficiencies has no campaign_id of its own -- its RLS just joins back to the
-- parent Move row's campaign_id/scoping via the helpers above (it already FKs to moves(id) on delete
-- cascade).
drop policy "Public read access" on moves;
drop policy "Public read access" on moves_proficiencies;

create policy "Global moves are public-read" on moves
  for select using (campaign_id is null);

create policy "Campaign members can view their campaign's custom moves" on moves
  for select using (campaign_id is not null and is_campaign_member(campaign_id));

create policy "GM manages their campaign's custom moves" on moves
  for all using (campaign_id is not null and is_campaign_gm(campaign_id))
  with check (campaign_id is not null and is_campaign_gm(campaign_id));

create policy "Global move proficiencies are public-read" on moves_proficiencies
  for select using (is_global_move(move_id));

create policy "Campaign members can view their campaign's custom move proficiencies" on moves_proficiencies
  for select using (is_campaign_member_for_move(move_id));

create policy "GM manages their campaign's custom move proficiencies" on moves_proficiencies
  for all using (is_campaign_gm_for_move(move_id))
  with check (is_campaign_gm_for_move(move_id));
