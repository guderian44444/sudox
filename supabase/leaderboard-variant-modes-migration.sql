-- v62: preserve all classic rows; add independent variant/difficulty/assist boards.
-- Run once in the existing SUDOX Supabase SQL editor. Safe to rerun; no rows are rewritten.
begin;

alter table public.leaderboard_scores drop constraint if exists leaderboard_scores_difficulty_check;
alter table public.leaderboard_scores add constraint leaderboard_scores_difficulty_check check ((difficulty in ('easy', 'medium', 'hard', 'alin') or difficulty ~ '^(diagonal|thermo|killer)_(easy|medium|hard)(_alin)?$'));

alter table public.leaderboard_score_log drop constraint if exists leaderboard_score_log_difficulty_check;
alter table public.leaderboard_score_log add constraint leaderboard_score_log_difficulty_check check ((difficulty in ('easy', 'medium', 'hard', 'alin') or difficulty ~ '^(diagonal|thermo|killer)_(easy|medium|hard)(_alin)?$'));

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
  p_pin text,
  p_next_floor integer default null,
  p_app_version text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_floor integer;
  v_previous_score integer;
  v_resulting_floor integer;
  v_accepted boolean;
  v_decision text;
begin
  if char_length(trim(p_player_name)) not between 1 and 16
    or (p_difficulty is null or not (p_difficulty in ('easy', 'medium', 'hard', 'alin') or p_difficulty ~ '^(diagonal|thermo|killer)_(easy|medium|hard)(_alin)?$'))
    or p_floor not between 1 and 1000000
    or (p_next_floor is not null and p_next_floor not between 1 and 1000000)
    or p_score < 0
    or p_elapsed_seconds < 0
    or p_mistakes < 0
    or p_stars not between 1 and 3
    or (p_player_avatar is not null and (char_length(p_player_avatar) > 32 or p_player_avatar !~ '^[a-z_]+$'))
    or coalesce(p_avatar_color, 0) not between 0 and 7
    or char_length(coalesce(p_app_version, '')) > 20
    or p_pin is null
    or p_pin !~ '^\d{4}$' then
    raise exception 'Invalid leaderboard score';
  end if;

  -- Scores may only be written by a player who already owns a cloud save with this PIN.
  if not exists (
    select 1
    from public.cloud_saves
    where player_id = p_player_id
      and pin_hash = extensions.crypt(p_pin, pin_hash)
  ) then
    raise exception 'Invalid cloud PIN';
  end if;

  select floor, score
  into v_previous_floor, v_previous_score
  from public.leaderboard_scores
  where player_id = p_player_id
    and difficulty = p_difficulty
  for update;

  v_accepted := v_previous_floor is null
    or p_floor > v_previous_floor
    or (p_floor = v_previous_floor and p_score > v_previous_score);
  v_decision := case
    when v_previous_floor is null then 'new_row'
    when p_floor > v_previous_floor then 'higher_floor'
    when p_floor = v_previous_floor and p_score > v_previous_score then 'better_score_same_floor'
    else 'not_higher'
  end;

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

  select floor
  into v_resulting_floor
  from public.leaderboard_scores
  where player_id = p_player_id
    and difficulty = p_difficulty;

  insert into public.leaderboard_score_log (
    player_id, player_name, difficulty, submitted_floor, submitted_next_floor,
    previous_floor, resulting_floor, score, elapsed_seconds, mistakes, stars,
    accepted, decision, app_version
  ) values (
    p_player_id, trim(p_player_name), p_difficulty, p_floor, p_next_floor,
    v_previous_floor, v_resulting_floor, p_score, p_elapsed_seconds, p_mistakes, p_stars,
    v_accepted, v_decision, coalesce(p_app_version, '')
  );

  -- Bound free-tier growth while retaining a long per-mode diagnostic trail.
  delete from public.leaderboard_score_log
  where id in (
    select old_log.id
    from public.leaderboard_score_log as old_log
    where old_log.player_id = p_player_id
      and old_log.difficulty = p_difficulty
    order by old_log.created_at desc, old_log.id desc
    offset 500
  );
end;
$$;

revoke all on function public.submit_leaderboard_score(uuid, text, text, integer, integer, integer, integer, integer, text, integer, text, integer, text) from public;
grant execute on function public.submit_leaderboard_score(uuid, text, text, integer, integer, integer, integer, integer, text, integer, text, integer, text) to anon, authenticated;

create or replace function public.update_leaderboard_taunt(
  p_player_id uuid,
  p_pin text,
  p_taunt text,
  p_difficulty text
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
    or p_taunt ~ '[[:cntrl:]]'
    or (p_difficulty is null or not (p_difficulty in ('easy', 'medium', 'hard', 'alin') or p_difficulty ~ '^(diagonal|thermo|killer)_(easy|medium|hard)(_alin)?$')) then
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

  -- Taunts are per difficulty (player_id, difficulty) so trash-talk on easy
  -- does not appear when you're behind on hard.
  update public.leaderboard_scores
  set taunt = trim(p_taunt),
      updated_at = now()
  where player_id = p_player_id
    and difficulty = p_difficulty;
end;
$$;

revoke all on function public.update_leaderboard_taunt(uuid, text, text, text) from public;
grant execute on function public.update_leaderboard_taunt(uuid, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
