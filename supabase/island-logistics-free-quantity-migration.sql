-- Allow logistics quantities from 1 through the vehicle capacity.
-- Apply after supabase/island-logistics-migration.sql on an existing database.
-- This is intentionally separate because CREATE TABLE IF NOT EXISTS does not
-- remove the old quantity % input_per_batch check from existing deployments.
begin;

alter table public.island_shipments
  drop constraint if exists island_shipments_check1;

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

revoke all on function public.dispatch_island_shipment(uuid, uuid, text, uuid, text, text, text, integer, text) from public;
grant execute on function public.dispatch_island_shipment(uuid, uuid, text, uuid, text, text, text, integer, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
