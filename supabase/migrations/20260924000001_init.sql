-- Plantarium – core schema
-- Three areas: Knowledge (public), Personal (private per user), Social (feed).

-- Supabase keeps extensions in the "extensions" schema.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------
create type light_level  as enum ('low','medium','bright_indirect','direct');
create type difficulty   as enum ('easy','moderate','hard');
create type species_category as enum ('houseplant','succulent','herb','vegetable','fruit_tree','garden');
create type growth_rate  as enum ('slow','moderate','fast');
create type medium_type  as enum ('soil','aroid_mix','cactus_mix','orchid_bark','leca','coco_coir','perlite_mix','sphagnum','water','hydroponic','none','other');
create type care_type    as enum ('water','fertilize','repot','prune','mist','rotate','treat','clean','harvest','other');
create type event_type   as enum ('water','fertilize','repot','prune','mist','rotate','treat','clean','harvest','measure','photo','note','other');
create type task_status  as enum ('pending','done','skipped','snoozed');
create type plant_status as enum ('thriving','ok','struggling','dormant','dead','given_away');
create type visibility   as enum ('private','followers','public');
create type post_type    as enum ('post','plant_update','question','share','repost');
create type user_role    as enum ('user','editor','admin');

-- updated_at helper
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name  text not null default '',
  bio           text,
  avatar_url    text,
  role          user_role not null default 'user',
  locale        text not null default 'he',
  timezone      text not null default 'Asia/Jerusalem',
  units         text not null default 'metric',
  city          text,
  lat           numeric(8,5),
  lon           numeric(8,5),
  is_private    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile row on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('editor','admin'));
$$;

-- ---------------------------------------------------------------
-- Knowledge
-- ---------------------------------------------------------------
create table public.species (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9-]+$'),
  scientific_name  text not null unique,
  common_name_he   text not null,
  other_names_he   text[] not null default '{}',
  common_name_en   text,
  family           text,
  category         species_category not null,
  difficulty       difficulty not null,
  summary_he       text,
  native_region_he text,
  growth_rate      growth_rate,
  max_height_cm    int,
  is_toxic_pets    boolean,           -- null = not verified
  tags             text[] not null default '{}',
  search_text      text not null default '',   -- normalized names, see 0003_search
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger species_touch before update on public.species
  for each row execute function public.touch_updated_at();
create index species_category_idx on public.species (category);
create index species_tags_idx on public.species using gin (tags);

create table public.species_care (
  species_id               uuid primary key references public.species(id) on delete cascade,
  light                    light_level not null,
  light_notes_he           text,
  water_interval_min_days  int not null check (water_interval_min_days > 0),
  water_interval_max_days  int not null,
  water_notes_he           text,
  humidity_min             int check (humidity_min between 0 and 100),
  humidity_max             int check (humidity_max between 0 and 100),
  temp_min_c               numeric(4,1),
  temp_max_c               numeric(4,1),
  fertilize_interval_days  int,
  fertilize_season         text,
  medium                   medium_type[] not null default '{soil}',
  medium_notes_he          text,
  pruning_he               text,
  propagation_he           text,
  seasonal                 jsonb not null default '{}'::jsonb,  -- {"winter":{"water_factor":1.6},...}
  check (water_interval_max_days >= water_interval_min_days)
);

create table public.species_problems (
  id          uuid primary key default gen_random_uuid(),
  species_id  uuid references public.species(id) on delete cascade,  -- null = general problem
  kind        text not null check (kind in ('pest','disease','care')),
  title_he    text not null,
  symptoms_he text,
  cause_he    text,
  fix_he      text,
  created_at  timestamptz not null default now()
);
create index species_problems_species_idx on public.species_problems (species_id);

create table public.species_images (
  id           uuid primary key default gen_random_uuid(),
  species_id   uuid not null references public.species(id) on delete cascade,
  storage_path text not null,
  alt          text,
  credit       text,
  sort         int not null default 0
);
create index species_images_species_idx on public.species_images (species_id, sort);

