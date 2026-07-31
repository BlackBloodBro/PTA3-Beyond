-- PC system: party_slot null = in the PC, 1-6 = on the Team in that slot. The 6-Pokemon team cap
-- falls out of only 6 valid slot values -- no separate CHECK/constant needed beyond the values
-- allowed here and the app-level MAX_TEAM_SIZE (lib/pta3/pokemonTeam.ts) that picks them.
alter table trainers_pokemon
  add column party_slot int check (party_slot between 1 and 6);

-- Two Pokemon can't claim the same Team slot for the same trainer. Partial (where party_slot is
-- not null) so any number of PC Pokemon (party_slot null) coexist freely.
create unique index trainers_pokemon_trainer_id_party_slot_key
  on trainers_pokemon (trainer_id, party_slot)
  where party_slot is not null;

-- Backfill: every existing trainers_pokemon row today behaves like "on the Team" (that's the only
-- concept that existed before the PC), though MAX_TEAM_SIZE was never actually enforced anywhere.
-- Give each trainer's first 6 rows by obtained_at a slot 1..6; anything beyond 6 lands in the PC
-- (party_slot stays null) rather than erroring out on a trainer who already has more than 6 linked
-- Pokemon today. pokemon_id is a tie-breaker so this is deterministic even if two rows for the same
-- trainer share an obtained_at timestamp.
with ranked as (
  select
    pokemon_id,
    row_number() over (partition by trainer_id order by obtained_at, pokemon_id) as rn
  from trainers_pokemon
)
update trainers_pokemon tp
set party_slot = ranked.rn
from ranked
where tp.pokemon_id = ranked.pokemon_id
  and ranked.rn <= 6;
