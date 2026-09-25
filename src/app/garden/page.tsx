import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "הגינה שלי" };

export default function Page() {
  return <ComingSoon title="הגינה שלי" description="גינות, חדרים ומיקומים – וכל צמח במקום האמיתי שלו." stage="V2" />;
}
