# Plantarium · פלנטריום

The digital home for plants: a Hebrew (RTL) plant knowledge base, a personal plant manager and a social feed for growers.

Stack: Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · Vercel.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

With no environment variables the site reads species from `src/data/species.json`, so the Knowledge section works immediately.

## Connect Supabase

1. `cp .env.example .env.local` and fill in the project URL (`https://<ref>.supabase.co`), the **Publishable** key and the secret key.
2. In Supabase: **SQL Editor → New query**, paste the whole `supabase/setup.sql`, **Run**. This creates all tables, security rules, Hebrew search and loads the 103 species. Run it once, on an empty project.
3. `npm run db:check` – confirms the connection, species count and search.
4. `npm run dev` – the site now reads from Supabase.

After changing `src/data/species.json`: `npm run db:setup-sql` rebuilds `supabase/seed.sql` (safe to re-run: it updates existing species) and `setup.sql`.
Later, with the Supabase CLI (`supabase link`, `supabase db push`) new migrations can be pushed from `supabase/migrations/`.

## Connect Cloudflare R2 (photos)

1. R2 → create bucket `plantarium-media` → Settings → **Public Development URL: Allow** (use your own domain before launch).
2. Settings → **CORS Policy**:
   ```json
   [{ "AllowedOrigins": ["http://localhost:3000"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```
3. R2 → Manage API tokens → Create API token (**Object Read & Write**, this bucket). Copy the S3 **Access Key ID** and **Secret Access Key**.
4. Fill `R2_*` and `NEXT_PUBLIC_IMAGES_URL` in `.env.local`, then `npm run r2:check`.

## Project map

| Path | What |
| --- | --- |
| `src/app/` | Routes: `/`, `/knowledge`, `/knowledge/[slug]`, placeholders for `/plants`, `/garden`, `/blog`, `/profile` |
| `src/components/` | `site-shell` (RTL nav: desktop sidebar, mobile bottom bar), species cards and visuals |
| `src/lib/species/` | Types and data access (`repo.ts` switches between Supabase and the local JSON) |
| `src/lib/search/hebrew.ts` | Hebrew normalization + typo-tolerant matching (mirrors SQL `normalize_he`) |
| `src/lib/labels.ts` | All Hebrew labels for enums and tags |
| `src/data/species.json` | Seed data: 103 species, drafts to review before publishing |
| `supabase/migrations/` | `…01_init` schema (knowledge, personal, social) · `…02_rls` security · `…03_search` Hebrew search |
| `scripts/build-seed-sql.mjs` | Builds `supabase/seed.sql` from the JSON |
| `scripts/build-setup-sql.mjs` | Builds `supabase/setup.sql` (migrations + seed) for a one-time paste |
| `scripts/check-db.mjs` | `npm run db:check` – tests the Supabase connection |
| `scripts/check-r2.mjs` | `npm run r2:check` – tests R2 upload, public URL and CORS |

## Conventions

- Hebrew only, `dir="rtl"`. Use logical Tailwind classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), never `ml-`/`left-`.
- Latin text inside Hebrew (scientific names, °C, %) goes in `<span className="ltr">`.
- URL slugs are Latin (`/knowledge/monstera-deliciosa`); titles and content are Hebrew.
- Every personal table has `user_id` + RLS; counters and feed scores are written only by triggers/jobs.

## Tested

- `npm run typecheck`, `npm run lint`, `npm run build` (103 species pages prerendered).
- Migrations + seed applied to Postgres 16; RLS checked: users can't read or write each other's plants, can't raise their own role or edit like counters; watering an event advances the schedule and closes the task.

## Next steps (V1)

Auth (Supabase email + Google) → Add plant flow → My Plants + plant page → profiles + follows → composer, feed, likes, comments → blog (MDX).
