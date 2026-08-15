-- Cross-island logistics for SUDOX island schema v2.
-- Apply once in the Supabase SQL Editor after leaderboard.sql and pin-guard-migration.sql.

begin;

create table if not exists public.island_network_profiles (
  player_id uuid primary key references public.cloud_saves(player_id) on delete cascade,
  player_name text not null,
  player_avatar text not null default 'cat',
  inventory jsonb not null default '{}'::jsonb,
  inventory_updated_at timestamptz not null default now(),
  buildings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.island_recipe_catalog (
  recipe_id text primary key,
  building_id text not null,
  item_id text not null,
  input_per_batch integer not null check (input_per_batch > 0),
  outputs jsonb not null,
  processing_seconds integer not null check (processing_seconds > 0),
  reward_per_item integer not null check (reward_per_item > 0)
);

create table if not exists public.island_shipments (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  sender_id uuid not null references public.cloud_saves(player_id) on delete cascade,
  sender_name text not null,
  sender_avatar text not null,
  receiver_id uuid not null references public.cloud_saves(player_id) on delete cascade,
  receiver_name text not null,
  receiver_avatar text not null,
  facility_instance_id text not null,
  building_id text not null,
  recipe_id text not null references public.island_recipe_catalog(recipe_id),
  item_id text not null,
  input_per_batch integer not null,
  quantity integer not null check (quantity > 0),
  method_id text not null check (method_id in ('boat', 'plane')),
  reward_coins integer not null check (reward_coins >= 0),
  fee_coins integer not null default 0 check (fee_coins >= 0),
  status text not null default 'in_transit' check (status in ('in_transit', 'arrived')),
  departed_at timestamptz not null default now(),
  arrives_at timestamptz not null,
  processing_ready_at timestamptz,
  receiver_imported_at timestamptz,
  reward_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create index if not exists island_shipments_sender_idx on public.island_shipments(sender_id, arrives_at desc);
create index if not exists island_shipments_receiver_idx on public.island_shipments(receiver_id, arrives_at desc);
create index if not exists island_network_profiles_updated_idx on public.island_network_profiles(updated_at desc);

insert into public.island_recipe_catalog (recipe_id, building_id, item_id, input_per_batch, outputs, processing_seconds, reward_per_item)
values
  ('milkBatch', 'ranch', 'corn', 2, '{"milk":1}', 7200, 5),
  ('eggBatch', 'ranch', 'corn', 1, '{"egg":3}', 3600, 5),
  ('woolBatch', 'ranch', 'vegetable', 2, '{"wool":1}', 10800, 8),
  ('dairyBatch', 'foodFactory', 'milk', 2, '{"dairyBox":1}', 10800, 18),
  ('jamBatch', 'foodFactory', 'fruit', 2, '{"jam":1}', 10800, 12),
  ('roastCoffee', 'roastery', 'coffeeBean', 2, '{"roastedCoffee":1}', 7200, 15),
  ('weaveFabric', 'textileWorkshop', 'wool', 2, '{"fabric":1}', 10800, 20),
  ('flourBatch', 'mill', 'wheat', 2, '{"flour":1}', 7200, 7),
  ('breadBatch', 'bakery', 'flour', 2, '{"bread":1}', 10800, 20),
  ('grapeJuiceBatch', 'juiceStand', 'grape', 2, '{"grapeJuice":1}', 5400, 14),
  ('sugarBatch', 'sugarMill', 'sugarcane', 2, '{"sugar":1}', 7200, 9),
  ('forestGrowth', 'forest', 'sapling', 2, '{"log":3}', 10800, 4),
  ('lumberBatch', 'sawmill', 'log', 2, '{"lumber":2}', 7200, 12),
  ('metalPlateBatch', 'smelter', 'metalOre', 3, '{"metalPlate":2}', 14400, 14),
  ('marketSale:vegetable', 'market', 'vegetable', 1, '{}', 1, 11),
  ('marketSale:carrot', 'market', 'carrot', 1, '{}', 1, 9),
  ('marketSale:tomato', 'market', 'tomato', 1, '{}', 1, 13),
  ('marketSale:strawberry', 'market', 'strawberry', 1, '{}', 1, 18),
  ('marketSale:pumpkin', 'market', 'pumpkin', 1, '{}', 1, 16),
  ('marketSale:potato', 'market', 'potato', 1, '{}', 1, 11),
  ('marketSale:corn', 'market', 'corn', 1, '{}', 1, 7),
  ('marketSale:wheat', 'market', 'wheat', 1, '{}', 1, 9),
  ('marketSale:flour', 'market', 'flour', 1, '{}', 1, 27),
  ('marketSale:bread', 'market', 'bread', 1, '{}', 1, 67),
  ('marketSale:rice', 'market', 'rice', 1, '{}', 1, 13),
  ('marketSale:riceBall', 'market', 'riceBall', 1, '{}', 1, 74),
  ('marketSale:teaLeaf', 'market', 'teaLeaf', 1, '{}', 1, 21),
  ('marketSale:teaCup', 'market', 'teaCup', 1, '{}', 1, 81),
  ('marketSale:grape', 'market', 'grape', 1, '{}', 1, 20),
  ('marketSale:grapeJuice', 'market', 'grapeJuice', 1, '{}', 1, 60),
  ('marketSale:sugarcane', 'market', 'sugarcane', 1, '{}', 1, 13),
  ('marketSale:sugar', 'market', 'sugar', 1, '{}', 1, 32),
  ('marketSale:iceCream', 'market', 'iceCream', 1, '{}', 1, 126),
  ('marketSale:fruit', 'market', 'fruit', 1, '{}', 1, 16),
  ('marketSale:coffeeBean', 'market', 'coffeeBean', 1, '{}', 1, 21),
  ('marketSale:roastedCoffee', 'market', 'roastedCoffee', 1, '{}', 1, 49),
  ('marketSale:coffeeCup', 'market', 'coffeeCup', 1, '{}', 1, 114),
  ('marketSale:cocoaBean', 'market', 'cocoaBean', 1, '{}', 1, 25),
  ('marketSale:chocolate', 'market', 'chocolate', 1, '{}', 1, 79),
  ('marketSale:milk', 'market', 'milk', 1, '{}', 1, 25),
  ('marketSale:egg', 'market', 'egg', 1, '{}', 1, 14),
  ('marketSale:wool', 'market', 'wool', 1, '{}', 1, 28),
  ('marketSale:fabric', 'market', 'fabric', 1, '{}', 1, 88),
  ('marketSale:honey', 'market', 'honey', 1, '{}', 1, 32),
  ('marketSale:jam', 'market', 'jam', 1, '{}', 1, 63),
  ('marketSale:cake', 'market', 'cake', 1, '{}', 1, 158),
  ('marketSale:dairyBox', 'market', 'dairyBox', 1, '{}', 1, 88),
  ('marketSale:sapling', 'market', 'sapling', 1, '{}', 1, 6),
  ('marketSale:log', 'market', 'log', 1, '{}', 1, 16),
  ('marketSale:lumber', 'market', 'lumber', 1, '{}', 1, 42),
  ('marketSale:metalOre', 'market', 'metalOre', 1, '{}', 1, 20),
  ('marketSale:metalPlate', 'market', 'metalPlate', 1, '{}', 1, 67),
  ('marketSale:boat', 'market', 'boat', 1, '{}', 1, 1138),
  ('marketSale:plane', 'market', 'plane', 1, '{}', 1, 2450)
on conflict (recipe_id) do update set
  building_id = excluded.building_id,
  item_id = excluded.item_id,
  input_per_batch = excluded.input_per_batch,
  outputs = excluded.outputs,
  processing_seconds = excluded.processing_seconds,
  reward_per_item = excluded.reward_per_item;

revoke all on public.island_network_profiles, public.island_recipe_catalog, public.island_shipments from anon, authenticated;

create or replace function public.publish_island_network(
  p_player_id uuid,
  p_pin text,
  p_player_name text,
  p_player_avatar text,
  p_inventory jsonb,
  p_inventory_updated_at timestamptz,
  p_buildings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_row public.island_network_profiles%rowtype;
begin
  if p_pin !~ '^\d{4}$'
    or char_length(trim(p_player_name)) not between 1 and 16
    or p_player_avatar !~ '^[a-z_]+$'
    or char_length(p_player_avatar) > 32
    or jsonb_typeof(p_inventory) is distinct from 'object'
    or jsonb_typeof(p_buildings) is distinct from 'array'
    or jsonb_array_length(p_buildings) > 250
    or pg_column_size(p_inventory) > 20000
    or pg_column_size(p_buildings) > 100000 then
    raise exception 'Invalid island network profile';
  end if;

  if not exists (
    select 1 from public.cloud_saves
    where player_id = p_player_id
      and pin_hash = extensions.crypt(p_pin, pin_hash)
  ) then
    raise exception 'Invalid cloud PIN';
  end if;

  insert into public.island_network_profiles (
    player_id, player_name, player_avatar, inventory, inventory_updated_at, buildings, updated_at
  ) values (
    p_player_id, trim(p_player_name), p_player_avatar, p_inventory, coalesce(p_inventory_updated_at, now()), p_buildings, now()
  )
  on conflict (player_id) do update set
    player_name = excluded.player_name,
    player_avatar = excluded.player_avatar,
    inventory = case
      when excluded.inventory_updated_at >= public.island_network_profiles.inventory_updated_at then excluded.inventory
      else public.island_network_profiles.inventory
    end,
    inventory_updated_at = greatest(public.island_network_profiles.inventory_updated_at, excluded.inventory_updated_at),
    buildings = excluded.buildings,
    updated_at = now()
  returning * into result_row;

  return jsonb_build_object(
    'inventory', result_row.inventory,
    'inventory_updated_at', result_row.inventory_updated_at
  );
end;
$$;

create or replace function public.list_compatible_island_players(p_player_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(player_row order by player_row->>'player_name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'player_id', profile.player_id,
      'player_name', profile.player_name,
      'player_avatar', profile.player_avatar,
      'updated_at', profile.updated_at,
      'market_facility_id', market.facility_instance_id,
      'offers', offers.items
    ) as player_row
    from public.island_network_profiles profile
    cross join lateral (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', (building->>'id') || ':' || recipe.recipe_id || ':' || recipe.item_id,
        'facility_instance_id', building->>'id',
        'building_id', recipe.building_id,
        'recipe_id', recipe.recipe_id,
        'item_id', recipe.item_id,
        'input_per_batch', recipe.input_per_batch,
        'outputs', recipe.outputs,
        'processing_seconds', recipe.processing_seconds,
        'reward_per_item', recipe.reward_per_item
      ) order by recipe.recipe_id), '[]'::jsonb) as items
      from jsonb_array_elements(profile.buildings) building
      join public.island_recipe_catalog recipe on recipe.building_id = building->>'buildingId'
      where nullif(building->>'id', '') is not null
        and recipe.building_id <> 'market'
    ) offers
    cross join lateral (
      select min(building->>'id') as facility_instance_id
      from jsonb_array_elements(profile.buildings) building
      where building->>'buildingId' = 'market'
        and nullif(building->>'id', '') is not null
    ) market
    where profile.player_id <> p_player_id
      and profile.updated_at > now() - interval '30 days'
      and (jsonb_array_length(offers.items) > 0 or market.facility_instance_id is not null)
    limit 24
  ) compatible;
