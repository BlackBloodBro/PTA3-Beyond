-- [[Feature - GM Custom - Afflictions]]: lets a GM add custom afflictions scoped to their own
-- Campaign, alongside the global affliction catalog -- same shape as [[Feature - GM Custom - Pokemon]]/
-- [[Feature - GM Custom - Items]]: one shared `afflictions` table with a nullable campaign_id (null =
-- global reference data, set = that Campaign's own custom affliction).

alter table afflictions add column campaign_id uuid references campaigns(id) on delete cascade;
create index on afflictions (campaign_id);

-- Replaces the flat unique(name) -- global names still can't collide with each other, but two
-- Campaigns (or a Campaign and the global catalog) can each freely have their own same-named custom
-- affliction.
alter table afflictions drop constraint afflictions_name_key;
create unique index afflictions_name_global_key on afflictions (name) where campaign_id is null;
create unique index afflictions_name_campaign_key on afflictions (campaign_id, name) where campaign_id is not null;

-- Helper: does target_affliction_id belong to a Campaign auth.uid() GMs? Backs write access to a
-- custom affliction and (via the block below) its afflictions_stats rows.
create or replace function is_campaign_gm_for_affliction(target_affliction_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from afflictions a
    where a.id = target_affliction_id and a.campaign_id is not null and is_campaign_gm(a.campaign_id)
  );
$$;

-- Helper: does target_affliction_id belong to a Campaign auth.uid() has joined (a player, not the GM
-- -- matching is_campaign_member's own "player" meaning)? Backs member read access.
create or replace function is_campaign_member_for_affliction(target_affliction_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from afflictions a
    where a.id = target_affliction_id and a.campaign_id is not null and is_campaign_member(a.campaign_id)
  );
$$;

-- Helper: is target_affliction_id a global (not Campaign-scoped) affliction? Backs public read access
-- on afflictions_stats, mirroring afflictions' own "campaign_id is null" public policy below.
create or replace function is_global_affliction(target_affliction_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from afflictions a where a.id = target_affliction_id and a.campaign_id is null);
$$;

-- afflictions itself was covered by the generic "world-readable, service-role-only writes" loop
-- (20260724120000) -- no longer accurate now that a row can be Campaign-owned, so it's pulled out
-- into these bespoke policies instead: global rows stay public-read same as before, a Campaign's own
-- custom affliction is visible to that Campaign's GM + members only, and only that Campaign's GM can
-- write it.
drop policy "Public read access" on afflictions;

create policy "Global afflictions are public-read" on afflictions
  for select using (campaign_id is null);

create policy "Campaign members can view their campaign's custom afflictions" on afflictions
  for select using (campaign_id is not null and is_campaign_member(campaign_id));

create policy "GM manages their campaign's custom afflictions" on afflictions
  for all using (campaign_id is not null and is_campaign_gm(campaign_id))
  with check (campaign_id is not null and is_campaign_gm(campaign_id));

-- afflictions_stats had its own flat public-read policy (20260724130000, added after the generic loop
-- migration) -- same pull-out treatment, joined back to the parent affliction row's campaign_id/
-- scoping via the helpers above. No campaign_id of its own needed (already FKs to afflictions(id) on
-- delete cascade).
drop policy "Public read access" on afflictions_stats;

create policy "Global affliction stats are public-read" on afflictions_stats
  for select using (is_global_affliction(affliction_id));

create policy "Campaign members can view their campaign's custom affliction stats" on afflictions_stats
  for select using (is_campaign_member_for_affliction(affliction_id));

create policy "GM manages their campaign's custom affliction stats" on afflictions_stats
  for all using (is_campaign_gm_for_affliction(affliction_id))
  with check (is_campaign_gm_for_affliction(affliction_id));
