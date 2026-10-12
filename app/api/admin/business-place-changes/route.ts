import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { getPlaces } from "@/lib/place-store";
import type { BusinessPlaceChangeStatus } from "@/types/database";

const statuses = new Set<BusinessPlaceChangeStatus>(["draft", "pending_review", "changes_requested", "approved", "rejected"]);

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const url = new URL(request.url);
    const requestedStatus = url.searchParams.get("status") as BusinessPlaceChangeStatus | null;
    const search = url.searchParams.get("q")?.trim().toLocaleLowerCase("ko") ?? "";
    let query = client.from("business_place_changes").select("*").order("created_at", { ascending: false }).limit(200);
    if (requestedStatus && statuses.has(requestedStatus)) query = query.eq("status", requestedStatus);
    const { data, error } = await query;
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") return NextResponse.json({ message: "사업자 관리 DB 마이그레이션(047)을 먼저 적용해 주세요." }, { status: 503 });
      throw error;
    }
    const rows = data ?? [];
    const applicationIds = [...new Set(rows.map((row) => String(row.application_id)))];
    const placeIds = new Set(rows.flatMap((row) => [row.place_id, row.published_place_id].filter(Boolean).map(String)));
    const [applicationsResult, auditResult, placeResult] = await Promise.all([
      applicationIds.length
        ? client.from("business_applications").select("id,user_id,store_name,status,address,contact_name").in("id", applicationIds)
        : Promise.resolve({ data: [], error: null }),
      rows.length
        ? client.from("business_place_change_audit").select("*").in("change_id", rows.map((row) => row.id)).order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      placeIds.size
        ? getPlaces({ activeOnly: false, includeAdminRelations: true, debugLabel: "business-place-change-review" }, client)
        : Promise.resolve({ places: [] }),
    ]);
    if (applicationsResult.error || auditResult.error) throw applicationsResult.error ?? auditResult.error;
    const applications = new Map((applicationsResult.data ?? []).map((application) => [application.id, application]));
    const places = new Map(placeResult.places.filter((place) => placeIds.has(place.id)).map((place) => [place.id, place]));
    const enriched = rows.map((row) => ({
      ...row,
      application: applications.get(row.application_id) ?? null,
      existing_place: row.place_id ? places.get(row.place_id) ?? null : null,
      audit: (auditResult.data ?? []).filter((event) => event.change_id === row.id),
    })).filter((row) => {
      if (!search) return true;
      const submittedName = String(row.payload?.name_ko ?? row.payload?.name_zh ?? "").toLocaleLowerCase("ko");
      return submittedName.includes(search) || String(row.application?.store_name ?? "").toLocaleLowerCase("ko").includes(search);
    });
    return NextResponse.json({ changes: enriched }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
