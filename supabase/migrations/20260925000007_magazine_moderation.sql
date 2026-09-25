-- Plantarium – magazine (articles by authors, approved by admins) + moderation (reports, bans, admin log).
--
-- Who can do what:
--   user    – read published articles, report other accounts
--   author  – + write own articles and send them for review (can never publish by themselves)
--   admin   – + approve/reject/unpublish any article, give/remove roles, ban/unban, delete accounts, handle reports
-- Changes by the service role or the SQL editor are not restricted by the guards below.

-- True for requests coming from the website (PostgREST roles), false for SQL editor / service role.
create or replace function public.is_client_session() returns boolean
language sql stable as $$
  select current_user in ('authenticated', 'anon');
$$;

-- ---------------------------------------------------------------
-- Profiles: bans
-- ---------------------------------------------------------------
alter table public.profiles
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason   text check (char_length(ban_reason) <= 500);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_banned(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and banned_until > now());
$$;

-- Author, editor or admin, and not banned.
create or replace function public.is_author() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role in ('author', 'editor', 'admin')
       and (banned_until is null or banned_until <= now())
  );
$$;

-- Role and ban fields can only be changed by an admin, never on yourself or on another admin.
-- An admin editing someone else's profile may change only those fields.
create or replace function public.profiles_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.is_client_session() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.banned_until is distinct from old.banned_until
     or new.ban_reason is distinct from old.ban_reason then
    if not public.is_admin() then
      raise exception 'only admins can change roles or bans' using errcode = '42501';
    end if;
    if old.id = auth.uid() then
      raise exception 'admins cannot change their own role or ban' using errcode = '42501';
    end if;
    if old.role = 'admin' then
      raise exception 'admins cannot change another admin' using errcode = '42501';
    end if;
  end if;

  if old.id <> auth.uid()
     and (to_jsonb(new) - array['role', 'banned_until', 'ban_reason', 'updated_at'])
         is distinct from (to_jsonb(old) - array['role', 'banned_until', 'ban_reason', 'updated_at']) then
    raise exception 'admins can only change role and ban of other users' using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- Magazine
