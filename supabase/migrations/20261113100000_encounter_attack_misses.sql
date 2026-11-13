-- [[Feature - Apply Constructive Criticism's accuracy bonus in Encounters (Ace trainer)]]: the live miss streaks the
-- Feature needs -- "whenever your Pokemon misses with an attack, the next time they use that attack on the same
-- target add 2 to their Accuracy Check; stacks while it keeps missing, resets on a hit".
--
-- One row per (attacking combatant, target combatant, Move) while a streak is live, holding how many misses in a row.
-- Rows only exist for attackers whose owning Trainer has the Feature. Both combatant FKs cascade, so a streak vanishes
-- when either combatant leaves or the Encounter is deleted; "Reset to draft" also clears them in the app.
create table encounter_attack_misses (
  attacker_combatant_id uuid not null references encounter_combatants(id) on delete cascade,
  target_combatant_id uuid not null references encounter_combatants(id) on delete cascade,
  move_id int not null references moves(id) on delete cascade,
  misses int not null check (misses > 0),
  primary key (attacker_combatant_id, target_combatant_id, move_id)
);

create index on encounter_attack_misses (target_combatant_id);

alter table encounter_attack_misses enable row level security;

-- Readable by the GM and, while the Encounter is active, by any Campaign member (same reach as the combatants).
create policy "View encounter attack misses" on encounter_attack_misses
  for select using (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.id = encounter_attack_misses.attacker_combatant_id
        and (is_campaign_gm(e.campaign_id) or (e.status = 'active' and is_campaign_member(e.campaign_id)))
    )
  );

-- Written by whoever resolves the attack: the GM, or the owner of the attacking Pokemon. No privileged function is
-- needed -- the attacker's owner already has rights over their own combatant (owns_encounter_combatant_target).
create policy "GM manages encounter attack misses" on encounter_attack_misses
  for all using (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.id = encounter_attack_misses.attacker_combatant_id and is_campaign_gm(e.campaign_id)
    )
  ) with check (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.id = encounter_attack_misses.attacker_combatant_id and is_campaign_gm(e.campaign_id)
    )
  );

create policy "Attacker's owner manages their encounter attack misses" on encounter_attack_misses
  for all using (
    exists (
      select 1 from encounter_combatants ec
      where ec.id = encounter_attack_misses.attacker_combatant_id and owns_encounter_combatant_target(ec.trainer_id, ec.pokemon_id)
    )
  ) with check (
    exists (
      select 1 from encounter_combatants ec
      where ec.id = encounter_attack_misses.attacker_combatant_id and owns_encounter_combatant_target(ec.trainer_id, ec.pokemon_id)
    )
  );
