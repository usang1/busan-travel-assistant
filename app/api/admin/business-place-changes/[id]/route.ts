import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { isUuid } from "@/lib/business-auth";
import { publicPlacesCacheTag } from "@/lib/cache-tags";

type ReviewAction = "approve" | "changes_requested" | "reject";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let changeId = "unknown";
  let stage = "authenticate";
  try {
    const { client } = await requireAdmin(request);
    changeId = (await params).id;
    if (!isUuid(changeId)) return failure("invalid_change_id", "변경 요청 ID가 올바르지 않습니다.", 400);
    const body = await request.json() as { action?: ReviewAction; reason?: string; targetPlaceId?: string | null };
    if (!body.action || !["approve", "changes_requested", "reject"].includes(body.action)) {
      return failure("invalid_action", "처리 방법이 올바르지 않습니다.", 400);
    }
    if (body.targetPlaceId && !isUuid(body.targetPlaceId)) {
      return failure("invalid_place_id", "연결할 장소 UUID가 올바르지 않습니다.", 400);
    }

    if (body.action !== "approve") {
      if (!body.reason?.trim()) return failure("reason_required", "보완 또는 반려 사유를 입력해 주세요.", 400);
      stage = body.action;
      const decision = body.action === "reject" ? "rejected" : "changes_requested";
      const { data, error } = await client.rpc("review_business_place_change", {
        change_id: changeId,
        decision,
        reason: body.reason.trim(),
      });
      if (error) throw error;
      return NextResponse.json({
        change: data,
        message: decision === "rejected"
          ? "장소 정보 제출을 반려했습니다. 기존 공개 정보는 유지됩니다."
          : "보완을 요청했습니다. 기존 공개 정보는 유지됩니다.",
      });
    }

    stage = "transactional_publish";
    const { data, error } = await client.rpc("approve_business_place_change", {
      change_id: changeId,
      requested_place_id: body.targetPlaceId ?? null,
    });
    if (error) throw error;
    revalidateTag(publicPlacesCacheTag, { expire: 0 });
    const result = data as { code?: string; place_id?: string } | null;
    return NextResponse.json({
      change: result,
      message: result?.code === "already_approved"
        ? "이미 승인되어 공개된 장소 정보입니다."
        : "장소 정보를 승인해 사용자 사이트와 지도에 공개했습니다.",
    });
  } catch (error) {
    const detail = error as { code?: string; message?: string };
    process.stderr.write(`[business-place-changes:review-failed] ${JSON.stringify({ changeId, stage, code: detail.code ?? "unknown", error: error instanceof Error ? error.name : "unknown" })}\n`);
    const safe = mapReviewError(detail);
    if (safe) return failure(safe.code, safe.message, safe.status);
    const response = adminErrorResponse(error);
    return failure("review_failed", response.message, response.status);
  }
}

function mapReviewError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (error.code === "PGRST202" || /approve_business_place_change|review_business_place_change/iu.test(message)) return { code: "migration_required", message: "사업자 관리 DB 마이그레이션(047)을 먼저 적용해 주세요.", status: 503 };
  if (/change_not_found/iu.test(message)) return { code: "change_not_found", message: "장소 정보 제출 건을 찾지 못했습니다.", status: 404 };
  if (/change_not_approvable|change_not_rejectable/iu.test(message)) return { code: "invalid_review_state", message: "현재 상태에서는 이 검수 작업을 수행할 수 없습니다.", status: 409 };
  if (/approved_application_required/iu.test(message)) return { code: "approved_application_required", message: "입점 승인이 유효하지 않아 장소 정보를 승인할 수 없습니다.", status: 409 };
  if (/required_place_information_missing/iu.test(message)) return { code: "required_information_missing", message: "공개 필수 장소 정보가 누락되었습니다.", status: 400 };
  if (/place_not_found|target_mismatch|place_mismatch/iu.test(message)) return { code: "place_link_failed", message: "연결할 업체가 없거나 입점 신청의 업체와 일치하지 않습니다.", status: 409 };
  if (error.code === "23505") return { code: "duplicate_place", message: "같은 장소 식별자 또는 외부 지도 ID를 가진 장소가 이미 있습니다.", status: 409 };
  if (error.code === "42501" || /admin_required/iu.test(message)) return { code: "admin_required", message: "관리자 권한이 필요합니다.", status: 403 };
  return null;
}

function failure(code: string, message: string, status: number) {
  return NextResponse.json({ code, message }, { status });
}
