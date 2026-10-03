# Plantarium – operations

## Environments

| | Database (Supabase) | Photos (R2) | Used by |
| --- | --- | --- | --- |
| **Production** | `vnlobcdmswymtzesjdwk` (the original project) | `plantarium-media` | Vercel Production (main) |
| **Development** | a second free project (`plantarium-dev`) | `plantarium-media-dev` | your Mac (`.env.local`), Vercel Preview |

Production gets migrations only from CI (job **Migrate production database**, after every check passed on `main`).
On your Mac, link the Supabase CLI to the **dev** project and use `npm run db:push` there to try a migration first.

## GitHub secrets (Settings → Secrets and variables → Actions)

| Secret | What | Used by |
| --- | --- | --- |
| `SUPABASE_DB_URL` | Production connection string, **Session pooler** (port 5432, IPv4), with the database password | migrate, backup |
| `BACKUP_PASSPHRASE` | Long random password that encrypts backups. **Keep a copy in your password manager** – without it a backup can't be opened | backup |
| `BACKUP_R2_ACCOUNT_ID` | Cloudflare account id | backup |
| `BACKUP_R2_ACCESS_KEY_ID` / `BACKUP_R2_SECRET_ACCESS_KEY` | R2 API token limited to the backups bucket (Object Read & Write) | backup |
| `BACKUP_R2_BUCKET` | `plantarium-backups` (private, lifecycle rule: delete after 30 days) | backup |

Optional repository **variable** `PRODUCTION_URL` (default `https://plantarium-umber.vercel.app`) – the smoke test checks it.

## Releases

1. Push to `main` → CI: lint, types, tests, database tests, build.
2. All green → **Migrate production database** applies new files in `supabase/migrations`.
3. Vercel (Deployment Checks) promotes the new version only after step 2 succeeded.
4. **Smoke test** checks `/`, `/magazine/plants`, `/market`, `/login`, `/api/health` and a 404 on the live site.

Broken release: Vercel → Deployments → the previous one → **Promote**. A migration can't be rolled back that way –
write a new migration that fixes it.

## Monitoring

- `/api/health` → `200 {"status":"ok","db":"ok","version":"<commit>"}` or `503`. Point an uptime monitor at it (every 5 minutes).
- Sentry: set `NEXT_PUBLIC_SENTRY_DSN` in Vercel (all environments) and redeploy. Optional `SENTRY_ORG`, `SENTRY_PROJECT`,
  `SENTRY_AUTH_TOKEN` for readable stack traces. Only the user id is sent – no email, IP, cookies or form data.
- A missing or malformed setting in Vercel Production fails the build with a list (src/env.ts).

## Backups and restore

Every night GitHub Actions (**Database backup**) dumps roles, schema and data with `supabase db dump`, encrypts the archive
and uploads `db/plantarium-<date>.tar.gz.gpg` to the backups bucket. Run it by hand: Actions → Database backup → Run workflow.

Restore (into the **dev** project first, never straight over production):

```
gpg --decrypt plantarium-2026-10-04T0117Z.tar.gz.gpg | tar -xzf -
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f dump/roles.sql -f dump/schema.sql -c 'SET session_replication_role = replica' -f dump/data.sql
```

Test a restore once a quarter. Photos live in R2 and are not part of this backup.

Note: GitHub pauses scheduled workflows in a repository with no activity for 60 days – push something or re-enable it.

## Account deletion

Settings → המידע שלי → מחיקת החשבון (password + the word "מחיקה"). Deletes the auth user (database cascades remove
everything else) and the user's R2 folders `plants/ profiles/ feed/ market/ magazine/ <id>/`. `species/` photos stay
(shared plant database). Admin accounts can't delete themselves.
