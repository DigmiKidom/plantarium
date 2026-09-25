import Link from "next/link";
import { Search } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { searchUsers } from "@/lib/admin/queries";
import { ROLES, ROLE_HE, isBannedNow, type Role } from "@/lib/auth/roles";
import { UserManage } from "@/components/admin/user-manage";
import { formatDate } from "@/lib/dates";

export const metadata = { title: "משתמשים" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { user } = await requireRole(["admin"], "/admin/users");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const role = typeof sp.role === "string" && (ROLES as readonly string[]).includes(sp.role) ? (sp.role as Role) : undefined;
  const banned = sp.banned === "1";
  const users = await searchUsers({ q, role, banned });

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap gap-2" role="search">
        <label className="relative min-w-52 flex-1">
          <span className="sr-only">חיפוש משתמש</span>
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="שם או שם משתמש"
            className="w-full rounded-full border border-border bg-bg py-2.5 pe-4 ps-9 outline-none focus:border-primary"
          />
        </label>
        <select name="role" defaultValue={role ?? ""} aria-label="תפקיד" className="rounded-full border border-border bg-bg px-4 py-2.5">
          <option value="">כל התפקידים</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_HE[r]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm">
          <input type="checkbox" name="banned" value="1" defaultChecked={banned} />
          מושעים בלבד
        </label>
        <button type="submit" className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary">
          חיפוש
        </button>
      </form>

      {users.length === 0 ? (
        <p className="p-8 text-center text-muted">לא נמצאו משתמשים</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {users.map((u) => {
            const isBanned = isBannedNow(u.banned_until);
            return (
              <li key={u.id} className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    {u.username ? (
                      <Link href={`/u/${u.username}`} className="font-bold hover:text-primary">
                        {u.display_name}
                      </Link>
                    ) : (
                      <span className="font-bold">{u.display_name}</span>
                    )}
                    {u.username && <span className="ltr ms-2 text-sm text-muted">@{u.username}</span>}
                    <span className="block text-xs text-muted">הצטרפות: {formatDate(u.created_at)}</span>
                  </span>
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{ROLE_HE[u.role]}</span>
                  {isBanned && (
                    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent" title={u.ban_reason ?? undefined}>
                      מושעה {u.banned_until === "infinity" ? "לצמיתות" : `עד ${formatDate(u.banned_until)}`}
                    </span>
                  )}
                </div>
                <UserManage
                  isSelf={u.id === user.id}
                  user={{ id: u.id, username: u.username, display_name: u.display_name, role: u.role, banned: isBanned }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