$$;

create or replace function public.dispatch_island_shipment(
  p_operation_id uuid,
  p_sender_id uuid,
  p_pin text,
  p_receiver_id uuid,
  p_facility_instance_id text,
  p_recipe_id text,
  p_item_id text,
  p_quantity integer,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_profile public.island_network_profiles%rowtype;
  receiver_profile public.island_network_profiles%rowtype;
  recipe public.island_recipe_catalog%rowtype;
  shipment public.island_shipments%rowtype;
  available_count integer;
  method_building text;
  method_seconds integer;
  method_capacity integer;
  method_fee integer;
  vehicle_item text;
  vehicle_count integer;
  busy_vehicle_count integer;
begin
  if p_sender_id = p_receiver_id or p_quantity is null or p_quantity <= 0 or p_method not in ('boat', 'plane') then
    raise exception 'Invalid island shipment';
  end if;

  if not exists (
    select 1 from public.cloud_saves
    where player_id = p_sender_id
      and pin_hash = extensions.crypt(p_pin, pin_hash)
  ) then
    raise exception 'Invalid cloud PIN';
  end if;

  select * into shipment from public.island_shipments
  where operation_id = p_operation_id and sender_id = p_sender_id;
  if found then
    select * into sender_profile from public.island_network_profiles where player_id = p_sender_id;
    return jsonb_build_object('shipment', to_jsonb(shipment), 'inventory', sender_profile.inventory, 'inventory_updated_at', sender_profile.inventory_updated_at);
  end if;

  select * into sender_profile from public.island_network_profiles where player_id = p_sender_id for update;
  select * into shipment from public.island_shipments
  where operation_id = p_operation_id and sender_id = p_sender_id;
  if found then
    return jsonb_build_object('shipment', to_jsonb(shipment), 'inventory', sender_profile.inventory, 'inventory_updated_at', sender_profile.inventory_updated_at);
  end if;
  select * into receiver_profile from public.island_network_profiles where player_id = p_receiver_id;
  select * into recipe from public.island_recipe_catalog where recipe_id = p_recipe_id and item_id = p_item_id;
  if sender_profile.player_id is null or receiver_profile.player_id is null or recipe.recipe_id is null then
    raise exception 'Invalid island shipment';
  end if;

  if p_method = 'boat' then
    method_building := 'dock'; vehicle_item := 'boat'; method_seconds := 3600; method_capacity := 20; method_fee := 0;
  else
    method_building := 'airport'; vehicle_item := 'plane'; method_seconds := 900; method_capacity := 8; method_fee := 2;
  end if;

  if p_quantity > method_capacity
    or not exists (
      select 1 from jsonb_array_elements(sender_profile.buildings) building
      where building->>'buildingId' = method_building
    )
    or not exists (
      select 1 from jsonb_array_elements(receiver_profile.buildings) building
      where building->>'id' = p_facility_instance_id
        and building->>'buildingId' = recipe.building_id
    ) then
    raise exception 'Invalid island shipment route';
  end if;

  vehicle_count := case
    when coalesce(sender_profile.inventory->>vehicle_item, '') ~ '^\d+$' then (sender_profile.inventory->>vehicle_item)::integer
    else 0
  end;
  update public.island_shipments pending
  set status = 'arrived',
      processing_ready_at = pending.arrives_at + make_interval(secs => pending_recipe.processing_seconds),
      updated_at = now()
  from public.island_recipe_catalog pending_recipe
  where pending.recipe_id = pending_recipe.recipe_id
    and pending.sender_id = p_sender_id
    and pending.status = 'in_transit'
    and pending.arrives_at <= now();
  select count(*)::integer into busy_vehicle_count
  from public.island_shipments
  where sender_id = p_sender_id and method_id = p_method and status = 'in_transit';
  if vehicle_count <= busy_vehicle_count then
    raise exception 'No available island logistics vehicle';
  end if;

  available_count := case
    when coalesce(sender_profile.inventory->>p_item_id, '') ~ '^\d+$' then (sender_profile.inventory->>p_item_id)::integer
    else 0
  end;
  if available_count < p_quantity
    or (p_item_id = vehicle_item and available_count < busy_vehicle_count + 1 + p_quantity) then
    raise exception 'Insufficient island inventory';
  end if;

  update public.island_network_profiles
  set inventory = jsonb_set(inventory, array[p_item_id], to_jsonb(available_count - p_quantity), true),
      inventory_updated_at = now(),
      updated_at = now()
  where player_id = p_sender_id
  returning * into sender_profile;

  insert into public.island_shipments (
    operation_id, sender_id, sender_name, sender_avatar, receiver_id, receiver_name, receiver_avatar,
    facility_instance_id, building_id, recipe_id, item_id, input_per_batch, quantity, method_id,
    reward_coins, fee_coins, arrives_at
  ) values (
    p_operation_id, p_sender_id, sender_profile.player_name, sender_profile.player_avatar,
    p_receiver_id, receiver_profile.player_name, receiver_profile.player_avatar,
    p_facility_instance_id, recipe.building_id, recipe.recipe_id, recipe.item_id, recipe.input_per_batch,
    p_quantity, p_method, recipe.reward_per_item * p_quantity, method_fee * p_quantity,
    now() + make_interval(secs => method_seconds)
  ) returning * into shipment;

  return jsonb_build_object('shipment', to_jsonb(shipment), 'inventory', sender_profile.inventory, 'inventory_updated_at', sender_profile.inventory_updated_at);
end;
$$;

create or replace function public.get_island_logistics(p_player_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile public.island_network_profiles%rowtype;
  outgoing jsonb;
  inbound jsonb;
  rewards jsonb;
begin
  if not exists (
    select 1 from public.cloud_saves
    where player_id = p_player_id
      and pin_hash = extensions.crypt(p_pin, pin_hash)
  ) then
    raise exception 'Invalid cloud PIN';
  end if;

  update public.island_shipments shipment
  set status = 'arrived',
      processing_ready_at = shipment.arrives_at + make_interval(secs => recipe.processing_seconds),
      updated_at = now()
  from public.island_recipe_catalog recipe
  where shipment.recipe_id = recipe.recipe_id
    and shipment.status = 'in_transit'
    and shipment.arrives_at <= now()
    and (shipment.sender_id = p_player_id or shipment.receiver_id = p_player_id);

  select * into profile from public.island_network_profiles where player_id = p_player_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'operation_id', operation_id, 'status', status,
    'partner_id', receiver_id, 'partner_name', receiver_name, 'partner_avatar', receiver_avatar,
    'facility_instance_id', facility_instance_id, 'building_id', building_id, 'recipe_id', recipe_id,
    'item_id', item_id, 'input_per_batch', input_per_batch, 'quantity', quantity, 'method_id', method_id,
    'reward_coins', reward_coins, 'fee_coins', fee_coins, 'departed_at', departed_at,
    'arrives_at', arrives_at, 'processing_ready_at', processing_ready_at
  ) order by departed_at desc), '[]'::jsonb) into outgoing
  from public.island_shipments
  where sender_id = p_player_id and departed_at > now() - interval '30 days';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'operation_id', operation_id, 'status', status,
    'partner_id', sender_id, 'partner_name', sender_name, 'partner_avatar', sender_avatar, 'sender_name', sender_name,
    'facility_instance_id', facility_instance_id, 'building_id', building_id, 'recipe_id', recipe_id,
    'item_id', item_id, 'input_per_batch', input_per_batch, 'quantity', quantity, 'method_id', method_id,
    'reward_coins', reward_coins, 'fee_coins', fee_coins, 'departed_at', departed_at,
    'arrives_at', arrives_at, 'processing_ready_at', processing_ready_at
  ) order by arrives_at), '[]'::jsonb) into inbound
  from public.island_shipments
  where receiver_id = p_player_id and status = 'arrived' and receiver_imported_at is null;

  select coalesce(jsonb_agg(to_jsonb(shipment) order by arrives_at), '[]'::jsonb) into rewards
  from public.island_shipments shipment
  where sender_id = p_player_id and status = 'arrived' and reward_claimed_at is null;

  return jsonb_build_object(
    'outgoing_shipments', outgoing,
    'inbound_shipments', inbound,
    'reward_shipments', rewards,
    'inventory', coalesce(profile.inventory, '{}'::jsonb),
    'inventory_updated_at', profile.inventory_updated_at
  );
