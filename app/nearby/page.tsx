import type { Metadata } from "next";
import { NearbyExplorer } from "@/components/NearbyExplorer";
import { absoluteUrl } from "@/config/site";
import { getPlaces } from "@/lib/place-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "广安里附近推荐｜当前位置找美食拍照行李寄存",
  description: "用当前位置或广安里中心查找附近餐厅、咖啡、拍照点、景点和行李寄存。",
  alternates: { canonical: absoluteUrl("/nearby") },
  openGraph: {
    title: "广安里附近推荐",
    description: "按距离和类别找到现在可以去的地方。",
    url: absoluteUrl("/nearby"),
  },
};

export default async function NearbyPage() {
  const { places, error } = await getPlaces({ activeOnly: true, locale: "zh", debugLabel: "nearby" });

  return (
    <main className="safe-bottom mx-auto max-w-7xl px-4 pb-6 pt-5 lg:px-6">
      {error ? <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}
      <NearbyExplorer places={places} loadError={error} />
    </main>
  );
}
