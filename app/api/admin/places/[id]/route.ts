import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { publicPlacesCacheTag } from "@/lib/cache-tags";
import { archivePlace, updatePlace } from "@/lib/place-store";
import { validatePlaceReadyForPublication } from "@/lib/place-validation";
import { isPublicPlace } from "@/lib/place-publishing";
import type { PlacePayload } from "@/types/database";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { client } = await requireAdmin(request);
    const { id } = await params;
    const payload = (await request.json()) as PlacePayload;
    if (isPublicPlace(payload)) {
      const { data: existing, error: readError } = await client.from("places").select("status, is_active").eq("id", id).maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!existing) return NextResponse.json({ message: "장소를 찾지 못했습니다." }, { status: 404 });
      if (!isPublicPlace(existing)) validatePlaceReadyForPublication(payload);
    }
    const place = await updatePlace(id, payload, client);
    revalidateTag(publicPlacesCacheTag, { expire: 0 });

    return NextResponse.json({ place });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { client } = await requireAdmin(request);
    const { id } = await params;
    await archivePlace(id, client);
    revalidateTag(publicPlacesCacheTag, { expire: 0 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
