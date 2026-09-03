-- [[Bug - GM Grant a Move fails for campaign-less Trainers]]: `grantMoveEligibility`'s app-level
-- authorization already lets a campaign-less Trainer's own owner act as their own GM (`isGM = campaign
-- ? realGM : owner`, matching the "no GM to defer to" precedent used everywhere else -- Class/Origin/
-- base-stat edits) -- but pokemon_move_grants' RLS never got a matching policy, so the write was
-- rejected even after passing app-level authorization.
--
-- Deliberately NOT a blanket "Owner manages" policy like pokemon_moves has -- granting extra move
-- eligibility is meant to stay GM-adjudicated whenever a real GM exists (the whole point of
-- [[Let a GM force-teach any Move]]), unlike teaching an already-eligible move, which is an everyday
-- owner-or-GM action regardless of campaign. This policy only ever grants owner access when the
-- Trainer has no campaign at all, mirroring the app-level check's own campaign-aware branch exactly.
create policy "Owner manages own campaign-less pokemon's move grants" on pokemon_move_grants
  for all using (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon_move_grants.pokemon_id
        and t.user_id = auth.uid()
        and t.campaign_id is null
    )
  )
  with check (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon_move_grants.pokemon_id
        and t.user_id = auth.uid()
        and t.campaign_id is null
    )
  );
