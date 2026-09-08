-- [[Feature - Add attack resolution to combat encounters]]: resolving an Accuracy Check needs a
-- *target's* fully-effective stat (active Afflictions, active stat-Passives for a Pokemon; stat
-- increase history for a Trainer), not just their base columns -- but none of pokemon_afflictions,
-- pokemon_passives, or trainer_milestones have any campaign-member visibility today, only Owner and
-- Campaign-GM (confirmed directly against pg_policies, not assumed). A Campaign member targeting an
-- enemy's Pokemon, or even a fellow player's, would hit a wall here without this. Mirrors the
-- tracker's own "member can view an active encounter's combatant" shape exactly (see
-- 20260907100000_combat_encounters.sql's "Members can view active encounter enemy pokemon/trainers"),
-- just extended to these two extra Pokemon-side tables plus the one Trainer-side table.
create policy "Members can view active encounter combatant afflictions" on pokemon_afflictions
  for select using (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.pokemon_id = pokemon_afflictions.pokemon_id and e.status = 'active' and is_campaign_member(e.campaign_id)
    )
  );

create policy "Members can view active encounter combatant passives" on pokemon_passives
  for select using (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.pokemon_id = pokemon_passives.pokemon_id and e.status = 'active' and is_campaign_member(e.campaign_id)
    )
  );

create policy "Members can view active encounter combatant milestones" on trainer_milestones
  for select using (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.trainer_id = trainer_milestones.trainer_id and e.status = 'active' and is_campaign_member(e.campaign_id)
    )
  );
