import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { PhotoSpotCard } from "@/components/PhotoSpotCard";
import { SectionTitle } from "@/components/SectionTitle";
import { buildLocalizedMetadata, isLocale, type Locale, ui } from "@/lib/i18n";
import { getPhotoSpots } from "@/lib/photo-spot-store";

type LocalizedPhotoSpotsPageProps = {
  params: Promise<{ locale: string }>;
};

export const dynamic = "force-dynamic";

const photoSpotSeo: Record<Locale, { title: string; description: string; heading: string; subtitle: string; emptyTitle: string; emptyDescription: string }> = {
  zh: {
    title: "釜山拍照地图",
    description: "整理广安里海边、广安大桥夜景和咖啡街拍照机位，包含推荐时间、站位和拍摄提示。",
    heading: "拍照地图",
    subtitle: "广安里拍照机位",
    emptyTitle: "暂无拍照地点",
    emptyDescription: "管理员确认后会显示拍照地点。",
  },
  en: {
    title: "Busan photo spots",
    description: "Find Gwangalli beach, Gwangan Bridge, and cafe street photo spots with timing and framing tips.",
    heading: "Photo spots",
    subtitle: "Gwangalli photo locations",
    emptyTitle: "No photo spots yet",
    emptyDescription: "Photo spots will appear after editorial review.",
  },
  ja: {
    title: "釜山フォトスポット",
    description: "広安里ビーチ、広安大橋、カフェ通りの撮影場所とおすすめ時間、構図のヒントを確認できます。",
    heading: "フォトスポット",
    subtitle: "広安里の撮影場所",
    emptyTitle: "フォトスポットはまだありません",
    emptyDescription: "管理者確認後にフォトスポットを表示します。",
  },
  ko: {
    title: "부산 사진스팟",
    description: "광안리 해변, 광안대교 야경, 카페거리 사진스팟과 추천 시간, 촬영 위치를 확인합니다.",
    heading: "사진스팟",
    subtitle: "광안리 촬영 위치",
    emptyTitle: "등록된 사진스팟이 없습니다",
    emptyDescription: "관리자 확인 후 사진스팟이 표시됩니다.",
  },
};

async function getLocale(params: LocalizedPhotoSpotsPageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: LocalizedPhotoSpotsPageProps): Promise<Metadata> {
  const locale = await getLocale(params);

  return buildLocalizedMetadata({
    ...photoSpotSeo[locale],
    locale,
    path: "/photo-spots",
  });
}

export default async function LocalizedPhotoSpotsPage({ params }: LocalizedPhotoSpotsPageProps) {
  const locale = await getLocale(params);
  const copy = ui[locale];
  const pageCopy = photoSpotSeo[locale];
  const { photoSpots, source, error } = await getPhotoSpots();

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title={pageCopy.heading} subtitle={source === "demo" ? copy.common.sampleData : pageCopy.subtitle} />
      {error ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}
      {photoSpots.length ? (
        <div className="mt-5 space-y-4">
          {photoSpots.map((spot, index) => (
            <PhotoSpotCard key={spot.id} spot={spot} priority={index === 0} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState title={pageCopy.emptyTitle} description={pageCopy.emptyDescription} />
        </div>
      )}
    </main>
  );
}
