import Image from "next/image";
import Link from "next/link";
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
  Globe2,
  Luggage,
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
import { TravelerDecisionCard } from "@/components/TravelerDecisionCard";
import { TravelerTrustSignals } from "@/components/TravelerTrustSignals";
import { TravelerVerification } from "@/components/TravelerVerification";
import { TasteProfileCard } from "@/components/TasteProfileCard";
import { TimeAwareStatus } from "@/components/TimeAwareStatus";
import { RelatedPlacesSection } from "@/components/RelatedPlacesSection";
import { RelatedGuidesSection } from "@/components/RelatedGuidesSection";
import { Next90MinuteRoute } from "@/components/Next90MinuteRoute";
import { PlaceLocationPanel } from "@/components/PlaceLocationPanel";
import { PlaceVisitTools } from "@/components/PlaceVisitTools";
import { PlaceViewTracker } from "@/components/PlaceViewTracker";
import { SaveButton } from "@/components/SaveButton";
import { DirectionsButton } from "@/components/DirectionsButton";
import { PlaceMobileActions } from "@/components/PlaceMobileActions";
import { SectionTitle } from "@/components/SectionTitle";
import { ShareButton } from "@/components/ShareButton";
import { StructuredData } from "@/components/StructuredData";
import { breadcrumbSchema, placeSchema, translatedPlaceLocales } from "@/lib/public-seo";
import { buildTrustedPlaceMetaDescription } from "@/lib/place-seo";
import { isVerifiedPlace } from "@/lib/place-publication-quality";
import { resolvePlaceFact } from "@/lib/place-data-integrity";
import { TagChip } from "@/components/TagChip";
import { getCachedPublicPlaceBySlug, getCachedRelatedGuidesForPlace } from "@/lib/public-cache";
import { formatPriceRange, formatWon } from "@/lib/place-store";
import { getPracticalRouteContext, getRelatedPlaces } from "@/lib/place-recommendations";
import { formatOpeningStatus, hasCoordinates } from "@/lib/location";
import {
  getLastVerifiedLabel,
  getLastVerifiedAt,
  getConfirmedTransitLabel,
  getPlaceCategoryLabel,
  getPlaceNameDisplay,
  getPlacePhotoDisplay,
  getPlaceTrustCopy,
  getPublicPlaceDescription,
  getPublicTravelTip,
  getSourceSummary,
  getTrustedPlaceImageUrl,
  getVerificationStatus,
  getVerificationStatusLabel,
} from "@/lib/place-trust";
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
import type { PlaceWithRelations } from "@/types/database";

type LocalizedPlaceDetailPageProps = {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
};

export const revalidate = 300;

async function getRouteParams(params: LocalizedPlaceDetailPageProps["params"]) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return { locale, slug };
}

export async function generateMetadata({ params }: LocalizedPlaceDetailPageProps): Promise<Metadata> {
  const { locale, slug } = await getRouteParams(params);
  const { place } = await getCachedPublicPlaceBySlug(slug);
  const copy = ui[locale];

  if (!place) {
    return buildLocalizedMetadata({
      locale,
      title: copy.placeDetail.titleFallback,
      description: copy.places.description,
      path: `/places/${slug}`,
      type: "article",
      noIndex: true,
    });
  }

  const content = getPlaceContent(place, locale);
  const nameDisplay = getPlaceNameDisplay(place, locale);
  const title = nameDisplay.secondaryName ? `${nameDisplay.name} | ${nameDisplay.secondaryName}` : nameDisplay.name;
  const description = buildTrustedPlaceMetaDescription(place, locale, isVerifiedPlace(place));
  const trustedImageUrl = getTrustedPlaceImageUrl(place);

  return buildLocalizedMetadata({
    locale,
    title,
    description,
    path: `/places/${slug}`,
    type: "article",
    images: trustedImageUrl ? [{ url: trustedImageUrl }] : undefined,
    availableLocales: translatedPlaceLocales(place),
    noIndex: !translatedPlaceLocales(place).includes(locale),
  });
}

