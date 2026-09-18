-- [[Feature - Add triggers for a Pokemon to gain EXP automatically]]: the first-ever automated EXP
-- trigger -- a Pokemon gains EXP for using a Move in a combat Encounter, hit or miss, once per turn.
-- Amounts live in data (same "small named reference table" idiom as loyalty_point_events, obtain_methods,
-- growth_rates, etc.), GM-tunable per Campaign via the same override-table pattern
-- [[Feature - Allow a GM to change Loyalty settings]] already proved -- global default row(s), plus a
-- per-Campaign override that only exists once a GM actually retunes it.
create table exp_grant_events (
  id serial primary key,
  name text not null unique,
  exp int not null
);

-- First-pass, unplaytested number -- like the Loyalty point economy's own seed values, this is plain
-- data in a migration, trivial to retune later via the new Customization-page settings section rather
-- than something to get exactly right now (no PTA3 rulebook precedent exists for this amount).
insert into exp_grant_events (name, exp) values ('Move used', 2);

alter table exp_grant_events enable row level security;
create policy "Public read access" on exp_grant_events for select using (true);

create table campaign_exp_grant_overrides (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  event_id int not null references exp_grant_events(id) on delete cascade,
  exp int not null,
  primary key (campaign_id, event_id)
);

alter table campaign_exp_grant_overrides enable row level security;

create policy "Campaign members can view their campaign's exp grant overrides" on campaign_exp_grant_overrides
  for select using (is_campaign_member(campaign_id));

create policy "GM manages their campaign's exp grant overrides" on campaign_exp_grant_overrides
  for all using (is_campaign_gm(campaign_id))
  with check (is_campaign_gm(campaign_id));

-- Once-per-Pokemon-per-turn throttle (per the user, 2026-09-18): a combatant can only trigger the
-- Move-used grant once per Encounter turn, even if resolved multiple times in the same turn (e.g. a GM
-- re-resolving without advancing the tracker). Lives on encounter_combatants, not pokemon, since this is
-- a combat-session-scoped throttle, not a permanent Pokemon attribute -- resets naturally for the next
-- Encounter this Pokemon joins as a fresh combatant row. Nullable: no grant yet this Encounter at all.
alter table encounter_combatants add column last_exp_grant_turn_position int;
