-- Plantarium – marketplace changes:
--   1. "Other" plants: a listing can name a plant that isn't in our database (other_species),
--      as long as the seller picks a category. Listings keep their own category column for browsing.
--   2. Contact by phone only: the email option is removed, a phone number is required.

-- ---------- 1. other species ----------
alter table public.market_listings alter column species_id drop not null;
alter table public.market_listings
  add column if not exists category public.species_category,
  add column if not exists other_species text check (char_length(btrim(other_species)) between 2 and 80);

update public.market_listings l
   set category = s.category
  from public.species s
 where s.id = l.species_id and l.category is null;
alter table public.market_listings alter column category set not null;

alter table public.market_listings drop constraint if exists market_listings_species_or_other;
alter table public.market_listings add constraint market_listings_species_or_other
  check ((species_id is not null) <> (other_species is not null));

-- A database species decides the category; free-text names are trimmed.
create or replace function public.market_listings_category() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.species_id is not null then
    select s.category into new.category from public.species s where s.id = new.species_id;
    new.other_species := null;
  else
    new.other_species := nullif(btrim(new.other_species), '');
  end if;
  return new;
end $$;
drop trigger if exists market_listings_category on public.market_listings;
create trigger market_listings_category before insert or update on public.market_listings
  for each row execute function public.market_listings_category();

create index if not exists market_listings_category_idx
  on public.market_listings (category, created_at desc) where status = 'active';

-- ---------- 2. phone only ----------
alter table public.market_listing_contacts drop column if exists email;   -- also drops the phone-or-email check
alter table public.market_listing_contacts drop constraint if exists market_listing_contacts_phone_required;
alter table public.market_listing_contacts add constraint market_listing_contacts_phone_required
  check (phone is not null) not valid;   -- existing rows without a phone are fixed when the seller edits
