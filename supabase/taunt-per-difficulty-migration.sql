-- Migration: leaderboard taunts are per difficulty, not global per player.
-- Apply in Supabase SQL editor if the project already ran an older leaderboard.sql.

drop function if exists public.update_leaderboard_taunt(uuid, text, text);

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
    or p_difficulty not in ('easy', 'medium', 'hard', 'alin') then
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
  set taunt = trim(p_taunt),
      updated_at = now()
  where player_id = p_player_id
    and difficulty = p_difficulty;
end;
$$;

revoke all on function public.update_leaderboard_taunt(uuid, text, text, text) from public;
grant execute on function public.update_leaderboard_taunt(uuid, text, text, text) to anon, authenticated;
