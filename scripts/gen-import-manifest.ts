// Builds MD_Simulation_Database/_manifest.json: for every row of Simulation_Index.csv, the files the import
// should bring in (JPG figures, .xvg and .csv; no TIFF) with their size and analysis. The import Edge
// Function reads this one small file through the CDN instead of listing the repository.
//   node --experimental-strip-types --no-warnings scripts/gen-import-manifest.ts
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { classifyFile, parseCsv, type IndexRow } from "../src/lib/import/classify.ts";

const root = "MD_Simulation_Database";
const rows = parseCsv(readFileSync(join(root, "Simulation_Index.csv"), "utf8")) as unknown as IndexRow[];

function walk(dir: string, base = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), `${base}${e.name}/`) : [`${base}${e.name}`],
  );
}

const out = rows.map((row) => {
  const dir = join(root, row.database_path);
  const files = (existsSync(dir) ? walk(dir) : [])
    .map((p) => {
      const size = statSync(join(dir, p)).size;
      const f = size > 0 ? classifyFile(p, size) : null;
      return f && { path: f.path, kind: f.kind, analysis: f.analysis, size: f.size, caption: f.caption };
    })
    .filter(Boolean);
  return { row, files };
});

writeFileSync(join(root, "_manifest.json"), JSON.stringify({ rows: out }));
const n = out.reduce((s, r) => s + r.files.length, 0);
console.log(`${out.length} records, ${n} files, ${out.filter((r) => !r.files.length).length} records without files`);
