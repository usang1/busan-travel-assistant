import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { publicPlacesCacheTag } from "@/lib/cache-tags";
import { archivePlace, createPlace, findExistingPlaceIdForApproval, updatePlace } from "@/lib/place-store";
import { validatePlaceReadyForPublication } from "@/lib/place-validation";
import { canApproveSubmission } from "@/lib/submission-workflow";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlacePayload, SubmissionStatus } from "@/types/database";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ApprovalRequestBody = PlacePayload | {
  payload?: PlacePayload;
  placeId?: string;
};

function parseApprovalBody(body: ApprovalRequestBody) {
  if ("payload" in body && body.payload) {
    return {
      payload: body.payload,
      placeId: typeof body.placeId === "string" && body.placeId.trim() ? body.placeId.trim() : null,
    };
  }

  return {
    payload: body as PlacePayload,
    placeId: null,
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  let createdPlaceId: string | null = null;
  let claimedId: string | null = null;
  let claimToken: string | null = null;
  let claimClient: SupabaseClient | null = null;
  let failureStage = "approval_failed";
  let attemptedId: string | null = null;

  try {
    const { client, user } = await requireAdmin(request);
    const { id } = await params;
    attemptedId = id;
    const { payload, placeId } = parseApprovalBody((await request.json()) as ApprovalRequestBody);
    if (payload.status !== "PUBLISHED" || payload.is_active !== true) {
      return NextResponse.json({ message: "제보 승인은 공개 상태의 장소에만 연결할 수 있습니다." }, { status: 400 });
    }
    validatePlaceReadyForPublication(payload);

    const { data: existingSubmission, error: existingError } = await client
      .from("place_submissions")
      .select("id, status, place_id, approval_token, approval_started_at")
      .eq("id", id)
      .single();

    if (existingError || !existingSubmission) {
      throw new Error(existingError?.message ?? "제보를 찾지 못했습니다.");
    }
    if (!canApproveSubmission(existingSubmission.status as SubmissionStatus)) {
      return NextResponse.json({ message: "이미 처리 중이거나 승인할 수 없는 제보입니다." }, { status: 409 });
    }
    if (existingSubmission.approval_token) {
      const startedAt = Date.parse(existingSubmission.approval_started_at ?? "");
      if (!Number.isFinite(startedAt) || Date.now() - startedAt < 15 * 60_000) {
        return NextResponse.json({ message: "다른 관리자의 승인 작업이 진행 중입니다. 잠시 후 다시 확인해 주세요." }, { status: 409 });
      }
      const { data: released, error: releaseError } = await client
        .from("place_submissions")
        .update({ approval_token: null, approval_started_at: null, approval_last_error: "approval_interrupted" })
        .eq("id", id)
        .eq("approval_token", existingSubmission.approval_token)
        .select("id")
        .maybeSingle();
      if (releaseError) throw new Error(releaseError.message);
      if (!released) return NextResponse.json({ message: "제보 상태가 변경됐습니다. 목록을 새로고침해 주세요." }, { status: 409 });
    }

    const reusablePlaceId = await findExistingPlaceIdForApproval(payload, client);
    if (placeId && placeId !== existingSubmission.place_id && placeId !== reusablePlaceId) {
      return NextResponse.json({ message: "선택한 장소가 제보의 지도 ID 또는 주소명과 일치하지 않습니다." }, { status: 409 });
    }

    const token = randomUUID();
    const { data: claim, error: claimError } = await client
      .from("place_submissions")
      .update({ approval_token: token, approval_started_at: new Date().toISOString(), approval_last_error: null })
      .eq("id", id)
      .eq("status", existingSubmission.status)
      .is("approval_token", null)
      .select("id, place_id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claim) return NextResponse.json({ message: "다른 관리자가 먼저 처리했습니다. 목록을 새로고침해 주세요." }, { status: 409 });
    claimedId = id;
    claimToken = token;
    claimClient = client;

    const targetPlaceId = claim.place_id ?? placeId ?? reusablePlaceId;

    failureStage = "place_write_failed";
    const place = targetPlaceId
      ? await updatePlace(targetPlaceId, payload, client)
      : await createPlace(payload, client);
    if (!targetPlaceId) createdPlaceId = place.id;

    failureStage = "submission_finalize_failed";
    const { data: submission, error } = await client
      .from("place_submissions")
      .update({
        status: "approved",
        place_id: place.id,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        approval_token: null,
        approval_started_at: null,
        approval_last_error: null,
      })
      .eq("id", id)
      .eq("status", existingSubmission.status)
      .eq("approval_token", token)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!submission) throw new Error("승인 완료 기록을 저장하지 못했습니다.");
    claimedId = null;
    claimToken = null;
    createdPlaceId = null;

    try {
      revalidateTag(publicPlacesCacheTag, { expire: 0 });
    } catch (cacheError) {
      process.stderr.write(`[submissions:cache-revalidate-failed] ${JSON.stringify({ submissionId: id, error: cacheError instanceof Error ? cacheError.name : "unknown" })}\n`);
    }

    return NextResponse.json({ place, submission });
  } catch (error) {
    const response = adminErrorResponse(error);
    if (response.status >= 500) {
      process.stderr.write(`[submissions:approval-failed] ${JSON.stringify({ submissionId: attemptedId, stage: failureStage, error: error instanceof Error ? error.name : "unknown" })}\n`);
    }
    if (createdPlaceId) {
      try {
        await archivePlace(createdPlaceId, claimClient ?? undefined);
      } catch (rollbackError) {
        process.stderr.write(`[submissions:rollback-failed] ${JSON.stringify({ submissionId: claimedId, placeId: createdPlaceId, error: rollbackError instanceof Error ? rollbackError.name : "unknown" })}\n`);
      }
    }
    if (claimedId && claimToken && claimClient) {
      try {
        const { error: releaseError } = await claimClient
          .from("place_submissions")
          .update({ approval_token: null, approval_started_at: null, approval_last_error: failureStage })
          .eq("id", claimedId)
          .eq("approval_token", claimToken);
        if (releaseError) process.stderr.write(`[submissions:claim-release-failed] ${JSON.stringify({ submissionId: claimedId, code: releaseError.code })}\n`);
      } catch (releaseError) {
        process.stderr.write(`[submissions:claim-release-failed] ${JSON.stringify({ submissionId: claimedId, error: releaseError instanceof Error ? releaseError.name : "unknown" })}\n`);
      }
    }

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
