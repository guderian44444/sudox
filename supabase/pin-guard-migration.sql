-- P0-2: Require family PIN for cloud save updates and leaderboard writes.
-- Run this in Supabase SQL Editor on existing projects (leaderboard.sql already includes the same logic for fresh installs).

begin;

create extension if not exists pgcrypto with schema extensions;

-- --- save_cloud_progress: verify PIN on update; never reset pin_hash without auth ---
create or replace function public.save_cloud_progress(
  p_player_id uuid,
  p_player_name text,
  p_pin text,
  p_save_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_hash text;
  existing_name text;
begin
  if char_length(trim(p_player_name)) not between 1 and 16
    or p_pin !~ '^\d{4}$'
    or char_length(p_save_code) not between 20 and 300000 then
    raise exception 'Invalid cloud save';
  end if;

  select pin_hash, player_name
  into existing_hash, existing_name
  from public.cloud_saves
  where player_id = p_player_id;

  if found then
    if existing_hash is null
      or existing_hash <> extensions.crypt(p_pin, existing_hash) then
      raise exception 'Invalid cloud PIN';
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
  else
    insert into public.cloud_saves (player_id, player_name, pin_hash, save_code)
    values (
      p_player_id,
      trim(p_player_name),
      extensions.crypt(p_pin, extensions.gen_salt('bf')),
      p_save_code
    );
  end if;
end;
$$;

revoke all on function public.save_cloud_progress(uuid, text, text, text) from public;
grant execute on function public.save_cloud_progress(uuid, text, text, text) to anon, authenticated;

-- --- submit_leaderboard_score: require matching cloud save PIN ---
drop function if exists public.submit_leaderboard_score(uuid, text, text, integer, integer, integer, integer, integer);
drop function if exists public.submit_leaderboard_score(uuid, text, text, integer, integer, integer, integer, integer, text, integer);
drop function if exists public.submit_leaderboard_score(uuid, text, text, integer, integer, integer, integer, integer, text, integer, text);

create or replace function public.submit_leaderboard_score(
  p_player_id uuid,
  p_player_name text,
  p_difficulty text,
  p_floor integer,
  p_score integer,
  p_elapsed_seconds integer,
  p_mistakes integer,
  p_stars integer,
  p_player_avatar text,
  p_avatar_color integer,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(trim(p_player_name)) not between 1 and 16
    or p_difficulty not in ('easy', 'medium', 'hard', 'alin')
    or p_floor not between 1 and 1000000
    or p_score < 0
    or p_elapsed_seconds < 0
    or p_mistakes < 0
    or p_stars not between 1 and 3
    or (p_player_avatar is not null and (char_length(p_player_avatar) > 32 or p_player_avatar !~ '^[a-z_]+$'))
    or coalesce(p_avatar_color, 0) not between 0 and 7
    or p_pin is null
    or p_pin !~ '^\d{4}$' then
    raise exception 'Invalid leaderboard score';
  end if;

  if not exists (
    select 1
    from public.cloud_saves
    where player_id = p_player_id
      and pin_hash = extensions.crypt(p_pin, pin_hash)
  ) then
    raise exception 'Invalid cloud PIN';
  end if;

  insert into public.leaderboard_scores (
    player_id, player_name, difficulty, floor, score, elapsed_seconds, mistakes, stars, player_avatar, avatar_color
  ) values (
    p_player_id, trim(p_player_name), p_difficulty, p_floor, p_score, p_elapsed_seconds, p_mistakes, p_stars, p_player_avatar, coalesce(p_avatar_color, 0)
  )
  on conflict (player_id, difficulty) do update set
    player_name = excluded.player_name,
    floor = excluded.floor,
    score = excluded.score,
    elapsed_seconds = excluded.elapsed_seconds,
    mistakes = excluded.mistakes,
    stars = excluded.stars,
    player_avatar = excluded.player_avatar,
    avatar_color = excluded.avatar_color,
    updated_at = now()
  where excluded.floor > public.leaderboard_scores.floor
     or (excluded.floor = public.leaderboard_scores.floor and excluded.score > public.leaderboard_scores.score);
end;
$$;

revoke all on function public.submit_leaderboard_score(uuid, text, text, integer, integer, integer, integer, integer, text, integer, text) from public;
grant execute on function public.submit_leaderboard_score(uuid, text, text, integer, integer, integer, integer, integer, text, integer, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
