-- Bug fix (2026-09-14): a real, foundational access-control gap, present since attack resolution was
-- first built -- reported by the user as "so many issues" resolving a turn as a player (fine as GM).
--
-- adjustPokemonHp/adjustTrainerHp (app/(authenticated)/pokemon/actions.ts,
-- app/(authenticated)/trainers/actions.ts) just run a plain `.update(...).eq('id', ...)`. The only
-- UPDATE policies on `pokemon`/`trainers` are "the GM" or "the row's own owner" -- there has never been
-- any policy letting a regular campaign member update HP on a combatant that isn't theirs. Postgrest
-- doesn't treat "0 rows matched because RLS excluded them" as an error, so every time a player applied
-- damage to an enemy (or any non-owned combatant) -- which is virtually every attack, since you rarely
-- attack your own side -- the write silently affected nothing while the app reported success. This was
-- invisible in every past solo GM verification pass across every attack-resolution FR, since
-- is_campaign_gm(...) bypasses both restrictions entirely.
--
-- Fix: a narrowly-scoped SECURITY DEFINER function per table (not a blanket RLS policy widening general
-- UPDATE rights) -- only lets a campaign member write new HP/temp-HP values onto a combatant that is
-- *currently* an encounter_combatants row in an *active* encounter of that same campaign. Same pattern
-- as skip_my_turn() from the turn-gating FR. The app computes the new values exactly as it already does
-- (healing cap, temp-HP absorption, fainting LP loss) -- these functions only gate the write, they don't
-- duplicate that logic.
create or replace function apply_combat_pokemon_hp(target_pokemon_id uuid, new_current_hp int, new_temporary_hp int, new_loyalty_points int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id from pokemon where id = target_pokemon_id;

  if v_campaign_id is null then
    raise exception 'Pokemon not found';
  end if;

  if not is_campaign_member(v_campaign_id) then
    raise exception 'Not a member of this campaign';
  end if;

  if not exists (
    select 1
    from encounter_combatants ec
    join encounters e on e.id = ec.encounter_id
    where ec.pokemon_id = target_pokemon_id and e.campaign_id = v_campaign_id and e.status = 'active'
  ) then
    raise exception 'This Pokemon is not currently a combatant in an active encounter';
  end if;

  update pokemon set current_hp = new_current_hp, temporary_hp = new_temporary_hp, loyalty_points = new_loyalty_points
  where id = target_pokemon_id;
end;
$$;

grant execute on function apply_combat_pokemon_hp(uuid, int, int, int) to authenticated;

create or replace function apply_combat_trainer_hp(target_trainer_id uuid, new_current_hp int, new_temporary_hp int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id from trainers where id = target_trainer_id;

  if v_campaign_id is null then
    raise exception 'Trainer not found';
  end if;

  if not is_campaign_member(v_campaign_id) then
    raise exception 'Not a member of this campaign';
  end if;

  if not exists (
    select 1
    from encounter_combatants ec
    join encounters e on e.id = ec.encounter_id
    where ec.trainer_id = target_trainer_id and e.campaign_id = v_campaign_id and e.status = 'active'
  ) then
    raise exception 'This Trainer is not currently a combatant in an active encounter';
  end if;

  update trainers set current_hp = new_current_hp, temporary_hp = new_temporary_hp
  where id = target_trainer_id;
end;
$$;

grant execute on function apply_combat_trainer_hp(uuid, int, int) to authenticated;
