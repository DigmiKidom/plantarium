import { describe, expect, it } from "vitest";
import { signUpSchema } from "./schemas";

const ok = { displayName: "נועה לוי", username: "Noa_L", email: " Noa@Example.com ", password: "12345678", confirm: "12345678" };

describe("signUpSchema", () => {
  it("normalizes username and email", () => {
    const v = signUpSchema.parse(ok);
    expect(v.username).toBe("noa_l");
    expect(v.email).toBe("noa@example.com");
  });
  it("rejects mismatched passwords, short passwords and bad usernames", () => {
    expect(signUpSchema.safeParse({ ...ok, confirm: "x" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, password: "123", confirm: "123" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...ok, username: "נועה" }).success).toBe(false);
  });
});
