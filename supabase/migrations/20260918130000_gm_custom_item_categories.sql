-- [[Feature - GM Custom - Item Category]]: lets a GM add custom Item categories scoped to their own
-- Campaign, alongside the global catalog -- same shape as every other "GM Custom X" sibling: one
-- shared table with a nullable campaign_id (null = global reference data, set = that Campaign's own
-- custom category). item_categories has no relation tables of its own (items_item_categories is a
-- child of items, already scoped in [[Feature - GM Custom - Items]]), so this is the simplest
-- migration in the family -- no helper functions, no relation-table RLS loop.

alter table item_categories add column campaign_id uuid references campaigns(id) on delete cascade;
create index on item_categories (campaign_id);

-- Replaces the flat unique(name) -- global names still can't collide with each other, but two
-- Campaigns (or a Campaign and the global catalog) can each freely have their own same-named custom
-- category.
alter table item_categories drop constraint item_categories_name_key;
create unique index item_categories_name_global_key on item_categories (name) where campaign_id is null;
create unique index item_categories_name_campaign_key on item_categories (campaign_id, name) where campaign_id is not null;

-- item_categories itself was covered by the generic "world-readable, service-role-only writes" loop
-- (20260724120000) -- no longer accurate now that a row can be Campaign-owned, so it's pulled out
-- into these bespoke policies instead: global rows stay public-read same as before, a Campaign's own
-- custom category is visible to that Campaign's GM + members only, and only that Campaign's GM can
-- write it.
drop policy "Public read access" on item_categories;

create policy "Global item categories are public-read" on item_categories
  for select using (campaign_id is null);

create policy "Campaign members can view their campaign's custom item categories" on item_categories
  for select using (campaign_id is not null and is_campaign_member(campaign_id));

create policy "GM manages their campaign's custom item categories" on item_categories
  for all using (campaign_id is not null and is_campaign_gm(campaign_id))
  with check (campaign_id is not null and is_campaign_gm(campaign_id));
