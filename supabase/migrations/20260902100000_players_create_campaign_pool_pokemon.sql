-- [[Users should be able to add Pokemon to their Trainers in a Campaign]]: a player (not just a
-- campaign's GM) can now tag a new Pokemon into that campaign's pool via createPokemon (still
-- requiring the player to actually have a Trainer in that campaign) -- breaking the invariant every
-- existing "Creator manages own unassigned pokemon's X" policy relied on ("creator and campaign GM
-- are always the same person for a pool Pokemon", per 20260810160000's own comment). Without this,
-- a GM would be able to see a player-created pool Pokemon on the Wild Pokemon review page but not
-- actually manage it -- moves, passives, flavor preferences, and move grants would all still fail
-- RLS for anyone but its creator, the exact bug 20260810160000 fixed for GM-created ones.
--
-- Adds a sibling GM-scoped policy alongside each existing creator-scoped one, same shape, just
-- keyed off pokemon.campaign_id + is_campaign_gm() instead of created_by_user_id. Purely additive --
-- Postgres ORs multiple permissive policies together, same reasoning as gm_campaign_rls.sql.
create policy "GM manages own campaign's unassigned pokemon" on pokemon
  for all using (
    campaign_id is not null
    and is_campaign_gm(campaign_id)
    and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = pokemon.id)
  ) with check (
    campaign_id is not null and is_campaign_gm(campaign_id)
  );

create policy "GM manages own campaign's unassigned pokemon's moves" on pokemon_moves
  for all using (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_moves.pokemon_id
        and p.campaign_id is not null
        and is_campaign_gm(p.campaign_id)
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  )
  with check (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_moves.pokemon_id
        and p.campaign_id is not null
        and is_campaign_gm(p.campaign_id)
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  );

create policy "GM manages own campaign's unassigned pokemon's passives" on pokemon_passives
  for all using (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_passives.pokemon_id
        and p.campaign_id is not null
        and is_campaign_gm(p.campaign_id)
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  )
  with check (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_passives.pokemon_id
        and p.campaign_id is not null
        and is_campaign_gm(p.campaign_id)
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  );

create policy "GM manages own campaign's unassigned pokemon's flavor preferences" on pokemon_flavor_preferences
  for all using (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_flavor_preferences.pokemon_id
        and p.campaign_id is not null
        and is_campaign_gm(p.campaign_id)
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  )
  with check (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_flavor_preferences.pokemon_id
        and p.campaign_id is not null
        and is_campaign_gm(p.campaign_id)
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  );

create policy "GM manages own campaign's unassigned pokemon's move grants" on pokemon_move_grants
  for all using (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_move_grants.pokemon_id
        and p.campaign_id is not null
        and is_campaign_gm(p.campaign_id)
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  )
  with check (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_move_grants.pokemon_id
        and p.campaign_id is not null
        and is_campaign_gm(p.campaign_id)
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  );
