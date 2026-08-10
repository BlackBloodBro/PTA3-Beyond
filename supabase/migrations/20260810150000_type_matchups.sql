-- Type-Effectiveness Chart, extracted from the Player's Handbook PDF page 122 as part of
-- [[Implement type effectiveness]]. Confirmed directly against the PDF's text coordinates (not
-- guessed from mainline Pokémon knowledge, though cross-validated against it for confidence -- Bug,
-- Dark, Fire, and Water rows matched mainline exactly).
--
-- IMPORTANT: this is NOT a mainline-style ×2/×0.5/×0 HP multiplier. The handbook's own rule (page 122)
-- adds/subtracts DICE from the damage roll: "Add 1 die to the attack's super-effective damage! If your
-- attack is extremely-effective, add 2 dice! Subtract 1 die from the attack's resisted damage. If your
-- attack is shielded, subtract 2 dice." Each type pairing contributes -1 (resisted), 0 (neutral, not
-- stored -- see below), or +1 (super-effective) to a score; a dual-type Pokémon's two types both
-- contribute, and the SUM (not product) of both scores determines the final die adjustment:
--   score >= 2: extremely-effective, +2 dice   |   score == 1: super-effective, +1 die
--   score == 0: neutral, +0                    |   score == -1: resisted, -1 die
--   score <= -2: shielded, -2 dice
-- Only non-neutral (-1 / +1) pairings are stored; a missing row means 0 (neutral). Only 112 of the
-- 324 possible pairings are non-neutral.
--
-- No hard "immune, cannot hit" pairings are encoded -- despite the page's rule text describing that as
-- a possible outcome, none of the classic mainline hard-immunity pairs (Electric->Ground, Ground->
-- Flying, Poison->Steel, Ghost->Normal, Fighting->Ghost, Psychic->Dark, etc.) appear anywhere in the
-- extracted chart; they're all simply absent (neutral) here. Treating that rule text as either
-- vestigial or GM-discretion, not modeled as data, since nothing in the chart itself supports it.
create table type_matchups (
  attacking_type_id int not null references types(id),
  defending_type_id int not null references types(id),
  modifier int not null check (modifier in (-1, 1)),
  primary key (attacking_type_id, defending_type_id)
);

