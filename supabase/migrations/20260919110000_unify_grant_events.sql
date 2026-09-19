-- [[Feature - Add more automated EXP and Loyalty Point triggers]]: per the user, every automated
-- trigger condition should be able to grant BOTH EXP and LP (not just whichever one it happened to be
-- built for first), and every default -- including the 4 already-shipped ones -- resets to 0 so a GM
-- always has to opt in ("GM should always be able to decide"). Rather than keep exp_grant_events and
-- loyalty_point_events as two near-duplicate per-condition tables (each would need the other's column
-- bolted on, and "Move used"/"Sleep"/etc. would exist as two independent name strings that could drift),
-- this unifies them into one grant_events table with both amounts, plus one override table per amount
-- type (keeping the existing NOT NULL / delete-row-on-reset override shape, just retargeted).
create table grant_events (
  id serial primary key,
  name text not null unique,
  exp int not null default 0,
  loyalty_points int not null default 0
);

insert into grant_events (name, exp, loyalty_points) values
  ('Move used', 0, 0),
  ('Sleep', 0, 0),
  ('Pokemon Center (damaged)', 0, 0),
  ('Fainted', 0, 0),
  ('Evolved', 0, 0);

alter table grant_events enable row level security;
create policy "Public read access" on grant_events for select using (true);

create table campaign_grant_event_exp_overrides (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  event_id int not null references grant_events(id) on delete cascade,
  exp int not null,
  primary key (campaign_id, event_id)
);

alter table campaign_grant_event_exp_overrides enable row level security;

create policy "Campaign members can view their campaign's grant event EXP overrides" on campaign_grant_event_exp_overrides
  for select using (is_campaign_member(campaign_id));

create policy "GM manages their campaign's grant event EXP overrides" on campaign_grant_event_exp_overrides
  for all using (is_campaign_gm(campaign_id))
  with check (is_campaign_gm(campaign_id));

create table campaign_grant_event_loyalty_overrides (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  event_id int not null references grant_events(id) on delete cascade,
  loyalty_points int not null,
  primary key (campaign_id, event_id)
);

alter table campaign_grant_event_loyalty_overrides enable row level security;

create policy "Campaign members can view their campaign's grant event LP overrides" on campaign_grant_event_loyalty_overrides
  for select using (is_campaign_member(campaign_id));

create policy "GM manages their campaign's grant event LP overrides" on campaign_grant_event_loyalty_overrides
  for all using (is_campaign_gm(campaign_id))
  with check (is_campaign_gm(campaign_id));

-- Carry over any live campaign overrides on the two old tables before dropping them -- confirmed via
-- direct query that only one exists today (Fainted LP overridden to -2 on one live campaign), but this
-- is written generically rather than hardcoded to that one row.
insert into campaign_grant_event_loyalty_overrides (campaign_id, event_id, loyalty_points)
select clo.campaign_id, ge.id, clo.points
from campaign_loyalty_event_overrides clo
join loyalty_point_events lpe on lpe.id = clo.event_id
join grant_events ge on ge.name = lpe.name;

insert into campaign_grant_event_exp_overrides (campaign_id, event_id, exp)
select ceo.campaign_id, ge.id, ceo.exp
from campaign_exp_grant_overrides ceo
join exp_grant_events ege on ege.id = ceo.event_id
join grant_events ge on ge.name = ege.name;

drop table campaign_loyalty_event_overrides;
drop table campaign_exp_grant_overrides;
drop table loyalty_point_events;
drop table exp_grant_events;

-- [[Feature - Add more automated EXP and Loyalty Point triggers]]: the Fainted trigger now also grants
-- EXP, but adjustPokemonHp's own combat write can fall through to this RPC (see
-- 20260914180000_combat_hp_write_access.sql's own reasoning -- a regular campaign member damaging a
-- combatant they don't own can't satisfy pokemon's plain owner-or-GM UPDATE policy). Added as a new
-- optional trailing parameter via create-or-replace rather than dropping the function, so this stays a
-- pure additive signature change.
create or replace function apply_combat_pokemon_hp(
  target_pokemon_id uuid, new_current_hp int, new_temporary_hp int, new_loyalty_points int, new_current_exp int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id from pokemon where id = target_pokemon_id;

  if v_campaign_id is null then
    raise exception 'Pokemon not found';
  end if;

  if not is_campaign_member(v_campaign_id) then
    raise exception 'Not a member of this campaign';
  end if;

  if not exists (
    select 1
    from encounter_combatants ec
    join encounters e on e.id = ec.encounter_id
    where ec.pokemon_id = target_pokemon_id and e.campaign_id = v_campaign_id and e.status = 'active'
  ) then
    raise exception 'This Pokemon is not currently a combatant in an active encounter';
  end if;

  update pokemon set
    current_hp = new_current_hp,
    temporary_hp = new_temporary_hp,
    loyalty_points = new_loyalty_points,
    current_exp = coalesce(new_current_exp, current_exp)
  where id = target_pokemon_id;
end;
$$;

grant execute on function apply_combat_pokemon_hp(uuid, int, int, int, int) to authenticated;
