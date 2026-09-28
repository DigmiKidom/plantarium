-- Plantarium – make sure new accounts get the name they typed at signup (not their email).
-- Re-creates the signup trigger function (same as 0004, in case that one was never applied)
-- and fixes existing profiles whose name fell back to the email address.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uname text := lower(nullif(btrim(new.raw_user_meta_data->>'username'), ''));
  dname text := nullif(btrim(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name')), '');
begin
  if uname is not null and uname !~ '^[a-z0-9_]{3,24}$' then
    uname := null;
  end if;
  if uname is not null and exists (select 1 from public.profiles where lower(username) = uname) then
    uname := null;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(dname, split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- Existing accounts: name = email prefix but a real name was given at signup → use the real name
update public.profiles p
   set display_name = btrim(u.raw_user_meta_data->>'display_name')
  from auth.users u
 where u.id = p.id
   and p.display_name = split_part(u.email, '@', 1)
   and nullif(btrim(u.raw_user_meta_data->>'display_name'), '') is not null;

-- …and the username they chose, if it's still free
update public.profiles p
   set username = lower(btrim(u.raw_user_meta_data->>'username'))
  from auth.users u
 where u.id = p.id
   and p.username is null
   and lower(btrim(u.raw_user_meta_data->>'username')) ~ '^[a-z0-9_]{3,24}$'
   and not exists (select 1 from public.profiles o where lower(o.username) = lower(btrim(u.raw_user_meta_data->>'username')));