insert into type_matchups (attacking_type_id, defending_type_id, modifier) values
  ((select id from types where name = 'Bug'), (select id from types where name = 'Dark'), 1),
  ((select id from types where name = 'Bug'), (select id from types where name = 'Fairy'), -1),
  ((select id from types where name = 'Bug'), (select id from types where name = 'Fighting'), -1),
  ((select id from types where name = 'Bug'), (select id from types where name = 'Fire'), -1),
  ((select id from types where name = 'Bug'), (select id from types where name = 'Flying'), -1),
  ((select id from types where name = 'Bug'), (select id from types where name = 'Ghost'), -1),
  ((select id from types where name = 'Bug'), (select id from types where name = 'Grass'), 1),
  ((select id from types where name = 'Bug'), (select id from types where name = 'Poison'), -1),
  ((select id from types where name = 'Bug'), (select id from types where name = 'Psychic'), 1),
  ((select id from types where name = 'Bug'), (select id from types where name = 'Steel'), -1),
  ((select id from types where name = 'Dark'), (select id from types where name = 'Dark'), -1),
  ((select id from types where name = 'Dark'), (select id from types where name = 'Fairy'), -1),
  ((select id from types where name = 'Dark'), (select id from types where name = 'Fighting'), -1),
  ((select id from types where name = 'Dark'), (select id from types where name = 'Ghost'), 1),
  ((select id from types where name = 'Dark'), (select id from types where name = 'Psychic'), 1),
  ((select id from types where name = 'Dragon'), (select id from types where name = 'Dragon'), 1),
  ((select id from types where name = 'Dragon'), (select id from types where name = 'Steel'), -1),
  ((select id from types where name = 'Electric'), (select id from types where name = 'Dragon'), -1),
  ((select id from types where name = 'Electric'), (select id from types where name = 'Electric'), -1),
  ((select id from types where name = 'Electric'), (select id from types where name = 'Flying'), 1),
  ((select id from types where name = 'Electric'), (select id from types where name = 'Grass'), -1),
  ((select id from types where name = 'Electric'), (select id from types where name = 'Water'), 1),
  ((select id from types where name = 'Fairy'), (select id from types where name = 'Dark'), 1),
  ((select id from types where name = 'Fairy'), (select id from types where name = 'Dragon'), 1),
  ((select id from types where name = 'Fairy'), (select id from types where name = 'Fighting'), 1),
  ((select id from types where name = 'Fairy'), (select id from types where name = 'Fire'), -1),
  ((select id from types where name = 'Fairy'), (select id from types where name = 'Poison'), -1),
  ((select id from types where name = 'Fairy'), (select id from types where name = 'Steel'), -1),
  ((select id from types where name = 'Fighting'), (select id from types where name = 'Bug'), -1),
  ((select id from types where name = 'Fighting'), (select id from types where name = 'Dark'), 1),
  ((select id from types where name = 'Fighting'), (select id from types where name = 'Fairy'), -1),
  ((select id from types where name = 'Fighting'), (select id from types where name = 'Flying'), -1),
  ((select id from types where name = 'Fighting'), (select id from types where name = 'Ice'), 1),
  ((select id from types where name = 'Fighting'), (select id from types where name = 'Normal'), 1),
  ((select id from types where name = 'Fighting'), (select id from types where name = 'Poison'), -1),
  ((select id from types where name = 'Fighting'), (select id from types where name = 'Psychic'), -1),
  ((select id from types where name = 'Fighting'), (select id from types where name = 'Rock'), 1),
  ((select id from types where name = 'Fighting'), (select id from types where name = 'Steel'), 1),
  ((select id from types where name = 'Fire'), (select id from types where name = 'Bug'), 1),
  ((select id from types where name = 'Fire'), (select id from types where name = 'Dragon'), -1),
  ((select id from types where name = 'Fire'), (select id from types where name = 'Fire'), -1),
  ((select id from types where name = 'Fire'), (select id from types where name = 'Grass'), 1),
  ((select id from types where name = 'Fire'), (select id from types where name = 'Ice'), 1),
  ((select id from types where name = 'Fire'), (select id from types where name = 'Rock'), -1),
  ((select id from types where name = 'Fire'), (select id from types where name = 'Steel'), 1),
  ((select id from types where name = 'Fire'), (select id from types where name = 'Water'), -1),
  ((select id from types where name = 'Flying'), (select id from types where name = 'Bug'), 1),
  ((select id from types where name = 'Flying'), (select id from types where name = 'Electric'), -1),
  ((select id from types where name = 'Flying'), (select id from types where name = 'Fighting'), 1),
  ((select id from types where name = 'Flying'), (select id from types where name = 'Grass'), 1),
  ((select id from types where name = 'Flying'), (select id from types where name = 'Rock'), -1),
  ((select id from types where name = 'Flying'), (select id from types where name = 'Steel'), -1),
  ((select id from types where name = 'Ghost'), (select id from types where name = 'Dark'), -1),
  ((select id from types where name = 'Ghost'), (select id from types where name = 'Ghost'), 1),
  ((select id from types where name = 'Ghost'), (select id from types where name = 'Psychic'), 1),
  ((select id from types where name = 'Grass'), (select id from types where name = 'Bug'), -1),
  ((select id from types where name = 'Grass'), (select id from types where name = 'Dragon'), -1),
  ((select id from types where name = 'Grass'), (select id from types where name = 'Fire'), -1),
  ((select id from types where name = 'Grass'), (select id from types where name = 'Flying'), -1),
  ((select id from types where name = 'Grass'), (select id from types where name = 'Grass'), -1),
  ((select id from types where name = 'Grass'), (select id from types where name = 'Ground'), 1),
  ((select id from types where name = 'Grass'), (select id from types where name = 'Poison'), -1),
  ((select id from types where name = 'Grass'), (select id from types where name = 'Rock'), 1),
  ((select id from types where name = 'Grass'), (select id from types where name = 'Steel'), -1),
  ((select id from types where name = 'Grass'), (select id from types where name = 'Water'), 1),
  ((select id from types where name = 'Ground'), (select id from types where name = 'Bug'), -1),
  ((select id from types where name = 'Ground'), (select id from types where name = 'Electric'), 1),
  ((select id from types where name = 'Ground'), (select id from types where name = 'Fire'), 1),
  ((select id from types where name = 'Ground'), (select id from types where name = 'Grass'), -1),
  ((select id from types where name = 'Ground'), (select id from types where name = 'Poison'), 1),
  ((select id from types where name = 'Ground'), (select id from types where name = 'Rock'), 1),
  ((select id from types where name = 'Ground'), (select id from types where name = 'Steel'), 1),
  ((select id from types where name = 'Ice'), (select id from types where name = 'Dragon'), 1),
  ((select id from types where name = 'Ice'), (select id from types where name = 'Fire'), -1),
  ((select id from types where name = 'Ice'), (select id from types where name = 'Flying'), 1),
  ((select id from types where name = 'Ice'), (select id from types where name = 'Grass'), 1),
  ((select id from types where name = 'Ice'), (select id from types where name = 'Ground'), 1),
  ((select id from types where name = 'Ice'), (select id from types where name = 'Ice'), -1),
  ((select id from types where name = 'Ice'), (select id from types where name = 'Steel'), -1),
  ((select id from types where name = 'Ice'), (select id from types where name = 'Water'), -1),
  ((select id from types where name = 'Normal'), (select id from types where name = 'Rock'), -1),
  ((select id from types where name = 'Normal'), (select id from types where name = 'Steel'), -1),
  ((select id from types where name = 'Poison'), (select id from types where name = 'Fairy'), 1),
  ((select id from types where name = 'Poison'), (select id from types where name = 'Ghost'), -1),
  ((select id from types where name = 'Poison'), (select id from types where name = 'Grass'), 1),
  ((select id from types where name = 'Poison'), (select id from types where name = 'Ground'), -1),
  ((select id from types where name = 'Poison'), (select id from types where name = 'Poison'), -1),
  ((select id from types where name = 'Poison'), (select id from types where name = 'Rock'), -1),
  ((select id from types where name = 'Psychic'), (select id from types where name = 'Fighting'), 1),
  ((select id from types where name = 'Psychic'), (select id from types where name = 'Poison'), 1),
  ((select id from types where name = 'Psychic'), (select id from types where name = 'Psychic'), -1),
  ((select id from types where name = 'Psychic'), (select id from types where name = 'Steel'), -1),
  ((select id from types where name = 'Rock'), (select id from types where name = 'Bug'), 1),
  ((select id from types where name = 'Rock'), (select id from types where name = 'Fighting'), -1),
  ((select id from types where name = 'Rock'), (select id from types where name = 'Fire'), 1),
  ((select id from types where name = 'Rock'), (select id from types where name = 'Flying'), 1),
  ((select id from types where name = 'Rock'), (select id from types where name = 'Ground'), -1),
  ((select id from types where name = 'Rock'), (select id from types where name = 'Ice'), 1),
  ((select id from types where name = 'Rock'), (select id from types where name = 'Steel'), -1),
  ((select id from types where name = 'Steel'), (select id from types where name = 'Electric'), -1),
  ((select id from types where name = 'Steel'), (select id from types where name = 'Fairy'), 1),
  ((select id from types where name = 'Steel'), (select id from types where name = 'Fire'), -1),
  ((select id from types where name = 'Steel'), (select id from types where name = 'Ice'), 1),
  ((select id from types where name = 'Steel'), (select id from types where name = 'Rock'), 1),
  ((select id from types where name = 'Steel'), (select id from types where name = 'Steel'), -1),
  ((select id from types where name = 'Steel'), (select id from types where name = 'Water'), -1),
  ((select id from types where name = 'Water'), (select id from types where name = 'Dragon'), -1),
  ((select id from types where name = 'Water'), (select id from types where name = 'Fire'), 1),
  ((select id from types where name = 'Water'), (select id from types where name = 'Grass'), -1),
  ((select id from types where name = 'Water'), (select id from types where name = 'Ground'), 1),
  ((select id from types where name = 'Water'), (select id from types where name = 'Rock'), 1),
  ((select id from types where name = 'Water'), (select id from types where name = 'Water'), -1)
on conflict (attacking_type_id, defending_type_id) do nothing;
