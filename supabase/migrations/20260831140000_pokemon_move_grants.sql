-- [[Let a GM force-teach any Move]]: a GM grants a specific Pokemon eligibility to learn a Move it
-- wouldn't otherwise qualify for (no level/Proficiency match) -- existence of a row is the whole
-- grant, no other columns needed. The Trainer still teaches it themselves through the existing
-- learnMove flow, spending one of their own 6 move slots whenever they choose.

create table pokemon_move_grants (
  pokemon_id uuid not null references pokemon(id) on delete cascade,
  move_id int not null references moves(id) on delete cascade,
  primary key (pokemon_id, move_id)
);

alter table pokemon_move_grants enable row level security;

-- Owner: read-only -- so the Trainer can see a granted move is available, but only the GM can
-- create/remove a grant. Mirrors "Owner manages pokemon_moves" (initial_schema.sql) minus the
-- write half.
create policy "Owner can view own pokemon_move_grants" on pokemon_move_grants
  for select using (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon_move_grants.pokemon_id and t.user_id = auth.uid()
    )
  );

-- GM: full manage, for a Trainer/NPC-owned Pokemon whose Trainer belongs to a Campaign. Mirrors
-- "GM manages campaign pokemon_moves" (gm_campaign_rls.sql).
create policy "GM manages campaign pokemon_move_grants" on pokemon_move_grants
  for all using (is_campaign_gm_for_pokemon(pokemon_id)) with check (is_campaign_gm_for_pokemon(pokemon_id));

-- Creator: full manage, for an unassigned Wild/pool Pokemon (no trainers_pokemon row, so
-- is_campaign_gm_for_pokemon above never matches) -- same gap and same fix shape as
-- pool_pokemon_moves_passives_rls.sql for pokemon_moves/pokemon_passives.
create policy "Creator manages own unassigned pokemon's move grants" on pokemon_move_grants
  for all using (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_move_grants.pokemon_id
        and p.created_by_user_id = auth.uid()
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  )
  with check (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_move_grants.pokemon_id
        and p.created_by_user_id = auth.uid()
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  );
