-- [[Feature - Create Pokemon catching mechanic]]: catching a wild Pokemon inside an active Encounter.
--
-- 1. encounters.catch_battle_start_id: the "how did this fight start" catch modifier (ambushed / Pokemon
--    initiated / knew they were there), set once on the Encounter by the GM instead of being asked on every
--    throw. Default 2 = "Pokemon initiated combat" (0 modifier), the seeded neutral row.
-- 2. encounter_wild_combatant_ids(): which of an Encounter's combatants can actually be caught -- enemy-side
--    Pokemon with no trainers_pokemon row. SECURITY DEFINER because a Campaign member can't see every
--    trainers_pokemon row (an NPC's Pokemon would otherwise look "unowned" to them).
-- 3. resolve_catch_attempt(): the privileged half of a throw, in one atomic call. A member has no right to
--    delete an enemy combatant or move the turn counter, so (like skip_my_turn) this runs as definer and
--    re-checks who may act. The *odds and the roll* are computed in the app (the player rolls physical dice,
--    same trust model as every other typed-in roll); this only applies the outcome: consumes the Ball, and on
--    a catch adds the Pokemon to the thrower's roster (first open Team slot, else the PC) as "Caught", removes
--    it from the Encounter, and advances the turn without skipping anyone.
alter table encounters
  add column catch_battle_start_id int references catch_modifiers_battle_start(id) default 2;

create or replace function encounter_wild_combatant_ids(target_encounter_id uuid)
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select ec.id
  from encounter_combatants ec
  join encounters e on e.id = ec.encounter_id
  where ec.encounter_id = target_encounter_id
    and (is_campaign_gm(e.campaign_id) or is_campaign_member(e.campaign_id))
    and ec.side = 'enemy'
    and ec.pokemon_id is not null
    and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = ec.pokemon_id);
$$;

