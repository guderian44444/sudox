begin;

alter table public.leaderboard_scores
  add column if not exists player_avatar text default null,
  add column if not exists avatar_color integer not null default 0;

alter table public.leaderboard_scores
  drop constraint if exists leaderboard_scores_avatar_color_check;
alter table public.leaderboard_scores
  add constraint leaderboard_scores_avatar_color_check check (avatar_color between 0 and 7);

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

notify pgrst, 'reload schema';

commit;
