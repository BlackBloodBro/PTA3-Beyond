-- Schema changes driven by the user's own homebrew "Lists" Google Sheet, which is more
-- complete/authoritative than the Player's Handbook PDF for these tables.

-- Moves: the sheet has a "Modifier" column (Attack / Special attack / Effect / Variable),
-- a "Frequency" (At will / 1/day / 3/day / Special), a "Range" descriptor, and dice notation
-- for damage. 'effect' is a genuinely distinct damage_stat category (non-damage utility moves
-- using the Speed stat per the handbook's combat rules), so the check constraint needs it
-- alongside the original physical/special/either spec.
alter table moves drop constraint moves_damage_stat_check;
alter table moves add constraint moves_damage_stat_check
  check (damage_stat in ('physical', 'special', 'either', 'effect'));
alter table moves
  add column frequency text,
  add column damage_dice text,
  add column range text;

-- Origins: the sheet pairs each origin with a "Lifestyle" tier (Difficult/Comfortable/Modest/Wealthy).
alter table origins add column lifestyle text;

-- Items: "held items" in the sheet are type-boosting items (e.g. Black Belt -> Fighting +2).
alter table items
  add column boosted_type_id int references types(id),
  add column boost_amount int;

-- Obtain methods: the sheet has a numeric modifier per method (e.g. Starter x1.2).
alter table obtain_methods add column modifier numeric;

-- Afflictions: the sheet has a catch-modifier value for 7 of the 10 afflictions. Modeled as a
-- column directly on afflictions rather than a redundant 4th catch-modifier table, since every
-- value maps 1:1 to an existing row.
alter table afflictions add column catch_modifier int;

-- Loyalty has two extra numeric roles in the sheet: a multiplier on fights-to-level-up, and a
-- modifier applied during breeding (not catching, per clarification).
alter table loyalties
  add column exp_modifier numeric,
  add column breeding_modifier int;

-- Breeding modifier turned out to be relationship tiers (Enemies/Unfamiliar/Familiar/Friends/
-- Romantic) with a flat modifier, not "friendship_level" as originally guessed.
alter table breeding_modifiers
  drop column friendship_level,
  add column modifier int not null default 0;
alter table breeding_modifiers alter column modifier drop default;

-- New catch-modifier category found in the sheet with no home in the original schema.
create table catch_modifiers_shiny (
  id serial primary key,
  name text not null unique,
  modifier numeric not null
);

alter table catch_modifiers_shiny enable row level security;
create policy "Public read access" on catch_modifiers_shiny for select using (true);

-- Pokedex: species-level fields present in the sheet with no existing column.
alter table pokedex
  add column catch_rate int,
  add column egg_hatch_rate text,
  add column sprite_code text;
