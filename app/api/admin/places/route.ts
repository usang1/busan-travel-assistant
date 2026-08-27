import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { createPlace, getPlaces } from "@/lib/place-store";
import type { PlacePayload } from "@/types/database";

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const result = await getPlaces({ activeOnly: false }, client);

    return NextResponse.json(result);
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const payload = (await request.json()) as PlacePayload;
    const place = await createPlace(payload, client);

    return NextResponse.json({ place });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
