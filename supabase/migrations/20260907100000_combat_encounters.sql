-- [[Feature - Add a combat encounter tracker]]: groups Trainers/Pokemon (allies) and Wild/enemy
-- Pokemon or NPCs (enemies) into one persisted, turn-ordered combat encounter, scoped to a Campaign.
-- A GM can prepare multiple Encounters ahead of time (`status = 'draft'`); only one can ever be
-- `active` per Campaign at a time (enforced below, not just in app code); `ended` Encounters are kept,
-- never deleted, same "history stays" convention as trainer_milestones.
create table encounters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'ended')),
  current_turn_position int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create index on encounters (campaign_id);
-- Unaffected by however many 'draft'/'ended' encounters exist alongside it -- only 'active' rows
-- compete for this constraint.
create unique index encounters_one_active_per_campaign on encounters (campaign_id) where status = 'active';

alter table encounters enable row level security;

-- A combatant is either a Trainer or a Pokemon, never a new concept of its own -- trainer_id xor
-- pokemon_id. An enemy Pokemon combatant is a real `pokemon` row exactly like any other (the
-- Campaign's existing Wild/pool Pokemon); an enemy Trainer combatant is a real NPC. turn_order is
-- always derived (never GM-typed): a Pokemon's from its own effective Speed stat, a Trainer's from a
-- physical d20 roll + Speed modifier -- see lib/pta3/pokemonStats.ts and the app-level turn-order
-- logic that calls it; this table only stores the resulting int. is_down means "hit 0 HP," not
-- "left/recalled" -- a combatant leaving the encounter is a real row delete, not a flag.
create table encounter_combatants (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references encounters(id) on delete cascade,
  side text not null check (side in ('ally', 'enemy')),
  trainer_id uuid references trainers(id) on delete cascade,
  pokemon_id uuid references pokemon(id) on delete cascade,
  turn_order int not null,
  is_down boolean not null default false,
  created_at timestamptz not null default now(),
  check ((trainer_id is null) <> (pokemon_id is null))
);

create index on encounter_combatants (encounter_id);

alter table encounter_combatants enable row level security;

-- Helper: is auth.uid() the GM of this encounter's own campaign?
create or replace function is_campaign_gm_for_encounter(target_encounter_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from encounters e where e.id = target_encounter_id and is_campaign_gm(e.campaign_id)
  );
$$;

-- Helper: is auth.uid() a joined member of this encounter's campaign, AND is the encounter actually
-- active? Drafts and ended encounters are never member-visible -- see the FR's own resolved design.
create or replace function is_active_campaign_member_encounter(target_encounter_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from encounters e
    where e.id = target_encounter_id and e.status = 'active' and is_campaign_member(e.campaign_id)
  );
$$;

-- Helper: does auth.uid() own the Trainer/Pokemon a combatant row would point at -- exactly one of
-- the two args is ever non-null, mirroring encounter_combatants' own xor check. Backs the player
-- self-service join/send-out-Pokemon/leave/recall actions (only ever their own stuff).
create or replace function owns_encounter_combatant_target(target_trainer_id uuid, target_pokemon_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    (target_trainer_id is not null and exists (
      select 1 from trainers t where t.id = target_trainer_id and t.user_id = auth.uid()
    ))
    or
    (target_pokemon_id is not null and exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = target_pokemon_id and t.user_id = auth.uid()
    ));
$$;

-- GM: full manage over every Encounter (any status) in their own Campaign -- create/name/prep,
-- add/remove any combatant, start, advance turn, end.
create policy "GM manages campaign encounters" on encounters
  for all using (is_campaign_gm(campaign_id)) with check (is_campaign_gm(campaign_id));

create policy "GM manages campaign encounter combatants" on encounter_combatants
  for all using (is_campaign_gm_for_encounter(encounter_id)) with check (is_campaign_gm_for_encounter(encounter_id));

-- Members: view-only on the campaign's *active* Encounter -- a draft is GM-eyes-only, never surfaced.
create policy "Members can view the active campaign encounter" on encounters
  for select using (status = 'active' and is_campaign_member(campaign_id));

create policy "Members can view active encounter combatants" on encounter_combatants
  for select using (is_active_campaign_member_encounter(encounter_id));

-- [[Feature - Add a combat encounter tracker]]: self-service join (own Trainer) / send-out (own Team
-- Pokemon) / leave / recall on an *active* encounter -- a real widening beyond GM-only, resolved with
-- the user during the pre-build design review, scoped strictly to a member's own stuff.
create policy "Members can join an active encounter with their own combatants" on encounter_combatants
  for insert with check (
    is_active_campaign_member_encounter(encounter_id)
    and owns_encounter_combatant_target(trainer_id, pokemon_id)
  );

create policy "Members can remove their own active encounter combatants" on encounter_combatants
  for delete using (
    is_active_campaign_member_encounter(encounter_id)
    and owns_encounter_combatant_target(trainer_id, pokemon_id)
  );

-- Without these, a Campaign member couldn't actually read the Pokemon/Trainer an *enemy* combatant
-- points at: an enemy Pokemon is typically an unassigned Wild/pool Pokemon (visible only to its
-- creator today, see 20260727100000_pokemon_pool.sql), and an enemy Trainer is typically an NPC
-- (explicitly excluded from "Campaign members can view fellow players' trainers", see
-- 20260726100000_campaign_fellow_player_visibility.sql, since that policy is for fellow *players*
-- only). A fellow player's own ally Trainer/Pokemon is already visible via that existing policy, so
-- this only needs to cover the GM-owned side.
create policy "Members can view active encounter enemy pokemon" on pokemon
  for select using (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.pokemon_id = pokemon.id and e.status = 'active' and is_campaign_member(e.campaign_id)
    )
  );

create policy "Members can view active encounter enemy trainers" on trainers
  for select using (
    exists (
      select 1 from encounter_combatants ec
      join encounters e on e.id = ec.encounter_id
      where ec.trainer_id = trainers.id and e.status = 'active' and is_campaign_member(e.campaign_id)
    )
  );
