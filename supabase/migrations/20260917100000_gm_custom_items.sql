-- [[Feature - GM Custom - Items]]: lets a GM add custom items scoped to their own Campaign,
-- alongside the global item catalog -- same shape as [[Feature - GM Custom - Pokemon]]: one shared
-- `items` table with a nullable campaign_id (null = global reference data, set = that Campaign's own
-- custom item).
--
-- Corrected against the current schema (see the FR's 2026-09-17 re-evaluation): `items` no longer
-- carries item_category_id/boosted_type_id/boost_amount as plain columns -- "Create Inventory System"
-- (20260808220000) already split those into items_item_categories (many-to-many) and
-- held_item_boosts (a 1:1 detail row), before this FR was even first evaluated. Both need the same
-- carve-out `items` itself needs, joined back to the parent item's own campaign_id.

alter table items add column campaign_id uuid references campaigns(id) on delete cascade;
create index on items (campaign_id);

-- Replaces the flat unique(name) -- global names still can't collide with each other, but two
-- Campaigns (or a Campaign and the global catalog) can each freely have their own same-named custom
-- item.
alter table items drop constraint items_name_key;
create unique index items_name_global_key on items (name) where campaign_id is null;
create unique index items_name_campaign_key on items (campaign_id, name) where campaign_id is not null;

-- Helper: does target_item_id belong to a Campaign auth.uid() GMs? Backs write access to a custom
-- item and (via the loop below) its two relation/detail tables.
create or replace function is_campaign_gm_for_item(target_item_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from items i
    where i.id = target_item_id and i.campaign_id is not null and is_campaign_gm(i.campaign_id)
  );
$$;

-- Helper: does target_item_id belong to a Campaign auth.uid() has joined (a player, not the GM --
-- matching is_campaign_member's own "player" meaning)? Backs member read access.
create or replace function is_campaign_member_for_item(target_item_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from items i
    where i.id = target_item_id and i.campaign_id is not null and is_campaign_member(i.campaign_id)
  );
$$;

-- Helper: is target_item_id a global (not Campaign-scoped) item? Backs public read access on the
-- relation/detail tables, mirroring items' own "campaign_id is null" public policy below.
create or replace function is_global_item(target_item_id int)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from items i where i.id = target_item_id and i.campaign_id is null);
$$;

-- items itself was covered by the generic "world-readable, service-role-only writes" loop
-- (20260724120000) -- no longer accurate now that a row can be Campaign-owned, so it's pulled out
-- into these bespoke policies instead: global rows stay public-read same as before, a Campaign's own
-- custom item is visible to that Campaign's GM + members only, and only that Campaign's GM can write
-- it.
drop policy "Public read access" on items;

create policy "Global items are public-read" on items
  for select using (campaign_id is null);

create policy "Campaign members can view their campaign's custom items" on items
  for select using (campaign_id is not null and is_campaign_member(campaign_id));

create policy "GM manages their campaign's custom items" on items
  for all using (campaign_id is not null and is_campaign_gm(campaign_id))
  with check (campaign_id is not null and is_campaign_gm(campaign_id));

-- Same pull-out-of-their-own-flat-public-read-policy treatment for items_item_categories and
-- held_item_boosts -- their own RLS just joins back to the parent item row's campaign_id/scoping via
-- the helpers above, no campaign_id of their own needed (they already FK to items(id) on delete
-- cascade).
do $$
declare
  t text;
begin
  foreach t in array array['items_item_categories', 'held_item_boosts']
  loop
    execute format('drop policy "Public read access" on %I;', t);
    execute format(
      'create policy "Global item relations are public-read" on %I for select using (is_global_item(item_id));',
      t
    );
    execute format(
      'create policy "Campaign members can view their campaign''s custom item relations" on %I for select using (is_campaign_member_for_item(item_id));',
      t
    );
    execute format(
      'create policy "GM manages their campaign''s custom item relations" on %I for all using (is_campaign_gm_for_item(item_id)) with check (is_campaign_gm_for_item(item_id));',
      t
    );
  end loop;
end $$;
