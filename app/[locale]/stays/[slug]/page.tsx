import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, MapPin } from "lucide-react";
import { PlaceCard } from "@/components/PlaceCard";
import { StayLandingTracker } from "@/components/StayLandingTracker";
import { buildLocalizedMetadata, isLocale, type Locale } from "@/lib/i18n";
import { calculateDistanceMeters } from "@/lib/location";
import { getPublicStayGuide } from "@/lib/stays";

type Props = { params: Promise<{ locale: string; slug: string }> };
export const revalidate = 300;

async function routeParams(params: Props["params"]) {
  const value = await params;
  if (!isLocale(value.locale)) notFound();
  return value as { locale: Locale; slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await routeParams(params);
  const { stay } = await getPublicStayGuide(slug);
  if (!stay) return buildLocalizedMetadata({ locale, title: "Stay guide", description: "Spotzari local travel guide", path: `/stays/${slug}`, noIndex: true });
  const description = copy[locale].description.replace("{stay}", stay.name);
  return buildLocalizedMetadata({ locale, title: `${stay.name} · Spotzari`, description, path: `/stays/${slug}`, images: stay.image_url ? [{ url: stay.image_url }] : undefined });
}

export default async function StayGuidePage({ params }: Props) {
  const { locale, slug } = await routeParams(params);
  const { stay, places } = await getPublicStayGuide(slug);
  if (!stay || !stay.supported_locales.includes(locale)) notFound();
  const text = copy[locale];

  return (
    <main className="min-h-screen bg-[#f8f7f3] pb-16">
      <StayLandingTracker stayId={stay.id} locale={locale} />
      <section className="relative overflow-hidden bg-[#26352c] text-white">
        {stay.image_url ? <div className="absolute inset-0"><Image src={stay.image_url} alt="" fill priority sizes="100vw" className="object-cover opacity-25" /></div> : null}
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-[#dce8dc] ring-1 ring-white/15"><Building2 size={16} aria-hidden="true" />{text.partner}</span>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">{stay.name}</h1>
          <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-200"><MapPin size={17} className="mt-1 shrink-0" aria-hidden="true" />{stay.road_address || stay.address}</p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200">{text.description.replace("{stay}", stay.name)}</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#5d765e]">Local guide</p><h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-[#252824]">{text.recommendations}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{text.notice}</p></div>
        {places.length ? <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{places.map((place, index) => <PlaceCard key={place.id} place={place} locale={locale} priority={index < 2} distanceMeters={typeof place.latitude === "number" && typeof place.longitude === "number" ? calculateDistanceMeters(stay, { latitude: place.latitude, longitude: place.longitude }) : null} />)}</div> : <div className="mt-7 rounded-[24px] bg-white p-6 text-sm font-bold text-slate-600 ring-1 ring-[#e2e2dc]">{text.empty}</div>}
      </section>
    </main>
  );
}

const copy = {
  ko: { partner: "Spotzari 제휴 숙소 가이드", description: "{stay} 주변에서 실제 방문에 필요한 영업시간, 가격, 길찾기 정보를 확인하세요.", recommendations: "숙소 추천 장소", notice: "장소 조회와 길찾기는 방문 의도이며 실제 방문·결제를 뜻하지 않습니다. 영업 정보는 방문 전 다시 확인해 주세요.", empty: "숙소가 추천 장소를 준비하고 있습니다." },
  zh: { partner: "Spotzari 合作住宿指南", description: "查看 {stay} 周边景点的营业时间、价格和路线等出行信息。", recommendations: "住宿推荐地点", notice: "查看地点或路线仅代表访问意向，并不等同于实际到店或付款。出发前请再次确认营业信息。", empty: "住宿方正在准备推荐地点。" },
  en: { partner: "Spotzari partner stay guide", description: "Check practical hours, prices, and directions for places around {stay}.", recommendations: "Recommended by your stay", notice: "Views and direction clicks show intent, not confirmed visits or payments. Recheck operating details before you go.", empty: "This stay is preparing its recommendations." },
  ja: { partner: "Spotzari 提携宿泊ガイド", description: "{stay} 周辺スポットの営業時間・価格・経路など、訪問に必要な情報を確認できます。", recommendations: "宿泊施設のおすすめ", notice: "閲覧や経路クリックは訪問意向であり、実際の来店・決済を示すものではありません。訪問前に営業情報をご確認ください。", empty: "宿泊施設がおすすめスポットを準備しています。" },
} satisfies Record<Locale, Record<string, string>>;
