import { describe, expect, it } from "vitest";
import { EXPORT_TABLES, PHOTO_FOLDERS } from "./data";

describe("account data map", () => {
  it("lists every table once, parents before children", () => {
    const names = EXPORT_TABLES.map((t) => t.table);
    expect(new Set(names).size).toBe(names.length);
    for (const t of EXPORT_TABLES) if ("parent" in t) expect(names.indexOf(t.parent)).toBeLessThan(names.indexOf(t.table));
  });
  it("never deletes the shared plant-database photos", () => {
    expect(PHOTO_FOLDERS).not.toContain("species");
  });
});
