import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck2,
  Camera,
  Clock3,
  CreditCard,
  FileSearch,
  MapPin,
  MessageSquareText,
  Route,
  Soup,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { OrderGuide } from "@/components/OrderGuide";
import { PlaceCorrectionForm } from "@/components/PlaceCorrectionForm";
import { PlaceChinaDecisionPanel } from "@/components/PlaceChinaDecisionPanel";
import { TravelerInsightsPanel } from "@/components/TravelerInsightsPanel";
import { RelatedPlacesSection } from "@/components/RelatedPlacesSection";
import { PlaceLocationPanel } from "@/components/PlaceLocationPanel";
import { PlaceViewTracker } from "@/components/PlaceViewTracker";
import { SaveButton } from "@/components/SaveButton";
import { SectionTitle } from "@/components/SectionTitle";
import { ShareButton } from "@/components/ShareButton";
import { StructuredData } from "@/components/StructuredData";
import { TagChip } from "@/components/TagChip";
import { absoluteUrl, siteConfig } from "@/config/site";
import { formatOpeningStatus, hasCoordinates } from "@/lib/location";
import { buildChinaPlaceSummary } from "@/lib/place-china/format";
import { formatPriceRange, formatWon, getPlaceBySlug } from "@/lib/place-store";
import { getRelatedPlaces } from "@/lib/place-recommendations";
import {
  getLastVerifiedLabel,
  getPlacePhotoDisplay,
  getPlaceTrustCopy,
  getPublicPlaceDescription,
  getPublicTravelTip,
  getSourceSummary,
  getTrustedPlaceImageUrl,
  getVerificationStatus,
  getVerificationStatusLabel,
} from "@/lib/place-trust";
import { categoryLabels } from "@/types/database";

type PlaceDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

const getCachedPlaceBySlug = cache((slug: string) => getPlaceBySlug(slug));

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PlaceDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { place } = await getCachedPlaceBySlug(slug);
  const chinaSummary = buildChinaPlaceSummary(place?.china_info);
  const featureText = chinaSummary.tags.slice(0, 3).join("、");

  const title = place ? `${place.name_zh}｜${place.name_ko}` : "地点详情";
  const description = place
    ? `${place.name_zh}：釜山${categoryLabels[place.category].zh}，${featureText ? `${featureText}。` : ""}${chinaSummary.summary}`
    : "釜山广安里地点详情。";
  const trustedImageUrl = place ? getTrustedPlaceImageUrl(place) : "";

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/places/${slug}`) },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/places/${slug}`),
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "article",
      images: trustedImageUrl ? [{ url: trustedImageUrl }] : undefined,
    },
  };
}

