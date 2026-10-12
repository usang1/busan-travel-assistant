import { NextRequest, NextResponse } from "next/server";
import { hasAdminAccess } from "@/lib/account-role";
import { createServerAnonClient } from "@/lib/server-supabase";

type OnboardingBody = {
  displayName?: string;
  role?: string;
  terms?: boolean;
  privacy?: boolean;
  marketing?: boolean;
};

function getRequestedRole(role: string | undefined) {
  if (role === "tourist" || role === "business_owner") return role;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "");
    if (!token) return NextResponse.json({ message: "login_required" }, { status: 401 });

    const client = createServerAnonClient(token);
    const { data } = await client.auth.getUser(token);
    if (!data.user) return NextResponse.json({ message: "login_required" }, { status: 401 });

    const body = await request.json() as OnboardingBody;
    const requestedRole = getRequestedRole(body.role);
    if (!body.displayName?.trim() || !requestedRole || !body.terms || !body.privacy) {
      return NextResponse.json({ message: "invalid_onboarding" }, { status: 400 });
    }

    const { data: currentProfile, error: profileError } = await client
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError || !currentProfile) throw new Error("profile_required");

    // Account intent is not authorization.  business_owner is granted only by
    // the transactional application approval RPC.
    const effectiveRole = hasAdminAccess(currentProfile.role) ? "admin" : currentProfile.role === "business_owner" ? "business_owner" : "tourist";
    const now = new Date().toISOString();
    const { error } = await client
      .from("profiles")
      .update({
        display_name: body.displayName.trim().slice(0, 80),
        role: effectiveRole,
        terms_accepted_at: now,
        privacy_accepted_at: now,
        marketing_opt_in: body.marketing === true,
        onboarding_completed: true,
      })
      .eq("id", data.user.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, role: effectiveRole });
  } catch {
    return NextResponse.json({ message: "onboarding_failed" }, { status: 500 });
  }
}
