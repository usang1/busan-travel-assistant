import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { isUuid } from "@/lib/business-auth";
import { parseMapUrl } from "@/lib/map-url";

const statuses = new Set(["pending", "reviewing", "more_info_requested", "approved", "rejected"]);
const publicErrors: Record<string, { status: number; message: string }> = {
  login_required: { status: 401, message: "로그인이 필요합니다." },
  admin_required: { status: 403, message: "관리자 권한이 없습니다." },
  invalid_status: { status: 400, message: "처리 상태가 올바르지 않습니다." },
  application_not_found: { status: 404, message: "입점 신청 데이터를 찾지 못했습니다." },
  applicant_profile_missing: { status: 409, message: "신청자 계정과 프로필을 연결할 수 없습니다." },
  place_not_found: { status: 404, message: "연결할 기존 장소를 찾지 못했습니다." },
  approved_application_immutable: { status: 409, message: "이미 승인된 신청은 다른 상태로 되돌릴 수 없습니다." },
  approved_place_mismatch: { status: 409, message: "이미 승인된 신청에 다른 업체를 연결할 수 없습니다." },
  ownership_link_failed: { status: 409, message: "업체 소유권 연결에 실패했습니다." },
  database_permission_denied: { status: 503, message: "DB 권한 또는 정책 때문에 승인 처리를 완료하지 못했습니다." },
};

type ReviewResult = { ok?: boolean; code?: string; application_id?: string; user_id?: string; place_id?: string | null; status?: string };
type AdminClient = Awaited<ReturnType<typeof requireAdmin>>["client"];
type LinkedPlaceResolution =
  | { placeId: string | null }
  | { code: string; status: number; message: string };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let stage = "authentication";
  let applicationId = "unknown";
  try {
    const { client } = await requireAdmin(request);
    applicationId = (await params).id;
    if (!isUuid(applicationId)) return apiError("invalid_application_id", 400, "입점 신청 ID가 올바르지 않습니다.");

    const body = await request.json() as { status?: string; admin_notes?: string; linked_place_id?: string | null };
    if (!body.status || !statuses.has(body.status)) return apiError("invalid_status", 400, "처리 상태가 올바르지 않습니다.");
    if ((body.status === "rejected" || body.status === "more_info_requested") && !body.admin_notes?.trim()) {
      return apiError("review_notes_required", 400, body.status === "rejected" ? "반려 사유를 입력해 주세요." : "추가로 필요한 정보를 입력해 주세요.");
    }
    stage = "place_reference_resolution";
    const resolution = await resolveLinkedPlaceReference(client, body.linked_place_id);
    if ("code" in resolution) return apiError(resolution.code, resolution.status, resolution.message);
    const linkedPlaceId = resolution.placeId;

    stage = body.status === "approved" ? "approval_transaction" : "status_update";
    const { data, error } = await client.rpc("review_business_application", {
      application_id: applicationId,
      next_status: body.status,
      review_notes: body.admin_notes?.trim() || null,
      target_place_id: linkedPlaceId,
    });
    if (error) {
      if (error.code === "PGRST202" || /review_business_application/iu.test(error.message ?? "")) {
        return apiError("migration_required", 503, "입점 승인 DB 마이그레이션(047)을 먼저 적용해 주세요.");
      }
      throw error;
    }

    const result = data as ReviewResult | null;
    if (!result?.ok) {
      const code = result?.code ?? "review_failed";
      const known = publicErrors[code];
      return apiError(code, known?.status ?? 500, known?.message ?? "입점 승인 처리를 완료하지 못했습니다.");
    }

    return NextResponse.json({
      ok: true,
      code: result.code,
      message: result.code === "already_approved"
        ? "이미 승인된 신청입니다. 사업자 권한과 업체 소유권 연결 상태를 다시 확인했습니다."
        : body.status === "approved"
          ? linkedPlaceId
            ? "승인, 사업자 권한 부여, 업체 소유권 연결을 완료했습니다."
            : "승인과 사업자 권한 부여를 완료했습니다. 사업자가 새 업체 정보를 작성할 수 있습니다."
          : "입점 신청 처리 상태를 저장했습니다.",
      result,
    });
  } catch (caught) {
    const value = caught as { status?: number; code?: string };
    const status = typeof value.status === "number" ? value.status : 500;
    process.stderr.write(`[business-applications:review-failed] ${JSON.stringify({ applicationId, stage, code: value.code ?? "unknown", error: caught instanceof Error ? caught.name : "unknown" })}\n`);
    return apiError(status === 401 ? "login_required" : status === 403 ? "admin_required" : "server_error", status, status === 401 ? "유효한 관리자 세션이 필요합니다." : status === 403 ? "관리자 권한이 없습니다." : "입점 승인 처리 중 서버 오류가 발생했습니다.");
  }
}

function apiError(code: string, status: number, message: string) {
  return NextResponse.json({ code, message }, { status });
}

async function resolveLinkedPlaceReference(client: AdminClient, input?: string | null): Promise<LinkedPlaceResolution> {
  const reference = input?.normalize("NFKC").trim() || "";
  if (!reference) return { placeId: null };
  if (isUuid(reference)) return { placeId: reference };

  const numericNaverId = /^\d+$/u.test(reference) ? reference : null;
  const parsed = numericNaverId ? null : parseMapUrl(reference);
  if (!numericNaverId && (!parsed || parsed.provider === "unknown")) {
    return {
      code: "invalid_place_reference",
      status: 400,
      message: "기존 장소를 선택하거나 네이버·카카오·구글 지도 링크 또는 네이버 플레이스 번호를 입력해 주세요.",
    };
  }

  let query = client
    .from("place_sources")
    .select("place_id")
    .eq("provider", numericNaverId ? "NAVER" : parsed!.sourceProvider);

  if (numericNaverId || parsed?.placeId) {
    query = query.eq("external_id", numericNaverId ?? parsed!.placeId!);
  } else {
    query = query.eq("source_url", parsed!.normalizedUrl);
  }

  const { data, error } = await query.limit(2);
  if (error) throw error;
  if (!data?.length) {
    return {
      code: "place_reference_not_found",
      status: 404,
      message: "해당 지도 링크·플레이스 번호와 연결된 기존 장소가 없습니다. 신규 업체라면 입력칸을 비우고 승인해 주세요.",
    };
  }
  if (data.length > 1) {
    return {
      code: "ambiguous_place_reference",
      status: 409,
      message: "같은 지도 링크가 여러 장소에 연결되어 있습니다. 목록에서 기존 장소를 직접 선택해 주세요.",
    };
  }

  const placeId = data[0]?.place_id;
  if (!isUuid(placeId)) throw new Error("Resolved place has an invalid internal id");
  return { placeId };
}
