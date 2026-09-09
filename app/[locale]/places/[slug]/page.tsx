import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  CreditCard,
  Globe2,
  MapPin,
  MessageSquareText,
  Phone,
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
import { RelatedGuidesSection } from "@/components/RelatedGuidesSection";
import { PlaceLocationPanel } from "@/components/PlaceLocationPanel";
import { PlaceVisitTools } from "@/components/PlaceVisitTools";
import { PlaceViewTracker } from "@/components/PlaceViewTracker";
import { SaveButton } from "@/components/SaveButton";
import { SectionTitle } from "@/components/SectionTitle";
import { ShareButton } from "@/components/ShareButton";
import { StructuredData } from "@/components/StructuredData";
import { TagChip } from "@/components/TagChip";
import { formatPriceRange, formatWon, getPlaceBySlug } from "@/lib/place-store";
import { getRelatedPlaces } from "@/lib/place-recommendations";
import { getRelatedGuidesForPlace } from "@/lib/guide-store";
import { formatOpeningStatus, hasCoordinates } from "@/lib/location";
import { buildChinaPlaceSummary } from "@/lib/place-china/format";
import {
  buildLocalizedMetadata,
  getPlaceContent,
  getLocalizedMenuItem,
  getLocalizedTag,
  isLocale,
  localizedCanonical,
  type Locale,
  ui,
  withLocale,
} from "@/lib/i18n";
import { categoryLabels } from "@/types/database";

type LocalizedPlaceDetailPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

const getCachedPlaceBySlug = cache((slug: string) => getPlaceBySlug(slug));

export function generateStaticParams() {
  return [];
}

async function getRouteParams(params: LocalizedPlaceDetailPageProps["params"]) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return { locale, slug };
}

export async function generateMetadata({ params }: LocalizedPlaceDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await getRouteParams(params);
  const { place } = await getCachedPlaceBySlug(slug);
  const copy = ui[locale];

  if (!place) {
    return buildLocalizedMetadata({
      locale,
      title: copy.placeDetail.titleFallback,
      description: copy.places.description,
      path: `/places/${slug}`,
      type: "article",
    });
  }

  const content = getPlaceContent(place, locale);
  const title = content.secondaryName ? `${content.name} | ${content.secondaryName}` : content.name;
  const chinaSummary = buildChinaPlaceSummary(place.china_info);
  const zhFeatureText = chinaSummary.tags.slice(0, 3).join("、");
  const description =
    locale === "zh"
      ? `${content.name}: 釜山${categoryLabels[place.category].zh}，${zhFeatureText ? `${zhFeatureText}。` : ""}${chinaSummary.summary}`
      : `${content.name}: ${content.description}`;

  return buildLocalizedMetadata({
    locale,
    title,
    description,
    path: `/places/${slug}`,
    type: "article",
    images: place.thumbnail_url ? [{ url: place.thumbnail_url }] : undefined,
  });
}

