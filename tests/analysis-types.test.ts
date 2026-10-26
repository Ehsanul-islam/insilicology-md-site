import { describe, expect, it } from "vitest";
import { ANALYSIS_TYPES, normaliseKey, resolveAnalysisType, suggestAnalysisTypes } from "../src/lib/data/analysis-types";

describe("analysis types", () => {
  it("has unique slugs and non-empty intros", () => {
    const slugs = ANALYSIS_TYPES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const t of ANALYSIS_TYPES) expect(t.intro.length).toBeGreaterThan(0);
  });

  it("has no alias shared by two different types", () => {
    const seen = new Map<string, string>();
    for (const t of ANALYSIS_TYPES) {
      for (const a of [t.slug, t.name, ...t.aliases]) {
        const k = normaliseKey(a);
        expect(seen.get(k) ?? t.slug, `${a} clashes`).toBe(t.slug);
        seen.set(k, t.slug);
      }
    }
  });

  it("resolves RMSD, RMSD analysis and Protein RMSD to one type", () => {
    for (const q of ["RMSD", "rmsd analysis", "Protein RMSD", "  protein-rmsd "]) {
      expect(resolveAnalysisType(q)?.slug).toBe("rmsd");
    }
  });

  it("ignores case and punctuation", () => {
    expect(resolveAnalysisType("MM/PBSA")?.slug).toBe("mm-pbsa");
    expect(resolveAnalysisType("h bonds")?.slug).toBe("hydrogen-bonds");
    expect(resolveAnalysisType("nonsense")).toBeUndefined();
    expect(resolveAnalysisType("")).toBeUndefined();
  });

  it("suggests by substring and falls back to the first types for an empty query", () => {
    expect(suggestAnalysisTypes("gyr").map((t) => t.slug)).toContain("radius-of-gyration");
    expect(suggestAnalysisTypes("").length).toBeGreaterThan(0);
  });
});
