-- Bug fix: `evolution_chains` and `evolution_triggers` ([[Add Evolution functionality]],
-- 20260814100000_evolution_schema.sql) were created with RLS enabled (Supabase enables it by default
-- on every new table) but never got a "Public read access" policy -- same recurring class of bug
-- already caught once for type_matchups/type_immunities (see
-- 20260903130000_restore_type_effectiveness_data.sql's own comment: "these two never did"). With RLS
-- on and zero policies, Postgres denies ALL access to every role, silently (PostgREST returns an empty
-- array, not an error) -- confirmed via `supabase db query --linked` against pg_policies that neither
-- table had any policy at all, unlike every other reference table (pokedex, egg_groups, etc.), which
-- all get this exact policy in their own creating migration.
--
-- Real-world impact while this was broken: every evolution feature was silently non-functional for
-- every user -- no evolution targets ever loaded (Pokemon page's "ready to evolve" button never
-- appeared, regardless of level/loyalty), the GM-override chain picker was always empty, and
-- [[Feature - Add a Pokemon Breeding Check mechanic]]'s new base-species resolution (this session,
-- 2026-09-04) would have silently picked whatever row Postgres happened to return first rather than
-- the real base form, since it also reads evolution_triggers.
create policy "Public read access" on evolution_chains for select using (true);
create policy "Public read access" on evolution_triggers for select using (true);
