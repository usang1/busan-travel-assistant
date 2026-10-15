import { NextResponse } from "next/server";
import { createServerAnonClient } from "@/lib/server-supabase";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!/^[a-z0-9][a-z0-9_-]{5,79}$/iu.test(code)) return NextResponse.redirect(new URL("/zh", request.url), 302);
  try {
    const client = createServerAnonClient();
    const { data } = await client.from("qr_campaigns").select("id,campaign_id,stay_id,place_id,destination_path,status").eq("code", code).eq("status", "active").maybeSingle();
    if (!data) return NextResponse.redirect(new URL("/zh", request.url), 302);
    const destination = new URL(String(data.destination_path), request.url);
    destination.searchParams.set("utm_source", data.stay_id ? "stay_qr" : "place_qr");
    destination.searchParams.set("utm_medium", "qr");
    destination.searchParams.set("utm_campaign", code);
    destination.searchParams.set("sp_campaign", String(data.campaign_id || data.id));
    if (data.stay_id) destination.searchParams.set("sp_stay", String(data.stay_id));
    return NextResponse.redirect(destination, 302);
  } catch {
    return NextResponse.redirect(new URL("/zh", request.url), 302);
  }
}
