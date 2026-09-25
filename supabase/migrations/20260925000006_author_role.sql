-- Plantarium – new "author" role (writes magazine articles). Order: user < author < editor < admin.
-- Kept in its own migration: Postgres can't use a new enum value in the same transaction that adds it.
alter type public.user_role add value if not exists 'author' before 'editor';