end;
$$;

create or replace function public.ack_island_logistics(
  p_player_id uuid,
  p_pin text,
  p_inbound_ids uuid[],
  p_reward_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.cloud_saves
    where player_id = p_player_id
      and pin_hash = extensions.crypt(p_pin, pin_hash)
  ) then
    raise exception 'Invalid cloud PIN';
  end if;

  update public.island_shipments
  set receiver_imported_at = coalesce(receiver_imported_at, now()), updated_at = now()
  where receiver_id = p_player_id and id = any(coalesce(p_inbound_ids, '{}'::uuid[]));

  update public.island_shipments
  set reward_claimed_at = coalesce(reward_claimed_at, now()), updated_at = now()
  where sender_id = p_player_id and id = any(coalesce(p_reward_ids, '{}'::uuid[]));
end;
$$;

revoke all on function public.publish_island_network(uuid, text, text, text, jsonb, timestamptz, jsonb) from public;
revoke all on function public.list_compatible_island_players(uuid) from public;
revoke all on function public.dispatch_island_shipment(uuid, uuid, text, uuid, text, text, text, integer, text) from public;
revoke all on function public.get_island_logistics(uuid, text) from public;
revoke all on function public.ack_island_logistics(uuid, text, uuid[], uuid[]) from public;

grant execute on function public.publish_island_network(uuid, text, text, text, jsonb, timestamptz, jsonb) to anon, authenticated;
grant execute on function public.list_compatible_island_players(uuid) to anon, authenticated;
grant execute on function public.dispatch_island_shipment(uuid, uuid, text, uuid, text, text, text, integer, text) to anon, authenticated;
grant execute on function public.get_island_logistics(uuid, text) to anon, authenticated;
grant execute on function public.ack_island_logistics(uuid, text, uuid[], uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
