import Link from "next/link";
import { Sprout } from "lucide-react";

export function ComingSoon({ title, description, stage }: { title: string; description: string; stage: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-leaf-soft text-primary">
        <Sprout className="size-8" aria-hidden />
      </span>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted">{description}</p>
      <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">בפיתוח · {stage}</span>
      <Link href="/knowledge" className="mt-2 text-primary underline">
        בינתיים, לעיון במאגר הצמחים
      </Link>
    </div>
  );
}
