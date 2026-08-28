-- Seeds core reference data extracted from the PTA3 Player's Handbook, and restructures
-- `passives` to support Stat Passives (numeric stat modifiers, max 3 active, 1 per category)
-- vs Ability Passives (unstructured effects). "Pokemon Skills" from the handbook are folded
-- into passives as ability-type passives with context = 'out_of_combat', per clarification
-- that they work like ability passives but apply outside of combat.

alter table passives
  add column passive_type text not null default 'ability' check (passive_type in ('stat', 'ability')),
  add column category text check (category in ('attack', 'defense', 'special_attack', 'special_defense', 'speed', 'mix', 'critical_hit')),
  add column context text check (context in ('combat', 'out_of_combat'));

create table passives_stats (
  passive_id int not null references passives(id) on delete cascade,
  stat_id int not null references stats(id) on delete cascade,
  modifier int not null,
  primary key (passive_id, stat_id)
);

create index on passives_stats (stat_id);

-- Active data: which passives a specific owned Pokemon currently has (mutable, mirrors
-- pokemon_moves/pokemon_afflictions). The max-3 / one-per-category stacking rule is
-- application logic, not enforced here (same approach as other business rules so far).
create table pokemon_passives (
  pokemon_id uuid not null references pokemon(id) on delete cascade,
  passive_id int not null references passives(id) on delete cascade,
  primary key (pokemon_id, passive_id)
);

create index on pokemon_passives (passive_id);

alter table passives_stats enable row level security;
create policy "Public read access" on passives_stats for select using (true);

alter table pokemon_passives enable row level security;
create policy "Owner manages pokemon_passives" on pokemon_passives
  for all using (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon_passives.pokemon_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon_passives.pokemon_id and t.user_id = auth.uid()
    )
  );

insert into stats (name, abbreviation) values
  ('HP', 'HP'),
  ('Attack', 'Atk'),
  ('Defense', 'Def'),
  ('Special Attack', 'SpAtk'),
  ('Special Defense', 'SpDef'),
  ('Speed', 'Spd')
on conflict (name) do nothing;

insert into types (name) values
  ('Bug'),
  ('Dark'),
  ('Dragon'),
  ('Electric'),
  ('Fairy'),
  ('Fighting'),
  ('Fire'),
  ('Flying'),
  ('Ghost'),
  ('Grass'),
  ('Ground'),
  ('Ice'),
  ('Normal'),
  ('Poison'),
  ('Psychic'),
  ('Rock'),
  ('Steel'),
  ('Water')
on conflict (name) do nothing;

insert into natures (name, increased_stat_id, decreased_stat_id) values
  ('Lonely', (select id from stats where name = 'Attack'), (select id from stats where name = 'Defense')),
  ('Brave', (select id from stats where name = 'Attack'), (select id from stats where name = 'Speed')),
  ('Adamant', (select id from stats where name = 'Attack'), (select id from stats where name = 'Special Attack')),
  ('Naughty', (select id from stats where name = 'Attack'), (select id from stats where name = 'Special Defense')),
  ('Bold', (select id from stats where name = 'Defense'), (select id from stats where name = 'Attack')),
  ('Relaxed', (select id from stats where name = 'Defense'), (select id from stats where name = 'Speed')),
  ('Impish', (select id from stats where name = 'Defense'), (select id from stats where name = 'Special Attack')),
  ('Lax', (select id from stats where name = 'Defense'), (select id from stats where name = 'Special Defense')),
  ('Timid', (select id from stats where name = 'Speed'), (select id from stats where name = 'Attack')),
  ('Hasty', (select id from stats where name = 'Speed'), (select id from stats where name = 'Defense')),
  ('Jolly', (select id from stats where name = 'Speed'), (select id from stats where name = 'Special Attack')),
  ('Naive', (select id from stats where name = 'Speed'), (select id from stats where name = 'Special Defense')),
  ('Modest', (select id from stats where name = 'Special Attack'), (select id from stats where name = 'Attack')),
  ('Mild', (select id from stats where name = 'Special Attack'), (select id from stats where name = 'Defense')),
  ('Quiet', (select id from stats where name = 'Special Attack'), (select id from stats where name = 'Speed')),
  ('Rash', (select id from stats where name = 'Special Attack'), (select id from stats where name = 'Special Defense')),
  ('Calm', (select id from stats where name = 'Special Defense'), (select id from stats where name = 'Attack')),
  ('Gentle', (select id from stats where name = 'Special Defense'), (select id from stats where name = 'Defense')),
  ('Sassy', (select id from stats where name = 'Special Defense'), (select id from stats where name = 'Speed')),
  ('Careful', (select id from stats where name = 'Special Defense'), (select id from stats where name = 'Special Attack'))
