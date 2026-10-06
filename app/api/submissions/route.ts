import { NextRequest, NextResponse } from "next/server";
import { isLocale, ui, type Locale } from "@/lib/i18n";
import { parseMapUrl } from "@/lib/map-url";
import { createServerAnonClient, ServerConfigurationError } from "@/lib/server-supabase";
import { sendPlaceSubmissionNotification } from "@/lib/telegram";
import { placeCategories, type PlaceCategory } from "@/types/database";
import { createHash } from "node:crypto";
import { buildSubmissionDuplicateSource, validateSubmissionLocation } from "@/lib/place-submission-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxRequestBytes = 16_384;
const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };

type SubmissionRequestBody = {
  locale?: unknown;
  mapUrl?: unknown;
  reason?: unknown;
  name?: unknown;
  category?: unknown;
  description?: unknown;
  locationText?: unknown;
  imageUrl?: unknown;
  extraNotes?: unknown;
};

export async function POST(request: NextRequest) {
  if (!isSameRequestOrigin(request)) return json({ message: "cross_site_blocked" }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ message: "json_required" }, 415);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) return json({ message: "request_too_large" }, 413);

  try {
    const rawBody = await request.text();
    if (rawBody.length > maxRequestBytes) return json({ message: "request_too_large" }, 413);
    const body = JSON.parse(rawBody) as SubmissionRequestBody;
    const payload = parseSubmissionPayload(body);
    const actor = await getOptionalUser(request);
    const client = createServerAnonClient(actor.accessToken ?? undefined);
    const copy = ui[payload.locale];
    const parsedMap = parseMapUrl(payload.mapUrl);
    const duplicateKey = createHash("sha256").update(buildSubmissionDuplicateSource(payload)).digest("hex");
    const notes = [
      payload.reason,
      payload.description ? `${copy.submissions.descriptionLabel}: ${payload.description}` : "",
      payload.imageUrl ? `${copy.submissions.imageUrl}: ${payload.imageUrl}` : "",
      payload.extraNotes ? `${copy.submissions.notes}: ${payload.extraNotes}` : "",
    ].filter(Boolean).join("\n\n");

    const { error } = await client
      .from("place_submissions")
      .insert({
        user_id: actor.userId,
        locale: payload.locale,
        name: payload.name || null,
        category: payload.category,
        provider: parsedMap.sourceProvider,
        external_id: parsedMap.placeId ?? null,
        source_url: parsedMap.normalizedUrl || null,
        address_text: payload.locationText || null,
        location_text: payload.locationText || null,
        recommendation_reason: payload.reason,
        duplicate_key: duplicateKey,
        notes: notes || payload.reason || payload.name || parsedMap.normalizedUrl,
        status: "pending",
      });

    if (error?.code === "23505") {
      throw new SubmissionRouteError("duplicate_submission", 409);
    }
    if (error) {
      throw new SubmissionRouteError("submission_insert_failed", 500);
    }

    await sendPlaceSubmissionNotification({
      submitterLabel: actor.email || actor.userId || "익명",
    });

    return NextResponse.json(
      { submission: { provider: parsedMap.sourceProvider } },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof SubmissionRouteError) {
      return json(
        { message: error instanceof SubmissionRouteError ? error.message : "invalid_submission" },
        error instanceof SubmissionRouteError ? error.status : 400,
      );
    }
    if (error instanceof ServerConfigurationError) return json({ message: "submission_not_configured" }, 503);
    return json({ message: "submission_failed" }, 500);
  }
}

function parseSubmissionPayload(body: SubmissionRequestBody) {
  const localeValue = readText(body.locale, 8);
  const locale: Locale = isLocale(localeValue) ? localeValue : "zh";
  const categoryValue = readText(body.category, 40);
  const category = placeCategories.includes(categoryValue as PlaceCategory) ? categoryValue as PlaceCategory : null;
  const reason = readText(body.reason, 1000);
  const name = readText(body.name, 120);
  const mapUrl = readText(body.mapUrl, 2000);
  const locationText = readText(body.locationText, 240);

  if (!reason) throw new SubmissionRouteError("invalid_submission", 400);
  const locationValidation = validateSubmissionLocation({ mapUrl, name, locationText });
  if (!locationValidation.valid) {
    throw new SubmissionRouteError(locationValidation.error ?? "invalid_submission", 400);
  }

  return {
    locale,
    mapUrl,
    reason,
    name,
    category,
    description: readText(body.description, 1200),
    locationText,
    imageUrl: readText(body.imageUrl, 1000),
    extraNotes: readText(body.extraNotes, 1200),
  };
}

function readText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.normalize("NFKC").trim().slice(0, maxLength) : "";
}

async function getOptionalUser(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  if (!accessToken) return { accessToken: null, userId: null, email: null };

  const client = createServerAnonClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new SubmissionRouteError("invalid_session", 401);

  return {
    accessToken,
    userId: data.user.id,
    email: data.user.email ?? null,
  };
}

function isSameRequestOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host") ?? request.nextUrl.host;
    return originUrl.host === forwardedHost;
  } catch {
    return false;
  }
}

function json(body: { message: string }, status: number) {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

class SubmissionRouteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
