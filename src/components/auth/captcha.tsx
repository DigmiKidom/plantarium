"use client";

import { useEffect, useRef } from "react";

type Turnstile = { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void };
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
  return new Promise((resolve, reject) => {
    const s = existing ?? Object.assign(document.createElement("script"), { src: SRC, async: true, defer: true });
    s.addEventListener("load", () => resolve(), { once: true });
    s.addEventListener("error", () => reject(new Error("turnstile load failed")), { once: true });
    if (!existing) document.head.appendChild(s);
  });
}

/**
 * Cloudflare Turnstile inside a form: adds a hidden "cf-turnstile-response" field.
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set (the server then skips the check too).
 */
/** `resetKey`: pass the form state – a token works once, so the widget renews after every submit. */
export function Captcha({ resetKey }: { resetKey?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let id: string | undefined;
    let active = true;
    loadScript()
      .then(() => {
        if (active && ref.current && window.turnstile) {
          id = window.turnstile.render(ref.current, { sitekey: SITE_KEY, language: "he", theme: "auto", size: "flexible" });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [resetKey]);
  if (!SITE_KEY) return null;
  return <div ref={ref} className="min-h-[65px]" />;
}
