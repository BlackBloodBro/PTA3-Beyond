-- Fill out the Items table, batch 7: Technical Machines. Source: PTA3PlayersHandbook.pdf page 198.
--
-- Per the user's earlier decision: generic catalog entries by frequency tier, not one row per move --
-- explicitly don't want the Items list flooded with a per-move TM catalog. Whenever the actual "use a
-- TM to teach a move" flow gets built, the move picker should offer the Pokémon's full eligible
-- movepool, not filter to just this tier -- a consumption-time UI decision for that future flow, not
-- something these catalog rows encode.
--
-- 7 items, not 3: the PDF also describes Technical Records (TR, half the price of the matching TM,
-- single-use) and HMs (rare, never runs out of uses, no set price) as real distinct catalog entries,
-- not just flavor text -- TR pricing is tier-specific (half of each TM tier) so it gets 3 rows like TM;
-- HM has no frequency-specific pricing/framing anywhere in the source, so it stays a single generic
-- item rather than inventing a 3-way split the PDF doesn't give.
insert into item_categories (name) values ('Technical Machines');

insert into items (name, item_category_id, buyable, price, description)
select v.name, c.id, v.buyable, v.price, v.description
from item_categories c,
(values
  ('TM (At-Will)', true, 4800, 'Teaches a Pokémon an At-Will frequency move at a Pokémon Center''s teaching device. Usable up to 3 times before its data becomes corrupted from use.'),
  ('TM (3/day)', true, 9800, 'Teaches a Pokémon a 3/day frequency move at a Pokémon Center''s teaching device. Usable up to 3 times before its data becomes corrupted from use.'),
  ('TM (1/day)', true, 16800, 'Teaches a Pokémon a 1/day frequency move at a Pokémon Center''s teaching device. Usable up to 3 times before its data becomes corrupted from use.'),
  ('TR (At-Will)', true, 2400, 'A lower-quality technical record. Teaches a Pokémon an At-Will frequency move, but is rendered useless after just one successful use.'),
  ('TR (3/day)', true, 4900, 'A lower-quality technical record. Teaches a Pokémon a 3/day frequency move, but is rendered useless after just one successful use.'),
  ('TR (1/day)', true, 8400, 'A lower-quality technical record. Teaches a Pokémon a 1/day frequency move, but is rendered useless after just one successful use.'),
  ('HM', false, null, 'An exceedingly rare Hidden Machine. Teaches a Pokémon a move and never runs out of uses, no matter how many times it''s used. As difficult to price as it is to find.')
) as v(name, buyable, price, description)
where c.name = 'Technical Machines';
