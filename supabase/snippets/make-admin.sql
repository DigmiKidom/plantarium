-- Make the first admin. Run in Supabase → SQL Editor, with your own username.
-- After that, admins give roles from the website (/admin/users).
update public.profiles set role = 'admin' where username = 'YOUR_USERNAME';
select id, username, role from public.profiles where role = 'admin';
