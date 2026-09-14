-- Bug fix (2026-09-14): skip_my_turn() (from [[Feature - Only active player on initiative tracker can
-- do an action]]) re-derives "whose turn is it" independently in SQL, ranking active combatants by
-- `row_number() over (order by turn_order desc)`. A tied turn_order -- confirmed to actually occur in
-- real play (multiple combatants rolling/computing the same value) -- breaks arbitrarily under Postgres
-- with no secondary sort key, with no guarantee of agreeing with page.tsx's own client-side ranking
-- (which has the identical problem, fixed alongside this migration by adding the same `id` tiebreak to
-- its own sort). Root-caused as the actual cause of a real player's "It is not your turn" firing on
-- what the page showed as their own turn. Re-creates skip_my_turn() with `order by turn_order desc, id`
-- so both sides break ties the same deterministic way.
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
    select ec.trainer_id, ec.pokemon_id, row_number() over (order by ec.turn_order desc, ec.id) - 1 as rn
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
