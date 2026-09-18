-- [[Feature - GM can restrict global catalog entries from a Campaign]]: lets a GM mark specific
-- global Pokemon species as not part of their Campaign's world. Scoped to the Pokedex only (2026-09-18
-- product decision) -- the other eight "GM Custom" catalogs are left as candidate future FRs.
--
-- An exclusion LIST, not an inclusion allowlist -- a GM toggles off the handful of global species they
-- don't want, rather than toggling on the ~985 they do. No FK constraint tying pokedex_id to a global
-- (campaign_id is null) row specifically -- the GM-facing UI only ever offers global species to
-- exclude, and excluding a Campaign's own custom species would be meaningless (the GM would just
-- delete it), so this is left as a UI-level guarantee rather than a DB one, same trade-off this
-- codebase already makes elsewhere for "the form only ever offers valid choices" cases.
create table campaign_excluded_pokedex (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  pokedex_id int not null references pokedex(id) on delete cascade,
  excluded_at timestamptz not null default now(),
  primary key (campaign_id, pokedex_id)
);

alter table campaign_excluded_pokedex enable row level security;

-- Read access: both the GM and their players need this to compute "which species are unavailable in
-- this Campaign" client/server-side (the Pokedex browser, the starter/pool species pickers) -- mirrors
-- "Campaign members can view their campaign's custom species" from 20260916100000_gm_custom_pokedex.sql.
create policy "Campaign members can view their campaign's excluded species" on campaign_excluded_pokedex
  for select using (is_campaign_member(campaign_id));

-- Write access: GM-only, matching every other "GM manages their campaign's X" policy in the GM Custom
-- family. `for all` also covers select, so the GM doesn't need the policy above to read their own
-- Campaign's exclusions.
create policy "GM manages their campaign's excluded species" on campaign_excluded_pokedex
  for all using (is_campaign_gm(campaign_id))
  with check (is_campaign_gm(campaign_id));