export default async function LocalizedPlaceDetailPage({ params }: LocalizedPlaceDetailPageProps) {
  const { locale, slug } = await getRouteParams(params);
  const { place, error } = await getCachedPlaceBySlug(slug);
  const copy = ui[locale];

  if (!place) {
    notFound();
  }

  const relatedPlaces = await getRelatedPlaces(place);
  const relatedGuides = await getRelatedGuidesForPlace({
    placeId: place.id,
    area: getPlaceAreaText(place),
    category: place.category,
    limit: 4,
  });

  const content = getPlaceContent(place, locale);
  const recommendedMenus = place.menu_items.filter((item) => item.is_recommended);
  const otherMenus = place.menu_items.filter((item) => !item.is_recommended);
  const facilityTags = [
    place.solo_friendly ? { zh: "一个人也可以", en: "Solo friendly", ja: "一人でもOK", ko: "혼자 가능" } : null,
    place.luggage_friendly ? { zh: "行李OK", en: "Luggage OK", ja: "荷物OK", ko: "캐리어 가능" } : null,
    place.chinese_menu ? { zh: "中文菜单", en: "Chinese menu", ja: "中国語メニュー", ko: "중국어 메뉴" } : null,
    place.card_payment ? { zh: "可以刷卡", en: "Card accepted", ja: "カード可", ko: "카드 가능" } : null,
  ].filter((label): label is Record<Locale, string> => Boolean(label));
  const placeHref = withLocale(`/places/${place.slug}`, locale);
  const opening = formatOpeningStatus(place.opening_hours, locale);
  const priceText = formatPriceRange(place, locale);
  const localizedHoursLabel = { zh: "营业", en: "Hours", ja: "営業時間", ko: "영업" }[locale];
  const currentMenuText = place.menu_items.map((item) => {
    const menu = getLocalizedMenuItem(item, locale);
    return [menu.name, item.price === null ? "" : formatWon(item.price, locale)].filter(Boolean).join(" · ");
  }).join("\n");
  const localizedOrderFallback = {
    zh: "请问可以推荐这里最受欢迎的菜单吗？",
    en: "Could you recommend the most popular item here?",
    ja: "ここで一番人気のメニューをおすすめしてもらえますか？",
    ko: "여기에서 가장 인기 있는 메뉴를 추천해주실 수 있나요?",
  }[locale];
  const websiteHref = safeExternalUrl(place.website);
  const placeHasCoordinates = hasCoordinates(place);
  const coordinates = placeHasCoordinates ? { latitude: place.latitude, longitude: place.longitude } : null;
  const hasPhoto = Boolean(place.thumbnail_url?.trim());
  const photoMissing = { zh: "照片确认中", en: "Photo needs checking", ja: "写真確認中", ko: "사진 확인 필요" }[locale];
  const walkingText = placeHasCoordinates && place.walking_minutes > 0
    ? `${place.walking_minutes}${copy.common.minutes}`
    : copy.common.noInfo;
  const directionsText = placeHasCoordinates && place.walking_minutes > 0
    ? `${[place.nearest_station, place.nearest_exit].filter(Boolean).join(" ")} · ${copy.common.walk} ${walkingText}`
    : copy.common.noInfo;
  const factLabels = {
    zh: { address: "地址", phone: "电话", website: "网站" },
    en: { address: "Address", phone: "Phone", website: "Website" },
    ja: { address: "住所", phone: "電話", website: "ウェブサイト" },
    ko: { address: "주소", phone: "전화", website: "웹사이트" },
  }[locale];

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-4">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "TouristAttraction",
          name: content.secondaryName ? `${content.name} / ${content.secondaryName}` : content.name,
          description: content.description,
          image: place.thumbnail_url,
          url: localizedCanonical(`/places/${place.slug}`, locale),
          address: content.address,
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
        locale={locale}
        place={{
          id: place.id,
          slug: place.slug,
          title: content.name,
          subtitle: content.secondaryName,
          href: placeHref,
          imageUrl: place.thumbnail_url,
          category: place.category,
          area: getPlaceAreaText(place),
        }}
      />
      <Link href={withLocale("/places", locale)} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
        <ArrowLeft size={17} aria-hidden="true" />
        {copy.common.backToPlaces}
      </Link>

      {error ? <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}

      <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="relative aspect-[4/3] bg-slate-200">
          {hasPhoto ? (
            <Image
              src={place.thumbnail_url}
              alt={content.secondaryName ? `${content.name} / ${content.secondaryName}` : content.name}
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="grid h-full place-items-center px-4 text-center text-sm font-black text-slate-500">
              {photoMissing}
            </div>
          )}
          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm backdrop-blur">
            {categoryLabels[place.category][locale]}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <TagChip tone={place.is_active ? "green" : "amber"}>{place.is_active ? copy.common.available : copy.common.unavailable}</TagChip>
              <h1 className="mt-3 text-3xl font-black tracking-normal text-slate-950">{content.name}</h1>
              {content.secondaryName ? <p className="mt-1 text-base text-slate-500">{content.secondaryName}</p> : null}
            </div>
            <SaveButton
              className="h-11 px-3"
              initialSaveCount={place.save_count ?? 0}
              label={placeSaveLabel[locale]}
              locale={locale}
              item={{
                id: place.id,
                type: "place",
                titleZh: place.name_zh,
                titleKo: place.name_ko,
                href: placeHref,
                imageUrl: place.thumbnail_url,
                meta: [categoryLabels[place.category][locale], placeHasCoordinates ? `${copy.common.walk} ${walkingText}` : ""].filter(Boolean).join(" · "),
              }}
            />
          </div>
          <div className="mt-4">
            <ShareButton
              title={content.name}
              text={`${content.name}${content.secondaryName ? ` / ${content.secondaryName}` : ""} - ${content.description}`}
              url={localizedCanonical(`/places/${place.slug}`, locale)}
              placeId={place.id}
              locale={locale}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <InfoTile icon={WalletCards} label={copy.placeDetail.payment} value={priceText} />
            <InfoTile icon={Clock3} label={copy.common.walk} value={walkingText} />
            <InfoTile icon={Route} label={localizedHoursLabel} value={place.opening_hours ? opening.text : copy.common.notRegistered} />
          </div>

          <section className="mt-6">
            <SectionTitle title={copy.placeDetail.recommendation} />
            <p className="mt-3 text-base leading-7 text-slate-700">{content.description}</p>
          </section>

          <div className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
            {content.address ? <DetailFact icon={MapPin} label={factLabels.address} value={content.address} /> : null}
            {place.phone ? <DetailFact icon={Phone} label={factLabels.phone} value={place.phone} href={`tel:${place.phone.replace(/[^\d+]/g, "")}`} /> : null}
            {websiteHref ? <DetailFact icon={Globe2} label={factLabels.website} value={place.website ?? ""} href={websiteHref} external /> : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {place.tags.map((tag) => (
              <TagChip key={tag.slug}>{getLocalizedTag(tag, locale)}</TagChip>
            ))}
            {facilityTags.map((label) => (
              <TagChip key={label.zh} tone="blue">
                {label[locale]}
              </TagChip>
            ))}
          </div>
        </div>
      </section>

      <PlaceVisitTools place={place} locale={locale} coordinates={coordinates} />

      {locale === "zh" ? (
        <PlaceChinaDecisionPanel
          place={place}
          openingText={place.opening_hours ? opening.text : copy.common.notRegistered}
          priceText={priceText}
        />
      ) : null}

      <TravelerInsightsPanel place={place} locale={locale} />

      <section className="mt-6 space-y-3">
        <SectionTitle title={copy.placeDetail.menu} />
        {place.menu_items.length > 0 ? (
          <div className="space-y-3">
            {[...recommendedMenus, ...otherMenus].map((item) => {
              const menu = getLocalizedMenuItem(item, locale);

              return (
                <div key={item.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-950">{menu.name}</h2>
                        {item.is_recommended ? <TagChip tone="green">{copy.placeDetail.recommended}</TagChip> : null}
                      </div>
                      {menu.secondaryName ? <p className="mt-1 text-sm text-slate-500">{menu.secondaryName}</p> : null}
                    </div>
                    <span className="shrink-0 font-black text-slate-950">{formatWon(item.price, locale)}</span>
                  </div>
                  {menu.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{menu.description}</p> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[22px] bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            {copy.placeDetail.noMenu}
          </div>
        )}
      </section>

      {place.category === "restaurant" ? (
        <OrderGuide place={place} locale={locale} />
      ) : (
        <section className="mt-6 space-y-3">
          <SectionTitle title={copy.placeDetail.howToSay} />
          <div className="rounded-[24px] bg-teal-700 p-5 text-white shadow-sm">
            <MessageSquareText size={22} aria-hidden="true" />
            <p className="mt-3 text-lg font-bold">{content.recommendedOrder || localizedOrderFallback}</p>
            <p className="mt-3 rounded-2xl bg-white/12 p-3 text-sm leading-6 text-teal-50">
              {place.recommended_order_ko || "여기에서 가장 인기 있는 메뉴를 추천해주실 수 있나요?"}
            </p>
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <InfoPanel icon={Users} title={copy.placeDetail.waiting} body={content.waitingInfo || copy.common.noInfo} />
        <InfoPanel
          icon={MapPin}
          title={copy.placeDetail.directions}
          body={directionsText}
        />
      </section>

      <section className="mt-6 space-y-3">
        <SectionTitle title={copy.placeDetail.travelTip} />
        <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <Soup size={22} className="text-teal-700" aria-hidden="true" />
          <p className="mt-3 text-base leading-7 text-slate-700">{content.travelTip || copy.common.noInfo}</p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <InfoTile icon={CreditCard} label={copy.placeDetail.payment} value={place.card_payment ? facilityTags[3]?.[locale] ?? "OK" : copy.common.noInfo} />
        <InfoTile icon={MapPin} label={copy.placeDetail.coordinates} value={placeHasCoordinates ? `${place.latitude}, ${place.longitude}` : copy.common.notRegistered} />
      </section>

      <section className="mt-6 rounded-[24px] bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        {copy.placeDetail.confirmationNote}
      </section>

      <RelatedPlacesSection places={relatedPlaces} locale={locale} />
      <RelatedGuidesSection guides={relatedGuides} locale={locale} />

      <PlaceCorrectionForm
        placeId={place.id}
        locale={locale}
        currentValues={{
          opening_hours: place.opening_hours,
          menu: currentMenuText,
          menu_price: currentMenuText,
          price_range: priceText,
          phone: place.phone ?? "",
          website: place.website ?? "",
          location: content.address,
        }}
      />
      <PlaceLocationPanel place={place} locale={locale} />
    </main>
  );
}

const placeSaveLabel: Record<Locale, string> = {
  zh: "加入釜山清单",
  en: "Save to trip list",
  ja: "釜山リストに保存",
  ko: "여행 리스트에 저장",
};

function getPlaceAreaText(place: { address_ko?: string; address_zh?: string; nearest_station?: string; name_ko?: string; name_zh?: string }) {
  const text = `${place.address_ko ?? ""} ${place.address_zh ?? ""} ${place.nearest_station ?? ""} ${place.name_ko ?? ""} ${place.name_zh ?? ""}`;
  if (text.includes("광안") || text.includes("广安")) return "광안리";
  if (text.includes("해운대") || text.includes("海云台") || text.includes("海雲台")) return "해운대";
  if (text.includes("서면") || text.includes("西面")) return "서면";
  if (text.includes("남포") || text.includes("南浦")) return "남포";
  return "";
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

function DetailFact({
  icon: Icon,
  label,
  value,
  href,
  external = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  const content = <span className="break-all text-sm font-semibold text-slate-800">{value}</span>;

  return (
    <div className="grid grid-cols-[20px_72px_1fr] items-start gap-2 py-3">
      <Icon size={17} className="mt-0.5 text-teal-700" aria-hidden="true" />
      <span className="text-sm text-slate-500">{label}</span>
      {href ? (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer" : undefined}
          className="min-w-0 text-teal-700 underline-offset-4 hover:underline"
        >
          {content}
        </a>
      ) : content}
    </div>
  );
}

function safeExternalUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function InfoPanel({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <Icon size={22} className="text-teal-700" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">{body}</p>
    </div>
  );
}
