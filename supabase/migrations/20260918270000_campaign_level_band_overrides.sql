-- [[Feature - Let a GM customize EXP needed per level band]]: the `levels` table (100 rows,
-- level_number 1-100) isn't arbitrary per row -- confirmed directly against the live data that the
-- EXP-per-level-up cost is constant within each band of 10 levels and steps up by exactly 1 per band
-- (band 1 = levels 1-10 costs 1/level, ..., band 10 = levels 91-100 costs 10/level). Rather than a
-- 100-row per-Campaign override (a much bigger UI than any other Customization setting), a GM tunes
-- just the 10 band deltas; the full 100-row curve is derived from those by formula at read time.
create table level_bands (
  band int primary key,
  exp_per_level int not null
);

insert into level_bands (band, exp_per_level) values
  (1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6), (7, 7), (8, 8), (9, 9), (10, 10);

alter table level_bands enable row level security;
create policy "Public read access" on level_bands for select using (true);

-- Same override-table shape as every other Customization setting shipped this session -- NULL-per-row-
-- absent means "not touched, keep using the global default."
create table campaign_level_band_overrides (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  band int not null references level_bands(band) on delete cascade,
  exp_per_level int not null,
  primary key (campaign_id, band)
);

alter table campaign_level_band_overrides enable row level security;

create policy "Campaign members can view their campaign's level band overrides" on campaign_level_band_overrides
  for select using (is_campaign_member(campaign_id));

create policy "GM manages their campaign's level band overrides" on campaign_level_band_overrides
  for all using (is_campaign_gm(campaign_id))
  with check (is_campaign_gm(campaign_id));
