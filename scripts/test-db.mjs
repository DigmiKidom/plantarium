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

if (process.argv.includes("--seed")) {
  await db.exec(readFileSync(join(root, "supabase/seed.sql"), "utf8"));
  const { rows } = await db.query("select count(*)::int as n from public.species");
  console.log(`✅ seed loaded (${rows[0].n} species)`);
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
await as(alice, () => q(`insert into public.gardens (name) values ('בית')`));
await expectCount("users can't see each other's gardens", 0, () => as(mallory, () => q(`select id from public.gardens`)));

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

// ---------- cascade ----------
console.log("\nAccount deletion");
await q(`delete from auth.users where id = $1`, [bob]);
await expectCount("deleting an account removes profile and articles", 0, () =>
  q(`select 1 from public.profiles where id = $1 union all select 1 from public.magazine_articles where author_id = $1`, [bob]));

console.log(failed ? `\n${failed} check(s) failed` : "\nAll database checks passed");
process.exitCode = failed ? 1 : 0;