export default async function LocalizedPlaceDetailPage({ params }: LocalizedPlaceDetailPageProps) {
  const { locale, slug } = await getRouteParams(params);
  const { place, error } = await getCachedPublicPlaceBySlug(slug);
  const copy = ui[locale];

  if (!place) {
    notFound();
  }

  const [relatedPlacesResult, relatedGuides, practicalRoute] = await Promise.all([
    getRelatedPlaces(place),
    getCachedRelatedGuidesForPlace({
      placeId: place.id,
      area: getPlaceAreaText(place),
      category: place.category,
      limit: 4,
    }),
    getPracticalRouteContext(place),
  ]);
  const relatedPlaces = relatedPlacesResult.filter((relatedPlace) => translatedPlaceLocales(relatedPlace).includes(locale));

  const content = getPlaceContent(place, locale);
  const nameDisplay = getPlaceNameDisplay(place, locale);
  const trustCopy = getPlaceTrustCopy(locale);
  const publicDescription = getPublicPlaceDescription(place, locale);
  const publicTravelTip = getPublicTravelTip(place, locale);
  const photo = getPlacePhotoDisplay(place, locale);
  const trustedImageUrl = getTrustedPlaceImageUrl(place);
  const verificationStatus = getVerificationStatus(place);
  const recommendedMenus = place.menu_items.filter((item) => item.is_recommended);
  const otherMenus = place.menu_items.filter((item) => !item.is_recommended);
  const facilityTags = [
    resolvePlaceFact(place, "solo_friendly") === "yes" ? { zh: "一个人也可以", en: "Solo friendly", ja: "一人でもOK", ko: "혼자 가능" } : null,
    resolvePlaceFact(place, "luggage_friendly") === "yes" ? { zh: "行李OK", en: "Luggage OK", ja: "荷物OK", ko: "캐리어 가능" } : null,
    resolvePlaceFact(place, "chinese_menu") === "yes" ? { zh: "中文菜单", en: "Chinese menu", ja: "中国語メニュー", ko: "중국어 메뉴" } : null,
    resolvePlaceFact(place, "card_payment") === "yes" ? { zh: "可以刷卡", en: "Card accepted", ja: "カード可", ko: "카드 가능" } : null,
  ].filter((label): label is Record<Locale, string> => Boolean(label));
  const placeHref = withLocale(`/places/${place.slug}`, locale);
  const opening = formatOpeningStatus(place.opening_hours, locale);
  const priceText = formatPriceRange(place, locale);
  const localizedPriceLabel = { zh: "代表价格", en: "Typical price", ja: "代表価格", ko: "대표가격" }[locale];
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
  const koreanOrderLabel = {
    zh: "给店员看的韩语原文",
    en: "Korean phrase for staff",
    ja: "店員に見せる韓国語原文",
    ko: "직원에게 보여줄 한국어 문장",
  }[locale];
  const websiteHref = safeExternalUrl(place.website);
  const placeHasCoordinates = hasCoordinates(place);
  const coordinates = placeHasCoordinates ? { latitude: place.latitude, longitude: place.longitude } : null;
  const walkingText = placeHasCoordinates && place.walking_minutes > 0
    ? `${place.walking_minutes}${copy.common.minutes}`
    : copy.common.noInfo;
  const directionsText = placeHasCoordinates && place.walking_minutes > 0
    ? getConfirmedTransitLabel(place, locale)
    : copy.common.noInfo;
  const visitCheck = buildVisitCheckItems(place, locale, {
    opening: place.opening_hours ? opening.text : "",
    priceText,
    transit: placeHasCoordinates ? getConfirmedTransitLabel(place, locale) : "",
  });
  const factLabels = {
    zh: { address: "中文参考地址", phone: "电话", website: "网站", verification: "现场验证状态", evidence: "推荐依据", source: "来源状态", lastChecked: "基本信息确认日" },
    en: { address: "Readable address", phone: "Phone", website: "Website", verification: "Field verification", evidence: "Recommendation basis", source: "Source status", lastChecked: "Basic info checked" },
    ja: { address: "住所", phone: "電話", website: "ウェブサイト", verification: "現地検証状態", evidence: "おすすめ根拠", source: "出典状態", lastChecked: "基本情報確認日" },
    ko: { address: "주소", phone: "전화", website: "웹사이트", verification: "현장 검증 상태", evidence: "추천 근거", source: "출처 상태", lastChecked: "기본정보 최근 확인일" },
  }[locale];
  const fullyVerified = isVerifiedPlace(place);
  const detailStatus = getVerificationStatusLabel(fullyVerified ? "verified" : verificationStatus === "needs_review" ? "needs_review" : "unverified", locale);
  const detailSource = getSourceSummary(place, locale);
  const detailLastChecked = getLastVerifiedLabel(place, locale);
  const detailEvidence = getRecommendationBasisLabel(place, locale);
  const recommendationDescription = publicDescription || trustCopy.noPublicDescription;
  const localizedTags = place.tags
    .map((tag) => ({ slug: tag.slug, label: getLocalizedTag(tag, locale) }))
    .filter((tag) => tag.label);
  const detailGroups = {
    zh: { traveler: "外国游客详细信息", menu: "菜单与点餐", route: "接下来90分钟", nearby: "周边地点与地图", report: "现场信息与修改提交", scope: "基本信息确认日、现场验证和来源状态分别管理；某一项未确认，不代表其他项未确认。" },
    en: { traveler: "Detailed visitor information", menu: "Menu and ordering", route: "Your next 90 minutes", nearby: "Nearby places and map", report: "Field checks and corrections", scope: "Basic-info date, field verification, and source status are tracked separately. An unknown field does not invalidate a separately dated fact." },
    ja: { traveler: "外国人向け詳細情報", menu: "メニューと注文", route: "次の90分", nearby: "周辺スポットと地図", report: "現地情報・修正投稿", scope: "基本情報の確認日、現地検証、出典状態は別々に管理しています。一項目の未確認は他項目の確認日を否定しません。" },
    ko: { traveler: "외국인 상세정보", menu: "메뉴와 주문", route: "다음 90분", nearby: "주변 장소와 지도", report: "현장 확인·정보 제보", scope: "기본정보 확인일, 현장 검증, 출처 상태는 서로 다른 범위입니다. 한 항목의 미확인이 다른 항목의 확인일을 부정하지 않습니다." },
  }[locale];

  return (
    <main className="safe-bottom mx-auto max-w-5xl px-4 pb-6 pt-4">
      <StructuredData data={placeSchema(place, locale)} />
      <StructuredData data={breadcrumbSchema([
        { name: copy.nav.home, url: localizedCanonical("/", locale) },
        { name: copy.places.title, url: localizedCanonical("/places", locale) },
        { name: nameDisplay.name, url: localizedCanonical(`/places/${place.slug}`, locale) },
      ])} />
      <PlaceViewTracker
        locale={locale}
        place={{
          id: place.id,
          slug: place.slug,
          title: nameDisplay.name,
          subtitle: nameDisplay.secondaryName ? `${nameDisplay.secondaryLabel} · ${nameDisplay.secondaryName}` : "",
          href: placeHref,
          imageUrl: trustedImageUrl,
          category: place.category,
          area: getPlaceAreaText(place),
        }}
      />
      <Link href={withLocale("/places", locale)} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600">
        <ArrowLeft size={17} aria-hidden="true" />
        {copy.common.backToPlaces}
      </Link>

      {error ? <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}

      <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="relative h-[260px] bg-slate-200 sm:h-[300px] lg:h-[420px]">
          {photo.kind === "image" ? (
            <Image
              src={photo.url}
              alt={nameDisplay.secondaryName ? `${nameDisplay.name} / ${nameDisplay.secondaryName}` : nameDisplay.name}
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
            {getPlaceCategoryLabel(place.category, locale)}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <TagChip tone={place.is_active ? "green" : "amber"}>{place.is_active ? copy.common.available : copy.common.unavailable}</TagChip>
              <h1 className="mt-3 text-3xl font-black tracking-normal text-slate-950">{nameDisplay.name}</h1>
              {nameDisplay.secondaryName ? <p className="mt-1 text-base text-slate-500">{nameDisplay.secondaryLabel} · {nameDisplay.secondaryName}</p> : null}
              {nameDisplay.translationMissing ? <p className="mt-2 text-sm font-black text-amber-700">{nameDisplay.translationNotice}</p> : null}
            </div>
            <div className="flex shrink-0 flex-col gap-2"><SaveButton
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
                imageUrl: trustedImageUrl,
                meta: [getPlaceCategoryLabel(place.category, locale), placeHasCoordinates ? `${copy.common.walk} ${walkingText}` : ""].filter(Boolean).join(" · "),
              }}
            /><DirectionsButton placeId={place.id} name={content.name} address={place.address_ko} coordinates={coordinates} locale={locale} compact /></div>
          </div>
          <div className="mt-4">
            <ShareButton
              title={nameDisplay.name}
              text={`${nameDisplay.name}${nameDisplay.secondaryName ? ` / ${nameDisplay.secondaryName}` : ""} - ${recommendationDescription}`}
              url={localizedCanonical(`/places/${place.slug}`, locale)}
              placeId={place.id}
              locale={locale}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <InfoTile icon={WalletCards} label={localizedPriceLabel} value={priceText} />
            <InfoTile icon={Clock3} label={copy.common.walk} value={walkingText} />
            <InfoTile icon={Route} label={localizedHoursLabel} value={place.opening_hours ? opening.text : copy.common.notRegistered} />
          </div>
          <TimeAwareStatus place={place} locale={locale} travelMinutes={0} variant="detail" />

          <section className="mt-5 rounded-[24px] bg-slate-950 p-4 text-white">
            <div className="flex items-center gap-2">
              <BadgeCheck size={19} className="text-teal-200" aria-hidden="true" />
              <h2 className="text-lg font-black">{visitCheck.copy.title}</h2>
            </div>
            {visitCheck.items.length ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {visitCheck.items.map((item) => (
                  <div key={item.label} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                    <item.icon size={16} className="text-teal-200" aria-hidden="true" />
                    <p className="mt-2 text-xs font-bold text-slate-300">{item.label}</p>
                    <p className="mt-1 text-sm font-black leading-5 text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {visitCheck.unknown.length ? (
              <details className="mt-3 rounded-2xl bg-white/10 p-3 text-sm text-slate-200 ring-1 ring-white/10">
                <summary className="cursor-pointer font-black text-white">{visitCheck.copy.unknownTitle}</summary>
                <p className="mt-2 leading-6">{visitCheck.unknown.join(" · ")}</p>
              </details>
            ) : null}
          </section>

          <section className="mt-6">
            <SectionTitle title={copy.placeDetail.recommendation} />
            <p className="mt-3 text-base leading-7 text-slate-700">{recommendationDescription}</p>
          </section>

          <section className="mt-5 grid gap-2 rounded-[22px] bg-slate-50 p-4 ring-1 ring-slate-100 sm:grid-cols-2">
            <TrustFact icon={BadgeCheck} label={factLabels.verification} value={detailStatus} />
            <TrustFact icon={BadgeCheck} label={factLabels.evidence} value={detailEvidence} />
            <TrustFact icon={FileSearch} label={factLabels.source} value={detailSource} />
            <TrustFact icon={CalendarCheck2} label={factLabels.lastChecked} value={detailLastChecked} />
          </section>

          <div className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
            {content.address ? <DetailFact icon={MapPin} label={factLabels.address} value={content.address} /> : null}
            {locale === "zh" && content.addressTranslationMissing ? <DetailFact icon={MapPin} label={factLabels.address} value="中文地址确认中" /> : null}
            {locale === "zh" && content.addressOriginalKo ? <DetailFact icon={MapPin} label="韩国原地址" value={content.addressOriginalKo} /> : null}
            {place.phone ? <DetailFact icon={Phone} label={factLabels.phone} value={place.phone} href={`tel:${place.phone.replace(/[^\d+]/g, "")}`} /> : null}
            {websiteHref ? <DetailFact icon={Globe2} label={factLabels.website} value={place.website ?? ""} href={websiteHref} external /> : null}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">{detailGroups.scope}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {localizedTags.map((tag) => (
              <TagChip key={tag.slug}>{tag.label}</TagChip>
            ))}
            {facilityTags.map((label) => (
              <TagChip key={label.zh} tone="blue">
                {label[locale]}
              </TagChip>
            ))}
          </div>
        </div>
        </div>
      </section>

      <PlaceVisitTools place={place} locale={locale} coordinates={coordinates} />
      <DetailDisclosure title={detailGroups.traveler}>
        <TravelerDecisionCard place={place} locale={locale} variant="detail" className="rounded-lg" />
        <TravelerTrustSignals placeId={place.id} locale={locale} />
        <TasteProfileCard place={place} locale={locale} variant="detail" />
      </DetailDisclosure>

      {(place.menu_items.length > 0 || content.recommendedOrder || place.recommended_order_ko) ? <DetailDisclosure title={detailGroups.menu}>
        {place.menu_items.length > 0 ? <ul className="space-y-3">
          {[...recommendedMenus, ...otherMenus].map((item) => {
            const menu = getLocalizedMenuItem(item, locale);

            return (
              <li key={item.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-950">{menu.name}</h3>
                      {item.is_recommended ? <TagChip tone="green">{copy.placeDetail.recommended}</TagChip> : null}
                    </div>
                    {menu.secondaryName ? <p className="mt-1 text-sm text-slate-500">{menu.secondaryName}</p> : null}
                    {menu.translationMissing ? <p className="mt-1 text-xs font-bold text-amber-700">{menu.translationNotice}</p> : null}
                  </div>
                  <span className="shrink-0 font-black text-slate-950">{formatWon(item.price, locale)}</span>
                </div>
                {menu.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{menu.description}</p> : null}
              </li>
            );
          })}
        </ul> : null}

      {place.category === "restaurant" ? (
        <OrderGuide place={place} locale={locale} />
      ) : (content.recommendedOrder || place.recommended_order_ko ? (
        <section className="mt-6 space-y-3">
          <SectionTitle title={copy.placeDetail.howToSay} />
          <div className="rounded-[24px] bg-teal-700 p-5 text-white shadow-sm">
            <MessageSquareText size={22} aria-hidden="true" />
            <p className="mt-3 text-lg font-bold">{content.recommendedOrder || localizedOrderFallback}</p>
            <p className="mt-3 text-xs font-bold text-teal-100">{koreanOrderLabel}</p>
            <p className="mt-3 rounded-2xl bg-white/12 p-3 text-sm leading-6 text-teal-50">
              {place.recommended_order_ko || "여기에서 가장 인기 있는 메뉴를 추천해주실 수 있나요?"}
            </p>
          </div>
        </section>
      ) : null)}
      </DetailDisclosure> : null}

      {(content.waitingInfo || directionsText !== copy.common.noInfo) ? <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {content.waitingInfo ? <InfoPanel icon={Users} title={copy.placeDetail.waiting} body={content.waitingInfo} /> : null}
        {directionsText !== copy.common.noInfo ? (
        <InfoPanel
          icon={MapPin}
          title={copy.placeDetail.directions}
          body={directionsText}
        />
        ) : null}
      </section> : null}

      {publicTravelTip ? <section className="mt-6 space-y-3">
        <SectionTitle title={copy.placeDetail.travelTip} />
        <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <Soup size={22} className="text-teal-700" aria-hidden="true" />
          <p className="mt-3 text-base leading-7 text-slate-700">{publicTravelTip}</p>
        </div>
      </section> : null}

      <section className="mt-6 rounded-[24px] bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        {copy.placeDetail.confirmationNote}
      </section>

      {practicalRoute.candidates.length ? <DetailDisclosure title={detailGroups.route}>
        <Next90MinuteRoute origin={place} candidates={practicalRoute.candidates} connections={practicalRoute.connections} locale={locale} />
      </DetailDisclosure> : null}
      {(relatedPlaces.length || relatedGuides.length || placeHasCoordinates) ? <DetailDisclosure title={detailGroups.nearby}>
        <RelatedPlacesSection places={relatedPlaces} locale={locale} headingLevel="h3" />
        <RelatedGuidesSection guides={relatedGuides} locale={locale} headingLevel="h3" />
        <PlaceLocationPanel place={place} locale={locale} />
      </DetailDisclosure> : null}

      <DetailDisclosure title={detailGroups.report}>
        <TravelerVerification placeId={place.id} placeName={nameDisplay.name} locale={locale} coordinates={coordinates} />
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
            location: content.address || place.address_ko,
          }}
        />
      </DetailDisclosure>
      <PlaceMobileActions place={place} locale={locale} coordinates={coordinates} imageUrl={trustedImageUrl} />
    </main>
  );
}

function DetailDisclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="mt-6 overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 py-3 marker:hidden">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <span className="text-xl font-black text-teal-700" aria-hidden="true">＋</span>
      </summary>
      <div className="border-t border-slate-100 p-4">{children}</div>
    </details>
  );
}

type VisitCheckItem = {
  icon: LucideIcon;
  label: string;
  value: string;
};

function buildVisitCheckItems(
  place: PlaceWithRelations,
  locale: Locale,
  values: { opening: string; priceText: string; transit: string },
) {
  const text = {
    zh: {
      title: "到访前 30 秒确认",
      opening: "营业",
      menu: "招牌/价格",
      price: "人均预计",
      waiting: "等位",
      transit: "车站/步行",
      payment: "刷卡",
      solo: "一个人",
      restroom: "洗手间",
      luggage: "大行李箱",
      checked: "最后确认",
      unknownTitle: "尚未确认的信息",
      yes: "可以",
      no: "不适合",
      card: "可刷卡",
      foreignCard: "海外信用卡可用",
      cardNo: "需确认现金或本地卡",
    },
    en: {
      title: "30-second visit check",
      opening: "Hours",
      menu: "Menu / price",
      price: "Est. per person",
      waiting: "Wait",
      transit: "Station / walk",
      payment: "Cards",
      solo: "Solo",
      restroom: "Restroom",
      luggage: "Large luggage",
      checked: "Last checked",
      unknownTitle: "Not confirmed yet",
      yes: "Available",
      no: "Difficult",
      card: "Cards accepted",
      foreignCard: "Foreign cards accepted",
      cardNo: "Cash or local card needs checking",
    },
    ja: {
      title: "訪問前30秒チェック",
      opening: "営業時間",
      menu: "代表メニュー/価格",
      price: "1人目安",
      waiting: "待ち時間",
      transit: "駅/徒歩",
      payment: "カード",
      solo: "一人利用",
      restroom: "トイレ",
      luggage: "大型荷物",
      checked: "最終確認",
      unknownTitle: "まだ確認されていない情報",
      yes: "利用しやすい",
      no: "難しい",
      card: "カード可",
      foreignCard: "海外カード可",
      cardNo: "現金または韓国カード要確認",
    },
    ko: {
      title: "방문 전 30초 체크",
      opening: "영업",
      menu: "대표 메뉴/가격",
      price: "1인 예상",
      waiting: "웨이팅",
      transit: "역/도보",
      payment: "카드",
      solo: "혼밥",
      restroom: "화장실",
      luggage: "캐리어",
      checked: "마지막 확인일",
      unknownTitle: "아직 확인되지 않은 정보",
      yes: "가능",
      no: "어려움",
      card: "카드 가능",
      foreignCard: "해외카드 가능",
      cardNo: "현금 또는 국내카드 확인 필요",
    },
  }[locale];
  const items: VisitCheckItem[] = [];
  const unknown: string[] = [];
  const primaryMenu = [...place.menu_items].sort((a, b) => Number(b.is_recommended) - Number(a.is_recommended) || a.sort_order - b.sort_order)[0];
  const localizedMenu = primaryMenu ? getLocalizedMenuItem(primaryMenu, locale) : null;
  const menuText = localizedMenu?.name ? [localizedMenu.name, primaryMenu?.price === null ? "" : formatWon(primaryMenu?.price ?? null, locale)].filter(Boolean).join(" · ") : "";
  const waitingText = getVisitWaitingLabel(place, locale);
  const paymentText = getVisitPaymentLabel(place, locale, text);
  const soloText = getVisitTriStateLabel(place.china_info?.solo_friendly, place.solo_friendly, text);
  const restroomText = getVisitTriStateLabel(place.china_info?.toilet_available, false, text);
  const luggageText = getVisitTriStateLabel(place.china_info?.luggage_friendly, place.luggage_friendly, text);
  const lastVerified = getLastVerifiedAt(place) ? getLastVerifiedLabel(place, locale) : "";

  addVisitItem(items, unknown, Clock3, text.opening, values.opening);
  addVisitItem(items, unknown, Soup, text.menu, menuText);
  addVisitItem(items, unknown, WalletCards, text.price, values.priceText && values.priceText !== ui[locale].common.priceUnknown ? values.priceText : "");
  addVisitItem(items, unknown, Users, text.waiting, waitingText);
  addVisitItem(items, unknown, Route, text.transit, values.transit);
  addVisitItem(items, unknown, CreditCard, text.payment, paymentText);
  addVisitItem(items, unknown, Users, text.solo, soloText);
  addVisitItem(items, unknown, MapPin, text.restroom, restroomText);
  addVisitItem(items, unknown, Luggage, text.luggage, luggageText);
  addVisitItem(items, unknown, CalendarCheck2, text.checked, lastVerified);

  return { copy: text, items, unknown };
}

