import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

const moduleCache = new Map();

function resolveModule(request, fromFile) {
  if (request.startsWith("@/")) return path.resolve(request.replace("@/", ""));
  if (request.startsWith(".")) return path.resolve(path.dirname(fromFile), request);
  throw new Error(`Unsupported report import: ${request}`);
}

function loadTsModule(request, fromFile = path.resolve("scripts/report-place-quality.mjs")) {
  const resolvedBase = resolveModule(request, fromFile);
  const filename = fs.existsSync(resolvedBase) ? resolvedBase : `${resolvedBase}.ts`;
  if (moduleCache.has(filename)) return moduleCache.get(filename).exports;

  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(filename, module);
  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    require: (specifier) => loadTsModule(specifier, filename),
    console,
    process,
    URL,
  }, { filename });
  return module.exports;
}

const { evaluatePlaceQuality } = loadTsModule("@/lib/place-quality");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  const { demoPlaces } = loadTsModule("@/data/demo-places");
  console.log("Supabase environment variables are not set. Reporting first 5 local demo places instead.");
  reportRows(demoPlaces.slice(0, 5));
  process.exit(0);
}

const client = createClient(url, anonKey);
const { data, error } = await client
  .from("places")
  .select("*,place_china_info(*),place_sources(*),place_menu_items(*)")
  .order("updated_at", { ascending: false })
  .limit(5);

if (error) {
  console.log(`Could not load live places: ${error.message}`);
  process.exit(0);
}

const rows = data ?? [];
if (!rows.length) {
  console.log("No live places were returned for quality report.");
  process.exit(0);
}

for (const row of rows) {
  reportRow(row);
}

function reportRows(rowsToReport) {
  for (const row of rowsToReport) {
    reportRow(row);
  }
}

function reportRow(row) {
  const quality = evaluatePlaceQuality({
    ...row,
    status: row.status ?? (row.is_active ? "ACTIVE" : "DRAFT"),
    china_info: Array.isArray(row.place_china_info)
      ? row.place_china_info[0] ?? null
      : row.place_china_info ?? row.china_info ?? null,
    sources: row.place_sources ?? row.sources ?? [],
    menu_items: row.place_menu_items ?? row.menu_items ?? [],
  });
  const status = quality.canPublish ? "publishable" : "blocked";
  const missing = quality.missingRequired.map((item) => item.label).join(", ") || "-";
  const stale = quality.isStale ? "stale" : "fresh";
  console.log(`${row.name_ko || row.name_zh || row.slug}: ${status}, score=${quality.score}, ${stale}, missing=${missing}`);
}
