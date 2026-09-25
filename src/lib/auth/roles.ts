export const ROLES = ["user", "author", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HE: Record<Role, string> = {
  user: "משתמש",
  author: "כותב/ת",
  editor: "עורך/ת ידע",
  admin: "מנהל/ת",
};

/** Can write magazine articles (always subject to admin approval). */
export const canWrite = (role: Role | null | undefined) => role === "author" || role === "editor" || role === "admin";
export const isAdminRole = (role: Role | null | undefined) => role === "admin";

export const isBannedNow = (bannedUntil: string | null | undefined) =>
  Boolean(bannedUntil) && (bannedUntil === "infinity" || new Date(bannedUntil!).getTime() > Date.now());
