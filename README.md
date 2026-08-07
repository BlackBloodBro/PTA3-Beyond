# PTA3 Tool

Character/Pokémon sheet manager, lightweight combat tracker (HP + move/ability uses), and reference
database for Pokémon Tabletop Adventures 3. Next.js (App Router) + Supabase (Postgres + Auth).

## Prerequisites

This scaffold was written by hand — Node.js and the Supabase CLI are not installed on the machine
it was generated on, so nothing has been run yet. You'll need:

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/installation) (`npm install -g pnpm` if you don't have it)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (for local dev / migrations)
- A Supabase project (or the local `supabase start` stack)

## Setup

```bash
pnpm install
```

Copy the env template and fill in your project's values (Project Settings → API in the Supabase dashboard):

```bash
cp .env.local.example .env.local
```

Run the dev server:

```bash
pnpm dev
```

## Database

The initial schema lives in [`supabase/migrations/20260724120000_initial_schema.sql`](supabase/migrations/20260724120000_initial_schema.sql).

If this repo doesn't have a linked Supabase project yet:

```bash
supabase init      # only if supabase/config.toml doesn't already exist
supabase link --project-ref your-project-ref
supabase db push   # applies the migration
```

For local development against the Supabase CLI's Docker stack instead:

```bash
supabase start
supabase db reset  # applies all migrations to the local stack
```

After the schema changes, regenerate types:

```bash
pnpm db:types
```

## Schema overview

- **Reference tables** — static game data (Types, Moves, Items, Pokedex, etc.), edited rarely. Publicly
  readable, writable only via the Supabase service role (Studio or an admin script).
- **Relationship tables** — many-to-many links between reference data (e.g. `pokedex_moves` for
  learnsets), plus the two "extended" join tables that track live state: `pokemon_moves`
  (per-Pokemon move-use tracking for the combat tracker) and `trainers_items` (inventory).
- **Active tables** — `users`, `trainers`, `pokemon`, `trainers_pokemon` — live campaign data, scoped
  to the owning user via Row Level Security.

### Assumptions baked into the migration

A few linkages weren't fully specified in the schema doc. They're marked `ASSUMPTION:` inline in the
SQL file; the main ones:

- `Classes` / `Subclasses` / `Origins` attach directly to `trainers` (one of each per trainer).
- `Loyalty` and `Nature` attach to `pokemon` directly.
- `Obtain_method` attaches to `trainers_pokemon` (how a trainer got that Pokémon).
- Pokédex base stats are plain integer columns (`base_hp`, `base_atk`, ...) rather than a
  `pokedex_stats` join table, since PTA3 has a fixed set of 6 stats.

### Open items — resolved

- **Features** unlock automatically from a trainer's class/subclass + level rather than being
  individually picked, so `features` gained `class_id`, `subclass_id` (nullable), and `level_required`,
  and `trainers` gained a `level` column. "Which features are active" is a derived query (join on
  class + level), not a stored join table. See
  [`20260724130000_features_and_afflictions.sql`](supabase/migrations/20260724130000_features_and_afflictions.sql).
- **Afflictions** now affect stats and are tracked as live state: `afflictions_stats` (reference
  table — which stat an affliction modifies, and by how much) plus `pokemon_afflictions` (active
  table — which afflictions are currently on a specific owned Pokémon), scoped by the same
  ownership RLS pattern as `pokemon_moves`.
- **Catch_modifiers_* tables** confirmed as lookup-only (read by catch-formula logic at roll time);
  no schema change needed.
- **Passives** needed restructuring: the handbook splits them into *Stat Passives* (numeric stat
  modifiers, max 3 active per Pokémon, one per category) and *Ability Passives* (unstructured
  effects). `passives` gained `passive_type` (`stat`/`ability`), `category` (for the stacking rule),
  and `context` (`combat`/`out_of_combat`) columns, plus a `passives_stats` join table (mirrors
  `afflictions_stats`) and a `pokemon_passives` active table (mirrors `pokemon_moves`) for which
  passives a specific owned Pokémon currently has. The handbook's "Pokémon Skills" section (things
  like Firestarter, Flight, Swimmer) turned out to be functionally identical to Ability Passives but
  usable out of combat, so those were folded into `passives` with `context = 'out_of_combat'` rather
  than getting a separate table. See
  [`20260724140000_reference_data_and_passives.sql`](supabase/migrations/20260724140000_reference_data_and_passives.sql).
- **Type effectiveness** — the handbook has a full 18×18 type matchup chart, but no table for it
  exists in the original schema. Deferred for now (per instruction); will need a `type_matchups`
  table (attacking type ↔ defending type ↔ modifier) eventually.

## Reference data seeded from the Player's Handbook

`20260724140000_reference_data_and_passives.sql` seeded the tables cleanly enumerable from the
handbook: Types (18), Stats (6), Natures (20), Loyalty (0–5), Egg Groups (14), Diets (11),
Afflictions (10, 4 with stat effects). Its original Habitats (12) and Passives (321) seeds were
both later superseded by the user's own homebrew spreadsheet (see below) — Habitats because the
sheet uses much finer-grained tags, Passives because the sheet is a more complete, authoritative
source that already folds in the "Pokémon Skills" concept.

## Reference data + Pokédex seeded from the user's homebrew Google Sheet

The user maintains a much larger, authoritative homebrew ruleset in a Google Sheet ("Lists" and
"Pokédex" tabs), pulled in across three migrations:

- [`20260724150000_lists_schema_changes.sql`](supabase/migrations/20260724150000_lists_schema_changes.sql) —
  schema changes the sheet's data required: `moves` gained `frequency`/`damage_dice`/`range` and a
  4th `damage_stat` value (`effect`, for non-damage utility moves); `origins` gained `lifestyle`;
  `items` gained `boosted_type_id`/`boost_amount` (for type-boosting held items); `obtain_methods`
  gained a numeric `modifier`; `afflictions` gained `catch_modifier` (a 4th catch-modifier category,
  folded into the existing table rather than a redundant new one); `loyalties` gained `exp_modifier`
  (fights-to-level multiplier) and `breeding_modifier`; `breeding_modifiers` was restructured from
  a guessed `friendship_level int` into `name` + `modifier` (it's relationship tiers: Enemies →
  Romantic); a new `catch_modifiers_shiny` table was added.
- [`20260724150100_lists_reference_data.sql`](supabase/migrations/20260724150100_lists_reference_data.sql) —
  seeds Classes (5), Subclasses (46), Origins (15), Moves (632), held Items (54), Levels (100,
  using "fights" as the leveling currency instead of traditional exp — stored in the existing
  `cumulative_exp` column), Growth Rates (5), Obtain Methods (7), the new Shiny/breeding/catch
  modifier tables, Sizes (7) and Weights (6) and Proficiencies (58, derived from the Pokédex sheet's
  actual usage and cleaned up — see below), and **replaces** Passives wholesale (327 — 82 stat, 245
  ability) since the sheet is more complete than the PDF extraction.
- [`20260724150150_pokedex_drop_dex_number.sql`](supabase/migrations/20260724150150_pokedex_drop_dex_number.sql) /
  [`20260724150175_replace_habitats.sql`](supabase/migrations/20260724150175_replace_habitats.sql) /
  [`20260724150200_pokedex_import.sql`](supabase/migrations/20260724150200_pokedex_import.sql) —
  drops `pokedex.dex_number` (the sheet's "Dexpage" column is just a page reference into the user's
  PDF, shared across a whole evolution line, not a stable per-species id — `pokedex.id` plus a
  unique `name` are the real keys now), replaces Habitats with the sheet's 34 fine-grained
  per-species tags (Caves, Ponds, Ocean Abyss, etc., normalized for pluralization/typo drift), and
  imports all 351 Pokédex species with their full relationship data (egg groups, diets, habitats,
  proficiencies, passives, movepool).

**Data-quality notes:**
- The sheet had a few typos fixed during import: "Reseacher" → "Researcher" (5 subclasses),
  inconsistent habitat pluralization (Glacier/Glaciers, Jungle/Jungles, Mountain/Mountains,
  Ocean/Oceans → one canonical form each) and a "Glasslands" → "Grasslands" typo, and several
  broken/inconsistent `Martial (...)` proficiency variants merged into one canonical
  `Martial (No Punches or Kicks)`. `Elemental Attack` / `Elemental Attack I` / `Elemental Attack E`
  were kept as three distinct proficiencies per the user's confirmation, just with casing normalized.
- The Pokédex is only ~30% complete per the user (351 species seeded so far); every insert in
  `20260724150200_pokedex_import.sql` is idempotent (keyed on natural keys, `on conflict do nothing`),
  so re-running the same generation script against an updated export of the sheet is safe.

**Still not seeded:** the PDF's Items catalog beyond held items (Poké Balls, Medical Items, Berries,
Evolution Stones, TMs, etc. — the handbook's Items section, pages 188–201) and a `type_matchups`
table for the 18×18 type-effectiveness chart (deferred per instruction).

## App features built so far

- **Auth** (`app/auth/`, `app/login/`, `app/signup/`) — email/password via Supabase Auth, Server
  Actions for login/signup/signOut, email confirmation currently **disabled** on the project for
  easier local testing (re-enable in Auth → Providers → Email when ready for real use).
- **Trainer creation** (`app/trainers/new/`) — name, Class, Origin, and a 25-point stat-buy
  allocator with preset quick-picks (all 9 combinations that spend exactly 25 points) and
  budget-aware +/- controls. Shared cost-table logic lives in `lib/pta3/pointBuy.ts` so the live
  client-side UI and server-side validation can't drift apart.
- **Starter Pokémon** (`app/trainers/[id]/starter/`) — species picker (searchable against the full
  Pokédex) with optional nickname, linked via the "Starter" obtain method.
- **Trainer detail page** (`app/trainers/[id]/`) — header, HP, Stats, Skills (base modifier only —
  Talented/Expert tiers deferred), Features (derived from class/subclass + level — not
  individually picked, auto-granted on level-up per the user), Team roster, Trainer Moves, and
  PC/Bag buttons (stub pages for now).
- **Dashboard** (`app/dashboard/`) — lists the signed-in user's trainers with their roster.

**Schema additions beyond the original design**, all covered above where they overlap with data
sources, plus:
- `trainers` gained its own stat block (Attack/Defense/Special Attack/Special Defense/Speed,
  1-6 at creation but **uncapped afterward** — stats grow through leveling), `level`,
  `max_hp`/`current_hp`/`temporary_hp`, and up to 3 `advanced_class_*_id` slots (Cross-Classing —
  per-class levels aren't persisted, derived from the trainer's overall level).
- `skills` (18 rows, each tied to its governing stat) and `trainer_moves` (a trainer's own combat
  moves, separate from Pokémon moves — mirrors `pokemon_moves`).
- `features` — seeded 206 rows from the user's class-features tracking sheet (Ace trainer and
  Researcher's class trees; Breeder/Coordinator/Ranger aren't in the source sheet yet). Its
  `name` uniqueness had to be relaxed to a composite key since feature names repeat across levels
  (e.g. "Stat increase" at levels 3/7/11).
- **Bug fixed along the way**: "Type Ace" was originally modeled as 18 separate per-type
  subclasses (`Type ace (fire)`, `Type ace (water)`, ...) following the Lists sheet's shape, but
  the Features sheet's own text ("*When you become a Type Ace, you will select one of the
  types*") confirms it's really one subclass with an internal favored-type choice. Collapsed to a
  single `Type ace` subclass row and remapped its 12 features accordingly (verified no trainer
  referenced the old rows first).
- **RLS bug fixed**: the `pokemon` table's insert policy checked `auth.role() = 'authenticated'`
  via a JWT-claim function, which failed in practice; switched to Postgres-native role scoping
  (`to authenticated`). Separately, inserting a Pokémon and immediately reading it back failed RLS
  because a freshly-created Pokémon has no `trainers_pokemon` link yet to satisfy the "owner can
  view" SELECT policy (Postgres requires `INSERT ... RETURNING` rows to pass SELECT policies too) —
  fixed by generating the Pokémon's UUID client-side and skipping the read-back.

## Campaigns (Gamemaster support) — schema only so far

GM-ness is campaign-scoped, not a global user role — the same person can GM one campaign and just
play in another.

- `campaigns` (id, name, description, `gm_user_id`, auto-generated 6-character `invite_code`) —
  whoever creates it is the GM.
- `campaign_members` (campaign_id, user_id) — players who've joined. The GM is not a row here;
  they're identified directly via `campaigns.gm_user_id`.
- `trainers.campaign_id` (nullable) — a trainer optionally belongs to one campaign;
  `on delete set null` so deleting a campaign never deletes a player's trainer.
- **Joining is a `security definer` Postgres function** (`join_campaign(code)`), not a direct
  insert: it looks up the campaign by invite code (case-insensitive) and adds the caller as a
  member, bypassing RLS internally so a player never needs (or gets) permission to browse
  campaigns they don't already know the code for.
- **RLS bug fixed**: `campaigns`' and `campaign_members`' policies each referenced the other
  table, which Postgres flags as infinite recursion. Fixed with a `security definer` helper
  function (`is_campaign_gm`) so the cross-table check bypasses RLS internally instead of
  re-triggering the other table's policies.

Verified end-to-end (campaign creation, invite-code join, invalid-code rejection, roster
visibility, and that a joined member cannot write to the campaign).

### GM access to campaign player data

Expanded RLS (additively — Postgres OR's multiple permissive policies together, so none of the
existing owner-only policies were touched) so a campaign's GM can see and manage its players'
data, via two `security definer` helpers (`is_campaign_gm_for_trainer`, `is_campaign_gm_for_pokemon`)
that resolve a trainer/Pokémon back to its campaign and check GM-ness:

- **`trainers` and `pokemon`**: GM gets SELECT + UPDATE only (viewing and adjusting HP/stats/etc.
  during play) — deliberately **not** INSERT/DELETE, so creating or deleting a trainer or Pokémon
  stays player-initiated (or owner-only for deletion). This is a judgment call, not something the
  source material specifies — easy to widen or narrow later once we see how play actually goes.
- **Attached active-state tables** (`trainers_pokemon`, `pokemon_moves`, `pokemon_afflictions`,
  `pokemon_passives`, `trainer_moves`, `trainers_items`): GM gets full manage access (insert
  new/adjust/remove — e.g. applying and curing an affliction, adjusting move uses), since a GM
  running combat needs to freely add and remove these, not just edit existing rows.

Verified end-to-end with two real accounts (a GM and a separate player who joined via invite
code): GM can view and update the player's trainer and Pokémon and apply/remove a Pokémon
affliction; GM's DELETE on the trainer is correctly blocked (0 rows affected); an unrelated/
anonymous request still sees nothing; and the player's own owner-level access is unaffected by
the new GM policies.

### GM-facing UI

- **`app/campaigns/new/`** — create a campaign (name + optional description); the invite code is
  auto-generated by the DB default, no client-side generation needed.
- **`app/campaigns/join/`** — enter an invite code, calls the `join_campaign(code)` RPC.
- **`app/campaigns/[id]/`** — branches on `campaign.gm_user_id === user.id`: the **GM** sees the
  invite code and a full trainer roster (name, class, level, HP, Pokémon team with HP) for every
  trainer in the campaign; a **member** sees the same roster style but only for fellow players'
  trainers plus their own — the GM's own trainer(s) are excluded (see below) — plus a "create a
  trainer for this campaign" link.
- **Trainer/PC/Bag pages relaxed to rely on RLS** instead of an explicit
  `.eq('user_id', user.id)` filter baked into the query — that filter was *more* restrictive than
  the database now allows, and would have silently blocked the GM from viewing a player's sheet
  even though RLS permits it. Removing it lets ownership vs. GM access resolve the same way the
  database already decides it, rather than duplicating that logic in the page. The trainer page
  shows a small "(GM view)" label when the viewer isn't the owner. The starter-Pokémon page was
  deliberately **left** owner-only, matching the earlier decision that a GM doesn't get to create
  Pokémon for a player.
- **Trainer creation** gained an optional Campaign dropdown (populated from campaigns the user
  GMs or has joined). Since `trainers.campaign_id` has no RLS-level ownership check of its own
  (any real campaign id would satisfy the foreign key), the server action validates the user is
  actually the GM or a joined member of that campaign before assigning it. After starter-Pokémon
  creation, it now redirects to the campaign page (if any) instead of always the dashboard.
- **Dashboard** lists campaigns the user GMs (tagged "(GM)") and has joined, plus "Create a
  campaign" / "Join a campaign" links.

Verified end-to-end in the actual browser UI (not just via API) with two separate logged-in
accounts: the GM's dashboard/campaign page correctly show the full roster and invite code and
render the "(GM view)" label on a player's trainer sheet; the same player, logged in separately,
sees their campaign without the invite code, only their own trainer, and no "(GM view)" label on
their own sheet.

### Fellow-player visibility, and leave/remove/delete

Per user request: a player should see the whole party's trainers (not just their own), but never
the GM's own trainer(s) (an NPC ally or GM PC) — and that's a real access restriction, not just a
UI filter, so a player can't view a GM trainer's sheet even by navigating to it directly.

