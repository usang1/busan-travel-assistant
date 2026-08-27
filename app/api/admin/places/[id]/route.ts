import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { archivePlace, updatePlace } from "@/lib/place-store";
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
    const place = await updatePlace(id, payload, client);

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

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
