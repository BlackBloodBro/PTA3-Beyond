-- [[Feature - Let the GM approve EXP and LP gained in an Encounter]]: while a Pokemon is a combatant in an *active*
-- Encounter, the "Move used" and "Fainted" grants no longer change its EXP/LP straight away. They're added to a
-- per-Encounter, per-Pokemon pending total instead, which only the GM sees and approves (editable, per Pokemon or all
-- at once). Outside an active Encounter -- and for Sleep, Pokemon Center and Evolved -- grants apply immediately, as
-- before.
--
-- Purely additive (new table + functions), so it's safe against whatever code is live on `production`: the old code
-- simply never records anything here.

create table encounter_pending_grants (
  encounter_id uuid not null references encounters(id) on delete cascade,
  pokemon_id uuid not null references pokemon(id) on delete cascade,
  exp int not null default 0,
  loyalty_points int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (encounter_id, pokemon_id)
);

alter table encounter_pending_grants enable row level security;

-- GM only (per the user: players see no pending totals). Players' Move used / Fainted add to it through
-- record_encounter_pending_grant below, never directly. The GM may also delete rows (Reject, and Reset to draft).
create policy "GM can view their encounters' pending grants" on encounter_pending_grants
  for select using (is_campaign_gm_for_encounter(encounter_id));

create policy "GM can delete their encounters' pending grants" on encounter_pending_grants
  for delete using (is_campaign_gm_for_encounter(encounter_id));

-- Adds to the Pokemon's pending total if (and only if) it's a combatant in an active Encounter the caller can act in
-- (a member or the GM of its Campaign). Returns that Encounter's id, or null when there's no active Encounter -- the
-- caller then applies the grant immediately, as before.
create or replace function record_encounter_pending_grant(target_pokemon_id uuid, add_exp int, add_loyalty_points int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encounter_id uuid;
  v_campaign_id uuid;
begin
  select e.id, e.campaign_id into v_encounter_id, v_campaign_id
  from encounter_combatants ec
  join encounters e on e.id = ec.encounter_id
  where ec.pokemon_id = target_pokemon_id and e.status = 'active'
  order by e.started_at desc nulls last
  limit 1;

  if v_encounter_id is null then
    return null;
  end if;

  if not is_campaign_gm(v_campaign_id) and not is_campaign_member(v_campaign_id) then
    raise exception 'Not a member of this campaign';
  end if;

  insert into encounter_pending_grants (encounter_id, pokemon_id, exp, loyalty_points)
  values (v_encounter_id, target_pokemon_id, coalesce(add_exp, 0), coalesce(add_loyalty_points, 0))
  on conflict (encounter_id, pokemon_id) do update set
    exp = encounter_pending_grants.exp + excluded.exp,
    loyalty_points = encounter_pending_grants.loyalty_points + excluded.loyalty_points,
    updated_at = now();

  return v_encounter_id;
end;
$$;

grant execute on function record_encounter_pending_grant(uuid, int, int) to authenticated;

-- GM approves one Pokemon's pending line, with the (possibly edited) amounts. Applies them to the Pokemon (floored at
-- 0, same as every other grant) and clears the line, atomically. Works for any Pokemon in the Encounter -- a player's,
-- an NPC's or a wild one -- without depending on which UPDATE policy would otherwise cover it.
create or replace function approve_encounter_pending_grant(
  target_encounter_id uuid,
  target_pokemon_id uuid,
  approved_exp int,
  approved_loyalty_points int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_exp int;
  v_new_lp int;
begin
  if not is_campaign_gm_for_encounter(target_encounter_id) then
    raise exception 'Only the GM can approve EXP and LP';
  end if;

  if not exists (
    select 1 from encounter_pending_grants
    where encounter_id = target_encounter_id and pokemon_id = target_pokemon_id
    for update
  ) then
    raise exception 'Nothing pending for this Pokemon';
  end if;

  update pokemon set
    current_exp = greatest(0, current_exp + coalesce(approved_exp, 0)),
    loyalty_points = greatest(0, loyalty_points + coalesce(approved_loyalty_points, 0))
  where id = target_pokemon_id
  returning current_exp, loyalty_points into v_new_exp, v_new_lp;

  delete from encounter_pending_grants where encounter_id = target_encounter_id and pokemon_id = target_pokemon_id;

  return jsonb_build_object('currentExp', v_new_exp, 'loyaltyPoints', v_new_lp);
end;
$$;

grant execute on function approve_encounter_pending_grant(uuid, uuid, int, int) to authenticated;
