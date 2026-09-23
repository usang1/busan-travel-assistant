import { getPlaceContent, type Locale } from "@/lib/i18n";
import { getRepresentativeMenu } from "@/lib/place-display";
import { getPlaceCategoryLabel, getPlaceNameDisplay, getTrustedPlaceImageUrl } from "@/lib/place-trust";
import type { PlaceWithRelations } from "@/types/database";

export const socialInputKinds = ["link", "text", "image", "direct"] as const;
export type SocialInputKind = (typeof socialInputKinds)[number];
export const socialPlatforms = ["xiaohongshu", "instagram", "tiktok", "youtube", "other"] as const;
export type SocialPlatform = (typeof socialPlatforms)[number];

export type SocialDiscoveryClues = {
  placeTerms: string[];
  regionTerms: string[];
  stationTerms: string[];
  menuTerms: string[];
  priceTerms: string[];
  landmarkTerms: string[];
  hashtags: string[];
  signText: string[];
  addressTerms: string[];
};

export type ApprovedSocialAlias = {
  alias: string;
  placeId: string;
};

export type SocialDiscoveryCandidate = {
  id: string;
  slug: string;
  name: string;
  secondaryName: string;
  koreanName: string;
  address: string;
  koreanAddress: string;
  region: string;
  category: string;
  representativeMenu: string;
  thumbnailUrl: string;
  latitude: number | null;
  longitude: number | null;
  saveCount: number;
  confidence: number;
  matchedClues: string[];
  matchSource: "rules" | "approved_alias";
};

const maxTermLength = 80;
const maxTermsPerGroup = 24;
const socialHostRules: Array<{ platform: SocialPlatform; domains: string[] }> = [
  { platform: "xiaohongshu", domains: ["xiaohongshu.com", "xhslink.com"] },
  { platform: "instagram", domains: ["instagram.com"] },
  { platform: "tiktok", domains: ["tiktok.com"] },
  { platform: "youtube", domains: ["youtube.com", "youtu.be"] },
];
const regionPatterns = [
  "광안리", "광안", "수영구", "해운대", "해운대구", "서면", "부산진구", "남포동", "중구", "영도", "영도구",
  "기장", "기장군", "동래", "동래구", "남구", "북구", "동구", "서구", "사하구", "사상구", "금정구", "강서구", "연제구",
  "广安里", "广安", "水营区", "海云台", "海云台区", "西面", "釜山镇区", "南浦洞", "影岛", "机张", "釜山",
];
const landmarkPatterns = ["광안대교", "광안리해수욕장", "해운대해수욕장", "민락수변공원", "부산역", "广安大桥", "广安里海水浴场", "海云台海水浴场", "釜山站"];
const genericTerms = new Set([
  "부산", "釜山", "한국", "韩国", "여행", "旅行", "맛집", "美食", "추천", "推荐", "카페", "咖啡", "장소", "地点",
  "xiaohongshu", "instagram", "tiktok", "youtube", "http", "https", "www", "com", "小红书", "인스타", "틱톡",
]);

export class SocialDiscoveryInputError extends Error {}

export function normalizePublicSocialUrl(rawValue: string) {
  const raw = rawValue.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new SocialDiscoveryInputError("unsupported_protocol");
  if (url.username || url.password) throw new SocialDiscoveryInputError("url_credentials_not_allowed");

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateHostname(hostname)) {
    throw new SocialDiscoveryInputError("private_host_not_allowed");
  }
  const rule = socialHostRules.find((item) => item.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)));
  if (!rule) throw new SocialDiscoveryInputError("unsupported_social_host");

  const normalized = new URL(`https://${hostname}${url.pathname.replace(/\/{2,}/g, "/")}`);
  normalized.search = "";
  normalized.hash = "";
  return { normalizedUrl: normalized.toString(), platform: rule.platform };
}