create table public.articles (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title            text not null,
  excerpt          text,
  cover_path       text,
  body_mdx_path    text,              -- content/blog/<slug>.mdx
  author_id        uuid references public.profiles(id) on delete set null,
  reading_minutes  int,
  tags             text[] not null default '{}',
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index articles_published_idx on public.articles (published_at desc);

create table public.article_species (
  article_id uuid references public.articles(id) on delete cascade,
  species_id uuid references public.species(id) on delete cascade,
  primary key (article_id, species_id)
);
create index article_species_species_idx on public.article_species (species_id);

-- ---------------------------------------------------------------
-- Personal: gardens → locations → user plants → care
-- ---------------------------------------------------------------
create table public.gardens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null,
  kind        text not null default 'indoor' check (kind in ('indoor','outdoor','mixed')),
  visibility  visibility not null default 'private',
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index gardens_user_idx on public.gardens (user_id);

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  garden_id   uuid not null references public.gardens(id) on delete cascade,
  parent_id   uuid references public.locations(id) on delete cascade,
  name        text not null,
  light       light_level,
  is_outdoor  boolean not null default false,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index locations_garden_idx on public.locations (garden_id);

create table public.user_plants (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  species_id       uuid references public.species(id) on delete set null,
  location_id      uuid references public.locations(id) on delete set null,
  nickname         text,
  cover_photo_id   uuid,
  acquired_on      date,
  source           text,
  pot_diameter_cm  numeric(5,1),
  pot_material     text,
  has_drainage     boolean,
  height_cm        numeric(6,1),
  medium           medium_type,
  light            light_level,
  status           plant_status not null default 'ok',
  visibility       visibility not null default 'private',
  notes            text,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger user_plants_touch before update on public.user_plants
  for each row execute function public.touch_updated_at();
create index user_plants_user_loc_idx on public.user_plants (user_id, location_id) where archived_at is null;
create index user_plants_species_idx on public.user_plants (species_id);

create table public.care_schedules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  user_plant_id  uuid not null references public.user_plants(id) on delete cascade,
  care_type      care_type not null,
  interval_days  int not null check (interval_days > 0),
  is_adaptive    boolean not null default false,
  last_done_at   timestamptz,
  next_due_at    timestamptz,
  enabled        boolean not null default true,
  unique (user_plant_id, care_type)
);
create index care_schedules_due_idx on public.care_schedules (next_due_at) where enabled;

create table public.care_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  user_plant_id  uuid not null references public.user_plants(id) on delete cascade,
  type           event_type not null,
  occurred_at    timestamptz not null default now(),
  amount_ml      int,
  product        text,
  details        jsonb not null default '{}'::jsonb,
  note           text,
  source         text not null default 'manual' check (source in ('manual','task','bulk')),
  idempotency_key text unique,
  created_at     timestamptz not null default now()
);
create index care_events_plant_time_idx on public.care_events (user_plant_id, occurred_at desc);
create index care_events_user_time_idx on public.care_events (user_id, occurred_at desc);

create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  user_plant_id      uuid not null references public.user_plants(id) on delete cascade,
  schedule_id        uuid references public.care_schedules(id) on delete cascade,
  care_type          care_type not null,
  title              text,
  due_on             date not null,
  status             task_status not null default 'pending',
  snoozed_until      date,
  completed_event_id uuid references public.care_events(id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (schedule_id, due_on)
);
create index tasks_user_due_idx on public.tasks (user_id, status, due_on);

create table public.plant_photos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  user_plant_id  uuid not null references public.user_plants(id) on delete cascade,
  event_id       uuid references public.care_events(id) on delete set null,
  storage_path   text not null,
  width          int,
  height         int,
  taken_at       timestamptz not null default now(),
  caption        text
);
create index plant_photos_plant_idx on public.plant_photos (user_plant_id, taken_at desc);

-- When a care event is logged: advance the matching schedule and close the open task.
create or replace function public.on_care_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.care_schedules;
begin
  if new.type::text not in (select unnest(enum_range(null::care_type))::text) then
    return new;
  end if;

  update public.care_schedules
     set last_done_at = new.occurred_at,
         next_due_at  = new.occurred_at + make_interval(days => interval_days)
   where user_plant_id = new.user_plant_id
     and care_type = new.type::text::care_type
     and (last_done_at is null or last_done_at <= new.occurred_at)
  returning * into s;

  if s.id is not null then
    update public.tasks
       set status = 'done', completed_event_id = new.id
     where schedule_id = s.id and status in ('pending','snoozed');
  end if;
  return new;
end $$;
create trigger care_events_after_insert after insert on public.care_events
  for each row execute function public.on_care_event();

