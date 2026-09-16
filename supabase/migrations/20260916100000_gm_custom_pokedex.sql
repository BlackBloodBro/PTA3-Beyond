-- [[Feature - GM Custom - Pokemon]]: lets a GM add custom species scoped to their own Campaign,
-- alongside the global Pokedex catalog -- same shape as [[Feature - GM Custom - Items]]: one shared
-- table with a nullable campaign_id (null = global reference data, set = that Campaign's own
-- custom species), rather than a separate parallel table.

alter table pokedex add column campaign_id uuid references campaigns(id) on delete cascade;
create index on pokedex (campaign_id);

-- Replaces the flat unique(name) added in 20260724150150 -- global names still can't collide with
-- each other, but two Campaigns (or a Campaign and the global catalog) can each freely have their
-- own same-named custom species.
alter table pokedex drop constraint pokedex_name_key;
create unique index pokedex_name_global_key on pokedex (name) where campaign_id is null;
create unique index pokedex_name_campaign_key on pokedex (campaign_id, name) where campaign_id is not null;

-- Helper: does target_pokedex_id belong to a Campaign auth.uid() GMs? Backs write access to a
-- custom species and (via the loop below) its six relation tables.
create or replace function is_campaign_gm_for_pokedex_species(target_pokedex_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from pokedex p
    where p.id = target_pokedex_id and p.campaign_id is not null and is_campaign_gm(p.campaign_id)
  );
$$;

-- Helper: does target_pokedex_id belong to a Campaign auth.uid() has joined (a player, not the GM --
-- matching is_campaign_member's own "player" meaning)? Backs member read access.
create or replace function is_campaign_member_for_pokedex_species(target_pokedex_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from pokedex p
    where p.id = target_pokedex_id and p.campaign_id is not null and is_campaign_member(p.campaign_id)
  );
$$;

-- Helper: is target_pokedex_id a global (not Campaign-scoped) species? Backs public read access on
-- the six relation tables, mirroring pokedex's own "campaign_id is null" public policy below.
create or replace function is_global_pokedex_species(target_pokedex_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from pokedex p where p.id = target_pokedex_id and p.campaign_id is null);
$$;

-- pokedex itself was covered by the generic "world-readable, service-role-only writes" loop
-- (20260724120000) -- no longer accurate now that a row can be Campaign-owned, so it's pulled out
-- into these bespoke policies instead: global rows stay public-read same as before, a Campaign's own
-- custom species is visible to that Campaign's GM + members only, and only that Campaign's GM can
-- write it.
drop policy "Public read access" on pokedex;

create policy "Global species are public-read" on pokedex
  for select using (campaign_id is null);

create policy "Campaign members can view their campaign's custom species" on pokedex
  for select using (campaign_id is not null and is_campaign_member(campaign_id));

create policy "GM manages their campaign's custom species" on pokedex
  for all using (campaign_id is not null and is_campaign_gm(campaign_id))
  with check (campaign_id is not null and is_campaign_gm(campaign_id));

-- Same pull-out-of-the-generic-loop treatment for all six relation tables -- their own RLS just
-- joins back to the parent pokedex row's campaign_id/scoping via the helpers above, no campaign_id
-- of their own needed (they already FK to pokedex(id) on delete cascade).
do $$
declare
  t text;
begin
  foreach t in array array[
    'pokedex_habitats', 'pokedex_moves', 'pokedex_passives', 'pokedex_proficiencies', 'pokedex_diets',
    'pokedex_egg_groups'
  ]
  loop
    execute format('drop policy "Public read access" on %I;', t);
    execute format(
      'create policy "Global species relations are public-read" on %I for select using (is_global_pokedex_species(pokedex_id));',
      t
    );
    execute format(
      'create policy "Campaign members can view their campaign''s custom species relations" on %I for select using (is_campaign_member_for_pokedex_species(pokedex_id));',
      t
    );
    execute format(
      'create policy "GM manages their campaign''s custom species relations" on %I for all using (is_campaign_gm_for_pokedex_species(pokedex_id)) with check (is_campaign_gm_for_pokedex_species(pokedex_id));',
      t
    );
  end loop;
end $$;
