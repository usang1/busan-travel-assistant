import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { canChangeSubmissionStatus } from "@/lib/submission-workflow";
import type { SubmissionStatus } from "@/types/database";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const allowedStatuses: SubmissionStatus[] = ["pending", "reviewing", "rejected", "duplicate"];

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { client, user } = await requireAdmin(request);
    const { id } = await params;
    const body = (await request.json()) as { status?: SubmissionStatus };

    if (!body.status || !allowedStatuses.includes(body.status)) {
      return NextResponse.json({ message: "지원하지 않는 상태입니다." }, { status: 400 });
    }

    const { data: existing, error: readError } = await client
      .from("place_submissions")
      .select("id, status, place_id, approval_token")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!existing) return NextResponse.json({ message: "제보를 찾지 못했습니다." }, { status: 404 });
    if (!canChangeSubmissionStatus(existing.status as SubmissionStatus, body.status) || existing.approval_token || existing.place_id) {
      return NextResponse.json({ message: "현재 제보 상태에서는 이 변경을 할 수 없습니다. 목록을 새로고침해 주세요." }, { status: 409 });
    }

    const { data, error } = await client
      .from("place_submissions")
      .update({
        status: body.status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", existing.status)
      .is("approval_token", null)
      .is("place_id", null)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ message: "다른 관리자가 먼저 처리했습니다. 목록을 새로고침해 주세요." }, { status: 409 });

    return NextResponse.json({ submission: data });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
