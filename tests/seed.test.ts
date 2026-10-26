import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSeed } from "../scripts/seed-sql";
import { ANALYSIS_TYPES, TYPE_RULES } from "../src/lib/data/analysis-types";

describe("supabase/seed.sql", () => {
  it("is up to date with src/lib/data/analysis-types.ts (run `npm run db:seed`)", () => {
    expect(readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8")).toBe(buildSeed());
  });

  it("has upload rules for every analysis type", () => {
    for (const t of ANALYSIS_TYPES) expect(TYPE_RULES[t.slug], t.slug).toBeDefined();
  });

  it("only requires file kinds it also allows", () => {
    for (const [slug, r] of Object.entries(TYPE_RULES)) for (const k of r.required) expect(r.allowed, slug).toContain(k);
  });
});
