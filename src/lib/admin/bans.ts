/** Ban lengths an admin can pick, in hours (null = until lifted). */
export const BAN_DURATIONS = { "1d": 24, "7d": 24 * 7, "30d": 24 * 30, forever: null } as const;
export type BanDuration = keyof typeof BAN_DURATIONS;

export const BAN_DURATION_HE: Record<BanDuration, string> = {
  "1d": "יום",
  "7d": "שבוע",
  "30d": "30 יום",
  forever: "לצמיתות",
};
