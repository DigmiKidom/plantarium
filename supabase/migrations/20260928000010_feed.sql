-- Plantarium – "החממה": the community feed on the home page.
-- Posts (update or question) with up to 4 photos and an optional species tag; likes (reactions) and comments.
-- The tables exist since 0001; this migration tightens the rules for real use.

-- ---------- posts ----------
drop policy if exists "create own posts" on public.posts;
create policy "create own posts" on public.posts for insert
  with check (
    author_id = auth.uid()
    and not public.is_banned()
    and type in ('post', 'question', 'plant_update')
    and repost_of is null and quote_of is null
  );
drop policy if exists "admins delete posts" on public.posts;
create policy "admins delete posts" on public.posts for delete using (public.is_admin());

-- Anti-spam: 5 posts per 10 minutes, 30 a day (not for admins or the SQL editor)
create or replace function public.posts_rate_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_client_session() and not public.is_admin() then
    if (select count(*) from public.posts where author_id = new.author_id and created_at > now() - interval '10 minutes') >= 5
       or (select count(*) from public.posts where author_id = new.author_id and created_at > now() - interval '1 day') >= 30 then
      raise exception 'post rate limit' using errcode = 'P0429';
    end if;
  end if;
  new.created_at := now();
  new.body := nullif(btrim(new.body), '');
  return new;
end $$;
drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.posts_rate_limit();

-- ---------- photos ----------
-- Photos must sit in the author's own folder in R2, at most 4 per post.
drop policy if exists "write media on own posts" on public.post_media;
create policy "write media on own posts" on public.post_media for all
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
    and storage_path like 'feed/' || auth.uid()::text || '/%'
    and storage_path !~ '\.\.'
  );

create or replace function public.post_media_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.post_media where post_id = new.post_id) >= 4 then
    raise exception 'max 4 photos per post' using errcode = 'P0413';
  end if;
  return new;
end $$;
drop trigger if exists post_media_limit on public.post_media;
create trigger post_media_limit before insert on public.post_media
  for each row execute function public.post_media_limit();

-- ---------- likes ----------
drop policy if exists "own reactions" on public.reactions;
create policy "own reactions" on public.reactions for insert
  with check (
    user_id = auth.uid() and kind = 'like' and not public.is_banned()
    and exists (select 1 from public.posts p where p.id = post_id)   -- only posts you can see
  );

-- ---------- comments ----------
drop policy if exists "comment on visible posts" on public.comments;
create policy "comment on visible posts" on public.comments for insert
  with check (
    author_id = auth.uid() and not public.is_banned()
    and exists (select 1 from public.posts p where p.id = post_id)
  );
drop policy if exists "admins delete post comments" on public.comments;
create policy "admins delete post comments" on public.comments for delete using (public.is_admin());

create or replace function public.comments_rate_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_client_session() and not public.is_admin() then
    if (select count(*) from public.comments where author_id = new.author_id and created_at > now() - interval '1 minute') >= 5
       or (select count(*) from public.comments where author_id = new.author_id and created_at > now() - interval '1 day') >= 200 then
      raise exception 'comment rate limit' using errcode = 'P0429';
    end if;
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end $$;
drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit before insert on public.comments
  for each row execute function public.comments_rate_limit();

-- ---------- reports & admin log ----------
drop index if exists public.reports_open_target_unique;
create unique index if not exists reports_open_target_unique
  on public.reports (reporter_id, user_id,
                     coalesce(listing_id, post_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'open' and user_id is not null;

alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in (
  'ban', 'unban', 'delete_user', 'set_role', 'set_plan',
  'approve_article', 'reject_article', 'unpublish_article', 'dismiss_reports', 'delete_comment',
  'remove_listing', 'delete_post'));
