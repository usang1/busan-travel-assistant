"use client";

import { isValidCoordinates, type Coordinates } from "@/lib/location";

export type BrowserLocationErrorCode =
  | "unsupported"
  | "insecure_context"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "invalid_coordinates"
  | "unknown";

export class BrowserLocationError extends Error {
  constructor(
    public readonly code: BrowserLocationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BrowserLocationError";
  }
}

export type BrowserLocationResult = {
  coordinates: Coordinates;
  accuracyMeters: number | null;
  lowAccuracy: boolean;
  capturedAt: string;
};

export async function getCurrentBrowserLocation(options: PositionOptions = {}): Promise<BrowserLocationResult> {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !("geolocation" in navigator)) {
    throw new BrowserLocationError("unsupported", "이 브라우저는 위치 확인을 지원하지 않습니다.");
  }

  if (!isSecureLocationContext(window)) {
    throw new BrowserLocationError("insecure_context", "현재 위치는 HTTPS 또는 localhost에서만 사용할 수 있습니다.");
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 60_000,
      ...options,
    });
  }).catch((error: unknown) => {
    throw normalizePositionError(error);
  });

  const coordinates = {
    latitude: Number(position.coords.latitude),
    longitude: Number(position.coords.longitude),
  };

  if (!isValidCoordinates(coordinates)) {
    throw new BrowserLocationError("invalid_coordinates", "브라우저가 유효하지 않은 좌표를 반환했습니다.");
  }

  const accuracyMeters = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null;

  return {
    coordinates,
    accuracyMeters,
    lowAccuracy: accuracyMeters !== null && accuracyMeters > 100,
    capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
  };
}

export function isBrowserLocationError(error: unknown): error is BrowserLocationError {
  return error instanceof BrowserLocationError;
}

function isSecureLocationContext(win: Window) {
  return win.isSecureContext || win.location.hostname === "localhost" || win.location.hostname === "127.0.0.1";
}

function normalizePositionError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? Number(error.code) : 0;

  if (code === 1) return new BrowserLocationError("permission_denied", "위치 권한이 거부되었습니다.");
  if (code === 2) return new BrowserLocationError("position_unavailable", "기기에서 현재 위치를 확인할 수 없습니다.");
  if (code === 3) return new BrowserLocationError("timeout", "현재 위치 확인 시간이 초과되었습니다.");
  return new BrowserLocationError("unknown", "현재 위치를 확인하지 못했습니다.");
}
