#!/usr/bin/env node
// Database tests without Docker or a Supabase project: runs real Postgres in-process (PGlite),
// adds small stand-ins for Supabase's auth schema, applies every migration in order,
// then checks the security rules (RLS + guard triggers) as different users.
// Usage: npm run db:test
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const root = join(import.meta.dirname, "..");
const migrationsDir = join(root, "supabase/migrations");

const db = new PGlite({ extensions: { pg_trgm } });

// ---------- Supabase stand-ins ----------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                           current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.role() returns text language sql stable as $$ select current_user::text $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);

// ---------- migrations ----------
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  try {
    await db.exec(readFileSync(join(migrationsDir, f), "utf8"));
  } catch (e) {
    console.log(`❌ migration ${f} failed: ${e.message}`);
    process.exit(1);
  }
}
console.log(`✅ ${files.length} migrations applied in order`);

{
  // Plant species come from migrations (0018 + 0021) – no separate seed file any more.
  const { rows } = await db.query("select count(*)::int as n from public.species");
  if (rows[0].n < 1000) {
    console.log(`❌ expected the migrations to load 1,000+ species, got ${rows[0].n}`);
    process.exit(1);
  }
  console.log(`✅ migrations loaded ${rows[0].n} species`);
}

// ---------- helpers ----------
let failed = 0;
const pass = (m) => console.log(`✅ ${m}`);
const fail = (m) => {
  failed++;
  console.log(`❌ ${m}`);
};

