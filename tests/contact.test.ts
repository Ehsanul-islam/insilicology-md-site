import { describe, expect, it } from "vitest";
import { clientIp, hashIp, parseContact } from "../src/lib/contact";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.set(k, v));
  return f;
};
const ok = { name: "Ada", email: "ada@example.org", subject: "Quote", message: "Please quote a 100 ns run.", pdb: "1afs" };

describe("parseContact", () => {
  it("accepts a valid message and normalises the PDB ID", () => {
    const { values, errors } = parseContact(form(ok));
    expect(errors).toEqual({});
    expect(values.pdb).toBe("1AFS");
  });

  it("trims whitespace", () => {
    expect(parseContact(form({ ...ok, name: "  Ada  " })).values.name).toBe("Ada");
  });

  it("flags each invalid field", () => {
    const { errors } = parseContact(form({ name: "", email: "nope", subject: "x".repeat(201), message: "short", pdb: "XX" }));
    expect(Object.keys(errors).sort()).toEqual(["email", "message", "name", "pdb", "subject"]);
  });

  it("limits message and name length", () => {
    expect(parseContact(form({ ...ok, message: "x".repeat(5001) })).errors.message).toBeDefined();
    expect(parseContact(form({ ...ok, name: "n".repeat(121) })).errors.name).toBeDefined();
  });

  it("treats the PDB ID as optional", () => {
    expect(parseContact(form({ ...ok, pdb: "" })).errors.pdb).toBeUndefined();
  });

  it("ignores non-text form values", () => {
    const f = form(ok);
    f.set("name", new File(["x"], "x.txt"));
    expect(parseContact(f).errors.name).toBeDefined();
  });
});

describe("rate-limit helpers", () => {
  it("hashes IPs deterministically without exposing them", () => {
    const a = hashIp("203.0.113.7", "secret");
    expect(a).toBe(hashIp("203.0.113.7", "secret"));
    expect(a).not.toContain("203");
    expect(a).toHaveLength(64);
    expect(hashIp("203.0.113.7", "other")).not.toBe(a);
  });

  it("takes the first forwarded address", () => {
    expect(clientIp("203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
    expect(clientIp(null)).toBe("unknown");
  });
});
