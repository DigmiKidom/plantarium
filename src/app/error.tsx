"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

/** Shown when a page fails to load (e.g. the database didn't answer). Keeps the site's menu around it. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
        <TriangleAlert className="size-8" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">משהו השתבש</h1>
      <p className="text-muted">העמוד לא נטען כמו שצריך. אפשר לנסות שוב, ואם זה חוזר – לחזור מאוחר יותר.</p>
      {error.digest && <p className="ltr text-xs text-muted">קוד: {error.digest}</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-semibold text-on-primary hover:bg-primary-strong"
        >
          <RotateCw className="size-4" aria-hidden />
          לנסות שוב
        </button>
        <Link href="/" className="rounded-full border border-border px-5 py-2 font-medium hover:bg-surface-2">
          לדף הבית
        </Link>
      </div>
    </div>
  );
}
