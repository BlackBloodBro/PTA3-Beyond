-- Each base Class has 2 "Favored Stats" per the Player's Handbook (p.15 overview table, repeated as
-- "Favored Stats: X and Y" on each Class's own detail page) -- surfaced as a creation-time
-- recommendation, never enforced, so this is a plain reference join, not a constraint on trainers.
create table class_favored_stats (
  class_id int not null references classes(id) on delete cascade,
  stat_id int not null references stats(id) on delete cascade,
  primary key (class_id, stat_id)
);

alter table class_favored_stats enable row level security;
create policy "Public read access" on class_favored_stats for select using (true);

insert into class_favored_stats (class_id, stat_id)
select c.id, s.id
from (values
  ('Ace trainer', 'Attack'),
  ('Ace trainer', 'Special Attack'),
  ('Breeder', 'Defense'),
  ('Breeder', 'Special Defense'),
  ('Coordinator', 'Special Defense'),
  ('Coordinator', 'Speed'),
  ('Ranger', 'Defense'),
  ('Ranger', 'Speed'),
  ('Researcher', 'Special Attack'),
  ('Researcher', 'Special Defense')
) as v(class_name, stat_name)
join classes c on c.name = v.class_name
join stats s on s.name = v.stat_name;
