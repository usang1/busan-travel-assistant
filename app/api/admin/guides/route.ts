import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";
import { saveOfficialGuide } from "@/lib/guide-admin";

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const { data, error } = await client.from("guides").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ guides: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = adminErrorResponse(error);
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
}
export async function POST(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const id = await saveOfficialGuide(client, null, await request.json());
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const result = adminErrorResponse(error);
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
}
