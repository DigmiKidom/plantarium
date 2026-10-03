/** Tables included in "download my data", with the column that points at the user (or at a parent row). */
export const EXPORT_TABLES = [
  { table: "profiles", column: "id" },
  { table: "gardens", column: "user_id" },
  { table: "locations", column: "user_id" },
  { table: "user_plants", column: "user_id" },
  { table: "care_schedules", column: "user_id" },
  { table: "care_events", column: "user_id" },
  { table: "tasks", column: "user_id" },
  { table: "plant_photos", column: "user_id" },
  { table: "posts", column: "author_id" },
  { table: "post_media", parent: "posts", parentColumn: "post_id" },
  { table: "comments", column: "author_id" },
  { table: "reactions", column: "user_id" },
  { table: "bookmarks", column: "user_id" },
  { table: "follows", column: "follower_id" },
  { table: "topic_follows", column: "user_id" },
  { table: "blocks", column: "user_id" },
  { table: "notifications", column: "user_id" },
  { table: "magazine_articles", column: "author_id" },
  { table: "magazine_likes", column: "user_id" },
  { table: "magazine_comments", column: "user_id" },
  { table: "market_listings", column: "seller_id" },
  { table: "market_listing_contacts", parent: "market_listings", parentColumn: "listing_id" },
  { table: "species_suggestions", column: "author_id" },
  { table: "reports", column: "reporter_id" },
] as const;

/**
 * R2 folders (`<folder>/<user id>/…`) removed with the account. `species/` stays: approved plant photos
 * become part of the shared plant database.
 */
export const PHOTO_FOLDERS = ["plants", "profiles", "feed", "market", "magazine"] as const;

/** The word the user types to confirm deleting the account. */
export const DELETE_WORD = "מחיקה";
