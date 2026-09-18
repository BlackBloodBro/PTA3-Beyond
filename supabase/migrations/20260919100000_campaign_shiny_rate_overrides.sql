-- [[Feature - Let a GM customize their Campaign's shiny rate]]: a single tunable value (a shiny
-- denominator, "1 in N") rather than a multi-row reference table like exp_grant_events/level_bands --
-- still kept as data rather than a code constant so a GM's override reads through the exact same
-- resolver shape as every other Customization setting. Singleton row enforced via a boolean primary key
-- that can only ever be `true`.
create table shiny_rate_settings (
  id boolean primary key default true,
  denominator int not null,
  constraint shiny_rate_settings_is_singleton check (id)
);

insert into shiny_rate_settings (denominator) values (250);

alter table shiny_rate_settings enable row level security;
create policy "Public read access" on shiny_rate_settings for select using (true);

-- Same override-table shape as every other Customization setting -- row-absent means "not touched, keep
-- using the global default."
create table campaign_shiny_rate_overrides (
  campaign_id uuid primary key references campaigns(id) on delete cascade,
  denominator int not null
);

alter table campaign_shiny_rate_overrides enable row level security;

create policy "Campaign members can view their campaign's shiny rate override" on campaign_shiny_rate_overrides
  for select using (is_campaign_member(campaign_id));

create policy "GM manages their campaign's shiny rate override" on campaign_shiny_rate_overrides
  for all using (is_campaign_gm(campaign_id))
  with check (is_campaign_gm(campaign_id));
