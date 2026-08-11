-- Prevent two devices from overwriting a newer cloud save after both read it.
-- Apply after supabase/leaderboard.sql and before deploying the matching app.
begin;

create or replace function public.save_cloud_progress_if_current(
  p_player_id uuid,
  p_player_name text,
  p_pin text,
  p_save_code text,
  p_expected_save_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_hash text;
  existing_name text;
  existing_save_code text;
begin
  if char_length(trim(p_player_name)) not between 1 and 16
    or p_pin !~ '^\d{4}$'
    or char_length(p_save_code) not between 20 and 300000
    or char_length(p_expected_save_code) not between 20 and 300000 then
    raise exception 'Invalid cloud save';
  end if;

  select pin_hash, player_name, save_code
  into existing_hash, existing_name, existing_save_code
  from public.cloud_saves
  where player_id = p_player_id
  for update;

  if not found
    or existing_hash is null
    or existing_hash <> extensions.crypt(p_pin, existing_hash) then
    raise exception 'Invalid cloud PIN';
  end if;

  -- A false result means another device won the race. The caller must reload
  -- the cloud save and must not retry by blindly overwriting it.
  if existing_save_code is distinct from p_expected_save_code then
    return false;
  end if;

  if lower(existing_name) is distinct from lower(trim(p_player_name))
    and exists (
      select 1
      from public.cloud_saves
      where lower(player_name) = lower(trim(p_player_name))
        and player_id is distinct from p_player_id
    ) then
    raise exception 'duplicate key';
  end if;

  update public.cloud_saves
  set player_name = trim(p_player_name),
      save_code = p_save_code,
      updated_at = now()
  where player_id = p_player_id;

  return true;
end;
$$;

revoke all on function public.save_cloud_progress_if_current(uuid, text, text, text, text) from public;
grant execute on function public.save_cloud_progress_if_current(uuid, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
