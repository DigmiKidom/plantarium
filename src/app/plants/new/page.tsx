import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "הוספת צמח" };

export default function Page() {
  return <ComingSoon title="הוספת צמח" description="בוחרים צמח מהמאגר, מיקום בבית ותאריך – והמערכת בונה לוח טיפול." stage="V1" />;
}
