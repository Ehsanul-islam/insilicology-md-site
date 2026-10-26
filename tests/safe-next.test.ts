import { describe, expect, it } from "vitest";
import { safeNext } from "../src/lib/safe-next";

describe("safeNext (open-redirect guard)", () => {
  it("allows paths on this site, with query and hash", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/blog/my-post?x=1#top")).toBe("/blog/my-post?x=1#top");
    expect(safeNext("/")).toBe("/");
  });

  it("falls back for empty or missing values", () => {
    expect(safeNext(undefined)).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext("")).toBe("/dashboard");
    expect(safeNext("", "/home")).toBe("/home");
  });

  it.each([
    "https://evil.com",
    "http://evil.com/x",
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "/%2Fevil.com",
    "/%5cevil.com",
    "dashboard",
    "/ok\nSet-Cookie: x=1",
    "/\t/evil.com",
  ])("rejects %j", (bad) => {
    expect(safeNext(bad)).toBe("/dashboard");
  });
});
