import { parseMapUrl } from "@/lib/map-url";

export const BUSINESS_APPLICATION_CONSENT_VERSION = "business-application-privacy-v1";
export const BUSINESS_APPLICATION_NAME_MAX_LENGTH = 60;

export const businessApplicantRoles = ["owner", "staff", "agency"] as const;
export type BusinessApplicantRole = (typeof businessApplicantRoles)[number];

export type BusinessApplicationInput = {
  placeUrl: unknown;
  applicantName: unknown;
  applicantRole: unknown;
  contactPhone: unknown;
  privacyConsent: unknown;
  consentVersion: unknown;
};

export type BusinessApplicationField = "placeUrl" | "applicantName" | "applicantRole" | "contactPhone" | "privacyConsent";
export type BusinessApplicationValidationCode =
  | "invalid_place_url"
  | "invalid_applicant_name"
  | "invalid_applicant_role"
  | "invalid_contact_phone"
  | "consent_required"
  | "consent_version_mismatch";

export type ValidBusinessApplication = {
  placeUrl: string;
  applicantName: string;
  applicantRole: BusinessApplicantRole;
  contactPhone: string;
  consentVersion: typeof BUSINESS_APPLICATION_CONSENT_VERSION;
};

export function validateBusinessApplicationInput(input: BusinessApplicationInput):
  | { ok: true; data: ValidBusinessApplication }
  | { ok: false; code: BusinessApplicationValidationCode; field: BusinessApplicationField } {
  const placeUrl = normalizeNaverPlaceUrl(input.placeUrl);
  if (!placeUrl) return { ok: false, code: "invalid_place_url", field: "placeUrl" };

  const applicantRole = typeof input.applicantRole === "string" && businessApplicantRoles.includes(input.applicantRole as BusinessApplicantRole)
    ? input.applicantRole as BusinessApplicantRole
    : null;
  if (!applicantRole) return { ok: false, code: "invalid_applicant_role", field: "applicantRole" };

  const applicantName = normalizeApplicantName(input.applicantName);
  if (!applicantName) return { ok: false, code: "invalid_applicant_name", field: "applicantName" };

  const contactPhone = normalizeKoreanMobilePhone(input.contactPhone);
  if (!contactPhone) return { ok: false, code: "invalid_contact_phone", field: "contactPhone" };

  if (input.privacyConsent !== true) return { ok: false, code: "consent_required", field: "privacyConsent" };
  if (input.consentVersion !== BUSINESS_APPLICATION_CONSENT_VERSION) {
    return { ok: false, code: "consent_version_mismatch", field: "privacyConsent" };
  }

  return {
    ok: true,
    data: { placeUrl, applicantName, applicantRole, contactPhone, consentVersion: BUSINESS_APPLICATION_CONSENT_VERSION },
  };
}

export function normalizeNaverPlaceUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const input = value.normalize("NFKC").trim();
  if (!input || input.length > 2_000) return null;

  let original: URL;
  try {
    original = new URL(input);
  } catch {
    return null;
  }
  if (original.protocol !== "https:") return null;

  const parsed = parseMapUrl(input);
  if (parsed.provider !== "naver") return null;

  const host = original.hostname.toLowerCase();
  const isShortLink = host === "naver.me" && original.pathname.length > 1;
  const isDetailedPlaceLink = Boolean(parsed.placeId)
    || /\/(?:entry\/place|place|restaurant|cafe)\/\d+(?:$|[/?#])/u.test(original.pathname);
  if (!isShortLink && !isDetailedPlaceLink) return null;

  if (parsed.placeId) return `https://map.naver.com/p/entry/place/${parsed.placeId}`;
  original.hash = "";
  return original.toString();
}

export function normalizeApplicantName(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized && normalized.length <= BUSINESS_APPLICATION_NAME_MAX_LENGTH ? normalized : null;
}

export function normalizeKoreanMobilePhone(value: unknown) {
  if (typeof value !== "string") return null;
  let digits = value.normalize("NFKC").replace(/\D/gu, "");
  if (digits.startsWith("82")) digits = `0${digits.slice(2)}`;
  if (!/^010\d{8}$/u.test(digits)) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function formatKoreanMobilePhoneInput(value: string) {
  let digits = value.normalize("NFKC").replace(/\D/gu, "").slice(0, 11);
  if (digits.startsWith("82")) digits = `0${digits.slice(2)}`.slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
