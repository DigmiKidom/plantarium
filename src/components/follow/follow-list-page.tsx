import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createPublicClient, hasSupabase } from "@/lib/supabase/server";
import { followList } from "@/lib/follows/queries";
import { Avatar } from "@/components/auth/me";

/** Shared page body for /u/[username]/followers and /following. */
export async function FollowListPage({ username, kind }: { username: string; kind: "followers" | "following" }) {
  if (!hasSupabase() || !/^[a-z0-9_]{3,24}$/.test(username)) notFound();
  const { data: profile } = await createPublicClient()
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", username)
    .maybeSingle<{ id: string; username: string; display_name: string }>();
  if (!profile) notFound();
  const people = await followList(profile.id, kind);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href={`/u/${profile.username}`} className="flex w-fit items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowRight className="size-4" aria-hidden />
        {profile.display_name}
      </Link>
      <div className="flex gap-2">
        {(["followers", "following"] as const).map((k) => (
          <Link
            key={k}
            href={`/u/${profile.username}/${k}`}
            aria-current={k === kind ? "page" : undefined}
            className={
              k === kind
                ? "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                : "rounded-full border border-border px-4 py-2 text-sm hover:bg-surface-2"
            }
          >
            {k === "followers" ? "עוקבים" : "במעקב"}
          </Link>
        ))}
      </div>
      {people.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">
          {kind === "followers" ? "עוד אין עוקבים." : "עוד לא עוקב/ת אחרי אף אחד."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-surface">
          {people.map((p) => (
            <li key={p.id}>
              <Link href={p.username ? `/u/${p.username}` : "#"} className="flex items-center gap-3 p-4 hover:bg-surface-2">
                <Avatar name={p.display_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.display_name}</span>
                  {p.username && <span className="ltr block text-xs text-muted">@{p.username}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
