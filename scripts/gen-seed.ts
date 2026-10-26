import { writeFileSync } from "node:fs";
import { buildSeed } from "./seed-sql.ts";

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), buildSeed());
console.log("wrote supabase/seed.sql");
