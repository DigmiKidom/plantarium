"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { ArrowUp, Compass, Loader2 } from "lucide-react";
import { savePlace } from "@/lib/plants/actions";
import { placeLightHe } from "@/lib/plants/care";
import { DIRECTION_HE, PLACE_KINDS, PLACE_KIND_HE, type Direction, type Place, type PlaceKind } from "@/lib/plants/types";
import { PLACE_ICON } from "./bits";
import { cn } from "@/lib/cn";

// Geographic layout (north up, east right) – the grid is forced LTR so RTL doesn't mirror the compass.
const GRID: (Direction | null)[] = ["nw", "n", "ne", "w", null, "e", "sw", "s", "se"];
const ORDER: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

const noop = () => () => {};
const CARDINAL: Partial<Record<Direction, string>> = { n: "צפון", e: "מזרח", s: "דרום", w: "מערב" };
const ANGLE: Record<Direction, number> = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };

type OrientationEventCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

/** Reads the phone compass once (phone flat on the sill, top pointing out of the window). */
async function readCompass(): Promise<Direction> {
  const Ctor = (typeof DeviceOrientationEvent !== "undefined" ? DeviceOrientationEvent : undefined) as OrientationEventCtor | undefined;
  if (!Ctor) throw new Error("no-sensor");
  if (typeof Ctor.requestPermission === "function" && (await Ctor.requestPermission()) !== "granted") throw new Error("denied");
  return new Promise((resolve, reject) => {
    const events = ["deviceorientationabsolute", "deviceorientation"] as const;
    const done = (fn: () => void) => {
      events.forEach((e) => window.removeEventListener(e, handler as EventListener));
      clearTimeout(timer);
      fn();
    };
    const handler = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const heading = typeof e.webkitCompassHeading === "number" ? e.webkitCompassHeading : e.absolute && e.alpha != null ? 360 - e.alpha : null;
      if (heading == null) return;
      done(() => resolve(ORDER[Math.round((((heading % 360) + 360) % 360) / 45) % 8]));
    };
    const timer = setTimeout(() => done(() => reject(new Error("timeout"))), 4000);
    events.forEach((e) => window.addEventListener(e, handler as EventListener));
  });
}

export function DirectionPicker({ kind, value, onChange }: { kind: PlaceKind; value: Direction | null; onChange: (d: Direction | null) => void }) {
  const [reading, setReading] = useState(false);
  const [msg, setMsg] = useState<string>();
  const touch = useSyncExternalStore(
    noop,
    () => "ontouchstart" in window,
    () => false,
  );

  const detect = async () => {
    setReading(true);
    setMsg(undefined);
    try {
      const d = await readCompass();
      onChange(d);
      setMsg(`זוהה: ${DIRECTION_HE[d]}`);
    } catch {
      setMsg("לא הצלחנו לקרוא את המצפן – בחרו ידנית");
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-4">
        <div dir="ltr" role="radiogroup" aria-label="לאן פונה החלון" className="relative grid w-48 grid-cols-3 gap-1.5 rounded-full border border-border bg-surface-2 p-2">
          {GRID.map((d, i) => {
            const selected = value === d;
            const label = d ? DIRECTION_HE[d] : kind === "room" ? "בלי חלון" : "לא יודע/ת";
            return (
              <button
                key={d ?? `c${i}`}
                type="button"
                role="radio"
                aria-checked={selected}
                title={label}
                onClick={() => onChange(d)}
                className={cn(
                  "grid aspect-square place-items-center rounded-full text-[11px] font-bold transition",
                  d ? "" : "text-[10px] font-medium leading-tight",
                  selected ? "bg-primary text-on-primary" : "bg-surface text-muted hover:text-primary",
                )}
              >
                {d ? (
                  d.length === 1 ? (
                    CARDINAL[d]
                  ) : (
                    <ArrowUp className="size-4" style={{ transform: `rotate(${ANGLE[d]}deg)` }} aria-hidden />
                  )
                ) : kind === "room" ? (
                  "אין חלון"
                ) : (
                  "?"
                )}
                <span className="sr-only">{label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">{value ? `פונה ל${DIRECTION_HE[value]}` : kind === "room" ? "בלי חלון" : "כיוון לא ידוע"}</span>
          <span className="text-muted">{placeLightHe({ kind, direction: value })}</span>
          {touch && (
            <button type="button" onClick={detect} disabled={reading} className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium hover:text-primary">
              {reading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Compass className="size-4" aria-hidden />}
              זיהוי עם המצפן של הטלפון
            </button>
          )}
          {msg && <span className="text-xs text-muted">{msg}</span>}
        </div>
      </div>
      <p className="text-xs text-muted">
        לאן החלון (או המרפסת) פונה? {touch ? "להניח את הטלפון שטוח על אדן החלון, כשהחלק העליון מצביע החוצה, וללחוץ על זיהוי." : "טיפ: במצפן של הטלפון, עומדים מול החלון ובודקים לאן מסתכלים."}
      </p>
    </div>
  );
}

export function PlaceForm({
  initial,
  onSaved,
  onCancel,
  compact,
}: {
  initial?: Place;
  onSaved: (p: Place) => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<PlaceKind>(initial?.kind ?? "room");
  const [direction, setDirection] = useState<Direction | null>(initial?.direction ?? null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(undefined);
      const res = await savePlace({ id: initial?.id, name, kind, direction });
      if (!res.ok) return setError(res.error);
      onSaved({ id: res.id, name: name.trim(), kind, direction });
    });

  return (
    <div className={cn("flex flex-col gap-4", !compact && "rounded-3xl border border-border bg-surface p-5")}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="place-name" className="text-sm font-medium">
          שם המקום
        </label>
        <input
          id="place-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="למשל: סלון, חלון המטבח, מרפסת השינה"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className="w-full rounded-xl border border-border bg-bg px-3.5 py-3 outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">סוג</span>
        <div className="grid grid-cols-3 gap-2">
          {PLACE_KINDS.map((k) => {
            const Icon = PLACE_ICON[k];
            return (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-sm transition",
                  kind === k ? "border-primary bg-leaf-soft font-semibold text-primary-strong" : "border-border hover:bg-surface-2",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {PLACE_KIND_HE[k]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{kind === "room" ? "כיוון החלון" : kind === "balcony" ? "כיוון המרפסת" : "באיזה צד של הבית"}</span>
        <DirectionPicker kind={kind} value={direction} onChange={setDirection} />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-accent-soft px-4 py-2 text-sm text-accent">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {initial ? "שמירה" : "הוספת המקום"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2.5 text-sm text-muted hover:bg-surface-2">
            ביטול
          </button>
        )}
      </div>
    </div>
  );
}