on conflict (name) do nothing;

insert into loyalties (name, description) values
  ('0', 'Pokemon at loyalty 0 are constantly trying to escape their trainers. If they aren''t trying to actively flee, they''re ignoring any comment from their trainers, or even trying to attack their own trainers. Loyalty 0 is earned, you have to be really awful to your Pokemon for them to be here. Pokemon who are captured while unconscious always start here.'),
  ('1', 'Pokemon at loyalty 1 do not trust their trainers, but are not outwardly hostile towards them. Pokemon here might occasionally ignore their trainer''s commands, choosing to try something else during combat. Many newly captured Pokemon who believe their trainers are unworthy of their strength will be at loyalty 1.'),
  ('2', 'Loyalty 2 is marked by obedient Pokemon who are not really close to you. Most loyalty 2 Pokemon like their trainers but may see their relationship mostly as a means to an end. Their obedience and performance in battle gets them food and a safe place to rest. Most hatched Pokemon start at loyalty 2 once they imprint onto you.'),
  ('3', 'In general, loyalty 3 is a great place for your Pokemon to be. Pokemon at loyalty 3 obey commands in battle and perform the best they can to protect their friends and allies. They value their trainers as much as their trainers value them.'),
  ('4', 'Loyalty 4 often represents the closest relationship that a trainer might have. Most often, trainers will have Pokemon with loyalty 4 be their first Pokemon, their Pokemon who is always out of their Poke Ball, or maybe a starter that grew particularly close to their trainer.'),
  ('5', 'A trainer might spend their whole life with loving partnerships with their Pokemon and never have a Pokemon with loyalty 5. Pokemon with loyalty 5 have perfect understandings of their trainer''s needs and desires, and are often proactive, almost acting without command.')
on conflict (name) do nothing;

insert into habitats (name, description) values
  ('Beach', 'Rocky and sandy beaches play home to many semiaquatic Pokemon that are content only spending some of their time in the sea. The intertidal zone also supports rock pools where some hardier Water-types make their homes.'),
  ('Desert', 'Sandy, arid deserts support many Ground-type Pokemon that can burrow away from the sun''s heat. Resilient Steel- and Ground-types stand out, though Dark-, Dragon-, and even Flying-types appear as well.'),
  ('Forest', 'Temperate, broadleaf forests with mild, seasonal weather and healthy tree growth play home to many common Pokemon, with Grass-, Bug-, Flying-, and Normal-types the most abundant.'),
  ('Freshwater', 'Ponds, lakes, streams, and rivers, on their shores or in the waters themselves. Water-types are abundant, with Bug-types also common around ponds.'),
  ('Grasslands', 'Covers woodlands, fields, meadows, savannas, plains, and prairies. Fire- and Electric-types can start brushfires, Poison- and Normal-types are common in tall grass, and Bug-, Dark-, Ghost-, and Fairy-types may appear in woodlands at night.'),
  ('Jungle', 'Tropical jungles are warm and humid year-round with frequent rainfall and dense vegetation. Grass- and Bug-types thrive in these prolific habitats.'),
  ('Mountain', 'The exposed earth on mountain ranges, the caves underneath, and volcanic mountains. Rock- and Steel-types favor open mountainsides, Fighting-types train in the quiet remoteness, Ground-, Rock-, and Steel-types dwell underground, and Fire-types thrive near volcanic heat.'),
  ('Ocean', 'The open ocean, continental shelf, tropical seas and coral reefs, and the deep abyss. Marine Water-types of all kinds are found here, particularly sensitive to temperature, salinity, and cleanliness.'),
  ('Polar', 'The top of frozen mountains, massive glaciers, icy caves, and the polar seas. Primarily Ice-types, adapted to withstand freezing temperatures and scarce food.'),
  ('Tundra', 'Characterized by permafrost supporting only grasses, mosses, and lichens, plus boreal forests of evergreen trees. Ice-types are most common, with heartier Normal-types sometimes present.'),
  ('Urban', 'Cities and other areas defined by human habitation. Normal-, Psychic-, Fighting-, and Ghost-types often coexist with people, Poison-types thrive on waste, and Electric-types congregate around electrical activity.'),
  ('Wetlands', 'Swamps, bogs, and marshes are rich terrestrial habitats. Grass-, Bug-, Water-, and Poison-types take advantage of the acidic, oxygen-poor soils.')
