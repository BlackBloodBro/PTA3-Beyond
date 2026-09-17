-- [[Feature - GM Custom - Moves]]: same fix [[Feature - GM Custom - Afflictions]] needed for its own
-- delete guard, applied proactively here rather than rediscovered live -- pokemon_moves.move_id and
-- trainer_moves.move_id are both `on delete cascade` (a Pokemon/Trainer's actually-learned Move, with
-- uses_remaining tracked, would silently vanish), and a plain query from the GM's own session can't
-- reliably see every Campaign member's own pokemon_moves/trainer_moves rows regardless of Pokemon/
-- Trainer ownership shape (Trainer-assigned vs. pool). pokemon_move_grants (also `on delete cascade`)
-- is included too, for the same reason, even though it's a lighter-weight GM-granted-eligibility
-- record rather than an actually-learned Move. pokedex_moves/moves_proficiencies are deliberately left
-- out -- those are the Move's own definitional data (which species can learn it, its Proficiency tags),
-- fine to cascade alongside deleting the Move itself, not a Pokemon/Trainer's already-learned state.
create or replace function count_move_usages(target_move_id int)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select
    (select count(*) from pokemon_moves where move_id = target_move_id)
    + (select count(*) from trainer_moves where move_id = target_move_id)
    + (select count(*) from pokemon_move_grants where move_id = target_move_id);
$$;
