import { SITE_URL } from "../../components/md/showcase/data/api";
import type { MdRun } from "../../components/md/showcase/data/types";
import { recordPath } from "./records";

/** Plain helpers shared by client and server components (kept out of "use client" modules). */
export function displayResn(resn: string) {
  return resn.split(/[^A-Za-z0-9]+/).filter(Boolean).join(" + ").toUpperCase();
}
export function ligandLabelOf(run: MdRun) {
  const name = run.ligand_name || run.ligand_resn || "ligand";
  return run.ligand_resn && run.ligand_name ? `${name} (${displayResn(run.ligand_resn)})` : name;
}
export function ligandsOf(run: MdRun) {
  return (run.ligand_resn || "").split(/[^A-Za-z0-9]+/).filter(Boolean).map((x) => x.toUpperCase());
}
export function complexUrl(run: MdRun) {
  return `${SITE_URL}${recordPath(run)}`;
}
