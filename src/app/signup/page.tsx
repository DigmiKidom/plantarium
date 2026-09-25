import type { Metadata } from "next";
import { AuthCard, nextFrom } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "הרשמה", robots: { index: false } };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const next = nextFrom((await searchParams).next);
  return (
    <AuthCard title="הצטרפות לפלנטריום" subtitle="חשבון חינמי: הצמחים שלך, תזכורות וקהילה">
      <SignUpForm next={next} />
    </AuthCard>
  );
}
