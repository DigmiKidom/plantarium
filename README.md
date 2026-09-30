# Plantarium · פלנטריום

The digital home for plants: a Hebrew (RTL) plant knowledge base, a personal plant manager and a social feed for growers.

Stack: Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Supabase (Postgres, Auth) · Cloudflare R2 (photos) · Vercel.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

With no environment variables the site reads species from `src/data/species.json`, so the plant database works immediately.

## Connect Supabase

1. `cp .env.example .env.local` and fill in the project URL (`https://<ref>.supabase.co`), the **Publishable** key and the secret key.
2. `npx supabase login`, `npm run db:link`, then `npm run db:push` – applies every migration in `supabase/migrations/` (tables, security rules and all 1,089 plant species). Migrations are the only way the database changes.
3. `npm run db:check` – confirms the connection; `npm run db:drift` – confirms the live database really matches the migrations.
4. `npm run dev` – the site now reads from Supabase.

Plant species: edit `src/data/species.json`, then `npm run db:species` writes a new migration with the species that aren't in the database yet (insert-only – edits made on the site are never overwritten). CI fails if the JSON has species no migration adds.

Auth settings in the Supabase dashboard: **Authentication → URL Configuration** – Site URL = the live site, Redirect URLs include `<site>/auth/callback` (password reset) and `http://localhost:3000/auth/callback`. Signup goes through the server (service key), so public sign-ups can be turned off.

## Connect Cloudflare R2 (photos)

1. R2 → create bucket `plantarium-media` → Settings → **Public Development URL: Allow** (use your own domain before launch).
2. Settings → **CORS Policy**:
   ```json
   [{ "AllowedOrigins": ["http://localhost:3000"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```
3. R2 → Manage API tokens → Create API token (**Object Read & Write**, this bucket). Copy the S3 **Access Key ID** and **Secret Access Key**.
4. Fill `R2_*` and `NEXT_PUBLIC_IMAGES_URL` in `.env.local`, then `npm run r2:check`.

## Roles, magazine and moderation

| Role | Can |
| --- | --- |
| `user` | Read, keep plants, report other accounts (`/u/<username>` → דיווח) |
| `author` | + write magazine articles at `/magazine/write` and send them for review |
| `editor` (chief editor) | + approve/reject articles and plant suggestions, edit the plant database |
| `admin` | + give roles, ban/unban, delete accounts, handle reports and plans at `/admin` |

- Articles are never published by their author: *draft → pending → published* (or *rejected* with a note). Editing a published article sends it back to review.
- Signed-in users can like and comment on published articles (max 5 comments a minute / 100 a day). Comments can't be edited; the writer or an admin can delete them (admin deletions go to the log).
- The first admin is set once in the SQL editor: `supabase/snippets/make-admin.sql`. After that, roles are given from `/admin/users`.
- Admins can't change their own role or another admin from the site – only from Supabase.
- Ban = the profile is marked `banned_until` **and** sign-in is blocked in Supabase Auth. Delete removes the login; the database cascades remove profile, plants, articles and reports. Every admin action is written to `admin_actions` (`/admin/log`).
- Security rules live in the database (RLS + guard triggers in migration `20260925000007`), so they hold even if the UI has a bug.
- Article images upload straight from the browser to R2 with a 5-minute signed URL; the R2 CORS rule must allow `PUT` from the site's origin (localhost and each Vercel domain).

`npm run db:test` applies every migration to an in-memory Postgres and checks the security rules as different users (no Docker needed).

## Database changes (Supabase CLI)

The CLI is a dev dependency – no brew install needed. One-time setup on a new computer:

```
npx supabase login
npm run db:link
npm run db:status
```

New change: `npm run db:new add_something` → write SQL in the new file under `supabase/migrations/` → `npm run db:test` → `npm run db:push`. Never change the schema by hand in the Supabase dashboard, and never mark a migration as applied without running it (that's how migration 0005 went missing on the live database). `npm run db:drift` checks for this.

Before a push: `npm run check` runs lint, types, unit tests, the database tests and the species check – the same as CI on GitHub.

## Project map

| Path | What |
| --- | --- |
| `src/app/` | Routes: `/` (החממה feed), `/plants` (my plants), `/magazine` (+ `/magazine/plants` database), `/market`, `/u/[username]`, `/admin`, auth pages |
| `src/components/` | `site-shell` (RTL nav: desktop sidebar, mobile bottom bar) and feature components |
| `src/lib/species/` | Types and data access (`repo.ts` switches between Supabase and the local JSON) |
| `src/lib/search/hebrew.ts` | Hebrew normalization + typo-tolerant matching (mirrors SQL `normalize_he`) |
| `src/lib/labels.ts` | All Hebrew labels for enums and tags |
| `src/data/species.json` | Plant species source: 1,089 species (care values are drafts to review) |
| `supabase/migrations/` | Every database change, in order (schema, security, plant data) |
| `scripts/test-db.mjs` | `npm run db:test` – all migrations on in-memory Postgres + ~230 security checks |
| `scripts/species-migration.mjs` | `npm run db:species` – new migration for species added to the JSON |
| `scripts/check-drift.mjs` | `npm run db:drift` – does the live database match the migrations? |
| `scripts/check-db.mjs` | `npm run db:check` – tests the Supabase connection |
| `scripts/check-r2.mjs` | `npm run r2:check` – tests R2 upload, public URL and CORS |

## Conventions

- Hebrew only, `dir="rtl"`. Use logical Tailwind classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), never `ml-`/`left-`.
- Latin text inside Hebrew (scientific names, °C, %) goes in `<span className="ltr">`.
- URL slugs are Latin (`/magazine/plants/monstera-deliciosa`); titles and content are Hebrew.
- Every personal table has `user_id` + RLS; counters and feed scores are written only by triggers/jobs.

## Tested

GitHub Actions (`.github/workflows/ci.yml`) on every push: lint, types, unit tests (Vitest), database tests, species check, `npm audit`, production build.
