export const ROLES = ["user", "author", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HE: Record<Role, string> = {
  user: "משתמש",
  author: "כותב/ת",
  editor: "עורך/ת ראשי/ת",
  admin: "מנהל/ת",
};

/** What each role may do – shown to admins when they give a role. */
export const ROLE_DESC: Record<Role, string> = {
  user: "חממה, צמחים, שוק, תגובות ולייקים",
  author: "+ כתיבת מאמרים במגזין והצעת צמחים חדשים (באישור)",
  editor: "+ אישור ודחיית מאמרים והצעות צמחים, עריכת מאגר הצמחים",
  admin: "+ ניהול משתמשים, השעיות, דיווחים, חבילות ויומן",
};

/** Can approve articles and plant suggestions and edit the plant database. */
export const isReviewer = (role: Role | null | undefined) => role === "editor" || role === "admin";

/** Can write magazine articles (always subject to review). */
export const canWrite = (role: Role | null | undefined) => role === "author" || role === "editor" || role === "admin";
export const isAdminRole = (role: Role | null | undefined) => role === "admin";

export const isBannedNow = (bannedUntil: string | null | undefined) =>
  Boolean(bannedUntil) && (bannedUntil === "infinity" || new Date(bannedUntil!).getTime() > Date.now());
