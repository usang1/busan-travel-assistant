import type { Metadata } from "next";
import { NearbyExplorer } from "@/components/NearbyExplorer";
import { CitySwitcher } from "@/components/CitySwitcher";
import { absoluteUrl } from "@/config/site";
import { getCachedPublicPlaces } from "@/lib/public-cache";
import { parsePlaceCity } from "@/lib/city-regions";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "首尔・釜山・济州附近地点｜按当前位置查找",
  description: "用当前位置或所选城市中心查找附近餐厅、咖啡、拍照点、景点和行李寄存。",
  alternates: { canonical: absoluteUrl("/nearby") },
  openGraph: {
    title: "首尔・釜山・济州附近地点",
    description: "按距离和类别找到现在可以去的地方。",
    url: absoluteUrl("/nearby"),
  },
};

export default async function NearbyPage({ searchParams }: { searchParams?: Promise<{ city?: string }> }) {
  const query = await searchParams;
  const city = parsePlaceCity(query?.city);
  const { places, error } = await getCachedPublicPlaces("zh", city);

  return (
    <main className="safe-bottom mx-auto max-w-7xl px-4 pb-6 pt-5 lg:px-6">
      <CitySwitcher locale="zh" activeCity={city} path="/nearby" />
      {error ? <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}
      <NearbyExplorer key={city} city={city} places={places} loadError={error} />
    </main>
  );
}
