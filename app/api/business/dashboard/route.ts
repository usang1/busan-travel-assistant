import { NextResponse } from "next/server";
import { businessErrorResponse, requireAuthenticatedUser } from "@/lib/business-auth";
import { getPlaces } from "@/lib/place-store";

export async function GET(request: Request) {
  try {
    const { client, user, role } = await requireAuthenticatedUser(request);
    const [applicationsResult, membershipsResult, changesResult] = await Promise.all([
      client.from("business_applications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      client.from("business_place_memberships").select("*").eq("user_id", user.id).eq("status", "active").order("updated_at", { ascending: false }),
      client.from("business_place_changes").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    ]);
    const schemaError = membershipsResult.error ?? changesResult.error;
    if (schemaError && (schemaError.code === "42P01" || schemaError.code === "PGRST205")) {
      return NextResponse.json({ code: "migration_required", message: "사업자 관리 DB 마이그레이션(047)을 먼저 적용해 주세요." }, { status: 503 });
    }
    if (applicationsResult.error || membershipsResult.error || changesResult.error) throw applicationsResult.error ?? membershipsResult.error ?? changesResult.error;

    const placeIds = new Set((membershipsResult.data ?? []).map((row) => String(row.place_id)));
    const placeResult = placeIds.size ? await getPlaces({ activeOnly: false, includeAdminRelations: true, debugLabel: "business-dashboard" }, client) : { places: [], source: "none" as const };
    const places = placeResult.places.filter((place) => placeIds.has(place.id));

    return NextResponse.json({
      role,
      applications: applicationsResult.data ?? [],
      memberships: membershipsResult.data ?? [],
      changes: changesResult.data ?? [],
      places,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = businessErrorResponse(error);
    return NextResponse.json({ code: response.code, message: response.message }, { status: response.status });
  }
}
