import "server-only";
import sharp from "sharp";
import type { BusinessPerformance } from "@/lib/business-performance";

type Snapshot = { place: { name: string }; period: { from: string; to: string }; current: BusinessPerformance; previous?: BusinessPerformance | null; changes?: Record<string, number | null> | null; limitations?: string[] };

export async function renderBusinessReportPdf(snapshot: Snapshot, recommendations: string[], generatedAt: string) {
  const metrics = snapshot.current.metrics;
  const hasData = metrics.placeViews.count > 0 || metrics.saves.count > 0 || metrics.directions.count > 0 || metrics.couponClaims.count > 0;
  const max = Math.max(1, ...snapshot.current.daily.map((item) => item.placeViews));
  const bars = snapshot.current.daily.slice(-31).map((item, index, values) => {
    const width = Math.max(10, Math.floor(1040 / Math.max(values.length, 1)) - 4);
    const height = Math.max(3, Math.round(item.placeViews / max * 220));
    const x = 100 + index * (width + 4);
    return `<rect x="${x}" y="${850 - height}" width="${width}" height="${height}" rx="3" fill="#52705a"/><text x="${x}" y="875" font-size="15" fill="#6b716c">${escapeXml(item.date.slice(5))}</text>`;
  }).join("");
  const lines = [
    ["상세 조회", hasData ? metrics.placeViews.count : "데이터 없음"], ["고유 조회자", hasData ? metrics.placeViews.unique : "데이터 없음"], ["저장", hasData ? metrics.saves.count : "데이터 없음"],
    ["저장 전환율", hasData ? displayRate(metrics.saveConversionRate) : "데이터 없음"], ["길찾기 클릭", hasData ? metrics.directions.count : "데이터 없음"], ["전화 클릭", hasData ? metrics.phoneClicks.count : "데이터 없음"],
    ["쿠폰 상세", hasData ? metrics.couponViews.count : "데이터 없음"], ["쿠폰 발급", hasData ? metrics.couponClaims.count : "데이터 없음"], ["쿠폰 사용", hasData ? metrics.couponRedemptions.count : "데이터 없음"],
    ["쿠폰 사용률", hasData ? displayRate(metrics.couponRedemptionRate) : "데이터 없음"],
  ];
  const metricSvg = lines.map(([label, value], index) => { const x = 100 + (index % 5) * 205; const y = 430 + Math.floor(index / 5) * 130; return `<rect x="${x}" y="${y}" width="185" height="105" rx="14" fill="#f3f5f1"/><text x="${x + 18}" y="${y + 34}" font-size="18" fill="#6b716c">${escapeXml(String(label))}</text><text x="${x + 18}" y="${y + 75}" font-size="31" font-weight="700" fill="#232923">${escapeXml(String(value))}</text>`; }).join("");
  const recommendationSvg = recommendations.slice(0, 5).map((item, index) => `<text x="115" y="${1125 + index * 55}" font-size="20" fill="#303830">• ${escapeXml(item)}</text>`).join("");
  const limitationSvg = (snapshot.limitations ?? []).slice(0, 4).map((item, index) => `<text x="115" y="${1480 + index * 42}" font-size="17" fill="#687068">• ${escapeXml(item)}</text>`).join("");
  const changeText = snapshot.changes?.placeViews === null || snapshot.changes?.placeViews === undefined ? "이전 기간 비교 데이터 없음" : `이전 기간 대비 상세 조회 ${snapshot.changes.placeViews >= 0 ? "+" : ""}${snapshot.changes.placeViews}%`;
  const channelText = snapshot.current.channels.length ? snapshot.current.channels.slice(0, 3).map((item) => `${item.value} ${item.count}`).join(" · ") : "데이터 없음";
  const localeText = snapshot.current.locales.length ? snapshot.current.locales.slice(0, 4).map((item) => `${item.value.toUpperCase()} ${item.count}`).join(" · ") : "데이터 없음";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754"><rect width="1240" height="1754" fill="#fbfaf6"/><style>text{font-family:'Noto Sans KR','Malgun Gothic','Arial',sans-serif}</style><text x="100" y="120" font-size="24" font-weight="700" fill="#52705a">SPOTZARI PERFORMANCE REPORT</text><text x="100" y="205" font-size="54" font-weight="800" fill="#202620">${escapeXml(snapshot.place.name)}</text><text x="100" y="260" font-size="22" fill="#687068">${escapeXml(date(snapshot.period.from))} – ${escapeXml(endDate(snapshot.period.to))}</text><text x="100" y="315" font-size="17" fill="#7a817a">스냅샷 생성: ${escapeXml(date(generatedAt))} · 동일 리포트는 나중에도 같은 수치로 열립니다.</text><text x="100" y="390" font-size="28" font-weight="700" fill="#202620">핵심 성과</text>${metricSvg}<text x="100" y="700" font-size="28" font-weight="700" fill="#202620">조회수 변화</text>${bars}<text x="100" y="930" font-size="19" font-weight="700" fill="#303830">${escapeXml(changeText)}</text><text x="100" y="970" font-size="18" fill="#687068">유입 경로: ${escapeXml(channelText)}</text><text x="100" y="1005" font-size="18" fill="#687068">언어 비중: ${escapeXml(localeText)}</text><text x="100" y="1065" font-size="28" font-weight="700" fill="#202620">규칙 기반 개선 제안</text>${recommendationSvg}<text x="100" y="1400" font-size="28" font-weight="700" fill="#202620">데이터 기준 및 한계</text>${limitationSvg}<text x="100" y="1690" font-size="16" fill="#7a817a">길찾기 클릭은 실제 방문을 의미하지 않으며, 검증된 결제 자료 없이 매출 또는 ROI를 계산하지 않습니다.</text></svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 88, chromaSubsampling: "4:4:4" }).toBuffer();
  return jpegPdf(jpeg, 1240, 1754);
}

function jpegPdf(jpeg: Buffer, width: number, height: number) {
  const parts: Buffer[] = []; const offsets: number[] = [0]; let size = 0;
  const push = (value: string | Buffer) => { const buffer = typeof value === "string" ? Buffer.from(value, "binary") : value; parts.push(buffer); size += buffer.length; };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const object = (id: number, body: string | Buffer) => { offsets[id] = size; push(`${id} 0 obj\n`); push(body); push("\nendobj\n"); };
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
  object(4, Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, "binary"), jpeg, Buffer.from("\nendstream", "binary")]));
  const content = "q 595 0 0 842 0 0 cm /Im0 Do Q";
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = size; push("xref\n0 6\n0000000000 65535 f \n"); for (let id = 1; id <= 5; id += 1) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.concat(parts);
}
function escapeXml(value: string) { return value.replace(/[<>&"']/gu, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char] || char); }
function date(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("ko-KR"); }
function endDate(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Date(parsed.getTime() - 86_400_000).toLocaleDateString("ko-KR"); }
function displayRate(value: number | null) { return value === null ? "데이터 없음" : `${value}%`; }
