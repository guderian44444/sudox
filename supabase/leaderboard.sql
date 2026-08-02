create table if not exists public.leaderboard_scores (
  player_id uuid not null,
  player_name varchar(16) not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'alin')),
  floor integer not null check (floor between 1 and 1000000),
  score integer not null check (score >= 0),
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  mistakes integer not null check (mistakes >= 0),
  stars smallint not null check (stars between 1 and 3),
  updated_at timestamptz not null default now(),
  primary key (player_id, difficulty)
);

alter table public.leaderboard_scores
  add column if not exists taunt varchar(48) not null default '';

alter table public.leaderboard_scores
  add column if not exists player_avatar text default null,
  add column if not exists avatar_color integer not null default 0;

alter table public.leaderboard_scores
  drop constraint if exists leaderboard_scores_avatar_color_check;
alter table public.leaderboard_scores
  add constraint leaderboard_scores_avatar_color_check check (avatar_color between 0 and 7);

alter table public.leaderboard_scores
  drop constraint if exists leaderboard_scores_difficulty_check;
alter table public.leaderboard_scores
  add constraint leaderboard_scores_difficulty_check check (difficulty in ('easy', 'medium', 'hard', 'alin'));

alter table public.leaderboard_scores enable row level security;
revoke all on public.leaderboard_scores from anon, authenticated;
grant select on public.leaderboard_scores to anon, authenticated;

drop policy if exists "Anyone can read family leaderboard" on public.leaderboard_scores;
create policy "Anyone can read family leaderboard"
on public.leaderboard_scores for select
to anon, authenticated
using (true);

drop function if exists public.submit_leaderboard_score(uuid, text, text, integer, integer, integer, integer, integer);

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
  p_avatar_color integer
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
    or coalesce(p_avatar_color, 0) not between 0 and 7 then
    raise exception 'Invalid leaderboard score';
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

revoke all on function public.submit_leaderboard_score(uuid, text, text, integer, integer, integer, integer, integer, text, integer) from public;
grant execute on function public.submit_leaderboard_score(uuid, text, text, integer, integer, integer, integer, integer, text, integer) to anon, authenticated;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.cloud_saves (
  player_id uuid primary key,
  player_name varchar(16) not null,
  pin_hash text not null,
  save_code text not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists cloud_saves_player_name_lower_idx on public.cloud_saves (lower(player_name));
alter table public.cloud_saves enable row level security;
revoke all on public.cloud_saves from anon, authenticated;

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
begin
  if char_length(trim(p_player_name)) not between 1 and 16
    or p_pin !~ '^\d{4}$'
    or char_length(p_save_code) not between 20 and 300000 then
    raise exception 'Invalid cloud save';
  end if;

  insert into public.cloud_saves (player_id, player_name, pin_hash, save_code)
  values (p_player_id, trim(p_player_name), extensions.crypt(p_pin, extensions.gen_salt('bf')), p_save_code)
  on conflict (player_id) do update set
    player_name = excluded.player_name,
    pin_hash = excluded.pin_hash,
    save_code = excluded.save_code,
    updated_at = now();
end;
$$;

create or replace function public.load_cloud_progress(p_player_name text, p_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text;
begin
  select save_code into result
  from public.cloud_saves
  where lower(player_name) = lower(trim(p_player_name))
    and pin_hash = extensions.crypt(p_pin, pin_hash);
  if result is null then
    raise exception 'Invalid cloud PIN';
  end if;
  return result;
end;
$$;

revoke all on function public.save_cloud_progress(uuid, text, text, text) from public;
revoke all on function public.load_cloud_progress(text, text) from public;
grant execute on function public.save_cloud_progress(uuid, text, text, text) to anon, authenticated;
grant execute on function public.load_cloud_progress(text, text) to anon, authenticated;

create or replace function public.update_leaderboard_taunt(
  p_player_id uuid,
  p_pin text,
  p_taunt text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(p_pin) <> 4
    or p_pin ~ '[^0-9]'
    or char_length(trim(p_taunt)) > 48
    or p_taunt ~ '[[:cntrl:]]' then
    raise exception 'Invalid leaderboard taunt';
  end if;

  if not exists (
    select 1
    from public.cloud_saves
    where player_id = p_player_id
      and pin_hash = extensions.crypt(p_pin, pin_hash)
  ) then
    raise exception 'Invalid cloud PIN';
  end if;

  update public.leaderboard_scores
  set taunt = trim(p_taunt)
  where player_id = p_player_id;
end;
$$;

revoke all on function public.update_leaderboard_taunt(uuid, text, text) from public;
grant execute on function public.update_leaderboard_taunt(uuid, text, text) to anon, authenticated;

create or replace function public.update_leaderboard_avatar(
  p_player_id uuid,
  p_pin text,
  p_player_avatar text,
  p_avatar_color integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(p_pin) <> 4
    or p_pin ~ '[^0-9]'
    or p_player_avatar is null
    or char_length(p_player_avatar) > 32
    or p_player_avatar !~ '^[a-z_]+$'
    or coalesce(p_avatar_color, 0) not between 0 and 7 then
    raise exception 'Invalid leaderboard avatar';
  end if;

  if not exists (
    select 1
    from public.cloud_saves
    where player_id = p_player_id
      and pin_hash = extensions.crypt(p_pin, pin_hash)
  ) then
    raise exception 'Invalid cloud PIN';
  end if;

  update public.leaderboard_scores
  set player_avatar = p_player_avatar,
      avatar_color = coalesce(p_avatar_color, 0),
      updated_at = now()
  where player_id = p_player_id;
end;
$$;

revoke all on function public.update_leaderboard_avatar(uuid, text, text, integer) from public;
grant execute on function public.update_leaderboard_avatar(uuid, text, text, integer) to anon, authenticated;

create or replace function public.rename_cloud_player(
  p_player_id uuid,
  p_pin text,
  p_player_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(p_pin) <> 4
    or p_pin ~ '[^0-9]'
    or char_length(trim(p_player_name)) not between 1 and 16
    or p_player_name ~ '[[:cntrl:]]' then
    raise exception 'Invalid player rename';
  end if;

  if not exists (
    select 1
    from public.cloud_saves
    where player_id = p_player_id
      and pin_hash = extensions.crypt(p_pin, pin_hash)
  ) then
    raise exception 'Invalid cloud PIN';
  end if;

  update public.cloud_saves
  set player_name = trim(p_player_name), updated_at = now()
  where player_id = p_player_id;

  update public.leaderboard_scores
  set player_name = trim(p_player_name)
  where player_id = p_player_id;
end;
$$;

revoke all on function public.rename_cloud_player(uuid, text, text) from public;
grant execute on function public.rename_cloud_player(uuid, text, text) to anon, authenticated;
