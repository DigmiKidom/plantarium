-- Plantarium – per-user site settings (theme, and future settings), stored as JSON on the profile.
alter table public.profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;

comment on column public.profiles.settings is
  'User site settings, e.g. {"theme":"dark"}. Validated in src/lib/settings/schema.ts.';
