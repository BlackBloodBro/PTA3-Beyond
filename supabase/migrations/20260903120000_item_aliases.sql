-- Add search-only aliases to items, e.g. "Basic Ball" -> "Pokeball" -- see
-- "Improvement - Add aliases to Items". Global reference data, same tier as items itself: RLS enabled
-- with public read access, no write policy (writable only via migration/service role), matching every
-- other reference table added in the initial schema migration.
create table item_aliases (
  id serial primary key,
  item_id int not null references items(id) on delete cascade,
  alias text not null,
  unique (item_id, alias)
);

create index on item_aliases (item_id);

alter table item_aliases enable row level security;
create policy "Public read access" on item_aliases for select using (true);

-- Seed data: real-world Pokémon nicknames for items whose in-app name diverges from them. Most items
-- in the catalog already use their real-world name verbatim (Great Ball, Potion, Fire Stone, ...) and
-- need no alias. "Basic Ball" is the one clear exception, and the exact case the FR's Problem section
-- calls out -- further aliases can be added later as more mismatches are found.
insert into item_aliases (item_id, alias)
select i.id, v.alias
from items i,
(values ('Poke Ball'), ('Poké Ball'), ('Pokeball'), ('Pokéball')) as v(alias)
where i.name = 'Basic Ball';
