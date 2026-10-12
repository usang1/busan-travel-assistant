import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerAnonClient } from "@/lib/server-supabase";

export type AuthenticatedContext = { client: SupabaseClient; user: User; role: string };

export class BusinessApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
  }
}

export async function requireAuthenticatedUser(request: Request): Promise<AuthenticatedContext> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/iu)?.[1];
  if (!token) throw new BusinessApiError("login_required", 401, "로그인이 필요합니다.");
  const client = createServerAnonClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new BusinessApiError("session_expired", 401, "세션이 만료되었습니다. 다시 로그인해 주세요.");
  const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profileError || !profile) throw new BusinessApiError("profile_required", 403, "계정 프로필을 확인할 수 없습니다.");
  return { client, user: data.user, role: String(profile.role) };
}

export function businessErrorResponse(error: unknown) {
  if (error instanceof BusinessApiError) return { code: error.code, message: error.message, status: error.status };
  const value = error as { code?: string };
  const code = value?.code === "42501" ? "permission_denied" : value?.code === "23505" ? "open_change_exists" : "server_error";
  const status = code === "permission_denied" ? 403 : code === "open_change_exists" ? 409 : 500;
  return {
    code,
    message: code === "permission_denied" ? "이 업체를 관리할 권한이 없습니다." : code === "open_change_exists" ? "이미 작성 중이거나 검수 중인 변경 요청이 있습니다." : "요청 처리 중 오류가 발생했습니다.",
    status,
  };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
