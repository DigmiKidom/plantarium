/** Skeleton shown while a personal page loads. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="טוען…" className="flex animate-pulse flex-col gap-4">
      <div className="h-9 w-48 rounded-xl bg-surface-2" />
      <div className="h-4 w-72 max-w-full rounded-lg bg-surface-2" />
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-44 rounded-3xl bg-surface-2" />
        ))}
      </div>
      <span className="sr-only">טוען…</span>
    </div>
  );
}
