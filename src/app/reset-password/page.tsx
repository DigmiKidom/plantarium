import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "סיסמה חדשה", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Reached from the reset email (via /auth/callback, which signs the user in for this). */
export default async function ResetPasswordPage() {
  await requireUser("/reset-password");
  return (
    <AuthCard title="סיסמה חדשה" subtitle="בחרו סיסמה חדשה לחשבון">
      <ResetPasswordForm />
    </AuthCard>
  );
}
