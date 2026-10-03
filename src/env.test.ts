import { describe, expect, it } from "vitest";
import { envProblems } from "./env";

const prod = {
  VERCEL_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_IMAGES_URL: "https://pub-x.r2.dev",
  R2_ACCOUNT_ID: "a",
  R2_ACCESS_KEY_ID: "b",
  R2_SECRET_ACCESS_KEY: "c",
  R2_BUCKET: "d",
};

describe("envProblems", () => {
  it("accepts an empty environment outside production (CI, local)", () => {
    expect(envProblems({})).toEqual([]);
  });
  it("accepts a complete production environment, with stray whitespace", () => {
    expect(envProblems({ ...prod, NEXT_PUBLIC_IMAGES_URL: "https://pub-x.r2.dev \n" })).toEqual([]);
  });
  it("reports missing production settings by name", () => {
    expect(envProblems({ ...prod, R2_BUCKET: " " })).toEqual(["R2_BUCKET: missing (required in production)"]);
  });
  it("rejects malformed URLs", () => {
    expect(envProblems({ NEXT_PUBLIC_IMAGES_URL: "http://pub-x.r2.dev" })).toEqual(["NEXT_PUBLIC_IMAGES_URL: invalid value"]);
    expect(envProblems({ NEXT_PUBLIC_SUPABASE_URL: "abc.supabase.co" })).toHaveLength(1);
  });
  it("needs both Turnstile keys or neither", () => {
    expect(envProblems({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "x" })).toHaveLength(1);
  });
});
