import { describe, expect, it } from "vitest";
import { matchScore, normalizeHe, wordVariants } from "./hebrew";

describe("normalizeHe", () => {
  it("removes niqqud and unifies final letters", () => {
    expect(normalizeHe("שָׁלוֹם")).toBe("שלומ");
    expect(normalizeHe("עץ")).toBe("עצ");
  });
  it("lowercases, trims and collapses punctuation/spaces", () => {
    expect(normalizeHe("  Ficus   Lyrata ")).toBe("ficus lyrata");
    expect(normalizeHe("צמח״ים")).toBe("צמח ימ");
  });
});

describe("wordVariants", () => {
  it("adds a variant without one prefix letter for longer words", () => {
    expect(wordVariants("הפיקוס")).toEqual(["הפיקוס", "פיקוס"]);
    expect(wordVariants("בית")).toEqual(["בית"]);
  });
});

describe("matchScore", () => {
  const monstera = ["מונסטרה", "Monstera deliciosa"];
  it("matches substrings fully", () => {
    expect(matchScore("מונס", monstera)).toBe(1);
    expect(matchScore("deliciosa", monstera)).toBe(1);
  });
  it("tolerates a Hebrew prefix and small typos", () => {
    expect(matchScore("המונסטרה", monstera)).toBeGreaterThan(0.35);
    expect(matchScore("מונסתרה", monstera)).toBeGreaterThan(0);
  });
  it("returns 0 for unrelated words", () => {
    expect(matchScore("עגבנייה", monstera)).toBe(0);
  });
});
