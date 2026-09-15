import { chinaPriceBuckets, getChinaFilterByQueryKey } from "@/lib/place-china/discovery";
import type { BusanDistrictKey } from "@/lib/busan-districts";
import type { PlaceWithRelations } from "@/types/database";

export const homeQuickFilterKeys = [
  "openNow",
  "lowWait",
  "solo",
  "under10000",
  "oceanView",
  "rainyDay",
  "luggage",
  "subwayWalk10",
  "chineseMenu",
] as const;

export type HomeQuickFilterKey = (typeof homeQuickFilterKeys)[number];

type HomeQuickFilterConfig = {
  key: HomeQuickFilterKey;
  href: string;
  enabled: (places: PlaceWithRelations[]) => boolean;
};

const filterConfigs: HomeQuickFilterConfig[] = [
  queryFilter("openNow"),
  queryFilter("lowWait"),
  queryFilter("solo"),
  {
    key: "under10000",
    href: "/places?price=low",
    enabled: (places) => {
      const bucket = chinaPriceBuckets.find((item) => item.value === "low");
      return bucket ? places.some((place) => bucket.match(place)) : false;
    },
  },
  queryFilter("oceanView"),
  queryFilter("rainyDay"),
  queryFilter("luggage"),
  queryFilter("subwayWalk10"),
  queryFilter("chineseMenu"),
];

export function getHomeQuickFilters(places: PlaceWithRelations[], district?: BusanDistrictKey) {
  return filterConfigs.map((filter) => ({
    key: filter.key,
    href: withDistrict(filter.href, district),
    enabled: filter.enabled(places),
  }));
}

function withDistrict(href: string, district?: BusanDistrictKey) {
  if (!district) return href;
  const [pathname, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("region", district);
  return `${pathname}?${params.toString()}`;
}

function queryFilter(key: Exclude<HomeQuickFilterKey, "under10000">): HomeQuickFilterConfig {
  const filter = getChinaFilterByQueryKey(key);

  return {
    key,
    href: `/places?${filter?.queryKey ?? key}=true`,
    enabled: (places) => Boolean(filter?.enabled(places)),
  };
}
