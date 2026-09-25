import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-2xl font-bold">העמוד לא נמצא</h1>
      <p className="text-muted">אולי הצמח עוד לא במאגר. אפשר לחפש אותו.</p>
      <Link href="/knowledge" className="mt-2 rounded-full bg-primary px-5 py-2 font-semibold text-on-primary">
        למאגר הצמחים
      </Link>
    </div>
  );
}
