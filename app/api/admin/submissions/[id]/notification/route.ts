import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { notifyPlaceSubmission } from "@/lib/submission-notifications";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { client } = await requireAdmin(request);
    const { id } = await params;
    const { data: submission, error } = await client
      .from("place_submissions")
      .select("id, user_id, name, notification_status, notification_attempts")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!submission) return NextResponse.json({ message: "제보를 찾지 못했습니다." }, { status: 404 });
    if (submission.notification_status === "sent") {
      return NextResponse.json({ message: "이미 알림 전송이 확인됐습니다." }, { status: 409 });
    }

    const notification = await notifyPlaceSubmission({
      submissionId: id,
      submitterLabel: submission.user_id || "익명",
      client,
      previousAttempts: submission.notification_attempts ?? 0,
    });
    if (!notification.recorded) return NextResponse.json({ message: "전송 결과를 기록하지 못했습니다." }, { status: 503 });
    return NextResponse.json({ notification });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
