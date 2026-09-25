-- Plantarium – likes and comments on magazine articles.
-- Signed-in, non-banned users can like and comment on published articles.
-- Comments can be deleted by their writer or by an admin. Likes and comments are public to read.

-- ---------- likes ----------
create table if not exists public.magazine_likes (
  article_id uuid not null references public.magazine_articles(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);
create index if not exists magazine_likes_user_idx on public.magazine_likes (user_id);

-- ---------- comments ----------
create table if not exists public.magazine_comments (
  id         uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.magazine_articles(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists magazine_comments_article_idx on public.magazine_comments (article_id, created_at);
create index if not exists magazine_comments_user_idx on public.magazine_comments (user_id, created_at desc);

-- Is this article live in the magazine?
create or replace function public.is_published_article(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.magazine_articles where id = aid and status = 'published');
$$;

-- Anti-spam: at most 5 comments a minute and 100 a day per user (not for admins or the SQL editor).
create or replace function public.magazine_comments_rate_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_client_session() and not public.is_admin() then
    if (select count(*) from public.magazine_comments
         where user_id = new.user_id and created_at > now() - interval '1 minute') >= 5
       or (select count(*) from public.magazine_comments
         where user_id = new.user_id and created_at > now() - interval '1 day') >= 100 then
      raise exception 'comment rate limit' using errcode = 'P0429';
    end if;
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end $$;

drop trigger if exists magazine_comments_rate_limit on public.magazine_comments;
create trigger magazine_comments_rate_limit before insert on public.magazine_comments
  for each row execute function public.magazine_comments_rate_limit();

-- ---------- security ----------
alter table public.magazine_likes    enable row level security;
alter table public.magazine_comments enable row level security;

drop policy if exists "read likes"        on public.magazine_likes;
drop policy if exists "like as yourself"  on public.magazine_likes;
drop policy if exists "remove own like"   on public.magazine_likes;
create policy "read likes" on public.magazine_likes for select
  using (public.is_published_article(article_id) or public.is_admin());
create policy "like as yourself" on public.magazine_likes for insert
  with check (user_id = auth.uid() and not public.is_banned() and public.is_published_article(article_id));
create policy "remove own like" on public.magazine_likes for delete
  using (user_id = auth.uid());

drop policy if exists "read comments"          on public.magazine_comments;
drop policy if exists "comment as yourself"    on public.magazine_comments;
drop policy if exists "delete own comment"     on public.magazine_comments;
drop policy if exists "admins delete comments" on public.magazine_comments;
create policy "read comments" on public.magazine_comments for select
  using (public.is_published_article(article_id) or public.is_admin());
create policy "comment as yourself" on public.magazine_comments for insert
  with check (user_id = auth.uid() and not public.is_banned() and public.is_published_article(article_id));
create policy "delete own comment" on public.magazine_comments for delete
  using (user_id = auth.uid());
create policy "admins delete comments" on public.magazine_comments for delete
  using (public.is_admin());
-- No update policy: comments can't be edited (delete and write again).

-- Admin log: deleting someone else's comment
alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in (
  'ban', 'unban', 'delete_user', 'set_role',
  'approve_article', 'reject_article', 'unpublish_article', 'dismiss_reports', 'delete_comment'));
