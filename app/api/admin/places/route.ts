import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { publicPlacesCacheTag } from "@/lib/cache-tags";
import { createPlace, getPlaces } from "@/lib/place-store";
import { validatePlaceReadyForPublication } from "@/lib/place-validation";
import { isPublicPlace } from "@/lib/place-publishing";
import type { PlacePayload } from "@/types/database";

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const result = await getPlaces({ activeOnly: false, includeAdminRelations: true, debugLabel: "admin-places" }, client);

    return NextResponse.json(result);
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAdmin(request);
    const payload = (await request.json()) as PlacePayload;
    payload.verification_checked_by = (payload.verification_tier ?? 0) > 0 ? user.id : null;
    if (isPublicPlace(payload)) validatePlaceReadyForPublication(payload);
    const place = await createPlace(payload, client);
    revalidateTag(publicPlacesCacheTag, { expire: 0 });

    return NextResponse.json({ place });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
