-- Plantarium – plant database management:
--   * only admins change the plant database (species, care, photos, problems)
--   * authors can suggest a new plant; admins review, edit and approve it into the database

-- ---------------------------------------------------------------
-- Admin-only writes on the plant database
-- ---------------------------------------------------------------
drop policy if exists "editors write species" on public.species;
drop policy if exists "admins write species"  on public.species;
create policy "admins write species" on public.species for all
  using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['species_care', 'species_images', 'species_problems'] loop
    execute format('drop policy if exists "editors write %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admins write %1$s" on public.%1$I', t);
    execute format('create policy "admins write %1$s" on public.%1$I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Photos of a species are shown in order
alter table public.species_images add column if not exists created_at timestamptz not null default now();

-- ---------------------------------------------------------------
-- Suggestions from authors
-- ---------------------------------------------------------------
do $$ begin
  create type public.suggestion_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.species_suggestions (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  common_name_he  text not null check (char_length(btrim(common_name_he)) between 2 and 80),
  scientific_name text not null check (char_length(btrim(scientific_name)) between 3 and 120),
  category        public.species_category not null,
  data            jsonb not null default '{}'::jsonb,   -- the rest of the proposed info (care etc.), validated by the app
  photos          text[] not null default '{}' check (cardinality(photos) <= 6),
  status          public.suggestion_status not null default 'pending',
  review_note     text check (char_length(review_note) <= 1000),
  reviewed_by     uuid references public.profiles(id) on delete set null,
  species_id      uuid references public.species(id) on delete set null,  -- set when approved
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists species_suggestions_pending_idx on public.species_suggestions (created_at) where status = 'pending';
create index if not exists species_suggestions_author_idx  on public.species_suggestions (author_id, created_at desc);

drop trigger if exists species_suggestions_touch on public.species_suggestions;
create trigger species_suggestions_touch before update on public.species_suggestions
  for each row execute function public.touch_updated_at();

-- Authors: only pending suggestions, no review fields; at most 20 waiting at a time.
create or replace function public.species_suggestions_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_client_session() and not public.is_admin() then
    if tg_op = 'UPDATE' and old.status <> 'pending' then
      raise exception 'suggestion was already reviewed' using errcode = '42501';
    end if;
    if new.status <> 'pending' then
      raise exception 'only admins review suggestions' using errcode = '42501';
    end if;
    new.review_note := case when tg_op = 'UPDATE' then old.review_note else null end;
    new.reviewed_by := null;
    new.species_id  := null;
    if tg_op = 'UPDATE' then new.author_id := old.author_id; end if;
    if tg_op = 'INSERT' and (select count(*) from public.species_suggestions
                              where author_id = new.author_id and status = 'pending') >= 20 then
      raise exception 'too many pending suggestions' using errcode = 'P0413';
    end if;
  end if;
  if new.status in ('approved', 'rejected') and (tg_op = 'INSERT' or old.status <> new.status) then
    new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
  end if;
  return new;
end $$;
drop trigger if exists species_suggestions_guard on public.species_suggestions;
create trigger species_suggestions_guard before insert or update on public.species_suggestions
  for each row execute function public.species_suggestions_guard();

alter table public.species_suggestions enable row level security;
drop policy if exists "authors suggest"             on public.species_suggestions;
drop policy if exists "read own or admin"           on public.species_suggestions;
drop policy if exists "authors edit own pending"    on public.species_suggestions;
drop policy if exists "authors delete own pending"  on public.species_suggestions;
drop policy if exists "admins manage suggestions"   on public.species_suggestions;
create policy "authors suggest" on public.species_suggestions for insert
  with check (author_id = auth.uid() and public.is_author());
create policy "read own or admin" on public.species_suggestions for select
  using (author_id = auth.uid() or public.is_admin());
create policy "authors edit own pending" on public.species_suggestions for update
  using (author_id = auth.uid() and status = 'pending' and public.is_author())
  with check (author_id = auth.uid());
create policy "authors delete own pending" on public.species_suggestions for delete
  using (author_id = auth.uid() and status = 'pending');
create policy "admins manage suggestions" on public.species_suggestions for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- Admin log actions
-- ---------------------------------------------------------------
alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in (
  'ban', 'unban', 'delete_user', 'set_role', 'set_plan',
  'approve_article', 'reject_article', 'unpublish_article', 'dismiss_reports', 'delete_comment',
  'remove_listing', 'delete_post',
  'edit_species', 'approve_species', 'reject_species'));
