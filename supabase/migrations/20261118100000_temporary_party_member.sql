-- [[Improvement - Let a GM temporarily add an NPC to the party]]: a GM can mark one of their campaign's NPCs as
-- travelling with the party for a while. While that's true, the NPC's Pokemon count as part of the party for
-- Breeding (lib/pta3/breeding.ts loadCampaignBreedingCandidates). A narrower flag than flipping is_npc itself, so
-- nothing else is_npc drives (GM dashboard grouping, Labels, NPC routes) changes.
--
-- Purely additive (a new defaulted column plus extra SELECT-only policies), so it's safe against whatever code is
-- currently live on `production`.
alter table trainers add column is_temporary_party_member boolean not null default false;

-- Visibility. Breeding loads its candidates with the *player's* own client, and until now RLS hid both:
--   1. NPCs entirely -- "Campaign members can view fellow players' trainers"/"...pokemon"
--      (20260726100000_campaign_fellow_player_visibility.sql) exclude every GM-owned Trainer by design.
--   2. Fellow players' trainers_pokemon links and pokemon_afflictions -- only the owner and the GM could read
--      those, so a player's Breeding page only ever listed their own Pokemon (and the existing fellow-player
--      pokemon policy, whose subquery reads trainers_pokemon under the player's own RLS, matched nothing).
-- Both are fixed here with read-only access for campaign *members* (players; the GM already sees everything via
-- 20260725140000_gm_campaign_rls.sql). Nothing here grants any write access.

-- Is this Trainer part of the party, from the current player's point of view: a joined member of its Campaign,
-- and the Trainer is either a fellow player's (not owned by the Campaign's GM) or an NPC currently travelling
-- with the party. security definer so policies on trainers_pokemon/pokemon/pokemon_afflictions can call it
-- without re-entering trainers' own RLS.
create or replace function is_party_trainer_for_member(target_trainer_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from trainers t
    join campaigns c on c.id = t.campaign_id
    where t.id = target_trainer_id
      and is_campaign_member(t.campaign_id)
      and (t.user_id <> c.gm_user_id or t.is_temporary_party_member)
  );
$$;

create or replace function is_party_pokemon_for_member(target_pokemon_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from trainers_pokemon tp
    where tp.pokemon_id = target_pokemon_id
      and is_party_trainer_for_member(tp.trainer_id)
  );
$$;

-- The NPC's own Trainer row (its name shows in the Breeding picker). Fellow players' rows are already covered by
-- the existing fellow-players policy.
create policy "Campaign members can view temporary party NPCs" on trainers
  for select using (
    is_temporary_party_member
    and campaign_id is not null
    and is_campaign_member(campaign_id)
  );

create policy "Campaign members can view party trainers_pokemon" on trainers_pokemon
  for select using (is_party_trainer_for_member(trainer_id));

-- Overlaps the existing fellow-players pokemon policy (harmless, policies are OR'd) and adds party NPCs' Pokemon.
create policy "Campaign members can view party pokemon" on pokemon
  for select using (is_party_pokemon_for_member(id));

-- attemptBreedingCheck re-checks afflictions server-side with the player's client, so these must be readable too.
create policy "Campaign members can view party pokemon afflictions" on pokemon_afflictions
  for select using (is_party_pokemon_for_member(pokemon_id));
