-- Plantarium – profile photo and cover photo (Facebook-style profiles).
-- Images live in R2 under profiles/<user id>/; the app checks the path, the database checks it's https.

alter table public.profiles
  add column if not exists cover_url text;

alter table public.profiles drop constraint if exists profiles_avatar_url_https;
alter table public.profiles add constraint profiles_avatar_url_https
  check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)) not valid;
alter table public.profiles drop constraint if exists profiles_cover_url_https;
alter table public.profiles add constraint profiles_cover_url_https
  check (cover_url is null or (cover_url ~ '^https://' and char_length(cover_url) <= 500));
