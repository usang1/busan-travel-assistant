import { NextResponse } from "next/server";
import { businessErrorResponse, isUuid, requireAuthenticatedUser } from "@/lib/business-auth";
import { sanitizeBusinessPlacePayload, validateBusinessPlaceSubmission } from "@/lib/business-place-payload";

export async function POST(request: Request) {
  try {
    const { client } = await requireAuthenticatedUser(request);
    const body = await request.json() as { changeId?: string | null; applicationId?: string; placeId?: string | null; payload?: unknown; submit?: boolean };
    if (!isUuid(body.applicationId)) return failure("invalid_application_id", "승인된 입점 신청을 선택해 주세요.", 400);
    if (body.changeId && !isUuid(body.changeId)) return failure("invalid_change_id", "변경 요청 ID가 올바르지 않습니다.", 400);
    if (body.placeId && !isUuid(body.placeId)) return failure("invalid_place_id", "업체 ID가 올바르지 않습니다.", 400);

    const safePayload = sanitizeBusinessPlacePayload(body.payload);
    if (body.submit) validateBusinessPlaceSubmission(safePayload);
    const { data, error } = await client.rpc("save_business_place_change", {
      change_id: body.changeId ?? null,
      target_application_id: body.applicationId,
      target_place_id: body.placeId ?? null,
      change_payload: safePayload,
      submit_for_review: body.submit === true,
    });
    if (error) {
      if (error.code === "PGRST202" || /save_business_place_change/iu.test(error.message ?? "")) return failure("migration_required", "사업자 관리 DB 마이그레이션(047)을 먼저 적용해 주세요.", 503);
      if (/approved_application_required/iu.test(error.message ?? "")) return failure("approved_application_required", "승인 완료된 입점 신청이 필요합니다.", 403);
      if (/place_ownership_required/iu.test(error.message ?? "")) return failure("place_ownership_required", "본인에게 연결된 업체만 수정할 수 있습니다.", 403);
      if (/change_not_editable/iu.test(error.message ?? "")) return failure("change_not_editable", "검수 중인 요청은 수정할 수 없습니다.", 409);
      throw error;
    }
    return NextResponse.json({ change: data, message: body.submit ? "검수를 요청했습니다. 승인 전까지 공개 정보는 바뀌지 않습니다." : "임시 저장했습니다." });
  } catch (error) {
    const response = businessErrorResponse(error);
    return NextResponse.json({ code: response.code, message: response.message }, { status: response.status });
  }
}

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ code, message }, { status });
}
