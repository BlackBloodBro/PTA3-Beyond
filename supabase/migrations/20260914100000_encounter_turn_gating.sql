-- [[Feature - Only active player on initiative tracker can do an action]]: the one piece of this FR
-- that's a genuinely new capability rather than an app-level restriction (Attack Resolver's Attacker
-- dropdown and Trainer Actions' "Use" buttons are gated purely in app code, matching this codebase's
-- existing trust model for turn-order etiquette). Advancing `current_turn_position` has only ever been
-- GM-exclusive (see "GM manages campaign encounters" in 20260907100000_combat_encounters.sql) -- a
-- player skipping *their own* turn is real new access, so it gets a real access-control mechanism
-- rather than just an app-code check a rogue request could bypass.
--
-- "Whose turn is it" has never been a stored/SQL-checkable value, only the app's own derivation
-- (activeSorted = non-down combatants with a turn_order, sorted by turn_order desc, indexed modulo its
-- length by current_turn_position -- see page.tsx). This function re-derives that identically in SQL,
-- then only advances the turn if the resulting combatant is one the caller owns (reusing
-- owns_encounter_combatant_target, the same helper self-service join/leave/recall already rely on).
create or replace function skip_my_turn(target_encounter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_status text;
  v_position int;
  v_active_count int;
  v_current_trainer_id uuid;
  v_current_pokemon_id uuid;
begin
  select campaign_id, status, current_turn_position
    into v_campaign_id, v_status, v_position
    from encounters
    where id = target_encounter_id;

  if v_campaign_id is null then
    raise exception 'Encounter not found';
  end if;

  if not is_campaign_member(v_campaign_id) then
    raise exception 'Not a member of this campaign';
  end if;

  if v_status <> 'active' then
    raise exception 'Encounter is not active';
  end if;

  -- Mirrors combatantIsDown (hp <= 0) and activeSorted's own filter/sort in page.tsx exactly --
  -- exactly one of t/p is ever non-null per encounter_combatants' own xor check, so coalesce always
  -- resolves to the right side's current_hp.
  select count(*) into v_active_count
  from encounter_combatants ec
  left join trainers t on t.id = ec.trainer_id
  left join pokemon p on p.id = ec.pokemon_id
  where ec.encounter_id = target_encounter_id
    and ec.turn_order is not null
    and coalesce(t.current_hp, p.current_hp, 0) > 0;

  if v_active_count = 0 then
    raise exception 'No active combatant -- nothing to skip';
  end if;

  select ranked.trainer_id, ranked.pokemon_id
    into v_current_trainer_id, v_current_pokemon_id
  from (
    select ec.trainer_id, ec.pokemon_id, row_number() over (order by ec.turn_order desc) - 1 as rn
    from encounter_combatants ec
    left join trainers t on t.id = ec.trainer_id
    left join pokemon p on p.id = ec.pokemon_id
    where ec.encounter_id = target_encounter_id
      and ec.turn_order is not null
      and coalesce(t.current_hp, p.current_hp, 0) > 0
  ) ranked
  where ranked.rn = v_position % v_active_count;

  if not owns_encounter_combatant_target(v_current_trainer_id, v_current_pokemon_id) then
    raise exception 'It is not your turn';
  end if;

  update encounters set current_turn_position = v_position + 1 where id = target_encounter_id;
end;
$$;

grant execute on function skip_my_turn(uuid) to authenticated;
