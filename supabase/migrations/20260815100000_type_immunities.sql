-- [[Bug - Double check immunities in type effectiveness]]: the mainline games' 8 hard-immunity
-- pairings (0x damage, distinct from "shielded" resistance) are absent from `type_matchups` -- its
-- own header comment already flagged this at seed time, since the Handbook PDF chart itself never
-- encoded them. Confirmed against PokeAPI's real damage_relations data (not memory): outside of
-- these 8 pairs, the 112-row `type_matchups` chart is fully correct, so this is a narrow, additive
-- fix rather than a rework of that table.
--
-- Modeled as a separate pairs table, not a `modifier = 0` row on `type_matchups`: that table's
-- damage-dice math is ADDITIVE (a dual-type defender's two per-type scores are summed), but real
-- immunity is MULTIPLICATIVE (0x always wins regardless of the other type) -- e.g. a Normal move vs.
-- a Ghost/Steel dual-type must stay 0 damage even though Steel is neutral to Normal. That can only be
-- expressed as a short-circuit checked before the sum, not as another number folded into it, so it
-- needs its own presence-only table rather than extending `type_matchups`'s existing, already-correct
-- -1/+1 check constraint.
create table type_immunities (
  attacking_type_id int not null references types(id),
  defending_type_id int not null references types(id),
  primary key (attacking_type_id, defending_type_id)
);

insert into type_immunities (attacking_type_id, defending_type_id) values
  ((select id from types where name = 'Normal'), (select id from types where name = 'Ghost')),
  ((select id from types where name = 'Fighting'), (select id from types where name = 'Ghost')),
  ((select id from types where name = 'Ghost'), (select id from types where name = 'Normal')),
  ((select id from types where name = 'Electric'), (select id from types where name = 'Ground')),
  ((select id from types where name = 'Ground'), (select id from types where name = 'Flying')),
  ((select id from types where name = 'Poison'), (select id from types where name = 'Steel')),
  ((select id from types where name = 'Psychic'), (select id from types where name = 'Dark')),
  ((select id from types where name = 'Dragon'), (select id from types where name = 'Fairy'))
on conflict (attacking_type_id, defending_type_id) do nothing;
