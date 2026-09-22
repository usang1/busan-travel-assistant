import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = ["approved", "rejected", "needs_review"] as const;

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { client } = await requireAdmin(request);
    const { id } = await context.params;
    const body = await request.json() as { status?: (typeof statuses)[number]; notes?: string };
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "제보 ID가 올바르지 않습니다." }, { status: 400 });
    if (!body.status || !statuses.includes(body.status)) return NextResponse.json({ message: "지원하지 않는 상태입니다." }, { status: 400 });
    if (typeof body.notes === "string" && body.notes.length > 1000) return NextResponse.json({ message: "검수 메모는 1,000자 이하여야 합니다." }, { status: 400 });

    const { data, error } = await client.rpc("moderate_traveler_report", {
      target_report_id: id,
      next_status: body.status,
      notes: body.notes?.trim() || null,
    });
    if (error) {
      if (["42883", "PGRST202"].includes(error.code ?? "")) {
        throw Object.assign(new Error("여행자 확인 DB migration 033을 먼저 적용해주세요."), { status: 503, expose: true });
      }
      throw error;
    }
    return NextResponse.json({ report: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
