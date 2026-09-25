export const REPORT_REASONS = ["spam", "harassment", "inappropriate", "impersonation", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_HE: Record<ReportReason, string> = {
  spam: "ספאם או פרסום",
  harassment: "הטרדה או פגיעה",
  inappropriate: "תוכן לא הולם",
  impersonation: "התחזות",
  other: "אחר",
};