- Two more `security definer` helpers: `is_campaign_member` (is the caller a joined player of this
  campaign?) and `is_trainer_owned_by_campaign_gm` (is this trainer the GM's own?). New SELECT
  policies on `trainers` and `pokemon` use these together: visible to fellow campaign members,
  except when the trainer belongs to the GM.
- The campaign page's trainer query no longer filters by `user_id` at all for either role — RLS
  now returns exactly the right set on its own (GM: everyone; player: self + fellow players, minus
  the GM's own), so the page doesn't need to duplicate that logic.
- **`components/ConfirmButton.tsx`** — a small reusable client component wrapping a submit button
  in a browser `confirm()` dialog, used for all three destructive actions below (the "extra
  verification" the user asked for, to prevent an accidental click). Worth revisiting if a
  heavier confirmation (e.g. type-the-name-to-confirm) is wanted later.
- **`leaveCampaign(trainerId)`** — a player un-assigns their own trainer from a campaign
  (`campaign_id` → null). This does *not* remove their `campaign_members` row — leaving a
  trainer and leaving the campaign entirely are different actions; only the former was requested.
  Explicitly scoped with `.eq('user_id', ...)` rather than relying on RLS alone, since RLS would
  also allow a GM to null out a *player's* trainer (that's the next action) — this one needs to
  stay "only my own."
- **`removePlayer(campaignId, targetUserId)`** (GM-only, enforced by existing RLS) — unassigns
  all of that player's trainers from the campaign and deletes their `campaign_members` row (a
  full "kick").
- **`deleteCampaign(campaignId)`** (GM-only) — blocked at the server-action level if any trainers
  still have that `campaign_id`, per the user's explicit rule; the campaign page surfaces the
  resulting error message.

Verified end-to-end in the browser: a player's own trainer shows a "Leave campaign" button that
correctly nulls `campaign_id` while leaving their membership intact; the GM's "Remove player"
correctly unassigns the trainer and deletes the membership row; "Delete campaign" is correctly
blocked with the exact error message while a trainer remains assigned; and — the core of this
request — a player logged into their own session sees their own trainer in the roster but not the
GM's trainer, and a direct navigation attempt to the GM's trainer page redirects away rather than
displaying it (confirmed at the database level, not just hidden in the UI).

### Trainer page: delete, inline level/HP editing, collapsible features

- **Delete** — owner-only (matching existing RLS; the GM deliberately has no delete rights on
  trainers), wrapped in the same `ConfirmButton` pattern. Redirects to the trainer's campaign page
  if it had one, else the dashboard. Note: deleting a trainer does *not* delete their Pokémon —
  `trainers_pokemon` rows cascade away (severing the ownership link), but the `pokemon` rows
  themselves become orphaned with no owner. Not addressed here since it wasn't asked for, but
  worth knowing about if orphaned Pokémon data ever needs cleaning up.
- **Level +/-** lives directly inside the existing Level/Class info block instead of a separate
  Edit section — a plain `<form>` with two submit buttons, each overriding `formAction` to call
  `adjustTrainerLevel(trainerId, delta)` with `+1` or `-1`. No client component or JS needed. The
  "-" button is `disabled` once level reaches 1 (the server action also clamps the same floor, so
  this is just UX, not the real guard).
- **HP editing is a D&D Beyond-style widget**, not a stepper — one shared `amount` number input
  with a green "Heal" button and a red "Damage" button, again using per-button `formAction`
  overrides (`adjustTrainerHp(trainerId, +1 | -1, formData)`) on a single form so one input feeds
  two different server actions. Next to it, a large `current / max` readout labeled "HIT POINTS"
  mirrors the reference screenshot. Healing clamps at `max_hp`; damage has no lower clamp, since
  going negative matters for the death-saving-throw rules.
- Both the Level control and the HP widget are visible to **both the trainer's owner and the
  campaign's GM** — both already have UPDATE rights on `trainers` via existing RLS, and a GM
  adjusting a player's HP/level during a session was the whole point of that earlier RLS
  expansion, so neither control is owner-gated the way Delete is.
- **Features are collapsible** — plain HTML `<details>`/`<summary>`, no client JS needed: only the
  name and required level show by default, click to reveal the description.

Verified end-to-end in the browser with a fresh test trainer: the Level "+" button incremented
level 1 → 2 and correctly surfaced the newly-unlocked level-2 feature; Damage(7) took HP from
20/20 to 13/20; Heal(100) correctly clamped back to 20/20 rather than overshooting; and Delete
removed the trainer and redirected to the dashboard.

### D&D Beyond-style level-up (subclass + stat increase + HP), and active/passive features

- **Milestone levels aren't hardcoded.** A class's "subclass + stat increase" levels (3/7/11 for
  the two classes seeded so far) are derived by querying `features` for that class's "Advanced
  class" rows (`class_id` match, `subclass_id is null`, `name = 'Advanced class'`) — the same
  levels this data already encoded. This means the level-up flow works correctly for a class with
  no milestones seeded yet (a plain level bump, nothing more) and doesn't need updating if a
  class's milestone levels turn out to differ once the other 3 classes get their features seeded.
- **HP increases by a flat +4 at each milestone level** (added to both `max_hp` and `current_hp`).
  An earlier migration comment had assumed this was a 1d4 roll — the user corrected that
  assumption to a flat +4, which is what's implemented; that comment is now stale and safe to
  ignore.
- **Resolving a milestone is a two-step flow**, split across `adjustTrainerLevel` and a new
  `resolveMilestone` action:
  1. Clicking "+" past a milestone level applies the level bump and the flat HP gain immediately
     (matching "HP should be automatically increased"), then redirects to
     `/trainers/[id]/level-up` instead of back to the trainer page.
  2. That page presents two distinct-stat selects (+1 each) and an Advanced Class picker (only
     subclasses of the trainer's own class, excluding ones already chosen) — a plain form, no
     client JS. Submitting applies both stat bumps and assigns the subclass into the trainer's
     next open `advanced_class_{1,2,3}_id` slot.
  - Whether a milestone is "already resolved" isn't tracked with a separate column — the count of
    non-null `advanced_class_*_id` slots doubles as the resolved-milestone counter (milestone N's
    slot is only filled once its stat/subclass choices are submitted), since Advanced Class and
    Stat Increase are always granted together at the same levels in the seeded data.
  - If a player navigates away before finishing the picker, the trainer page shows a banner
    ("Level N unlocked a stat increase and advanced class choice") linking back to
    `/trainers/[id]/level-up`, computed with the same open-slot/level check.
  - Leveling *down* past a milestone does not retroactively undo the granted HP/stats/subclass —
    same "no rollback" limitation the existing Level/HP controls already had.
- **Passive vs. active features**: `features` gained `requires_activation`, `max_uses`, and
  `uses_reset_on` (`'turn' | 'encounter' | 'rest'`) columns. Since the source data has no
  structured "activation type", all 206 existing rows were classified with a **best-effort regex
  heuristic** over their description text — action-economy phrasing ("as an action", "as a bonus
  action") or an explicit use limit ("3/day", "once per day/encounter/turn") marks a feature
  active, with the count and reset bucket parsed out where unambiguous; everything else defaults
  to passive. This is a starting point, not authoritative — spot-checking the ~206 rows turned up
  one clear miss worth knowing about: "Elemental metamorphosis" (a once-per-week downtime ritual)
  gets flagged Active with no tracked counter, since "week" isn't one of the three reset buckets.
  Misclassifications are correctable with a plain `update features set requires_activation = ...
  where name = '...'`.
- **Active features are visually distinct** on the trainer page (separated into their own "Active
  Features" section, amber-highlighted, with an "ACTIVE" badge) instead of being mixed in with
  passives. Ones with a `max_uses` get a live counter ("2 / 3 uses (resets on rest)") plus "Use"
  (decrements, floor 0) and "Reset" (sets back to `max_uses`) buttons, backed by a new
  `trainer_feature_uses` table (mirrors `trainer_moves`' `uses_remaining` shape, row created lazily
  on first use rather than pre-seeded). Owner-or-campaign-GM RLS, same pattern as the other
  active-state tables. Active features without a parseable count (like the weekly ritual above)
  still get the badge, just no counter — there's nothing reliable to track.

Verified end-to-end in the browser: created an Ace trainer, leveled 1 → 2 (saw "Intimidate" appear
correctly tagged Active with 3/3 uses, used a charge down to 2/3, reset it back to 3/3), then
2 → 3, which redirected to the level-up page; chose Attack/Defense +1 and the "Type ace" advanced
class, confirmed, and landed back on the trainer page showing Level 3 Ace trainer / Type ace,
24/24 HP (was 20/20, confirming the flat +4), Attack/Defense both risen from 5 to 6, and the new
subclass's passive features (Favored type, Improved type attacks, Type resistance) present
alongside "Elemental metamorphosis" correctly flagged Active.

### Milestone undo (leveling down) and per-subclass relative leveling

Three corrections from the user after trying the above:

1. HP never scales "per level" — it only ever moves at a milestone level (confirmed this was
   already how `adjustTrainerLevel` worked: `update.max_hp` is only touched inside the
   `milestoneReached` branch). This framing is also what makes undo well-defined: reversal only
   ever needs to happen exactly at the milestone levels being crossed, never as some per-level
   amount.
2. **Leveling down below a milestone must undo what that milestone granted** (subclass, the 2 stat
   increases, and the HP gain) — previously the "−" button only ever decremented `level`, with no
   memory of what a given milestone had granted, so there was no way to reverse it.
3. **A subclass's own feature-levels start at 1 when it's chosen**, not at the trainer's raw level
   — a 2nd Advanced Class picked at trainer level 7 should expose only its level-1 features, while
   a 1st one picked back at level 3 is already at *its own* level 5 (`7 − 3 + 1`). Previously every
   subclass's features were gated by `trainer.level` directly, so a freshly-chosen 2nd subclass
   would immediately show all its levels 1 through 7 features instead of just level 1.

**New table: `trainer_milestones`** (`trainer_id`, `level`, `subclass_id`, `stat_a`, `stat_b`,
`hp_gain`) — an audit row written by `resolveMilestone` alongside the stat/subclass update. This
is the piece that made undo (#2) possible at all: stat columns are just running totals with no
history, so without recording *which* 2 stats and *which* subclass came from *which* milestone,
there'd be no way to know what to reverse once a trainer had passed through more than one
milestone. It's also what per-subclass leveling (#3) reads from — `level` is "what trainer level
was this subclass granted at," so `subclassLevel = trainer.level - grantedAtLevel + 1`.

`adjustTrainerLevel(trainerId, -1)` now looks up any `trainer_milestones` rows with
`level > newLevel` (there's normally at most one, since the UI only ever steps by 1 level, but the
query handles more defensively), and for each: subtracts `hp_gain` from both `max_hp`/`current_hp`
(floored at 1/0, and `current_hp` reclamped to the new `max_hp` in case it was sitting exactly at
the old max), decrements `stat_a`/`stat_b` back by 1, nulls out whichever `advanced_class_N_id`
slot held that milestone's `subclass_id`, and deletes the row. A subclass assigned before this
table existed (none currently, since all test data was created and torn down within this same
session) would have no matching row to revert — not handled, since there's no real data to migrate.

The trainer page's subclass-feature query changed from one `.in('subclass_id', advancedClassIds)`
call to a per-subclass `Promise.all`, each using that subclass's own `grantedAtLevel` (falling back
to `1`, i.e. treating the trainer's raw level as the subclass level, if no `trainer_milestones` row
exists for it — the same graceful fallback as the undo path).

Verified end-to-end: leveled a trainer through both milestones (level 3: Type ace, Attack/Defense
+1 each; level 7: Strategist, Special Attack/Special Defense +1 each), confirming
at level 7 that Type ace (granted at 3, so now at subclass-level 5) showed features through
"Elemental grit" (level 4) but correctly withheld "Type immunity" (level 6), while the
freshly-chosen Strategist (subclass-level 1) showed only its level-1 features ("Field scout",
"Terrain mastery"). Leveling back down 7 → 6 removed Strategist and its Special Attack/Special
Defense bump and dropped HP 28 → 24, while Type ace and its Attack/Defense bump stayed intact.
Continuing down to level 2 (crossing back below the level-3 milestone too) removed Type ace
entirely and returned stats/HP exactly to their pre-milestone values (Attack/Defense 5/5, 20/20 HP)
— an exact round-trip.

### Combined Stat ace / Type ace pickers

The user's motivation: picking "Stat ace (attack)" vs. "Stat ace (defense)" etc. as 5 separately-
named dropdown entries is clunky, and "Type ace" had no way to record *which* type was favored at
all. The ask was to present each as one combined choice with a follow-up picker — and, longer
term, to have the chosen stat/type stored cleanly enough that future automation (e.g. auto-adding
a move to a Pokémon based on the trainer's favored stat) doesn't have to reverse-engineer it from a
subclass name string.

**Stat ace's 5 subclass rows were deliberately left alone.** Their feature text differs genuinely
per stat — different paired status afflictions (Attack↔Burned, Defense↔Frozen, etc.), different
tutored moves per stat (Swords Dance vs. Iron Defense vs. Fake Tears vs. Eerie Impulse...) — this
isn't a simple find-and-replace of a stat name, so merging them into one templated subclass would
have destroyed real content that would've needed manually reconstructing. Confirmed this tradeoff
with the user before implementing. Instead, only the *picker UI* combines them: the level-up page
collapses any still-eligible "Stat ace (%)" rows into a single "Stat ace" dropdown entry (sentinel
value `stat_ace`), and `resolveMilestone` maps the combined choice + a new stat sub-select back to
whichever real row matches (`Stat ace (${stat.replace('_', ' ')})`) — same underlying data model
as picking any other subclass directly.

**Type ace has no per-type variants to map to** (it was already collapsed to one row, per an
earlier migration — its 12 features are genuinely identical prose regardless of type, not
per-type content like Stat ace's), so its chosen type has nowhere else to live. `trainer_milestones`
gained two nullable columns: `chosen_stat` (redundant with the Stat ace subclass name, but stored
explicitly so future code reads one clean column instead of parsing `"Stat ace (attack)"`) and
`chosen_type_id` (the only record of Type ace's pick, `references types(id)`).

**New client component**: `AdvancedClassPicker.tsx` — the only piece of this feature needing
actual client JS, since showing a stat sub-picker for "Stat ace" or a type sub-picker for "Type
ace" based on the *live* value of the first dropdown isn't something a plain server-rendered form
can do. It's a small `useState`-driven component: the sub-picker only exists in the DOM when
relevant, so there's no "required but hidden" form-validation issue when it's absent.

The trainer page's header now shows the chosen type alongside "Type ace" (e.g. "Type ace (Fire)"),
built from the same `trainer_milestones` data already being fetched for per-subclass leveling —
deliberately limited to the subclass *name* display, not touching Type ace's feature description
prose (which would require far riskier free-text substitution for comparatively little value).

Verified end-to-end: created a trainer, chose "Stat ace" + Special Defense at the level-3
milestone (resolved correctly to the "Stat ace (special defense)" row, granting "Favored stat" /
"Specialist training" for that stat specifically); at level 7, selected "Type ace" + Fire (the sub-
picker correctly listed all 18 real types, sentinel "Special/Variable" excluded), landing on
"Level 7 Ace trainer / Stat ace (special defense) / Type ace (Fire)" with both subclasses' features
correctly leveled on their own independent tracks.

### Rest: Sleep vs. Pokémon Center

Two new buttons on the trainer page, `restSleep` and `restPokemonCenter`, both plain forms with no
new schema — everything they touch (`trainers.current_hp`/`max_hp`, `pokemon.current_hp`,
`pokedex.base_hp`, `trainer_feature_uses`) already existed.

- **Sleep**: the trainer heals **1d6** — an actual server-rolled die this time (`Math.floor(Math.random()
  * 6) + 1`), not the flat amount used for milestone HP gains. That distinction matters: the milestone
  HP gain was *my* assumption that the user explicitly corrected away from a die roll to a flat +4;
  here the user asked for "1d6" by name for a rest, so it's implemented as a real roll and the
  rolled value is surfaced back to the player ("Slept and rolled a 3 — healed to 10/20 HP") since a
  server-side-only roll would otherwise be invisible. Each of the trainer's Pokémon heals **1/6 of
  its total HP**, rounded down (`Math.floor(base_hp / 6)`, matching this codebase's existing
  convention for fractional game math, e.g. `statModifier = floor(value / 2)`) — "total HP" is
  `pokedex.base_hp`, the only per-Pokemon HP maximum currently modeled (Pokemon don't yet have their
  own level-scaled max_hp, so this would need revisiting once/if that's built). Sleep also recharges
  every activatable feature whose `uses_reset_on = 'rest'`, by deleting its `trainer_feature_uses`
  row (its absence already reads as "at max_uses" everywhere that's displayed).
- **Pokémon Center**: instantly sets every owned Pokémon's `current_hp` to its `base_hp` (full heal)
  and touches nothing else — not move uses, not the trainer's own HP, not features. This matches
  the user's explicit scope for it.
- **Deliberately out of scope**: `trainer_moves` and `pokemon_moves` both have a `resets_on` column
  with the same `'turn' | 'encounter' | 'rest'` enum as features, so a rest-driven recharge might be
  expected there too — but neither table has a `max_uses`/similar column to reset *back to* (they
  only ever store `uses_remaining`), and neither is populated by any existing flow yet (every
  trainer's Moves section has read "None yet" throughout this project so far). Resetting them today
  would mean guessing a target value with nothing to base it on, so they're left untouched until
  those tables gain an actual max to recharge to.
- Both actions are available to **the trainer's owner and the campaign's GM**, same as Level/HP —
  a GM calling a rest for the whole party is the expected use case, not something to gate to owners
  only.

Verified end-to-end: set a fresh trainer to 3/20 HP and its Charmander (base_hp 24) to 5 HP, then
Sleep — rolled a 4, trainer went to 7/20, Charmander went to 5+4=9 (`floor(24/6)=4`, correct).
Separately dropped Charmander to 2 HP and hit Pokémon Center — it jumped straight to 24/24 while
the trainer's HP stayed untouched at 7/20. Leveled to 2 for "Intimidate" (3 uses, resets on rest),
used a charge down to 2/3, then Sleep — HP rolled a 3 (7 → 10) and Intimidate recharged back to
3/3 in the same action.

### Pokémon level-up learnsets, imported from PokeAPI

The ask: integrate each species' level-up moveset so Pokémon can eventually learn new moves
automatically as they level up (the actual level-up-triggers-learning UI/logic is intentionally
**not** built yet — this pass is the data only, since there's currently no Pokémon leveling control
at all to hook it into; explicitly deferred to a later session per the user's direction).

- **Source pivoted from Serebii to [PokeAPI](https://pokeapi.co)** partway through planning —
  originally scoped as scraping Serebii's per-species pages, but PokeAPI already exposes the same
  level-up data as structured JSON (one `/pokemon/{name}` fetch per species vs. parsing an HTML
  table), which is what actually got built.
- **Level assignment**: for each move, `level_learned` is the **minimum** `level_learned_at`
  PokeAPI reports across **every** version group (game) the species appears in — not just its most
  recent game. This was a direct correction mid-implementation: the first pass picked only the
  latest game's tab (mirroring the original "latest game featured" framing), but the user redirected
  to "find the lowest level a Pokémon learns a move at" instead. Practically, this also makes the
  move list itself a union across every game the species has appeared in, rather than whatever one
  game's tab happens to include.
- **Moves vs. Passives**: PokeAPI has no concept of PTA3's move/passive split — some of what it
  calls a level-up "move" (e.g. Growl, Growth) are modeled as Passives in this project instead.
  Unmatched move slugs are checked against the `passives` table before being given up on, and land
  in `pokedex_passives` with the same level-gating rather than `pokedex_moves`.
- **Schema**: both `pokedex_moves` and `pokedex_passives` gained a nullable `level_learned int`
  column. `pokedex_moves` already held a small curated list from the Player's Handbook sheet with no
  level data — those rows are untouched by the import's `on conflict do update` unless the same
  (species, move) pair also appears in the PokeAPI data, in which case its level gets filled in.
- **One-off import, not a repo script**: a Node script (`build_learnset.mjs`, written to the scratch
  directory rather than committed, since it's a one-time data pull rather than app functionality)
  pulled `id, name` for all 351 pokedex species and all 632 moves out of the database, fetched each
  species from PokeAPI, matched move slugs against our moves (falling back to passives), and wrote
  the resulting `insert ... on conflict do update` statements straight into two migration files.
- **Coverage: 317 of 351 species matched**, contributing 4762 `pokedex_moves` rows (all now with a
  level) and 766 `pokedex_passives` rows. The other **34 species did not get a learnset at all** —
  per explicit direction ("I think some of these have separate forms — let's not worry about those
  for now, but note down that not all movesets are found"), these were deliberately left alone
  rather than guessed at:
  - Most are this project's own custom regional/form variants whose PokeAPI slug wasn't looked up
    (e.g. "Growlithe (Ancient)", "Darmanitan (Ice)", "Basculin (Red)", "Eiscue (Ice Face)",
    "Oricorio (Fire)" — several of these do plausibly correspond to real PokeAPI regional forms
    like Hisuian/Alolan/striped varieties, but confirming which wasn't done).
  - A handful of plain species 404'd on PokeAPI for unclear reasons (Darmanitan's base form,
    Pyroar, Frillish, Jellicent) despite being ordinary Pokémon — worth retrying later; wasn't
    a rate-limit artifact (retried directly via curl and got a consistent 404, not investigated
    further beyond that).
  - Two look like typos in our own `pokedex` data: "Wartorle" (`wartortle` resolves fine on
    PokeAPI) and "Wiggytuff" (`wigglytuff` resolves fine).
  - Separately, **52 distinct move slugs** PokeAPI reported for various species aren't in our
    632-move table at all yet (e.g. `u-turn`, `volt-switch`, `baton-pass`, `false-swipe`,
    `magnitude`) — any species that would've learned one of these is just missing that entry.
  - Full unmatched-species and unmatched-move lists were captured in the import script's report at
    generation time but weren't preserved in-repo (the report was a scratch file, not committed);
    re-running an equivalent PokeAPI fetch against the current `pokedex`/`moves` tables would
    reproduce the same two gap lists.

Verified end-to-end: queried Bulbasaur's imported learnset directly from the live database and
confirmed it matches the user's own stated example exactly — Tackle at level 1, Growl (as a
Passive) at level 1, Vine Whip at level 3 — plus the rest of its moveset through level 36
(Solar Beam) and Growth (Passive) at level 6.

### Pokémon detail page (read-only) + the homebrew EV stat system

Modeled directly off a Google Sheet the user shared showing their own Pokemon ("Spike" the
Lairon) — the scope for this pass, per explicit direction, is a **read-only** page matching that
sheet's layout; editing (HP heal/damage, nickname, nature, and especially the 6-move-cap
learn/replace/relearn workflow) is deliberately deferred to later requests, same as how the
trainer page's edit controls were layered on well after its first read-only version.

- **New route**: `/trainers/[id]/pokemon/[pokemonId]`, nested under the trainer the same way
  `pc`/`bag`/`level-up` already are. The trainer page's Team list now links each Pokémon here
  instead of showing plain text.
- **The EV stat-growth formula was previously unknown** — the sheet's Lairon showed Max HP 42 /
  Attack 11 / Defense 15 against our pokedex's base_hp 36 / base_atk 9 / base_def 14 (Special
  Attack/Special Defense/Speed matched exactly), which didn't fit any formula already in the
  schema. The user supplied the actual homebrew rule: 1 EV every 8 levels, distributed freely by
  the trainer, max 2 EVs per stat, each EV = +1 except HP where 1 EV = +6. `pokemon` gained 6 new
  `ev_*` columns (one per stat, `check between 0 and 2`) plus `gender`, `is_shiny`, `held_item_id`,
  and `temporary_hp` (all fields the sheet showed with no column to live in yet). Available
  (unspent) EVs are derived as `floor(level / 8) - sum(ev_*)`, not stored — same pattern as the
  trainer milestone system's slot-counting.
- **"Value" (displayed stat) = base (from `pokedex`) + EV bonus + a ±1 nature adjustment + any
  active stat-Passive bonus.** Modifier = `floor(value / 2)`, reusing the same `statModifier`
  helper trainers already use. Movement speed in feet = `max(5, Speed value × 5)` — found directly
  in the Player's Handbook text ("a Pokémon with 12 Speed can move a whopping 60 ft"), not guessed.
- **Passives split by type, matching an existing but previously-unused design constraint**:
  ability-type Passives (Rock head, Sturdy, Sinker...) are auto-derived from `pokedex_passives`
  by species + level, same as trainer features. Stat-type Passives (Harden, Iron defense...) are
  **not** auto-derived, even when the species is eligible for them — they're individually chosen
  per Pokémon via `pokemon_passives`, because the schema's own comment documents a "max 3 stat
  Passives, 1 per category" rule as application logic. This was caught during testing: Lairon is
  eligible for both "Harden" and "Iron defense" (both defense-category), and the first draft of
  this page auto-showed both, which the reference sheet contradicted (only Harden). Fixed by
  reading stat-type Passives exclusively from `pokemon_passives` (the individually-chosen set)
  while still auto-deriving ability-type ones.
- **Moves table columns already fit the sheet almost exactly** (`range`, `type_id`, `damage_stat`,
  `frequency`, `damage_dice`, `description` were all added in an earlier pass) — the one thing not
  stored is the sheet's "Modifier" column, which isn't a move property at all: it's the *attacking
  Pokémon's own* stat modifier for that move's category, computed per-move at render time
  (`physical` → Attack, `special` → Special Attack, `either` → whichever is higher). **`effect`
  category is an unconfirmed assumption** — the only example available (Protect) showed a modifier
  that happened to match Special Defense, so that's what's used, but it's a single data point, not
  a confirmed rule.
- **Move Proficiencies** section reads `pokedex_proficiencies` (species-level, already populated) —
  not the per-move `moves_proficiencies` table, which is entirely empty (zero seed rows in any
  migration) and wasn't needed for what the sheet shows.
- **A real bug found and fixed while touching this code**: `restSleep`/`restPokemonCenter` (from
  the earlier Rest feature) capped Pokémon healing at `pokedex.base_hp` alone, ignoring the HP EV
  bonus that now exists. Fixed both to use `base_hp + ev_hp * 6` as the effective max — no
  observable behavior change today (no Pokémon has nonzero EVs without an allocation UI, which
  doesn't exist yet), but it would have under-healed any Pokémon with HP EVs once one did.
- **Runtime gotcha, not just a TS-inference quirk**: `trainers_pokemon.pokemon_id` is that table's
  *primary key* (one owner at a time, enforced directly by the PK), so unlike every other
  reverse-embed in this codebase (which return arrays at runtime even for practically-1:1
  relations), PostgREST returns this one as a **plain object**. Indexing it with `[0]` (the usual
  pattern used everywhere else) silently returned `undefined` — caught via a raw authenticated
  REST call replicating the exact query, which is how the mismatch between "TS says array" and
  "runtime is actually an object" was confirmed rather than guessed at.
- **Not modeled / explicitly deferred**: the 6-move-cap replace-and-relearn workflow (display-only
  for now — a note under Moves says a 7th will need to replace one, but there's no action to do
  it); EV allocation UI (columns exist, nothing writes to them yet); Likes/Dislikes (shown on the
  sheet, no table for either exists anywhere in the schema, not added here); "in battle" temporary
  stat modifiers (no combat-state tracking exists, so this column always displays 0).

Verified end-to-end against the user's own Lairon example: created a test Pokémon with the exact
nature (Hasty), EVs (1 HP / 2 Attack / 1 Defense), held item (Metal coat), moves (Mud-slap, Metal
claw, Rock tomb, Rock slide, Iron head, Protect), and chosen stat-Passives (Harden, Metal sound) —
the resulting page matched the sheet exactly: Max HP 42, Attack 11 (+5), Defense 15 (+7), Special
Attack 6 (+3), Special Defense 5 (+2), Speed 5 (+2, 25 ft.), move proficiencies (Rock/Steel/
Draconian), all 6 moves with correct range/type/frequency/damage/modifier text, the same 5
Passives (not 6), and matching Biology (Dragon/Monster egg groups, 10-day hatch rate, Terravore
diet, Caves/Mountains habitat).

### Pokémon page follow-up fixes

Four corrections from the user after trying the page above:

1. **Dashboard's Pokémon list wasn't clickable** — same gap the trainer page had before its Team
   list got linked. Added `pokemon.id` to the dashboard's query and wrapped each entry in a `Link`
   to `/trainers/[trainerId]/pokemon/[pokemonId]`, same as the trainer page.
2. **"Base value" and "In battle" columns removed from the Stats table** — per the user, they were
   confusing. The table is now just Stat / Value / Modifier. The underlying `inBattle` term (always
   0, no combat-state tracking exists) is still computed as part of the value formula, just no
   longer rendered as its own column.
3. **HP editing added, matching the trainer's widget exactly** — a new `adjustPokemonHp(trainerId,
   pokemonId, sign, formData)` action (`app/trainers/[id]/pokemon/actions.ts`) mirrors
   `adjustTrainerHp`: Heal clamps at `base_hp + ev_hp * 6`, Damage has no floor. Available to owner
   and campaign GM alike (no ownership filter, RLS already scopes it). The page also gained an
   `error` searchParam banner to match.
4. **`effect`-category move modifier is Speed, not Special Defense** — the earlier version's guess
   (based on Protect's modifier happening to equal Special Defense in the one example available)
   was wrong; the user confirmed it's actually Speed. Both stats were `+2` in the reference
   example, which is exactly why the guess looked plausible but wasn't — a good reminder that a
   single matching data point doesn't confirm a rule when multiple stats could coincidentally
   produce the same number.

One implementation hiccup along the way: the new `pokemon/actions.ts` file lives in
`app/trainers/[id]/pokemon/` (one level above the `[pokemonId]/page.tsx` that uses it), so the
import needed to be `../actions`, not `./actions` — an initial `./actions` import 500'd the page
with a clear "Module not found" error, caught immediately via a direct curl check before it ever
reached the browser test.

Verified end-to-end: dashboard now links straight to the Pokémon page; the Stats table shows only
Stat/Value/Modifier; Damage(10) took a fresh 42/42 Lairon to 32/42 and Heal(100) correctly clamped
back to 42/42 rather than overshooting; and Protect's displayed modifier now reads +2 matching
Speed's own modifier (not Special Defense) in the same test data.

### Move-learning flow: 6-slot cap, replace, and relearn

The last deferred piece from the original Pokémon page pass, built in two passes. No new schema
was needed either time — the existing `pokemon_moves` (currently known moves) and `pokedex_moves`
(species learnset, with `level_learned` from the PokeAPI import) were enough to model the whole
mechanic.

**First pass** (superseded by the second, kept here for the reasoning): a standalone "Learn a
Move" section always visible below Moves, with the section's `Learn` control switching between a
plain button (under 6 known) and a `<select>` of which known move to replace (at 6 known) — one
atomic `learnMoveReplacing` action doing the delete-and-insert together.

**Second pass, per explicit feedback** ("move Learn a Move to a button in the Moves section; an
Edit button makes it editable; you can also remove a learned move and relearn a possible move"):
the atomic replace was split into two independent, simpler actions, and the whole thing folded
into the Moves section itself behind an Edit/Done toggle:

- **`Edit` / `Done` toggle** is a plain link, not a client component — `?editMoves=1` in the URL
  (added to `searchParams`) controls whether the section renders its edit affordances. Same
  no-JS-needed pattern as the pending-milestone banner link: the two states are just two different
  server renders of the same page, nothing about the toggle itself needs live client interaction.
- **Normal view**: unchanged from before — just the known moves, no clutter.
- **Edit view**: each known move gets a `Remove` button (`forgetMove`, a plain delete — no
  replacement move required in the same step anymore), and a "Learn a Move" subsection appears
  below listing every eligible-but-unknown move with its own `Learn` button (`learnMove`, disabled
  once already at 6 known rather than switching to a picker).
- **This simplification changes the actual play pattern**: instead of one atomic "replace X with
  Y" action, freeing a slot (Remove) and filling it (Learn) are now two separate clicks — matching
  how the user described it ("remove a learned move **and** relearn a possible move" as two
  capabilities) rather than the earlier single combined step.
- **"Relearnable later" still needs no extra tracking**: `forgetMove` just deletes the
  `pokemon_moves` row; since the move is still in the species' `pokedex_moves` learnset, it
  reappears in the eligible list on the next render with nothing marking it "forgotten."
- Both actions redirect back with `?editMoves=1` (success or error) so the user stays in edit mode
  across a multi-step edit instead of having to click `Edit` again after every action.

Verified end-to-end: gave a level-32 Lairon 3 known moves; confirmed normal view shows no
Remove buttons or learn list; clicked `Edit` and confirmed Remove buttons appeared on all 3 known
moves plus a "Learn a Move" list below; removed Mud-slap (dropped to 2/6, stayed in edit mode,
Mud-slap reappeared as learnable); relearned it via its `Learn` button (back to 3/6, still in edit
mode); clicked `Done` and confirmed the page returned to the plain normal view.

### GM-created Pokémon ("Create a Pokémon" page)

Prompted by a Natures design discussion (when should a Pokémon's nature be rolled vs. chosen?) —
that question is intentionally shelved until this exists, since "who's creating it and how" turned
out to be the real prerequisite question. Until now the *only* way a `pokemon` row could ever be
created was a trainer's own starter-creation flow (self-service, always immediately owned). This
adds a second path: a GM creating a Pokémon that isn't (or isn't yet) any trainer's — a wild
encounter, an NPC's team, a prepared gift.

- **"Unassigned" needed no schema hack** — Pokémon ownership was already entirely derived through
  the `trainers_pokemon` link table, never a column on `pokemon` itself, so a Pokémon with no
  `trainers_pokemon` row simply *is* unassigned. The only real gap was RLS: every existing policy
  on `pokemon` resolves access by joining through `trainers_pokemon → trainers`, so a Pokémon with
  no such row would be invisible to everyone, including whoever made it.
- **Fixed with two new nullable columns**: `created_by_user_id` (drives a new RLS policy — the
  creator can manage a Pokémon **only while it's still unassigned**; once a `trainers_pokemon` row
  exists, standard owner/campaign-GM policies take over exclusively, so the creator doesn't retain
  standing rights over a Pokémon that's since been handed off and played by someone else) and
  `campaign_id` (purely organizational — "which pool does this belong to," nullable per the user's
  explicit call to also support a campaign-less personal pool, e.g. for a GM stockpiling Pokémon
  before a campaign exists). `campaign_id` does **not** drive assignment permission by itself —
  assigning to a specific trainer is governed by that trainer's own `campaign_id` via the existing
  `is_campaign_gm_for_trainer()` check, independent of which pool the Pokémon itself is tagged
  with. That decoupling is what makes "personal pool → hand to any of my campaigns' trainers" work
  without extra rules.
- **`/pokemon/new`**: species/nickname (same UI as starter creation) plus two independent optional
  fields — Pool (any campaign this user GMs, or "None") and "Assign to trainer now" (any trainer
  across *all* campaigns this user GMs, regardless of the chosen pool) — per the user's explicit
  answer that both should be selectable in one step rather than forcing unassigned-then-assign-
  later as the only path.
- **Dashboard gained an "Unassigned Pokémon" section** (only the creator's own, only while
  unassigned) with an inline assign-to-trainer form — without this, a Pokémon left unassigned at
  creation would have no page in the UI to ever find or assign it again afterward.
- New `app/pokemon/actions.ts`: `createPokemon` (validates campaign GM-ship and, separately,
  trainer GM-ship, before inserting) and `assignPokemon` (same trainer GM-ship check, used from the
  dashboard's unassigned list).

Verified end-to-end: created a campaign-less "Sparky (Pikachu)" with no trainer — appeared in the
dashboard's Unassigned Pokémon section; created a campaign and a trainer ("Ash") in it, then
created "Blaze (Charmander)" tagged to that campaign's pool *and* assigned directly to Ash in the
same submission — landed straight on Blaze's page with Trainer: Ash resolved correctly; then
assigned the earlier unassigned Sparky to Ash from the dashboard's inline form — redirected to
Sparky's page, and the dashboard's Unassigned Pokémon section correctly emptied out while Ash's
Team list picked up both Pokémon.

**Natures is still open** — the actual question from before this detour (random vs. GM-chosen
nature, and when) is unblocked now that there's a real GM-creation entry point to hang a nature
picker on, but hasn't been designed or built yet.

### Nature picker

Resolves the original question: nature is determined at creation time in both Pokemon-creation
flows, with different defaults matching who's creating it.

- **Shared helper**: `lib/pta3/nature.ts` exports `pickRandomNatureId(supabase)`, picking uniformly
  among whatever's actually in the `natures` table (not a hardcoded count of 20), used by both
  flows below.
- **Starter creation** (`app/trainers/[id]/starter/actions.ts`): always random, no picker exposed —
  a player doesn't choose their own Pokémon's nature any more than a real trainer would. This also
  fixes a real gap noted during the Pokémon-page work: no starter Pokémon ever had a nature
  assigned at all before this (the column existed but nothing wrote to it).
- **GM creation** (`app/pokemon/new`): a `Nature` select defaulting to `Random`, with all 20 seeded
  natures listed as explicit alternatives — covers the "predetermined, mostly when created by the
  GM" case from the original design discussion (e.g. a story-appropriate nature for a prepared
  NPC's Pokémon or a gift).

Verified end-to-end: created a GM Pokémon with `Hasty` explicitly selected — confirmed via direct
query it landed correctly; created a second leaving `Nature` at its `Random` default — got `Quiet`,
confirming the random path also works; created a fresh trainer's starter Pokémon and confirmed it
got a nature (`Mild`) with no picker shown anywhere in that flow.

### Nature backfill + stat increase/decrease verification

Two follow-ups: assign a nature to every pre-existing Pokémon that predates the picker (created
before nature was ever written on either flow), and confirm the nature-driven stat math actually
displays correctly rather than just trusting the code.

- **Backfill migration**: `update pokemon set nature_id = (select id from natures order by random()
  limit 1) where nature_id is null`. The subquery is correlated — re-run per row by Postgres since
  it depends on `random()` — so each Pokémon gets its own independently rolled nature rather than
  all sharing whatever the planner happened to compute once. Affected 11 of the 13 Pokémon rows
  currently in the database (the other 2 were created after the nature picker already existed).
- **Stat verification**: created a fresh Squirtle (base Attack 5 / Special Attack 5 / Defense 7)
  with `Modest` (increases Special Attack, decreases Attack) and no EVs or stat-Passives, to
  isolate the nature term from everything else the Stats table also factors in. Confirmed both the
  header (`Stat increase: Special Attack`, `Stat decrease: Attack`) and the Stats table itself:
  Attack 5 → 4 (mod +2), Special Attack 5 → 6 (mod +3), Defense unchanged at 7 (mod +3) — matching
  the `natureAdjust` logic exactly (`+1`/`-1` applied only to the nature's named stat, zero
  elsewhere).

### Gender picker (mirroring nature) + post-creation editing

- **Gender follows the exact same pattern as nature**: `lib/pta3/gender.ts` exports
  `pickRandomGender()` (uniform 50/50 male/female — no per-species gender-ratio or always-
  genderless data exists anywhere in this schema, e.g. nothing would stop rolling "male" for a
  species that's canonically always female; `genderless` stays available as a manual-only choice
  for whoever knows better, never rolled). Starter creation always rolls it, no picker; `/pokemon/new`
  gets a `Gender` select defaulting to `Random` with `Male`/`Female`/`Genderless` as explicit
  alternatives.
- **Backfill migration**: same `where ... is null` + randomize shape as the nature backfill,
  applied to all 13 existing Pokémon (all were missing gender, same root cause — nothing wrote to
  the column before this pass existed).
- **New: post-creation editing**, which nature never got until now either. The Pokémon page's Info
  section gained an `Edit`/`Done` toggle (`?editInfo=1`, same link-based no-JS pattern as the Moves
  section's `?editMoves=1`) — in edit mode, Gender and Nature become selects with a `Save` button;
  everything else in that section (species, size, weight, held item, etc.) stays plain text, since
  only these two were asked for.
- **Deliberately not GM-only**: the user asked for GM edit rights specifically, but the action
  (`updatePokemonDetails`, added to `app/trainers/[id]/pokemon/actions.ts` alongside
  `adjustPokemonHp`) doesn't add an extra GM-only check — it relies on the same RLS that already
  governs every other editable field on this page (HP, Level), which grants both the owner and the
  campaign GM update rights. Restricting nature/gender to GM-only while HP/Level stay owner-or-GM
  would be an inconsistent, one-off exception on the same page. Worth flagging in case the user
  actually wanted owner access excluded here specifically — easy to tighten with an `isOwner` gate
  if so.

Verified end-to-end: a fresh starter Charmander got a random gender (`male`) and nature (`Careful`)
with no picker shown; opened its Info section's Edit mode, changed Gender to `Female` and Nature to
`Jolly`, saved — both the plain-text Gender/Nature rows and the derived Stat increase/decrease
labels updated correctly, and the Stats table's Speed and Special Attack shifted exactly as
expected for the nature change (Speed 7→8 since Jolly raises it, Special Defense back down from 6
to 5 since Careful's bonus to it no longer applied), confirming the edit correctly recomputes
everything downstream rather than just updating the raw nature field.

### Pokemon leveling (GM-managed, always recomputed — never stored)

Per the user's explicit direction, a Pokémon's level is no longer a stored, manually-incremented
number the way `trainers.level` still is — it's recomputed from `current_exp` and four modifiers
every time it's needed, so changing any input (an exp award, a loyalty shift, re-assigning obtain
method, even toggling shininess) is reflected immediately with nothing to go stale. The exp→level
formula itself is the user's own homebrew creation (confirmed explicitly, not derived from the
Handbook): `effective_exp = current_exp × growth_rate.exp_modifier × obtain_method.modifier ×
shiny_modifier × loyalty_modifier`, then `level = the highest levels.level_number whose
cumulative_exp is ≤ effective_exp`.

- **`pokemon.level` column dropped entirely** rather than left stale/unused — nothing should ever
  read or write it again once level became derived.
- **`catch_modifiers_shiny` renamed to `exp_modifiers_shiny`** — it was grouped with the other
  catch-rate tables during the original Lists-sheet import on the assumption it affected catch
  rate; the user corrected this ("it has nothing to do with catch rate, only exp modifier"). Same
  table, same rows, just a name that no longer misdescribes it.
- **`loyalties.modifier` added** (0→0.5, 1→0.7, 2→1, 3→1.2, 4→1.5, 5→1.8) — the user's own homebrew
  scale, provided directly since nothing in the schema could derive it.
- **`lib/pta3/pokemonLevel.ts`** — `computePokemonLevel()`, the single shared implementation of the
  formula above, used by both the Pokémon page (level shown in the header, gates move-learning and
  EV availability) and `learnMove`'s server-side eligibility check, so the two can't drift apart.
- **Real bug caught during testing**: `levels.cumulative_exp` is a `bigint` column, but
  `effective_exp` is a product of decimal modifiers and is almost always fractional (e.g. `10 ×
  0.85 × 1.2 = 10.2`). PostgREST's `.lte('cumulative_exp', effectiveExp)` sent the literal `"10.2"`
  straight to Postgres, which rejected it (`invalid input syntax for type bigint`) — and since only
  `data` was destructured from the response (not `error`), the query silently returned nothing and
  every Pokémon's level fell back to `1` no matter how much exp it had. Fixed by flooring
  `effective_exp` before the comparison (both fixes the bigint cast and matches the intuitive rule
  that fractional exp shouldn't round a Pokémon up to the next level early).
- **Experience section** (new, on the Pokémon page): shows current/effective exp and each modifier
  with its source (growth rate, obtain method, shininess, loyalty) for transparency, plus
  Add/Remove Exp controls — **GM-only**, the one deliberate exception among all the Pokémon page's
  editable fields (HP, gender, nature, moves are all owner-or-GM, matching existing RLS). The
  user's framing here was notably stronger and more specific ("this is something to be managed by
  the GM") than the earlier nature/gender asks, so `addPokemonExp` (in
  `app/trainers/[id]/pokemon/actions.ts`) checks `trainer → campaign → gm_user_id` itself and
  rejects non-GMs, rather than just relying on the broad owner-or-GM RLS policy that still
  technically permits the update at the database level.

Verified end-to-end: created a fresh starter Bulbasaur (Growth rate Medium Slow ×0.85, obtain
method Starter ×1.2) in a campaign GM'd by the same test account. At `current_exp = 0` it correctly
showed Level 1 with no Add/Remove Exp controls visible for a non-GM context (a same trainer with no
campaign at all). After linking the trainer to a GM'd campaign, the controls appeared; adding 10
exp produced `effective_exp = 10.2` → correctly showed **Level 10** (after the bigint-cast fix
above; it incorrectly showed Level 1 before the fix) with EVs available bumping from 0 to 1
(`floor(10/8)`), and the Moves tab's learnable list correctly unlocked Bulbasaur's level-7 Leech
Seed — which was then successfully learned, confirming `learnMove`'s own eligibility check (not
just the page's list-filtering) also uses the corrected computed level. Removing 5 exp back down
to `current_exp = 5` correctly dropped the header to Level 5 and EVs available back to 0, while the
already-learned Leech Seed correctly stayed known (only the *learnable* list is level-gated, not
moves already learned).

### Species filter (Type / Habitat) for both Pokémon-creation flows

The Species field in both creation flows (starter and GM-created) was a plain text input backed by
a `<datalist>` of all 351 Pokédex species — functional but easy to lose a specific species in,
especially without knowing its exact name. Added Type and Habitat filter dropdowns above it that
narrow the datalist down to matching species.

- **`lib/pta3/pokedexFilter.ts`** — shared by both pages (same pattern as `nature.ts`/`gender.ts`):
  `fetchPokedexFilterOptions()` for the dropdown contents (excludes the `Special/Variable` sentinel
  type, which exists only for typeless moves and no real species ever has it), and
  `fetchFilteredSpecies({ typeId, habitatId })` for the actual filtered list.
- **Type** matches either of a species' two types (`type_1_id` or `type_2_id`), same as how type
  matchups treat a dual-type Pokémon. **Habitat** is many-to-many (`pokedex_habitats`), so rather
  than fight Supabase's embedded-join typing for an optional inner-join, it's filtered via a
  separate id lookup (`pokedex_habitats.eq(habitat_id)` → `.in('id', ids)` on `pokedex`) — keeps the
  query's shape (and TS type) identical whether or not a habitat filter is active.
- **Filters submit via a separate `method="get"` form** (`?typeId=&habitatId=`), consistent with
  every other piece of page state in this app (`?editMoves=1`, `?editInfo=1`) — no client JS, the
  page just re-renders server-side with the narrowed datalist. The actual creation form (species +
  nickname + the rest) is untouched and still submits by name via its existing Server Action, so
  neither `createStarterPokemon` nor `createPokemon` needed any changes.

Verified end-to-end on both pages: unfiltered showed all 351 species; `Fire` + `Volcanoes` narrowed
`/pokemon/new` to 37 species (included Charmander/Charizard/Arcanine, excluded Bulbasaur) and
successfully created a Charmander from the filtered list into the unassigned pool; `Water` narrowed
a fresh trainer's starter picker to 80 species, and successfully created a Squirtle starter from it.

### Pokémon sprites (pokemondb.net)

- **No new data needed**: `pokedex.sprite_code` already existed (populated with PokeAPI-style slugs
  during the earlier learnset import, e.g. `arcanine-hisuian`, `basculin-red-striped`) and turned
  out to line up with pokemondb.net's own sprite URL slugs almost exactly. Verified by sweeping all
  351 `https://img.pokemondb.net/sprites/home/normal/1x/{sprite_code}.png` URLs directly — 349/351
  resolve; the only 2 misses (`Torkoal (Steam)`, `Tropius (Ancient)`) are homebrew-only forms with
  no real-world sprite to link to in the first place.
- **`lib/pta3/pokemonSprite.ts`**: `pokemonSpriteUrl(spriteCode, 'normal' | 'shiny')` — the shiny
  variant is used automatically wherever a Pokémon's own `is_shiny` is true, both flavors following
  the same URL pattern the user gave.
- **`components/PokemonSprite.tsx`**: the one client component this needed — an `onError` fallback
  swaps a failed load to a small "No image" placeholder rather than showing a broken-image icon,
  which only the browser can detect (covers the 2 known misses above, plus anything unknown).
  Everything else on this page stays a Server Component; only the image tag itself needs JS.
- **Wired into**: the Pokémon detail page (96px, next to the name/level header) and the dashboard's
  Team roster + Unassigned Pokémon lists (32px, next to each entry) — the two places an existing
  Pokémon is actually looked at, as opposed to the creation flows' species *picker*, which stays
  text-based for now (a live image preview there would need the picker itself to become
  interactive, a bigger change than this pass covered).

Verified end-to-end: real sprites loaded correctly (confirmed via `naturalWidth` in the browser,
not just a non-404 status) on both a fresh Squirtle starter and a Charmander in the dashboard's
Unassigned Pokémon list; creating a `Torkoal (Steam)` (one of the 2 known-missing sprites)
correctly rendered the "No image" placeholder instead of a broken-image icon.

### Species picker: dropdown + live preview (replacing the free-text field)

Follow-up to the sprite work above and the earlier filter work: the user didn't like typing the
species name, even with a datalist backing it — replaced with an actual select-from-a-list
control, plus the sprite preview updating live as different species are highlighted.

- **`components/SpeciesPicker.tsx`** (new client component, used by both creation flows): a
  `<select>` of species names plus a `PokemonSprite` preview next to it that updates on `onChange`.
  A native `<select>`'s own `<option>`s can't embed images, which is the one reason this needed to
  be a client component at all — the dropdown itself still submits the species by `name` exactly
  like the old text input did, so **no Server Action changed** (`createStarterPokemon` /
  `createPokemon` both already matched species by name via `ilike`).
  - `key={selected.sprite_code}` on the nested `PokemonSprite` forces it to remount on every
    selection change — without it, `PokemonSprite`'s own `errored` state (from the "No image"
    fallback) would stick from a previous broken-sprite species even after picking a working one,
    since only the `<img src>` changes on a re-render, not the component instance.
  - Defaults to the first species alphabetically so there's always a valid preview and a valid
    selected value, even before the user touches the control.
- **`fetchFilteredSpecies` now also returns `sprite_code`** (was `name` only) — the Type/Habitat
  filtering logic itself is unchanged, just carrying one more column through.
- The Type/Habitat filter dropdowns above the picker are untouched — still a separate `method="get"`
  form, still re-narrows which species show up in the (now visual) dropdown below it.

Verified end-to-end on both pages: the dropdown defaulted to the alphabetically-first species with
a matching live preview image; changing the selection (e.g. to Charizard) correctly swapped the
preview to the new species before any submission; submitting through the new picker successfully
created a Pokémon exactly as before (a Charizard landed in the unassigned pool, a Water-filtered
starter pick loaded correctly with its own live preview).

### Trainer page: richer Team sidebar, confirm dialogs, two-column layout

- **Team cards** now show the sprite, computed Level (same `computePokemonLevel` used on the
  Pokémon page and the learn-move check -- reused rather than reimplemented, so nothing can drift),
  and Loyalty name, alongside the existing HP. The `trainers_pokemon` query grew
  `obtain_method_id` plus the fields `computePokemonLevel` needs (`current_exp`, `is_shiny`,
  `loyalty_id`, `pokedex.growth_rate_id`) to support that.
- **HP color**: green above 50%, orange from just-above-1/6 through 50%, red at 1/6 or below --
  exact boundaries as given, implemented as one small `hpColorClass()` helper rather than inlined
  per-row so the three thresholds live in exactly one place.
- **Confirm dialogs**: Sleep, Pokémon Center, and both trainer-level +/- buttons now go through
  `ConfirmButton` (already used for Delete). It needed one addition -- an optional `formAction`
  prop -- since the level buttons share one `<form>` with two `formAction`-bound submit buttons
  rather than each having their own `<form action>`; `ConfirmButton` didn't forward that prop
  before. The disabled level-down-at-level-1 guard was preserved unchanged.
- **Layout**: Team moved into a `w-64` left sidebar (`<aside>`) alongside a widened page (all the
  page's `max-w-2xl` wrappers became `max-w-4xl` so the header/banners/two-column area all line up
  at the same width), with everything else (Level, HP, Rest, Stats, Skills, Features, Trainer
  Moves) in the remaining right column, unchanged in order.

Verified end-to-end: Team sidebar rendered at `x=96` immediately left of the main content column at
`x=384` (confirmed via bounding rects, not just visual guess); a fresh Squirtle showed Level 1 /
Loyalty — / a full-HP green `24 / 24 HP`; damaging it to `12/24` (exactly 50%) correctly switched to
orange, and further to `3/24` (12.5%, below the 1/6 ≈ 16.7% cutoff) correctly switched to red.

### GM-only Pokémon overrides (Loyalty, Shininess, Types, Size, Weight, Held item) + Nickname

Expands the Pokémon page's Info edit form well beyond Gender/Nature. Confirmed explicitly with the
user before building this, since it flips an existing permission: **Gender and Nature moved from
owner-or-GM to GM-only**, joining Loyalty, Shininess, Type 1/2, Size, Weight, and Held item as a
single consistent GM-only group. **Nickname is the one owner-or-GM field** — the user specifically
called out the trainer being able to rename their own Pokémon as separate from the GM's list.

- **Schema**: `pokemon` gained nullable `type_1_id`, `type_2_id`, `size_id`, `weight_id` (all FKs
  into the same reference tables the species/pokedex row already points to). Null means "use the
  species default" — the same fallback shape `held_item_id` already had, just falling back to a
  real value instead of "none". `type_2_id` only supports override-or-species-default, not a third
  "force mono-type" state (documented in the migration) — nothing asked for stripping a naturally
  dual-type species down to one type, and that would need real tri-state nullability to do right.
- **Effective-value pattern**: every place that used to read `species.type_1?.name` etc. directly
  (header, Info view, Info edit's read-only grid) now reads a computed `effectiveType1` /
  `effectiveType2` / `effectiveSize` / `effectiveWeight`, each `pokemon.override_X?.name ??
  species.X?.name`. Nothing downstream (Stats, movement feet, etc.) needed to change — none of it
  depended on type/size/weight.
- **Permission enforcement is in the action, not RLS**: `updatePokemonDetails` now looks up
  owner/GM status itself and only folds the GM-only fields into the update payload `if (isGM)` —
  RLS still broadly permits an owner to UPDATE the `pokemon` row (same policy Nickname relies on),
  so without this explicit check a plain owner could still smuggle a Gender/Loyalty/etc change
  through a hand-crafted request even with the UI hiding those inputs from them. Same technique
  `addPokemonExp` already established for GM-only Experience edits.
- **UI mirrors that split**: the Edit link appears for `isOwner || isGM`; inside the form, Nickname
  is always an input, everything else is either GM-only editable inputs or (for a non-GM owner)
  plain read-only text pulled into the same grid the always-read-only view uses.
- **Nature numbering**: every Nature `<select>` in the app (this edit form and the GM
  Pokémon-creation page) now labels each option `{1-based index}. {name}` instead of just the bare
  name, so a physical d20 roll maps directly to a list position — no new column needed, since the
  numbering is just the existing alphabetical `.order('name')` fetch, which is already stable and
  identical across both pickers (20 natures exist, matching a d20 exactly).

Verified end-to-end: as a plain owner (trainer with no campaign), Edit mode showed only a Nickname
input, everything else as read-only text; after linking the trainer to a campaign this same account
GMs, the exact same Edit mode revealed the full GM field set, numbered Nature options confirmed
alphabetical (1. Adamant … 20. Timid, matching the creation page's numbering), and saving Nickname
"Squirty", Shiny, Type 1 → Ice, Size → Large, Held item → Mystic water, and Loyalty → 0 all
persisted correctly — the header updated to show the Ice type and shiny sprite, the Experience
section's Loyalty modifier reflected ×0.5, and reloading as the owner-only view again showed all of
it as read-only (Type 2 and Weight correctly still showing their untouched species defaults).

### Obtain method in Info (GM-only) + capitalized Gender

Small follow-ups to the GM-overrides work above. Obtain method lives on `trainers_pokemon` (the
link table), not `pokemon` itself, so — unlike every other GM-only field, which is a single
`pokemon` UPDATE — saving it is a second, separate `trainers_pokemon` update in the same action,
still gated by the same `isGM` check. Gender's raw stored value (`male`/`female`/`genderless`) is
now passed through a `GENDER_LABELS` map everywhere it's shown as read-only text, rather than
displaying the raw lowercase enum value.

### Moves: STAB, "Usable" tracking, and a easier-to-scan card layout

- **STAB**: a `stabBonus()` helper adds +4 whenever a move's type matches either of the Pokemon's
  own *effective* types (the same override-aware `effectiveType1`/`effectiveType2` from the GM-
  overrides work, so retyping a Pokemon correctly changes which of its moves get STAB). Shown both
  as a badge next to the move name and folded into the displayed damage modifier.
- **"Usable" tracking, no roll simulation**: per the user's explicit scope ("no need to roll for
  hit or damage, but remove 1 use"), a new `useMove` action just decrements `pokemon_moves.
  uses_remaining` by 1 -- owner-or-GM, same as HP, since using a move in play is an everyday action
  rather than a GM-adjudicated fact.
- **Where the use cap comes from**: `pokemon_moves.uses_remaining`/`resets_on` existed as columns
  from the very first migration but nothing had ever written to them -- `learnMove` always inserted
  bare `{pokemon_id, move_id}`. Added `lib/pta3/moveFrequency.ts`'s `parseMoveFrequency()`, parsing
  `moves.frequency` ("1/day", "3/day", "At will", the one non-learnable "Special" move) into a cap
  + reset cadence. `learnMove` now sets both at insert time; a backfill migration applied the same
  parsing to every already-learned move (only where `uses_remaining` was still null, so it can't
  clobber a real in-play count). The Pokemon page re-derives the same cap at render time for the
  "X/Y uses" display rather than storing it a second time.
- **Resets on Sleep, not Pokémon Center**: mirrors how trainer Features already reset on Sleep, but
  there's no separate "uses" table to delete a row from the way `trainer_feature_uses` works --
  `uses_remaining` lives directly on `pokemon_moves`, so `restSleep` re-derives each move's cap from
  its frequency (same `parseMoveFrequency`) and writes it back for every move with `resets_on =
  'rest'`. `restPokemonCenter`'s code already had a comment anticipating this ("not their move
  uses") from when it was first built -- this is what finally makes that true rather than just
  aspirational.
- **Card layout**: rebuilt each known move as a compact header row (name + type badge + STAB badge
  + uses/Use-button-or-"At will" + Remove-when-editing) with the damage line right underneath and
  the rest (range, damage-stat category, frequency, full description) tucked into a `<details>` so
  it's available but not cluttering the default view -- directly addressing "easier to see and
  access": the Use button is in the normal (non-edit) view, not gated behind Edit mode the way
  Learn/Remove still are.

Verified end-to-end: learning Water gun (Water-type) on a Water-type Squirtle showed a "STAB +4"
badge and `Damage: 2d6 +6` (base +2 special modifier + 4 STAB), while Tackle (Normal-type, same
Pokemon) correctly showed no STAB badge and `Damage: 2d6 +2`. Clicking Use on a move at 1 remaining
correctly dropped it to 0 (confirmed directly in the database, not just the UI) and disabled the
button; Pokémon Center left that 0 untouched; Sleep correctly reset it back to its frequency-derived
cap (1, for a "1/day" move) via a real click through the confirm-dialog-protected Sleep button.

### Moves follow-up: To hit restored, STAB moved into a tooltip, uses become undoable checkboxes

Three corrections to the redesign above, from actually using it.

- **"To hit" was accidentally dropped** in the redesign (the old build showed the attack-stat
  modifier next to the damage-stat category; the rebuild folded it into the Damage line and lost
  its own visible line). Restored as its own always-visible line directly above Damage, using
  `modifierForDamageStat()` **without** STAB -- STAB is specifically a damage bonus, not a to-hit
  one, so the two numbers can now differ (e.g. `To hit: +2` / `Damage: 2d6 +6` once STAB applies).
- **STAB badge removed, replaced with a `title` tooltip on the Damage line** — a native browser
  tooltip (no client JS needed) breaking down `Base damage / Stat bonus / STAB / Effectiveness`.
  Effectiveness is listed as "not yet implemented" since no type-matchup system exists in this app
  yet — the tooltip's structure already has a slot for it once that's built.
- **Uses became checkboxes, replacing the Use button + "X/Y uses" text and the whole `useMove`
  action** — motivated by "if I click Use by mistake, it's not easy to undo." Each checkbox is
  really a small `<button>` (styled as a checkbox, checked = filled blue with a ✓) rather than a
  real `<input type="checkbox">`, since toggling instantly needs *some* server round-trip in a
  page with essentially no client JS, and a styled button already gets that for free via its own
  `formAction`. Click semantics match a star rating: clicking an unchecked box marks everything up
  to and including it as used; clicking a checked box undoes it (and anything after it). Each
  box's target `uses_remaining` value is computed server-side per slot at render time and bound
  directly via `setMoveUsesRemaining.bind(null, trainerId, pokemonId, moveId, target)` — no client
  state, no "which box is this" tracking, just N independently correct buttons.

Verified end-to-end on a 3-use move: all 3 boxes rendered unchecked at 3/3; clicking box 1 checked
it and dropped `uses_remaining` to 2 (confirmed in the database); clicking box 2 next checked it
too and dropped to 1; clicking the now-checked box 2 again (the "undo" case) correctly unchecked it
and restored `uses_remaining` to 2. The Damage tooltip showed the exact expected breakdown (`Base
damage: 2d6 / Stat bonus: +2 / STAB: +4 / Effectiveness: not yet implemented`), and To hit (`+2`)
correctly stayed lower than Damage (`+6`) once STAB applied, confirming the two no longer share a
single number the way the pre-redesign code implicitly did.

### Moves follow-up #2: real bug in the checkboxes, hover tooltip nobody could see, To hit styling

More corrections, from actually trying the previous pass.

- **Real bug**: the checkboxes' "star rating" click semantics meant clicking the 2nd box directly
  (without ever clicking the 1st) consumed 2 uses, not 1 — because that scheme always jumped the
  used-count to match the clicked box's *position*, not just ±1 from wherever it currently was.
  Fixed by making every box only ever adjust the total by exactly 1 based on its **own** current
  state (checked → click removes 1 use total; unchecked → click adds 1), regardless of position or
  which other boxes are checked. Which specific boxes render as checked is still just a left-packed
  tally (uses aren't individually distinguishable, so there's nothing to preserve identity-wise),
  but the count-per-click is now always exactly 1.
- **Use button restored** alongside the checkboxes (removing it in the first pass was the actual
  mistake — the user wants both: Use for the everyday single-click case, checkboxes for direct
  correction). Bound to the exact same target value as clicking any unchecked checkbox, so the two
  paths can't disagree with each other.
- **Tooltip literally wasn't visible**: the previous pass used the native `title` attribute, which
  only shows on *hover* (and unreliably at that, especially on touch) — not a real fix for "I want
  a tooltip," just invisible. Replaced with `components/ClickTooltip.tsx`, a small client component
  (the only reason it needs `'use client'` — click-to-toggle has no non-JS equivalent) that shows a
  popover on click. Wired specifically around the damage *value* (`2d6 +6`), not the "Damage:"
  label, per the user's explicit correction.
- **To hit / Damage styling**: both lines now share the exact same `text-sm` class — previously "To
  hit" was smaller and gray (`text-xs text-neutral-500`) while Damage was plain `text-sm`, an
  inconsistency left over from when To hit was hastily added back as an afterthought.

Verified end-to-end: clicking only the 2nd of 3 fresh checkboxes dropped `uses_remaining` from 3 to
2 (confirmed in the database) — not 1, fixing the reported bug exactly. The Use button reappeared
next to the checkboxes and stayed enabled while uses remained. Clicking the damage value (`2d6 +6`)
toggled a visible popover with the full breakdown; both `<p>` elements confirmed to share the
identical `text-sm` class.

### Experience section hidden entirely for non-GM viewers

Previously the whole Experience section (current/effective exp, growth rate, obtain method,
loyalty modifier) rendered for everyone, with only the Add/Remove Exp controls gated behind
`isGM`. Now the entire `<section>` is wrapped in `{isGM && ...}`, so a Pokémon's own trainer (who
isn't the campaign GM) no longer sees it at all -- consistent with Experience already being the
one GM-only concept on this page (the level shown in the header is still visible to everyone, since
it's just derived from the same underlying numbers).

Verified: as the campaign GM, the section renders with its usual content; after unlinking the
trainer from the campaign (simulating a non-GM viewer of the same Pokémon), the page skipped
straight from Hit Points to Stats with no trace of Experience, while Level in the header stayed
correct.

### Pokémon page: three-column layout (Info left, Hit Points right)

Mirrors the sidebar pattern already used on the trainer page (Team on the left there), extended to
three columns here since there were two things to pull out to the edges.

- **Left sidebar**: the old standalone header (sprite, name, shiny/GM badges, "Level X Type") is
  now the top of the same card as Info, rather than a separate banner above a single centered
  column. Species, Name, and Type 1/2 were removed from Info's own fields (both the read-only view
  and the non-GM edit sub-grid) since they'd otherwise show twice — once in the card header, once
  in the field list below it — per the user's explicit "so it only shows once." The actual Type
  1/2 **select inputs** in the GM edit form were kept, since overriding a Pokémon's type is a real
  mutation, not just a duplicated display value.
- **Right sidebar**: Hit Points, restructured from its old horizontal "Heal · amount · Damage · big
  number" row (which assumed a wide single column) into a stacked layout that fits a 256px column:
  the current/max HP display on top, then the amount input, then Heal/Damage side by side below it.
- **Center column**: everything else (Experience, Stats, Moves, Move Proficiencies, Passives/
  Skills, Biology) keeps its previous order, just narrower now that two sidebars flank it. The page
  container widened from `max-w-2xl` to `max-w-6xl` to give three columns room.

Verified via bounding rects (not just visual inspection): left sidebar at x=96, center column at
x=384, right sidebar at x=912 — correct left-to-right ordering. Confirmed no duplicate fields in
either the read-only view or the GM edit form (Species/Name/Type 1/Type 2 appear exactly once, in
the header), and that HP Heal/Damage still work from their new sidebar location (a test Damage(5)
correctly dropped 24/24 to 19/24, healed back afterward).

### Info section: grouped fields, Shiny display removed (still GM-editable)

Small follow-up to the sidebar restructure -- the field list read as one flat, ungrouped list once
Species/Name/Type were pulled out into the header, so this groups what's left.

- **Shiny display line removed** (the sprite and the header's "✦ Shiny" badge already show it) --
  but the GM's Shiny **checkbox** stayed exactly where it was in the edit form, since the user was
  explicit that editing should still work even though the redundant display shouldn't.
- **Three groups, applied identically in both the read-only view and the non-GM edit sub-grid**:
  Trainer + Obtain method + Loyalty (who has it and how); Nature + Stat increase + Stat decrease
  (nature and its two direct effects); Weight + Size + Gender (physical description). Held item
  stays standalone -- it wasn't part of any named group.
  Implemented as nested `flex flex-col gap-1` blocks inside a `flex flex-col gap-3` parent, so
  each group visually clusters (small internal gap) while a larger gap separates one group from the
  next -- no sub-headings needed in a sidebar this narrow.
- **GM edit form's select inputs reordered to match** (Obtain method → Loyalty → Nature → Weight →
  Size → Gender → Held item → Type 1 → Type 2 → Shiny checkbox last), so the edit order and the
  read-only display order no longer disagree with each other.

Verified end-to-end: both the read-only view and the edit form's non-GM sub-grid show the three
groups in the intended clusters with no "Shiny:" line anywhere in the field list; the GM's Shiny
checkbox is still present, pre-checked to match the Pokémon's actual state, and a real save
(unchecking then rechecking it) correctly toggled the header's "✦ Shiny" badge and the Experience
section's "Shiny: No/Yes" both times.

### EV assignment: trainer can Assign, only the GM can Remove

The EV system (1 EV per 8 levels, max 2/stat, +1/EV except HP which is +6/EV) has existed since the
Pokémon page was first built, but nothing ever let a Pokémon's EVs actually change -- the columns
were purely display. This adds the first way to spend them.

- **`lib/pta3/pokemonEv.ts`** (new, tiny): `EV_STAT_COLUMNS` (the 6 stat keys → their `pokemon`
  column names), `EvStatKey`, and `MAX_EV_PER_STAT`. Lives outside `actions.ts` specifically
  because a `'use server'` file may only export async functions -- a plain constant/type export
  there fails the Next.js build (hit this directly: the page 500'd with exactly that error before
  the constant was moved out).
- **`assignPokemonEv` is owner-or-GM**, matching HP/Nickname -- a trainer manages their own
  Pokémon's growth as it levels. **`removePokemonEv` is GM-only**, per the user's explicit
  "they should not be able to remove them, only with an item" -- enforced the same way as
  `addPokemonExp` (explicit `isGM` check in the action, since the broad owner-or-GM RLS on
  `pokemon` can't by itself distinguish "assign" from "remove" on the same columns). The item
  logic itself is intentionally not built yet, per the user's own scoping.
- Both actions re-validate everything server-side regardless of what the UI shows or disables:
  assigning checks the per-stat cap (2) *and* the level-derived total budget (`floor(level/8)`);
  removing just checks the stat isn't already at 0.
- **UI**: the Stats table gained an EV column (`X/2` + Assign button, plus a GM-only Remove
  button) per non-HP stat; HP -- not part of that table -- got the equivalent pair of buttons
  tucked under the Heal/Damage controls in the right sidebar.

Verified end-to-end: as the GM, assigning Attack's EV correctly bumped the stat 5→6 and the EV
count 0/2→1/2, and immediately disabled every other stat's Assign button (the level-10 budget of 1
was now spent) while leaving Attack's own Remove enabled; GM Remove correctly reverted it. As a
plain owner (campaign unlinked to simulate a non-GM viewer), the Remove button didn't render at
all for any stat, while Assign remained visible and a real click successfully bumped Defense
7→8 (0/2→1/2) -- confirming the trainer can spend EVs but has no way to take one back through the
UI.

### EV follow-up: menu-based Assign/Edit + Stats calculation tooltips

Two corrections to the EV UI above, plus a related new tooltip request.

- **Per-row Assign/Remove buttons replaced with two menus**, per the user's actual intent (a
  single "Assign EV's" toggle for the trainer, a single "Edit EV's" toggle for the GM, each
  opening a small panel below the table -- not inline buttons on every stat row). Both use the
  same `?assignEvs=1` / `?editEvs=1` searchParam-toggle pattern as Info/Moves.
  - **"Assign EV's" only renders when the trainer actually has EVs left to spend** (or is already
    in the menu, so they can still close it after spending their last one) -- exactly as asked,
    rather than always showing a disabled button.
  - **"Edit EV's" always renders for the GM**, since redistributing is a correction tool that
    should be available regardless of whether the level-based budget is currently maxed out.
  - **`setPokemonEvs` replaced `removePokemonEv` entirely** -- one GM-only action that takes all 6
    stats' EVs from one submitted form (a `<select>` 0/1/2 per stat) and writes them in a single
    update, rather than one-at-a-time increment/decrement. Validates the same rules as before
    (each stat ≤ 2, total ≤ the level-derived budget) against the total of what's submitted, not
    against a single stat in isolation.
  - **HP joined the Stats table** as its own row (it was previously a special-cased block in the
    Hit Points sidebar) so both EV menus can treat all 6 stats -- HP included -- identically. HP
    has no "Modifier" (it's a resource pool, not a rolled stat), shown as `—` in that column.
- **Stats calculation tooltips**: every stat's Value cell (HP included) is now a `ClickTooltip`
  breaking down `Base / EV / Nature / Passive / In battle / Total` (HP's is simpler: `Base / EV
  (×6) / Total`, since it has no nature/passive component). `STAT_ROWS` needed `natureAdjust` and
  `passiveBonus` added to its returned objects -- they were already computed for the `value` sum
  but discarded afterward rather than kept for display.
- **`ClickTooltip` gained outside-click-to-close** (a `mousedown` listener on `document`, scoped
  by a ref so a click *inside* the tooltip doesn't close it) -- this fixes the Moves section's
  damage tooltip too, since it's the same shared component; previously the only way to close either
  tooltip was clicking its own label again.

Verified end-to-end: clicking Attack's value opened a tooltip reading exactly `Base: 5 / EV: +0 /
Nature: +0 / Passive: +0 / In battle: +0 / Total: 5`; a `mousedown` elsewhere on the page closed it.
Opened "Assign EV's", assigned Speed's only available point (Speed 4→5, movement 20→25ft), which
correctly made "Assign EV's" disappear (budget spent) while "Edit EV's" stayed. Used "Edit EV's" to
move that point from Speed to Attack in one save (Attack 5→6, Speed back to 4) -- Tackle's "To hit"
updated to +3 immediately, confirming the redistribution flows through the same stat calculation
moves already use. A follow-up over-budget redistribution attempt (3 EVs at a 1-EV level) was
correctly rejected with "Total EVs (3) exceed what this level allows (1)" and left the stats
unchanged.

### EV follow-up #2: HP out of Stats, current HP now tracks HP EV changes

- **HP's row and tooltip moved out of the Stats table into the Hit Points sidebar section**,
  attached to the `X / Y` display's max-HP number instead of living as a 6th row next to the real
  (rolled) stats -- per the user's correction, HP belongs with the rest of the HP UI, not mixed in
  with Attack/Defense/etc.
- **Current HP now moves with max HP whenever HP's EV changes**, in both directions: assigning an
  HP EV (`assignPokemonEv`) raises current HP by +6 alongside the +6 max HP gain (a level-up-style
  gain, not a silent max-HP increase that leaves current HP looking like unexplained missing
  health); the GM redistributing HP's EV down (`setPokemonEvs`) lowers current HP by the same
  amount it lowers max HP. Both clamp the result to `[0, new max]` -- lowering HP's EV while at low
  current HP correctly floors at 0 rather than going negative, and raising it never pushes current
  HP above the new max. `loadPokemonEvContext`'s select gained `current_hp` and `pokedex(base_hp)`
  to support the calculation in both actions.

Verified end-to-end: HP no longer appears in the Stats table (5 rows now, not 6); clicking the HP
sidebar's max-HP number correctly showed the same breakdown tooltip that used to live in the table.
Assigning Squirtle's HP EV while at full health (24/24) correctly produced 30/30, not 24/30; the GM
redistributing that EV back to 0 correctly dropped it back to 24/24. Set up a low-HP case directly
(EV 1, current HP 3, max 30) and redistributed HP's EV to 0 -- current HP correctly clamped to 0
instead of going to -3.

### Tooltip follow-up: wider, zero-lines hidden, rendered through a portal

- **Every tooltip line that doesn't attribute anything is now omitted** rather than always printing
  `EV: +0`, `Nature: +0`, `Passive: +0`, `In battle: +0`, or the old "Effectiveness: not yet
  implemented" placeholder in the Moves damage tooltip. A stat with no EV/nature/passive bonus now
  just shows `Base: X` / `Total: X` instead of five lines of noise. Added a small `formatSigned()`
  helper (`+3` / `-2` / `+0`) shared by all three tooltip call sites (Stats table, Moves damage, and
  the HP sidebar) so the sign formatting stays consistent now that the zero-filtering makes each
  site's list dynamic in length.
- **`ClickTooltip` now renders through a React portal into `document.body`** instead of as a normal
  absolutely-positioned descendant, and the popover is wider (`w-64`, up from an implicit
  auto-width). Root cause of "hidden inside a box": the Stats table sits inside an
  `overflow-x-auto` wrapper, and per the CSS overflow spec, setting `overflow-x` without also
  setting `overflow-y` forces the browser to compute `overflow-y` as `auto` too -- so the tooltip,
  as a normal child, was being clipped by that wrapper's own scroll box even though nothing about it
  looked like a scroll container. Portaling to `<body>` with `position: fixed` (using viewport
  coordinates from `getBoundingClientRect()`, which is exactly what `fixed` positions against)
  sidesteps any ancestor's overflow or stacking context entirely, which is what "show on top of the
  page" requires. The click-to-open/click-outside-to-close behavior is unchanged -- the portaled
  node is still tracked by the same ref used in the outside-click listener.

Verified end-to-end in the browser: the HP sidebar tooltip on Squirty (`ev_hp = 0`) now reads just
`Base: 24` / `Total: 24` with no `EV:` line, confirming the zero-filter. A Stats-table tooltip
(Attack, base 5, no EV/nature/passive/in-battle contribution) read `Base: 5` / `Total: 5`. Both
tooltips measured 256px wide via `getBoundingClientRect()` (the new `w-64`), and their portaled node
had `parentOverflow: "visible"` (i.e. living directly under `<body>`, no longer inside the clipping
table wrapper). Clicking elsewhere on the page (a `mousedown` dispatched on `document.body`) still
closed the tooltip, confirming outside-click-to-close survived the move to a portal.

### Known moves: sorted by uses, then STAB

- **Known moves now render sorted by uses tier first (At will, then descending N/day), then by STAB
  on top within a tier**, instead of in whatever order `pokemon_moves` happened to return them.
  Learnable-moves (the "Learn a Move" list) were already sorted by `level_learned` via the query's
  own `.order()` -- this only touches the known-moves list, which had no ordering at all. Built as a
  `sortedKnownMoves` array (`[...knownMoves].sort(...)`) computed once before the render map, reusing
  the same `parseMoveFrequency()` (maxUses -- `null` for "At will" treated as `Infinity` so it always
  sorts first) and `stabBonus()` helpers already used for the per-move uses tracker and damage
  tooltip, so the sort can never disagree with what's actually displayed. No secondary tiebreak
  (e.g. alphabetical) within an uses+STAB tie yet -- the user said a further sort may come later but
  isn't needed for now.

Verified end-to-end: on Squirty (Water-type, knows Water gun [Water, At will] and Tackle [Normal, At
will]), Water gun (STAB) now sorts above Tackle (no STAB) within the same At-will tier -- previously
Tackle listed first. Temporarily leveled Squirty to 100 (GM Add Exp) to reach a wider learnset,
learned Water pulse (Water, 3/day), Hydro pump (Water, 1/day), and Protect (Normal, 1/day) to get one
STAB and one non-STAB move in each uses tier, and confirmed the full render order came out At will
(Water gun, Tackle) -> 3/day (Water pulse) -> 1/day (Hydro pump, Protect) -- STAB on top within both
the At-will and 1/day tiers. Removed the three test moves and the added exp afterward to restore
Squirty to its original level-10, 2-move state.

### Bug fix: Pokemon damage no longer goes negative

- **`adjustPokemonHp` now floors damage at 0** (`Math.max(0, pokemon.current_hp - amount)`) instead
  of letting `current_hp` go negative. The unclamped behavior was a deliberate copy of the trainer
  HP control's damage handling, which leaves negative HP alone on purpose because the trainer rules
  use it for death saving throws -- but Pokemon HP has no such mechanic, so a hit larger than current
  HP has nothing meaningful to represent below 0 and should just floor there.

Verified end-to-end: with Squirty at 24/24, submitting 999 damage produced `0 / 24` (previously would
have gone to `-975 / 24`). Healed back to `24 / 24` afterward to restore the original state.

### Pokemon page: optimistic updates, no more full re-render per click

- **HP, Exp, move uses, move learn/forget, and both EV flows (Assign for the trainer, Edit for the
  GM) no longer trigger a full page re-render on every click.** Previously every one of these was a
  `<form action={serverAction}>` ending in `redirect()` back to the same URL -- not a hard browser
  reload, but Next.js still re-fetches and re-renders the *entire* page's Server Component tree on
  every submit, which is what actually produced the "reloads on every click" feel (flash, scroll
  jump, any open `<details>` resetting). The fix: all seven of these actions
  (`adjustPokemonHp`, `addPokemonExp`, `assignPokemonEv`, `setPokemonEvs`, `setMoveUsesRemaining`,
  `learnMove`, `forgetMove`) dropped their `redirect()`-on-success/error pattern in favor of
  returning a plain result object (`{ error }` or the updated fields), and are now called directly
  from a client component instead of bound to a `<form action>` -- Next.js supports invoking an
  exported `'use server'` function straight from client code as an RPC call, no form or navigation
  involved. The `trainerId` parameter was dropped from all seven since it was only ever used to
  build the old redirect URLs.
- **New `PokemonInteractive.tsx` (`'use client'`) holds all the state these seven actions touch**
  (`level`, `currentExp`, `effectiveExp`, `currentHp`, the six EV values, and the known-moves list)
  behind a React Context (`PokemonStateProvider`), exposed to five components rendered in place of
  the old server-rendered blocks: `LevelLine` (the header's "Level X" line), `ExperienceSection`,
  `StatsSection`, `MovesSection`, and `HpSection`. A single shared Provider was necessary rather than
  five independent `useState`s because these pieces are genuinely coupled -- an EV change to Speed
  changes both the Stats table's modifier AND every known move's "To hit" in the Moves section; an
  Exp change changes both the header's Level line and which moves are learnable. All the pure
  derivation logic that used to run once server-side (`STAT_ROWS`, `stabBonus`, `modifierForDamageStat`,
  the known-moves sort, the learnable-moves filter) moved into this client file so it can recompute
  from local state after each click instead of a fresh request.
- **The "Learn a Move" list's underlying query dropped its level filter** -- it now fetches the
  species' entire learnset (`fullLearnset`) once at page load, and `MovesSection` filters it to
  "eligible at the current level and not already known" client-side on every render. This was
  necessary, not optional: without it, a level-up from an optimistic Add Exp would leave newly-
  eligible moves invisible until a real page reload, silently reintroducing the exact staleness this
  whole change was meant to remove.
- **The Assign EV's / Edit EV's panels are no longer URL-driven** (`?assignEvs=1` / `?editEvs=1` are
  gone) -- they're local `useState` toggles now, which is what makes the requested auto-close
  behavior possible: after a successful Assign, `StatsSection` computes the new EV total directly
  from the action's response and the stat map it already had, and closes the panel only if that total
  has reached `evsAvailable`; otherwise it stays open so the trainer can keep assigning. Manually
  toggling the panel open/closed still works either way. The Moves section's Edit toggle
  (`?editMoves=1`) was explicitly left as a plain `<Link>` per the user's request -- only what
  happens *inside* edit mode (Learn/Remove) is now optimistic, not entering/leaving it.

Verified end-to-end in the browser via direct DOM/network inspection (clicking through the UI is
indistinguishable from a real page load otherwise): watched `read_network_requests` after each
action and confirmed exactly one lightweight POST per click carrying just the changed fields (e.g.
`{"currentHp":19}`) rather than a full-page GET, and confirmed zero `beforeunload` events fired
across an entire test session (HP damage, a 2000-exp Add Exp that leveled Squirty from 10 to 100,
learning and using a 3/day move, removing it, and a full 12-EV assignment). The Level line in the
Info card and the Stats section's "EVs: X / Y available" both updated immediately from the same Add
Exp click, confirming the Context is correctly shared across those two areas. Assigned all 12
available EVs one stat at a time and confirmed the "Assign EV's" button/panel disappeared
automatically the moment the last one landed (while it correctly stayed open at 10/12 and 11/12);
GM-redistributed them all back to 0 via Edit EV's, which closed itself after Save as before. A rapid
double-submission race (clicking "Assign" on an already-maxed stat before its disabled state had
re-rendered) was correctly rejected server-side rather than corrupting state. Restored Squirty to its
original level-10, 20-exp, 0-EV, 2-move, 24/24 HP state afterward.

### Uniform Save/Cancel labeling

- **Renamed "Done" to "Cancel" everywhere it closes a form that has its own "Save" button** (the
  Info edit form, and the GM's "Edit EV's" redistribute form) -- these two were the only places on
  the page where "Save" and "Done" appeared together, and "Done" was misleading there: clicking it
  discards whatever was typed/selected rather than confirming it, which is exactly what "Cancel"
  means. Also added a second Save/Cancel pair at the *bottom* of both forms (next to each other,
  matching normal form conventions) in addition to the existing top-of-section toggle, since both
  forms are long enough that scrolling back up just to back out was awkward. The EV Edit form's new
  bottom Cancel and the top-toggle Cancel now share one `cancelEditPanel()` handler that resets the
  draft EVs back to the live values before closing, rather than relying on the incidental fact that
  reopening the panel already reseeds the draft.
- **Left every other "Done" button alone** (the Moves section's Edit toggle, and the Stats section's
  "Assign EV's" panel toggle) -- these don't pair with a "Save" because there's nothing pending to
  save or discard: Learn/Remove and Assign all commit immediately per click (per the prior
  optimistic-update work), so "Done" there just means "close this view," which isn't the same
  action as "Cancel" and shouldn't be relabeled to match.

Verified in the browser: opened the Info form, typed a nickname, and confirmed the bottom-of-form
Cancel discarded it (page returned to the unmodified nickname) rather than submitting it -- the
same test the top toggle's Cancel already covered. Opened "Edit EV's" and confirmed both its top
and bottom buttons now read "Cancel" (not "Done"), and that clicking either closes the panel with
Squirty's EVs unchanged at 0/1.

### Uniform Save/Cancel labeling, follow-up: drop the redundant top Cancel

- **Removed the top-of-section Cancel button from both the Info form and the EV Edit form**, per
  the user's feedback that having two Cancel buttons on screen at once looked strange -- the
  bottom Save/Cancel pair (added in the prior pass) is enough on its own, right next to the fields
  it applies to. While editing, the Info header now shows just the "Info" label with no button (the
  "Edit" link only reappears once back in view mode), and the Stats section's top row only shows
  "Edit EV's" when the redistribute panel is *closed* -- it disappears entirely while open rather
  than turning into a second Cancel.
- **Tightened the Stats section's top-row visibility check** (`(isOwner && (evsSpent < evsAvailable
  || assignOpen)) || (isGM && !editOpen)`) so the row doesn't render at all once neither toggle has
  anything to show -- without this, a non-owner GM opening "Edit EV's" would've been left looking at
  an empty bordered strip (the old code kept the row visible for any GM regardless of `editOpen`,
  relying on the now-removed Cancel button to fill it).

Verified in the browser: with the Info form open, confirmed the header row has zero buttons
(`querySelectorAll('a,button').length === 0`) while the bottom Save/Cancel pair still renders and
still works. Opened "Edit EV's" and confirmed the top row now shows only the "Assign EV's" toggle
(no second Cancel, no empty gap), and that the bottom Cancel still closes the panel with EVs
unchanged.

### Campaign GM dashboard: NPCs, Wild Pokémon, and Labels

- **NPCs are full trainer sheets the GM owns directly, not a separate concept.** A new
  `trainers.is_npc` boolean is purely a display/query discriminator -- it drives zero RLS on its
  own. Every NPC is inserted with `user_id` set to the *GM's own* `auth.uid()`, which means the
  original owner policy (`auth.uid() = user_id`, from the very first migration) already grants that
  GM full CRUD, and the existing fellow-player-visibility exclusion (which already hid any trainer
  owned by the campaign's GM, with a comment that literally already said "an NPC ally or GM PC")
  already keeps NPCs invisible to players. No RLS changes were needed for `trainers` itself -- the
  schema had effectively already anticipated this. A new `createNpc` action (`app/campaigns/[id]/
  actions.ts`) mirrors `createTrainer`'s validation but is its own function (not a shared refactor,
  per a design review's explicit recommendation) since its error redirects and campaign-membership
  check differ, and it skips the player-only `/starter` flow entirely, landing straight on the
  NPC's trainer sheet.
- **Wild Pokémon needed no new backend at all** -- it's the existing GM-created "pool" Pokémon
  concept (`campaign_id` + `created_by_user_id`, no `trainers_pokemon` row) that already existed
  for prepped encounters. Only two additions: `/pokemon/new` now accepts a `campaignId` searchParam
  to preselect its "Pool" dropdown, and a new campaign-scoped list page reuses the same
  `assignPokemon` action the dashboard already had.
- **Labels are colored, per-campaign, and shared between NPCs and Pokémon** (`campaign_labels` +
  `trainer_labels` + `pokemon_labels` join tables), for tagging things like which island an NPC or
  wild encounter belongs to. RLS reuses the existing `is_campaign_gm` / `is_campaign_gm_for_trainer`
  helpers; `pokemon_labels` deliberately goes through the label's own `campaign_id` rather than
  `is_campaign_gm_for_pokemon`, since that helper resolves via `trainers_pokemon` and would reject
  exactly the unassigned Wild Pokémon that need labeling. The color palette is a fixed set of ~13
  named colors (not a free hex picker) with a static `Record<PaletteColor, string>` class-name
  lookup in `lib/pta3/labelColors.ts` -- Tailwind's JIT scanner can't discover a dynamically-built
  `` `bg-${color}-100` `` string, so every class has to appear literally in source. Attaching labels
  (NPC sheet, Wild Pokémon rows) and filtering by them (both new list pages) are both plain checkbox
  groups with an inline "+ New label" mini-form, deliberately not a type-ahead combobox -- nothing
  like that exists anywhere else in this codebase, and the Type/Habitat filter already proven at a
  comparable ~18-option scale on the Pokémon-creation page was reused as the pattern instead.
- **Two new GM-only list pages** (`/campaigns/[id]/npcs`, `/campaigns/[id]/wild-pokemon`) rather than
  cramming everything onto the campaign page, since NPCs and Wild Pokémon can both grow much larger
  than the player roster -- each does its own server-side query with search + label filtering via
  URL params, so a campaign with dozens of NPCs never ships the whole roster to the browser just to
  filter down to a few. The campaign page itself now only shows lightweight GM-only summary cards
  ("N NPCs → View all") linking out to them, plus its Players section gained an `is_npc = false`
  filter so NPCs don't leak into what used to be a single mixed "Trainer Roster" list.
- **`deleteCampaign`'s trainer-count guard was narrowed to real players only** (`is_npc = false`) --
  it previously would have forced a GM to manually delete potentially dozens of NPCs one at a time
  before being allowed to delete a campaign. NPCs are now deleted automatically as part of campaign
  deletion instead, which cascades each one's `trainers_pokemon` link and **orphans their Pokémon
  back into the unassigned pool rather than deleting the Pokémon** -- an intentional, non-destructive
  default (confirmed via the cascade chain, not assumed).

Verified end-to-end in the browser: created an NPC ("Island Merchant Rowan"), confirmed the Labels
section appeared on its trainer sheet (gated on `isGM && is_npc`) where a player trainer shows none;
created a "Coral Island" label from there, attached it, and confirmed both the NPC list page's label
filter and a plain name-search correctly narrowed results to zero on a non-match. Created a wild
Pokémon via `/pokemon/new?campaignId=...` and confirmed the Pool dropdown was correctly preselected
from the URL; confirmed it landed on the Wild Pokémon list, attached a label to it via the inline
per-row editor, and confirmed the same zero-match filtering behavior there too. Assigned it to the
NPC and confirmed it disappeared from the Wild Pokémon list and appeared on the NPC's trainer sheet
as a real team member. Deleted the NPC and confirmed the campaign's NPC count dropped to 0 while the
Wild Pokémon count rose back to 1 -- the assigned Pokémon fell back into the pool rather than being
deleted, exactly as designed.

### Dashboard: split into Campaigns/Trainers/Pokémon, with delete and campaign-assignment

- **The Trainers section now shows only your own trainers** (`.eq('user_id', user.id)`), not the
  broader RLS-visible set (fellow campaign members', or every trainer in a campaign you GM) it used
  to rely on implicitly. That old query worked for a read-only list, but every row here now has a
  Delete button and a campaign-assignment control, so "everyone I can see" was the wrong scope --
  "mine" is. The campaign page is still where the full party roster lives.
- **Pokémon merges what used to be two separate lists** (each trainer's nested team, and a standalone
  "Unassigned Pokémon" section) **into one "Pokémon" section**, covering every Pokémon you have a
  claim to -- assigned to one of your own trainers (via `trainers_pokemon`, `!inner`-joined on
  `trainers.user_id`) or sitting in your personal/campaign pool (`created_by_user_id`). An assigned
  row just shows which trainer has it; an unassigned row gets the "assign to trainer" control that
  already existed plus a new "assign to campaign pool" control.
- **New `assignTrainerToCampaign`** (`app/campaigns/actions.ts`) lets a trainer's owner move it into
  (or out of, or between) any campaign they GM or are a member of, straight from the dashboard --
  the counterpart to the existing `leaveCampaign`, but usable without visiting the campaign's own
  page first, and without needing the trainer-creation flow to set one initially.
- **New `assignPokemonToCampaign`** (`app/pokemon/actions.ts`) does the same for an unassigned pool
  Pokémon's `campaign_id` (which Wild Pokémon list it shows up on) -- same "must be a campaign this
  user GMs" rule `createPokemon` already applied at creation time, just usable afterward too.
- **New `deletePokemon`** (`app/pokemon/actions.ts`) -- no explicit ownership filter in the action
  itself, same reasoning as `removePlayer`: existing RLS (`Owners can delete their pokemon` via
  trainer ownership, or `Creator manages their own unassigned pokemon` for pool Pokémon) already
  decides who this actually works for, so an unauthorized attempt just deletes zero rows rather than
  erroring. The dashboard only ever renders the button where the current user actually has one of
  those two claims.
- **`deleteTrainer`'s "extra validation" is a real bug fix, not just a confirm dialog.** Deleting a
  trainer cascades `trainers_pokemon` (`on delete cascade`), unlinking its Pokémon without deleting
  them -- the same "orphan into the pool, don't destroy" behavior already built for NPC deletion.
  But unlike NPCs (always created with `created_by_user_id` already set), Pokémon from the starter
  flow predate that column and never got it set. Without a fix, such a Pokémon would end up matching
  *no* RLS policy at all the moment its only link disappears -- permanently inaccessible to anyone,
  including its own former owner, a silent data-loss bug that predates this change. The fix: before
  the cascade, `deleteTrainer` now sets `created_by_user_id = <the trainer's owner>` on every Pokémon
  still linked to it, while `trainers_pokemon` still exists to satisfy the "Owners can update their
  pokemon" policy. The dashboard's delete confirmation also now names the actual consequence (e.g.
  "Their 3 Pokémon will become unassigned, not deleted") using a `Map<trainerId, count>` built from
  the same query that powers the Pokémon section, rather than a generic warning.

Verified end-to-end in the browser: assigned an unassigned pool Pokémon (Charmander) to a campaign
via the new "Save pool" control and confirmed it appeared on that campaign's Wild Pokémon list;
deleted a different pool Pokémon (Torkoal) and confirmed it disappeared. For the `deleteTrainer` fix
specifically -- created a throwaway trainer, gave it a starter Pokémon (Eevee, via the same
pre-existing starter flow that never sets `created_by_user_id`), deleted the trainer, and confirmed
`window.confirm` was called with a message correctly naming "Their 1 Pokémon will become unassigned,
not deleted," then confirmed Eevee actually re-appeared in the dashboard's Pokémon section afterward
-- fully visible and still deletable/assignable, not silently lost -- which is exactly the failure
mode this fix prevents. Cleaned up the throwaway Pokémon and restored the pre-existing test trainer's
campaign assignment afterward.

### Dashboard follow-up: split into dedicated pages, not just dedicated sections

- **The Dashboard is now just an entry point** -- the 4 "Create..." buttons, plus three nav cards
  ("N Campaigns / N Trainers / N Pokémon → View all") -- rather than the page that showed every
  trainer and Pokémon inline. The full lists (with every delete/assign control from the previous
  pass) moved to their own routes: `app/campaigns/page.tsx`, `app/trainers/page.tsx`,
  `app/pokemon/page.tsx`. This mirrors the exact pattern already proven on the campaign page (GM-only
  summary cards → dedicated NPC/Wild Pokémon list pages) rather than inventing a new one.
- **The Dashboard's Pokémon count needed more care than a plain head-count.** A Pokémon you created
  and then assigned to your own trainer matches *both* "created_by_user_id = you" and "linked to one
  of your trainers" -- a naive `count(assigned) + count(created_by_user_id = you)` double-counts it.
  Campaigns and Trainers counts are plain `{ count: 'exact', head: true }` queries (no such overlap
  there), but Pokémon fetches just `{ id, trainers_pokemon(trainer_id) }` for the pool side and
  filters in JS for "no link exists," matching the same assigned-vs-unassigned split `/pokemon`
  itself uses, without pulling the full row data the list page needs.
- **Moving the lists to their own pages surfaced a real regression, not just a refactor**:
  `deletePokemon`, `assignPokemonToCampaign`, `assignTrainerToCampaign`, and `deleteTrainer` all
  hardcoded `redirect('/dashboard')` on success, because the Dashboard used to be the only place
  they were ever called from. Once they moved to `/pokemon` and `/trainers`, that same hardcoded
  target would have yanked the user back to the (now mostly empty) Dashboard after every Delete or
  Save instead of leaving them on the list they were just using. Fixed by pointing each action's
  success (and error) redirects at its own list page instead -- `/pokemon` for the two Pokémon
  actions, `/trainers` for the two trainer actions (`deleteTrainer` is called from both `/trainers`
  and a specific trainer's own page, but "back to the trainers list" is the right landing spot
  either way, so no separate `returnTo` parameter was needed). `createPokemon`'s
  no-trainer-selected fallback redirect was updated the same way for consistency.

Verified end-to-end in the browser: visited `/dashboard` and confirmed the counts (1 Campaign,
1 Trainer, 3 Pokémon) matched the actual test data exactly, including that a Pokémon owned via one
of the user's own trainers wasn't double-counted. Clicked all three nav cards through to
`/campaigns`, `/trainers`, and `/pokemon` and confirmed each rendered the exact same content the old
Dashboard sections used to. Directly exercised the redirect-target fix: deleted a pool Pokémon from
`/pokemon` and confirmed the browser stayed on `/pokemon` afterward (`location.href` checked, not
assumed) rather than bouncing to `/dashboard`; saved a trainer's campaign assignment from `/trainers`
and confirmed the same for that page.

### Dashboard follow-up: remove the Dashboard's own Create/Join buttons

Now that every "Create..." and "Join a campaign" action already exists on its own dedicated page
(`/campaigns`, `/trainers`, `/pokemon`), the Dashboard's copies were pure duplication -- removed the
button row entirely, leaving just the three nav cards and Sign out. Nothing was lost, only
relocated: verified `/campaigns` still has "Join a campaign" and "+ New campaign", `/trainers` still
has "+ New trainer", `/pokemon` still has "+ New Pokémon".

### Prefill the campaign when creating a trainer from inside a campaign

`/campaigns/[id]/wild-pokemon`'s "+ New Pokémon" link and `/campaigns/[id]/npcs/new` already prefilled
their campaign correctly. The one gap: the campaign page's own "Create a trainer for this campaign"
link (shown to a non-GM player without a trainer there yet) pointed at a bare `/trainers/new` --
despite its own label's promise, the optional Campaign dropdown on that form landed on "No campaign"
every time, silently undoing what the button said it would do.

Fixed by adding the same `?campaignId=` prefill pattern already used for `/pokemon/new`'s Pool
dropdown: `TrainerForm` gained a `defaultCampaignId` prop (kept separate from the existing
`campaignId` prop, which is NPC-mode's *fixed*, non-editable value -- these are different concepts
that happen to share a name) that sets the Campaign `<select>`'s `defaultValue`, `/trainers/new`
reads it from `searchParams`, and the campaign page's link now passes its own `id` through.

Verified in the browser: navigated directly to `/trainers/new?campaignId=<id>` and confirmed the
Campaign `<select>`'s value and visible selected-option text both matched the campaign ("FilterPicker
GM Campaign") rather than defaulting to "No campaign."

### Convert an existing trainer into an NPC

Until now the only way to get an NPC was `createNpc` -- building one from scratch on
`/campaigns/[id]/npcs/new`. There was no way to take a trainer someone already had (made before
joining this campaign, or never tied to one at all) and turn it into an NPC here instead.

- **New `convertTrainerToNpc(campaignId, formData)`** (`app/campaigns/[id]/actions.ts`) is a single
  `update` doing what `createNpc`'s insert does for the two columns that actually matter --
  `campaign_id` and `is_npc` -- rather than a bigger operation. GM-only (must GM `campaignId`), and
  scoped with `.eq('user_id', user.id).eq('is_npc', false)` on the update itself: only your own
  *regular* trainers are convertible, both so this can't be used to conscript someone else's
  trainer and so re-submitting on an already-converted one fails cleanly (`.maybeSingle()` on the
  update's `.select()` comes back empty, which the action treats as "not authorized, or already an
  NPC" rather than silently doing nothing). No new RLS was needed -- once `is_npc` flips, all the
  visibility rules `createNpc` already relies on (owner policy grants the GM full rights since
  `user_id` is already theirs, fellow-player exclusion keys off `user_id = campaign.gm_user_id`
  which was already true) apply automatically to a converted trainer exactly like a created one.
- **New UI on `/campaigns/[id]/npcs`**: a "Turn an existing trainer into an NPC here" form listing
  the GM's own non-NPC trainers, gated behind a `ConfirmButton` that spells out the actual
  consequence ("It will move into this campaign and become GM-only -- hidden from fellow players,
  and off the global Trainers list") rather than a generic confirmation, matching this session's
  established pattern for anything that changes visibility or ownership.
- **`/trainers` (the global list) now also filters `is_npc = false`**, alongside its existing
  `user_id = you` filter. Without this, a trainer you'd just converted would keep showing up there
  too -- with its own "assign to campaign" and Delete controls overlapping the ones the NPC now has
  on its campaign's own page -- even though it's no longer a "trainer" in the sense that list means.
  This mirrors the same exclusion the campaign page's Players section and `createNpc` already apply.

Verified end-to-end in the browser: created a fresh trainer ("Convertible Bob") with no campaign,
confirmed it appeared as a convert-candidate on `/campaigns/[id]/npcs` alongside the GM's other
existing trainer, converted it, and confirmed all three consequences at once -- it landed on its own
trainer sheet with the GM-only Labels section now visible (proof `is_npc` flipped), it appeared in
that campaign's NPC list (and dropped out of the convert dropdown's remaining options), and it no
longer appeared on `/trainers`. Cleaned up by deleting the converted test trainer afterward.

### Back-links go to the relevant overview, not always the Dashboard

The Trainer, Campaign, and Pokémon detail pages all used a generic "← Dashboard" back-link. Now that
each of those has its own dedicated overview page (`/trainers`, `/campaigns`, `/pokemon`), a link that
always bounced back to the Dashboard was a step backwards -- the natural "back" target from a detail
page is the list you most likely came from, not the top-level nav hub.

- **`app/trainers/[id]/page.tsx`**: back-link changed from `← Dashboard` (`/dashboard`) to
  `← Trainers` (`/trainers`).
- **`app/campaigns/[id]/page.tsx`**: back-link changed from `← Dashboard` (`/dashboard`) to
  `← Campaigns` (`/campaigns`).
- **`app/trainers/[id]/pokemon/[pokemonId]/page.tsx`**: previously had only a single link back to the
  owning trainer, no way back to the Pokémon overview at all. Now shows both: a new `← Pokémon` link
  to `/pokemon` (taking over the "back" arrow), plus the existing trainer-name link kept alongside it
  (no longer prefixed with an arrow, since it's a cross-link rather than "back") -- so a Pokémon page
  still lets you jump straight to its trainer without losing the path back to the full Pokémon list.

Verified end-to-end in the browser against the existing test fixtures: the Trainer page
(`/trainers/4f1e4c90-...`) showed `← Trainers` linking to `/trainers`; the Campaign page
(`/campaigns/2b336637-...`) showed `← Campaigns` linking to `/campaigns`; the Pokémon page
(`/trainers/.../pokemon/567a8b1b-...`) showed both `← Pokémon` linking to `/pokemon` and a separate
"Filter Tester Trainer" link to `/trainers/4f1e4c90-...`.

### Every Pokémon/Trainer mention is now a link, and Wild Pokémon finally have a page

Wild Pokémon (unassigned pool Pokémon, `campaign_id` set but no `trainers_pokemon` row) could never be
opened at all -- the Pokémon detail page lived at `/trainers/[id]/pokemon/[pokemonId]`, a route that
structurally requires a trainer. The `/pokemon` list and the campaign's Wild Pokémon list also just
rendered each Pokémon's name as plain text, not a link, even for Pokémon that *did* have a trainer and
a real page to go to.

- **Moved the Pokémon detail page to `/pokemon/[pokemonId]`**, out from under `/trainers/[id]`. The
  route no longer needs a trainer at all -- the page already fetched the owning trainer (if any)
  through the `pokemon` row's own `trainers_pokemon` embed, so dropping the `trainerId` param just
  meant deriving `trainerId`/`trainer` from that embed instead of taking it off the URL, and pointing
  every internal link/redirect (`updatePokemonDetails`, `MovesSection`'s Edit/Done links, the Edit-info
  Cancel link, `createPokemon`/`assignPokemon`'s post-save redirects) at the new path. The old
  `app/trainers/[id]/pokemon/` directory is deleted; its actions file was merged into
  `app/pokemon/actions.ts` (`updatePokemonDetails`, `learnMove`, `forgetMove`, `setMoveUsesRemaining`,
  `assignPokemonEv`, `setPokemonEvs`, `adjustPokemonHp`, `addPokemonExp`) alongside the create/assign/
  delete actions already there -- one file for all Pokémon actions instead of two.
- **The header now conditionally shows a trainer cross-link**: `← Pokémon` always goes to `/pokemon`;
  a second `· {trainer name}` link to `/trainers/{trainerId}` only renders when the Pokémon actually
  has one, so a Wild Pokémon's header doesn't dangle a link to a trainer that doesn't exist. The three
  read-only "Trainer: X" lines elsewhere on the page got the same link-when-present treatment.
- **Fixed a real permissions gap this surfaced**: `isOwner`/`isGM` on the Pokémon page (and in
  `updatePokemonDetails`, `addPokemonExp`, and the shared `loadPokemonEvContext` used by
  `assignPokemonEv`/`setPokemonEvs`) were derived purely from `trainers_pokemon.trainers` -- which is
  `null` for a Wild Pokémon, so every one of those checks silently evaluated to `false` and a GM
  couldn't edit, EV-assign, or add experience to their own unassigned Pokémon at all. Since a Wild
  Pokémon has no trainer, and RLS's own `created_by_user_id`-based policy (`Creator manages their own
  unassigned pokemon`, `20260727100000_pokemon_pool.sql`) already grants its creator full CRUD
  regardless of campaign, both `isOwner` and `isGM` now collapse to `created_by_user_id === user.id`
  whenever there's no `trainers_pokemon` row -- deliberately unifying "owner" and "GM" into one tier
  for pool Pokémon (rather than inventing a third permission level) so the creator gets every edit
  control a GM would, matching what RLS already lets them do.
- **Every Pokémon and Trainer name mentioned anywhere is now a link to its own page**: the `/pokemon`
  list (`app/pokemon/page.tsx`), the campaign's Wild Pokémon list
  (`app/campaigns/[id]/wild-pokemon/page.tsx`), and each trainer's Pokémon bullets on the campaign page
  (`app/campaigns/[id]/page.tsx`, whose query gained the Pokémon `id` needed to link it) all wrap the
  Pokémon name in a `Link` to `/pokemon/{id}`; the `/pokemon` list's "Trainer: X" line and the Pokémon
  page's "Trainer: X" lines link to `/trainers/{trainerId}`. The Trainer page's Team list, the campaign
  page's Players list, and the NPC list already linked correctly and needed no change.

Verified end-to-end in the browser: opened Batty (a Wild Zubat with no trainer, `campaign_id` set to
FilterPicker GM Campaign) directly from the campaign's Wild Pokémon list at its new `/pokemon/{id}`
URL, confirmed the header showed only `← Pokémon` (no dangling trainer link) and "Trainer: —"; opened
its Edit panel, confirmed the GM-only fields (Nature, Type, Held item, etc.) were present and not
silently hidden; changed its nickname, saved, and confirmed the change persisted after a fresh
navigation (proof `isGM` now resolves correctly for a pool Pokémon) -- then reverted the nickname back.
Also confirmed Squirty's page still works unchanged at its new `/pokemon/{id}` URL (trainer cross-link
included), and that Squirty, Batty, and Charmander are all now clickable from `/pokemon`, the campaign's
Wild Pokémon list, and the campaign page's per-trainer roster.

### Dashboard's Trainer count included NPCs

The Dashboard's "N Trainers" card counted every row in `trainers` owned by the user
(`app/dashboard/page.tsx`'s `trainerCount` query), with no `is_npc` filter -- so a trainer the user had
converted into a campaign NPC (via `convertTrainerToNpc`) still inflated that count, even though the
`/trainers` overview it links to has always filtered `is_npc = false` and correctly excludes NPCs (they
get their own page, `/campaigns/[id]/npcs`). The result: the Dashboard could claim "3 Trainers" while
`/trainers` only listed 1, with no indication the other 2 were NPCs rather than a bug.

- Added the same `.eq('is_npc', false)` the `/trainers` page already uses to the Dashboard's
  `trainerCount` query, so both numbers now agree.

Verified end-to-end in the browser: with one regular trainer and two NPCs (from earlier NPC-conversion
testing) on the account, the Dashboard changed from "3 Trainers" to "1 Trainers", matching `/trainers`'
own count exactly.

### Eliminated the remaining full-page-reload interactions

The Pokémon page's HP/EV/Moves/Exp controls were already converted (an earlier session) from
`<form action={serverAction}>` + `redirect()` to plain functions called directly from client
components, returning a result object the client applies to local state instead of navigating.
Everywhere else in the app that pattern hadn't been carried through yet: assigning a Pokémon to a
trainer, the campaign-assignment dropdowns on the trainer/Pokémon lists, all label editing, and the
trainer page's own Level/HP/feature-charge controls still reloaded the whole page on every click.

- **`assignPokemon` (`app/pokemon/actions.ts`)**: also fixed a real bug while converting it -- it
  redirected to the newly-assigned Pokémon's own detail page on success, which yanked the GM away
  mid-batch when assigning several Wild Pokémon in a row. Now returns `{ trainerId, trainerName }`;
  the calling row updates itself and, on the Wild Pokémon list, simply drops out of the list (which
  only ever shows unassigned Pokémon) instead of navigating anywhere.
- **`assignPokemonToCampaign`** (`app/pokemon/actions.ts`) and **`assignTrainerToCampaign`**
  (`app/campaigns/actions.ts`): same conversion for the "Save pool" / campaign-assignment dropdowns
  on `/pokemon` and `/trainers` -- new client components `PokemonAssignmentPanel` and
  `TrainerCampaignControl` own the dropdown + a brief "Saved" confirmation.
- **`createLabel`, `setTrainerLabels`, `setPokemonLabels`** (`app/campaigns/[id]/actions.ts`): the
  `returnTo`-redirect pattern (needed because Wild Pokémon have no detail page of their own to land
  on) is gone entirely -- `safeReturnTo` is deleted, all three now return a result object. New client
  components: `WildPokemonList` (owns the whole Wild Pokémon list client-side, since creating a label
  from any one row's picker needs to appear in every other row's picker too -- lifting the labels
  list into one shared piece of state) and `NpcLabelsSection` (the equivalent single-trainer version
  on an NPC's sheet).
- **Trainer page Level/HP/feature-charges**: the biggest piece. `adjustTrainerHp`, `useFeatureCharge`,
  and `resetFeatureUses` converted the same simple way as their Pokémon-page equivalents.
  `adjustTrainerLevel` was more involved -- a level change can move HP, all five stats, which
  advanced-class slots are filled, *and* which Active/Passive Features are unlocked (subclass
  features scale off a per-subclass relative level that shifts on every raw level change, milestone
  or not), so it now returns a full authoritative snapshot of all of that rather than just the
  level number. The advanced-class-name and Features derivation logic was pulled out of the page into
  a new shared `lib/pta3/trainerFeatures.ts` (`loadTrainerDerived`) so the initial server render and
  the post-adjustment client snapshot can never drift apart. A new `TrainerStateProvider` context
  (`app/trainers/[id]/TrainerInteractive.tsx`) holds all of this, consumed by `LevelSection`,
  `TrainerHpSection`, `StatsSection`, `SkillsSection`, `ActiveFeaturesSection`, and
  `PassiveFeaturesSection`. Crossing a milestone still needs the level-up picker -- a genuinely
  different page -- so that case still navigates there, via `router.push` from the client rather than
  a server `redirect()`.

Verified end-to-end in the browser against the existing test fixtures, confirming `location.href`
never changed and no navigation occurred for any of these: damaged and healed Filter Tester Trainer's
HP (20 → 17 → 20); leveled them up 1 → 2 (confirming a brand-new level-2 Active Feature, "Intimidate",
appeared automatically) and used/reset its charge (3 → 2 uses), then leveled back down to 1
(confirming the feature disappeared again); assigned Charmander (a pool Pokémon) to Filter Tester
Trainer from `/pokemon`, watching its row swap live from the assign form to "Trainer: Filter Tester
Trainer"; re-saved Filter Tester Trainer's campaign assignment from `/trainers`, seeing the "Saved"
confirmation; and, on the campaign's Wild Pokémon list, created a brand new label ("Reload Test
Label"), confirmed it immediately appeared in Batty's label picker, toggled it on and off, and saved
both times -- all without the URL or page ever changing.

### Campaign link on the Pokémon page; Trainer page gets a proper Info card

Neither page said which campaign a Pokémon or trainer actually belonged to, even though the data was
one query away -- you had to already know, or go check the campaign roster yourself.

- **Pokémon page** (`app/pokemon/[pokemonId]/page.tsx`): a `Campaign: <link>` line now sits right
  under `Trainer:` in all three Info variants (view-only, owner edit, GM edit). Campaign comes from
  wherever it actually lives: a trainer-assigned Pokémon's campaign is its trainer's campaign (the
  query's `trainers(...).campaigns` embed gained `id, name`); a Wild/pool Pokémon has no trainer at
  all, so it falls back to the Pokémon's own `campaign_id` (the query gained a top-level
  `campaign:campaign_id(id, name)`). Hidden entirely when there's no campaign either way.
- **Trainer page** (`app/trainers/[id]/page.tsx`): a much bigger restructure, per explicit spec --
  Team moved from the left aside to the right column, and a new **Info** card took its place on the
  left, showing Trainer name, Class with its level, Subclasses with their own per-subclass levels
  (only once unlocked), Background (origin), a Campaign link (only if in one), and a static HP
  readout, with the interactive Heal/Damage card directly beneath it. The Level +/- controls moved
  into this card too, right next to the Class line, since they're the one thing here that actually
  changes the rest of the card.
  - `loadTrainerDerived` (`lib/pta3/trainerFeatures.ts`) now returns `advancedClasses: { name, level
    }[]` instead of pre-joined display strings, computing each subclass's own relative level (already
    calculated for feature-unlocking, just not previously surfaced) -- both the trainer page's initial
    render and `adjustTrainerLevel`'s live snapshot use the same shape.
  - **New: the Info card is editable (owner-only) for the trainer's name.** A new `renameTrainer`
    action (`app/trainers/actions.ts`), owner-scoped like `deleteTrainer`, called directly from an
    inline Edit/Save/Cancel form -- no reload, matching every other control converted this session.
    The page's `<h1>` now also reads the name from the same shared context (a new
    `TrainerNameHeading` client component) so a rename updates both places at once instead of leaving
    the page title stale. Scope note: only the name is editable for now -- Class/Subclass/Level
    changes still go through the existing Level +/- control and the level-up picker, which already
    handle the milestone math (stat increases, HP gains, subclass slot picks) that a freeform edit
    would have to reimplement; Campaign reassignment still happens from `/trainers`, not here.

Verified end-to-end in the browser: on the Pokémon page, confirmed Squirty (trainer-assigned) shows
"Campaign: FilterPicker GM Campaign" linking correctly, and Batty (a Wild Pokémon with no trainer)
also shows the same campaign via its own `campaign_id`, with "Trainer: —" alongside it. On the
trainer page, confirmed the new layout (Info + HP card on the left, Team first on the right);
renamed Filter Tester Trainer via the Info card's Edit toggle and watched both the card and the page
`<h1>` update live with no reload, then reverted the name back; leveled the trainer 1 → 2 → 3,
confirming the Class line's level ticked up and, on hitting the level-3 milestone, `router.push`
navigated to the level-up picker exactly as before; resolved the milestone into "Underdog," confirmed
the Info card's new "Subclasses" list showed "Underdog (Level 1)" and HP jumped to 24/24; then leveled
back down to 1, confirming the subclass entry disappeared and HP/level reverted, restoring the
original fixture state.

### Team moved into its own right sidebar

Follow-up to the Info-card restructure above: Team was still just the first section in the middle
column rather than a real sidebar. `app/trainers/[id]/page.tsx` is now a genuine three-column layout
-- Info + HP on the left, Rest/Stats/Skills/Features/Trainer Moves in the middle, Team on the right
-- widened from `max-w-4xl` to `max-w-6xl` (matching the Pokémon page's own three-region width) so the
middle column still has room to breathe with two 16rem sidebars now instead of one.

Verified in the browser via each `<aside>`'s bounding rect: the Info/HP sidebar sits at `left: 96px`,
Team at `left: 913px` -- a real right-hand column, not just reordered content inside the same flex
container.

### Info section rework: cleaner layout, and Class/Subclass/Level/Background become directly editable

- **Layout**: Level is its own line (no more "Class (Level N)" or per-subclass "(Level N)" -- see the
  design note below on why per-subclass levels stopped being tracked here), Subclasses list names
  only, Background dropped "(Difficult)" from its line in favor of its own separate `Lifestyle:` line,
  HP is gone from this card entirely (it's directly below in its own Hit Points card), and every field
  label (`Class:`, `Level:`, `Subclasses:`, `Background:`, `Lifestyle:`, `Campaign:`) is bold.
- **The old level +/- buttons are gone.** Level is now one of several fields in the Info card's Edit
  form (owner-or-GM, same permission the old +/- control had), alongside Class, up to 3 Subclass
  slots (options scoped to whichever Class is currently selected in the form, resetting if Class
  changes), and Background -- Name stays owner-only within the same form, same scoping
  `renameTrainer` had (now folded into this one form and removed as its own action).
- **Design decision, and a real bug it surfaced**: Class/Subclass/Level/Background are plain
  overrides with no derived side effects -- the same "GM directly fixes/sets it" model the Pokemon
  page's GM-only edit fields already use -- rather than replaying the milestone system's HP-gain /
  stat-increase / undo-on-level-down machinery. The first version of this *did* try to reuse that
  machinery (stepping the level one at a time internally, matching the removed +/- buttons' exact
  behavior), and live-testing caught a real bug in that approach: a subclass assigned this way never
  gets a `trainer_milestones` row (only `resolveMilestone`, i.e. the level-up page, writes one), so
  leveling back down had nothing to undo and silently left the +4 HP gain in place forever. Since the
  milestone HP gain was previously applied by the old +/- buttons' `adjustTrainerLevel` (now deleted
  entirely, along with `TrainerLevelSnapshot` -- both fully unused once nothing called them), that
  logic now lives directly inside `resolveMilestone` instead, making it the single, self-contained
  place a milestone actually gets resolved -- regardless of whether the trainer arrived at a pending
  milestone via a level-up-crossing Info edit or (historically) the old buttons. A milestone crossed
  via the Info form's Level field doesn't auto-grant anything; it just correctly flips
  `hasPendingMilestone`, and the existing "Resolve now" banner (now a reactive client component,
  `PendingMilestoneBanner`, reading from context instead of being computed once at page load) is
  still there for whoever wants the full stat-increase/HP-gain/subclass-pick treatment.
- New `updateTrainerInfo` action (`app/trainers/actions.ts`) replaces `adjustTrainerLevel`/
  `renameTrainer`, returning a `TrainerInfoSnapshot` (name, level, stats, HP, advancedClasses,
  features, className, originName, lifestyle, hasPendingMilestone, nextMilestoneLevel) applied
  wholesale to the trainer page's client state. New shared `loadPendingMilestone`
  (`lib/pta3/trainerFeatures.ts`) computes hasPendingMilestone/nextMilestoneLevel once, used by both
  the page's initial render and this action so they can't drift apart.

Verified end-to-end in the browser: confirmed the new field layout and bold labels; opened Edit and
jumped Level directly from 1 to 3 with a Subclass picked in the same save -- confirmed it applied
instantly (no reload), the Subclasses line showed "Underdog", and HP jumped to 24/24 the same as the
old +/- flow used to (the level-crossing HP grant still fires the first time, since nothing had
resolved that milestone through `resolveMilestone` yet at that point). Then reproduced the bug:
leveled back down to 1 via the same form and confirmed HP incorrectly stayed at 24/24 -- diagnosed and
fixed as described above. Re-verified post-fix with a clean run: jumped Level 1 → 3 with no subclass
this time, confirmed HP correctly did *not* change and the "Resolve now" banner appeared reactively
with no reload; clicked through to the level-up page, resolved the milestone (Underdog, Attack/Defense
+1), confirmed HP correctly went 24 → 28 there instead; leveled back down to 1 and cleared the
subclass via the Info form, confirming the page returns to a clean Level 1 / no-Subclasses state.

### Max HP always recalculated on Info save; Stats section rework

Follow-up bug fix plus a Stats section pass, both on the trainer page.

- **`updateTrainerInfo` (`app/trainers/actions.ts`) now always recomputes Max HP from scratch** on
  every save -- `BASE_MAX_HP` (20, matching `trainers.max_hp`'s own DB default) plus one
  `MILESTONE_HP_GAIN` per currently-filled Subclass slot in the very save being made, rather than
  trusting whatever was already stored. This is the real fix for the stuck-HP bug from the previous
  session's testing (a test trainer left at 28 max HP with 0 subclasses, from before `resolveMilestone`
  became the sole HP-granting path) -- any Info save now self-corrects it instead of requiring a
  fresh, correctly-sequenced level-up to notice the drift. Current HP is only ever clamped down to
  fit the recalculated max, never auto-healed up, so this can't be used as a free-heal side effect of
  e.g. renaming a trainer.
- **Stats section** (`StatsSection`, `app/trainers/[id]/TrainerInteractive.tsx`): properly capitalized
  labels (`Special Attack`, not `special attack`) via a new `STAT_LABELS` map; the modifier column now
  reads `(+3)` instead of `(mod +3)`; and each stat's Value is now a `ClickTooltip` (the same
  click-to-open, portaled-to-`<body>` component the Pokemon page's own Stats section already uses)
  showing a `Base: X` / `+1 at Level N (Subclass)` per milestone increase / `Total: X` breakdown.
  Since `trainers.attack` etc. only ever store the current total (resolveMilestone adds directly to
  it, nothing keeps the original point-buy value separately), the base is reconstructed server-side
  by subtracting however many `trainer_milestones` rows named that stat as `stat_a`/`stat_b` -- a new
  `statBreakdown` computed in `page.tsx` and passed down as a plain prop (not context state, since
  nothing on this page can change it without a real navigation back through `resolveMilestone`).
  Also swapped the `grid grid-cols-2/3` layout (which the user felt "looked a bit strange") for a
  `<table>` -- Stat / Value / Modifier columns, one stat per row, matching the Pokemon page's own
  Stats table -- so every stat reads top-to-bottom instead of wrapping across a multi-column grid.

Verified end-to-end in the browser: opened the Attack tooltip and confirmed it read exactly
`Base: 6 / +1 at Level 3 (Underdog) / Total: 7` for a stat that had gone through the milestone tested
above; confirmed the table layout renders capitalized labels and `(+3)`/`(+0)`-style modifiers with no
`mod` prefix; then, with the trainer's max HP still stuck at 28 from prior testing (0 subclasses),
opened the Info section's Edit panel and saved with no changes -- confirmed Max HP correctly
recalculated down to 20 and Current HP followed it down to 20/20, fixing the drift and restoring the
test fixture to its original baseline in the same step.

### Stats, advanced classes, and Max HP derived from level + milestones, not stored as running totals

A real architectural bug, reported after the previous fix: leveling a trainer back down did not undo
the stat increases or advanced classes a milestone had granted. Root cause was that `resolveMilestone`
mutated `trainers.attack`/`defense`/etc. and `advanced_class_1_id`/`2_id`/`3_id` directly in place --
`trainer_milestones` was built as an "audit trail" for undoing this, but nothing ever actually read it
to reconstruct current state on a level change. The user proposed a D&D-Beyond-inspired fix: tie the
stat-increase and advanced-class *choices* to the feature's own level-gated existence (the same way
the `features` table's `level_required` already gates Active/Passive Features), rather than storing
them as freestanding mutable columns.

- **Migration** (`20260731120000_derive_trainer_stats_from_milestones.sql`): renamed
  `attack`/`defense`/`special_attack`/`special_defense`/`speed` to `base_attack`/etc. (forcing every
  call site to be touched deliberately rather than silently reading a redefined column), backfilled
  true base values by subtracting each trainer's historical milestone grants, dropped `max_hp`
  entirely (now fully computed, matching how Pokemon max HP was never stored either), and dropped the
  3 `advanced_class_N_id` slot columns plus the long-dead legacy `trainers.subclass_id` column. A
  pre-migration query confirmed no trainer had an orphaned `advanced_class_N_id` (one set via the raw
  Subclass-editing form with no matching `trainer_milestones` row), so no data was lost.
- **`lib/pta3/trainerFeatures.ts`** is now the single place that turns `(level, trainer_milestones)`
  into every derived value: `loadQualifyingMilestones` (rows with `level <= trainer.level`, the one
  query everything else is built from), `computeEffectiveStats` (base + 1 per qualifying stat_a/
  stat_b hit), `computeMaxHp` (`BASE_MAX_HP + MILESTONE_HP_GAIN` per qualifying milestone),
  `loadTrainerDerived` (advanced classes/features, now built from qualifying milestones instead of 3
  raw slot columns), and a rewritten `loadPendingMilestone` (pending = the first class milestone level
  `<= trainer.level` with **no existing `trainer_milestones` row at that exact level** -- keyed off
  the table's own `(trainer_id, level)` primary key). That last point is what makes leveling back up
  past an already-resolved milestone silently restore it instead of re-prompting: the row never left,
  it just stopped (and starts again) counting toward `loadQualifyingMilestones`.
- **`resolveMilestone`** and **`updateTrainerInfo`** (`app/trainers/actions.ts`) no longer write to
  any stat/advanced-class/max-HP column at all -- `resolveMilestone` only bumps `current_hp` and
  inserts the `trainer_milestones` row (now load-bearing, not just an audit log); `updateTrainerInfo`
  only writes `name`/`class_id`/`level`/`origin_id`/`current_hp` (clamped to the newly-derived max).
- **Subclass editing removed from the Info form's Edit mode** (`TrainerInfoSection`,
  `app/trainers/[id]/TrainerInteractive.tsx`) -- this directly follows from the fix: Subclasses are
  now only ever granted through `resolveMilestone` on the level-up page, so there's no longer a way to
  create a subclass grant that Level has no way to take back. Class/Level/Background stay freely
  editable exactly as before.

Verified end-to-end in the browser on a trainer with a pre-existing level-3 milestone (Underdog,
+1 Attack/Defense, HP 20/24): leveled down to 1 and confirmed Subclasses/stat bonuses/HP bump all
disappeared with no reload; leveled back up to 3 and confirmed everything silently reappeared with no
"Resolve now" banner and no duplicate `trainer_milestones` row (checked directly via `supabase db
query`); leveled to 7 (a fresh, never-resolved milestone), confirmed the banner appeared, resolved it
on `/level-up` (Special Attack/Special Defense, Strategist), and confirmed the new subclass, +1/+1
stats, and HP 24/28 all applied correctly, with the tooltip breakdown reading
`Base: 1 / +1 at Level 7 (Strategist) / Total: 2`. Confirmed the Info form's Edit mode no longer shows
any Subclass picker.

### Editing an already-resolved milestone's subclass and stat choice

Follow-up request: with Subclass raw-editing removed from the Info form, there was no way left to fix
a milestone choice made in error (the reported case: picking Special Attack/Speed at level 3 but
wanting to change it) short of leveling all the way back down and up through it again. Since
`trainer_milestones` is now the single source of truth (see above), the natural fix is to let an
owner/GM edit that row's choice in place -- still "the choice lives inside the feature," just editable
after the fact, rather than reintroducing a freeform override that could drift from `level` again.

- **`resolveSubclassChoice`** (`app/trainers/actions.ts`) -- the "Stat ace"/"Type ace" combined-picker
  resolution logic (previously inlined in `resolveMilestone`) was factored into a shared helper
  returning `{ subclass, chosenStat, chosenTypeId } | { error }`, since the new `editMilestone` needs
  the exact same resolution with a different follow-up (an `update` instead of an `insert`).
- **`editMilestone(trainerId, level, formData)`** -- validates the same as `resolveMilestone`, but
  targets a specific already-existing `trainer_milestones` row by its `(trainer_id, level)` primary
  key instead of computing the next pending one. The "already held" check excludes the row's own
  current `subclass_id` (so re-selecting the same subclass, or picking a different one, both work),
  computed from *all* of the trainer's milestones unfiltered by level -- a subclass should never be
  double-assigned to two milestone levels regardless of whether one is currently "qualifying." HP is
  untouched: the milestone count isn't changing, only which subclass/stats it points at.
- **`lib/pta3/advancedClassOptions.ts`** (new) -- `loadAdvancedClassOptions` factors out the
  subclass/stat-ace/type-ace option-building logic that used to live directly in the level-up page,
  shared with the new edit page below (parameterized by which subclass ids count as "held," so the
  same helper works for both "resolving the next milestone" and "editing an existing one").
- **`app/trainers/[id]/level-up/[level]/page.tsx`** (new) -- same form as the level-up page, pre-filled
  from the existing milestone row's `stat_a`/`stat_b`/`subclass_id`/`chosen_stat`/`chosen_type_id`
  (`AdvancedClassPicker` gained optional `initialChoice`/`initialChosenStat`/`initialChosenTypeId`
  props to support this), posting to `editMilestone` instead of `resolveMilestone`. Redirects to the
  trainer page with an error if no milestone exists at that level.
- **Trainer page** (`TrainerInteractive.tsx`) -- the Subclasses line in the Info section's view mode
  became a small list, one subclass per row, each with an "Edit" link (owner/GM only, same `canEdit`
  gate as the rest of the section) to `/trainers/{id}/level-up/{grantedAtLevel}`. `TrainerAdvancedClass`
  (`lib/pta3/trainerFeatures.ts`) gained a `grantedAtLevel` field (the milestone's actual trainer level,
  distinct from the subclass's own relative level already shown elsewhere) so this link target exists.

Verified end-to-end in the browser: clicked "Edit" next to the level-3 Underdog subclass, confirmed
the form pre-filled Stat 1/Stat 2 as Attack/Defense and the advanced class dropdown as Underdog;
changed the stats to Special Attack/Speed, saved, and confirmed on the trainer page that Attack/
Defense reverted to their base values (6/6), Special Attack and Speed both became 2 (+1), Underdog
stayed as the subclass, and HP was untouched (24/24) -- with the tooltip correctly reading
`Base: 1 / +1 at Level 3 (Underdog) / Total: 2`. Confirmed via `supabase db query` that the
`trainer_milestones` row was updated in place (still exactly one row for that trainer/level, not
duplicated).

### Bug fix: three call sites still selected the dropped `max_hp` column

Reported as "Trainer not found" when clicking Heal. Root cause: dropping `trainers.max_hp` (in the
derive-stats-from-milestones migration above) was only followed through in `page.tsx` and
`updateTrainerInfo`/`resolveMilestone` -- `adjustTrainerHp` (the Heal/Damage buttons), `restSleep`, and
the campaign roster page (`app/campaigns/[id]/page.tsx`) still ran `.select('..., max_hp')`, which
Supabase silently returns as `data: null` for (these queries aren't schema-typed in this project, so
`tsc` had nothing to catch -- only a project-wide grep for the dropped column name across `app/`
turned this up, which is what should have been done immediately after the migration instead of
trusting the typecheck alone). A null row reads as "not found" everywhere these functions checked
`if (!trainer)`, which is why Heal/Damage/Sleep and the campaign Players list all broke at once.

Fixed all three to recompute Max HP via `computeMaxHp(await loadQualifyingMilestones(...))` instead of
reading a column, matching how `page.tsx` already does it. The campaign roster page batches this per
trainer with `Promise.all` since it renders a list.

Verified end-to-end in the browser: Damage (24 → 19/24), Heal by 10 (correctly capped at 24/24, not
29), and Sleep (rolled 1, correctly capped Max HP at 24, healed 14 → 15/24) all worked with no error;
confirmed the campaign page's Players list now renders "Level 3 Ace trainer — 15/24 HP" instead of
crashing/showing nothing.

### Pokémon assignment: campaign-less trainers, grouped dropdown, and unassign

The `/pokemon` list's "assign to trainer" control had two real bugs: `assignPokemon`
(`app/pokemon/actions.ts`) required the target trainer to already have a `campaign_id` AND that
campaign's GM to be the caller -- so a trainer with no campaign could never receive an assignment at
all, not even from their own owner, and a non-GM player saw an empty dropdown no matter what. There was
also no way to send an already-assigned Pokémon back to the unassigned pool.

- **`assignPokemon`** now checks the same two claims `trainers_pokemon`'s own RLS already grants --
  the trainer's owner (`trainer.user_id === user.id`), OR that trainer's campaign GM
  (`trainer.campaign_id && campaigns.gm_user_id === user.id`) -- with neither side required to have a
  campaign. This is what makes assigning your own personal Pokémon to your own campaign-less trainer
  work.
- **`unassignPokemon`** (new) deletes the `trainers_pokemon` row, sending the Pokémon back to the
  unassigned pool. Before deleting the link, it reassigns `created_by_user_id` to whoever's doing the
  unassigning -- same reasoning as `deleteTrainer`'s existing Pokemon reassignment: once unlinked, a
  pool Pokemon with no `trainers_pokemon` row and no `created_by_user_id` claim matches no RLS policy
  at all and becomes permanently inaccessible to everyone, including whoever just unassigned it.
  Authorization is left entirely to RLS (owner or campaign GM), same "just call it, zero rows affected
  if unauthorized" pattern as `deletePokemon`/`removePlayer`.
- **`/pokemon` page's `assignableTrainers` query** was rebuilt from two halves merged and deduped by
  id: every trainer the user owns (any campaign or none) + every trainer in a campaign the user GMs
  (the existing GM-hands-a-Pokemon-to-a-player workflow) -- instead of the old single inner-joined
  query that silently required both "in a campaign" and "GM of it."
- **`PokemonAssignmentPanel`**: the trainer `<select>` is now grouped with native `<optgroup>`s ("My
  Trainers" first, then one group per campaign, alphabetically) -- addressing the "might become a very
  large list" concern with the lowest-effort option (no combobox/search component exists anywhere in
  this codebase yet, so this isn't the place to introduce one) rather than leaving it as one flat,
  ungrouped list. Each option also shows "(NPC)" for NPC targets, matching the Wild Pokémon list's own
  convention. Assigned rows gained an "Unassign" button next to the "Trainer: X" link.

Verified end-to-end in the browser: created a throwaway campaign-less trainer, confirmed it appeared
in the dropdown's "My Trainers" group and could receive an assignment (previously impossible);
unassigned it and confirmed the Pokémon returned to the unassigned pool with the dropdown UI
reappearing, no reload; confirmed via `supabase db query` that the `trainers_pokemon` link was gone
and `created_by_user_id` was correctly reassigned to the unassigning user, not left orphaned.

### Permission model clarified: Campaign membership hands GM-tier control to the GM alone

The user listed five specific cases they wanted cleared up around Pokémon/Trainer creation,
assignment, and editing -- after a clarifying round of questions, the underlying rule turned out to
be one consistent principle, confirmed explicitly: **once a Trainer or Pokémon belongs to a Campaign,
only that Campaign's real GM controls GM-tier actions on it (assignment, unassignment, and the
GM-only edit fields) -- even for the thing's own owner/creator. Outside a Campaign, the owner/creator
has full control, since there's no GM to defer to.** This directly reverses part of the "owner can
always assign to their own trainer" fix from earlier this session for the in-Campaign case
specifically, and was applied consistently across every GM-tier check in the app, not just the two
examples the user gave:

- **`lib/pta3/pokemonAuthority.ts`** (new) -- `resolveWildPokemonAuthority` is the one-line rule for
  an unassigned pool Pokémon: GM-tier authority is the real GM of `campaign_id` if it's tagged to one,
  else its creator. Previously every call site trusted `created_by_user_id` alone as a stand-in for
  "is the GM" (correct today only because a pool Pokémon can only ever get a `campaign_id` from its
  own creator being that campaign's GM in the first place) -- this makes the actual rule explicit
  instead of leaning on that as an unstated invariant. Applied to `loadPokemonEvContext`
  (assignPokemonEv/setPokemonEvs), `updatePokemonDetails`, `addPokemonExp`
  (`app/pokemon/actions.ts`), and the Pokémon detail page's read-side isOwner/isGM.
- **`assignPokemon`** (`app/pokemon/actions.ts`) -- narrowed from "owner OR campaign GM" to
  `trainer.campaign_id ? isGM : isOwner`: a campaign-less trainer's owner can still assign freely, but
  a trainer inside a Campaign can only receive an assignment from that Campaign's actual GM, even from
  the trainer's own owner. RLS (broader: owner unconditionally) is left as the outer safety net, not
  the source of truth -- same layering `updatePokemonDetails`/`addPokemonExp` already used.
- **`unassignPokemon`** (`app/pokemon/actions.ts`) -- gained the identical explicit check (previously
  relied entirely on RLS, which is broader than this rule allows).
- **`/pokemon` page's `assignableTrainers` query** -- the "My Trainers" half now filters
  `.is('campaign_id', null)`, since a campaign trainer is only ever offered via the "GM'd campaigns"
  half now (previously it listed every trainer you owned regardless of campaign, which would have
  offered an assignment the server was about to reject).
- **`updateTrainerInfo`** (`app/trainers/actions.ts`) -- Class/Level/Background are GM-tier fields:
  `canEditGmTier = trainer.campaign_id ? isGM : isOwner`, resolved server-side and falling back to the
  trainer's current values (not `input`'s) when the caller doesn't qualify, so a crafted request can't
  bypass the UI gate. Trainer Name stays owner-only unconditionally, unaffected by this -- it was never
  a GM-tier field, just an owner-exclusive one, orthogonal to this rule.
- **`TrainerInfoSection`** (`app/trainers/[id]/TrainerInteractive.tsx`) -- mirrors the same
  `canEditGmTier` check to decide what Edit mode renders: a campaign-less trainer's owner (or any
  Campaign's GM) gets the normal Class/Level/Background selects; a Campaign trainer's owner who isn't
  its GM instead sees those three read-only, with a note naming which Campaign's GM can change them.
  Name stays an editable input regardless, matching the server-side gate.

**Real consequence worth flagging**: since Level lives among the now-gated fields, a player can no
longer level up their own Trainer once it's joined a Campaign -- only that Campaign's GM can, via
either the Info form or the level-up milestone flow. Outside a Campaign, nothing changes.

Verified end-to-end with a second test account (`pta3test2@mailinator.com`, temporarily given a known
password via `crypt()` for this test) playing the "owner, not GM" role against a trainer temporarily
moved into a campaign GM'd by a different account: the Info form's Edit mode correctly showed
Class/Level/Background as read-only with the "Only \<Campaign\>'s GM can change these" note (Name
stayed editable); the `/pokemon` list's assignment dropdown no longer offered that trainer at all;
and clicking "Unassign" on a Pokémon already assigned to it returned "Only that campaign's GM can
unassign this Pokemon" instead of succeeding. Test fixtures (the temporary campaign membership, the
throwaway pool Pokémon, and the trainer's campaign assignment) were all reverted afterward.

### Pokédex expansion, imported from PokeAPI (batched by primary type)

The "Fill out the Pokedex more" FR's Design pass established that most per-species data (base stats,
types, catch rate, egg hatch rate, growth rate, sprite code, and -- reusing the original learnset
import's own methodology -- level-up learnset and Passive eligibility) is reliably derivable from
PokeAPI, the same source as the original 351-species import. Move Proficiencies, Size/Weight tiers,
Habitats, and Diets have no PokeAPI equivalent and stay PDF/manual-only (unchanged from Design).

Batches are split by primary type, matching how the sourcebook PDF itself sorts species -- per the
user, Fire and Ice were already fully hand-entered in the original 351, so batching started with
**Ground** instead. Shared mechanics across every batch, not repeated per-batch below: `round(real_stat
/ 10)` (ties round up) for all 6 base stats, `base_hp` the same formula ×6; `catch_rate` = direct copy
of `capture_rate`; `egg_hatch_rate` = `floor(hatch_counter / 2) + " days"`; `growth_rate_id` name-mapped
from PokeAPI's slug; `sprite_code` = PokeAPI's own species slug; `size_id`/`weight_id`/`description`
left null and Proficiencies/Habitats/Diets get no rows (no reliable PokeAPI derivation, confirmed
during Design -- see that section's writeup); two-phase migration each time (`pokedex` rows first, then
the new real serial ids fetched back to generate the `pokedex_moves`/`pokedex_passives` migrations).

**Batch 1: Ground.**
- **Coverage**: 28 of 41 species with any Ground-type membership matched as *primary*-type Ground
  (the other 13 -- Nidoqueen/Nidoking/Clodsire, Larvitar/Pupitar, Nincada, Gastrodon, Gible/Gabite/
  Garchomp, Diggersby, Sandygast/Palossand -- have Ground as their secondary type and are left for
  their own primary-type batch instead of being force-fit here). Hyphenated PokeAPI slugs (regional
  forms etc.) were excluded from candidates entirely, same as the original import's precedent of not
  guessing at form-slug mappings.
- **Migration files**: `20260805130000` (species), `20260805130100`/`20260805130200`
  (moves/passives) -- 420 learnset rows + 63 Passive rows.
- **Verification**: spot-checked Diglett's full imported record (stats, types, learnset, passives)
  against its known real data -- exact match. Confirmed safe against existing app code: every read of
  `pokedex.size`/`.weight` already uses optional chaining with a `?? '—'` fallback (e.g.
  `species.size?.name`), so the null `size_id`/`weight_id` render correctly rather than crashing. No
  interactive browser click-through -- no test account credentials available in this environment. `npx
  tsc --noEmit` unaffected (pure data migration, no app code touched).
- **15 unmatched move slugs** aren't in the 632-move table yet (same known-gap category as the original
  import's 52): Magnitude, Mud slap, False swipe, Fling, Natural gift, Last resort, Feint, Precipice
  blades, Torment, Embargo, Foul play, Power trip, Guard split, Power split, Baby doll eyes.
- **No growth-rate gap hit** -- none of the 28 species report PokeAPI's `fast-then-very-slow`
  (Fluctuating), the one growth-rate tier this game's `growth_rates` table doesn't have a row for yet.

**Batch 2: Electric.**
- **Coverage**: 36 of 39 Electric-type-membership candidates matched as primary-type Electric --
  Joltik/Galvantula (Bug) and Zekrom (Dragon) excluded as secondary-type-only.
- **Migration files**: `20260805140000` (species), `20260805140100`/`20260805140200`
  (moves/passives) -- 446 learnset rows + 63 Passive rows.
- **Verification**: spot-checked Zapdos's full imported record (dual-type, legendary catch
  rate/hatch cycle) against known real data -- exact match. Same code-safety and typecheck result as
  batch 1.
- **20 unmatched move slugs**: Pluck, Magnetic flux, Baton pass, Skill swap, Copycat, Last resort,
  Entrainment, Bestow, Trump card, Volt switch, Baby doll eyes, Acid, Mud slap, Quick guard, Power up
  punch, Plasma fists, Freeze dry, Lock on, Thunder cage, Electro drift.
- **No growth-rate gap hit** this batch either.

**Bug found while generating batches 3+**: the growth-rate slug map used the wrong PokeAPI value for
Erratic (`"erratic"` instead of the real slug `"slow-then-very-fast"`), which would have silently
treated every real-Erratic species as an unmapped gap. Caught before any further migrations were
generated (Ground and Electric happened not to include any Erratic-growth species, so neither needed
retroactive fixing) -- fixed in the generator script and confirmed correct against
`GET /api/v2/growth-rate`, which lists all 6 real slugs directly.

**Real growth-rate gap confirmed**: once corrected, 14 species across batches 3+ (Fighting, Poison,
Bug, Ghost, Water, Grass) still hit PokeAPI's `fast-then-very-slow`, confirming Fluctuating is a
genuinely missing 6th tier (not a mapping bug) -- added via `20260805150000`. Its `exp_modifier` (0.6)
is an *estimate*, not sourced from the PDF -- the other 5 rows' modifiers don't reduce to one exact
formula against real Pokémon's total-exp-to-level-100 figures, so there's no formula to extend
precisely; 0.6 is calibrated loosely against the same rough ratio pattern the other 5 follow (see the
migration's own comment for the full reasoning). Flagged for the user to confirm against the real
sourcebook value later, not blocking.

**Batches 3-16: every remaining primary type.** Same methodology and per-field sourcing as batches 1-2
throughout; per-type detail (excluded secondary-type species, unmatched move slugs) lives in each
batch's own migration file header rather than repeated here. Fire and Ice were skipped (already
hand-entered by the user in the original 351).

| Type | Species | Learnset rows | Passive rows | Species migration | Moves/Passives migrations |
|---|---|---|---|---|---|
| Normal | 98 | 1367 | 280 | `20260805160000` | `20260805170000`/`170100` |
| Fighting | 34 | 515 | 92 | `20260805160100` | `20260805170200`/`170300` |
| Flying | 5 | 66 | 10 | `20260805160200` | `20260805170400`/`170500` |
| Poison | 35 | 521 | 65 | `20260805160300` | `20260805170600`/`170700` |
| Rock | 37 | 536 | 101 | `20260805160400` | `20260805170800`/`170900` |
| Bug | 62 | 823 | 140 | `20260805160500` | `20260805171000`/`171100` |
| Ghost | 22 | 304 | 37 | `20260805160600` | `20260805171200`/`171300` |
| Steel | 28 | 317 | 82 | `20260805160700` | `20260805171400`/`171500` |
| Water | 61 | 876 | 116 | `20260805160800` | `20260805171600`/`171700` |
| Grass | 60 | 890 | 95 | `20260805160900` | `20260805171800`/`171900` |
| Psychic | 44 | 534 | 67 | `20260805161000` | `20260805172000`/`172100` |
| Dragon | 30 | 417 | 61 | `20260805161100` | `20260805172200`/`172300` |
| Dark | 30 | 426 | 89 | `20260805161200` | `20260805172400`/`172500` |
| Fairy | 25 | 374 | 60 | `20260805161300` | `20260805172600`/`172700` |

**Totals across batches 3-16**: 571 species, 7966 learnset rows, 1295 Passive rows. Flying's tiny
count (5) is real, not an error -- most Flying-type-membership Pokémon have Flying as their
*secondary* type (67 of 72 candidates), which matches how few pure-Flying-primary species exist in
the real Pokédex too.

**Combined with batches 1-2**: `pokedex` grew from 351 to **986** species in this session (28 Ground +
36 Electric + 571 across the other 14 types = 635 new species). The remaining ~39-species gap against
PokeAPI's full 1025 is the same known-gap category documented throughout (hyphenated regional-form
slugs deliberately excluded from candidates, plus a handful of edge cases like the original import's
34-species gap).

**Verification for batches 3-16**: spot-checked Gengar's full imported record (dual-type Ghost/Poison,
Medium Slow growth) against known real data after all 28 phase-B migrations landed -- exact match on
stats, types, growth rate, learnset, and Passives. Same code-safety reasoning and unaffected `npx tsc
--noEmit` result as batches 1-2; no interactive browser click-through this session (no test account
credentials available in this environment).

**Migration-ordering pitfall hit and fixed**: the first attempt at copying the moves/passives
migrations used timestamps only 100 apart from each type's own species-migration timestamp (e.g.
Normal's moves file landed at the same minute as Fighting's species file), which `supabase db push`
correctly refused to apply out of order. Fixed by moving all moves/passives files into their own later
timestamp block (`20260805170000` onward) instead of interleaving them with the species files'
timestamps -- no migrations were partially applied, the push simply failed atomically and was retried
after the rename.

### Size/Weight/Habitat/Diet/Proficiencies for the expansion species, extracted from the Pokedex PDF

The Design pass confirmed these four fields have no PokeAPI equivalent -- they're genuinely
sourcebook-only. Turned out the actual `PTA3Pokedex.pdf` (814 pages, sorted by primary type -- same
axis the species batches above used) prints exactly these fields per species, in a fairly consistent
per-family block: `Type - Size (Size), Weight (Weight)`, then later `Biology: ... Diet - X, Habitat -
Y1 / Y2`, then `Proficiencies: A / B / C (StageException)`. Cross-checked immediately against Bulbasaur
and the (pre-existing, not part of this session's import) Rhyhorn/Rhydon/Rhyperior line -- the PDF's
values matched this game's already-stored data exactly on every field, confirming it as the real
source and that automated extraction was worth building rather than hand-transcribing ~540 species.

**Extraction approach**: `pdftotext -layout` on the full PDF, then a parser that:
- Splits each physical line on 2+-space runs before anything else. The PDF's two-column layout
  regularly merges an unrelated left-column flavor-text line and a right-column species-name/stat line
  onto the same physical text row (e.g. a species' own name landing mid-paragraph of the previous
  entry's biology text) -- without this, exact-line name matching missed roughly 40% of species
  outright.
- For each `Size (Size), Weight (Weight)` line found, searches backward (up to 60 logical lines) for
  every nearby candidate that's an exact match (accent/apostrophe/spacing-normalized) against a known
  `pokedex` species name, then **cross-validates each candidate against this game's own base stats**
  (already known independently from the PokeAPI import earlier in this FR) -- the PDF also prints Hit
  Points/Defense/Special Defense/Speed/Attack/Special Attack right after the Size/Weight line, so a
  candidate is only accepted if those 6 numbers match what's already stored for that species. This
  caught real misattributions (nearest-name-only would have wrongly credited stat blocks to whichever
  species happened to be textually closest) and is what makes this data trustworthy rather than a
  best-effort guess.
- Diet/Habitat/Proficiencies are parsed per-family (a family = every species stat-block found since the
  previous `Biology:` block closed) and, like the name-matching above, **every extracted token is
  validated against the real reference tables** (`diets`, `habitats`, `proficiencies`) before being
  trusted -- a token that doesn't match a known value is dropped rather than written, since the same
  column-interleaving that broke name-matching can also run a field's join window past its real end
  into unrelated text. Proficiency exceptions (`ProficiencyName (SpeciesName)`, meaning that
  proficiency applies only to the named evolution stage, not the whole family -- e.g. Rhyperior alone
  gets Munition within the Rhyhorn line) are parsed and applied per-stage, not family-wide.

**Coverage** (this session's 635 new species only -- the original 351 already have this data from the
prior sheet import and were deliberately left untouched):
- **543 of 635 (85.5%) matched** a PDF stat-block at all. The ~92 that didn't are overwhelmingly
  Legendaries, Mythicals, Ultra Beasts, and the newest Paradox-type species (Arceus, Mewtwo, Mew, the
  weather trio, the creation trio, Ultra Beasts, box legendaries, etc.) -- this PDF appears to
  deliberately exclude them from normal per-species stat-blocks, a real gap in the source material
  itself, not a parser miss. A handful of ordinary species (e.g. Heracross, Scyther, Miltank) were also
  missed where the two-column layout defeated safe extraction.
- Of those 543: **Size/Weight populated for all 543 (100%)** -- the field that most needed a real
  source rather than a formula. **Diet: 393 (72%)**. **Habitats: species with at least one habitat
  row, covering 632 total rows**. **Proficiencies: species with at least one row, covering 1255 total
  rows**. The gaps within these three are all "validation rejected an unsafe extraction," never wrong
  data written -- left null/absent rather than guessed, matching this FR's practice throughout.
- Applied via 4 migrations: `20260805180000` (Size/Weight, 543 `update` statements), `20260805180100`
  (Diets, 393 rows), `20260805180200` (Habitats, 632 rows), `20260805180300` (Proficiencies, 1255
  rows).

**Verification**: spot-checked Sandile/Krokorok/Krookodile (confirmed the family-wide Dark/Ground/
Fangs proficiencies plus Krookodile's own Stampeding exception applied correctly and only to
Krookodile) and Diglett against the live database post-migration -- exact match on every field. `npx
tsc --noEmit` unaffected (pure data migrations). No interactive browser click-through this session --
no test account credentials available in this environment.

**Remaining scope**: the ~92 unmatched species (mostly Legendaries/Mythicals/UBs) and the partial Diet/
Habitat/Proficiencies gaps within the matched 543 are a real, documented residual -- filling them
further would need either improving the parser's handling of the PDF's most complex layout cases, or
falling back to manual entry for the specific species/fields that didn't resolve. Not attempted this
session; flagged as follow-up work rather than guessed at.

### Skill Talents: Class/Advanced Class/Origin picks grant +2 (Talented) / +5 (Expert) on a Skill

Implements the Skill Talented/Expert system: at creation, a Trainer picks 2 Skill Talents from their
Class's fixed list and however many their Origin's option groups require; at every Advanced Class
grant (level-up), they pick 1 more from that Advanced Class's own 2-skill list. The first pick on a
given Skill grants Talented (+2); a *second* pick on the same Skill -- from any other source -- upgrades
it to Expert (+5), capped at 2 picks total per Skill across the Trainer's whole career.

**Data source**: transcribed directly from `PTA3PlayersHandbook.pdf` (242 pages) -- 5 Classes' flat
6-skill (pick 2) lists, 25 Advanced Classes' flat 2-skill (pick 1) lists (Stat Ace's 5 stat-variant rows
in `subclasses` all share the same list, since the eligible Skills don't vary by which stat was picked),
and 15 Origins' option lists. Small enough (30 + 58 + ~112 rows) to hand-transcribe rather than build a
PDF parser for, unlike the Pokedex biology data above -- verified afterward with spot-checks against the
live DB (Ace trainer, Type ace, Entertainer, and the Sandile/Krokorok/Krookodile family) rather than
re-deriving it a second way.

**Origins don't all fit "choose N from one list"**: Entertainer and Doctor each have a mandatory Skill
plus a separate "choose 1 more" from a different list; Athlete has two independent 1-of-N picks from two
different lists; Raring to go is "choose any 1 of all 18"; Trust funded grants none. Modeled as
**pick-groups** instead of special-casing: `origins_skill_talent_groups` (one row per group, each with
its own `pick_count`) plus `origins_skill_talent_group_options` (that group's eligible Skills) --
a mandatory Skill is just a group of size 1, an ordinary Origin is one group, Athlete is two groups,
Trust funded has zero. `classes_skill_talents` and `subclasses_skill_talents` stay flat (Class/Advanced
Class picks are always "pick N from one list"), and `trainer_skill_talents` stores only the aggregate
`(trainer_id, skill_id) -> picked_count`, never which source granted which pick -- Talented/Expert is
purely a function of the count (`talentBonus()` in `lib/pta3/skillTalents.ts`), so there's nothing else
to reconstruct.

**Validation happens server-side, not just in the picker UI**: `validateCreationSkillTalentPicks`
re-derives the real eligible lists from the DB and checks the submitted Class picks (exactly 2, both
eligible) and every one of the Origin's groups (`pick_count` satisfied, nothing outside that group's own
list) before `applySkillTalentPicks` folds them into `trainer_skill_talents` -- a client-side cap can
always be bypassed, so the picker's own disabled-checkbox logic is a UX nicety, not the actual gate. The
same `applySkillTalentPicks` is reused for a single level-up pick (`resolveMilestone`'s `talentSkillId`
field), folding one more Skill into the existing counts.

**Editing an already-resolved milestone never touches Skill Talents** -- same reasoning as HP staying
fixed on edit (see `editMilestone`): `trainer_skill_talents` only tracks a per-Skill aggregate, not which
milestone granted which pick, so there's no clean way to reverse one specific earlier grant if the
Advanced Class choice changes on edit. The edit-variant `AdvancedClassPicker` calls simply pass empty
option/held maps so that field doesn't render there at all.

**UI**: `TrainerForm` gained a "Class Skill Talents (choose 2)" checkbox group and one checkbox-group
fieldset per Origin pick-group, both gating the submit button until satisfied; `AdvancedClassPicker`
gained a conditional "Skill Talent (choose 1)" `<select>` that only lists Skills still under the 2-pick
cap for that Trainer, labeling any Skill already at 1 pick as "(upgrades to Expert)". `SkillsSection` on
the Trainer sheet now folds each Skill's derived Talented/Expert bonus directly into the displayed
modifier and tags it `(Talented)` / `(Expert)`.

**Verification**: `npx tsc --noEmit` unchanged at the existing 335-error baseline throughout. Full
browser click-through using the project's throwaway test account -- created a Trainer as Ace trainer +
Doctor, picking Diplomacy from both the Class list and Doctor's "choose 1 more" group (plus History from
Class and the mandatory Medicine from Doctor): the Trainer sheet correctly showed **Diplomacy: +6
(Expert)**, **History: +3 (Talented)**, and **Medicine: +3 (Talented)**, confirming the pick-groups
model, the cross-source Expert upgrade, and the derived-bonus display all work end-to-end.
