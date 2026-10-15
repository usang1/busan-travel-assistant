import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { isValidCoordinates } from "@/lib/location";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const [stays, recommendations, qrCampaigns] = await Promise.all([
      client.from("stays").select("*").order("updated_at", { ascending: false }),
      client.from("stay_recommendations").select("stay_id,place_id,sort_order,is_active").eq("is_active", true).order("sort_order"),
      client.from("qr_campaigns").select("id,code,stay_id,destination_path,label,status,created_at").not("stay_id", "is", null).order("created_at", { ascending: false }),
    ]);
    const error = stays.error ?? recommendations.error ?? qrCampaigns.error;
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") return NextResponse.json({ message: "숙소·QR DB 마이그레이션(050)을 먼저 적용해 주세요." }, { status: 503 });
      throw error;
    }
    return NextResponse.json({ stays: stays.data ?? [], recommendations: recommendations.data ?? [], qrCampaigns: qrCampaigns.data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAdmin(request);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ message: "숙소 입력값을 확인해 주세요." }, { status: 400 });
    const id = uuid(body.id);
    const slug = slugValue(body.slug);
    const coordinates = { latitude: Number(body.latitude), longitude: Number(body.longitude) };
    const name = text(body.name, 160);
    const address = text(body.address, 300);
    if (!slug || !name || !address || !isValidCoordinates(coordinates)) return NextResponse.json({ message: "숙소명, slug, 주소, 유효한 좌표는 필수입니다." }, { status: 400 });
    const payload = {
      slug,
      name,
      stay_type: enumValue(body.stay_type, ["hotel", "hostel", "guesthouse", "residence", "pension", "other"], "other"),
      address,
      road_address: text(body.road_address, 300) || null,
      ...coordinates,
      image_url: httpUrl(body.image_url),
      contact_name: text(body.contact_name, 120) || null,
      contact_email: email(body.contact_email),
      contact_phone: text(body.contact_phone, 50) || null,
      supported_locales: locales(body.supported_locales),
      status: enumValue(body.status, ["draft", "pending_review", "active", "suspended", "rejected"], "draft"),
      updated_at: new Date().toISOString(),
    };
    const result = id
      ? await client.from("stays").update(payload).eq("id", id).select("*").single()
      : await client.from("stays").insert({ ...payload, created_by: user.id }).select("*").single();
    if (result.error) throw result.error;
    const stay = result.data;
    const recommendationPlaceIds = Array.isArray(body.recommendationPlaceIds) ? body.recommendationPlaceIds.map(uuid).filter(Boolean) as string[] : [];
    const current = await client.from("stay_recommendations").select("place_id").eq("stay_id", stay.id).eq("is_active", true);
    if (current.error) throw current.error;
    const removed = (current.data ?? []).map((item) => String(item.place_id)).filter((placeId) => !recommendationPlaceIds.includes(placeId));
    if (removed.length) {
      const { error } = await client.from("stay_recommendations").update({ is_active: false, updated_at: new Date().toISOString() }).eq("stay_id", stay.id).in("place_id", removed);
      if (error) throw error;
    }
    if (recommendationPlaceIds.length) {
      const { error } = await client.from("stay_recommendations").upsert(recommendationPlaceIds.map((placeId, index) => ({ stay_id: stay.id, place_id: placeId, sort_order: index, is_active: true, created_by: user.id, updated_at: new Date().toISOString() })), { onConflict: "stay_id,place_id" });
      if (error) throw error;
    }

    let qrWarning = "";
    if (!id) {
      const code = `stay-${slug}-${randomBytes(4).toString("hex")}`;
      const qr = await client.from("qr_campaigns").insert({ code, stay_id: stay.id, destination_path: `/zh/stays/${slug}`, label: `${name} 숙소 QR`, status: "active", created_by: user.id });
      if (qr.error) qrWarning = "숙소는 저장했지만 QR 생성에 실패했습니다. 관리자 설정을 확인해 주세요.";
    }
    return NextResponse.json({ stay, qrWarning });
  } catch (error) {
    const value = error as { code?: string };
    if (value.code === "23505") return NextResponse.json({ message: "이미 사용 중인 숙소 slug입니다." }, { status: 409 });
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function uuid(value: unknown) { const textValue = typeof value === "string" ? value : ""; return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(textValue) ? textValue : ""; }
function slugValue(value: unknown) { const result = text(value, 100).toLowerCase(); return /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(result) ? result : ""; }
function enumValue<T extends string>(value: unknown, allowed: T[], fallback: T) { return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback; }
function httpUrl(value: unknown) { const result = text(value, 1000); if (!result) return null; try { const url = new URL(result); return url.protocol === "https:" ? url.toString() : null; } catch { return null; } }
function email(value: unknown) { const result = text(value, 200); return result && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(result) ? result : null; }
function locales(value: unknown) { const allowed = new Set(["ko", "zh", "en", "ja"]); const result = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && allowed.has(item)) : []; return result.length ? Array.from(new Set(result)) : ["ko", "zh", "en", "ja"]; }
