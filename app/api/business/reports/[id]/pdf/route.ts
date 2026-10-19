import { NextResponse } from "next/server";
import { businessErrorResponse, isUuid, requireAuthenticatedUser } from "@/lib/business-auth";
import { renderBusinessReportPdf } from "@/lib/business-report-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ message: "리포트를 확인해 주세요." }, { status: 400 });
    const { client } = await requireAuthenticatedUser(request);
    const { data, error } = await client.from("business_performance_reports").select("id,snapshot,recommendations,generated_at").eq("id", id).single();
    if (error || !data) return NextResponse.json({ message: "리포트를 찾을 수 없거나 다운로드 권한이 없습니다." }, { status: 404 });
    const pdf = await renderBusinessReportPdf(data.snapshot, Array.isArray(data.recommendations) ? data.recommendations.map(String) : [], data.generated_at);
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="spotzari-report-${id}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) { const response = businessErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}
