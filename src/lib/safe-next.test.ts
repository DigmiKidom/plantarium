import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps local paths", () => {
    expect(safeNext("/plants")).toBe("/plants");
    expect(safeNext("/market/l/1?x=1#c")).toBe("/market/l/1?x=1#c");
  });
  it("blocks other sites", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "/\t/evil.com", "evil.com", "", null, undefined, 5]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});
