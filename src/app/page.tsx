import Link from "next/link";
import { BookOpen, CalendarCheck, MessagesSquare, Search, Sprout } from "lucide-react";
import { listSpecies } from "@/lib/species/repo";
import { SpeciesCard } from "@/components/species/species-card";
import { listPublished } from "@/lib/magazine/queries";
import { ArticleCard } from "@/components/magazine/article-card";
import { TodayBar } from "@/components/home/today-bar";

export const revalidate = 300;

const FEATURES = [
  { icon: BookOpen, title: "ללמוד", text: "מדריך טיפול לכל צמח: אור, השקיה, לחות, מצע ודישון – מותאם לישראל." },
  { icon: Sprout, title: "לגדל", text: "מוסיפים את הצמחים שלך, משייכים לחדר או למרפסת ומתעדים צמיחה בתמונות." },
  { icon: CalendarCheck, title: "לעקוב", text: "תזכורות השקיה ודישון לפי הצמח, העונה וההיסטוריה שלך." },
  { icon: MessagesSquare, title: "לשתף", text: "פיד של מגדלים: עלה חדש, שאלה על עלים מצהיבים, טיפים מהקהילה." },
];

export default async function HomePage() {
  const [all, latest] = await Promise.all([listSpecies({}), listPublished({ limit: 3 })]);
  const featured = all.filter((s) => s.tags.includes("beginner")).slice(0, 6);

  return (
    <div className="flex flex-col gap-14">
      <div className="-mb-8">
        <TodayBar />
      </div>
      <section className="relative overflow-hidden rounded-3xl bg-leaf-soft px-6 py-12 md:px-12 md:py-16">
        <div className="relative z-10 flex max-w-2xl flex-col gap-5">
          <p className="text-sm font-semibold text-primary">ללמוד · לגדל · לעקוב · להשתפר</p>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">הבית הדיגיטלי של הצמחים שלך</h1>
          <p className="text-lg text-muted">
            פלנטריום משלב מאגר ידע על צמחים עם מערכת אישית לניהול, מעקב וגידול – ועם קהילה של אנשים שאוהבים צמחים.
          </p>
          <form action="/knowledge" className="relative mt-2 max-w-md">
            <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              name="q"
              aria-label="חיפוש צמח"
              placeholder="איזה צמח יש לך?"
              className="w-full rounded-full border border-border bg-surface py-3.5 pe-28 ps-11 shadow-sm outline-none focus:border-primary"
            />
            <button className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded-full bg-primary px-5 py-2 font-semibold text-on-primary hover:bg-primary-strong">
              חיפוש
            </button>
          </form>
        </div>
        <svg
          viewBox="0 0 200 200"
          aria-hidden
          className="pointer-events-none absolute -bottom-10 end-[-40px] hidden size-80 text-primary opacity-15 md:block"
        >
          <path d="M100 190c0-60 25-110 80-130-5 70-35 110-80 130Zm0 0c0-45-20-80-70-100 0 55 25 85 70 100Z" fill="currentColor" />
        </svg>
      </section>

      <section aria-label="מה אפשר לעשות" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
            <Icon className="size-6 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="beginners" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="beginners" className="text-2xl font-bold">צמחים מושלמים למתחילים</h2>
          <Link href="/knowledge" className="shrink-0 text-sm font-medium text-primary hover:underline">
            לכל המאגר
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {featured.map((s) => (
            <SpeciesCard key={s.slug} species={s} />
          ))}
        </div>
      </section>

      {latest.length > 0 && (
        <section aria-labelledby="magazine" className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <h2 id="magazine" className="text-2xl font-bold">מהמגזין</h2>
            <Link href="/magazine" className="shrink-0 text-sm font-medium text-primary hover:underline">
              לכל הכתבות
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {latest.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
