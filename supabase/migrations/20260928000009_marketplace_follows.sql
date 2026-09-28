-- Plantarium – second-hand plant marketplace, account plans (listing limits), followers polish.
--
-- Marketplace rules (enforced here, not only in the app):
--   * signed-in, non-banned users can list a plant; the plant must be a species from our database
--   * price in whole shekels (0 = free to a good home), 1–6 photos, at least one way to contact
--   * free plan: up to 5 active listings at a time (sold/removed ones don't count); plus plan: 50
--   * contact details are readable only by signed-in users (keeps phone numbers away from scrapers)
--   * only admins can remove a listing for moderation; sellers can mark sold or delete their own

-- ---------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------
alter table public.profiles
  add column if not exists plan text not null default 'free' check (plan in ('free', 'plus'));

-- Role, plan and ban fields can only be changed by an admin, never on yourself or on another admin.
create or replace function public.profiles_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.is_client_session() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.plan is distinct from old.plan
     or new.banned_until is distinct from old.banned_until
     or new.ban_reason is distinct from old.ban_reason then
    if not public.is_admin() then
      raise exception 'only admins can change roles, plans or bans' using errcode = '42501';
    end if;
    if old.id = auth.uid() then
      raise exception 'admins cannot change their own role, plan or ban' using errcode = '42501';
    end if;
    if old.role = 'admin' then
      raise exception 'admins cannot change another admin' using errcode = '42501';
    end if;
  end if;

  if old.id <> auth.uid()
     and (to_jsonb(new) - array['role', 'plan', 'banned_until', 'ban_reason', 'updated_at'])
         is distinct from (to_jsonb(old) - array['role', 'plan', 'banned_until', 'ban_reason', 'updated_at']) then
    raise exception 'admins can only change role, plan and ban of other users' using errcode = '42501';
  end if;

  return new;
end $$;

create or replace function public.listing_limit(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select case
    when p.role = 'admin' then 1000
    when p.plan = 'plus' then 50
    else 5
  end
  from public.profiles p where p.id = uid;
$$;

-- ---------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------
do $$ begin
  create type public.listing_status as enum ('active', 'sold', 'removed');
exception when duplicate_object then null; end $$;

create table if not exists public.market_listings (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  species_id   uuid not null references public.species(id) on delete restrict,
  price        int not null check (price between 0 and 100000),            -- ₪, 0 = free
  size         text check (size in ('small', 'medium', 'large', 'xl')),
  city         text check (char_length(city) <= 60),
  description  text check (char_length(description) <= 2000),
  photos       text[] not null check (cardinality(photos) between 1 and 6),
  status       public.listing_status not null default 'active',
  removed_reason text check (char_length(removed_reason) <= 500),          -- admin moderation note
  sold_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists market_listings_active_idx  on public.market_listings (species_id, created_at desc) where status = 'active';
create index if not exists market_listings_seller_idx  on public.market_listings (seller_id, created_at desc);
create index if not exists market_listings_created_idx on public.market_listings (created_at desc) where status = 'active';

drop trigger if exists market_listings_touch on public.market_listings;
create trigger market_listings_touch before update on public.market_listings
  for each row execute function public.touch_updated_at();

create or replace function public.active_listing_count(uid uuid, except_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.market_listings
   where seller_id = uid and status = 'active' and id <> except_id;
$$;

-- Sellers: can't change seller, can't set/undo "removed"; limit of active listings per plan.
-- Not security definer: is_client_session() must see the caller's role.
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

  -- Limit: counted when a listing becomes active
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    if public.active_listing_count(new.seller_id, new.id) >= coalesce(public.listing_limit(new.seller_id), 5) then
      raise exception 'listing limit reached' using errcode = 'P0413';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists market_listings_guard on public.market_listings;
create trigger market_listings_guard before insert or update on public.market_listings
  for each row execute function public.market_listings_guard();

-- Contact details live in their own table so they can have stricter read rules.
create table if not exists public.market_listing_contacts (
  listing_id uuid primary key references public.market_listings(id) on delete cascade,
  phone      text check (phone ~ '^\+?[0-9][0-9 -]{6,18}$'),
  whatsapp   boolean not null default false,
  email      text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  check (phone is not null or email is not null)
);

create or replace function public.owns_listing(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.market_listings where id = lid and seller_id = auth.uid());
$$;
create or replace function public.is_active_listing(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.market_listings where id = lid and status = 'active');
$$;

alter table public.market_listings         enable row level security;
alter table public.market_listing_contacts enable row level security;

drop policy if exists "read active or own listings" on public.market_listings;
drop policy if exists "sell as yourself"            on public.market_listings;
drop policy if exists "sellers update own"          on public.market_listings;
drop policy if exists "sellers delete own"          on public.market_listings;
drop policy if exists "admins manage listings"      on public.market_listings;
create policy "read active or own listings" on public.market_listings for select
  using (status = 'active' or seller_id = auth.uid() or public.is_admin());
create policy "sell as yourself" on public.market_listings for insert
  with check (seller_id = auth.uid() and not public.is_banned());
create policy "sellers update own" on public.market_listings for update
  using (seller_id = auth.uid() and not public.is_banned()) with check (seller_id = auth.uid());
create policy "sellers delete own" on public.market_listings for delete
  using (seller_id = auth.uid());
create policy "admins manage listings" on public.market_listings for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "signed-in read contacts" on public.market_listing_contacts;
drop policy if exists "sellers write contacts"  on public.market_listing_contacts;
drop policy if exists "admins read contacts"    on public.market_listing_contacts;
create policy "signed-in read contacts" on public.market_listing_contacts for select
  using (auth.uid() is not null and (public.is_active_listing(listing_id) or public.owns_listing(listing_id)));
create policy "admins read contacts" on public.market_listing_contacts for select
  using (public.is_admin());
create policy "sellers write contacts" on public.market_listing_contacts for all
  using (public.owns_listing(listing_id)) with check (public.owns_listing(listing_id));

-- Active listings per species, for the category → species browser (RLS of the caller applies).
create or replace view public.market_species_counts with (security_invoker = true) as
  select s.id as species_id, s.slug, s.common_name_he, s.scientific_name, s.category,
         count(l.id)::int as active_count, min(l.price) as min_price
    from public.species s
    join public.market_listings l on l.species_id = s.id and l.status = 'active'
   group by s.id;

-- ---------------------------------------------------------------
-- Reports on listings, admin log actions
-- ---------------------------------------------------------------
alter table public.reports
  add column if not exists listing_id uuid references public.market_listings(id) on delete cascade;

-- One open report per reporter per account and per listing
drop index if exists public.reports_open_user_unique;
create unique index if not exists reports_open_target_unique
  on public.reports (reporter_id, user_id, coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'open' and user_id is not null;

alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in (
  'ban', 'unban', 'delete_user', 'set_role', 'set_plan',
  'approve_article', 'reject_article', 'unpublish_article', 'dismiss_reports', 'delete_comment',
  'remove_listing'));

-- ---------------------------------------------------------------
-- Follows: banned users can't follow
-- ---------------------------------------------------------------
drop policy if exists "follow as self" on public.follows;
create policy "follow as self" on public.follows for insert
  with check (follower_id = auth.uid() and not public.is_banned());
