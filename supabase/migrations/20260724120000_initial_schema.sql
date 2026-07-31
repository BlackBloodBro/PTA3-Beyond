-- PTA3 Tool: initial schema
-- Reference tables (static game data) -> relationship tables (many-to-many) -> active tables (live campaign data)
--
-- Assumptions made where the schema doc didn't specify a linkage (flagged inline with "ASSUMPTION:").
-- Left deliberately UNLINKED, pending your call (flagged inline with "OPEN:"):
--   - Features (no join table specified anywhere; likely needs a trainers_features table later)
--   - Afflictions (status conditions aren't in the "HP + move/ability uses" combat tracker scope)
--   - Catch_modifiers_hp / _battle_start / _ball (read directly by catch-formula logic, not stored as FKs)
--   - Breeding_modifiers (no breeding tables exist yet)

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- Reference tables
-- =========================================================================

create table sizes (
  id serial primary key,
  name text not null unique,
  description text
);

create table weights (
  id serial primary key,
  name text not null unique,
  description text
);

create table growth_rates (
  id serial primary key,
  name text not null unique,
  exp_modifier numeric not null,
  description text
);

create table habitats (
  id serial primary key,
  name text not null unique,
  description text
);

create table types (
  id serial primary key,
  name text not null unique,
  description text
);

-- Required sentinel row so Moves.type_id (not null) can represent typeless / type-shifting moves.
insert into types (name, description) values
  ('Special/Variable', 'Placeholder type for typeless moves or moves whose type changes at time of use')
on conflict (name) do nothing;

create table breeding_modifiers (
  id serial primary key,
  name text not null unique,
  friendship_level int,
  description text
);

create table stats (
  id serial primary key,
  name text not null unique,
  abbreviation text,
  description text
);

create table natures (
  id serial primary key,
  name text not null unique,
  increased_stat_id int references stats(id),
  decreased_stat_id int references stats(id),
  description text
);

create table catch_modifiers_hp (
  id serial primary key,
  name text not null unique,
  modifier int not null,
  description text
);

create table catch_modifiers_battle_start (
  id serial primary key,
  name text not null unique,
  modifier int not null,
  description text
);

create table catch_modifiers_ball (
  id serial primary key,
  name text not null unique,
  modifier int not null,
  description text
);

create table loyalties (
  id serial primary key,
  name text not null unique,
  description text
);

create table passives (
  id serial primary key,
  name text not null unique,
  description text
);

create table levels (
  level_number int primary key,
  cumulative_exp bigint not null
);

create table obtain_methods (
  id serial primary key,
  name text not null unique,
  description text
);

create table proficiencies (
  id serial primary key,
  name text not null unique,
  description text
);

create table afflictions (
  id serial primary key,
  name text not null unique,
  description text
);

create table classes (
  id serial primary key,
  name text not null unique,
  description text
);

create table subclasses (
  id serial primary key,
  class_id int not null references classes(id) on delete cascade,
  name text not null,
  description text,
  unique (class_id, name)
);

create table diets (
  id serial primary key,
  name text not null unique,
  description text
);

create table features (
  id serial primary key,
  name text not null unique,
  description text
);

create table origins (
  id serial primary key,
  name text not null unique,
  description text
);

create table egg_groups (
  id serial primary key,
  name text not null unique,
  description text
);

create table item_categories (
  id serial primary key,
  name text not null unique,
  description text
);

create table items (
  id serial primary key,
  name text not null unique,
  item_category_id int references item_categories(id),
  buyable boolean not null default false,
  description text
);

create table moves (
  id serial primary key,
  name text not null unique,
  type_id int not null references types(id),
  damage_stat text not null check (damage_stat in ('physical', 'special', 'either')),
  description text
);

-- ASSUMPTION: base stats stored as fixed columns rather than a Pokedex<->Stats join table,
-- since PTA3 has a fixed set of 6 stats and no relationship table was listed for this.
create table pokedex (
  id serial primary key,
  dex_number int not null unique,
  name text not null,
  type_1_id int not null references types(id),
  type_2_id int references types(id),
  size_id int references sizes(id),
  weight_id int references weights(id),
  growth_rate_id int references growth_rates(id),
  base_hp int not null,
  base_atk int not null,
  base_def int not null,
  base_sp_atk int not null,
  base_sp_def int not null,
  base_speed int not null,
  description text
);

-- =========================================================================
-- Relationship tables (reference <-> reference)
-- =========================================================================

create table pokedex_habitats (
  pokedex_id int not null references pokedex(id) on delete cascade,
  habitat_id int not null references habitats(id) on delete cascade,
  primary key (pokedex_id, habitat_id)
);

create table pokedex_moves (
  pokedex_id int not null references pokedex(id) on delete cascade,
  move_id int not null references moves(id) on delete cascade,
  primary key (pokedex_id, move_id)
);

create table pokedex_passives (
  pokedex_id int not null references pokedex(id) on delete cascade,
  passive_id int not null references passives(id) on delete cascade,
  primary key (pokedex_id, passive_id)
);

create table pokedex_proficiencies (
  pokedex_id int not null references pokedex(id) on delete cascade,
  proficiency_id int not null references proficiencies(id) on delete cascade,
  primary key (pokedex_id, proficiency_id)
);

create table pokedex_diets (
  pokedex_id int not null references pokedex(id) on delete cascade,
  diet_id int not null references diets(id) on delete cascade,
  primary key (pokedex_id, diet_id)
);

create table pokedex_egg_groups (
  pokedex_id int not null references pokedex(id) on delete cascade,
  egg_group_id int not null references egg_groups(id) on delete cascade,
  primary key (pokedex_id, egg_group_id)
);

create table moves_proficiencies (
  move_id int not null references moves(id) on delete cascade,
  proficiency_id int not null references proficiencies(id) on delete cascade,
  primary key (move_id, proficiency_id)
);

-- =========================================================================
-- Active tables (live campaign data)
-- =========================================================================

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- Keeps public.users in sync with auth.users on signup.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_auth_user();

-- ASSUMPTION: Classes/Subclasses/Origins attach directly to Trainers (one each per trainer),
-- which is why no Trainers_classes-style join table appeared in the relationship list.
create table trainers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  class_id int references classes(id),
  subclass_id int references subclasses(id),
  origin_id int references origins(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trainers_set_updated_at
  before update on trainers
  for each row execute procedure set_updated_at();

-- ASSUMPTION: Loyalty is tracked per-Pokemon (most natural fit for a reference table with no listed join table).
create table pokemon (
  id uuid primary key default gen_random_uuid(),
  pokedex_id int not null references pokedex(id),
  nickname text,
  level int not null default 1 references levels(level_number),
  current_exp bigint not null default 0,
  current_hp int not null,
  nature_id int references natures(id),
  loyalty_id int references loyalties(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pokemon_set_updated_at
  before update on pokemon
  for each row execute procedure set_updated_at();

-- Enforces "one owner at a time, no trade history": primary key on pokemon_id alone.
-- ASSUMPTION: obtain_method_id lives here since this is the only table an "Obtain_method" reference
-- table (caught / traded / bred / starter, etc.) would naturally attach to.
create table trainers_pokemon (
  trainer_id uuid not null references trainers(id) on delete cascade,
  pokemon_id uuid not null primary key references pokemon(id) on delete cascade,
  obtain_method_id int references obtain_methods(id),
  obtained_at timestamptz not null default now()
);

create table pokemon_moves (
  pokemon_id uuid not null references pokemon(id) on delete cascade,
  move_id int not null references moves(id) on delete cascade,
  uses_remaining int,
  resets_on text check (resets_on in ('turn', 'encounter', 'rest')),
  primary key (pokemon_id, move_id)
);

create table trainers_items (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references trainers(id) on delete cascade,
  item_id int not null references items(id),
  move_id int references moves(id),
  pokedex_id int references pokedex(id),
  quantity int not null default 1,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Indexes (FKs aren't auto-indexed in Postgres)
-- =========================================================================

create index on pokedex_habitats (habitat_id);
create index on pokedex_moves (move_id);
create index on pokedex_passives (passive_id);
create index on pokedex_proficiencies (proficiency_id);
create index on pokedex_diets (diet_id);
create index on pokedex_egg_groups (egg_group_id);
create index on moves_proficiencies (proficiency_id);
create index on trainers (user_id);
create index on pokemon (pokedex_id);
create index on trainers_pokemon (trainer_id);
create index on pokemon_moves (move_id);
create index on trainers_items (trainer_id);
create index on trainers_items (item_id);

-- =========================================================================
-- Row Level Security
-- =========================================================================

-- Reference & reference<->reference relationship tables: world-readable, writable only
-- via the service role (Studio / admin scripts), since they're "edited rarely".
do $$
declare
  t text;
begin
  foreach t in array array[
    'sizes', 'weights', 'growth_rates', 'habitats', 'types', 'breeding_modifiers', 'stats', 'natures',
    'catch_modifiers_hp', 'catch_modifiers_battle_start', 'catch_modifiers_ball', 'loyalties', 'passives',
    'levels', 'obtain_methods', 'proficiencies', 'afflictions', 'classes', 'subclasses', 'diets', 'features',
    'origins', 'egg_groups', 'item_categories', 'items', 'moves', 'pokedex',
    'pokedex_habitats', 'pokedex_moves', 'pokedex_passives', 'pokedex_proficiencies', 'pokedex_diets',
    'pokedex_egg_groups', 'moves_proficiencies'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('create policy "Public read access" on %I for select using (true);', t);
  end loop;
end $$;

-- Active tables: scoped to the owning user.

alter table users enable row level security;

create policy "Users can view own profile" on users
  for select using (auth.uid() = id);

create policy "Users can update own profile" on users
  for update using (auth.uid() = id);

alter table trainers enable row level security;

create policy "Trainers are managed by their owner" on trainers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table pokemon enable row level security;

-- Split by command: a new Pokemon row has no trainers_pokemon link yet at insert time,
-- so insert just requires being authenticated; select/update/delete require ownership.
create policy "Authenticated users can create pokemon" on pokemon
  for insert with check (auth.role() = 'authenticated');

create policy "Owners can view their pokemon" on pokemon
  for select using (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon.id and t.user_id = auth.uid()
    )
  );

create policy "Owners can update their pokemon" on pokemon
  for update using (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon.id and t.user_id = auth.uid()
    )
  );

create policy "Owners can delete their pokemon" on pokemon
  for delete using (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon.id and t.user_id = auth.uid()
    )
  );

alter table trainers_pokemon enable row level security;

create policy "Owner manages trainers_pokemon" on trainers_pokemon
  for all using (
    exists (select 1 from trainers t where t.id = trainers_pokemon.trainer_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from trainers t where t.id = trainers_pokemon.trainer_id and t.user_id = auth.uid())
  );

alter table pokemon_moves enable row level security;

create policy "Owner manages pokemon_moves" on pokemon_moves
  for all using (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon_moves.pokemon_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon_moves.pokemon_id and t.user_id = auth.uid()
    )
  );

alter table trainers_items enable row level security;

create policy "Owner manages trainers_items" on trainers_items
  for all using (
    auth.uid() = (select user_id from trainers where id = trainers_items.trainer_id)
  ) with check (
    auth.uid() = (select user_id from trainers where id = trainers_items.trainer_id)
  );
