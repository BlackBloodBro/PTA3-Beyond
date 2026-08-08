-- Fill out the Items table, batch 4: Combat Enhancers. Source: PTA3PlayersHandbook.pdf page 191.
-- One category covering all 5 of the PDF's subsections (Combat Enhancers proper, Vitamins, Revival
-- Medicine, Repels, and the herbs subsection below) -- same "one category, internally grouped"
-- treatment already used for Poké Balls/Medicine.
--
-- The PDF's last subsection is headed "Repulsive Herbs," but its 4 items (Heal Powder, Energy Powder,
-- Energy Root, Revival Herb) are healing items, not repelling ones -- reads as a mislabeled source
-- heading (likely carried over from the Repels subsection just above it), not a real mechanic. Kept
-- the items' actual effects as described, dropped the "repulsive" framing from their descriptions
-- rather than perpetuate what looks like a source error; kept the genuine "natural remedy, overuse
-- costs trust" caveat since that part is consistent with the herbs' own body text.
--
-- No detail table, same reasoning as Medicine: all effects (temporary/permanent stat amounts, HP
-- amounts) are plain numbers fully expressed in `description`, nothing in this app would consume a
-- structured version of them.
insert into item_categories (name) values ('Combat Enhancers');

insert into items (name, item_category_id, buyable, price, description)
select v.name, c.id, true, v.price, v.description
from item_categories c,
(values
  ('X Attack', 140, 'Increases a Pokémon''s Attack by 1 for 2 mins. This effect can stack up to three times.'),
  ('X Defend', 140, 'Increases a Pokémon''s Defense by 1 for 2 mins.'),
  ('X Special', 140, 'Increases a Pokémon''s Special Attack by 1 for 2 mins. This effect can stack up to three times.'),
  ('X Sp. Def', 140, 'Increases a Pokémon''s Special Defense by 1 for 2 mins.'),
  ('X Speed', 140, 'Increases a Pokémon''s Speed by 1 for 2 mins. This effect can stack up to three times.'),
  ('X Accuracy', 320, 'Increases a Pokémon''s accuracy checks by 1 for 1 min. This effect can stack up to three times.'),
  ('HP Up', 9800, 'Permanently increases HP by 4. Only two vitamins may ever be used per Pokémon; a third has no effect.'),
  ('Protein', 9800, 'Permanently increases Attack by 1. Only two vitamins may ever be used per Pokémon; a third has no effect.'),
  ('Iron', 9800, 'Permanently increases Defense by 1. Only two vitamins may ever be used per Pokémon; a third has no effect.'),
  ('Calcium', 9800, 'Permanently increases Special Attack by 1. Only two vitamins may ever be used per Pokémon; a third has no effect.'),
  ('Zinc', 9800, 'Permanently increases Special Defense by 1. Only two vitamins may ever be used per Pokémon; a third has no effect.'),
  ('Carbos', 9800, 'Permanently increases Speed by 1. Only two vitamins may ever be used per Pokémon; a third has no effect.'),
  ('Revive', 1350, 'Restores an unconscious Pokémon to half of its max HP.'),
  ('Max Revive', 2950, 'Restores an unconscious Pokémon to its max HP.'),
  ('Repel', 150, 'Wild Pokémon find the smell repulsive for one hour after applied, but may ignore it to protect something precious to them.'),
  ('Super Repel', 400, 'Wild Pokémon find the smell repulsive for three hours after applied, but may ignore it to protect something precious to them.'),
  ('Heal Powder', 480, 'Removes any affliction from a Pokémon. A natural remedy -- overuse may cause a Pokémon to lose trust in its trainer.'),
  ('Energy Powder', 125, 'Recovers 25 hit points on a Pokémon. A natural remedy -- overuse may cause a Pokémon to lose trust in its trainer.'),
  ('Energy Root', 400, 'Recovers 50 hit points on a Pokémon. A natural remedy -- overuse may cause a Pokémon to lose trust in its trainer.'),
  ('Revival Herb', 1000, 'Recovers an unconscious Pokémon to half of their max HP. A natural remedy -- overuse may cause a Pokémon to lose trust in its trainer.')
) as v(name, price, description)
where c.name = 'Combat Enhancers';
