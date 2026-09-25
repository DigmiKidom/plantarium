-- Plantarium – signup fills the profile from the signup form (display name + username).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uname text := lower(nullif(btrim(new.raw_user_meta_data->>'username'), ''));
begin
  if uname is not null and uname !~ '^[a-z0-9_]{3,24}$' then
    uname := null;
  end if;
  -- If the username was taken in the meantime, create the profile without it (user can set it later).
  if uname is not null and exists (select 1 from public.profiles where username = uname) then
    uname := null;
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    uname,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1), '')
  );
  return new;
end $$;

-- Case-insensitive uniqueness for usernames
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
