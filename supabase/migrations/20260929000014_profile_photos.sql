-- Plantarium – profile photos. Images live in R2 under profiles/<user id>/;
-- the app checks the path, the database checks it's an https URL.

alter table public.profiles drop constraint if exists profiles_avatar_url_https;
alter table public.profiles add constraint profiles_avatar_url_https
  check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)) not valid;
