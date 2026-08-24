import { NextResponse } from "next/server";
import { deletePlace, updatePlace } from "@/lib/place-store";
import type { PlacePayload } from "@/types/database";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as PlacePayload;
    const place = await updatePlace(id, payload);

    return NextResponse.json({ place });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "장소 수정에 실패했습니다." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    await deletePlace(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "장소 삭제에 실패했습니다." },
      { status: 400 },
    );
  }
}
