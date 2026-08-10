-- Bug fix, part of [[Bug - Improve Wild Pokemon creation and editing]]: editing a Wild/pool Pokemon's
-- moves or passives fails with an RLS policy violation. Root cause -- "GM manages campaign
-- pokemon_moves"/"pokemon_passives" (20260725140000_gm_campaign_rls.sql) both resolve authority
-- exclusively via is_campaign_gm_for_pokemon, which joins through trainers_pokemon; an unassigned
-- Wild/pool Pokemon (exactly the ones being edited here) never has one, so there is no policy at all
-- covering that case. Same gap the labels fix (20260729120000_npcs_and_labels.sql) already found and
-- worked around once for pokemon_labels.
--
-- Mirrors "Creator manages their own unassigned pokemon" (20260727100000_pokemon_pool.sql) exactly,
-- joined through to the owning Pokemon -- creator and campaign GM are always the same person for a
-- pool Pokemon today (only a campaign's GM can tag one with that campaign_id in the first place, per
-- createPokemon), the same invariant that policy itself already relies on.
create policy "Creator manages own unassigned pokemon's moves" on pokemon_moves
  for all using (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_moves.pokemon_id
        and p.created_by_user_id = auth.uid()
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  )
  with check (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_moves.pokemon_id
        and p.created_by_user_id = auth.uid()
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  );

create policy "Creator manages own unassigned pokemon's passives" on pokemon_passives
  for all using (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_passives.pokemon_id
        and p.created_by_user_id = auth.uid()
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  )
  with check (
    exists (
      select 1 from pokemon p
      where p.id = pokemon_passives.pokemon_id
        and p.created_by_user_id = auth.uid()
        and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
    )
  );
