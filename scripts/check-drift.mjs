#!/usr/bin/env node
// Does the live database match the migrations?  Usage: npm run db:drift
//
// Builds the expected schema by applying every migration to an in-memory Postgres (PGlite), then asks the live
// Supabase API (with the service key from .env.local) which tables, columns and functions it really has.
// Catches migrations that were "marked applied" but never ran, and changes made by hand in the dashboard.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("❌ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed in .env.local");
  process.exit(1);
}

// ---------- expected: migrations on an empty database ----------
const root = join(import.meta.dirname, "..");
const db = new PGlite({ extensions: { pg_trgm } });
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create function auth.role() returns text language sql stable as $$ select current_user::text $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
const migDir = join(root, "supabase/migrations");
for (const f of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(migDir, f), "utf8"));
}
const { rows: colRows } = await db.query(`
  select c.table_name as t, c.column_name as c
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public'
   order by 1, 2`);
const expected = new Map();
for (const r of colRows) expected.set(r.t, [...(expected.get(r.t) ?? []), r.c]);
const { rows: fnRows } = await db.query(`
  select distinct p.proname as name
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype and p.prokind = 'f'`);
const expectedFns = new Set(fnRows.map((r) => r.name));

// ---------- actual: the live API ----------
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const missingTables = [];
const missingColumns = [];
let missingFns = null;
let extraTables = [];

let spec = null;
try {
  const res = await fetch(`${url}/rest/v1/`, { headers: { ...headers, Accept: "application/openapi+json" } });
  if (res.status === 401 || res.status === 403) {
    const body = await res.text();
    if (/invalid|jwt|api key/i.test(body)) {
      console.log("❌ The live database rejected SUPABASE_SERVICE_ROLE_KEY – check it in .env.local");
      process.exit(1);
    }
  }
  if (res.ok) spec = await res.json();
} catch (e) {
  console.log(`❌ Can't reach ${url}: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

if (spec?.definitions) {
  const live = spec.definitions;
  for (const [t, cols] of expected) {
    if (!live[t]) {
      missingTables.push(t);
      continue;
    }
    const liveCols = new Set(Object.keys(live[t].properties ?? {}));
    for (const c of cols) if (!liveCols.has(c)) missingColumns.push(`${t}.${c}`);
  }
  extraTables = Object.keys(live).filter((t) => !expected.has(t));
  const liveFns = new Set(Object.keys(spec.paths ?? {}).filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)));
  missingFns = [...expectedFns].filter((f) => !liveFns.has(f));
} else {
  // No OpenAPI access: probe each table/column with an empty select.
  console.log("ℹ️  API description not available – checking tables and columns one by one (functions skipped)");
  const probe = async (t, cols) => {
    const res = await fetch(`${url}/rest/v1/${t}?select=${cols.map(encodeURIComponent).join(",")}&limit=0`, { headers });
    return res.ok ? null : ((await res.json().catch(() => ({}))).code ?? String(res.status));
  };
  for (const [t, cols] of expected) {
    const err = await probe(t, cols);
    if (!err) continue;
    if (err === "PGRST205" || err === "42P01") {
      missingTables.push(t);
      continue;
    }
    for (const c of cols) if (await probe(t, [c])) missingColumns.push(`${t}.${c}`);
  }
}

// ---------- report ----------
let problems = 0;
const list = (title, items) => {
  if (!items?.length) return;
  problems += items.length;
  console.log(`\n❌ ${title} (${items.length}):`);
  for (const i of items) console.log(`   - ${i}`);
};
list("Tables/views in the migrations but NOT in the live database", missingTables);
list("Columns in the migrations but NOT in the live database", missingColumns);
list("Functions in the migrations but NOT in the live database", missingFns);
if (extraTables.length) console.log(`\nℹ️  In the live database but not in any migration (made by hand?): ${extraTables.join(", ")}`);

if (problems) {
  console.log("\nThe live database is missing parts of the migrations. Send this output to Claude to write a repair migration.");
  process.exit(1);
}
console.log(`✅ Live database matches the migrations: ${expected.size} tables/views${missingFns ? `, ${expectedFns.size} functions` : ""}`);
