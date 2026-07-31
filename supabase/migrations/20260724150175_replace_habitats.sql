-- Bug fix: the previous migration (20260724150100) computed the fine-grained habitat
-- list derived from the Pokedex sheet but never actually seeded it, leaving the old
-- 12 broad PDF-derived categories in place. Per the user's direction, habitats should
-- use the sheet's fine-grained per-species tags (Caves, Ponds, Ocean Abyss, etc.),
-- cleaned up for pluralization/typo drift (Glacier/Glaciers, Jungle/Jungles, etc.)
-- rather than the PDF's broad categories.
delete from habitats;

insert into habitats (name) values
  ('Abandoned'),
  ('Badlands'),
  ('Beaches'),
  ('Burial'),
  ('Caves'),
  ('Deserts'),
  ('Fields'),
  ('Forests'),
  ('Glaciers'),
  ('Grasslands'),
  ('Jungles'),
  ('Lakes'),
  ('Marshes'),
  ('Meadows'),
  ('Mountains'),
  ('Ocean Abyss'),
  ('Ocean Floor'),
  ('Ocean Reefs'),
  ('Oceans'),
  ('Orchards'),
  ('Plains'),
  ('Plants'),
  ('Polar'),
  ('Ponds'),
  ('Rivers'),
  ('Ruins'),
  ('Savannas'),
  ('Swamps'),
  ('Tundra'),
  ('Urban'),
  ('Urban Plants'),
  ('Volcanoes'),
  ('Wetlands'),
  ('Woodlands')
on conflict (name) do nothing;

