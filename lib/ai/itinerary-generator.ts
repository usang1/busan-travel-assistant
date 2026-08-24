import { calculateDistanceMeters, getOpeningStatus, gwangalliCenter, type Coordinates } from "@/lib/location";
import type { PlaceCategory, PlaceWithRelations } from "@/types/database";

export type ItineraryInterest = "food" | "cafe" | "photo" | "shopping" | "sea" | "nightlife";
export type TravelStyle = "relaxed" | "normal" | "packed";

export type ItineraryPreferences = {
  days: number;
  lodging: string;
  people: number;
  budget: "low" | "medium" | "high";
  interests: ItineraryInterest[];
  style: TravelStyle;
  rainyAlternative: boolean;
};

export type GeneratedItineraryStop = {
  time: string;
  titleZh: string;
  titleKo: string;
  category: PlaceCategory;
  placeSlug: string;
  descriptionZh: string;
  walkingFromPreviousMinutes: number | null;
  openingStatus: ReturnType<typeof getOpeningStatus>;
};

export type GeneratedItineraryDay = {
  day: number;
  titleZh: string;
  titleKo: string;
  stops: GeneratedItineraryStop[];
};

export type GeneratedItinerary = {
  source: "rule_based" | "openai_ready";
  days: GeneratedItineraryDay[];
  notes: string[];
};

type Slot = {
  time: string;
  category: PlaceCategory;
  fallbackZh: string;
  fallbackKo: string;
};

const baseSlots: Slot[] = [
  { time: "11:30", category: "restaurant", fallbackZh: "广安里午餐", fallbackKo: "광안리 점심" },
  { time: "13:00", category: "cafe", fallbackZh: "咖啡休息", fallbackKo: "카페 휴식" },
  { time: "15:00", category: "photo_spot", fallbackZh: "拍照点", fallbackKo: "사진스팟" },
  { time: "17:30", category: "attraction", fallbackZh: "海边散步", fallbackKo: "해변 산책" },
  { time: "19:00", category: "restaurant", fallbackZh: "广安里晚餐", fallbackKo: "광안리 저녁" },
  { time: "21:00", category: "photo_spot", fallbackZh: "夜景", fallbackKo: "야경" },
];

const packedExtraSlots: Slot[] = [
  { time: "10:00", category: "shopping", fallbackZh: "购物", fallbackKo: "쇼핑" },
  { time: "22:00", category: "bar", fallbackZh: "夜生活", fallbackKo: "야간" },
];

export async function generateItineraryFromDb(
  places: PlaceWithRelations[],
  preferences: ItineraryPreferences,
): Promise<GeneratedItinerary> {
  const usablePlaces = places.filter((place) => place.is_active);
  const notes = ["일정은 Supabase/demo 장소 데이터 안에서만 구성했습니다.", "DB에 없는 업체명은 추천하지 않습니다."];
  const days = Array.from({ length: preferences.days }, (_, index) =>
    generateDay(usablePlaces, preferences, index + 1),
  );

  return {
    source: "rule_based",
    days,
    notes,
  };
}

function generateDay(places: PlaceWithRelations[], preferences: ItineraryPreferences, day: number): GeneratedItineraryDay {
  const slots = chooseSlots(preferences);
  const usedPlaceIds = new Set<string>();
  let previousCoordinate: Coordinates = gwangalliCenter;

  const stops = slots.map((slot) => {
    const selected = selectPlace(places, slot.category, preferences, usedPlaceIds, previousCoordinate);

    if (selected) {
      usedPlaceIds.add(selected.id);
    }

    const nextCoordinate =
      selected?.latitude && selected.longitude
        ? {
            latitude: selected.latitude,
            longitude: selected.longitude,
          }
        : previousCoordinate;
    const distance = selected ? calculateDistanceMeters(previousCoordinate, nextCoordinate) : null;
    previousCoordinate = nextCoordinate;

    return {
      time: slot.time,
      titleZh: selected?.name_zh ?? slot.fallbackZh,
      titleKo: selected?.name_ko ?? slot.fallbackKo,
      category: slot.category,
      placeSlug: selected?.slug ?? "",
      descriptionZh: selected?.short_description_zh ?? "暂无合适地点，请在附近推荐里确认。",
      walkingFromPreviousMinutes: distance === null ? null : Math.max(1, Math.round(distance / 72)),
      openingStatus: getOpeningStatus(selected?.opening_hours ?? ""),
    };
  });

  return {
    day,
    titleZh: `Day ${day}`,
    titleKo: `${day}일차`,
    stops,
  };
}

function chooseSlots(preferences: ItineraryPreferences) {
  let slots = [...baseSlots];

  if (!preferences.interests.includes("shopping")) {
    slots = slots.filter((slot) => slot.category !== "shopping");
  }

  if (!preferences.interests.includes("photo")) {
    slots = slots.filter((slot) => slot.category !== "photo_spot" || slot.time === "21:00");
  }

  if (preferences.style === "relaxed") {
    return slots.filter((slot) => ["11:30", "13:00", "17:30", "19:00"].includes(slot.time));
  }

  if (preferences.style === "packed") {
    return [...packedExtraSlots.slice(0, 1), ...slots, ...packedExtraSlots.slice(1)];
  }

  return slots;
}

function selectPlace(
  places: PlaceWithRelations[],
  category: PlaceCategory,
  preferences: ItineraryPreferences,
  usedPlaceIds: Set<string>,
  origin: Coordinates,
) {
  const categoryCandidates = places.filter((place) => {
    if (usedPlaceIds.has(place.id)) {
      return false;
    }

    if (category === "restaurant") {
      return place.category === "restaurant";
    }

    return place.category === category;
  });

  const fallbackCandidates = categoryCandidates.length > 0 ? categoryCandidates : places.filter((place) => !usedPlaceIds.has(place.id));

  return fallbackCandidates
    .map((place) => ({
      place,
      score: scorePlace(place, preferences, origin),
    }))
    .sort((a, b) => b.score - a.score)[0]?.place;
}

function scorePlace(place: PlaceWithRelations, preferences: ItineraryPreferences, origin: Coordinates) {
  let score = 0;

  if (place.is_featured) {
    score += 20;
  }

  if (preferences.interests.includes("cafe") && place.category === "cafe") {
    score += 16;
  }

  if (preferences.interests.includes("photo") && place.category === "photo_spot") {
    score += 16;
  }

  if (preferences.interests.includes("shopping") && place.category === "shopping") {
    score += 16;
  }

  if (preferences.interests.includes("nightlife") && (place.category === "bar" || place.opening_hours.includes("23") || place.opening_hours.includes("01"))) {
    score += 12;
  }

  if (preferences.budget === "low" && (place.price_min ?? Number.MAX_SAFE_INTEGER) <= 12000) {
    score += 12;
  }

  if (preferences.people === 1 && place.solo_friendly) {
    score += 10;
  }

  if (preferences.rainyAlternative && (place.category === "cafe" || place.category === "shopping")) {
    score += 10;
  }

  if (place.latitude && place.longitude) {
    const distance = calculateDistanceMeters(origin, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
    score += Math.max(0, 18 - distance / 120);
  }

  const openingStatus = getOpeningStatus(place.opening_hours);

  if (openingStatus === "open") {
    score += 8;
  }

  if (openingStatus === "closing_soon") {
    score += 3;
  }

  return score;
}
