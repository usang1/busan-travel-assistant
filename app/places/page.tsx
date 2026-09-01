import type { Metadata } from "next";
import { PlacesExplorer } from "@/components/PlacesExplorer";
import { SectionTitle } from "@/components/SectionTitle";
import { absoluteUrl } from "@/config/site";
import { getPlaces } from "@/lib/place-store";
import { getPlaceRankings } from "@/lib/place-recommendations";
import { placeCategories, type PlaceCategory } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "釜山广安里美食地图｜韩国本地人推荐",
  description: "搜索广安里餐厅、咖啡店、拍照点、购物和行李寄存，按类别与旅行需求快速筛选。",
  alternates: { canonical: absoluteUrl("/places") },
  openGraph: {
    title: "釜山广安里美食地图",
    description: "中国游客可用的广安里地点搜索和本地推荐。",
    url: absoluteUrl("/places"),
  },
};

type PlacesPageProps = {
  searchParams?: Promise<{
    category?: string;
    region?: string;
  }>;
};

export default async function PlacesPage({ searchParams }: PlacesPageProps) {
  const params = await searchParams;
  const rankingCategory = parseRankingCategory(params?.category);
  const rankingRegion = params?.region && params.region !== "all" ? params.region : undefined;
  const [{ places, source, error }, rankings] = await Promise.all([
    getPlaces({ activeOnly: true, locale: "zh", debugLabel: "places" }),
    getPlaceRankings({ limit: 4, category: rankingCategory, region: rankingRegion }),
  ]);

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title="附近推荐" subtitle={source === "demo" ? "Demo 데이터 표시 중" : "광안리 Supabase 장소"} />
      {error ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}
      <div className="mt-4">
        <PlacesExplorer places={places} initialCategory={params?.category} loadError={error} rankings={rankings} />
      </div>
    </main>
  );
}

function parseRankingCategory(value?: string): PlaceCategory | undefined {
  return placeCategories.includes(value as PlaceCategory) ? value as PlaceCategory : undefined;
}
