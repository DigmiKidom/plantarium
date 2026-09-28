"use server";

import { z } from "zod";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { REPORT_REASONS } from "./reasons";

const input = z.object({
  userId: z.uuid(),
  listingId: z.uuid().optional(),
  postId: z.uuid().optional(),
  reason: z.enum(REPORT_REASONS, { error: "נא לבחור סיבה" }),
  details: z.string().trim().max(1000, { error: "עד 1000 תווים" }).optional().default(""),
});

export type ReportResult = { ok: true } | { ok: false; error: string };

export async function reportUser(raw: z.input<typeof input>): Promise<ReportResult> {
  if (!hasSupabase()) return { ok: false, error: "Supabase לא מוגדר" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };

  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "צריך להתחבר כדי לדווח" };
  if (data.user.id === parsed.data.userId) return { ok: false, error: "אי אפשר לדווח על עצמך" };

  const { error } = await supabase.from("reports").insert({
    user_id: parsed.data.userId,
    listing_id: parsed.data.listingId ?? null,
    post_id: parsed.data.postId ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
  });
  if (error?.code === "23505") return { ok: false, error: parsed.data.postId ? "כבר דיווחת על הפוסט הזה. הדיווח בטיפול." : parsed.data.listingId ? "כבר דיווחת על המודעה הזו. הדיווח בטיפול." : "כבר דיווחת על החשבון הזה. הדיווח בטיפול." };
  if (error) {
    console.error(JSON.stringify({ at: "reports.reportUser", error: error.message }));
    return { ok: false, error: "הדיווח לא נשלח. נסו שוב" };
  }
  return { ok: true };
}