function addVisitItem(items: VisitCheckItem[], unknown: string[], icon: LucideIcon, label: string, value: string) {
  if (value.trim()) {
    items.push({ icon, label, value });
    return;
  }

  unknown.push(label);
}

function getVisitTriStateLabel(value: "yes" | "no" | "unknown" | undefined, legacy: boolean, text: { yes: string; no: string }) {
  const status = value ?? (legacy ? "yes" : "unknown");
  if (status === "yes") return text.yes;
  if (status === "no") return text.no;
  return "";
}

function getVisitPaymentLabel(place: PlaceWithRelations, locale: Locale, text: { card: string; foreignCard: string; cardNo: string }) {
  const status = resolvePlaceFact(place, "card_payment");
  if (status === "yes") return place.china_info?.foreign_card === "yes" ? text.foreignCard : text.card;
  if (status === "no") return text.cardNo;
  return "";
}

function getVisitWaitingLabel(place: PlaceWithRelations, locale: Locale) {
  const level = place.china_info?.waiting_level;
  if (level === "none") return { zh: "基本无需等位", en: "Little or no wait", ja: "待ち時間ほぼなし", ko: "웨이팅 거의 없음" }[locale];
  if (level === "short") return { zh: "约5-10分钟", en: "About 5-10 min", ja: "約5-10分", ko: "약 5~10분" }[locale];
  if (level === "moderate") return { zh: "约10-20分钟", en: "About 10-20 min", ja: "約10-20分", ko: "약 10~20분" }[locale];
  if (level === "long") return { zh: "约20-40分钟", en: "About 20-40 min", ja: "約20-40分", ko: "약 20~40분" }[locale];
  if (level === "extreme") return { zh: "40分钟以上", en: "Over 40 min", ja: "40分以上", ko: "40분 이상" }[locale];
  if (level === "varies") return { zh: "按时段变化", en: "Varies by time", ja: "時間帯で変動", ko: "시간대별 변동" }[locale];
  if (locale === "zh" && place.waiting_info_zh.trim() && !/[가-힣]/u.test(place.waiting_info_zh)) return place.waiting_info_zh.trim();
  if (locale === "ko" && place.waiting_info_ko.trim()) return place.waiting_info_ko.trim();
  return "";
}

function getRecommendationBasisLabel(place: PlaceWithRelations, locale: Locale) {
  const count = place.decision_profile?.evidence_count ?? 0;
  if (count > 0) return {
    zh: `${count} 条已登记依据`, en: `${count} registered evidence item${count === 1 ? "" : "s"}`,
    ja: `登録根拠 ${count}件`, ko: `등록 근거 ${count}건`,
  }[locale];
  return { zh: "推荐依据未确认", en: "Recommendation basis unverified", ja: "おすすめ根拠は未確認", ko: "추천 근거 미확인" }[locale];
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
