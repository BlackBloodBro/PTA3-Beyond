-- Fill out the Items table, batch 3: Medicine. Source: PTA3PlayersHandbook.pdf page 190.
-- One category ("Medicine") covering all 4 of the PDF's subsections (Potions, Trainer Potions,
-- Affliction Removal, Energy Restoration) -- same "one category, internally grouped" treatment already
-- used for Poké Balls' own 6 PDF subgroups.
--
-- Flat items rows only, no detail table: heal/cure amounts are plain numbers already fully expressed
-- in `description`, and nothing in this app auto-applies HP/affliction changes anywhere else either
-- (HP adjustment is always a manual +/- the player enters) -- a structured "heal_amount" column would
-- have nothing to consume it.
insert into item_categories (name) values ('Medicine');

insert into items (name, item_category_id, buyable, price, description)
select v.name, c.id, true, v.price, v.description
from item_categories c,
(values
  ('Potion', 25, 'Heals a Pokémon 10 HP.'),
  ('Super Potion', 250, 'Heals a Pokémon 20 HP.'),
  ('Hyper Potion', 550, 'Heals a Pokémon 30 HP.'),
  ('Max Potion', 850, 'Heals a Pokémon to their Max HP.'),
  ('Full Restore', 1200, 'Heals a Pokémon to their Max HP and cures them of any afflictions.'),
  ('Potion Water', 100, 'Heals a human 10 HP.'),
  ('Super Soda', 300, 'Heals a human 20 HP.'),
  ('Hyper Lemonade', 550, 'Heals a human 30 HP.'),
  ('Antidote', 120, 'Cures a Pokémon or human of Poisoning or Toxification.'),
  ('Paralyze Heal', 120, 'Cures a Pokémon or human of Paralysis.'),
  ('Awakening', 120, 'Cures a Pokémon or human of being unnaturally Asleep.'),
  ('Burn Heal', 120, 'Cures a Pokémon or human of Burns.'),
  ('Ice Heal', 120, 'Cures a Pokémon or human of Freezing.'),
  ('Full Heal', 520, 'Cures a Pokémon or human of all afflictions.'),
  ('Ether', 480, 'A Pokémon''s strength is partially restored and can again use one of its 1/day or 3/day frequency moves as if it has taken an extended rest.'),
  ('Elixir', 1280, 'A Pokémon''s strength is restored and can again use its 1/day or 3/day frequency moves as if it has taken an extended rest.')
) as v(name, price, description)
where c.name = 'Medicine';
