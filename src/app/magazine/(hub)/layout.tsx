import Link from "next/link";
import { PenLine } from "lucide-react";
import { HubTabs } from "@/components/magazine/hub-tabs";

/** The magazine is the home of all reading content: articles, the plant database and the blog. */
export default function MagazineHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-primary">המגזין של פלנטריום</p>
        <Link href="/magazine/write" className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-primary">
          <PenLine className="size-4" aria-hidden />
          אזור הכותבים
        </Link>
      </div>
      <HubTabs />
      {children}
    </div>
  );
}
