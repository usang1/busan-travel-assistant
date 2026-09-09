import type { SupabaseClient } from "@supabase/supabase-js";
import { guideInputError, validateGuidePayload } from "@/lib/guide-validation";

export async function saveOfficialGuide(client: SupabaseClient, id: string | null, value: unknown) {
  const payload = validateGuidePayload(value);
  const expected = (value as Record<string, unknown>).updated_at;
  if (id && (typeof expected !== "string" || !Number.isFinite(Date.parse(expected)))) {
    throw guideInputError("최신 가이드를 다시 불러온 후 저장해주세요.", 409);
  }
  const { data, error } = await client.rpc("save_official_guide", {
    target_id: id, payload, expected_updated_at: id ? expected : null,
  });
  if (error) {
    if (error.code === "23505") throw guideInputError("이미 사용 중인 URL이거나 중복 장소가 있습니다.", 409);
    if (error.code === "40001") throw guideInputError("다른 작업에서 수정되었습니다. 목록에서 다시 불러와주세요.", 409);
    if (error.code === "P0002") throw guideInputError("가이드를 찾을 수 없습니다.", 404);
    if (error.code === "22023") throw guideInputError("공개할 코스에는 공개된 장소만 추가할 수 있습니다.");
    if (error.code === "23503") throw guideInputError("삭제되었거나 존재하지 않는 장소입니다.");
    throw error;
  }
  return data as string;
}
