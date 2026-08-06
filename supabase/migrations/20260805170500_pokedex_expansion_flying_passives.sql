-- Flying-type batch 5 Passive eligibility, companion to the species
-- and moves migrations for this batch.

insert into pokedex_passives (pokedex_id, passive_id) values
  (899, 360),
  (899, 330),
  (899, 367),
  (900, 360),
  (900, 330),
  (900, 367),
  (901, 354),
  (902, 324),
  (902, 329),
  (903, 382)
on conflict (pokedex_id, passive_id) do nothing;
