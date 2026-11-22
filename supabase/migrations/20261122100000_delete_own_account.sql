-- [[Feature - Add account deletion]]: lets a signed-in user delete their own account, all in one transaction.
--
-- Order (any failure rolls back everything, so there's never a half-deleted account):
-- 1. Refuse while any Campaign this user GMs still has another user's player Trainer in it -- the same rule
--    deleteCampaign enforces (campaigns.gm_user_id cascades, which would otherwise silently delete those
--    Campaigns and unlink the other players' Trainers).
-- 2. Pokemon: delete the ones only this user has (linked only to this user's own Trainers/NPCs, or unassigned
--    pool Pokemon they created that aren't in another GM's Campaign). Pokemon they created that someone else
--    now has -- linked to another user's Trainer, or unassigned in another GM's Campaign pool -- are kept and
--    just lose their creator (pokemon.created_by_user_id has no delete rule and would block step 5 otherwise).
-- 3. Delete this user's Trainers (player and NPC); links, inventories etc. cascade.
-- 4. Delete the Campaigns this user GMs (now without other players); members, Encounters and custom content
--    cascade, and other users' pool Pokemon tagged to them fall back to their creator (campaign_id set null).
-- 5. Delete the auth.users row; public.users and bookmarks cascade from it.
--
-- SECURITY DEFINER because a user can't delete their own auth.users row (or other users' links to their
-- Pokemon) through RLS. It only ever acts on auth.uid().

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  blocking text;
  own_trainers uuid[];
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  -- 1. Campaigns that still have another user's player Trainer.
  select string_agg(distinct c.name, ', ' order by c.name)
    into blocking
    from campaigns c
    join trainers t on t.campaign_id = c.id
   where c.gm_user_id = uid
     and t.is_npc = false
     and t.user_id <> uid;

  if blocking is not null then
    raise exception 'Remove all other players'' Trainers from these campaigns (or delete the campaigns) first: %', blocking
      using errcode = 'P0001', hint = 'campaigns_have_players';
  end if;

  -- 2. Pokemon (before the Trainers, while the links still show who has what).
  own_trainers := array(select id from trainers where user_id = uid);

  delete from pokemon p
   where not exists (  -- nobody else has it
           select 1 from trainers_pokemon tp
            where tp.pokemon_id = p.id
              and not (tp.trainer_id = any (own_trainers))
         )
     and (
           exists (select 1 from trainers_pokemon tp
                    where tp.pokemon_id = p.id
                      and tp.trainer_id = any (own_trainers))
           or (
             p.created_by_user_id = uid
             and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = p.id)
             and not exists (select 1 from campaigns c where c.id = p.campaign_id and c.gm_user_id <> uid)
           )
         );

  update pokemon set created_by_user_id = null where created_by_user_id = uid;

  -- 3. Trainers.
  delete from trainers where user_id = uid;

  -- 4. Campaigns this user GMs.
  begin
    delete from campaigns where gm_user_id = uid;
  exception when foreign_key_violation then
    raise exception 'One of your campaigns has custom content (a Pokemon species, Item, Move, ...) that is still used outside that campaign, so it can''t be deleted yet'
      using errcode = 'P0001', hint = 'campaign_content_in_use';
  end;

  -- 5. The login itself; public.users (and bookmarks, campaign_members) cascade from it.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
