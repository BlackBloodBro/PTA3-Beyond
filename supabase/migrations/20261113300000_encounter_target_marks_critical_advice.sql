-- [[Feature - Mark a target for Critical advice in Encounters (Researcher)]]: a mark on a combatant for the rest of the
-- Encounter. Critical advice (Researcher, 3/rest, a free action) marks one target; every attack by the Researcher, an
-- allied Trainer or an allied Pokemon against a marked target is a critical hit on a natural 18-20 instead of only 20.
--
-- One row per mark (kind names the Feature, so other marks can reuse the table). A target can only carry one mark of a
-- kind: marking it again would just waste a use, so it is refused. Rows cascade away with the target combatant (or the
-- Encounter), and "Reset to draft" clears them in the app.
create table encounter_target_marks (
  id uuid primary key default gen_random_uuid(),
  target_combatant_id uuid not null references encounter_combatants(id) on delete cascade,
  kind text not null check (kind in ('critical_advice')),
  marked_by_trainer_id uuid references trainers(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (target_combatant_id, kind)
);

alter table encounter_target_marks enable row level security;

-- Readable by the GM and, while the Encounter is active, by any Campaign member (the same reach as the combatants). No
-- member write policy: a member only ever writes through use_critical_advice().
create policy "View encounter target marks" on encounter_target_marks
  for select using (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.id = encounter_target_marks.target_combatant_id
        and (is_campaign_gm(e.campaign_id) or (e.status = 'active' and is_campaign_member(e.campaign_id)))
    )
  );

create policy "GM manages encounter target marks" on encounter_target_marks
  for all using (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.id = encounter_target_marks.target_combatant_id and is_campaign_gm(e.campaign_id)
    )
  ) with check (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.id = encounter_target_marks.target_combatant_id and is_campaign_gm(e.campaign_id)
    )
  );

-- Using Critical advice: mark any combatant of the Encounter and spend one of the Trainer's 3 uses, atomically.
-- SECURITY DEFINER because a member can't write another combatant's rows; it re-checks everything itself (same pattern as
-- use_intimidate / skip_my_turn / resolve_catch_attempt). A free action: it does not touch the turn.
create or replace function use_critical_advice(
  target_encounter_id uuid,
  acting_trainer_id uuid,
  target_combatant_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_status text;
  v_is_gm boolean;
  v_class_id int;
  v_level int;
  v_feature_id int;
  v_max_uses int;
  v_remaining int;
begin
  select campaign_id, status into v_campaign_id, v_status from encounters where id = target_encounter_id;
  if v_campaign_id is null then
    raise exception 'Encounter not found';
  end if;

  v_is_gm := is_campaign_gm(v_campaign_id);
  if not v_is_gm and not is_campaign_member(v_campaign_id) then
    raise exception 'Not a member of this campaign';
  end if;

  if v_status <> 'active' then
    raise exception 'Encounter is not active';
  end if;

  select t.class_id, t.level into v_class_id, v_level
  from trainers t
  where t.id = acting_trainer_id and (v_is_gm or t.user_id = auth.uid());
  if v_class_id is null then
    raise exception 'You can only use Critical advice with your own Trainer';
  end if;

  if not exists (select 1 from encounter_combatants ec where ec.encounter_id = target_encounter_id and ec.trainer_id = acting_trainer_id) then
    raise exception 'That Trainer is not in this encounter';
  end if;

  if not exists (select 1 from encounter_combatants ec where ec.id = target_combatant_id and ec.encounter_id = target_encounter_id) then
    raise exception 'That target is not in this encounter';
  end if;

  if exists (select 1 from encounter_target_marks m where m.target_combatant_id = use_critical_advice.target_combatant_id and m.kind = 'critical_advice') then
    raise exception 'That target is already marked';
  end if;

  -- The Trainer must actually have the base Class Feature (same resolution as trainerHasBaseClassFeature).
  select f.id, f.max_uses into v_feature_id, v_max_uses
  from features f
  where f.name = 'Critical advice' and f.class_id = v_class_id and f.subclass_id is null and f.level_required <= v_level;
  if v_feature_id is null then
    raise exception 'This Trainer does not have Critical advice';
  end if;

  -- No trainer_feature_uses row means "all uses left" (a Sleep deletes the row to recharge it).
  select uses_remaining into v_remaining
  from trainer_feature_uses where trainer_id = acting_trainer_id and feature_id = v_feature_id;
  v_remaining := coalesce(v_remaining, v_max_uses);
  if v_remaining is null or v_remaining < 1 then
    raise exception 'No Critical advice uses left';
  end if;

  insert into trainer_feature_uses (trainer_id, feature_id, uses_remaining)
  values (acting_trainer_id, v_feature_id, v_remaining - 1)
  on conflict (trainer_id, feature_id) do update set uses_remaining = excluded.uses_remaining;

  insert into encounter_target_marks (target_combatant_id, kind, marked_by_trainer_id)
  values (use_critical_advice.target_combatant_id, 'critical_advice', acting_trainer_id);
end;
$$;

grant execute on function use_critical_advice(uuid, uuid, uuid) to authenticated;
