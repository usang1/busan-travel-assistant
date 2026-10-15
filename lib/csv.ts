export type CsvTable = { headers: string[]; rows: Array<Record<string, string>> };

export function parseCsv(text: string, maxRows = 1000): CsvTable {
  const source = text.replace(/^\uFEFF/u, "");
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") { row.push(cell); cell = ""; }
    else if (character === "\n") { row.push(cell); matrix.push(row); row = []; cell = ""; }
    else if (character !== "\r") cell += character;
  }
  if (quoted) throw new Error("닫히지 않은 따옴표가 있는 CSV입니다.");
  if (cell || row.length) { row.push(cell); matrix.push(row); }
  const nonEmpty = matrix.filter((values) => values.some((value) => value.trim()));
  if (!nonEmpty.length) throw new Error("CSV에 데이터가 없습니다.");
  const headers = nonEmpty[0].map((value, index) => value.normalize("NFKC").trim() || `column_${index + 1}`);
  if (new Set(headers).size !== headers.length) throw new Error("중복된 CSV 컬럼명이 있습니다.");
  const dataRows = nonEmpty.slice(1);
  if (dataRows.length > maxRows) throw new Error(`한 번에 최대 ${maxRows}행까지 처리할 수 있습니다.`);
  return {
    headers,
    rows: dataRows.map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").normalize("NFKC").trim()]))),
  };
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const escape = (value: unknown) => { const text = value === null || value === undefined ? "" : String(value); return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
  return `\uFEFF${headers.map(escape).join(",")}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(",")).join("\n")}`;
}
