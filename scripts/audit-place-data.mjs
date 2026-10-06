import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

const cache = new Map();
function loadTs(request, from = path.resolve("scripts/audit-place-data.mjs")) {
  const base = request.startsWith("@/") ? path.resolve(request.slice(2)) : path.resolve(path.dirname(from), request);
  const filename = fs.existsSync(base) ? base : `${base}.ts`;
  if (cache.has(filename)) return cache.get(filename).exports;
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove } }).outputText;
  const module = { exports: {} };
  cache.set(filename, module);
  vm.runInNewContext(output, { module, exports: module.exports, require: (specifier) => loadTs(specifier, filename), URL, console }, { filename });
  return module.exports;
}

const { diagnosePlaceData } = loadTs("@/lib/place-data-integrity");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let places;

if (url && key) {
  const client = createClient(url, key);
  const { data, error } = await client.from("places").select("*,place_china_info(*),place_menu_items(*)").order("updated_at", { ascending: false });
  if (error) throw new Error(`Place audit query failed: ${error.message}`);
  places = (data ?? []).map((row) => ({
    ...row,
    china_info: Array.isArray(row.place_china_info) ? row.place_china_info[0] ?? null : row.place_china_info ?? null,
    menu_items: row.place_menu_items ?? [],
  }));
} else {
  places = loadTs("@/data/demo-places").demoPlaces;
  console.log("Supabase variables are absent; auditing local demo data only.");
}

const rows = places.flatMap((place) => diagnosePlaceData(place).map((issue) => ({ slug: place.slug, name: place.name_ko || place.name_zh, ...issue })));
const grouped = rows.reduce((result, row) => {
  (result[row.code] ??= []).push(row);
  return result;
}, {});
console.log(JSON.stringify({ auditedPlaces: places.length, issueCount: rows.length, counts: Object.fromEntries(Object.entries(grouped).map(([code, items]) => [code, items?.length ?? 0])), issues: rows }, null, 2));
process.exitCode = rows.length ? 2 : 0;
