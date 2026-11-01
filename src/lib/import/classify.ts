/**
 * Turns one row of MD_Simulation_Database/Simulation_Index.csv and the file names in its folder into the
 * pieces of a database record. Pure and dependency-free: the import Edge Function ships a copy of this file.
 * Everything here is inferred from folder and file names, so titles and types are a best effort that an
 * administrator can edit later.
 */

export type IndexRow = {
  simulation: string;
  time_ns: string;
  time_folder: string;
  topic_disease_class: string;
  target: string;
  engine: string;
  database_path: string;
};

/** RFC 4180 CSV with quoted fields, enough for Simulation_Index.csv. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some((x) => x !== "")) rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const PREFIXES = ["Tarik_Aaniz_", "Himel_", "Malaysia_", "Samiran_", "gourab_", "Nepal_", "Calvin_", "Biochem_", "Pakistan_", "Water_", "paralog_dock_", "paralog_", "Chain-Changed_Docked_"];

/** The simulation name without the contributor prefix and with separators turned into spaces. */
export function cleanName(simulation: string): string {
  let s = simulation;
  for (const p of PREFIXES) if (s.startsWith(p)) { s = s.slice(p.length); break; }
  return s.replace(/_COMBINED-comparison$/, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

/** A 4-character PDB code (digit first, at least one letter) in the folder name, else in the target text. */
export function pdbIdOf(simulation: string, target: string): string | null {
  const re = /(?<![A-Za-z0-9.])([1-9][A-Za-z0-9]{3})(?![A-Za-z0-9.])/g;
  for (const text of [simulation, target]) {
    for (const m of text.matchAll(re)) if (/[A-Za-z]/.test(m[1])) return m[1].toUpperCase();
  }
  return null;
}

const NOT_A_LIGAND = /(^|\s)(combined|comparison|analysis|complex|cluster|model|aptamer\d*|control|vaccine|tlr|hapeg|ha|hntv|gpcr|hpv|e6|lamyea|anamul|gourav|y1|h1|fix)(\s|$)/i;

/** The ligand named in the folder, when there is one after the PDB code and contributor prefix. */
export function ligandOf(simulation: string, pdb: string | null): { name: string; pubchemCid?: number } | null {
  let s = cleanName(simulation);
  s = s.replace(/(?<![A-Za-z0-9.])[1-9](?=[A-Za-z0-9]{0,2}[A-Za-z])[A-Za-z0-9]{3}(?![A-Za-z0-9.])/g, " ");
  s = s.replace(/\b(desmond|with|dock|new)\b/gi, " ").replace(/\s+\d+$/, "").replace(/[-+]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s || !/[A-Za-z0-9]/.test(s) || NOT_A_LIGAND.test(s)) return null;
  if (/^\d{4,}$/.test(s)) return { name: `PubChem CID ${s}`, pubchemCid: Number(s) };
  return { name: s };
}

export type SimulationTypeSlug =
  | "apo-protein" | "protein-ligand-complex" | "protein-protein-complex" | "membrane-protein" | "nucleic-acid" | "other";

export function simulationTypeOf(topic: string): SimulationTypeSlug {
  if (/Vaccine|TLR|Synuclein|PPI/i.test(topic)) return "protein-protein-complex";
  if (/Aptamer|Nucleic/i.test(topic)) return "nucleic-acid";
  if (/GPCR|Membrane/i.test(topic)) return "membrane-protein";
  if (/Folding|PDI/i.test(topic)) return "apo-protein";
  if (/Micelle|Polymer|Uncategorized/i.test(topic)) return "other";
  return "protein-ligand-complex";
}

export type AnalysisSlug =
  | "rmsd" | "rmsf" | "radius-of-gyration" | "sasa" | "hydrogen-bonds" | "contact-map" | "mm-pbsa" | "pca" | "free-energy-landscape" | "dccm" | "other";

/** The analysis a data or image file belongs to, from its file name. */
export function analysisOf(fileName: string): AnalysisSlug {
  const stem = (fileName.replace(/\.[^.]+$/, "").split("__").pop() ?? "").toLowerCase();
  if (/mmgbsa|mmpbsa|gb_delta|normal_gb|final_results|energy_per_frame/.test(stem)) return "mm-pbsa";
  if (/rmsd/.test(stem)) return "rmsd";
  if (/eigen|eigrmsf|^\d+d$|_\dd_|pca/.test(stem)) return "pca";
  if (/rmsf/.test(stem)) return "rmsf";
  if (/gyrate|^rg/.test(stem)) return "radius-of-gyration";
  if (/sasa/.test(stem)) return "sasa";
  if (/hbnum|hbond|^hb/.test(stem)) return "hydrogen-bonds";
  if (/\bfel\b|^fel|gibbs|free_energy/.test(stem)) return "free-energy-landscape";
  if (/dccm/.test(stem)) return "dccm";
  if (/mindist|numcont|com_dist|contact/.test(stem)) return "contact-map";
  return "other";
}

export type FileDraft = { path: string; name: string; kind: "xvg" | "csv" | "png"; analysis: AnalysisSlug; size: number; caption: string };

/** Files worth importing: .xvg, .csv and JPG/PNG figures. TIFF copies, markers and hidden files are skipped. */
export function classifyFile(path: string, size: number): FileDraft | null {
  const name = path.split("/").pop() ?? path;
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (name.startsWith(".")) return null;
  const kind = ext === "xvg" ? "xvg" : ext === "csv" ? "csv" : ext === "jpg" || ext === "jpeg" || ext === "png" ? "png" : null;
  if (!kind) return null;
  const caption = name
    .replace(/\.[^.]+$/, "")
    .replace(/^(plot_xvg__|plot_|xvg__|images__|data1__images__|analysis\d*__)+/i, "")
    .replace(/[_]+/g, " ")
    .trim()
    .slice(0, 200);
  return { path, name, kind, analysis: analysisOf(name), size, caption };
}

export type RecordDraft = {
  slug: string;
  title: string;
  description: string;
  pdbId: string | null;
  proteinName: string | null;
  molecules: { kind: string; name: string; pubchem_cid?: number }[];
  software: string;
  lengthNs: number | null;
  simulationType: SimulationTypeSlug;
  tags: string[];
  authors: string[];
};

export const AUTHORS = ["Ehsanul Islam", "Tawsif Al Arian"];

const words = (s: string) => s.split("_").map((w) => w.replace(/-/g, " ")).filter(Boolean);

export function recordFromRow(row: IndexRow): RecordDraft {
  const combined = /COMBINED-comparison$/.test(row.simulation);
  const pdb = pdbIdOf(row.simulation, row.target);
  const lig = ligandOf(row.simulation, pdb);
  const name = cleanName(row.simulation);
  const time = Number(row.time_ns);
  const lengthNs = Number.isFinite(time) && time > 0 ? time : null;
  const subject = combined ? `${name || row.target} (combined comparison)` : lig && row.target ? `${row.target} with ${lig.name}` : name || row.target;
  const title = `${subject}${lengthNs ? `, ${lengthNs} ns` : ""} ${row.engine} simulation`.replace(/\s+/g, " ").trim().slice(0, 200);
  const topic = words(row.topic_disease_class).join(", ");
  const description =
    `${lengthNs ? `${lengthNs} ns ` : ""}${row.engine} molecular dynamics simulation${row.target ? ` of ${row.target}` : ""}` +
    `${lig ? ` with ${lig.name}` : ""}. Research area: ${topic || "not classified"}. ` +
    `Plots and data files from the analysis are listed below.`;
  const tags = [...new Set([...words(row.topic_disease_class), row.engine, ...(lengthNs ? [`${lengthNs} ns`] : []), ...(combined ? ["comparison"] : [])])]
    .filter((t) => t && !/^uncategorized$/i.test(t))
    .map((t) => t.slice(0, 60));
  return {
    slug: slugify(row.simulation).slice(0, 120),
    title,
    description,
    pdbId: pdb,
    proteinName: row.target ? row.target.slice(0, 300) : null,
    molecules: lig ? [{ kind: "ligand", name: lig.name, ...(lig.pubchemCid ? { pubchem_cid: lig.pubchemCid } : {}) }] : [],
    software: row.engine,
    lengthNs,
    simulationType: simulationTypeOf(row.topic_disease_class),
    tags,
    authors: AUTHORS,
  };
}
