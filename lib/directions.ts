import type { Coordinates } from "@/lib/location";

export type DirectionsProvider = "naver" | "kakao" | "google";

type BuildDirectionsUrlInput = {
  provider: DirectionsProvider;
  name: string;
  address?: string;
  coordinates?: Coordinates | null;
};

const naverAppName = "busan-travel-assistant";

export function buildDirectionsUrl({ provider, name, address, coordinates }: BuildDirectionsUrlInput) {
  const destinationLabel = address ? `${name} ${address}` : name;

  if (provider === "google") {
    const destination = coordinates
      ? `${coordinates.latitude},${coordinates.longitude}`
      : destinationLabel;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`;
  }

  if (provider === "kakao") {
    if (coordinates) {
      return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${coordinates.latitude},${coordinates.longitude}`;
    }

    return `https://map.kakao.com/?q=${encodeURIComponent(destinationLabel)}`;
  }

  if (coordinates) {
    return `nmap://route/walk?dlat=${coordinates.latitude}&dlng=${coordinates.longitude}&dname=${encodeURIComponent(name)}&appname=${encodeURIComponent(naverAppName)}`;
  }

  return `nmap://search?query=${encodeURIComponent(destinationLabel)}&appname=${encodeURIComponent(naverAppName)}`;
}
