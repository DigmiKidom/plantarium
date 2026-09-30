-- Plantarium – data integrity (audit phase 1).
--   1. Multi-step saves in one transaction: listing + phone, post + photos, plant + first watering.
--   2. Market category counts computed in the database (the old way broke past 1,000 listings).
--   3. Reports survive when the reported post/listing is deleted (+ a snapshot of what was reported).
--   4. Missing indexes.
--   5. Tables the site doesn't use yet can't be written from the browser.
--   6. Limits that can't be beaten with parallel requests; 500 plants per user enforced in the database.
--   7. Login/signup/reset rate limiting (used by the server with the service key).

-- ---------------------------------------------------------------
-- 1. One-transaction saves. SECURITY INVOKER: every RLS rule and trigger applies exactly as before.
-- ---------------------------------------------------------------
create or replace function public.save_listing(
  p_id uuid, p_species_id uuid, p_other_species text, p_category text, p_price int, p_size text,
  p_condition text, p_city text, p_description text, p_photos text[], p_phone text, p_whatsapp boolean
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare lid uuid;
begin
  if p_id is null then
    insert into public.market_listings (species_id, other_species, category, price, size, condition, city, description, photos)
    values (p_species_id, p_other_species, p_category, p_price, p_size, p_condition, p_city, p_description, p_photos)
    returning id into lid;
    insert into public.market_listing_contacts (listing_id, phone, whatsapp) values (lid, p_phone, coalesce(p_whatsapp, false));
  else
    update public.market_listings
       set species_id = p_species_id, other_species = p_other_species, category = p_category, price = p_price,
           size = p_size, condition = p_condition, city = p_city, description = p_description, photos = p_photos
     where id = p_id and seller_id = auth.uid()
    returning id into lid;
    if lid is null then
      raise exception 'listing not found' using errcode = 'P0002';
    end if;
    insert into public.market_listing_contacts (listing_id, phone, whatsapp) values (lid, p_phone, coalesce(p_whatsapp, false))
    on conflict (listing_id) do update set phone = excluded.phone, whatsapp = excluded.whatsapp;
  end if;
  return lid;
end $$;
revoke execute on function public.save_listing(uuid, uuid, text, text, int, text, text, text, text, text[], text, boolean) from anon;

create or replace function public.create_post(p_body text, p_type public.post_type, p_species_id uuid, p_media text[])
returns uuid
language plpgsql security invoker set search_path = public as $$
declare pid uuid;
begin
  insert into public.posts (body, type, species_id) values (p_body, coalesce(p_type, 'post'), p_species_id) returning id into pid;
  if coalesce(cardinality(p_media), 0) > 0 then
    insert into public.post_media (post_id, storage_path, sort)
    select pid, m.path, m.ord - 1 from unnest(p_media) with ordinality as m(path, ord);
  end if;
  return pid;
end $$;
revoke execute on function public.create_post(text, public.post_type, uuid, text[]) from anon;

create or replace function public.create_user_plant(
  p_species_id uuid, p_species_name text, p_nickname text, p_location_id uuid, p_pot_cm numeric, p_medium public.medium_type,
  p_acquired_on date, p_water_every_days int, p_notes text, p_photo_url text, p_last_watered_at timestamptz
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare pid uuid;
begin
  insert into public.user_plants (species_id, species_name, nickname, location_id, pot_diameter_cm, medium, acquired_on,
                                  water_every_days, notes, photo_url)
  values (p_species_id, p_species_name, p_nickname, p_location_id, p_pot_cm, p_medium, p_acquired_on,
          p_water_every_days, p_notes, p_photo_url)
  returning id into pid;
  if p_last_watered_at is not null then
    insert into public.care_events (user_plant_id, type, occurred_at) values (pid, 'water', p_last_watered_at);
  end if;
  return pid;
end $$;
revoke execute on function public.create_user_plant(uuid, text, text, uuid, numeric, public.medium_type, date, int, text, text, timestamptz) from anon;

-- ---------------------------------------------------------------
-- 2. Market category counts
-- ---------------------------------------------------------------
create or replace function public.market_category_counts() returns table (category text, n int)
language sql stable security invoker set search_path = public as $$
  select l.category, count(*)::int from public.market_listings l where l.status = 'active' group by l.category;
$$;

-- ---------------------------------------------------------------
-- 3. Reports keep their evidence
-- ---------------------------------------------------------------
-- No cascade from posts/listings: deleting the reported content no longer deletes the report.
alter table public.reports drop constraint if exists reports_post_id_fkey;
alter table public.reports drop constraint if exists reports_listing_id_fkey;
alter table public.reports add column if not exists snapshot jsonb;

-- Before a report is filed: the reported account is taken from the post/listing itself (can't be mis-attributed),
-- and a copy of the content is kept.
create or replace function public.reports_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.posts; l public.market_listings;
begin
  if new.post_id is not null then
    select * into p from public.posts where id = new.post_id;
    if found then
      new.user_id := p.author_id;
      new.snapshot := jsonb_build_object('kind', 'post', 'body', left(coalesce(p.body, ''), 2000),
        'photos', coalesce((select jsonb_agg(storage_path order by sort) from public.post_media where post_id = p.id), '[]'::jsonb));
    end if;
  elsif new.listing_id is not null then
    select * into l from public.market_listings where id = new.listing_id;
    if found then
      new.user_id := l.seller_id;
      new.snapshot := jsonb_build_object('kind', 'listing',
        'name', coalesce((select common_name_he from public.species where id = l.species_id), l.other_species, ''),
        'price', l.price, 'description', left(coalesce(l.description, ''), 2000), 'photos', to_jsonb(l.photos));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists reports_snapshot on public.reports;
create trigger reports_snapshot before insert on public.reports
  for each row execute function public.reports_snapshot();

-- ---------------------------------------------------------------
-- 4. Indexes for the queries and rate limits that run on every write
-- ---------------------------------------------------------------
create index if not exists comments_author_time_idx on public.comments (author_id, created_at desc);
create index if not exists comments_parent_idx on public.comments (parent_id) where parent_id is not null;
create index if not exists posts_author_all_time_idx on public.posts (author_id, created_at desc);
create index if not exists posts_repost_of_idx on public.posts (repost_of) where repost_of is not null;
create index if not exists posts_quote_of_idx on public.posts (quote_of) where quote_of is not null;
create index if not exists reports_post_idx on public.reports (post_id) where post_id is not null;
create index if not exists reports_listing_idx on public.reports (listing_id) where listing_id is not null;
create index if not exists reports_user_idx on public.reports (user_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists market_listings_seller_status_idx on public.market_listings (seller_id, status);

-- ---------------------------------------------------------------
-- 5. Not used by the site yet: read-only from the browser (grant back when a feature needs it)
-- ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'articles', 'article_species', 'gardens', 'care_schedules', 'tasks', 'plant_photos', 'species_problems',
    'bookmarks', 'hashtags', 'post_hashtags', 'topic_follows', 'blocks', 'notifications', 'user_affinity', 'feed_impressions'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------
-- 6. Limits that hold under parallel requests
-- ---------------------------------------------------------------
-- Listing limit: serialize per seller so two parallel inserts can't both pass the count.
create or replace function public.market_listings_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_client_session() and not public.is_admin() then
    if tg_op = 'UPDATE' then
      new.seller_id := old.seller_id;
      if old.status = 'removed' then
        raise exception 'listing was removed by the site team' using errcode = '42501';
      end if;
    end if;
    if new.status = 'removed' then
      raise exception 'only admins can remove listings' using errcode = '42501';
    end if;
    new.removed_reason := case when tg_op = 'UPDATE' then old.removed_reason else null end;
  end if;

  if new.status = 'sold' and (tg_op = 'INSERT' or old.status <> 'sold') then
    new.sold_at := now();
  elsif new.status = 'active' then
    new.sold_at := null;
  end if;

  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    perform pg_advisory_xact_lock(hashtext('market_listings:' || new.seller_id::text));
    if public.active_listing_count(new.seller_id, new.id) >= coalesce(public.listing_limit(new.seller_id), 5) then
      raise exception 'listing limit reached' using errcode = 'P0413';
    end if;
  end if;
  return new;
end $$;

-- 500 plants per user (was only checked by the site).
create or replace function public.user_plants_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('user_plants:' || new.user_id::text));
  if (select count(*) from public.user_plants where user_id = new.user_id) >= 500 then
    raise exception 'plant limit reached' using errcode = 'P0413';
  end if;
  return new;
end $$;
drop trigger if exists user_plants_limit on public.user_plants;
create trigger user_plants_limit before insert on public.user_plants
  for each row execute function public.user_plants_limit();

-- ---------------------------------------------------------------
-- 7. Rate limiting for login / signup / password reset
-- ---------------------------------------------------------------
create table if not exists public.auth_attempts (
  key        text not null,          -- e.g. 'login:ip:1.2.3.4', 'login:email:a@b.c'
  created_at timestamptz not null default now()
);
create index if not exists auth_attempts_key_time_idx on public.auth_attempts (key, created_at desc);
alter table public.auth_attempts enable row level security;   -- no policies: only the function below touches it
revoke all on public.auth_attempts from anon, authenticated;

-- Records one attempt for `p_key` and says whether it is still within `p_max` per `p_window`.
-- Only the server (service role) may call it.
create or replace function public.auth_rate_check(p_key text, p_max int, p_window interval) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext('auth_attempts:' || p_key));
  select count(*) into n from public.auth_attempts where key = p_key and created_at > now() - p_window;
  if n >= p_max then
    return false;
  end if;
  insert into public.auth_attempts (key) values (p_key);
  -- keep the table small
  if random() < 0.01 then
    delete from public.auth_attempts where created_at < now() - interval '2 days';
  end if;
  return true;
end $$;
revoke execute on function public.auth_rate_check(text, int, interval) from public, anon, authenticated;
grant execute on function public.auth_rate_check(text, int, interval) to service_role;