create or replace function resolve_catch_attempt(
  target_encounter_id uuid,
  target_combatant_id uuid,
  acting_trainer_id uuid,
  acting_trainers_item_id uuid,
  caught boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_status text;
  v_position int;
  v_is_gm boolean;
  v_pokemon_id uuid;
  v_item_id int;
  v_quantity int;
  v_active_count int;
  v_current_id uuid;
  v_current_trainer uuid;
  v_current_idx int;
  v_advance boolean;
  v_pointer_id uuid;
  v_slot int;
  v_after_count int;
  v_pointer_idx int;
  v_next_position int;
begin
  select campaign_id, status, current_turn_position
    into v_campaign_id, v_status, v_position
    from encounters
    where id = target_encounter_id;

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

  if not exists (
    select 1 from trainers t
    where t.id = acting_trainer_id and (v_is_gm or t.user_id = auth.uid())
  ) then
    raise exception 'You can only throw a Ball with your own Trainer';
  end if;

  if not exists (select 1 from encounter_wild_combatant_ids(target_encounter_id) w where w = target_combatant_id) then
    raise exception 'That Pokemon cannot be caught (it is not a wild enemy in this encounter)';
  end if;

  select ti.item_id, ti.quantity into v_item_id, v_quantity
    from trainers_items ti
    where ti.id = acting_trainers_item_id and ti.trainer_id = acting_trainer_id;

  if v_item_id is null or v_quantity < 1 then
    raise exception 'That Ball is not in this Trainer''s bag';
  end if;

  if not exists (select 1 from pokeball_catch_modifiers where item_id = v_item_id) then
    raise exception 'That item is not a Poke Ball that can be thrown';
  end if;

  select ec.pokemon_id into v_pokemon_id from encounter_combatants ec where ec.id = target_combatant_id;

  -- Whose turn is it right now? Same ranking skip_my_turn() uses (turn_order desc, id tie-break; combatants
  -- at 0 HP or with no initiative are skipped).
  select count(*) into v_active_count
  from encounter_combatants ec
  left join trainers t on t.id = ec.trainer_id
  left join pokemon p on p.id = ec.pokemon_id
  where ec.encounter_id = target_encounter_id
    and ec.turn_order is not null
    and coalesce(t.current_hp, p.current_hp, 0) > 0;

  v_current_id := null;
  v_current_trainer := null;
  v_current_idx := null;
  if v_active_count > 0 then
    v_current_idx := v_position % v_active_count;
    select ranked.id, ranked.trainer_id into v_current_id, v_current_trainer
    from (
      select ec.id, ec.trainer_id, row_number() over (order by ec.turn_order desc, ec.id) - 1 as rn
      from encounter_combatants ec
      left join trainers t on t.id = ec.trainer_id
      left join pokemon p on p.id = ec.pokemon_id
      where ec.encounter_id = target_encounter_id
        and ec.turn_order is not null
        and coalesce(t.current_hp, p.current_hp, 0) > 0
    ) ranked
    where ranked.rn = v_current_idx;
  end if;

  -- A member may only throw on their own Trainer's turn; the GM may act out of turn (matching the other
  -- GM-exempt Trainer actions). The turn only advances when the thrower really is the current combatant.
  if not v_is_gm and v_current_trainer is distinct from acting_trainer_id then
    raise exception 'It is not your turn';
  end if;
  v_advance := v_current_trainer is not distinct from acting_trainer_id and v_current_trainer is not null;

  -- The Ball is consumed whether or not it catches.
  if v_quantity > 1 then
    update trainers_items set quantity = quantity - 1 where id = acting_trainers_item_id;
  else
    delete from trainers_items where id = acting_trainers_item_id;
  end if;

  if not caught then
    if v_advance then
      update encounters set current_turn_position = v_position + 1 where id = target_encounter_id;
    end if;
    return;
  end if;

  -- Work out who should be current once the caught Pokemon is gone, *before* deleting it: the turn counter
  -- is taken modulo the active list, so removing someone would otherwise shift whose turn it is.
  if v_active_count > 0 then
    select ranked.id into v_pointer_id
    from (
      select ec.id, row_number() over (order by ec.turn_order desc, ec.id) - 1 as rn
      from encounter_combatants ec
      left join trainers t on t.id = ec.trainer_id
      left join pokemon p on p.id = ec.pokemon_id
      where ec.encounter_id = target_encounter_id
        and ec.turn_order is not null
        and coalesce(t.current_hp, p.current_hp, 0) > 0
    ) ranked
    where ranked.id <> target_combatant_id
      and (
        -- the combatant who should go next (the thrower's turn is ending), or whoever is current if the
        -- thrower is not the current combatant and nothing is meant to advance
        (v_advance or v_current_id = target_combatant_id)
        or ranked.id = v_current_id
      )
    order by
      case
        when (v_advance or v_current_id = target_combatant_id)
          then (case when ranked.rn = v_current_idx then v_active_count else (ranked.rn - v_current_idx + v_active_count) % v_active_count end)
        else 0
      end
    limit 1;
  end if;

  select min(s) into v_slot
  from generate_series(1, 6) s
  where not exists (select 1 from trainers_pokemon tp where tp.trainer_id = acting_trainer_id and tp.party_slot = s);

  insert into trainers_pokemon (trainer_id, pokemon_id, party_slot)
  values (acting_trainer_id, v_pokemon_id, v_slot);

  update pokemon
  set original_trainer_id = acting_trainer_id,
      original_obtain_method_id = (select id from obtain_methods where name = 'Caught')
  where id = v_pokemon_id and original_trainer_id is null;

  delete from encounter_combatants where id = target_combatant_id;

  if v_pointer_id is null then
    update encounters set current_turn_position = v_position + (case when v_advance then 1 else 0 end)
      where id = target_encounter_id;
    return;
  end if;

  select count(*) into v_after_count
  from encounter_combatants ec
  left join trainers t on t.id = ec.trainer_id
  left join pokemon p on p.id = ec.pokemon_id
  where ec.encounter_id = target_encounter_id
    and ec.turn_order is not null
    and coalesce(t.current_hp, p.current_hp, 0) > 0;

  if v_after_count = 0 then
    update encounters set current_turn_position = v_position + 1 where id = target_encounter_id;
    return;
  end if;

  select ranked.rn into v_pointer_idx
  from (
    select ec.id, row_number() over (order by ec.turn_order desc, ec.id) - 1 as rn
    from encounter_combatants ec
    left join trainers t on t.id = ec.trainer_id
    left join pokemon p on p.id = ec.pokemon_id
    where ec.encounter_id = target_encounter_id
      and ec.turn_order is not null
      and coalesce(t.current_hp, p.current_hp, 0) > 0
  ) ranked
  where ranked.id = v_pointer_id;

  -- Smallest counter value at or above where it would have gone (never backwards, so the per-turn EXP
  -- dedupe keyed on current_turn_position stays valid) that lands on the pointer combatant.
  v_next_position := v_position + (case when v_advance then 1 else 0 end);
  v_next_position := v_next_position + (((v_pointer_idx - v_next_position) % v_after_count) + v_after_count) % v_after_count;
  update encounters set current_turn_position = v_next_position where id = target_encounter_id;
end;
$$;

grant execute on function encounter_wild_combatant_ids(uuid) to authenticated;
grant execute on function resolve_catch_attempt(uuid, uuid, uuid, uuid, boolean) to authenticated;
