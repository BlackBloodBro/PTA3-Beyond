-- [[Feature - Allow a GM to change Loyalty settings]]: lets a GM retune, per Campaign, how much LP
-- each Loyalty tier needs and how much LP each automated event grants -- without touching the shared
-- global `loyalties`/`loyalty_point_events` tables every other Campaign also reads.
--
-- An override, not a mutation of the shared rows -- same reasoning as
-- [[Feature - GM can restrict global catalog entries from a Campaign]]'s exclusion table: editing the
-- global row directly would silently retune every Campaign at once. NULL-per-row-absent means "not
-- touched, keep using the global default" -- a Campaign that never opens these settings behaves
-- exactly as it does today, no seeding required.
create table campaign_loyalty_tier_overrides (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  loyalty_id int not null references loyalties(id) on delete cascade,
  min_points int not null,
  primary key (campaign_id, loyalty_id)
);

create table campaign_loyalty_event_overrides (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  event_id int not null references loyalty_point_events(id) on delete cascade,
  points int not null,
  primary key (campaign_id, event_id)
);

alter table campaign_loyalty_tier_overrides enable row level security;
alter table campaign_loyalty_event_overrides enable row level security;

-- Same RLS shape as campaign_excluded_pokedex: every Campaign member needs read access to compute the
-- effective tiers/events (Level and LP-grant math run in the viewer's own session, not just the GM's),
-- write stays GM-only.
create policy "Campaign members can view their campaign's loyalty tier overrides" on campaign_loyalty_tier_overrides
  for select using (is_campaign_member(campaign_id));

create policy "GM manages their campaign's loyalty tier overrides" on campaign_loyalty_tier_overrides
  for all using (is_campaign_gm(campaign_id))
  with check (is_campaign_gm(campaign_id));

create policy "Campaign members can view their campaign's loyalty event overrides" on campaign_loyalty_event_overrides
  for select using (is_campaign_member(campaign_id));

create policy "GM manages their campaign's loyalty event overrides" on campaign_loyalty_event_overrides
  for all using (is_campaign_gm(campaign_id))
  with check (is_campaign_gm(campaign_id));
