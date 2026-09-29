-- Plantarium – "My plants": one personal list of plants, grouped by the user's own places
-- (room / balcony / garden + which way the window faces), with care logs and photos.

-- ---------- places ----------
-- A place no longer needs a garden: the app shows one flat list of the user's places.
alter table public.locations alter column garden_id drop not null;
alter table public.locations add column if not exists kind text not null default 'room';
alter table public.locations add column if not exists direction text;
alter table public.locations drop constraint if exists locations_kind_check;
alter table public.locations add constraint locations_kind_check check (kind in ('room', 'balcony', 'garden'));
alter table public.locations drop constraint if exists locations_direction_check;
alter table public.locations add constraint locations_direction_check
  check (direction is null or direction in ('n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'));
alter table public.locations drop constraint if exists locations_name_len;
alter table public.locations add constraint locations_name_len check (char_length(btrim(name)) between 1 and 40) not valid;
create index if not exists locations_user_idx on public.locations (user_id, sort);

-- ---------- user plants ----------
alter table public.user_plants add column if not exists species_name text;   -- plants that aren't in the database
alter table public.user_plants add column if not exists photo_url text;
alter table public.user_plants add column if not exists water_every_days int;  -- the user's own rhythm (overrides the estimate)
alter table public.user_plants drop constraint if exists user_plants_species_name_len;
alter table public.user_plants add constraint user_plants_species_name_len
  check (species_name is null or char_length(btrim(species_name)) between 2 and 80) not valid;
alter table public.user_plants drop constraint if exists user_plants_nickname_len;
alter table public.user_plants add constraint user_plants_nickname_len
  check (nickname is null or char_length(nickname) <= 60) not valid;
alter table public.user_plants drop constraint if exists user_plants_notes_len;
alter table public.user_plants add constraint user_plants_notes_len
  check (notes is null or char_length(notes) <= 2000) not valid;
alter table public.user_plants drop constraint if exists user_plants_photo_url_https;
alter table public.user_plants add constraint user_plants_photo_url_https
  check (photo_url is null or (photo_url ~ '^https://' and char_length(photo_url) <= 500)) not valid;
alter table public.user_plants drop constraint if exists user_plants_water_every;
alter table public.user_plants add constraint user_plants_water_every
  check (water_every_days is null or water_every_days between 1 and 90) not valid;
alter table public.user_plants drop constraint if exists user_plants_pot_size;
alter table public.user_plants add constraint user_plants_pot_size
  check (pot_diameter_cm is null or pot_diameter_cm between 3 and 300) not valid;

alter table public.care_events drop constraint if exists care_events_note_len;
alter table public.care_events add constraint care_events_note_len check (note is null or char_length(note) <= 1000) not valid;

-- ---------- ownership guard ----------
-- RLS already limits every personal row to user_id = auth.uid(). This also makes sure the row
-- points at the user's OWN plant / place (not someone else's public plant).
-- Not security definer: the lookups run under the caller's RLS, which only shows their own rows.
create or replace function public.personal_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.is_client_session() then
    return new;
  end if;
  if tg_table_name = 'user_plants' then
    if new.location_id is not null and not exists (
      select 1 from public.locations l where l.id = new.location_id and l.user_id = new.user_id
    ) then
      raise exception 'location belongs to another user' using errcode = '42501';
    end if;
  elsif tg_table_name = 'locations' then
    if new.garden_id is not null and not exists (
      select 1 from public.gardens g where g.id = new.garden_id and g.user_id = new.user_id
    ) then
      raise exception 'garden belongs to another user' using errcode = '42501';
    end if;
  elsif not exists (
    select 1 from public.user_plants p where p.id = new.user_plant_id and p.user_id = new.user_id
  ) then
    raise exception 'plant belongs to another user' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['user_plants', 'locations', 'care_events', 'care_schedules', 'tasks', 'plant_photos'] loop
    execute format('drop trigger if exists %1$s_personal_guard on public.%1$I', t);
    execute format(
      'create trigger %1$s_personal_guard before insert or update on public.%1$I for each row execute function public.personal_guard()', t);
  end loop;
end $$;

-- Handy for the app: when was each plant last watered / fertilized.
create or replace view public.user_plant_last_care with (security_invoker = true) as
  select user_plant_id,
         max(occurred_at) filter (where type = 'water')     as last_water_at,
         max(occurred_at) filter (where type = 'fertilize') as last_fertilize_at
    from public.care_events
   group by user_plant_id;
