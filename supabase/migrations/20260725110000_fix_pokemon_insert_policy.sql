-- The original "Authenticated users can create pokemon" policy checked auth.role() = 'authenticated'
-- inside the policy body, which failed in practice (new pokemon rows were rejected for a genuinely
-- logged-in user). Switching to Postgres-native role scoping (`to authenticated`) is the more robust,
-- Supabase-recommended pattern -- it relies on the role PostgREST actually sets for the connection
-- rather than re-deriving it from a JWT claim inside the policy.
drop policy "Authenticated users can create pokemon" on pokemon;

create policy "Authenticated users can create pokemon" on pokemon
  for insert
  to authenticated
  with check (true);
