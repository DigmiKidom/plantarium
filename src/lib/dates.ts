const long = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });
const short = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const formatDate = (iso: string | null | undefined) => (iso ? long.format(new Date(iso)) : "");
export const formatDateTime = (iso: string | null | undefined) => (iso ? short.format(new Date(iso)) : "");
