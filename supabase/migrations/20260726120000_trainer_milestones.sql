-- Audit trail for milestone level-ups (subclass choice + 2-stat increase + flat HP gain), so that
-- leveling a trainer back down below a milestone can precisely undo exactly what that milestone
-- granted -- without this, there'd be no way to know *which* 2 stats (of potentially many by then)
-- came from which milestone, since stat values are just plain running totals with no history.
create table trainer_milestones (
  trainer_id uuid not null references trainers(id) on delete cascade,
  level int not null,
  subclass_id int not null references subclasses(id),
  stat_a text not null check (stat_a in ('attack', 'defense', 'special_attack', 'special_defense', 'speed')),
  stat_b text not null check (stat_b in ('attack', 'defense', 'special_attack', 'special_defense', 'speed')),
  hp_gain int not null,
  primary key (trainer_id, level)
);

alter table trainer_milestones enable row level security;

create policy "Owner manages trainer_milestones" on trainer_milestones
  for all using (
    exists (select 1 from trainers t where t.id = trainer_milestones.trainer_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from trainers t where t.id = trainer_milestones.trainer_id and t.user_id = auth.uid())
  );

create policy "GM manages campaign trainer_milestones" on trainer_milestones
  for all using (is_campaign_gm_for_trainer(trainer_id)) with check (is_campaign_gm_for_trainer(trainer_id));
