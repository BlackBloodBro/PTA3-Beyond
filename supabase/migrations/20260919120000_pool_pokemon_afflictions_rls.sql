-- [[Bug - Applying an Affliction to an unassigned pool Pokemon fails]]: toggling any Affliction on an
-- unassigned (pool) Pokemon fails with an RLS policy violation. Root cause -- "Owner manages
-- pokemon_afflictions" (20260724130000_features_and_afflictions.sql) resolves ownership exclusively via
-- trainers_pokemon -> trainers.user_id; an unassigned pool Pokemon never has a trainers_pokemon row, so
-- there is no policy at all covering that case. Same gap the moves/passives fix
-- (20260810160000_pool_pokemon_moves_passives_rls.sql) already found and fixed for those two tables --
-- pokemon_afflictions was simply never included in it at the time. Mirrors that fix's exact shape.
create policy "Creator manages own unassigned pokemon's afflictions" on pokemon_afflictions
  for all using (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_afflictions.pokemon_id
        and p.created_by_user_id = auth.uid()
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  )
  with check (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_afflictions.pokemon_id
        and p.created_by_user_id = auth.uid()
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  );
