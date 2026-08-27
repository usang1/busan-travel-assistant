import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import type { PlaceCorrectionStatus } from "@/types/database";

const allowedStatuses: PlaceCorrectionStatus[] = ["pending", "accepted", "rejected"];

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let query = client
      .from("place_corrections")
      .select("*, places(id, slug, name_zh, name_ko, category)")
      .order("created_at", { ascending: false });

    if (status && allowedStatuses.includes(status as PlaceCorrectionStatus)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ corrections: data ?? [] });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
