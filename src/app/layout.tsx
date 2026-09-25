import type { Metadata, Viewport } from "next";
import "@fontsource-variable/heebo";
import { SiteShell } from "@/components/site-shell";
import { themeInitScript } from "@/lib/settings/schema";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "פלנטריום – הבית הדיגיטלי של הצמחים שלך",
    template: "%s | פלנטריום",
  },
  description:
    "מאגר ידע על צמחים, ניהול הצמחים והגינה שלך, תזכורות השקיה וקהילה של מגדלים – הכל במקום אחד.",
  openGraph: { locale: "he_IL", siteName: "Plantarium" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className="antialiased" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme (light/dark) before the page paints */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
