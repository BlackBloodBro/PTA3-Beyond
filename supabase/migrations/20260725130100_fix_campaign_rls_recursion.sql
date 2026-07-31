-- campaigns' "Members can view their campaigns" policy queries campaign_members, and
-- campaign_members' policies queried campaigns directly -- Postgres detects this as circular RLS
-- policy evaluation ("infinite recursion detected in policy"). Standard fix: move the
-- campaigns-side check into a SECURITY DEFINER function. Because the function runs with its
-- owner's privileges (which bypass RLS), its internal query against campaigns doesn't re-trigger
-- campaigns' policies, breaking the cycle.
create or replace function is_campaign_gm(target_campaign_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from campaigns c where c.id = target_campaign_id and c.gm_user_id = auth.uid()
  );
$$;

drop policy "Members and GM can view a campaign's roster" on campaign_members;
create policy "Members and GM can view a campaign's roster" on campaign_members
  for select using (
    user_id = auth.uid() or is_campaign_gm(campaign_members.campaign_id)
  );

drop policy "GM can remove members" on campaign_members;
create policy "GM can remove members" on campaign_members
  for delete using (is_campaign_gm(campaign_members.campaign_id));
