import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "הצמחים שלי" };

export default function Page() {
  return <ComingSoon title="הצמחים שלי" description="כל הצמחים שלך במקום אחד: תמונות, מיקום, היסטוריית השקיה ודישון." stage="V1" />;
}
