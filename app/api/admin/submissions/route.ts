import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import type { SubmissionStatus } from "@/types/database";

const allowedStatuses: SubmissionStatus[] = ["pending", "reviewing", "approved", "rejected", "duplicate"];

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let query = client
      .from("place_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && allowedStatuses.includes(status as SubmissionStatus)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ submissions: data ?? [] });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
