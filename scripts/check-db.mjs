#!/usr/bin/env node
// Checks the Supabase connection from .env.local.  Usage: npm run db:check
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const ok = (m) => console.log(`✅ ${m}`);
const fail = (m) => {
  console.log(`❌ ${m}`);
  process.exitCode = 1;
};

if (!url || !key) {
  fail("NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing in .env.local");
  process.exit();
}
if (/\/(rest|auth)\/v1/.test(url)) fail("URL should be https://<ref>.supabase.co without /rest/v1");
else ok(`URL ${url}`);

const db = createClient(url, key, { auth: { persistSession: false } });

const { count, error } = await db.from("species").select("slug", { count: "exact", head: true });
if (error) {
  fail(`species table: ${error.message}`);
  if (/does not exist|schema cache/i.test(error.message)) {
    console.log("   → Run supabase/setup.sql in the Supabase SQL Editor first.");
  }
} else if (!count) {
  fail("species table is empty – run supabase/setup.sql (or seed.sql)");
} else {
  ok(`${count} published species`);
}

const { data: hits, error: sErr } = await db.rpc("search_species", { q: "מונסטר", max_results: 3 });
if (sErr) fail(`search_species: ${sErr.message}`);
else ok(`Hebrew search works: ${hits.map((h) => h.common_name_he).join(", ")}`);

const { error: pErr } = await db.from("user_plants").select("id").limit(1);
if (pErr) fail(`user_plants: ${pErr.message}`);
else ok("user_plants reachable (RLS returns only your own rows)");
