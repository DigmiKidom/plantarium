"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { saveSettings } from "@/lib/settings/actions";
import { applyTheme, currentTheme } from "@/lib/settings/client";
import type { Settings, Theme } from "@/lib/settings/schema";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-6 shadow-sm md:p-8">
      <h2 className="text-xl font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  icon: Icon,
  label,
  preview,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  label: string;
  preview: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-1 flex-col gap-3 rounded-2xl border-2 p-3 text-start transition",
        selected ? "border-primary" : "border-border hover:border-muted",
      )}
    >
      <span className={cn("block h-20 w-full rounded-xl border border-border", preview)} aria-hidden>
        <span className="m-3 block h-2.5 w-1/2 rounded-full bg-current opacity-60" />
        <span className="mx-3 block h-2.5 w-1/3 rounded-full bg-current opacity-30" />
      </span>
      <span className="flex items-center justify-between gap-2 font-medium">
        <span className="flex items-center gap-2">
          <Icon className="size-4" aria-hidden />
          {label}
        </span>
        {selected && <Check className="size-4 text-primary" aria-hidden />}
      </span>
    </button>
  );
}

export function SettingsView({ signedIn, initial }: { signedIn: boolean; initial: Settings }) {
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [status, setStatus] = useState<string>("");
  const [pending, start] = useTransition();

  // Make the page match the saved choice (a signed-in user's account setting wins on every device).
  useEffect(() => {
    if (initial.theme !== currentTheme()) applyTheme(initial.theme);
  }, [initial.theme]);

  const update = (patch: Partial<Settings>) => {
    if (patch.theme) {
      applyTheme(patch.theme);
      setTheme(patch.theme);
    }
    start(async () => {
      const res = await saveSettings(patch);
      setStatus(!res.ok ? "השמירה נכשלה" : res.saved === "account" ? "נשמר בחשבון שלך" : "נשמר בדפדפן הזה");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="מראה" description="איך האתר נראה אצלך.">
        <div role="radiogroup" aria-label="ערכת צבעים" className="flex flex-col gap-3 sm:flex-row">
          <ChoiceCard
            selected={theme === "light"}
            onSelect={() => update({ theme: "light" })}
            icon={Sun}
            label="בהיר"
            preview="bg-white text-[#16211a]"
          />
          <ChoiceCard
            selected={theme === "dark"}
            onSelect={() => update({ theme: "dark" })}
            icon={Moon}
            label="כהה"
            preview="bg-[#111613] text-[#e7ece8]"
          />
        </div>
      </Section>

      <Section title="חשבון">
        {signedIn ? (
          <p className="text-sm text-muted">
            שם, שם משתמש ותיאור – ב
            <Link href="/profile" className="font-medium text-primary hover:underline">
              עמוד הפרופיל
            </Link>
            .
          </p>
        ) : (
          <p className="text-sm text-muted">
            ההגדרות נשמרות בדפדפן הזה.{" "}
            <Link href="/login?next=/settings" className="font-medium text-primary hover:underline">
              התחברו
            </Link>{" "}
            כדי לשמור אותן בחשבון ולקבל אותן בכל מכשיר.
          </p>
        )}
      </Section>

      <p className="h-5 text-sm text-muted" role="status" aria-live="polite">
        {pending ? "שומר…" : status}
      </p>
    </div>
  );
}
