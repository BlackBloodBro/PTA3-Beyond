-- [[Track Pokemon Likes and Dislikes]]: per-individual flavour preferences, rolled once at creation.
-- Reuses the existing `flavors` table (20260808150000_items_berries.sql, Dry/Bitter/Spicy/Sour/Sweet,
-- no stat link) rather than creating a duplicate one -- see the FR's Design note for why an earlier
-- draft's stat-linked table was wrong. One row per liked or disliked flavour (a Pokemon can have any
-- number of each independently, not a fixed pair) -- a neutral flavour simply has no row.
create table pokemon_flavor_preferences (
  pokemon_id uuid not null references pokemon(id) on delete cascade,
  flavor_id int not null references flavors(id) on delete cascade,
  liked boolean not null,
  primary key (pokemon_id, flavor_id)
);

create index on pokemon_flavor_preferences (flavor_id);

alter table pokemon_flavor_preferences enable row level security;

-- Mirrors pokemon_passives' 3-policy shape exactly (owner via trainers_pokemon, campaign GM, and the
-- creator of an unassigned pool Pokemon) -- same active-per-individual-Pokemon data shape.
create policy "Owner manages pokemon_flavor_preferences" on pokemon_flavor_preferences
  for all using (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon_flavor_preferences.pokemon_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon_flavor_preferences.pokemon_id and t.user_id = auth.uid()
    )
  );

create policy "GM manages campaign pokemon_flavor_preferences" on pokemon_flavor_preferences
  for all using (is_campaign_gm_for_pokemon(pokemon_id)) with check (is_campaign_gm_for_pokemon(pokemon_id));

create policy "Creator manages own unassigned pokemon's flavor preferences" on pokemon_flavor_preferences
  for all using (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_flavor_preferences.pokemon_id
        and p.created_by_user_id = auth.uid()
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  )
  with check (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_flavor_preferences.pokemon_id
        and p.created_by_user_id = auth.uid()
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  );
