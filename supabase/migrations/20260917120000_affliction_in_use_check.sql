-- [[Feature - GM Custom - Afflictions]]: fixes a real bug caught during live verification -- the
-- delete guard in `deleteCustomAffliction` queried `pokemon_afflictions` directly to check whether an
-- affliction is still in use, but that table's own RLS ("Owner manages pokemon_afflictions") only
-- lets a Pokemon's actual Trainer-owner see its rows. A GM checking whether *their own* custom
-- affliction is applied to a *player's* Pokemon gets zero rows back -- not because it isn't in use,
-- but because RLS hides the evidence from them. Needs a SECURITY DEFINER function to bypass that,
-- same reasoning as every other helper in this migration family.
create or replace function count_pokemon_using_affliction(target_affliction_id int)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*) from pokemon_afflictions where affliction_id = target_affliction_id;
$$;
