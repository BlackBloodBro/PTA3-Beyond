-- Fill out the Items table, batch 6: Evolution Stones. Source: PTA3PlayersHandbook.pdf page 197.
-- Flat category, no detail table -- all 10 stones share the same mechanic (induce evolution in
-- specific compatible species) and the same price; no PDF data ties a specific stone to specific
-- Pokédex species (that's a `pokedex` evolution-chain modeling question, out of scope for this FR,
-- which is about the item catalog, not evolution chains).
insert into item_categories (name) values ('Evolution Stones');

insert into items (name, item_category_id, buyable, price, description)
select v.name, c.id, true, 9800, 'Induces evolution in specific, compatible Pokémon species. Rare, but carried in various specialty stores in larger towns and cities.'
from item_categories c,
(values
  ('Dawn Stone'), ('Dusk Stone'), ('Fire Stone'), ('Ice Stone'), ('Leaf Stone'),
  ('Moon Stone'), ('Shiny Stone'), ('Sun Stone'), ('Thunder Stone'), ('Water Stone')
) as v(name)
where c.name = 'Evolution Stones';
