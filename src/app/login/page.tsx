import type { Metadata } from "next";
import { AuthCard, nextFrom } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "התחברות", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = nextFrom(sp.next);
  return (
    <AuthCard title="ברוכים השבים" subtitle="התחברו כדי לנהל את הצמחים שלכם">
      {sp.banned === "1" && (
        <p role="alert" className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          החשבון הושעה על ידי צוות האתר ולכן נותקת.
        </p>
      )}
      <LoginForm next={next} />
    </AuthCard>
  );
}
