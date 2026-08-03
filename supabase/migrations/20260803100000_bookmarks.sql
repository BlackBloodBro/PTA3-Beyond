-- Personal, per-user bookmarks for quick sidebar access to a Trainer/Pokemon/Campaign. A single
-- generic table (entity_type + entity_id) rather than three separate tables -- there's no per-type
-- data beyond "which row, for which user", and a generic shape lets the Sidebar query one table
-- instead of unioning three. entity_id has no FK (it points at a different table depending on
-- entity_type -- a standard polymorphic-reference tradeoff), but every entity's own RLS still gates
-- what the bookmark is actually allowed to resolve to when the Sidebar looks it up.
create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('trainer', 'pokemon', 'campaign')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

alter table bookmarks enable row level security;

-- Personal to the logged-in user -- not Campaign-shared, matches the existing convention for
-- per-user preference data (theme settings). No GM policy: unlike trainer_feature_uses etc., a
-- bookmark is pure UI state with no in-fiction meaning for anyone else to manage.
create policy "Owner manages own bookmarks" on bookmarks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
