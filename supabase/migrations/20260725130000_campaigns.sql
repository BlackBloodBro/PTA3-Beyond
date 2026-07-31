-- Campaigns: GM-owned tables players join via an invite code. GM-ness is campaign-scoped (a user
-- can GM one campaign and play in another), so there's no global "is_gm" flag on users -- a
-- campaign's GM is simply whoever created it (campaigns.gm_user_id).
--
-- This migration is schema-only (step 1 of the plan): campaigns, membership, and linking a
-- trainer to a campaign. Expanding GM visibility into player trainers/pokemon/etc. via RLS is a
-- deliberate follow-up step, not included here.

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  gm_user_id uuid not null references public.users(id) on delete cascade,
  invite_code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger campaigns_set_updated_at
  before update on campaigns
  for each row execute procedure set_updated_at();

create index on campaigns (gm_user_id);

-- Players who've joined a campaign. The GM is not a row here -- they're identified directly via
-- campaigns.gm_user_id.
create table campaign_members (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index on campaign_members (user_id);

-- A trainer optionally belongs to one campaign. Nullable so trainers can exist standalone
-- (as all of them have so far) or be created for/moved into a campaign later. Deliberately
-- ON DELETE SET NULL rather than CASCADE: deleting a campaign shouldn't delete a player's trainer.
alter table trainers add column campaign_id uuid references campaigns(id) on delete set null;
create index on trainers (campaign_id);

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table campaigns enable row level security;

create policy "GM manages own campaigns" on campaigns
  for all using (gm_user_id = auth.uid()) with check (gm_user_id = auth.uid());

create policy "Members can view their campaigns" on campaigns
  for select using (
    exists (
      select 1 from campaign_members cm
      where cm.campaign_id = campaigns.id and cm.user_id = auth.uid()
    )
  );

alter table campaign_members enable row level security;

create policy "Members and GM can view a campaign's roster" on campaign_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from campaigns c
      where c.id = campaign_members.campaign_id and c.gm_user_id = auth.uid()
    )
  );

create policy "GM can remove members" on campaign_members
  for delete using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_members.campaign_id and c.gm_user_id = auth.uid()
    )
  );

create policy "Members can leave a campaign" on campaign_members
  for delete using (user_id = auth.uid());

-- No direct INSERT policy on campaign_members: joining only happens through join_campaign()
-- below, so a player never needs (and isn't granted) permission to see or browse campaigns
-- they haven't been given the invite code for.

-- =========================================================================
-- Joining a campaign by invite code
-- =========================================================================

-- SECURITY DEFINER so it can look up a campaign by code regardless of the caller's own SELECT
-- policy on campaigns (which is restricted to GM/existing members) -- the invite code itself is
-- the authorization, not campaign visibility.
create or replace function join_campaign(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign_id uuid;
begin
  select id into target_campaign_id from campaigns where invite_code = upper(code);

  if target_campaign_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into campaign_members (campaign_id, user_id)
  values (target_campaign_id, auth.uid())
  on conflict (campaign_id, user_id) do nothing;

  return target_campaign_id;
end;
$$;

grant execute on function join_campaign(text) to authenticated;
