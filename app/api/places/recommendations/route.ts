import { NextResponse } from "next/server";
import { getNearbyPopularPlaces } from "@/lib/place-recommendations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get("latitude"));
  const longitude = Number(url.searchParams.get("longitude"));
  const requestedLimit = Number(url.searchParams.get("limit") ?? 4);

  if (!validCoordinates(latitude, longitude)) {
    return NextResponse.json({ message: "올바른 현재 위치 좌표가 필요합니다." }, { status: 400 });
  }

  try {
    const places = await getNearbyPopularPlaces(
      { latitude, longitude },
      Number.isFinite(requestedLimit) ? requestedLimit : 4,
    );
    return NextResponse.json({ places }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[places:nearby-popular]", error);
    return NextResponse.json({ message: "내 주변 인기 장소를 불러오지 못했습니다." }, { status: 500 });
  }
}

function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 &&
    !(latitude === 0 && longitude === 0);
}
