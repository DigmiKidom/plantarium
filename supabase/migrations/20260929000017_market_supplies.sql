-- Plantarium – marketplace: not only plants. Pots, soil, stones, tools, irrigation, lighting, seeds and more.
-- Plant listings keep the species categories; supply listings have a free-text item name (other_species)
-- and never point at a species. Sellers can say what condition the item is in.

alter table public.market_listings alter column category type text using category::text;

alter table public.market_listings drop constraint if exists market_listings_category_check;
alter table public.market_listings add constraint market_listings_category_check check (category in (
  -- plants (same keys as species categories)
  'houseplant', 'succulent', 'herb', 'vegetable', 'fruit_tree', 'garden',
  -- supplies
  'pots', 'soil', 'stones', 'tools', 'irrigation', 'fertilizers', 'lighting', 'seeds', 'decor', 'supplies_other'
));

alter table public.market_listings drop constraint if exists market_listings_supplies_no_species;
alter table public.market_listings add constraint market_listings_supplies_no_species check (
  category in ('houseplant', 'succulent', 'herb', 'vegetable', 'fruit_tree', 'garden') or species_id is null
);

alter table public.market_listings add column if not exists condition text;
alter table public.market_listings drop constraint if exists market_listings_condition_check;
alter table public.market_listings add constraint market_listings_condition_check
  check (condition is null or condition in ('new', 'like_new', 'used'));

-- A database species still decides the category of a plant listing – but a supplies listing can't name a species.
create or replace function public.market_listings_category() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.species_id is not null then
    if new.category is not null and new.category not in ('houseplant', 'succulent', 'herb', 'vegetable', 'fruit_tree', 'garden') then
      raise exception 'supplies listings can''t be linked to a plant species' using errcode = '23514';
    end if;
    select s.category::text into new.category from public.species s where s.id = new.species_id;
    new.other_species := null;
  else
    new.other_species := nullif(btrim(new.other_species), '');
  end if;
  return new;
end $$;
