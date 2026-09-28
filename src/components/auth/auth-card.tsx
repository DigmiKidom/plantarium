export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-6 md:py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="פלנטריום" width={1200} height={279} className="h-14 w-auto dark:brightness-150" />
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted">{subtitle}</p>
      </div>
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm md:p-8">{children}</div>
    </div>
  );
}

export const nextFrom = (v: string | string[] | undefined) => {
  const s = typeof v === "string" ? v : "/";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};
