-- The 18 trainer skills and the stat that provides their modifier, from the trainer character
-- sheet template.
insert into skills (name, stat_id) values
  ('Acrobatics', (select id from stats where name = 'Speed')),
  ('Athletics', (select id from stats where name = 'Attack')),
  ('Bluff', (select id from stats where name = 'Special Defense')),
  ('Concentration', (select id from stats where name = 'Defense')),
  ('Constitution', (select id from stats where name = 'Defense')),
  ('Diplomacy', (select id from stats where name = 'Special Defense')),
  ('Engineering', (select id from stats where name = 'Special Attack')),
  ('History', (select id from stats where name = 'Special Attack')),
  ('Insight', (select id from stats where name = 'Special Defense')),
  ('Investigate', (select id from stats where name = 'Special Attack')),
  ('Medicine', (select id from stats where name = 'Special Attack')),
  ('Nature', (select id from stats where name = 'Special Attack')),
  ('Perception', (select id from stats where name = 'Special Defense')),
  ('Perform', (select id from stats where name = 'Special Defense')),
  ('Pokémon handling', (select id from stats where name = 'Special Defense')),
  ('Programming', (select id from stats where name = 'Special Attack')),
  ('Sleight of hand', (select id from stats where name = 'Speed')),
  ('Stealth', (select id from stats where name = 'Speed'))
on conflict (name) do nothing;
