import { describe, expect, it } from "vitest";
import { normaliseKey } from "../src/lib/data/analysis-types";
import { SIMULATION_TYPES, getSimulationType, resolveSimulationType, suggestSimulationTypes } from "../src/lib/data/simulation-types";

describe("simulation types", () => {
  it("has the starting list, with unique slugs and page copy", () => {
    expect(SIMULATION_TYPES).toHaveLength(14);
    const slugs = SIMULATION_TYPES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const t of SIMULATION_TYPES) {
      expect(t.summary.length, t.slug).toBeGreaterThan(20);
      expect(t.intro.length, t.slug).toBeGreaterThanOrEqual(2);
      expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("has no name, slug or alias shared by two different types", () => {
    const seen = new Map<string, string>();
    for (const t of SIMULATION_TYPES) {
      for (const a of [t.slug, t.name, ...t.aliases]) {
        const k = normaliseKey(a);
        expect(seen.get(k) ?? t.slug, `${a} clashes`).toBe(t.slug);
        seen.set(k, t.slug);
      }
    }
  });

  it("resolves common wordings to one type", () => {
    const cases: [string, string][] = [
      ["Apo", "apo-protein"],
      ["unbound protein", "apo-protein"],
      ["Protein-ligand", "protein-ligand-complex"],
      ["holo", "protein-ligand-complex"],
      ["protein protein", "protein-protein-complex"],
      ["GPCR", "membrane-protein"],
      ["protein DNA", "protein-dna-rna-complex"],
      ["Umbrella Sampling", "umbrella-sampling"],
      ["PMF", "umbrella-sampling"],
      ["REMD", "replica-exchange"],
      ["metadynamics", "metadynamics"],
      ["SMD", "steered-md"],
      ["FEP", "free-energy-perturbation"],
      ["martini", "coarse-grained"],
    ];
    for (const [q, slug] of cases) expect(resolveSimulationType(q)?.slug, q).toBe(slug);
    expect(resolveSimulationType("RMSD")).toBeUndefined();
    expect(resolveSimulationType("")).toBeUndefined();
  });

  it("suggests by substring, and lists the first types for an empty query", () => {
    expect(suggestSimulationTypes("umbr").map((t) => t.slug)).toContain("umbrella-sampling");
    expect(suggestSimulationTypes("membrane").map((t) => t.slug)).toContain("membrane-protein");
    expect(suggestSimulationTypes("", 5)).toHaveLength(5);
    expect(suggestSimulationTypes("zzzz")).toEqual([]);
  });

  it("looks a type up by slug", () => {
    expect(getSimulationType("apo-protein")?.name).toBe("Apo protein");
    expect(getSimulationType("nope")).toBeUndefined();
  });
});
