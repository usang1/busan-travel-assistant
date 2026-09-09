import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/admin-auth";
import { saveOfficialGuide } from "@/lib/guide-admin";
import { guideInputError, guideUuid } from "@/lib/guide-validation";

type Context = { params: Promise<{ id: string }> };
async function routeId(context: Context) {
  const { id } = await context.params;
  if (!guideUuid.test(id)) throw guideInputError("가이드 ID가 올바르지 않습니다.");
  return id;
}
function failure(error: unknown) {
  const result = adminErrorResponse(error);
  return NextResponse.json({ message: result.message }, { status: result.status });
}
export async function GET(request: Request, context: Context) {
  try {
    const { client } = await requireAdmin(request);
    const { data, error } = await client.from("guides").select("*,guide_places(*)").eq("id", await routeId(context)).maybeSingle();
    if (error) throw error;
    if (!data) throw guideInputError("가이드를 찾을 수 없습니다.", 404);
    return NextResponse.json({ guide: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    const { client } = await requireAdmin(request);
    const id = await saveOfficialGuide(client, await routeId(context), await request.json());
    return NextResponse.json({ id });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const { client } = await requireAdmin(request);
    const { data, error } = await client.from("guides").delete().eq("id", await routeId(context)).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw guideInputError("가이드를 찾을 수 없습니다.", 404);
    return new Response(null, { status: 204 });
  } catch (error) { return failure(error); }
}