-- ---------------------------------------------------------------
do $$ begin
  create type public.article_status as enum ('draft', 'pending', 'published', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.magazine_articles (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique
                  default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
                  check (slug ~ '^[a-z0-9-]{4,80}$'),
  author_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title           text not null default '' check (char_length(title) <= 140),
  excerpt         text not null default '' check (char_length(excerpt) <= 300),
  cover_url       text check (cover_url ~ '^https://'),
  content         jsonb not null default '{"type":"doc","content":[]}'::jsonb,  -- Tiptap JSON, validated by the app
  reading_minutes int not null default 1 check (reading_minutes between 1 and 600),
  tags            text[] not null default '{}' check (cardinality(tags) <= 8),
  status          public.article_status not null default 'draft',
  review_note     text check (char_length(review_note) <= 1000),                 -- admin's note on rejection
  reviewed_by     uuid references public.profiles(id) on delete set null,
  submitted_at    timestamptz,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists magazine_published_idx on public.magazine_articles (published_at desc) where status = 'published';
create index if not exists magazine_author_idx    on public.magazine_articles (author_id, updated_at desc);
create index if not exists magazine_pending_idx   on public.magazine_articles (submitted_at) where status = 'pending';

drop trigger if exists magazine_touch on public.magazine_articles;
create trigger magazine_touch before update on public.magazine_articles
  for each row execute function public.touch_updated_at();

-- Authors can only move their articles between draft and pending; admins publish and reject.
create or replace function public.magazine_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_client_session() and not public.is_admin() then
    if new.status not in ('draft', 'pending') then
      raise exception 'only admins can publish or reject articles' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' then
      new.review_note  := null;
      new.reviewed_by  := null;
      new.published_at := null;
    else
      new.author_id    := old.author_id;
      new.slug         := old.slug;
      new.review_note  := old.review_note;
      new.reviewed_by  := old.reviewed_by;
      new.published_at := old.published_at;
    end if;
  end if;

  -- Timestamps and reviewer, whoever makes the change
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    new.submitted_at := now();
  end if;
  if new.status in ('published', 'rejected') and (tg_op = 'INSERT' or old.status <> new.status) then
    new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  if new.status = 'published' then
    new.review_note := null;
  end if;
  return new;
end $$;

drop trigger if exists magazine_guard on public.magazine_articles;
create trigger magazine_guard before insert or update on public.magazine_articles
  for each row execute function public.magazine_guard();

alter table public.magazine_articles enable row level security;

drop policy if exists "read published or own articles" on public.magazine_articles;
drop policy if exists "authors insert own articles"    on public.magazine_articles;
drop policy if exists "authors update own articles"    on public.magazine_articles;
drop policy if exists "authors delete own drafts"      on public.magazine_articles;
drop policy if exists "admins manage articles"         on public.magazine_articles;

create policy "read published or own articles" on public.magazine_articles for select
  using (status = 'published' or author_id = auth.uid() or public.is_admin());
create policy "authors insert own articles" on public.magazine_articles for insert
  with check (author_id = auth.uid() and public.is_author());
create policy "authors update own articles" on public.magazine_articles for update
  using (author_id = auth.uid() and public.is_author())
  with check (author_id = auth.uid());
create policy "authors delete own drafts" on public.magazine_articles for delete
  using (author_id = auth.uid() and status <> 'published');
create policy "admins manage articles" on public.magazine_articles for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- Reports (the table exists since 0001): reasons, details, handling
-- ---------------------------------------------------------------
alter table public.reports
  add column if not exists details    text check (char_length(details) <= 1000),
  add column if not exists article_id uuid references public.magazine_articles(id) on delete cascade,
  add column if not exists handled_by uuid references public.profiles(id) on delete set null,
  add column if not exists handled_at timestamptz;

alter table public.reports drop constraint if exists reports_reason_known;
alter table public.reports add constraint reports_reason_known
  check (reason in ('spam', 'harassment', 'inappropriate', 'impersonation', 'other')) not valid;
alter table public.reports drop constraint if exists reports_not_self;
alter table public.reports add constraint reports_not_self
  check (user_id is distinct from reporter_id) not valid;

-- One open report per reporter per account
create unique index if not exists reports_open_user_unique
  on public.reports (reporter_id, user_id) where status = 'open' and user_id is not null;
create index if not exists reports_open_idx on public.reports (created_at) where status = 'open';

drop policy if exists "file reports"           on public.reports;
drop policy if exists "editors read reports"   on public.reports;
drop policy if exists "editors update reports" on public.reports;
drop policy if exists "admins read reports"    on public.reports;
drop policy if exists "admins update reports"  on public.reports;

create policy "file reports" on public.reports for insert
  with check (
    reporter_id = auth.uid()
    and status = 'open' and handled_by is null and handled_at is null
    and not public.is_banned()
  );
create policy "admins read reports" on public.reports for select using (public.is_admin());
create policy "admins update reports" on public.reports for update
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- Admin action log (who banned/deleted/approved what, and why)
-- ---------------------------------------------------------------
create table if not exists public.admin_actions (
  id           bigint generated always as identity primary key,
  admin_id     uuid references public.profiles(id) on delete set null,
  target_id    uuid,          -- no foreign key: the target may have been deleted
  target_label text,          -- @username / article title at the time of the action
  action       text not null check (action in (
                 'ban', 'unban', 'delete_user', 'set_role',
                 'approve_article', 'reject_article', 'unpublish_article', 'dismiss_reports')),
  reason       text check (char_length(reason) <= 1000),
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;
drop policy if exists "admins read log"  on public.admin_actions;
drop policy if exists "admins write log" on public.admin_actions;
create policy "admins read log" on public.admin_actions for select using (public.is_admin());
create policy "admins write log" on public.admin_actions for insert
  with check (public.is_admin() and admin_id = auth.uid());
