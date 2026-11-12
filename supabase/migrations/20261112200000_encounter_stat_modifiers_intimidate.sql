-- [[Feature - Apply Intimidate's stat penalty in Encounters (Ace trainer)]]: temporary, Encounter-scoped stat
-- modifiers on a combatant -- the first thing in the app that can hold "Attack -2 for the rest of the encounter".
--
-- Shared with [[Feature - Apply Press's stat boost, damage and loyalty cost in Encounters (Ace trainer)]], which will
-- write +2 on all five stats: one row per use (so stacking is just more rows), `source` names the Feature.
-- Rows cascade away with their combatant (or the Encounter), and "Reset to draft" clears them in the app.
create table encounter_combatant_stat_modifiers (
  id uuid primary key default gen_random_uuid(),
  combatant_id uuid not null references encounter_combatants(id) on delete cascade,
  stat text not null check (stat in ('attack', 'defense', 'special_attack', 'special_defense', 'speed')),
  amount int not null,
  source text not null,
  created_at timestamptz not null default now()
);

create index on encounter_combatant_stat_modifiers (combatant_id);

alter table encounter_combatant_stat_modifiers enable row level security;

-- Readable by the GM and, while the Encounter is active, by any Campaign member (the same reach as the combatants
-- themselves). No member write policy: a member only ever writes through the functions below.
create policy "View encounter stat modifiers" on encounter_combatant_stat_modifiers
  for select using (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.id = encounter_combatant_stat_modifiers.combatant_id
        and (is_campaign_gm(e.campaign_id) or (e.status = 'active' and is_campaign_member(e.campaign_id)))
    )
  );

create policy "GM manages encounter stat modifiers" on encounter_combatant_stat_modifiers
  for all using (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.id = encounter_combatant_stat_modifiers.combatant_id and is_campaign_gm(e.campaign_id)
    )
  ) with check (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.id = encounter_combatant_stat_modifiers.combatant_id and is_campaign_gm(e.campaign_id)
    )
  );

-- Using Intimidate: -2 to a target Pokemon's Attack or Special Attack for the rest of the encounter, stacking, and
-- one of the Trainer's 3 uses spent -- all in one atomic call. SECURITY DEFINER because a member has no right to write
-- another combatant's rows; it re-checks everything itself (same pattern as skip_my_turn / resolve_catch_attempt).
-- A plain Feature use: it does not touch the turn.
create or replace function use_intimidate(
  target_encounter_id uuid,
  acting_trainer_id uuid,
  target_combatant_id uuid,
  target_stat text
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
  if target_stat not in ('attack', 'special_attack') then
    raise exception 'Intimidate lowers Attack or Special Attack';
  end if;

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
    raise exception 'You can only use Intimidate with your own Trainer';
  end if;

  if not exists (select 1 from encounter_combatants ec where ec.encounter_id = target_encounter_id and ec.trainer_id = acting_trainer_id) then
    raise exception 'That Trainer is not in this encounter';
  end if;

  if not exists (
    select 1 from encounter_combatants ec
    where ec.id = target_combatant_id and ec.encounter_id = target_encounter_id and ec.pokemon_id is not null
  ) then
    raise exception 'Intimidate needs a Pokemon in this encounter as its target';
  end if;

  -- The Trainer must actually have the base Class Feature (same resolution as trainerHasBaseClassFeature).
  select f.id, f.max_uses into v_feature_id, v_max_uses
  from features f
  where f.name = 'Intimidate' and f.class_id = v_class_id and f.subclass_id is null and f.level_required <= v_level;
  if v_feature_id is null then
    raise exception 'This Trainer does not have Intimidate';
  end if;

  -- No trainer_feature_uses row means "all uses left" (a Sleep deletes the row to recharge it).
  select uses_remaining into v_remaining
  from trainer_feature_uses where trainer_id = acting_trainer_id and feature_id = v_feature_id;
  v_remaining := coalesce(v_remaining, v_max_uses);
  if v_remaining is null or v_remaining < 1 then
    raise exception 'No Intimidate uses left';
  end if;

  insert into trainer_feature_uses (trainer_id, feature_id, uses_remaining)
  values (acting_trainer_id, v_feature_id, v_remaining - 1)
  on conflict (trainer_id, feature_id) do update set uses_remaining = excluded.uses_remaining;

  insert into encounter_combatant_stat_modifiers (combatant_id, stat, amount, source)
  values (target_combatant_id, target_stat, -2, 'Intimidate');
end;
$$;

grant execute on function use_intimidate(uuid, uuid, uuid, text) to authenticated;
