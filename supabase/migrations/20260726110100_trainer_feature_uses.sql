-- Active-data tracker for how many uses a trainer has left on an activatable feature, mirroring
-- trainer_moves' uses_remaining/resets_on shape. Only meaningful for features where
-- features.max_uses is set; a row here is created lazily (on first use) rather than pre-seeded
-- for every trainer x feature combination.
create table trainer_feature_uses (
  trainer_id uuid not null references trainers(id) on delete cascade,
  feature_id int not null references features(id) on delete cascade,
  uses_remaining int not null,
  primary key (trainer_id, feature_id)
);

create index on trainer_feature_uses (feature_id);

alter table trainer_feature_uses enable row level security;

-- Same owner-or-campaign-GM manage pattern as trainer_moves/trainers_items (gm_campaign_rls.sql) --
-- a GM tracking a player's ability uses during a session is the same use case that motivated that
-- earlier RLS expansion.
create policy "Owner manages trainer_feature_uses" on trainer_feature_uses
  for all using (
    exists (select 1 from trainers t where t.id = trainer_feature_uses.trainer_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from trainers t where t.id = trainer_feature_uses.trainer_id and t.user_id = auth.uid())
  );

create policy "GM manages campaign trainer_feature_uses" on trainer_feature_uses
  for all using (is_campaign_gm_for_trainer(trainer_id)) with check (is_campaign_gm_for_trainer(trainer_id));
