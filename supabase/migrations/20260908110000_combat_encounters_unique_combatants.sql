-- [[Feature - Add a combat encounter tracker]]: per the user (2026-09-08) -- the same Trainer or the
-- same Pokemon could be added to one Encounter more than once, with nothing stopping it. Each should
-- only ever appear once per Encounter. Partial unique indexes (not a single one, since trainer_id/
-- pokemon_id are mutually exclusive and nullable -- see encounter_combatants' own xor check) enforce
-- this directly in the schema, same "don't just trust app code" precedent as
-- encounters_one_active_per_campaign.
create unique index encounter_combatants_unique_trainer on encounter_combatants (encounter_id, trainer_id) where trainer_id is not null;
create unique index encounter_combatants_unique_pokemon on encounter_combatants (encounter_id, pokemon_id) where pokemon_id is not null;
