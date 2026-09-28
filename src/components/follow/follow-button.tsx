"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserCheck, UserPlus } from "lucide-react";
import { setFollow } from "@/lib/follows/actions";
import { cn } from "@/lib/cn";

export function FollowButton({
  userId,
  following,
  signedIn,
  loginNext,
  size = "md",
}: {
  userId: string;
  following: boolean;
  signedIn: boolean;
  loginNext: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [on, setOn] = useState(following);
  const [pending, startTransition] = useTransition();
  const cls = cn(
    "flex items-center gap-2 rounded-full font-semibold transition disabled:opacity-60",
    size === "sm" ? "px-3 py-1.5 text-sm" : "px-5 py-2",
    on ? "border border-border hover:border-accent hover:text-accent" : "bg-primary text-on-primary hover:bg-primary-strong",
  );

  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className={cls}>
        <UserPlus className="size-4" aria-hidden />
        מעקב
      </Link>
    );
  }

  const toggle = () => {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const res = await setFollow(userId, next);
      if (!res.ok) setOn(!next);
      else router.refresh();
    });
  };

  return (
    <button type="button" onClick={toggle} disabled={pending} aria-pressed={on} className={cls}>
      {on ? <UserCheck className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
      {on ? "במעקב" : "מעקב"}
    </button>
  );
}
