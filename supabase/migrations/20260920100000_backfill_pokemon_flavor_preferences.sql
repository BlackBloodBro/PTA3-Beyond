-- [[Bug - Starter Pokemon has no Likes or Dislikes]]: backfills every Pokemon currently sitting with
-- zero pokemon_flavor_preferences rows (a mix of Pokemon predating the 2026-08-12 flavor-preferences
-- feature and ones actually hit by the starter-creation RLS-ordering bug this same FR fixes in code).
-- Replicates lib/pta3/flavors.ts's pickFlavorPreferences() algorithm exactly, in SQL rather than by
-- calling the TS function directly -- this codebase has no Node-script/service-role-key precedent for
-- one-off data work, only plain SQL migrations. Per flavor, independently: 20% liked, 20% disliked, 60%
-- neutral (no row). If that leaves a Pokemon with zero liked flavors, force one flavor -- picked
-- uniformly at random across all 5, same as the TS function -- to liked, overriding a disliked roll on
-- that same flavor if it had one. Only touches Pokemon with zero existing rows; any Pokemon with real
-- (even disliked-only) preference data is left untouched.
do $$
declare
  poke record;
  flavor_id_var int;
  flavor_ids int[];
  roll double precision;
  liked_count int;
  forced_flavor_id int;
begin
  select array_agg(id order by id) into flavor_ids from flavors;

  for poke in
    select p.id from pokemon p
    where not exists (select 1 from pokemon_flavor_preferences pfp where pfp.pokemon_id = p.id)
  loop
    liked_count := 0;

    foreach flavor_id_var in array flavor_ids loop
      roll := random();
      if roll < 0.2 then
        insert into pokemon_flavor_preferences (pokemon_id, flavor_id, liked) values (poke.id, flavor_id_var, true);
        liked_count := liked_count + 1;
      elsif roll < 0.4 then
        insert into pokemon_flavor_preferences (pokemon_id, flavor_id, liked) values (poke.id, flavor_id_var, false);
      end if;
    end loop;

    if liked_count = 0 then
      forced_flavor_id := flavor_ids[1 + floor(random() * array_length(flavor_ids, 1))::int];
      delete from pokemon_flavor_preferences where pokemon_id = poke.id and flavor_id = forced_flavor_id;
      insert into pokemon_flavor_preferences (pokemon_id, flavor_id, liked) values (poke.id, forced_flavor_id, true);
    end if;
  end loop;
end $$;
