-- [[Feature - Apply Press's stat boost, damage and loyalty cost in Encounters (Ace trainer)]]: Press pushes one of the
-- Trainer's own Pokemon harder -- +2 to all five stats for the rest of the encounter (stacking), the Pokemon takes some
-- damage, and repeated use costs it Loyalty.
--
-- The stat boost reuses the Encounter stat-modifier store Intimidate created (one row per stat per use, source 'Press').
-- The damage is applied by the app through the normal HP path (so Temp HP and the "Fainted" triggers behave as always);
-- everything else happens here in one atomic call, because a member can't write another combatant's rows or a Pokemon's
-- loyalty directly.

-- The Loyalty cost per *additional* use. Use n of Press on a Pokemon in an Encounter costs (n - 1) times this, so the
-- first use is free: 0, -1, -2, ... GM-adjustable per Campaign in the existing Loyalty settings (0 switches it off).
insert into grant_events (name, exp, loyalty_points) values ('Press', 0, -1);

create or replace function use_press(
  target_encounter_id uuid,
  acting_trainer_id uuid,
  target_combatant_id uuid
)
returns jsonb
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
  v_pokemon_id uuid;
  v_feature_id int;
  v_previous_uses int;
  v_per_use int;
  v_cost int;
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
    raise exception 'You can only use Press with your own Trainer';
  end if;

  if not exists (select 1 from encounter_combatants ec where ec.encounter_id = target_encounter_id and ec.trainer_id = acting_trainer_id) then
    raise exception 'That Trainer is not in this encounter';
  end if;

  -- The target must be a Pokemon combatant of this encounter that this very Trainer owns.
  select ec.pokemon_id into v_pokemon_id
  from encounter_combatants ec
  join trainers_pokemon tp on tp.pokemon_id = ec.pokemon_id and tp.trainer_id = acting_trainer_id
  where ec.id = target_combatant_id and ec.encounter_id = target_encounter_id;
  if v_pokemon_id is null then
    raise exception 'Press needs one of this Trainer''s own Pokemon in this encounter';
  end if;

  -- The Trainer must actually have the base Class Feature (same resolution as trainerHasBaseClassFeature).
  select f.id into v_feature_id
  from features f
  where f.name = 'Press' and f.class_id = v_class_id and f.subclass_id is null and f.level_required <= v_level;
  if v_feature_id is null then
    raise exception 'This Trainer does not have Press';
  end if;

  -- Uses so far on this Pokemon in this encounter: one Attack row per use (every use writes all five stats).
  select count(*) into v_previous_uses
  from encounter_combatant_stat_modifiers m
  where m.combatant_id = target_combatant_id and m.source = 'Press' and m.stat = 'attack';

  insert into encounter_combatant_stat_modifiers (combatant_id, stat, amount, source)
  select target_combatant_id, s, 2, 'Press'
  from unnest(array['attack', 'defense', 'special_attack', 'special_defense', 'speed']) as s;

  -- The effective per-use Loyalty amount: the Campaign's override when it has one, else the global default.
  select coalesce(o.loyalty_points, g.loyalty_points) into v_per_use
  from grant_events g
  left join campaign_grant_event_loyalty_overrides o on o.event_id = g.id and o.campaign_id = v_campaign_id
  where g.name = 'Press';
  v_cost := v_previous_uses * coalesce(v_per_use, 0);

  if v_cost <> 0 then
    update pokemon set loyalty_points = greatest(0, loyalty_points + v_cost) where id = v_pokemon_id;
  end if;

  return jsonb_build_object('pokemonId', v_pokemon_id, 'useNumber', v_previous_uses + 1, 'loyaltyChange', v_cost);
end;
$$;

grant execute on function use_press(uuid, uuid, uuid) to authenticated;