/** Run `fn` as a signed-in user (uid) or as anon (null), like a request from the website. */
async function as(uid, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  await db.exec(uid ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const q = (sql, params) => db.query(sql, params);
async function allowed(label, fn) {
  try {
    await fn();
    pass(label);
  } catch (e) {
    fail(`${label} – got error: ${e.message}`);
  }
}
async function denied(label, fn) {
  try {
    const r = await fn();
    // RLS on update/delete doesn't raise, it just matches 0 rows
    if (r && typeof r.affectedRows === "number" && r.affectedRows === 0) return pass(label);
    fail(`${label} – was allowed`);
  } catch {
    pass(label);
  }
}
async function expectCount(label, n, fn) {
  const r = await fn();
  const got = r.rows.length === 1 && "n" in r.rows[0] ? r.rows[0].n : r.rows.length;
  if (got === n) pass(label);
  else fail(`${label} – expected ${n}, got ${got}`);
}

async function createUser(username, role = "user") {
  const { rows } = await q(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${username}@test.local`, { username, display_name: username }],
  );
  if (role !== "user") await q(`update public.profiles set role = $1 where id = $2`, [role, rows[0].id]);
  return rows[0].id;
}

// ---------- fixtures (as the SQL editor, no restrictions) ----------
const alice = await createUser("alice");
const mallory = await createUser("mallory");
const bob = await createUser("bob", "author");
const carol = await createUser("carol", "admin");
const dave = await createUser("dave", "admin");

// ---------- signup ----------
console.log("\nSignup");
{
  const { rows } = await q(`insert into auth.users (email, raw_user_meta_data) values ('noa.levi@test.local', $1) returning id`, [
    { display_name: "נועה לוי", username: "noa_l" },
  ]);
  await expectCount("new account gets the typed name and username, not the email", 1, () =>
    q(`select 1 from public.profiles where id = $1 and display_name = 'נועה לוי' and username = 'noa_l'`, [rows[0].id]));
}

// ---------- profiles & roles ----------
console.log("\nProfiles & roles");
await denied("user can't make themselves admin", () =>
  as(alice, () => q(`update public.profiles set role = 'admin' where id = $1`, [alice])));
await denied("user can't un-ban themselves", () =>
  as(alice, () => q(`update public.profiles set banned_until = now() + interval '1 day' where id = $1`, [alice])));
await allowed("user can still edit own bio", () =>
  as(alice, () => q(`update public.profiles set bio = 'hi' where id = $1`, [alice])));
await denied("user can't edit someone else's profile", () =>
  as(alice, () => q(`update public.profiles set bio = 'x' where id = $1`, [bob])));
await allowed("admin gives author role", () =>
  as(carol, async () => {
    const r = await q(`update public.profiles set role = 'author' where id = $1`, [mallory]);
    if (r.affectedRows !== 1) throw new Error("0 rows");
  }));
await allowed("admin removes author role", () =>
  as(carol, () => q(`update public.profiles set role = 'user' where id = $1`, [mallory])));
await denied("admin can't change own role", () =>
  as(carol, () => q(`update public.profiles set role = 'user' where id = $1`, [carol])));
await denied("admin can't ban another admin", () =>
  as(carol, () => q(`update public.profiles set banned_until = 'infinity' where id = $1`, [dave])));
await denied("admin can't edit another user's name", () =>
  as(carol, () => q(`update public.profiles set display_name = 'hacked' where id = $1`, [alice])));

// ---------- profile photos ----------
console.log("\nProfile photos");
await allowed("user sets own profile photo", () =>
  as(alice, () => q(`update public.profiles set avatar_url = $2 where id = $1`, [alice, `https://img.test/profiles/${alice}/avatar-1.webp`])));
await denied("profile photo must come from the user's own folder", () =>
  as(alice, () => q(`update public.profiles set avatar_url = 'https://evil.test/tracker.webp' where id = $1`, [alice])));
await denied("…not someone else's folder either", () =>
  as(alice, () => q(`update public.profiles set avatar_url = $2 where id = $1`, [alice, `https://img.test/profiles/${bob}/avatar-1.webp`])));
await denied("user can't change someone else's photo", () =>
  as(alice, () => q(`update public.profiles set avatar_url = 'https://img.test/x.webp' where id = $1`, [bob])));
await denied("photo must be an https URL", () =>
  as(alice, () => q(`update public.profiles set avatar_url = 'javascript:alert(1)' where id = $1`, [alice])));

// ---------- magazine ----------
console.log("\nMagazine");
await denied("regular user can't write an article", () =>
  as(alice, () => q(`insert into public.magazine_articles (title) values ('x')`)));
let articleId;
await allowed("author creates a draft", () =>
  as(bob, async () => {
    const { rows } = await q(`insert into public.magazine_articles (title) values ('מאמר') returning id`);
    articleId = rows[0].id;
  }));
await denied("author can't create an article as published", () =>
  as(bob, () => q(`insert into public.magazine_articles (title, status) values ('x', 'published')`)));
await denied("author can't publish own draft", () =>
  as(bob, () => q(`update public.magazine_articles set status = 'published' where id = $1`, [articleId])));
await allowed("author sends draft to review", () =>
  as(bob, () => q(`update public.magazine_articles set status = 'pending' where id = $1`, [articleId])));
await expectCount("submitted_at is set", 1, () =>
  q(`select 1 from public.magazine_articles where id = $1 and submitted_at is not null`, [articleId]));
await expectCount("other users don't see a pending article", 0, () =>
  as(alice, () => q(`select id from public.magazine_articles where id = $1`, [articleId])));
await expectCount("visitors don't see a pending article", 0, () =>
  as(null, () => q(`select id from public.magazine_articles where id = $1`, [articleId])));
await expectCount("admin sees the review queue", 1, () =>
  as(carol, () => q(`select id from public.magazine_articles where status = 'pending'`)));
await allowed("admin approves", () =>
  as(carol, () => q(`update public.magazine_articles set status = 'published' where id = $1`, [articleId])));
await expectCount("published_at and reviewer are stamped", 1, () =>
  q(`select 1 from public.magazine_articles where id = $1 and published_at is not null and reviewed_by = $2`, [articleId, carol]));
await expectCount("visitors see the published article", 1, () =>
  as(null, () => q(`select id from public.magazine_articles where id = $1`, [articleId])));
await denied("author can't keep a published article live while editing it", () =>
  as(bob, () => q(`update public.magazine_articles set title = 'changed' where id = $1`, [articleId])));
await denied("author can't delete a published article", () =>
  as(bob, () => q(`delete from public.magazine_articles where id = $1`, [articleId])));
await denied("author can't change the slug", () =>
  as(bob, async () => {
    await q(`update public.magazine_articles set slug = 'my-slug', status = 'pending' where id = $1`, [articleId]);
    const { rows } = await q(`select slug from public.magazine_articles where id = $1`, [articleId]);
    if (rows[0].slug === "my-slug") return; // allowed → fail
    throw new Error("slug kept");
  }));
await denied("author can't set their own review note", () =>
  as(bob, async () => {
    await q(`update public.magazine_articles set review_note = 'fine', status = 'draft' where id = $1`, [articleId]);
    const { rows } = await q(`select review_note from public.magazine_articles where id = $1`, [articleId]);
    if (rows[0].review_note === "fine") return;
    throw new Error("note kept");
  }));
await denied("another author can't edit bob's article", () =>
  as(mallory, () => q(`update public.magazine_articles set title = 'x' where id = $1`, [articleId])));

// ---------- reports ----------
console.log("\nReports");
await allowed("user reports an account", () =>
  as(alice, () => q(`insert into public.reports (user_id, reason, details) values ($1, 'spam', 'ads')`, [mallory])));
await denied("same user can't open a second report on the same account", () =>
  as(alice, () => q(`insert into public.reports (user_id, reason) values ($1, 'spam')`, [mallory])));
await denied("user can't report themselves", () =>
  as(alice, () => q(`insert into public.reports (user_id, reason) values ($1, 'spam')`, [alice])));
await denied("user can't file a report in someone else's name", () =>
  as(alice, () => q(`insert into public.reports (reporter_id, user_id, reason) values ($1, $2, 'spam')`, [bob, mallory])));
await denied("unknown reason is rejected", () =>
  as(bob, () => q(`insert into public.reports (user_id, reason) values ($1, 'because')`, [mallory])));
await denied("visitors can't report", () =>
  as(null, () => q(`insert into public.reports (user_id, reason) values ($1, 'spam')`, [mallory])));
await expectCount("users can't read reports", 0, () => as(alice, () => q(`select id from public.reports`)));
await expectCount("admins read reports", 1, () => as(carol, () => q(`select id from public.reports`)));
await allowed("admin closes a report", () =>
  as(carol, () => q(`update public.reports set status = 'dismissed', handled_by = $1, handled_at = now()`, [carol])));

// ---------- bans ----------
console.log("\nBans");
await allowed("admin bans a user", () =>
  as(carol, () => q(`update public.profiles set banned_until = now() + interval '7 days', ban_reason = 'spam' where id = $1`, [mallory])));
await denied("banned user can't report", () =>
  as(mallory, () => q(`insert into public.reports (user_id, reason) values ($1, 'spam')`, [alice])));
await q(`update public.profiles set banned_until = 'infinity' where id = $1`, [bob]);
await denied("banned author can't write", () =>
  as(bob, () => q(`insert into public.magazine_articles (title) values ('x')`)));
await allowed("admin lifts a ban", () =>
  as(carol, () => q(`update public.profiles set banned_until = null, ban_reason = null where id = $1`, [mallory])));

// ---------- admin log ----------
console.log("\nAdmin log");
await allowed("admin writes to the log", () =>
  as(carol, () => q(`insert into public.admin_actions (admin_id, target_id, action) values ($1, $2, 'ban')`, [carol, mallory])));
await denied("admin can't log in another admin's name", () =>
  as(carol, () => q(`insert into public.admin_actions (admin_id, action) values ($1, 'ban')`, [dave])));
await denied("users can't write to the log", () =>
  as(alice, () => q(`insert into public.admin_actions (admin_id, action) values ($1, 'ban')`, [alice])));
await expectCount("users can't read the log", 0, () => as(alice, () => q(`select id from public.admin_actions`)));

// ---------- personal data ----------
console.log("\nPersonal data");
await as(alice, () => q(`insert into public.locations (name) values ('בית')`));
await expectCount("users can't see each other's places", 0, () => as(mallory, () => q(`select id from public.locations where user_id = $1`, [alice])));

// ---------- likes & comments ----------
console.log("\nLikes & comments");
const { rows: pub } = await q(
  `insert into public.magazine_articles (author_id, title, status) values ($1, 'פורסם', 'published') returning id`,
  [carol],
);
const liveId = pub[0].id;
const { rows: drf } = await q(`insert into public.magazine_articles (author_id, title) values ($1, 'טיוטה') returning id`, [carol]);
const draftId = drf[0].id;

await allowed("user likes a published article", () =>
  as(alice, () => q(`insert into public.magazine_likes (article_id) values ($1)`, [liveId])));
await denied("user can't like twice", () =>
  as(alice, () => q(`insert into public.magazine_likes (article_id) values ($1)`, [liveId])));
await denied("user can't like in someone else's name", () =>
  as(alice, () => q(`insert into public.magazine_likes (article_id, user_id) values ($1, $2)`, [liveId, mallory])));
await denied("user can't like an unpublished article", () =>
  as(alice, () => q(`insert into public.magazine_likes (article_id) values ($1)`, [draftId])));
await denied("visitors can't like", () =>
  as(null, () => q(`insert into public.magazine_likes (article_id) values ($1)`, [liveId])));
await expectCount("visitors see the like count", 1, () =>
  as(null, () => q(`select 1 from public.magazine_likes where article_id = $1`, [liveId])));
await denied("user can't remove someone else's like", () =>
  as(mallory, () => q(`delete from public.magazine_likes where article_id = $1`, [liveId])));
await allowed("user removes own like", () =>
  as(alice, () => q(`delete from public.magazine_likes where article_id = $1 and user_id = $2`, [liveId, alice])));

let commentId;
await allowed("user comments on a published article", () =>
  as(alice, async () => {
    const { rows } = await q(`insert into public.magazine_comments (article_id, body) values ($1, '  כתבה מעולה  ') returning id, body`, [liveId]);
    commentId = rows[0].id;
    if (rows[0].body !== "כתבה מעולה") throw new Error("body not trimmed");
  }));
await denied("empty comment is rejected", () =>
  as(alice, () => q(`insert into public.magazine_comments (article_id, body) values ($1, '   ')`, [liveId])));
await denied("user can't comment on an unpublished article", () =>
  as(alice, () => q(`insert into public.magazine_comments (article_id, body) values ($1, 'x')`, [draftId])));
await denied("visitors can't comment", () =>
  as(null, () => q(`insert into public.magazine_comments (article_id, body) values ($1, 'x')`, [liveId])));
await expectCount("visitors read comments", 1, () =>
  as(null, () => q(`select id from public.magazine_comments where article_id = $1`, [liveId])));
await denied("user can't edit a comment", () =>
  as(alice, () => q(`update public.magazine_comments set body = 'changed' where id = $1`, [commentId])));
await denied("user can't delete someone else's comment", () =>
  as(mallory, () => q(`delete from public.magazine_comments where id = $1`, [commentId])));
await q(`update public.profiles set banned_until = 'infinity' where id = $1`, [mallory]);
await denied("banned user can't comment", () =>
  as(mallory, () => q(`insert into public.magazine_comments (article_id, body) values ($1, 'x')`, [liveId])));
await denied("banned user can't like", () =>
  as(mallory, () => q(`insert into public.magazine_likes (article_id) values ($1)`, [liveId])));
await q(`update public.profiles set banned_until = null where id = $1`, [mallory]);
await denied("more than 5 comments a minute is blocked", () =>
  as(mallory, async () => {
    for (let i = 0; i < 6; i++) await q(`insert into public.magazine_comments (article_id, body) values ($1, $2)`, [liveId, `c${i}`]);
  }));
await expectCount("…after the first 5 went through", 5, () =>
  q(`select count(*)::int as n from public.magazine_comments where user_id = $1`, [mallory]));
await allowed("admin deletes someone else's comment", () =>
  as(carol, async () => {
    const r = await q(`delete from public.magazine_comments where id = $1`, [commentId]);
    if (r.affectedRows !== 1) throw new Error("0 rows");
  }));
await q(`update public.magazine_articles set status = 'rejected', review_note = 'x' where id = $1`, [liveId]);
await expectCount("comments hide when the article is unpublished", 0, () =>
  as(null, () => q(`select id from public.magazine_comments where article_id = $1`, [liveId])));

// ---------- marketplace ----------
console.log("\nMarketplace");
const { rows: sp } = await q(`select id from public.species where published_at is not null order by slug limit 1`);
const speciesId = sp[0]?.id;
if (!speciesId) fail("no published species to list");
const photoOf = (uid) => [`https://img.test/market/${uid}/a.webp`];
const listAs = (uid, extra = "") =>
  as(uid, () => q(`insert into public.market_listings (species_id, price, photos${extra ? ", status" : ""}) values ($1, 50, $2${extra ? `, '${extra}'` : ""}) returning id`, [speciesId, photoOf(uid)]));

let listingId;
await allowed("user lists a plant", async () => {
  const { rows } = await listAs(alice);
  listingId = rows[0].id;
});
await allowed("seller adds contact details", () =>
  as(alice, () => q(`insert into public.market_listing_contacts (listing_id, phone, whatsapp) values ($1, '050-1234567', true)`, [listingId])));
await denied("contact needs a phone", () =>
  as(alice, async () => {
    const { rows } = await listAs(alice);
    await q(`insert into public.market_listing_contacts (listing_id) values ($1)`, [rows[0].id]);
  }));
await q(`delete from public.market_listings where seller_id = $1 and id <> $2`, [alice, listingId]);
await denied("listing needs a photo", () =>
  as(alice, () => q(`insert into public.market_listings (species_id, price, photos) values ($1, 10, '{}')`, [speciesId])));
await denied("negative price is rejected", () =>
  as(alice, () => q(`insert into public.market_listings (species_id, price, photos) values ($1, -5, $2)`, [speciesId, photoOf(alice)])));
await denied("visitors can't list", () => listAs(null));
await denied("can't list in someone else's name", () =>
  as(alice, () => q(`insert into public.market_listings (seller_id, species_id, price, photos) values ($1, $2, 1, $3)`, [mallory, speciesId, photoOf(alice)])));
await expectCount("visitors see active listings", 1, () =>
  as(null, () => q(`select id from public.market_listings where id = $1`, [listingId])));
await expectCount("visitors can't see contact details", 0, () =>
  as(null, () => q(`select phone from public.market_listing_contacts where listing_id = $1`, [listingId])));
await expectCount("signed-in users can't bulk-read contact details", 0, () =>
  as(mallory, () => q(`select phone from public.market_listing_contacts`)));
await expectCount("…they get one listing's phone through get_listing_contact", 1, () =>
  as(mallory, () => q(`select phone from public.get_listing_contact($1)`, [listingId])));
await denied("visitors can't call get_listing_contact", () =>
  as(null, () => q(`select phone from public.get_listing_contact($1)`, [listingId])));
await expectCount("the seller still sees their own contact", 1, () =>
  as(alice, () => q(`select phone from public.market_listing_contacts where listing_id = $1`, [listingId])));
{
  // 100 different listings a day is the limit
  const fake = await q(`select id from public.market_listings limit 1`);
  await q(`alter table public.contact_reveals drop constraint contact_reveals_listing_id_fkey`);
  await q(`insert into public.contact_reveals (user_id, listing_id) select $1, gen_random_uuid() from generate_series(1, 100)`, [dave]);
  await denied("more than 100 phone numbers a day is blocked", () =>
    as(dave, () => q(`select phone from public.get_listing_contact($1)`, [listingId])));
  await q(`delete from public.contact_reveals where user_id = $1`, [dave]);
  void fake;
}
await denied("others can't edit the listing", () =>
  as(mallory, () => q(`update public.market_listings set price = 1 where id = $1`, [listingId])));
await denied("others can't change the contact", () =>
  as(mallory, () => q(`update public.market_listing_contacts set phone = '0500000000' where listing_id = $1`, [listingId])));
await expectCount("visitors see species counts", 1, () =>
  as(null, () => q(`select active_count as n from public.market_species_counts where species_id = $1`, [speciesId])));

// limit: free plan = 5 active
await allowed("free account lists up to 5 plants", async () => {
  for (let i = 0; i < 4; i++) await listAs(alice);
});
await denied("6th active listing is blocked", () => listAs(alice));
await allowed("marking one sold frees a slot", async () => {
  await as(alice, () => q(`update public.market_listings set status = 'sold' where id = $1`, [listingId]));
  await listAs(alice);
});
await expectCount("sold_at is stamped", 1, () =>
  q(`select 1 from public.market_listings where id = $1 and sold_at is not null`, [listingId]));
await expectCount("others don't see sold listings", 0, () =>
  as(mallory, () => q(`select id from public.market_listings where id = $1`, [listingId])));
await denied("reactivating a sold one over the limit is blocked", () =>
  as(alice, () => q(`update public.market_listings set status = 'active' where id = $1`, [listingId])));
await denied("user can't upgrade their own plan", () =>
  as(alice, () => q(`update public.profiles set plan = 'plus' where id = $1`, [alice])));
await allowed("admin gives the plus plan", () =>
  as(carol, () => q(`update public.profiles set plan = 'plus' where id = $1`, [alice])));
await allowed("plus plan lists more than 5", () => listAs(alice));

// moderation
const { rows: ml } = await listAs(mallory);
const malloryListing = ml[0].id;
await denied("seller can't mark own listing as removed", () =>
  as(mallory, () => q(`update public.market_listings set status = 'removed' where id = $1`, [malloryListing])));
await allowed("admin removes a listing", () =>
  as(carol, () => q(`update public.market_listings set status = 'removed', removed_reason = 'spam' where id = $1`, [malloryListing])));
await denied("seller can't bring back a removed listing", () =>
  as(mallory, () => q(`update public.market_listings set status = 'active' where id = $1`, [malloryListing])));
await allowed("seller deletes own listing", () =>
  as(mallory, async () => {
    const r = await q(`delete from public.market_listings where id = $1`, [malloryListing]);
    if (r.affectedRows !== 1) throw new Error("0 rows");
  }));

// reports on listings
const { rows: ml2 } = await listAs(mallory);
const { rows: ml3 } = await listAs(mallory);
await allowed("user reports a listing", () =>
  as(dave, () => q(`insert into public.reports (user_id, listing_id, reason) values ($1, $2, 'spam')`, [mallory, ml2[0].id])));
await allowed("…and another listing of the same seller", () =>
  as(dave, () => q(`insert into public.reports (user_id, listing_id, reason) values ($1, $2, 'spam')`, [mallory, ml3[0].id])));
await denied("…but not the same listing twice", () =>
  as(dave, () => q(`insert into public.reports (user_id, listing_id, reason) values ($1, $2, 'other')`, [mallory, ml2[0].id])));

// other species + phone only
await allowed("listing a plant that isn't in the database (other + category)", () =>
  as(dave, () =>
    q(`insert into public.market_listings (other_species, category, price, photos) values ('פטוניה כפולה', 'garden', 20, $1)`, [photoOf(dave)])));
await denied("other plant needs a category", () =>
  as(dave, () => q(`insert into public.market_listings (other_species, price, photos) values ('משהו', 5, $1)`, [photoOf(dave)])));
await expectCount("a database species wins over a typed name", 1, () =>
  as(dave, () =>
    q(`insert into public.market_listings (species_id, other_species, category, price, photos) values ($1, 'x y', 'garden', 5, $2) returning other_species`, [speciesId, photoOf(dave)]).then((r) => ({ rows: r.rows.filter((x) => x.other_species === null) }))));
await denied("needs a species or an other name", () =>
  as(dave, () => q(`insert into public.market_listings (category, price, photos) values ('garden', 5, $1)`, [photoOf(dave)])));
await expectCount("species decides the category", 1, () =>
  q(`select 1 from public.market_listings l join public.species s on s.id = l.species_id where l.id = $1 and l.category = s.category::text`, [ml2[0].id]));
await denied("email contact is no longer accepted", () =>
  as(mallory, () => q(`insert into public.market_listing_contacts (listing_id, phone, email) values ($1, '0501234567', 'a@b.co')`, [ml3[0].id])));

// supplies (pots, soil, tools…)
await allowed("listing a used pot (supplies category, item name, condition)", () =>
  as(dave, () =>
    q(`insert into public.market_listings (other_species, category, condition, price, photos) values ('עציץ טרקוטה 30 ס״מ', 'pots', 'used', 40, $1)`, [photoOf(dave)])));
await denied("supplies can't be linked to a plant species", () =>
  as(dave, () => q(`insert into public.market_listings (species_id, category, price, photos) values ($1, 'tools', 5, $2)`, [speciesId, photoOf(dave)])));
await denied("unknown market category is rejected", () =>
  as(dave, () => q(`insert into public.market_listings (other_species, category, price, photos) values ('משהו', 'cars', 5, $1)`, [photoOf(dave)])));
await denied("unknown condition is rejected", () =>
  as(dave, () => q(`insert into public.market_listings (other_species, category, condition, price, photos) values ('מזמרה', 'tools', 'broken', 5, $1)`, [photoOf(dave)])));

// ---------- follows ----------
console.log("\nFollows");
await allowed("user follows another user", () =>
  as(alice, () => q(`insert into public.follows (followee_id) values ($1)`, [mallory])));
await denied("can't follow twice", () =>
  as(alice, () => q(`insert into public.follows (followee_id) values ($1)`, [mallory])));
await denied("can't follow yourself", () =>
  as(alice, () => q(`insert into public.follows (followee_id) values ($1)`, [alice])));
await denied("can't follow in someone else's name", () =>
  as(alice, () => q(`insert into public.follows (follower_id, followee_id) values ($1, $2)`, [mallory, carol])));
await expectCount("follower counts are public", 1, () =>
  as(null, () => q(`select 1 from public.follows where followee_id = $1`, [mallory])));
await q(`update public.profiles set banned_until = 'infinity' where id = $1`, [mallory]);
await denied("banned user can't follow", () =>
  as(mallory, () => q(`insert into public.follows (followee_id) values ($1)`, [alice])));
await q(`update public.profiles set banned_until = null where id = $1`, [mallory]);
await denied("can't remove someone else's follow", () =>
  as(mallory, () => q(`delete from public.follows where follower_id = $1`, [alice])));
await allowed("user unfollows", () =>
  as(alice, async () => {
    const r = await q(`delete from public.follows where follower_id = $1 and followee_id = $2`, [alice, mallory]);
    if (r.affectedRows !== 1) throw new Error("0 rows");
  }));

// ---------- feed (החממה) ----------
console.log("\nFeed");
let postId;
await allowed("user writes a post", () =>
  as(alice, async () => {
    const { rows } = await q(`insert into public.posts (body) values ('עלה חדש במונסטרה!') returning id`);
    postId = rows[0].id;
  }));
await allowed("user adds a photo from their own folder", () =>
  as(alice, () => q(`insert into public.post_media (post_id, storage_path) values ($1, $2)`, [postId, `feed/${alice}/a.webp`])));
await denied("photo from someone else's folder is rejected", () =>
  as(alice, () => q(`insert into public.post_media (post_id, storage_path) values ($1, $2)`, [postId, `feed/${mallory}/x.webp`])));
await denied("more than 4 photos is rejected", () =>
  as(alice, async () => {
    for (let i = 0; i < 4; i++) await q(`insert into public.post_media (post_id, storage_path) values ($1, $2)`, [postId, `feed/${alice}/${i}.webp`]);
  }));
await denied("can't post in someone else's name", () =>
  as(alice, () => q(`insert into public.posts (author_id, body) values ($1, 'x')`, [mallory])));
await denied("visitors can't post", () => as(null, () => q(`insert into public.posts (body) values ('x')`)));
await expectCount("visitors read public posts", 1, () => as(null, () => q(`select id from public.posts where id = $1`, [postId])));
await allowed("user likes a post", () => as(mallory, () => q(`insert into public.reactions (post_id) values ($1)`, [postId])));
await expectCount("like counter goes up", 1, () => q(`select like_count as n from public.posts where id = $1`, [postId]));
await denied("can't like twice", () => as(mallory, () => q(`insert into public.reactions (post_id) values ($1)`, [postId])));
await allowed("user comments", () => as(mallory, () => q(`insert into public.comments (post_id, body) values ($1, ' יפה! ')`, [postId])));
await expectCount("comment counter goes up", 1, () => q(`select comment_count as n from public.posts where id = $1`, [postId]));
await denied("user can't change counters", () =>
  as(alice, () => q(`update public.posts set like_count = 999 where id = $1`, [postId])));
await denied("others can't delete the post", () =>
  as(mallory, () => q(`delete from public.posts where id = $1`, [postId])));
await q(`update public.profiles set banned_until = 'infinity' where id = $1`, [mallory]);
await denied("banned user can't post", () => as(mallory, () => q(`insert into public.posts (body) values ('x')`)));
await denied("banned user can't comment", () =>
  as(mallory, () => q(`insert into public.comments (post_id, body) values ($1, 'x')`, [postId])));
await q(`update public.profiles set banned_until = null where id = $1`, [mallory]);
await denied("more than 5 posts in 10 minutes is blocked", () =>
  as(mallory, async () => {
    for (let i = 0; i < 6; i++) await q(`insert into public.posts (body) values ($1)`, [`p${i}`]);
  }));
await allowed("user reports a post", () =>
  as(dave, () => q(`insert into public.reports (user_id, post_id, reason) values ($1, $2, 'spam')`, [alice, postId])));
await allowed("admin deletes a post", () =>
  as(carol, async () => {
    const r = await q(`delete from public.posts where id = $1`, [postId]);
    if (r.affectedRows !== 1) throw new Error("0 rows");
  }));
await allowed("author deletes own post", () =>
  as(mallory, async () => {
    const r = await q(`delete from public.posts where author_id = $1`, [mallory]);
    if (r.affectedRows < 1) throw new Error("0 rows");
  }));

// ---------- plant database ----------
console.log("\nPlant database");
const { rows: anySp } = await q(`select id, slug from public.species order by slug limit 1`);
const spId = anySp[0].id;
await denied("regular user can't edit a species", () =>
  as(alice, () => q(`update public.species set summary_he = 'x' where id = $1`, [spId])));
await q(`update public.profiles set role = 'author' where id = $1`, [mallory]);
await denied("authors can't edit species", () =>
  as(mallory, () => q(`update public.species set summary_he = 'x' where id = $1`, [spId])));
await q(`update public.profiles set role = 'user' where id = $1`, [mallory]);
await allowed("admin edits a species", () =>
  as(carol, async () => {
    const r = await q(`update public.species set summary_he = 'עודכן' where id = $1`, [spId]);
    if (r.affectedRows !== 1) throw new Error("0 rows");
  }));
await allowed("admin edits care info", () =>
  as(carol, () => q(`update public.species_care set water_notes_he = 'עודכן' where species_id = $1`, [spId])));
await allowed("admin adds a photo", () =>
  as(carol, () => q(`insert into public.species_images (species_id, storage_path) values ($1, 'https://img.test/species/a.webp')`, [spId])));
await denied("user can't add a photo", () =>
  as(alice, () => q(`insert into public.species_images (species_id, storage_path) values ($1, 'https://img.test/x.webp')`, [spId])));

console.log("\nSpecies suggestions");
await q(`update public.profiles set role = 'author', banned_until = null where id = $1`, [mallory]);
let sugId;
await allowed("author suggests a new plant", () =>
  as(mallory, async () => {
    const { rows } = await q(`insert into public.species_suggestions (common_name_he, scientific_name, category, data) values ('פטוניה', 'Petunia hybrida', 'garden', '{"summary_he":"פורחת"}') returning id`);
    sugId = rows[0].id;
  }));
await denied("regular user can't suggest", () =>
  as(alice, () => q(`insert into public.species_suggestions (common_name_he, scientific_name, category) values ('אא', 'Aaa bbb', 'garden')`)));
await denied("author can't approve own suggestion", () =>
  as(mallory, () => q(`update public.species_suggestions set status = 'approved' where id = $1`, [sugId])));
await allowed("author edits own pending suggestion", () =>
  as(mallory, () => q(`update public.species_suggestions set common_name_he = 'פטוניה כפולה' where id = $1`, [sugId])));
await expectCount("others can't see the suggestion", 0, () =>
  as(alice, () => q(`select id from public.species_suggestions where id = $1`, [sugId])));
await expectCount("admin sees pending suggestions", 1, () =>
  as(carol, () => q(`select id from public.species_suggestions where status = 'pending'`)));
await allowed("admin approves", () =>
  as(carol, () => q(`update public.species_suggestions set status = 'approved' where id = $1`, [sugId])));
await expectCount("reviewer is stamped", 1, () =>
  q(`select 1 from public.species_suggestions where id = $1 and reviewed_by = $2`, [sugId, carol]));
await denied("author can't edit after review", () =>
  as(mallory, () => q(`update public.species_suggestions set common_name_he = 'שינוי' where id = $1`, [sugId])));
await q(`update public.profiles set role = 'user' where id = $1`, [mallory]);

// ---------- chief editor ----------
console.log("\nChief editor");
const chief = await createUser("chief", "editor");
const writer = await createUser("writer", "author");
let artId;
await as(writer, async () => {
  const { rows } = await q(`insert into public.magazine_articles (title, status) values ('כתבה לאישור', 'pending') returning id`);
  artId = rows[0].id;
});
await expectCount("chief editor sees the review queue", 1, () =>
  as(chief, () => q(`select id from public.magazine_articles where id = $1`, [artId])));
await allowed("chief editor approves an article", () =>
  as(chief, async () => {
    const r = await q(`update public.magazine_articles set status = 'published' where id = $1`, [artId]);
    if (r.affectedRows !== 1) throw new Error("0 rows");
  }));
await denied("an author still can't publish", () =>
  as(writer, () => q(`insert into public.magazine_articles (title, status) values ('x', 'published')`)));
await allowed("chief editor writes own articles", () =>
  as(chief, () => q(`insert into public.magazine_articles (title) values ('טיוטה של העורך')`)));
let sug2;
await as(writer, async () => {
  const { rows } = await q(`insert into public.species_suggestions (common_name_he, scientific_name, category) values ('לבנדר', 'Lavandula angustifolia', 'herb') returning id`);
  sug2 = rows[0].id;
});
await allowed("chief editor approves a plant suggestion", () =>
  as(chief, async () => {
    const r = await q(`update public.species_suggestions set status = 'approved' where id = $1`, [sug2]);
    if (r.affectedRows !== 1) throw new Error("0 rows");
  }));
await allowed("chief editor edits plant info", () =>
  as(chief, async () => {
    const r = await q(`update public.species set summary_he = 'עורך ראשי' where id = $1`, [spId]);
    if (r.affectedRows !== 1) throw new Error("0 rows");
  }));
await allowed("chief editor logs the review", () =>
  as(chief, () => q(`insert into public.admin_actions (admin_id, action) values ($1, 'approve_article')`, [chief])));
await expectCount("chief editor can't read reports", 0, () => as(chief, () => q(`select id from public.reports`)));
await expectCount("chief editor can't read the admin log", 0, () => as(chief, () => q(`select id from public.admin_actions`)));
await denied("chief editor can't change roles", () =>
  as(chief, () => q(`update public.profiles set role = 'author' where id = $1`, [alice])));
await denied("chief editor can't ban", () =>
  as(chief, () => q(`update public.profiles set banned_until = 'infinity' where id = $1`, [alice])));

// ---------- my plants ----------
console.log("\nMy plants");
let alicePlace, alicePlant, malloryPlace;
await allowed("user adds a place with a window direction", () =>
  as(alice, async () => {
    const { rows } = await q(`insert into public.locations (name, kind, direction) values ('מרפסת', 'balcony', 'sw') returning id`);
    alicePlace = rows[0].id;
  }));
await denied("place with a bad direction is rejected", () =>
  as(alice, () => q(`insert into public.locations (name, kind, direction) values ('x', 'room', 'up')`)));
await as(mallory, async () => {
  const { rows } = await q(`insert into public.locations (name) values ('סלון')`);
  malloryPlace = rows[0]?.id;
});
{
  const { rows } = await q(`select id from public.locations where user_id = $1`, [mallory]);
  malloryPlace = rows[0].id;
}
await allowed("user adds a plant from the database to their place", () =>
  as(alice, async () => {
    const { rows } = await q(
      `insert into public.user_plants (species_id, location_id, nickname) values ((select id from public.species limit 1), $1, 'מוני') returning id`,
      [alicePlace]);
    alicePlant = rows[0].id;
  }));
await allowed("user adds a plant that isn't in the database", () =>
  as(alice, () => q(`insert into public.user_plants (species_name, location_id) values ('פטוניה כפולה', $1)`, [alicePlace])));
await denied("can't put a plant in someone else's place", () =>
  as(alice, () => q(`insert into public.user_plants (species_name, location_id) values ('פטוניה', $1)`, [malloryPlace])));
await allowed("user logs watering", () =>
  as(alice, () => q(`insert into public.care_events (user_plant_id, type) values ($1, 'water')`, [alicePlant])));
await expectCount("last watering shows in the summary view", 1, () =>
  as(alice, () => q(`select 1 from public.user_plant_last_care where user_plant_id = $1 and last_water_at is not null`, [alicePlant])));
await q(`update public.user_plants set visibility = 'public' where id = $1`, [alicePlant]);
await denied("can't log care on someone else's (even public) plant", () =>
  as(mallory, () => q(`insert into public.care_events (user_plant_id, type) values ($1, 'water')`, [alicePlant])));
await denied("can't add a photo to someone else's plant", () =>
  as(mallory, () => q(`insert into public.plant_photos (user_plant_id, storage_path) values ($1, 'x')`, [alicePlant])));
await expectCount("others don't see my care log", 0, () => as(mallory, () => q(`select 1 from public.care_events`)));
await expectCount("others don't see my places", 0, () =>
  as(mallory, () => q(`select 1 from public.locations where user_id = $1`, [alice])));
await denied("others can't edit my plant", () =>
  as(mallory, () => q(`update public.user_plants set nickname = 'x' where id = $1`, [alicePlant])));
await denied("water rhythm must be 1–90 days", () =>
  as(alice, () => q(`update public.user_plants set water_every_days = 0 where id = $1`, [alicePlant])));
await allowed("deleting a place keeps its plants", () =>
  as(alice, async () => {
    await q(`delete from public.locations where id = $1`, [alicePlace]);
    const r = await q(`select 1 from public.user_plants where id = $1 and location_id is null`, [alicePlant]);
    if (r.rows.length !== 1) throw new Error("plant gone");
  }));

// ---------- security hardening (0019) ----------
console.log("\nSecurity hardening");
{
  const eve = await createUser("eve");
  const { rows: evePost } = await as(eve, () => q(`insert into public.posts (body) values ('שלום') returning id`));
  await q(`update public.profiles set banned_until = now() + interval '7 days', ban_reason = 'ספאם', settings = '{"theme":"dark"}' where id = $1`, [eve]);
  await denied("banned user can't edit their profile", () =>
    as(eve, async () => {
      const r = await q(`update public.profiles set bio = 'קנו עכשיו' where id = $1`, [eve]);
      if (r.affectedRows !== 1) throw new Error("0 rows");
    }));
  await denied("banned user can't edit their old posts", () =>
    as(eve, async () => {
      const r = await q(`update public.posts set body = 'ספאם' where id = $1`, [evePost[0].id]);
      if (r.affectedRows !== 1) throw new Error("0 rows");
    }));
  await denied("banned user can't follow", () => as(eve, () => q(`insert into public.follows (followee_id) values ($1)`, [alice])));
  await denied("visitors can't read the ban reason", () => as(null, () => q(`select ban_reason from public.profiles where id = $1`, [eve])));
  await denied("other users can't read someone's settings", () => as(alice, () => q(`select settings from public.profiles where id = $1`, [eve])));
  await expectCount("public profile fields are still readable", 1, () =>
    as(null, () => q(`select username, display_name, avatar_url, role, banned_until from public.profiles where id = $1`, [eve])));
  await expectCount("users read their own settings through my_settings()", 1, () =>
    as(eve, () => q(`select 1 from public.my_settings() s where s->>'theme' = 'dark'`)));
  await expectCount("admins see ban reasons", 1, () =>
    as(carol, () => q(`select 1 from public.admin_ban_reasons($1) where ban_reason = 'ספאם'`, [[eve]])));
  await expectCount("…other users don't", 0, () => as(alice, () => q(`select 1 from public.admin_ban_reasons($1)`, [[eve]])));
  await allowed("admin can still unban", () =>
    as(carol, async () => {
      const r = await q(`update public.profiles set banned_until = null, ban_reason = null where id = $1`, [eve]);
      if (r.affectedRows !== 1) throw new Error("0 rows");
    }));
  await allowed("…and then the user can edit again", () =>
    as(eve, async () => {
      const r = await q(`update public.profiles set bio = 'חזרתי' where id = $1`, [eve]);
      if (r.affectedRows !== 1) throw new Error("0 rows");
    }));
}

// ---------- data integrity (0020) ----------
console.log("\nData integrity");
{
  const fran = await createUser("fran");
  const photos = [`https://img.test/market/${fran}/a.webp`];
  let lid;
  await allowed("save_listing creates the listing and its phone together", () =>
    as(fran, async () => {
      const { rows } = await q(`select public.save_listing(null, $1, null, 'houseplant', 30, null, null, 'חיפה', null, $2, '050-1234567', true) as id`, [speciesId, photos]);
      lid = rows[0].id;
      const c = await q(`select 1 from public.market_listing_contacts where listing_id = $1`, [lid]);
      if (c.rows.length !== 1) throw new Error("no contact");
    }));
  await expectCount("…a bad phone rolls back the whole listing", 1, () =>
    as(fran, async () => {
      await q(`select public.save_listing(null, $1, null, 'houseplant', 30, null, null, null, null, $2, 'not-a-phone', false)`, [speciesId, photos]).catch(() => null);
      return q(`select count(*)::int as n from public.market_listings where seller_id = $1`, [fran]);
    }));
  await denied("save_listing can't edit someone else's listing", () =>
    as(alice, () => q(`select public.save_listing($1, $2, null, 'houseplant', 1, null, null, null, null, $3, '050-1234567', false)`, [lid, speciesId, photos])));
  await expectCount("market category counts come from the database", 1, () =>
    as(null, () => q(`select 1 where (select sum(n) from public.market_category_counts()) >= 1`)));

  await allowed("create_post saves the post and its photos together", () =>
    as(fran, async () => {
      const { rows } = await q(`select public.create_post('שלום', 'post', null, $1) as id`, [[`feed/${fran}/a.webp`, `feed/${fran}/b.webp`]]);
      const m = await q(`select count(*)::int as n from public.post_media where post_id = $1`, [rows[0].id]);
      if (m.rows[0].n !== 2) throw new Error("photos missing");
    }));
  await expectCount("…a photo from someone else's folder rolls back the post", 1, () =>
    as(fran, async () => {
      await q(`select public.create_post('x', 'post', null, $1)`, [[`feed/${alice}/a.webp`]]).catch(() => null);
      return q(`select count(*)::int as n from public.posts where author_id = $1`, [fran]);
    }));

  await allowed("create_user_plant saves the plant and its first watering together", () =>
    as(fran, async () => {
      const { rows } = await q(`select public.create_user_plant(null, 'פטוניה', null, null, null, null, null, null, null, null, now() - interval '1 day') as id`);
      const w = await q(`select 1 from public.care_events where user_plant_id = $1 and type = 'water'`, [rows[0].id]);
      if (w.rows.length !== 1) throw new Error("no watering");
    }));

  // reports keep their evidence
  const { rows: fp } = await as(fran, () => q(`insert into public.posts (body) values ('קנו עוקבים בזול') returning id`));
  await allowed("reporting a post takes the account from the post itself", () =>
    as(alice, async () => {
      await q(`insert into public.reports (user_id, post_id, reason) values ($1, $2, 'spam')`, [mallory, fp[0].id]);
    }));
  await expectCount("…the report is about the post's author, with a copy of the post", 1, () =>
    q(`select 1 from public.reports where post_id = $1 and user_id = $2 and snapshot->>'body' = 'קנו עוקבים בזול'`, [fp[0].id, fran]));
  await as(fran, () => q(`delete from public.posts where id = $1`, [fp[0].id]));
  await expectCount("deleting the post doesn't erase the report", 1, () =>
    q(`select 1 from public.reports where post_id = $1`, [fp[0].id]));

  await denied("tables the site doesn't use can't be written", () =>
    as(fran, () => q(`insert into public.feed_impressions (user_id, post_id) values ($1, $2)`, [fran, fp[0].id])));

  await q(`insert into public.user_plants (user_id, species_name) select $1, 'צמח ' || g from generate_series(1, 499) g`, [fran]);
  await denied("501st plant is blocked by the database", () =>
    as(fran, () => q(`insert into public.user_plants (species_name) values ('עוד אחד')`)));

  await denied("users can't call the login rate limiter", () =>
    as(alice, () => q(`select public.auth_rate_check('login:ip:1', 5, interval '1 minute')`)));
  await expectCount("the server's rate limiter allows 3 then blocks", 1, async () => {
    await db.exec("set role service_role");
    try {
      const r = [];
      for (let i = 0; i < 4; i++) r.push((await q(`select public.auth_rate_check('test:k', 3, interval '1 hour') as ok`)).rows[0].ok);
      return { rows: r.join(",") === "true,true,true,false" ? [{}] : [] };
    } finally {
      await db.exec("reset role");
    }
  });
}

// ---------- policy performance (0022) ----------
console.log("\nPolicy performance");
await expectCount("no security rule calls auth.uid() once per row", 0, () =>
  q(`select 1 from pg_policies where schemaname = 'public' and (qual ~ '(?<!SELECT )auth\\.uid\\(\\)' or with_check ~ '(?<!SELECT )auth\\.uid\\(\\)')`));
{
  const { rows } = await q(`select count(*)::int as n from pg_policies where schemaname = 'public' and (qual ~ 'SELECT auth\\.uid\\(\\)' or with_check ~ 'SELECT auth\\.uid\\(\\)')`);
  if (rows[0].n >= 30) pass(`…${rows[0].n} rules use the once-per-query form`);
  else fail(`expected 30+ rewritten rules, got ${rows[0].n}`);
}

// ---------- cascade ----------
console.log("\nAccount deletion");
await q(`delete from auth.users where id = $1`, [bob]);
await expectCount("deleting an account removes profile and articles", 0, () =>
  q(`select 1 from public.profiles where id = $1 union all select 1 from public.magazine_articles where author_id = $1`, [bob]));

console.log(failed ? `\n${failed} check(s) failed` : "\nAll database checks passed");
process.exitCode = failed ? 1 : 0;
