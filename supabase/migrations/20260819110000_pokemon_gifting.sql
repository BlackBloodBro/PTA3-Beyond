-- [[Add Pokemon gifting]]: 'Traded' obtain method renamed to 'Gifted' -- pure data rename (confirmed
-- via full repo grep that no application code string-matches on 'Traded'), gifting sets this on the
-- destination automatically per Design.
update obtain_methods set name = 'Gifted' where name = 'Traded';

-- Original trainer -- a narrow, permanent-once-set exception to this app's "no trade history"
-- convention, needed so gifting a Pokemon back to its original trainer can revert its obtain method
-- instead of setting 'Gifted' again (mirrors the mainline games' "traded back to the OT" logic). Set
-- once, application-level (TS), at whichever of the 3 known insert sites first links a Pokemon to a
-- Trainer -- this schema has no precedent for "set once" via a DB trigger, so this follows the same
-- convention as everything else here.
alter table pokemon add column original_trainer_id uuid references trainers(id) on delete set null;
alter table pokemon add column original_obtain_method_id int references obtain_methods(id);

-- Backfill: existing Pokemon that already have a trainers_pokemon row get their *current*
-- trainer/obtain method as their "original" -- the honest answer for data with no real earlier
-- history to look back on.
update pokemon set
  original_trainer_id = tp.trainer_id,
  original_obtain_method_id = tp.obtain_method_id
from trainers_pokemon tp
where tp.pokemon_id = pokemon.id;

-- The existing "Owner manages trainers_pokemon" policy's WITH CHECK ties trainer_id to auth.uid() on
-- BOTH sides of an update (correct for every other owner-initiated action, like updating
-- obtain_method_id/party_slot on a Pokemon that stays with the same trainer) -- which blocks exactly
-- the new capability this FR needs: a Trainer's owner moving a trainers_pokemon row to a DIFFERENT
-- trainer they don't own, within the same Campaign, without that destination trainer's own owner/GM
-- separately authorizing it (per Design -- gifting your own Pokemon is the giver's call to make).
create or replace function owns_a_trainer_in_same_campaign_as(target_trainer_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from trainers mine
    join trainers target on target.id = target_trainer_id
    where mine.user_id = auth.uid()
      and mine.campaign_id is not null
      and mine.campaign_id = target.campaign_id
  );
$$;

-- USING still requires owning the row's pre-update trainer (the Pokemon being gifted must actually
-- be theirs); WITH CHECK is satisfied by owning *any* trainer in the destination's campaign (WITH
-- CHECK only ever sees the post-update row, so it can't reference the specific pre-update trainer_id
-- directly) -- same "RLS is the outer safety net, the app action is the precise gate" split already
-- used throughout this codebase (giftPokemon itself re-validates same-campaign + not-already-owner).
create policy "Owner gifts trainers_pokemon within campaign" on trainers_pokemon
  for update
  using (
    exists (select 1 from trainers t where t.id = trainers_pokemon.trainer_id and t.user_id = auth.uid())
  )
  with check (
    owns_a_trainer_in_same_campaign_as(trainer_id)
  );
