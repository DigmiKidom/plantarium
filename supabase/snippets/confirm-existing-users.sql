-- One-time: mark every user who signed up before verification was removed as confirmed,
-- so they can log in. Run in Supabase → SQL Editor.
update auth.users
   set email_confirmed_at = now()
 where email_confirmed_at is null;
