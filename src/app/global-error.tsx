"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring/client";
import "./globals.css";

/** Last resort when even the main layout fails. Must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body className="bg-bg text-text">
        <main role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-2xl font-bold">פלנטריום לא זמין כרגע</h1>
          <p className="text-muted">משהו השתבש אצלנו. נסו לרענן בעוד רגע.</p>
          {error.digest && <p className="ltr text-xs text-muted">קוד: {error.digest}</p>}
          <button type="button" onClick={reset} className="mt-2 rounded-full bg-primary px-5 py-2 font-semibold text-on-primary">
            לנסות שוב
          </button>
        </main>
      </body>
    </html>
  );
}
