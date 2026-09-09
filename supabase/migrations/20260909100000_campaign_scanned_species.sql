-- [[Feature - Reveal opponent Pokemon without scanning on Walking encyclopedia (Researcher)]]: a new
-- restriction invented from scratch (every species field is unconditional public-read reference data
-- today, per this FR's own audit) -- the presence of a row here is what "using a Pokedex" on a species
-- means: per-Campaign, per-species, permanent, shared by the whole party (not per-Trainer, not
-- per-encounter), matching mainline Pokedex's own "seen" concept.
create table campaign_scanned_species (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  pokedex_id int not null references pokedex(id) on delete cascade,
  primary key (campaign_id, pokedex_id)
);

alter table campaign_scanned_species enable row level security;

-- "Using a Pokedex" is a plain, no-cost action any player in the encounter can take (per the FR's own
-- Design notes -- this app doesn't simulate turn-by-turn action economy) -- any campaign member can both
-- see what's already scanned and add a new scan, not just the GM.
create policy "Campaign members can view scanned species" on campaign_scanned_species
  for select using (is_campaign_member(campaign_id));

create policy "Campaign members can scan species" on campaign_scanned_species
  for insert with check (is_campaign_member(campaign_id));
