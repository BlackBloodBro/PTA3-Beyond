-- Campaign GM dashboard: NPCs (full trainer sheets the GM owns directly, no login account of
-- their own) and Labels (colored, per-campaign, shared between NPCs and Pokemon -- e.g. tagging
-- everything by which island it belongs to).

-- is_npc is purely a display/query discriminator, NOT an access-control flag. NPCs are always
-- inserted with user_id = the creating GM's own auth.uid(), so the existing owner policy
-- ("Trainers are managed by their owner", 20260724120000_initial_schema.sql) already grants that
-- GM full CRUD on the row, and the existing fellow-player-visibility exclusion
-- (is_trainer_owned_by_campaign_gm, 20260726100000_campaign_fellow_player_visibility.sql) already
-- hides any GM-owned trainer from players -- its own comment already anticipated this case ("an
-- NPC ally or GM PC"). No new RLS is needed on trainers itself.
alter table trainers add column is_npc boolean not null default false;

create index on trainers (campaign_id, is_npc);

create table campaign_labels (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name text not null,
  -- Fixed palette (not a free hex picker) so every chip renders with guaranteed readable contrast,
  -- and so the frontend can map each name to a static, literal Tailwind class string -- Tailwind's
  -- JIT scanner can't discover a dynamically-built `bg-${color}-100` class string, so the palette
  -- here must exactly match the Record<PaletteColor, string> lookup in lib/pta3/labelColors.ts.
  color text not null default 'gray' check (
    color in ('red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'pink', 'gray')
  ),
  created_at timestamptz not null default now(),
  unique (campaign_id, name)
);

-- Unlike trainers.campaign_id (set null on campaign delete, so a player's trainer survives), a
-- label has no meaning without its campaign, so this cascades.
create table trainer_labels (
  trainer_id uuid not null references trainers(id) on delete cascade,
  label_id uuid not null references campaign_labels(id) on delete cascade,
  primary key (trainer_id, label_id)
);

create table pokemon_labels (
  pokemon_id uuid not null references pokemon(id) on delete cascade,
  label_id uuid not null references campaign_labels(id) on delete cascade,
  primary key (pokemon_id, label_id)
);

alter table campaign_labels enable row level security;
alter table trainer_labels enable row level security;
alter table pokemon_labels enable row level security;

-- Reuses is_campaign_gm (20260725130100_fix_campaign_rls_recursion.sql) and
-- is_campaign_gm_for_trainer (20260725140000_gm_campaign_rls.sql).
create policy "GM manages campaign labels" on campaign_labels
  for all using (is_campaign_gm(campaign_id)) with check (is_campaign_gm(campaign_id));

create policy "GM manages trainer labels" on trainer_labels
  for all using (is_campaign_gm_for_trainer(trainer_id)) with check (is_campaign_gm_for_trainer(trainer_id));

-- Deliberately NOT is_campaign_gm_for_pokemon -- that helper resolves via trainers_pokemon, which
-- an unassigned Wild Pokemon (exactly what needs labeling) doesn't have. Goes through the label's
-- own campaign_id instead.
--
-- Note: this does not verify the labeled Pokemon/trainer's own campaign_id actually matches the
-- label's campaign_id -- a GM running two campaigns could in theory tag a Campaign-A Pokemon with
-- a Campaign-B label. Not a security hole (same GM either way), just a data-integrity nicety left
-- to the UI (label pickers only ever list the current campaign's labels), not the DB.
create policy "GM manages pokemon labels" on pokemon_labels
  for all using (
    exists (select 1 from campaign_labels cl where cl.id = pokemon_labels.label_id and is_campaign_gm(cl.campaign_id))
  )
  with check (
    exists (select 1 from campaign_labels cl where cl.id = pokemon_labels.label_id and is_campaign_gm(cl.campaign_id))
  );