-- ---------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------
create table public.posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  type            post_type not null default 'post',
  body            text check (char_length(body) <= 5000),
  repost_of       uuid references public.posts(id) on delete cascade,
  quote_of        uuid references public.posts(id) on delete set null,
  user_plant_id   uuid references public.user_plants(id) on delete set null,
  species_id      uuid references public.species(id) on delete set null,
  article_id      uuid references public.articles(id) on delete set null,
  visibility      visibility not null default 'public',
  is_solved       boolean not null default false,
  best_comment_id uuid,
  like_count      int not null default 0,
  comment_count   int not null default 0,
  repost_count    int not null default 0,
  save_count      int not null default 0,
  view_count      int not null default 0,
  score           double precision not null default 0,   -- global part of the ranking, refreshed by a job
  score_updated_at timestamptz,
  hidden_at       timestamptz,                          -- moderation
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index posts_author_time_idx on public.posts (author_id, created_at desc) where deleted_at is null;
create index posts_time_idx on public.posts (created_at desc) where deleted_at is null and hidden_at is null;
create index posts_species_idx on public.posts (species_id, created_at desc);
create index posts_score_idx on public.posts (score desc) where deleted_at is null and hidden_at is null;

create table public.post_media (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  width        int,
  height       int,
  blurhash     text,
  sort         int not null default 0
);
create index post_media_post_idx on public.post_media (post_id, sort);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  parent_id   uuid references public.comments(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  like_count  int not null default 0,
  hidden_at   timestamptz,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index comments_post_idx on public.comments (post_id, created_at);
alter table public.posts add constraint posts_best_comment_fk
  foreign key (best_comment_id) references public.comments(id) on delete set null;

create table public.reactions (
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  kind       text not null default 'like',
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index reactions_post_idx on public.reactions (post_id);

create table public.bookmarks (
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create table public.hashtags (
  id         uuid primary key default gen_random_uuid(),
  tag        text not null unique,
  post_count int not null default 0
);
create table public.post_hashtags (
  post_id    uuid references public.posts(id) on delete cascade,
  hashtag_id uuid references public.hashtags(id) on delete cascade,
  primary key (post_id, hashtag_id)
);
create index post_hashtags_tag_idx on public.post_hashtags (hashtag_id);

create table public.topic_follows (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  species_id uuid references public.species(id) on delete cascade,
  hashtag_id uuid references public.hashtags(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((species_id is null) <> (hashtag_id is null))
);
create unique index topic_follows_unique on public.topic_follows (user_id, coalesce(species_id, hashtag_id));

create table public.blocks (
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_id  uuid not null references public.profiles(id) on delete cascade,
  kind       text not null default 'block' check (kind in ('block','mute')),
  created_at timestamptz not null default now(),
  primary key (user_id, target_id)
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('like','comment','reply','follow','mention','repost','best_answer','care_due')),
  post_id    uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  post_id     uuid references public.posts(id) on delete cascade,
  comment_id  uuid references public.comments(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  reason      text not null,
  status      text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at  timestamptz not null default now()
);

create table public.user_affinity (
  viewer_id  uuid references public.profiles(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete cascade,
  score      double precision not null default 1,
  updated_at timestamptz not null default now(),
  primary key (viewer_id, author_id)
);

create table public.feed_impressions (
  user_id   uuid not null,
  post_id   uuid not null,
  position  int,
  dwell_ms  int,
  seen_at   timestamptz not null default now()
);
create index feed_impressions_user_idx on public.feed_impressions (user_id, seen_at desc);
-- Partition by day once volume grows (pg_partman), and export to analytics.

-- Denormalized counters
create or replace function public.bump_post_counter() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  delta int := case when tg_op = 'INSERT' then 1 else -1 end;
  pid uuid := coalesce(new.post_id, old.post_id);
begin
  if tg_table_name = 'reactions' then
    update public.posts set like_count = greatest(0, like_count + delta) where id = pid;
  elsif tg_table_name = 'comments' then
    update public.posts set comment_count = greatest(0, comment_count + delta) where id = pid;
  elsif tg_table_name = 'bookmarks' then
    update public.posts set save_count = greatest(0, save_count + delta) where id = pid;
  end if;
  return null;
end $$;
create trigger reactions_count after insert or delete on public.reactions
  for each row execute function public.bump_post_counter();
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.bump_post_counter();
create trigger bookmarks_count after insert or delete on public.bookmarks
  for each row execute function public.bump_post_counter();
