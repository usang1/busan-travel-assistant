import type { Metadata } from "next";
import { PlacesExplorer } from "@/components/PlacesExplorer";
import { CitySwitcher } from "@/components/CitySwitcher";
import { SectionTitle } from "@/components/SectionTitle";
import { absoluteUrl } from "@/config/site";
import { cityRegions, getPlaceRegion, parsePlaceCity } from "@/lib/city-regions";
import { getCachedPlaceRankings, getCachedPublicPlaces } from "@/lib/public-cache";
import { placeCategories, type PlaceCategory } from "@/types/database";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "首尔・釜山・济州公开地点｜审核状态清楚标注",
  description: "搜索首尔、釜山、济州的公开地点，并分别查看审核状态。",
  alternates: { canonical: absoluteUrl("/places") },
  openGraph: {
    title: "首尔・釜山・济州地点",
    description: "面向外国游客的公开地点搜索；审核状态单独标注。",
    url: absoluteUrl("/places"),
  },
};

type PlacesPageProps = {
  searchParams?: Promise<{
    search?: string;
    q?: string;
    category?: string;
    region?: string;
    city?: string;
  }>;
};

export default async function PlacesPage({ searchParams }: PlacesPageProps) {
  const params = await searchParams;
  const city = parsePlaceCity(params?.city);
  const rankingCategory = parseRankingCategory(params?.category);
  const rankingRegion = cityRegions(city).find((region) => region.key === params?.region)?.labels.ko;
  const [{ places, source, error }, rankings] = await Promise.all([
    getCachedPublicPlaces("zh", city),
    getCachedPlaceRankings({ limit: 4, category: rankingCategory, region: rankingRegion }),
  ]);

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <CitySwitcher locale="zh" activeCity={city} path="/places" />
      <SectionTitle title="附近推荐" subtitle={source === "demo" ? "示例数据" : `已登记地点 ${places.length}`} />
      {error ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}
      <div className="mt-4">
        <PlacesExplorer key={city} city={city} places={places} initialCategory={params?.category} loadError={error} rankings={{ ...rankings, popular: rankings.popular.filter((place) => getPlaceRegion(place).city === city), trending: rankings.trending.filter((place) => getPlaceRegion(place).city === city) }} />
      </div>
    </main>
  );
}

function parseRankingCategory(value?: string): PlaceCategory | undefined {
  return placeCategories.includes(value as PlaceCategory) ? value as PlaceCategory : undefined;
}