on conflict (name) do nothing;

insert into egg_groups (name) values
  ('Amorphous'),
  ('Bug'),
  ('Dragon'),
  ('Fairy'),
  ('Field'),
  ('Flying'),
  ('Grass'),
  ('Human-Like'),
  ('Mineral'),
  ('Monster'),
  ('Water 1'),
  ('Water 2'),
  ('Water 3'),
  ('Ditto')
on conflict (name) do nothing;

insert into diets (name, description) values
  ('Carnivore', 'Primarily feeds on other Pokemon.'),
  ('Herbivore', 'Needs leafy food, vegetables, nuts and fruits to survive.'),
  ('Omnivore', 'Can eat plants or other Pokemon.'),
  ('Phototroph', 'Can photosynthesize its own food and energy.'),
  ('Terravore', 'Feeds on the minerals found in rock and dirt.'),
  ('Nullivore', 'Does not need to eat anything to sustain itself.'),
  ('Saprophyte', 'Feeds on decaying matter or minerals off the ground.'),
  ('Ergovore', 'Feeds on electricity and other energy.'),
  ('Glacievore', 'Survives by consuming ice and water.'),
  ('Pollutivore', 'Feeds on pollution of any kind.'),
  ('Psiotroph', 'Sustains itself off the thoughts and life force of others.')
on conflict (name) do nothing;

insert into afflictions (name, description) values
  ('Frozen', 'Immobilized by frost, unable to move or take an action. Recovers by rolling at least 18 on a 1d20 saving throw, or automatically after ten minutes. Ice-type Pokemon are immune.'),
  ('Asleep', 'Unable to wake and move. May attempt to wake on your turn with a 1d20 saving throw (starts at 16, decreasing by 2 each turn to a minimum of 6). Cured automatically after one minute.'),
  ('Burned', 'Lose 1d10 HP upon taking an action, and have -2 Attack. Cured at 0 HP or after one minute without attacking or moving. Fire-type Pokemon are immune.'),
  ('Confused', 'Attempting an action requires a 1d20 saving throw (11 or higher to act normally, cured on 16+ or after two minutes). A failed roll deals 1d12 HP of self-harm.'),
  ('Cursed', 'Lose 1/6th of max HP after taking an action. Cured at 0 HP. Only Pokemon can be cursed.'),
  ('Stunned', 'Cannot take a turn. Cured automatically on the following turn.'),
  ('Infatuated', 'Cannot attack the object of infatuation unless a 1d20 saving throw of 13+ is rolled. Cured on a roll of 19+ or after two minutes. Only Pokemon may be infatuated.'),
  ('Paralyzed', 'Have -2 Speed, and attempting an action requires a 1d20 saving throw (starts at 6, increasing by 2 each turn to a maximum of 16). Cured automatically after five minutes.'),
  ('Poisoned', 'Lose 1d10 HP upon taking an action, and have -2 Special Attack. Cured at 0 HP or after one minute without attacking or moving. Poison- and Steel-type Pokemon are immune.'),
  ('Toxified', 'Lose HP upon taking an action (1d8, then 1d12, 1d20, 2d20, 3d20, and so on), and have -2 Special Attack. Cured at 0 HP or after one minute without attacking or moving. Poison- and Steel-type Pokemon are immune.')
on conflict (name) do nothing;

insert into afflictions_stats (affliction_id, stat_id, modifier) values
  ((select id from afflictions where name = 'Burned'), (select id from stats where name = 'Attack'), -2),
  ((select id from afflictions where name = 'Paralyzed'), (select id from stats where name = 'Speed'), -2),
  ((select id from afflictions where name = 'Poisoned'), (select id from stats where name = 'Special Attack'), -2),
  ((select id from afflictions where name = 'Toxified'), (select id from stats where name = 'Special Attack'), -2)
on conflict (affliction_id, stat_id) do nothing;

-- The rest of this file's original data (Stat Passives, their passives_stats rows, and Ability
-- Passives) was deleted here on 2026-08-28: 20260724150100_lists_reference_data.sql:1058 runs
-- `delete from passives;` (cascading to passives_stats) moments later and fully reseeds both
-- tables from a newer, more complete homebrew source (327 rows vs this file's ~200). None of
-- this file's passives ever survive into the live schema -- see that migration for the
-- authoritative seed data. Removed per [[Intimidate name collision and duplicate passives seed
-- data]] rather than left as dead weight.
