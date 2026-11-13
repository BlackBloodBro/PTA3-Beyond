-- [[Feature - Shared currency and inventory]]: a Campaign-level shared fund and item pool. A Trainer can freely move
-- currency and items between their own balance / inventory and the Campaign's pool (no GM approval); every Campaign
-- member can see it, and a *different* Trainer can later withdraw what someone deposited.
--
-- Money lives on `campaigns.money`, the same shape as `trainers.money`. Items live in `campaign_items`, which mirrors
-- `trainers_items` column for column (including the TM/TR/Egg variants and TR use charges), so "the same stack" means
-- exactly the same thing on both sides.
--
-- Nobody writes these tables directly. Every transfer goes through one of the SECURITY DEFINER functions below, which
-- re-check who may act and do both halves of the move in a single atomic call. That is also the concurrency fix the
-- note asked for: the money moves use conditional updates (`... where money >= amount`) and the item moves lock the
-- source row, so two players pulling from the same pot at once can't overdraw it or duplicate an item.
alter table campaigns add column money int not null default 0 check (money >= 0);

create table campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  item_id int not null references items(id),
  move_id int references moves(id),
  pokedex_id int references pokedex(id),
  nature_id int references natures(id),
  quantity int not null check (quantity > 0),
  uses_remaining int,
  created_at timestamptz not null default now()
);

create index on campaign_items (campaign_id);
create index on campaign_items (item_id);

alter table campaign_items enable row level security;

-- Readable by every Campaign member (GM included): a Trainer can't sensibly decide what to withdraw from a pool they
-- can't see. No write policy at all -- see the functions below.
create policy "Campaign members view the shared inventory" on campaign_items
  for select using (is_campaign_gm(campaign_id) or is_campaign_member(campaign_id));

-- The Campaign a Trainer belongs to, once the caller is allowed to act for that Trainer (its owner, or the Campaign's
-- GM -- the same authorisation the Inventory already uses). A Trainer outside any Campaign has no shared pool.
create or replace function shared_trainer_campaign(p_trainer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid;
  v_owner uuid;
begin
  select campaign_id, user_id into v_campaign, v_owner from trainers where id = p_trainer_id;
  if not found then
    raise exception 'Trainer not found';
  end if;
  if v_campaign is null then
    raise exception 'This Trainer is not in a Campaign, so it has no shared inventory';
  end if;
  if v_owner is distinct from auth.uid() and not is_campaign_gm(v_campaign) then
    raise exception 'Not authorized to manage this Trainer';
  end if;
  return v_campaign;
end;
$$;

create or replace function deposit_shared_money(p_trainer_id uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid := shared_trainer_campaign(p_trainer_id);
begin
  if p_amount is null or p_amount < 1 then
    raise exception 'Enter a whole amount of at least 1';
  end if;

  update trainers set money = money - p_amount where id = p_trainer_id and money >= p_amount;
  if not found then
    raise exception 'Not enough money';
  end if;

  update campaigns set money = money + p_amount where id = v_campaign;
end;
$$;

create or replace function withdraw_shared_money(p_trainer_id uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid := shared_trainer_campaign(p_trainer_id);
begin
  if p_amount is null or p_amount < 1 then
    raise exception 'Enter a whole amount of at least 1';
  end if;

  update campaigns set money = money - p_amount where id = v_campaign and money >= p_amount;
  if not found then
    raise exception 'The shared fund does not have that much';
  end if;

  update trainers set money = money + p_amount where id = p_trainer_id;
end;
$$;

-- Move some of a Trainer's inventory row into the Campaign's pool. Stacks onto an existing pool row with the same
-- item + variant (move / species / nature) when the item is stackable; a non-stackable item the pool already holds is
-- refused rather than silently swallowed.
create or replace function deposit_shared_item(p_trainer_id uuid, p_trainers_item_id uuid, p_quantity int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid := shared_trainer_campaign(p_trainer_id);
  v_row trainers_items%rowtype;
  v_stackable boolean;
  v_existing uuid;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Enter a whole quantity of at least 1';
  end if;

  select * into v_row from trainers_items where id = p_trainers_item_id and trainer_id = p_trainer_id for update;
  if not found then
    raise exception 'Item not found in this Inventory';
  end if;
  if p_quantity > v_row.quantity then
    raise exception 'Not enough of that item';
  end if;

  select stackable into v_stackable from items where id = v_row.item_id;

  select id into v_existing
  from campaign_items
  where campaign_id = v_campaign
    and item_id = v_row.item_id
    and move_id is not distinct from v_row.move_id
    and pokedex_id is not distinct from v_row.pokedex_id
    and nature_id is not distinct from v_row.nature_id
  limit 1
  for update;

  if v_existing is not null then
    if not v_stackable then
      raise exception 'The shared inventory already holds one of those';
    end if;
    update campaign_items set quantity = quantity + p_quantity where id = v_existing;
  else
    insert into campaign_items (campaign_id, item_id, move_id, pokedex_id, nature_id, quantity, uses_remaining)
    values (v_campaign, v_row.item_id, v_row.move_id, v_row.pokedex_id, v_row.nature_id,
            case when v_stackable then p_quantity else 1 end, v_row.uses_remaining);
  end if;

  if v_row.quantity - p_quantity > 0 then
    update trainers_items set quantity = quantity - p_quantity where id = v_row.id;
  else
    delete from trainers_items where id = v_row.id;
  end if;
end;
$$;

-- Move some of a pool row into a Trainer's inventory. The caller must be authorised for the *receiving* Trainer, not
-- for whoever deposited the item -- once it is in the pool, anyone in the Campaign who controls a Trainer can take it.
create or replace function withdraw_shared_item(p_trainer_id uuid, p_campaign_item_id uuid, p_quantity int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid := shared_trainer_campaign(p_trainer_id);
  v_row campaign_items%rowtype;
  v_stackable boolean;
  v_existing uuid;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Enter a whole quantity of at least 1';
  end if;

  select * into v_row from campaign_items where id = p_campaign_item_id and campaign_id = v_campaign for update;
  if not found then
    raise exception 'That item is no longer in the shared inventory';
  end if;
  if p_quantity > v_row.quantity then
    raise exception 'The shared inventory does not have that many';
  end if;

  select stackable into v_stackable from items where id = v_row.item_id;

  select id into v_existing
  from trainers_items
  where trainer_id = p_trainer_id
    and item_id = v_row.item_id
    and move_id is not distinct from v_row.move_id
    and pokedex_id is not distinct from v_row.pokedex_id
    and nature_id is not distinct from v_row.nature_id
  limit 1
  for update;

  if v_existing is not null then
    if not v_stackable then
      raise exception 'This Trainer already has one of those';
    end if;
    update trainers_items set quantity = quantity + p_quantity where id = v_existing;
  else
    insert into trainers_items (trainer_id, item_id, move_id, pokedex_id, nature_id, quantity, uses_remaining)
    values (p_trainer_id, v_row.item_id, v_row.move_id, v_row.pokedex_id, v_row.nature_id,
            case when v_stackable then p_quantity else 1 end, v_row.uses_remaining);
  end if;

  if v_row.quantity - p_quantity > 0 then
    update campaign_items set quantity = quantity - p_quantity where id = v_row.id;
  else
    delete from campaign_items where id = v_row.id;
  end if;
end;
$$;

grant execute on function deposit_shared_money(uuid, int) to authenticated;
grant execute on function withdraw_shared_money(uuid, int) to authenticated;
grant execute on function deposit_shared_item(uuid, uuid, int) to authenticated;
grant execute on function withdraw_shared_item(uuid, uuid, int) to authenticated;
