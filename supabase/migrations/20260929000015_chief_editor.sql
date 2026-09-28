-- Plantarium – chief editor role (role value 'editor', shown as "עורך/ת ראשי/ת").
-- A chief editor can do everything an author can, and also:
--   * approve / reject / unpublish magazine articles
--   * approve / reject plant suggestions and edit the plant database (info + photos)
-- Everything else (users, bans, reports, plans) stays with admins.

create or replace function public.is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role in ('editor', 'admin')
       and (banned_until is null or banned_until <= now())
  );
$$;

-- ---------- magazine articles ----------
create or replace function public.magazine_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_client_session() and not public.is_reviewer() then
    if new.status not in ('draft', 'pending') then
      raise exception 'only chief editors and admins can publish or reject articles' using errcode = '42501';
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

drop policy if exists "read published or own articles" on public.magazine_articles;
create policy "read published or own articles" on public.magazine_articles for select
  using (status = 'published' or author_id = auth.uid() or public.is_reviewer());
drop policy if exists "admins manage articles"    on public.magazine_articles;
drop policy if exists "reviewers manage articles" on public.magazine_articles;
create policy "reviewers manage articles" on public.magazine_articles for all
  using (public.is_reviewer()) with check (public.is_reviewer());

-- ---------- plant suggestions ----------
create or replace function public.species_suggestions_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_client_session() and not public.is_reviewer() then
    if tg_op = 'UPDATE' and old.status <> 'pending' then
      raise exception 'suggestion was already reviewed' using errcode = '42501';
    end if;
    if new.status <> 'pending' then
      raise exception 'only chief editors and admins review suggestions' using errcode = '42501';
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

drop policy if exists "read own or admin"             on public.species_suggestions;
drop policy if exists "read own or reviewer"          on public.species_suggestions;
create policy "read own or reviewer" on public.species_suggestions for select
  using (author_id = auth.uid() or public.is_reviewer());
drop policy if exists "admins manage suggestions"     on public.species_suggestions;
drop policy if exists "reviewers manage suggestions"  on public.species_suggestions;
create policy "reviewers manage suggestions" on public.species_suggestions for all
  using (public.is_reviewer()) with check (public.is_reviewer());

-- ---------- plant database ----------
do $$
declare t text;
begin
  foreach t in array array['species', 'species_care', 'species_images', 'species_problems'] loop
    execute format('drop policy if exists "admins write %1$s" on public.%1$I', t);
    execute format('drop policy if exists "reviewers write %1$s" on public.%1$I', t);
    execute format('create policy "reviewers write %1$s" on public.%1$I for all using (public.is_reviewer()) with check (public.is_reviewer())', t);
  end loop;
end $$;

-- ---------- action log: chief editors log their reviews (only admins read the log) ----------
drop policy if exists "admins write log"    on public.admin_actions;
drop policy if exists "reviewers write log" on public.admin_actions;
create policy "reviewers write log" on public.admin_actions for insert
  with check (public.is_reviewer() and admin_id = auth.uid());
