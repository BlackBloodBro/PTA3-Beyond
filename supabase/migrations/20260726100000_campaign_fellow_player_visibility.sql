-- Lets campaign members see each other's trainers/Pokemon (a real party roster, not just "my
-- own trainer"), while excluding the GM's own trainer(s) -- an NPC ally or GM PC the GM doesn't
-- necessarily want visible to players. This is a genuine access restriction (not just a UI
-- filter): a player cannot view a GM's trainer sheet even by navigating to it directly.

-- Helper: is auth.uid() a joined member of this campaign? (The GM is not a campaign_members row
-- -- they're identified via campaigns.gm_user_id -- so this specifically means "a player".)
create or replace function is_campaign_member(target_campaign_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from campaign_members cm
    where cm.campaign_id = target_campaign_id and cm.user_id = auth.uid()
  );
$$;

-- Helper: is this trainer owned by the GM of its own campaign?
create or replace function is_trainer_owned_by_campaign_gm(target_trainer_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from trainers t
    join campaigns c on c.id = t.campaign_id
    where t.id = target_trainer_id and t.user_id = c.gm_user_id
  );
$$;

create policy "Campaign members can view fellow players' trainers" on trainers
  for select using (
    campaign_id is not null
    and is_campaign_member(campaign_id)
    and not is_trainer_owned_by_campaign_gm(id)
  );

-- Mirrors the same visibility for Pokemon, so a party roster can actually show teammates' teams.
create policy "Campaign members can view fellow players' pokemon" on pokemon
  for select using (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon.id
        and t.campaign_id is not null
        and is_campaign_member(t.campaign_id)
        and not is_trainer_owned_by_campaign_gm(t.id)
    )
  );
