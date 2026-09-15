import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BusanDiscoveryPage } from "@/components/HomeDiscoveryPage";
import { isBusanDistrictKey } from "@/lib/busan-districts";
import { buildLocalizedMetadata, isLocale, type Locale } from "@/lib/i18n";
import { getCachedPublishedGuides, getCachedPublicPlaces } from "@/lib/public-cache";
import { translatedPlaceLocales } from "@/lib/public-seo";

type BusanPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ district?: string }>;
};

export const revalidate = 300;

async function getLocale(params: BusanPageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: BusanPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = {
    ko: { title: "부산 지역별 여행", description: "부산 구·군을 선택하고 상황별 장소를 확인하세요." },
    zh: { title: "釜山分区旅行", description: "选择釜山的区或郡，查看不同旅行场景下的地点。" },
    en: { title: "Busan by district", description: "Choose a Busan district and browse places by travel situation." },
    ja: { title: "釜山エリア別旅行", description: "釜山の区・郡を選び、旅行シーン別のスポットを確認できます。" },
  }[locale];

  return buildLocalizedMetadata({ locale, title: copy.title, description: copy.description, path: "/busan" });
}

export default async function BusanPage({ params, searchParams }: BusanPageProps) {
  const locale = await getLocale(params);
  const query = await searchParams;
  const selectedDistrict = isBusanDistrictKey(query?.district) ? query.district : undefined;
  const [{ places: publicPlaces }, { guides }] = await Promise.all([
    getCachedPublicPlaces(locale),
    getCachedPublishedGuides(),
  ]);
  const places = publicPlaces.filter((place) => translatedPlaceLocales(place).includes(locale));

  return <BusanDiscoveryPage locale={locale} places={places} guides={guides} selectedDistrict={selectedDistrict} />;
}
