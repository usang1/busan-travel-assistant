import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import type { PlaceCorrectionStatus } from "@/types/database";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const allowedStatuses: PlaceCorrectionStatus[] = ["pending", "accepted", "rejected"];

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { client, user } = await requireAdmin(request);
    const { id } = await params;
    const body = (await request.json()) as { status?: PlaceCorrectionStatus };

    if (!body.status || !allowedStatuses.includes(body.status)) {
      return NextResponse.json({ message: "지원하지 않는 상태입니다." }, { status: 400 });
    }

    const { data, error } = await client
      .from("place_corrections")
      .update({
        status: body.status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, places(id, slug, name_zh, name_ko, category)")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ correction: data });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
