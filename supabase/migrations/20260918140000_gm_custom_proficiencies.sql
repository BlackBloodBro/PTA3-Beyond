-- [[Feature - GM Custom - Proficiency]]: lets a GM add custom Proficiencies scoped to their own
-- Campaign, alongside the global catalog -- same shape as every other "GM Custom X" sibling: one
-- shared table with a nullable campaign_id (null = global reference data, set = that Campaign's own
-- custom Proficiency). proficiencies has no relation tables of its own to update here --
-- pokedex_proficiencies/moves_proficiencies are children of pokedex/moves, already scoped off their
-- own parent's campaign_id in [[Feature - GM Custom - Pokemon]]/[[Feature - GM Custom - Moves]].

alter table proficiencies add column campaign_id uuid references campaigns(id) on delete cascade;
create index on proficiencies (campaign_id);

-- Replaces the flat unique(name) -- global names still can't collide with each other, but two
-- Campaigns (or a Campaign and the global catalog) can each freely have their own same-named custom
-- Proficiency.
alter table proficiencies drop constraint proficiencies_name_key;
create unique index proficiencies_name_global_key on proficiencies (name) where campaign_id is null;
create unique index proficiencies_name_campaign_key on proficiencies (campaign_id, name) where campaign_id is not null;

-- proficiencies itself was covered by the generic "world-readable, service-role-only writes" loop
-- (20260724120000) -- no longer accurate now that a row can be Campaign-owned, so it's pulled out
-- into these bespoke policies instead: global rows stay public-read same as before, a Campaign's own
-- custom Proficiency is visible to that Campaign's GM + members only, and only that Campaign's GM can
-- write it.
drop policy "Public read access" on proficiencies;

create policy "Global proficiencies are public-read" on proficiencies
  for select using (campaign_id is null);

create policy "Campaign members can view their campaign's custom proficiencies" on proficiencies
  for select using (campaign_id is not null and is_campaign_member(campaign_id));

create policy "GM manages their campaign's custom proficiencies" on proficiencies
  for all using (campaign_id is not null and is_campaign_gm(campaign_id))
  with check (campaign_id is not null and is_campaign_gm(campaign_id));
