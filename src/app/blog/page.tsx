import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "בלוג" };

export default function Page() {
  return <ComingSoon title="בלוג" description="מדריכים ומאמרים על גידול צמחים, מחוברים לדפי הצמחים במאגר." stage="V1" />;
}
