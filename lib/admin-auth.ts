import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type AdminContext = {
  client: SupabaseClient;
  user: User;
};

type PublicAdminError = Error & {
  status?: number;
  expose?: boolean;
};

function adminHttpError(message: string, status: number): PublicAdminError {
  return Object.assign(new Error(message), { status, expose: true });
}

export function createServerSupabaseClient(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function requireAdmin(request: Request): Promise<AdminContext> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    throw adminHttpError("로그인이 필요합니다.", 401);
  }

  const client = createServerSupabaseClient(token);
  const { data: userData, error: userError } = await client.auth.getUser(token);

  if (userError || !userData.user) {
    throw adminHttpError("유효하지 않은 세션입니다.", 401);
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    throw adminHttpError("관리자 권한이 필요합니다.", 403);
  }

  return { client, user: userData.user };
}

export function adminErrorResponse(error: unknown) {
  const publicError = error as PublicAdminError;
  const status = typeof publicError?.status === "number" ? publicError.status : 500;
  const expose = publicError?.expose === true || status < 500;

  return {
    message: expose && error instanceof Error ? error.message : "관리자 요청 처리 중 오류가 발생했습니다.",
    status: Number.isFinite(status) ? status : 500,
  };
}
