import type { Metadata } from "next";
import { CalendarDays, LogOut, Mail } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { ProfileForm } from "@/components/auth/profile-form";

export const metadata: Metadata = { title: "הפרופיל שלי", robots: { index: false } };
export const dynamic = "force-dynamic"; // per-user page, never prerendered

export default async function ProfilePage() {
  const { user, profile } = await requireUser("/profile");
  const name = profile?.display_name || user.email || "";
  const joined = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(
    new Date(profile?.created_at ?? user.created_at),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header className="flex items-center gap-4">
        <span className="grid size-20 shrink-0 place-items-center rounded-full bg-primary text-3xl font-bold text-on-primary" aria-hidden>
          {name.charAt(0)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold">{name}</h1>
          {profile?.username && <p className="ltr text-muted">@{profile.username}</p>}
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <li className="flex items-center gap-1">
              <Mail className="size-4" aria-hidden />
              <span className="ltr">{user.email}</span>
            </li>
            <li className="flex items-center gap-1">
              <CalendarDays className="size-4" aria-hidden />
              הצטרפות: {joined}
            </li>
          </ul>
        </div>
      </header>

      <section aria-labelledby="edit" className="rounded-3xl border border-border bg-surface p-6 md:p-8">
        <h2 id="edit" className="mb-4 text-xl font-bold">
          עריכת פרופיל
        </h2>
        <ProfileForm
          initial={{
            displayName: profile?.display_name ?? "",
            username: profile?.username ?? "",
            bio: profile?.bio ?? "",
          }}
        />
      </section>

      <form action={signOut}>
        <button type="submit" className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:border-accent hover:text-accent">
          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
          התנתקות
        </button>
      </form>
    </div>
  );
}
