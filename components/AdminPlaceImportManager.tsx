"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { parseCsv, toCsv, type CsvTable } from "@/lib/csv";

const fields = [
  ["name", "가게명", true], ["address", "주소", true], ["latitude", "위도", false],
  ["longitude", "경도", false], ["category", "카테고리", true], ["phone", "전화번호", false],
  ["opening_hours", "영업시간", false], ["external_id", "외부 장소 ID", false], ["source", "출처", false],
] as const;

type PreviewRow = { id: string; row_number: number; status: "valid" | "duplicate" | "invalid"; normalized_data: Record<string, unknown>; errors: string[]; duplicate_place_id: string | null; duplicateName?: string | null };

export function AdminPlaceImportManager({ accessToken, onCompleted }: { accessToken: string; onCompleted: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [batchId, setBatchId] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selections, setSelections] = useState<Record<string, "create" | "merge" | "skip">>({});
  const [results, setResults] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const counts = useMemo(() => ({ valid: rows.filter((row) => row.status === "valid").length, duplicate: rows.filter((row) => row.status === "duplicate").length, invalid: rows.filter((row) => row.status === "invalid").length }), [rows]);

  async function chooseFile(file: File) {
    setMessage(""); setRows([]); setResults([]); setBatchId("");
    if (file.size > 2 * 1024 * 1024) { setMessage("CSV 파일은 2MB 이하여야 합니다."); return; }
    try {
      const parsed = parseCsv(await file.text());
      setFileName(file.name); setTable(parsed);
      const aliases: Record<string, string[]> = { name: ["가게명", "상호명", "name"], address: ["주소", "address"], latitude: ["위도", "latitude", "lat"], longitude: ["경도", "longitude", "lng"], category: ["카테고리", "category"], phone: ["전화번호", "phone"], opening_hours: ["영업시간", "opening_hours"], external_id: ["외부장소ID", "외부 장소 ID", "external_id"], source: ["출처", "source"] };
      setMapping(Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, parsed.headers.find((header) => names.some((name) => header.toLocaleLowerCase("ko") === name.toLocaleLowerCase("ko"))) ?? ""])));
      setMessage(`${parsed.rows.length}개 행을 읽었습니다. 컬럼을 확인한 뒤 미리보기를 실행해 주세요.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "CSV를 읽지 못했습니다."); }
  }

  async function api(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/place-imports", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { message?: string; batchId?: string; rows?: PreviewRow[]; results?: Array<Record<string, unknown>>; imported?: number; skipped?: number; failed?: number };
    if (!response.ok) throw new Error(result.message ?? "CSV 작업에 실패했습니다.");
    return result;
  }

  async function preview() {
    if (!table) return;
    setBusy(true); setMessage("");
    try {
      const result = await api({ action: "preview", filename: fileName, mapping, rows: table.rows });
      const nextRows = result.rows ?? []; setRows(nextRows); setBatchId(result.batchId ?? "");
      setSelections(Object.fromEntries(nextRows.map((row) => [row.id, row.status === "valid" ? "create" : row.status === "duplicate" ? "merge" : "skip"])));
      setMessage("미리보기를 만들었습니다. 중복 행의 병합은 공개값을 덮어쓰지 않고 검토 대기 제안으로 저장됩니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "미리보기에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function commit() {
    setBusy(true); setMessage("");
    try {
      const result = await api({ action: "commit", batchId, selections: rows.map((row) => ({ rowId: row.id, action: selections[row.id] })) });
      setResults(result.results ?? []); setMessage(`등록 ${result.imported ?? 0}건 · 건너뜀 ${result.skipped ?? 0}건 · 실패 ${result.failed ?? 0}건`); await onCompleted();
    } catch (error) { setMessage(error instanceof Error ? error.message : "등록에 실패했습니다."); }
    finally { setBusy(false); }
  }

  function downloadResults() {
    const csv = toCsv(["row_number", "name", "result", "place_id", "error"], results);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `spotzari-import-result-${batchId}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <section id="place-imports" className="scroll-mt-24 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">CSV 일괄 등록</p><h2 className="mt-1 text-xl font-black text-slate-950">검증 전 장소 초안 가져오기</h2><p className="mt-2 text-sm leading-6 text-slate-600">유효한 신규 장소는 비공개 초안으로 저장되고, 모든 CSV 값은 자동 수집·검토 대기 상태가 됩니다.</p></div><a href="/api/admin/place-imports" download className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-800"><Download size={17} />템플릿 다운로드</a></div>
      <input ref={fileRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseFile(file); }} />
      <button type="button" onClick={() => fileRef.current?.click()} className="mt-5 flex min-h-24 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-black text-slate-700"><Upload size={20} />{fileName || "CSV 파일 선택 · 최대 2MB / 1,000행"}</button>
      {table ? <div className="mt-5"><h3 className="font-black text-slate-950">컬럼 매핑</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([field, label, required]) => <label key={field}><span className="mb-1.5 block text-xs font-black text-slate-600">{label}{required ? " *" : ""}</span><select value={mapping[field] ?? ""} onChange={(event) => setMapping({ ...mapping, [field]: event.target.value })} className="h-11 w-full rounded-2xl bg-white px-3 text-sm ring-1 ring-slate-200"><option value="">매핑 안 함</option>{table.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><button type="button" disabled={busy || !mapping.name || !mapping.address || !mapping.category} onClick={preview} className="mt-4 min-h-12 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50">{busy ? "검증 중" : "중복·형식 검증 미리보기"}</button></div> : null}
      {message ? <p role="status" className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{message}</p> : null}
      {rows.length ? <div className="mt-5"><div className="flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-teal-50 px-3 py-1.5 text-teal-800">정상 {counts.valid}</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">중복 {counts.duplicate}</span><span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-800">오류 {counts.invalid}</span></div><div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="p-3">행</th><th className="p-3">장소</th><th className="p-3">상태</th><th className="p-3">처리</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="p-3 font-bold">{row.row_number}</td><td className="p-3"><p className="font-black text-slate-900">{String(row.normalized_data.name ?? "")}</p><p className="mt-1 text-xs text-slate-500">{String(row.normalized_data.address ?? "")}</p>{row.duplicateName ? <p className="mt-1 text-xs font-bold text-amber-700">기존: {row.duplicateName}</p> : null}</td><td className="p-3 text-xs font-bold">{row.errors.length ? row.errors.join(" · ") : row.status === "duplicate" ? "중복 후보" : "정상"}</td><td className="p-3"><select value={selections[row.id] ?? "skip"} disabled={row.status === "invalid"} onChange={(event) => setSelections({ ...selections, [row.id]: event.target.value as "create" | "merge" | "skip" })} className="h-10 rounded-xl bg-white px-2 text-xs font-black ring-1 ring-slate-200">{row.status === "valid" ? <option value="create">초안 생성</option> : null}{row.status === "duplicate" ? <option value="merge">기존 장소 검토 제안</option> : null}<option value="skip">건너뛰기</option></select></td></tr>)}</tbody></table></div><button type="button" disabled={busy} onClick={commit} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-teal-700 px-5 text-sm font-black text-white disabled:opacity-50"><FileSpreadsheet size={17} />선택 행 등록</button></div> : null}
      {results.length ? <button type="button" onClick={downloadResults} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-800"><Download size={17} />등록 결과 CSV 다운로드</button> : null}
    </section>
  );
}
