import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PhotoSpotDetailPage from "@/app/photo-spots/[slug]/page";
import { buildLocalizedMetadata, isLocale, type Locale } from "@/lib/i18n";
import { getPhotoSpotBySlug } from "@/lib/photo-spot-store";

type LocalizedPhotoSpotDetailPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export const dynamic = "force-dynamic";

const photoSpotDetailSeo: Record<Locale, { fallbackTitle: string; fallbackDescription: string; suffix: string; bestTime: string; zoom: string }> = {
  zh: {
    fallbackTitle: "拍照地图",
    fallbackDescription: "釜山广安里拍照机位详情。",
    suffix: "广安里拍照机位",
    bestTime: "推荐时间",
    zoom: "推荐倍率",
  },
  en: {
    fallbackTitle: "Photo spot",
    fallbackDescription: "Photo spot details for Gwangalli, Busan.",
    suffix: "Gwangalli photo spot",
    bestTime: "Best time",
    zoom: "Recommended zoom",
  },
  ja: {
    fallbackTitle: "フォトスポット",
    fallbackDescription: "釜山・広安里のフォトスポット詳細です。",
    suffix: "広安里フォトスポット",
    bestTime: "おすすめ時間",
    zoom: "おすすめ倍率",
  },
  ko: {
    fallbackTitle: "사진스팟",
    fallbackDescription: "부산 광안리 사진스팟 상세 정보입니다.",
    suffix: "광안리 사진스팟",
    bestTime: "추천 시간",
    zoom: "추천 배율",
  },
};

async function getRouteParams(params: LocalizedPhotoSpotDetailPageProps["params"]): Promise<{ locale: Locale; slug: string }> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  return { locale, slug };
}

export async function generateMetadata({ params }: LocalizedPhotoSpotDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await getRouteParams(params);
  const { photoSpot } = await getPhotoSpotBySlug(slug);
  const copy = photoSpotDetailSeo[locale];
  const name = photoSpot ? (locale === "zh" ? photoSpot.name_zh : photoSpot.name_ko) : "";
  const title = photoSpot ? `${name} | ${copy.suffix}` : copy.fallbackTitle;
  const description = photoSpot && locale === "zh"
    ? `${name}: ${copy.bestTime} ${photoSpot.best_time}, ${copy.zoom} ${photoSpot.recommended_zoom}.`
    : copy.fallbackDescription;

  return buildLocalizedMetadata({
    locale,
    title,
    description,
    path: `/photo-spots/${slug}`,
    type: "article",
    availableLocales: photoSpot?.free_or_pro === "free" ? ["zh"] : [],
    noIndex: locale !== "zh" || !photoSpot || photoSpot.free_or_pro !== "free",
    images: photoSpot?.thumbnail_url ? [{ url: photoSpot.thumbnail_url }] : undefined,
  });
}

export default PhotoSpotDetailPage;
