import type { Metadata } from "next";
import { AuthCard, nextFrom } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "התחברות", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = nextFrom((await searchParams).next);
  return (
    <AuthCard title="ברוכים השבים" subtitle="התחברו כדי לנהל את הצמחים שלכם">
      <LoginForm next={next} />
    </AuthCard>
  );
}
