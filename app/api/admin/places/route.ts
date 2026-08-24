import { NextResponse } from "next/server";
import { createPlace, getPlaces } from "@/lib/place-store";
import type { PlacePayload } from "@/types/database";

export async function GET() {
  const result = await getPlaces({ activeOnly: false });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as PlacePayload;
    const place = await createPlace(payload);

    return NextResponse.json({ place });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "장소 추가에 실패했습니다." },
      { status: 400 },
    );
  }
}
