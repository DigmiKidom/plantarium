import { HubTabs } from "@/components/magazine/hub-tabs";
import { WriterZoneLink } from "@/components/magazine/writer-zone-link";

/** The magazine is the home of all reading content: articles and the plant database. */
export default function MagazineHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-primary">המגזין של פלנטריום</p>
        <WriterZoneLink />
      </div>
      <HubTabs />
      {children}
    </div>
  );
}
