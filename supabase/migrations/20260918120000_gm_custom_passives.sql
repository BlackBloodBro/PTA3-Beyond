-- [[Feature - GM Custom - Passives]]: lets a GM add custom Passives scoped to their own Campaign,
-- alongside the global Passive catalog -- same shape as every prior "GM Custom X" FR: one shared
-- `passives` table with a nullable campaign_id (null = global reference data, set = that Campaign's
-- own custom Passive).

alter table passives add column campaign_id uuid references campaigns(id) on delete cascade;
create index on passives (campaign_id);

-- Replaces the flat unique(name) -- global names still can't collide with each other, but two
-- Campaigns (or a Campaign and the global catalog) can each freely have their own same-named custom
-- Passive.
alter table passives drop constraint passives_name_key;
create unique index passives_name_global_key on passives (name) where campaign_id is null;
create unique index passives_name_campaign_key on passives (campaign_id, name) where campaign_id is not null;

-- Helper: does target_passive_id belong to a Campaign auth.uid() GMs? Backs write access to a custom
-- Passive and (via the block below) its passives_stats rows.
create or replace function is_campaign_gm_for_passive(target_passive_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from passives p
    where p.id = target_passive_id and p.campaign_id is not null and is_campaign_gm(p.campaign_id)
  );
$$;

-- Helper: does target_passive_id belong to a Campaign auth.uid() has joined (a player, not the GM --
-- matching is_campaign_member's own "player" meaning)? Backs member read access.
create or replace function is_campaign_member_for_passive(target_passive_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from passives p
    where p.id = target_passive_id and p.campaign_id is not null and is_campaign_member(p.campaign_id)
  );
$$;

-- Helper: is target_passive_id a global (not Campaign-scoped) Passive? Backs public read access on
-- passives_stats, mirroring passives' own "campaign_id is null" public policy below.
create or replace function is_global_passive(target_passive_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from passives p where p.id = target_passive_id and p.campaign_id is null);
$$;

-- passives was covered by the generic "world-readable, service-role-only writes" loop
-- (20260724120000) -- no longer accurate now that a row can be Campaign-owned, so it's pulled out
-- into these bespoke policies instead. passives_stats had its own flat public-read policy
-- (20260724140000, added after the generic loop migration) -- same pull-out treatment, joined back to
-- the parent Passive row's campaign_id/scoping via the helpers above (it already FKs to passives(id)
-- on delete cascade).
drop policy "Public read access" on passives;
drop policy "Public read access" on passives_stats;

create policy "Global passives are public-read" on passives
  for select using (campaign_id is null);

create policy "Campaign members can view their campaign's custom passives" on passives
  for select using (campaign_id is not null and is_campaign_member(campaign_id));

create policy "GM manages their campaign's custom passives" on passives
  for all using (campaign_id is not null and is_campaign_gm(campaign_id))
  with check (campaign_id is not null and is_campaign_gm(campaign_id));

create policy "Global passive stats are public-read" on passives_stats
  for select using (is_global_passive(passive_id));

create policy "Campaign members can view their campaign's custom passive stats" on passives_stats
  for select using (is_campaign_member_for_passive(passive_id));

create policy "GM manages their campaign's custom passive stats" on passives_stats
  for all using (is_campaign_gm_for_passive(passive_id))
  with check (is_campaign_gm_for_passive(passive_id));

-- [[Feature - GM Custom - Afflictions]]/[[Feature - GM Custom - Moves]]'s own lesson, applied
-- proactively here: pokemon_passives.passive_id is `on delete cascade` -- a real Pokemon's
-- actually-known Passive would silently vanish otherwise, and a plain query from the GM's own session
-- isn't a reliable way to see every Campaign member's own rows. pokedex_passives/passives_stats are
-- deliberately excluded -- the Passive's own definitional data, fine to cascade alongside deleting it.
create or replace function count_pokemon_using_passive(target_passive_id int)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*) from pokemon_passives where passive_id = target_passive_id;
$$;