export function findSocialUrl(value: string) {
  const candidates = value.match(/https?:\/\/[^\s<>"']+/giu) ?? [];
  for (const candidate of candidates.slice(0, 5)) {
    const trimmed = candidate.replace(/[),.;!?，。！？）]+$/u, "");
    try {
      const normalized = normalizePublicSocialUrl(trimmed);
      if (normalized) return normalized;
    } catch (error) {
      if (error instanceof SocialDiscoveryInputError && error.message === "unsupported_social_host") continue;
      throw error;
    }
  }
  return null;
}

export function extractSocialClues(value: string): SocialDiscoveryClues {
  const text = value.normalize("NFKC").replace(/https?:\/\/\S+/giu, " ").slice(0, 6000);
  const hashtags = uniqueTerms([...text.matchAll(/#([^#\s]{2,40})/gu)].map((match) => match[1]));
  const regionTerms = regionPatterns.filter((term) => normalizeMatchText(text).includes(normalizeMatchText(term)));
  const landmarkTerms = landmarkPatterns.filter((term) => normalizeMatchText(text).includes(normalizeMatchText(term)));
  const stationTerms = uniqueTerms([
    ...[...text.matchAll(/([가-힣]{2,12}역)(?:\s*\d{1,2}번\s*출구)?/gu)].map((match) => match[1]),
    ...[...text.matchAll(/([\p{Script=Han}]{2,12}(?:站|车站))/gu)].map((match) => match[1]),
  ]);
  const priceTerms = uniqueTerms([
    ...[...text.matchAll(/(?:₩|￦)\s?[\d,]{3,9}|\d{1,3}(?:,\d{3})+\s?원|\d{1,5}\s?韩元/gu)].map((match) => match[0]),
  ]);
  const tokens = uniqueTerms([
    ...hashtags,
    ...text.split(/[\s/|,，.。:：;；()[\]{}<>“”"'!?！？·~+]+/u),
  ]).filter((term) => term.length >= 2 && !genericTerms.has(term.toLowerCase()) && !/^\d+$/.test(term));
  const excluded = new Set([...regionTerms, ...stationTerms, ...priceTerms, ...landmarkTerms].map(normalizeMatchText));
  const placeTerms = tokens.filter((term) => !excluded.has(normalizeMatchText(term))).slice(0, maxTermsPerGroup);

  return {
    placeTerms,
    regionTerms: uniqueTerms(regionTerms),
    stationTerms,
    menuTerms: [],
    priceTerms,
    landmarkTerms: uniqueTerms(landmarkTerms),
    hashtags,
    signText: [],
    addressTerms: [],
  };
}

export function mergeSocialClues(...groups: SocialDiscoveryClues[]): SocialDiscoveryClues {
  return {
    placeTerms: uniqueTerms(groups.flatMap((group) => group.placeTerms)),
    regionTerms: uniqueTerms(groups.flatMap((group) => group.regionTerms)),
    stationTerms: uniqueTerms(groups.flatMap((group) => group.stationTerms)),
    menuTerms: uniqueTerms(groups.flatMap((group) => group.menuTerms)),
    priceTerms: uniqueTerms(groups.flatMap((group) => group.priceTerms)),
    landmarkTerms: uniqueTerms(groups.flatMap((group) => group.landmarkTerms)),
    hashtags: uniqueTerms(groups.flatMap((group) => group.hashtags)),
    signText: uniqueTerms(groups.flatMap((group) => group.signText)),
    addressTerms: uniqueTerms(groups.flatMap((group) => group.addressTerms)),
  };
}

export function matchSocialPlaces(
  places: PlaceWithRelations[],
  clues: SocialDiscoveryClues,
  locale: Locale,
  approvedAliases: ApprovedSocialAlias[] = [],
): SocialDiscoveryCandidate[] {
  const clueTerms = uniqueTerms([
    ...clues.placeTerms,
    ...clues.signText,
    ...clues.hashtags,
    ...clues.addressTerms,
    ...clues.menuTerms,
  ]).filter((term) => !genericTerms.has(term.toLowerCase()));
  const aliasByPlace = new Map<string, string[]>();
  for (const item of approvedAliases) {
    const current = aliasByPlace.get(item.placeId) ?? [];
    current.push(item.alias);
    aliasByPlace.set(item.placeId, current);
  }

  return places.flatMap((place) => {
    const names = uniqueTerms([
      place.name_ko,
      place.name_zh,
      ...(place.translations ?? []).map((translation) => translation.name),
    ]);
    const addresses = uniqueTerms([
      place.address_ko,
      place.address_zh,
      ...(place.translations ?? []).map((translation) => translation.address),
    ]);
    const menus = uniqueTerms(place.menu_items.flatMap((menu) => [menu.name_ko, menu.name_zh, ...Object.values(menu.localized_name ?? {})]));
    const tags = uniqueTerms(place.tags.flatMap((tag) => [tag.label_ko, tag.label_zh]));
    const aliases = aliasByPlace.get(place.id) ?? [];
    const normalizedNames = names.map(normalizeMatchText).filter(Boolean);
    const normalizedCorpus = normalizeMatchText([...names, ...addresses, place.nearest_station, ...menus, ...tags].join(" "));
    const reasons: string[] = [];
    let score = 0;
    let meaningfulMatch = false;
    let matchSource: SocialDiscoveryCandidate["matchSource"] = "rules";

    for (const alias of aliases) {
      const normalizedAlias = normalizeMatchText(alias);
      if (normalizedAlias && clueTerms.some((term) => {
        const normalizedTerm = normalizeMatchText(term);
        return normalizedTerm === normalizedAlias || normalizedTerm.includes(normalizedAlias) || normalizedAlias.includes(normalizedTerm);
      })) {
        score = Math.max(score, 98);
        meaningfulMatch = true;
        matchSource = "approved_alias";
        reasons.push(alias);
      }
    }

    for (const term of clueTerms) {
      const normalizedTerm = normalizeMatchText(term);
      if (normalizedTerm.length < 2) continue;
      if (normalizedNames.some((name) => name === normalizedTerm)) {
        score += 68;
        meaningfulMatch = true;
        reasons.push(term);
      } else if (normalizedNames.some((name) => name.includes(normalizedTerm) || normalizedTerm.includes(name))) {
        score += 38;
        meaningfulMatch = true;
        reasons.push(term);
      } else if (normalizedCorpus.includes(normalizedTerm)) {
        score += menus.some((menu) => normalizeMatchText(menu).includes(normalizedTerm)) ? 14 : 8;
        meaningfulMatch = true;
        reasons.push(term);
      }
    }

    for (const term of clues.regionTerms) {
      if (normalizeMatchText(addresses.join(" ")).includes(normalizeMatchText(term))) {
        score += 9;
        reasons.push(term);
      }
    }
    for (const term of clues.stationTerms) {
      if (normalizeMatchText(place.nearest_station).includes(normalizeMatchText(term))) {
        score += 12;
        meaningfulMatch = true;
        reasons.push(term);
      }
    }
    for (const term of clues.landmarkTerms) {
      if (normalizedCorpus.includes(normalizeMatchText(term))) {
        score += 8;
        reasons.push(term);
      }
    }

    if (!meaningfulMatch || score < 18) return [];
    const content = getPlaceContent(place, locale);
    const display = getPlaceNameDisplay(place, locale);
    const menu = getRepresentativeMenu(place, locale);
    return [{
      id: place.id,
      slug: place.slug,
      name: display.name,
      secondaryName: display.secondaryName,
      koreanName: place.name_ko,
      address: content.address || place.address_ko,
      koreanAddress: place.address_ko,
      region: place.district_code || inferRegion(place.address_ko),
      category: getPlaceCategoryLabel(place.category, locale),
      representativeMenu: menu?.name ?? "",
      thumbnailUrl: getTrustedPlaceImageUrl(place),
      latitude: place.latitude,
      longitude: place.longitude,
      saveCount: place.save_count ?? 0,
      confidence: Math.min(98, Math.round(score)),
      matchedClues: uniqueTerms(reasons).slice(0, 6),
      matchSource,
    }];
  }).sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name)).slice(0, 5);
}

export function socialClueSummary(clues: SocialDiscoveryClues) {
  return uniqueTerms([
    ...clues.placeTerms,
    ...clues.regionTerms,
    ...clues.stationTerms,
    ...clues.menuTerms,
    ...clues.landmarkTerms,
    ...clues.hashtags,
  ]).slice(0, 12);
}

export function emptySocialClues(): SocialDiscoveryClues {
  return { placeTerms: [], regionTerms: [], stationTerms: [], menuTerms: [], priceTerms: [], landmarkTerms: [], hashtags: [], signText: [], addressTerms: [] };
}

function uniqueTerms(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = String(raw ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, maxTermLength);
    const key = normalizeMatchText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= maxTermsPerGroup) break;
  }
  return result;
}

function normalizeMatchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{Letter}\p{Number}]/gu, "");
}

function inferRegion(address: string) {
  return address.match(/부산(?:광역시)?\s+([^\s]+(?:구|군))/u)?.[1] ?? "부산";
}

function isPrivateHostname(hostname: string) {
  if (hostname === "0.0.0.0" || hostname === "::1" || hostname.endsWith(".local")) return true;
  if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
  const private172 = hostname.match(/^172\.(\d{1,3})\./);
  return private172 ? Number(private172[1]) >= 16 && Number(private172[1]) <= 31 : false;
}
