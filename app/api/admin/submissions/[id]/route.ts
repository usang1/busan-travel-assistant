import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import type { SubmissionStatus } from "@/types/database";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const allowedStatuses: SubmissionStatus[] = ["pending", "reviewing", "approved", "rejected", "duplicate"];

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { client, user } = await requireAdmin(request);
    const { id } = await params;
    const body = (await request.json()) as { status?: SubmissionStatus };

    if (!body.status || !allowedStatuses.includes(body.status)) {
      return NextResponse.json({ message: "지원하지 않는 상태입니다." }, { status: 400 });
    }

    const { data, error } = await client
      .from("place_submissions")
      .update({
        status: body.status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ submission: data });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
