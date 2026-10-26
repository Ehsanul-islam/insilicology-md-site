import { describe, expect, it } from "vitest";
import { abs, breadcrumbLd, clip, pageMetadata } from "../src/lib/seo";

describe("seo helpers", () => {
  it("clips long descriptions at a word boundary within 155 characters", () => {
    const long = "molecular dynamics ".repeat(30);
    const c = clip(long);
    expect(c.length).toBeLessThanOrEqual(155);
    expect(c.endsWith("…")).toBe(true);
    expect(clip("short text")).toBe("short text");
  });

  it("builds absolute URLs", () => {
    expect(abs("/a")).toMatch(/^https?:\/\/.+\/a$/);
    expect(abs("b")).toMatch(/\/b$/);
  });

  it("sets robots from the noindex flag and always sets a canonical", () => {
    const idx = pageMetadata({ title: "T", description: "D", path: "/x" });
    const no = pageMetadata({ title: "T", description: "D", path: "/x", noindex: true });
    expect(idx.robots).toEqual({ index: true, follow: true });
    expect(no.robots).toEqual({ index: false, follow: true });
    expect(idx.alternates?.canonical).toBe("/x");
  });

  it("numbers breadcrumbs from 1 with absolute URLs", () => {
    const ld = breadcrumbLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]);
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(ld.itemListElement[1].item).toMatch(/\/blog$/);
  });
});
