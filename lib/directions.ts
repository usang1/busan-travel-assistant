import type { Coordinates } from "@/lib/location";

export type DirectionsProvider = "naver" | "kakao" | "google";

type BuildDirectionsUrlInput = {
  provider: DirectionsProvider;
  name: string;
  address?: string;
  coordinates?: Coordinates | null;
  origin?: { name: string; coordinates?: Coordinates | null };
};

const naverAppName = "busan-travel-assistant";

export function buildDirectionsUrl({ provider, name, address, coordinates, origin }: BuildDirectionsUrlInput) {
  const destinationLabel = address ? `${name} ${address}` : name;

  if (provider === "google") {
    const destination = coordinates
      ? `${coordinates.latitude},${coordinates.longitude}`
      : destinationLabel;
    const originQuery = origin?.coordinates ? `&origin=${encodeURIComponent(`${origin.coordinates.latitude},${origin.coordinates.longitude}`)}` : "";
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${originQuery}&travelmode=walking`;
  }

  if (provider === "kakao") {
    if (coordinates) {
      if (origin?.coordinates) return `https://map.kakao.com/link/from/${encodeURIComponent(origin.name)},${origin.coordinates.latitude},${origin.coordinates.longitude}/to/${encodeURIComponent(name)},${coordinates.latitude},${coordinates.longitude}`;
      return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${coordinates.latitude},${coordinates.longitude}`;
    }

    return `https://map.kakao.com/?q=${encodeURIComponent(destinationLabel)}`;
  }

  if (coordinates) {
    const start = origin?.coordinates ? `slat=${origin.coordinates.latitude}&slng=${origin.coordinates.longitude}&sname=${encodeURIComponent(origin.name)}&` : "";
    return `nmap://route/walk?${start}dlat=${coordinates.latitude}&dlng=${coordinates.longitude}&dname=${encodeURIComponent(name)}&appname=${encodeURIComponent(naverAppName)}`;
  }

  return `nmap://search?query=${encodeURIComponent(destinationLabel)}&appname=${encodeURIComponent(naverAppName)}`;
}
