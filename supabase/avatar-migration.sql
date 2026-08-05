begin;

alter table public.leaderboard_scores
  add column if not exists player_avatar text default null,
  add column if not exists avatar_color integer not null default 0;

alter table public.leaderboard_scores
  drop constraint if exists leaderboard_scores_avatar_color_check;
alter table public.leaderboard_scores
  add constraint leaderboard_scores_avatar_color_check check (avatar_color between 0 and 7);

-- Score submission signature (with PIN) is owned by pin-guard-migration.sql / leaderboard.sql.
-- This migration only keeps avatar columns and update_leaderboard_avatar.

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

notify pgrst, 'reload schema';

commit;
