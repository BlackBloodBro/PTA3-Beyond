-- [[Feature - GM Custom - Type]]: lets a GM add custom Types scoped to their own Campaign, alongside
-- the global catalog -- same shape as every other "GM Custom X" sibling: one shared table with a
-- nullable campaign_id (null = global reference data, set = that Campaign's own custom Type). Unlike
-- every sibling, a Type isn't self-contained -- type_matchups/type_immunities are a full pairwise
-- matrix a new Type needs relationships defined in, and seven other columns across five tables
-- (moves.type_id, pokedex.type_1_id/type_2_id, held_item_boosts.boosted_type_id,
-- pokemon.type_1_id/type_2_id, trainer_milestones.chosen_type_id) can actually assign this Type to
-- something real.

alter table types add column campaign_id uuid references campaigns(id) on delete cascade;
create index on types (campaign_id);

-- Replaces the flat unique(name) -- global names still can't collide with each other, but two
-- Campaigns (or a Campaign and the global catalog) can each freely have their own same-named custom
-- Type.
alter table types drop constraint types_name_key;
create unique index types_name_global_key on types (name) where campaign_id is null;
create unique index types_name_campaign_key on types (campaign_id, name) where campaign_id is not null;

-- Helper: does target_type_id belong to a Campaign auth.uid() GMs? Backs write access to a custom
-- Type and (via the policies below) its type_matchups/type_immunities rows.
create or replace function is_campaign_gm_for_type(target_type_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from types t
    where t.id = target_type_id and t.campaign_id is not null and is_campaign_gm(t.campaign_id)
  );
$$;

-- Helper: does target_type_id belong to a Campaign auth.uid() has joined (a player, not the GM)?
-- Backs member read access.
create or replace function is_campaign_member_for_type(target_type_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from types t
    where t.id = target_type_id and t.campaign_id is not null and is_campaign_member(t.campaign_id)
  );
$$;

-- Helper: is target_type_id a global (not Campaign-scoped) Type?
create or replace function is_global_type(target_type_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from types t where t.id = target_type_id and t.campaign_id is null);
$$;

-- types itself was covered by the generic "world-readable, service-role-only writes" loop
-- (20260724120000) -- no longer accurate now that a row can be Campaign-owned, so it's pulled out
-- into these bespoke policies instead: global rows stay public-read same as before, a Campaign's own
-- custom Type is visible to that Campaign's GM + members only, and only that Campaign's GM can write
-- it.
drop policy "Public read access" on types;

create policy "Global types are public-read" on types
  for select using (campaign_id is null);

create policy "Campaign members can view their campaign's custom types" on types
  for select using (campaign_id is not null and is_campaign_member(campaign_id));

create policy "GM manages their campaign's custom types" on types
  for all using (campaign_id is not null and is_campaign_gm(campaign_id))
  with check (campaign_id is not null and is_campaign_gm(campaign_id));

-- type_matchups/type_immunities are a two-sided relation -- either side (attacking or defending) can
-- be a Campaign's own custom Type, so visibility/write access checks both sides rather than joining
-- through a single parent_id the way every other sibling's relation tables do.
do $$
declare
  t text;
begin
  foreach t in array array['type_matchups', 'type_immunities']
  loop
    execute format('drop policy "Public read access" on %I;', t);
    execute format(
      'create policy "Global type relations are public-read" on %I for select using (is_global_type(attacking_type_id) and is_global_type(defending_type_id));',
      t
    );
    execute format(
      'create policy "Campaign members can view their campaign''s custom type relations" on %I for select using (is_campaign_member_for_type(attacking_type_id) or is_campaign_member_for_type(defending_type_id));',
      t
    );
    execute format(
      'create policy "GM manages their campaign''s custom type relations" on %I for all using (is_campaign_gm_for_type(attacking_type_id) or is_campaign_gm_for_type(defending_type_id)) with check (is_campaign_gm_for_type(attacking_type_id) or is_campaign_gm_for_type(defending_type_id));',
      t
    );
  end loop;
end $$;

-- type_matchups/type_immunities had no on-delete action on either FK to types(id) (plain FK-restrict)
-- -- deleting a custom Type would otherwise fail on its own matchup rows. This is the Type's own
-- definitional data (which other Types it beats/resists/is immune to), fine to cascade, same call as
-- every sibling's relation tables.
alter table type_matchups drop constraint type_matchups_attacking_type_id_fkey;
alter table type_matchups add constraint type_matchups_attacking_type_id_fkey
  foreign key (attacking_type_id) references types(id) on delete cascade;
alter table type_matchups drop constraint type_matchups_defending_type_id_fkey;
alter table type_matchups add constraint type_matchups_defending_type_id_fkey
  foreign key (defending_type_id) references types(id) on delete cascade;

alter table type_immunities drop constraint type_immunities_attacking_type_id_fkey;
alter table type_immunities add constraint type_immunities_attacking_type_id_fkey
  foreign key (attacking_type_id) references types(id) on delete cascade;
alter table type_immunities drop constraint type_immunities_defending_type_id_fkey;
alter table type_immunities add constraint type_immunities_defending_type_id_fkey
  foreign key (defending_type_id) references types(id) on delete cascade;

-- Delete-in-use guard: unlike type_matchups/type_immunities (the Type's own definition, fine to
-- cascade), these seven columns across five tables mean something real is actually built or played
-- using this Type -- a custom Move/Pokedex species/held-item boost the GM made with it, a specific
-- Pokemon's own type override, or a Trainer's "Type ace" pick. None of these FKs cascade (plain
-- FK-restrict), so an unguarded delete would hard-fail with a raw constraint-violation error rather
-- than silently losing data -- still worth a friendly proactive guard, same SECURITY DEFINER pattern
-- as every other guarded "GM Custom X" sibling.
create or replace function count_type_usages(target_type_id int)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select
    (select count(*) from moves where type_id = target_type_id)
    + (select count(*) from pokedex where type_1_id = target_type_id or type_2_id = target_type_id)
    + (select count(*) from held_item_boosts where boosted_type_id = target_type_id)
    + (select count(*) from pokemon where type_1_id = target_type_id or type_2_id = target_type_id)
    + (select count(*) from trainer_milestones where chosen_type_id = target_type_id);
$$;
