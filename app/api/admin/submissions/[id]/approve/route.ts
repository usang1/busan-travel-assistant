import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { archivePlace, createPlace, updatePlace } from "@/lib/place-store";
import type { PlacePayload } from "@/types/database";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  let createdPlaceId: string | null = null;

  try {
    const { client, user } = await requireAdmin(request);
    const { id } = await params;
    const payload = (await request.json()) as PlacePayload;
    const finalIsActive = payload.is_active;
    const draftPayload = { ...payload, is_active: false, status: "DRAFT" };
    const draftPlace = await createPlace(draftPayload, client);
    createdPlaceId = draftPlace.id;

    const { data: submission, error } = await client
      .from("place_submissions")
      .update({
        status: "approved",
        place_id: draftPlace.id,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const place = finalIsActive
      ? await updatePlace(draftPlace.id, { ...payload, is_active: true, status: "ACTIVE" }, client)
      : draftPlace;

    return NextResponse.json({ place, submission });
  } catch (error) {
    if (createdPlaceId) {
      try {
        const { client } = await requireAdmin(request);
        await archivePlace(createdPlaceId, client);
      } catch {
        // Best-effort rollback: keep the admin response focused on the original failure.
      }
    }

    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
