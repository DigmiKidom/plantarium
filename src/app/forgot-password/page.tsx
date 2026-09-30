import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "שכחתי סיסמה", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="שכחתי סיסמה" subtitle="נשלח אליך קישור לבחירת סיסמה חדשה">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
