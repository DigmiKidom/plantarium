"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  ltr?: boolean;
};

export function Field({ label, name, error, hint, ltr, className, ...rest }: FieldProps) {
  const id = `f-${name}`;
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        dir={ltr ? "ltr" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-xl border bg-bg px-3.5 py-3 outline-none transition focus:border-primary",
          ltr && "text-start",
          error ? "border-accent" : "border-border",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${id}-err`} className="text-sm text-accent">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60",
        className,
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function FormAlert({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "rounded-xl px-4 py-3 text-sm",
        error ? "bg-accent-soft text-accent" : "bg-leaf-soft text-primary-strong",
      )}
    >
      {error ?? message}
    </p>
  );
}