export default async function PlaceDetailPage({ params }: PlaceDetailPageProps) {
  const { slug } = await params;
  const { place, source, error } = await getCachedPlaceBySlug(slug);

  if (!place) {
    notFound();
  }

  const relatedPlaces = await getRelatedPlaces(place);
  const trustCopy = getPlaceTrustCopy("zh");
  const publicDescription = getPublicPlaceDescription(place, "zh");
  const publicTravelTip = getPublicTravelTip(place, "zh");
  const photo = getPlacePhotoDisplay(place, "zh");
  const trustedImageUrl = getTrustedPlaceImageUrl(place);
  const verificationStatus = getVerificationStatus(place);
  const recommendationDescription = publicDescription || trustCopy.noPublicDescription;

  const recommendedMenus = place.menu_items.filter((item) => item.is_recommended);
  const otherMenus = place.menu_items.filter((item) => !item.is_recommended);
  const facilityTags = [
    place.solo_friendly ? "一个人也可以" : null,
    place.luggage_friendly ? "行李OK" : null,
    place.chinese_menu ? "中文菜单" : null,
    place.card_payment ? "可以刷卡" : null,
  ].filter((label): label is string => Boolean(label));
  const opening = formatOpeningStatus(place.opening_hours, "zh");
  const priceText = formatPriceRange(place);
  const placeHasCoordinates = hasCoordinates(place);
  const walkingText = placeHasCoordinates && place.walking_minutes > 0 ? `步行 ${place.walking_minutes}分钟` : "未登记";
  const directionsText = placeHasCoordinates && place.walking_minutes > 0
    ? `${[place.nearest_station, place.nearest_exit].filter(Boolean).join(" ")} · ${walkingText}`
    : "未登记";
  const currentMenuText = place.menu_items.map((item) => (
    [item.name_zh || item.name_ko, item.price === null ? "" : formatWon(item.price)].filter(Boolean).join(" · ")
  )).join("\n");

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-4">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "TouristAttraction",
          name: `${place.name_zh} / ${place.name_ko}`,
          description: publicDescription,
          image: trustedImageUrl || undefined,
          url: absoluteUrl(`/places/${place.slug}`),
          address: place.address_ko,
          geo:
            placeHasCoordinates
              ? {
                  "@type": "GeoCoordinates",
                  latitude: place.latitude,
                  longitude: place.longitude,
                }
              : undefined,
        }}
      />
      <PlaceViewTracker
        locale="zh"
        place={{
          id: place.id,
          slug: place.slug,
          title: place.name_zh,
          subtitle: place.name_ko,
          href: `/places/${place.slug}`,
          imageUrl: trustedImageUrl,
          category: place.category,
        }}
      />
      <Link href="/places" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
        <ArrowLeft size={17} aria-hidden="true" />
        返回附近推荐
      </Link>

      {error ? <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}

      <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="relative aspect-[4/3] bg-slate-200">
          {photo.kind === "image" ? (
            <Image
              src={photo.url}
              alt={`${place.name_zh} / ${place.name_ko}`}
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="grid h-full place-items-center bg-slate-100 px-5 text-center">
              <div>
                <Camera size={32} className="mx-auto text-slate-400" aria-hidden="true" />
                <p className="mt-3 text-base font-black text-slate-700">{photo.title}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{photo.detail}</p>
              </div>
            </div>
          )}
          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm backdrop-blur">
            {categoryLabels[place.category].zh} · {source === "demo" ? "Demo" : "Live"}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <TagChip tone={place.is_active ? "green" : "amber"}>{place.is_active ? "现在可查看" : "暂未开放"}</TagChip>
              <h1 className="mt-3 text-3xl font-black tracking-normal text-slate-950">{place.name_zh}</h1>
              <p className="mt-1 text-base text-slate-500">{place.name_ko}</p>
            </div>
            <SaveButton
              className="h-11 px-3"
              initialSaveCount={place.save_count ?? 0}
              item={{
                id: place.id,
                type: "place",
                titleZh: place.name_zh,
                titleKo: place.name_ko,
                href: `/places/${place.slug}`,
                imageUrl: trustedImageUrl,
                meta: [categoryLabels[place.category].zh, placeHasCoordinates ? walkingText : ""].filter(Boolean).join(" · "),
              }}
            />
          </div>
          <div className="mt-4">
            <ShareButton
              title={place.name_zh}
              text={`${place.name_zh} / ${place.name_ko} - ${recommendationDescription}`}
              url={absoluteUrl(`/places/${place.slug}`)}
              placeId={place.id}
              locale="zh"
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <InfoTile icon={WalletCards} label="价格" value={priceText} />
            <InfoTile icon={Clock3} label="距离" value={walkingText} />
            <InfoTile icon={Route} label="营业" value={place.opening_hours ? opening.text : "未登记"} />
          </div>

          <section className="mt-6">
            <SectionTitle title="推荐理由" subtitle="추천 이유" />
            <p className="mt-3 text-base leading-7 text-slate-700">{recommendationDescription}</p>
          </section>

          <section className="mt-5 grid gap-2 rounded-[22px] bg-slate-50 p-4 ring-1 ring-slate-100 sm:grid-cols-3">
            <TrustFact icon={BadgeCheck} label="验证状态" value={getVerificationStatusLabel(verificationStatus, "zh")} />
            <TrustFact icon={FileSearch} label="信息来源" value={getSourceSummary(place, "zh")} />
            <TrustFact icon={CalendarCheck2} label="最后确认" value={getLastVerifiedLabel(place, "zh")} />
          </section>

          <div className="mt-5 flex flex-wrap gap-2">
            {place.tags.map((tag) => (
              <TagChip key={tag.slug}>{tag.label_zh}</TagChip>
            ))}
            {facilityTags.map((label) => (
              <TagChip key={label} tone="blue">
                {label}
              </TagChip>
            ))}
          </div>
        </div>
      </section>

      <PlaceChinaDecisionPanel
        place={place}
        openingText={place.opening_hours ? opening.text : "未登记"}
        priceText={priceText}
      />

      <TravelerInsightsPanel place={place} locale="zh" />

      <section className="mt-6 space-y-3">
        <SectionTitle title="推荐菜单" subtitle="추천 메뉴" />
        {place.menu_items.length > 0 ? (
          <div className="space-y-3">
            {[...recommendedMenus, ...otherMenus].map((item) => (
              <div key={item.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-950">{item.name_zh}</h2>
                      {item.is_recommended ? <TagChip tone="green">推荐</TagChip> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{item.name_ko}</p>
                  </div>
                  <span className="shrink-0 font-black text-slate-950">{formatWon(item.price)}</span>
                </div>
                {item.description_zh ? <p className="mt-3 text-sm leading-6 text-slate-600">{item.description_zh}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            등록된 메뉴가 없습니다.
          </div>
        )}
      </section>

      {place.category === "restaurant" ? (
        <OrderGuide place={place} locale="zh" />
      ) : (
        <section className="mt-6 space-y-3">
          <SectionTitle title="怎么说？" subtitle="어떻게 말할까?" />
          <div className="rounded-[24px] bg-teal-700 p-5 text-white shadow-sm">
            <MessageSquareText size={22} aria-hidden="true" />
            <p className="mt-3 text-lg font-bold">{place.recommended_order_zh || "请问可以推荐这里最受欢迎的菜单吗？"}</p>
            <p className="mt-3 rounded-2xl bg-white/12 p-3 text-sm leading-6 text-teal-50">
              {place.recommended_order_ko || "여기에서 가장 인기 있는 메뉴를 추천해주실 수 있나요?"}
            </p>
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <InfoPanel icon={Users} title="等候" subtitle="웨이팅" zh={place.waiting_info_zh} ko={place.waiting_info_ko} />
        <InfoPanel
          icon={MapPin}
          title="怎么去？"
          subtitle="가는 방법"
          zh={directionsText}
          ko={`${place.address_ko} / ${place.address_zh}`}
        />
      </section>

      <section className="mt-6 space-y-3">
        <SectionTitle title="旅行小贴士" subtitle="여행 팁" />
        <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <Soup size={22} className="text-teal-700" aria-hidden="true" />
          <p className="mt-3 text-base leading-7 text-slate-700">{publicTravelTip || "旅行提示准备中。"}</p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <InfoTile icon={CreditCard} label="付款" value={place.card_payment ? "可以刷卡" : "现金确认"} />
        <InfoTile icon={MapPin} label="坐标" value={placeHasCoordinates ? `${place.latitude}, ${place.longitude}` : "未登记"} />
      </section>

      <section className="mt-6 rounded-[24px] bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        信息可能会发生变化，请出发前再次确认。가격, 영업시간, 대기 정보는 변경될 수 있으니 방문 전 다시 확인하세요.
      </section>

      <RelatedPlacesSection places={relatedPlaces} locale="zh" />

      <PlaceCorrectionForm
        placeId={place.id}
        locale="zh"
        currentValues={{
          opening_hours: place.opening_hours,
          menu: currentMenuText,
          menu_price: currentMenuText,
          price_range: priceText,
          phone: place.phone ?? "",
          website: place.website ?? "",
          location: place.address_zh || place.address_ko || place.address,
        }}
      />
      <PlaceLocationPanel place={place} />
    </main>
  );
}

function TrustFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Icon size={17} className="text-teal-700" aria-hidden="true" />
      <p className="mt-2 text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black leading-5 text-slate-950">{value}</p>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <Icon size={17} className="text-teal-700" aria-hidden="true" />
      <p className="mt-2 text-xs text-slate-500">{label}</p>
      <p className="break-words text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  subtitle,
  zh,
  ko,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  zh: string;
  ko: string;
}) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <Icon size={22} className="text-teal-700" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">{zh || "信息确认中"}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{ko || "정보 확인 필요"}</p>
    </div>
  );
}
