import type { Metadata } from "next";
import { PhotoSpotCard } from "@/components/PhotoSpotCard";
import { SectionTitle } from "@/components/SectionTitle";
import { absoluteUrl } from "@/config/site";
import { getPhotoSpots } from "@/lib/photo-spot-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "釜山拍照地图｜广安里最佳拍照机位",
  description: "整理广安里海边、广安大桥夜景和咖啡街拍照机位，包含推荐时间、站位和拍摄提示。",
  alternates: { canonical: absoluteUrl("/photo-spots") },
  openGraph: {
    title: "釜山拍照地图",
    description: "广安里最佳拍照机位和手机拍摄提示。",
    url: absoluteUrl("/photo-spots"),
  },
};

export default async function PhotoSpotsPage() {
  const { photoSpots, source, error } = await getPhotoSpots();

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title="拍照地图" subtitle={source === "demo" ? "Demo 사진스팟 표시 중" : "광안리 사진스팟"} />
      {error ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}
      <div className="mt-5 space-y-4">
        {photoSpots.map((spot, index) => (
          <PhotoSpotCard key={spot.id} spot={spot} priority={index === 0} />
        ))}
      </div>
    </main>
  );
}
