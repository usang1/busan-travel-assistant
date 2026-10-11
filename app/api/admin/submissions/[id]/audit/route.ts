import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { client } = await requireAdmin(request);
    const { id } = await params;
    const { data, error } = await client
      .from("place_submission_audit")
      .select("id, submission_id, event_type, actor_id, previous_status, next_status, previous_place_id, next_place_id, previous_notification_status, next_notification_status, error_code, created_at")
      .eq("submission_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return NextResponse.json({ events: data ?? [] });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
