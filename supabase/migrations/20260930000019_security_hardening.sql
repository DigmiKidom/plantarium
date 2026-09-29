-- Plantarium – security hardening (audit 2026-09-29, phase 0).
--   1. Private profile fields (ban reason, settings, location) are no longer readable by other users.
--   2. Banned users can't create or edit anything (until now some UPDATE rules skipped the check).
--   3. Photo URLs must point at the owner's own folder (profiles/<id>/, plants/<id>/, market/<id>/).
--   4. Seller phone numbers: no bulk reading – one listing at a time through a function, max 100 listings a day.

-- ---------------------------------------------------------------
-- 1. Private profile columns
-- ---------------------------------------------------------------
-- Column privileges: every profile column stays public except the private ones below.
-- NOTE: a column added to profiles later is NOT readable by the site until it's granted here (or in a new migration).
do $$
declare cols text;
begin
  revoke select on public.profiles from anon, authenticated;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name not in ('ban_reason', 'settings', 'lat', 'lon');
  execute format('grant select (%s) on public.profiles to anon, authenticated', cols);
end $$;

-- The signed-in user's own settings (theme etc.).
create or replace function public.my_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(settings, '{}'::jsonb) from public.profiles where id = auth.uid();
$$;
revoke execute on function public.my_settings() from anon;

-- Ban reasons, for the admin users list only.
create or replace function public.admin_ban_reasons(ids uuid[]) returns table (id uuid, ban_reason text)
language sql stable security definer set search_path = public as $$
  select p.id, p.ban_reason from public.profiles p where public.is_admin() and p.id = any(ids);
$$;
revoke execute on function public.admin_ban_reasons(uuid[]) from anon;

-- ---------------------------------------------------------------
-- 2. Banned users can't write
-- ---------------------------------------------------------------
-- Restrictive policies are AND-ed with the existing ones. (select …) = evaluated once per statement.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'posts', 'post_media', 'comments', 'reactions', 'follows', 'reports',
    'market_listings', 'market_listing_contacts', 'magazine_articles', 'magazine_comments', 'magazine_likes',
    'species_suggestions'
  ] loop
    execute format('drop policy if exists "banned users can''t insert" on public.%I', t);
    execute format('drop policy if exists "banned users can''t update" on public.%I', t);
    execute format('create policy "banned users can''t insert" on public.%I as restrictive for insert to authenticated
                      with check ((select not public.is_banned()))', t);
    execute format('create policy "banned users can''t update" on public.%I as restrictive for update to authenticated
                      using ((select not public.is_banned()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------
-- 3. Photos must be the owner's own uploads
-- ---------------------------------------------------------------
-- https://<images host>/<area>/<owner id>/<file> – the host is checked by the site's Content-Security-Policy.
create or replace function public.is_own_image(url text, area text, owner uuid) returns boolean
language sql immutable as $$
  select url is null or (
    url ~ ('^https://[^?#\s]+/' || area || '/' || owner::text || '/[A-Za-z0-9_.-]+$')
    and position('..' in url) = 0
    and char_length(url) <= 500
  );
$$;
create or replace function public.are_own_images(urls text[], area text, owner uuid) returns boolean
language sql immutable as $$
  select coalesce(bool_and(public.is_own_image(u, area, owner)), true) from unnest(urls) u;
$$;

alter table public.profiles drop constraint if exists profiles_avatar_own;
alter table public.profiles add constraint profiles_avatar_own
  check (public.is_own_image(avatar_url, 'profiles', id)) not valid;
alter table public.user_plants drop constraint if exists user_plants_photo_own;
alter table public.user_plants add constraint user_plants_photo_own
  check (public.is_own_image(photo_url, 'plants', user_id)) not valid;
alter table public.market_listings drop constraint if exists market_listings_photos_own;
alter table public.market_listings add constraint market_listings_photos_own
  check (public.are_own_images(photos, 'market', seller_id)) not valid;

-- ---------------------------------------------------------------
-- 4. Seller phone numbers
-- ---------------------------------------------------------------
drop policy if exists "signed-in read contacts" on public.market_listing_contacts;
-- (sellers still read/write their own; admins still read all)

create table if not exists public.contact_reveals (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  day        date not null default current_date,
  primary key (user_id, listing_id, day)
);
alter table public.contact_reveals enable row level security;   -- no policies: only the function below writes it
create index if not exists contact_reveals_user_day_idx on public.contact_reveals (user_id, day);

create or replace function public.get_listing_contact(lid uuid) returns table (phone text, whatsapp boolean)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l public.market_listings;
begin
  if uid is null or public.is_banned(uid) then
    return;
  end if;
  select * into l from public.market_listings where id = lid;
  if not found then
    return;
  end if;
  if l.seller_id <> uid and not public.is_admin() then
    if l.status <> 'active' then
      return;
    end if;
    -- Viewing the same listing again the same day doesn't count.
    if not exists (select 1 from public.contact_reveals r where r.user_id = uid and r.listing_id = lid and r.day = current_date) then
      if (select count(*) from public.contact_reveals r where r.user_id = uid and r.day = current_date) >= 100 then
        raise exception 'contact reveal limit reached' using errcode = 'P0429';
      end if;
      insert into public.contact_reveals (user_id, listing_id) values (uid, lid) on conflict do nothing;
    end if;
  end if;
  return query select c.phone, c.whatsapp from public.market_listing_contacts c where c.listing_id = lid;
end $$;
revoke execute on function public.get_listing_contact(uuid) from anon;
