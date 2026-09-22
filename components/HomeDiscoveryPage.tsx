import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Building2,
  CalendarDays,
  Clock3,
  CloudRain,
  Compass,
  Languages,
  Luggage,
  MapPin,
  Search,
  Send,
  Train,
  UserRound,
  WalletCards,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { GuideCard } from "@/components/GuideCard";
import { HomeSearchForm } from "@/components/HomeSearchForm";
import { PlaceCard } from "@/components/PlaceCard";
import { SectionTitle } from "@/components/SectionTitle";
import { busanDistrictOptions, getBusanDistrictKey, getBusanDistrictLabel, type BusanDistrictKey } from "@/lib/busan-districts";
import { getHomeQuickFilters, type HomeQuickFilterKey } from "@/lib/home-discovery";
import { getProblemGuides, resolveHomeIntentCards, type ResolvedHomeIntentCard } from "@/lib/home-intent-links";
import { type Locale, ui, withLocale } from "@/lib/i18n";
import { distanceFromGwangalli } from "@/lib/place-display";
import { estimateWalkingMinutes } from "@/lib/location";
import { getTimeAwarePlaceState } from "@/lib/time-aware-place";
import { isVerifiedPlace } from "@/lib/place-publication-quality";
import type { PlaceWithRelations } from "@/types/database";
import type { Guide } from "@/types/guide";

type HomeDiscoveryPageProps = {
  locale: Locale;
  places: PlaceWithRelations[];
};

type BusanDiscoveryPageProps = {
  locale: Locale;
  places: PlaceWithRelations[];
  guides: Guide[];
  selectedDistrict?: BusanDistrictKey;
};

const quickFilterIcons: Record<HomeQuickFilterKey, LucideIcon> = {
  openNow: Clock3,
  lowWait: Clock3,
  solo: UserRound,
  under10000: WalletCards,
  oceanView: Waves,
  rainyDay: CloudRain,
  luggage: Luggage,
  subwayWalk10: Train,
  chineseMenu: Languages,
};

export function HomeDiscoveryPage({ locale, places }: HomeDiscoveryPageProps) {
  const copy = cityHomeCopy[locale];
  const districtCounts = getDistrictCounts(places);
  const activeDistricts = busanDistrictOptions
    .map((district) => ({ ...district, count: districtCounts.get(district.key) ?? 0 }))
    .filter((district) => district.count > 0)
    .sort((a, b) => b.count - a.count);
  const preparingDistrictCount = busanDistrictOptions.length - activeDistricts.length;
  const now = new Date();
  const nowWorthPlaces = places.filter((place) => getTimeAwarePlaceState(place, { now, travelMinutes: estimateWalkingMinutes(distanceFromGwangalli(place)) }).recommendedAtArrival === true).slice(0, 4);

  return (
    <main className="safe-bottom mx-auto max-w-5xl px-4 pb-6 pt-5">
      <section className="bg-slate-950 px-5 py-7 text-white shadow-xl shadow-teal-900/10 sm:px-7 sm:py-9">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-teal-100 ring-1 ring-white/10">
          <MapPin size={16} aria-hidden="true" />
          {copy.area}
        </div>
        <h1 className="mt-5 max-w-2xl text-3xl font-black leading-tight tracking-normal sm:text-4xl">{copy.heading}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{copy.supporting}</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/places?recommendedNow=true&sort=verified", label: copy.nowWorth, icon: Compass },
            { href: "/busan", label: copy.bySituation, icon: MapPin },
            { href: "#sns-place-search", label: copy.findFromSns, icon: Search },
            { href: "/itinerary", label: copy.buildItinerary, icon: Bookmark },
          ].map((action) => {
            const Icon = action.icon;
            const href = action.href.startsWith("#") ? action.href : withLocale(action.href, locale);

            return (
              <Link key={action.label} href={href} className="flex min-h-14 items-center gap-3 rounded-lg bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/15 transition hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-teal-200 active:scale-[0.99]">
                <Icon size={19} className="shrink-0 text-teal-200" aria-hidden="true" />
                <span>{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-b border-slate-200 py-7">
        <SectionTitle title={copy.nowWorth} subtitle={copy.nowWorthSubtitle} action={<Link href={withLocale("/places?recommendedNow=true&sort=verified", locale)} className="inline-flex min-h-11 items-center gap-1 text-sm font-black text-teal-700">{ui[locale].common.viewAll}<ArrowRight size={16} aria-hidden="true" /></Link>} />
        {nowWorthPlaces.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2">{nowWorthPlaces.map((place) => <PlaceCard key={place.id} place={place} locale={locale} distanceMeters={distanceFromGwangalli(place)} />)}</div> : <p className="mt-4 rounded-lg bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">{copy.nowWorthEmpty}</p>}
      </section>

      <section id="sns-place-search" className="scroll-mt-40 border-b border-slate-200 py-7">
        <SectionTitle title={copy.searchTitle} subtitle={copy.searchSubtitle} />
        <div className="mt-4"><HomeSearchForm locale={locale} /></div>
      </section>

      <section className="py-7">
        <SectionTitle title={copy.cityTitle} subtitle={copy.citySubtitle} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link href={withLocale("/busan", locale)} className="flex min-h-24 items-center gap-3 rounded-lg bg-teal-700 p-4 text-white shadow-sm ring-1 ring-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-100">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white/15"><Building2 size={21} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-black">{copy.busan}</span>
              <span className="mt-1 block text-xs font-bold text-teal-100">{copy.publishedPlaces} {places.length}</span>
            </span>
            <ArrowRight size={18} className="shrink-0" aria-hidden="true" />
          </Link>
          {[copy.seoul, copy.jeju].map((city) => (
            <div key={city} aria-disabled="true" className="flex min-h-24 items-center gap-3 rounded-lg bg-slate-100 p-4 text-slate-500 ring-1 ring-slate-200">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white text-slate-400"><Building2 size={21} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-black">{city}</span>
                <span className="mt-1 block text-xs font-bold">{copy.preparing}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 py-7">
        <SectionTitle
          title={copy.activeDistricts}
          subtitle={preparingDistrictCount > 0 ? `${copy.activeDistrictsSubtitle} ${copy.preparingDistricts} ${preparingDistrictCount}` : copy.activeDistrictsSubtitle}
          action={<Link href={withLocale("/busan", locale)} className="inline-flex min-h-11 items-center gap-1 text-sm font-black text-teal-700">{copy.allDistricts}<ArrowRight size={16} aria-hidden="true" /></Link>}
        />
        {activeDistricts.length ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {activeDistricts.slice(0, 6).map((district) => (
              <Link key={district.key} href={withLocale(`/busan?district=${district.key}`, locale)} className="flex min-h-16 items-center justify-between gap-2 rounded-lg bg-white px-3 py-3 text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-teal-50 focus:outline-none focus:ring-4 focus:ring-teal-100">
                <span>{district.labels[locale]}</span>
                <span className="text-xs text-slate-500">{district.count}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title={copy.noPublicPlaces}
            description={copy.noPublicPlacesDescription}
            action={<Link href={withLocale("/contact", locale)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white"><Send size={16} aria-hidden="true" />{ui[locale].common.submitPlace}</Link>}
          />
        )}
      </section>
    </main>
  );
}

export function BusanDiscoveryPage({ locale, places, guides, selectedDistrict }: BusanDiscoveryPageProps) {
  const copy = ui[locale];
  const homeCopy = homeGrowthCopy[locale];
  const districtPlaces = selectedDistrict
    ? places.filter((place) => getBusanDistrictKey(place) === selectedDistrict)
    : [];
  const filters = getHomeQuickFilters(districtPlaces, selectedDistrict);
  const intentCards = selectedDistrict
    ? resolveHomeIntentCards({ guides: [], places, locale, district: selectedDistrict })
    : [];
  const recommended = [...districtPlaces]
    .filter((place) => isVerifiedPlace(place))
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || (b.save_count ?? 0) - (a.save_count ?? 0))
    .slice(0, 4);
  const problemGuides = getProblemGuides(guides, locale).slice(0, 6);
  const courseGuides = guides
    .filter((guide) => guide.guide_type === "ITINERARY" || guide.is_featured)
    .slice(0, 4);
  const districtCounts = getDistrictCounts(places);
  const orderedDistricts = [...busanDistrictOptions].sort((a, b) => {
    const countDifference = (districtCounts.get(b.key) ?? 0) - (districtCounts.get(a.key) ?? 0);
    return countDifference || busanDistrictOptions.indexOf(a) - busanDistrictOptions.indexOf(b);
  });
  const activeDistricts = orderedDistricts.filter((district) => (districtCounts.get(district.key) ?? 0) > 0);
  const hasDistrictPlaces = districtPlaces.length > 0;

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Link href={withLocale("/", locale)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm font-bold text-teal-50 ring-1 ring-white/10">
            <ArrowLeft size={16} aria-hidden="true" />
            {districtCopy[locale].cities}
          </Link>
          {selectedDistrict ? <span className="inline-flex min-h-10 items-center rounded-lg bg-white/10 px-3 text-sm font-black text-white ring-1 ring-white/10">{getBusanDistrictLabel(selectedDistrict, locale)}</span> : null}
        </div>
        <h1 className="mt-5 max-w-lg text-3xl font-black leading-tight tracking-normal sm:text-4xl">
          {homeCopy.heading}
          <span className="mt-2 block text-xl font-semibold leading-snug text-teal-100 sm:text-2xl">{homeCopy.subheading}</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">{homeCopy.supporting}</p>
        <div className="mt-5">
          <Link
            href={withLocale("/contact", locale)}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-teal-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-200 active:scale-95"
          >
            <Send size={16} aria-hidden="true" />
            {copy.common.submitPlace}
          </Link>
        </div>
        {selectedDistrict && hasDistrictPlaces ? <div className="mt-6"><HomeSearchForm locale={locale} region={selectedDistrict} /></div> : null}
      </section>

      <section className="mt-7">
        <SectionTitle title={districtCopy[locale].title} subtitle={districtCopy[locale].subtitle} />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {orderedDistricts.map((district) => {
            const count = districtCounts.get(district.key) ?? 0;
            const active = selectedDistrict === district.key;
            return count > 0 ? (
              <Link
                key={district.key}
                href={withLocale(`/busan?district=${district.key}`, locale)}
                className={active
                  ? "flex min-h-16 items-center justify-between gap-2 rounded-lg bg-teal-700 px-3 py-3 text-sm font-black text-white ring-1 ring-teal-700"
                  : "flex min-h-16 items-center justify-between gap-2 rounded-lg bg-white px-3 py-3 text-sm font-black text-slate-800 ring-1 ring-slate-200 hover:bg-teal-50"}
              >
                <span>{district.labels[locale]}</span>
                <span className={active ? "text-xs text-teal-100" : "text-xs text-slate-400"}>{count}</span>
              </Link>
            ) : (
              <div key={district.key} aria-disabled="true" className="flex min-h-16 items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-3 text-sm font-black text-slate-400 ring-1 ring-slate-200">
                <span>{district.labels[locale]}</span>
                <span className="text-right text-[11px] font-bold">{homeCopy.preparing}<span className="block">0</span></span>
              </div>
            );
          })}
        </div>
      </section>

      {selectedDistrict && !hasDistrictPlaces ? (
        <section className="mt-7">
          <EmptyState
            title={districtEmptyCopy[locale].title}
            description={districtEmptyCopy[locale].description}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {activeDistricts.slice(0, 3).map((district) => (
                  <Link key={district.key} href={withLocale(`/busan?district=${district.key}`, locale)} className="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-4 text-sm font-black text-white">
                    {district.labels[locale]} · {districtCounts.get(district.key)}
                  </Link>
                ))}
                <Link href={withLocale("/contact", locale)} className="inline-flex min-h-11 items-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white">{copy.common.submitPlace}</Link>
              </div>
            }
          />
        </section>
      ) : null}

      {selectedDistrict && hasDistrictPlaces ? <section className="mt-7">
        <SectionTitle
          title={`${getBusanDistrictLabel(selectedDistrict, locale)} · ${homeCopy.todayTitle}`}
          subtitle={homeCopy.todaySubtitle}
          action={
            <Link href={withLocale(`/places?region=${selectedDistrict}`, locale)} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
              {copy.common.viewAll}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {intentCards.map((item) => (
            <HomeIntentCard key={item.key} item={item} copy={homeCopy} />
          ))}
        </div>
      </section> : null}

      {selectedDistrict && hasDistrictPlaces ? <section className="mt-7 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title={homeCopy.situationTitle} subtitle={copy.home.quickFiltersSubtitle} />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filters.map((filter) => (
            <QuickFilterButton
              key={filter.key}
              filterKey={filter.key}
              href={filter.href}
              enabled={filter.enabled}
              label={copy.home.quickFilters[filter.key]}
              unavailableLabel={copy.home.quickFilterUnavailable}
              locale={locale}
            />
          ))}
        </div>
      </section> : null}

      {selectedDistrict && hasDistrictPlaces && problemGuides.length ? (
        <section className="mt-7">
          <SectionTitle title={homeCopy.problemGuideTitle} subtitle={homeCopy.problemGuideSubtitle} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {problemGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      {selectedDistrict && hasDistrictPlaces ? <section className="mt-7">
        {recommended.length ? (
          <div className="space-y-4">
            <SectionTitle
              title={copy.home.recommended}
              subtitle={copy.home.recommendedSubtitle}
              action={
                <Link href={withLocale(`/places?region=${selectedDistrict}`, locale)} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
                  {copy.common.viewAll}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {recommended.map((place, index) => (
                <PlaceCard key={place.id} place={place} priority={index === 0} locale={locale} distanceMeters={distanceFromGwangalli(place)} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title={copy.home.emptyRecommendationTitle} description={copy.home.emptyRecommendationDescription} />
        )}
      </section> : null}

      {selectedDistrict && hasDistrictPlaces && courseGuides.length ? (
        <section className="mt-7">
          <SectionTitle title={homeCopy.courseTitle} subtitle={homeCopy.courseSubtitle} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {courseGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      {selectedDistrict && hasDistrictPlaces ? <section className="mt-7">
        <Link
          href={withLocale("/itinerary", locale)}
          className="group flex min-h-24 w-full flex-wrap items-center gap-4 rounded-[22px] bg-teal-700 px-4 py-4 text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-200 active:scale-[0.99] sm:flex-nowrap"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <CalendarDays size={23} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-black">{copy.home.itineraryTitle}</span>
            <span className="mt-1 block text-sm leading-5 text-teal-50">{copy.home.itineraryDescription}</span>
          </span>
          <span className="inline-flex w-full items-center justify-end gap-1 text-sm font-black sm:w-auto sm:shrink-0">
            {copy.home.itineraryCta}
            <ArrowRight size={18} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      </section> : null}
    </main>
  );
}

function getDistrictCounts(places: PlaceWithRelations[]) {
  const counts = new Map<BusanDistrictKey, number>();

  places.forEach((place) => {
    const district = getBusanDistrictKey(place);
    if (district) counts.set(district, (counts.get(district) ?? 0) + 1);
  });

  return counts;
}

type CityHomeCopy = {
  area: string;
  heading: string;
  supporting: string;
  nowWorth: string;
  nowWorthSubtitle: string;
  nowWorthEmpty: string;
  bySituation: string;
  findFromSns: string;
  buildItinerary: string;
  searchTitle: string;
  searchSubtitle: string;
  cityTitle: string;
  citySubtitle: string;
  busan: string;
  seoul: string;
  jeju: string;
  publishedPlaces: string;
  preparing: string;
  activeDistricts: string;
  activeDistrictsSubtitle: string;
  preparingDistricts: string;
  allDistricts: string;
  noPublicPlaces: string;
  noPublicPlacesDescription: string;
};

const cityHomeCopy: Record<Locale, CityHomeCopy> = {
  ko: {
    area: "현재 부산 Beta 운영 중",
    heading: "부산에서 실패하지 않는 여행",
    supporting: "지금 가도 되는지, 무엇을 주문할지, 외국인이 이용하기 쉬운지 먼저 확인하세요.",
    nowWorth: "지금 갈 만한 곳",
    nowWorthSubtitle: "광안리에서 지금 출발할 때 도착 시각이 검수된 추천 시간대와 맞는 장소입니다.",
    nowWorthEmpty: "검수된 시간대 데이터가 더 쌓이면 도착 시각 기준 추천을 표시합니다.",
    bySituation: "상황별로 찾기",
    findFromSns: "SNS에서 본 장소 찾기",
    buildItinerary: "저장한 장소로 일정 만들기",
    searchTitle: "SNS에서 본 부산 장소가 있나요?",
    searchSubtitle: "한국어·중국어 상호명이나 지역을 검색해 방문 전 핵심 정보를 확인하세요.",
    cityTitle: "서비스 운영 범위",
    citySubtitle: "브랜드는 한국 여행으로 확장하되, 현재 검수된 장소는 부산만 제공합니다.",
    busan: "부산 Beta",
    seoul: "서울",
    jeju: "제주",
    publishedPlaces: "공개 장소",
    preparing: "준비 중",
    activeDistricts: "장소가 있는 부산 지역",
    activeDistrictsSubtitle: "실제 공개·활성·검수 통과 장소가 있는 지역부터 보여드립니다.",
    preparingDistricts: "준비 중 지역",
    allDistricts: "부산 전체 보기",
    noPublicPlaces: "공개할 부산 장소를 검수 중입니다",
    noPublicPlacesDescription: "검수된 장소가 공개되기 전에는 추천 수나 지역을 부풀려 표시하지 않습니다.",
  },
  zh: {
    area: "目前运营釜山 Beta",
    heading: "在釜山旅行，少踩坑",
    supporting: "先确认现在值不值得去、该点什么，以及外国游客使用是否方便。",
    nowWorth: "现在值得去的地方",
    nowWorthSubtitle: "从广安里现在出发，预计到达时间符合已审核推荐时段的地点。",
    nowWorthEmpty: "审核后的时段数据增加后，将显示按到达时间计算的推荐。",
    bySituation: "按旅行场景找",
    findFromSns: "查找社交平台看到的店",
    buildItinerary: "用收藏地点做行程",
    searchTitle: "在小红书看到釜山地点了吗？",
    searchSubtitle: "用中文、韩文店名或地区搜索，出发前先确认关键信息。",
    cityTitle: "当前服务范围",
    citySubtitle: "品牌可扩展到韩国旅行，但目前只提供经过审核的釜山地点。",
    busan: "釜山 Beta",
    seoul: "首尔",
    jeju: "济州",
    publishedPlaces: "公开地点",
    preparing: "准备中",
    activeDistricts: "已有地点的釜山地区",
    activeDistrictsSubtitle: "优先显示已有公开、启用并通过审核地点的地区。",
    preparingDistricts: "准备中地区",
    allDistricts: "查看釜山全部地区",
    noPublicPlaces: "正在审核可公开的釜山地点",
    noPublicPlacesDescription: "地点通过审核前，不会夸大推荐数量或可用地区。",
  },
  en: {
    area: "Busan Beta is live",
    heading: "Make fewer mistakes in Busan",
    supporting: "Check whether a place is worth going now, what to order, and how easy it is for international travelers.",
    nowWorth: "Worth going now",
    nowWorthSubtitle: "Places whose reviewed recommendation window matches an estimated departure from Gwangalli now.",
    nowWorthEmpty: "Arrival-time recommendations will appear as reviewed time data grows.",
    bySituation: "Find by situation",
    findFromSns: "Find a place from social media",
    buildItinerary: "Plan with saved places",
    searchTitle: "Found a Busan place on social media?",
    searchSubtitle: "Search its Korean or translated name and check the essentials before you go.",
    cityTitle: "Current coverage",
    citySubtitle: "The brand can grow across Korea, but reviewed place coverage is currently limited to Busan.",
    busan: "Busan Beta",
    seoul: "Seoul",
    jeju: "Jeju",
    publishedPlaces: "Published places",
    preparing: "Coming later",
    activeDistricts: "Busan districts with places",
    activeDistrictsSubtitle: "Districts with published, active, reviewed places appear first.",
    preparingDistricts: "Districts preparing",
    allDistricts: "View all Busan districts",
    noPublicPlaces: "Busan places are under review",
    noPublicPlacesDescription: "We do not inflate recommendations or coverage before places pass review.",
  },
  ja: {
    area: "現在は釜山 Beta を運営中",
    heading: "釜山で失敗しない旅",
    supporting: "今行く価値があるか、何を注文するか、外国人にも利用しやすいかを先に確認できます。",
    nowWorth: "今行く価値がある場所",
    nowWorthSubtitle: "広安里から今出発した場合、到着予想時刻が確認済みの推奨時間帯に合う場所です。",
    nowWorthEmpty: "確認済み時間帯データが増えると、到着時刻基準のおすすめを表示します。",
    bySituation: "状況別に探す",
    findFromSns: "SNSで見た場所を探す",
    buildItinerary: "保存スポットで旅程作成",
    searchTitle: "SNSで見た釜山スポットがありますか？",
    searchSubtitle: "韓国語・翻訳名・地域で検索し、訪問前に大切な情報を確認してください。",
    cityTitle: "現在のサービス範囲",
    citySubtitle: "韓国旅行へ拡張できるブランドですが、現在の審査済みスポットは釜山のみです。",
    busan: "釜山 Beta",
    seoul: "ソウル",
    jeju: "済州",
    publishedPlaces: "公開スポット",
    preparing: "準備中",
    activeDistricts: "スポットがある釜山エリア",
    activeDistrictsSubtitle: "公開・有効・審査済みスポットがある地域から表示します。",
    preparingDistricts: "準備中の地域",
    allDistricts: "釜山の全地域を見る",
    noPublicPlaces: "公開できる釜山スポットを審査中です",
    noPublicPlacesDescription: "審査前におすすめ数や対応地域を多く見せることはありません。",
  },
};

const districtEmptyCopy: Record<Locale, { title: string; description: string }> = {
  ko: { title: "이 지역은 아직 준비 중입니다", description: "장소가 있는 인접 지역을 보거나, 알고 있는 장소를 제보해 주세요." },
  zh: { title: "这个地区还在准备中", description: "可以先查看已有地点的附近地区，或提交你知道的地点。" },
  en: { title: "This district is still being prepared", description: "Browse a nearby district with published places, or submit one you know." },
  ja: { title: "この地域はまだ準備中です", description: "スポットがある近隣エリアを見るか、知っている場所を投稿してください。" },
};

const districtCopy: Record<Locale, { cities: string; title: string; subtitle: string }> = {
  ko: { cities: "도시 선택", title: "부산 지역 선택", subtitle: "먼저 방문할 구·군을 선택하세요." },
  zh: { cities: "选择城市", title: "选择釜山地区", subtitle: "请先选择要去的区或郡。" },
  en: { cities: "Cities", title: "Choose a Busan district", subtitle: "Select the district you plan to visit first." },
  ja: { cities: "都市選択", title: "釜山の地域を選択", subtitle: "先に訪れる区・郡を選んでください。" },
};

const homeGrowthCopy: Record<Locale, {
  heading: string;
  subheading: string;
  supporting: string;
  todayTitle: string;
  todaySubtitle: string;
  situationTitle: string;
  problemGuideTitle: string;
  problemGuideSubtitle: string;
  courseTitle: string;
  courseSubtitle: string;
  guideReady: string;
  placesReady: string;
  preparing: string;
}> = {
  zh: {
    heading: "现在去釜山，先解决眼前这件事。",
    subheading: "吃什么、去哪玩、下雨怎么办，到店前先看清楚。",
    supporting: "从旅行问题进入，再看相关地点、收藏到釜山清单，到了当地可以直接打开地图确认。",
    todayTitle: "今天在釜山怎么玩？",
    todaySubtitle: "按常见搜索问题进入，不用从一堆地点里慢慢翻。",
    situationTitle: "按现在的情况找",
    problemGuideTitle: "大家来釜山前最常查",
    problemGuideSubtitle: "每篇都连接已确认地点，不做空泛攻略。",
    courseTitle: "推荐旅行路线",
    courseSubtitle: "收藏路线后，到釜山可以直接照着走。",
    guideReady: "指南",
    placesReady: "地点",
    preparing: "准备中",
  },
  en: {
    heading: "Start with the Busan problem you need to solve now.",
    subheading: "Food, first-time routes, rainy days, luggage, and late-night choices.",
    supporting: "Open a guide, compare linked places, save what matters, then reopen your Busan list on the road.",
    todayTitle: "What should I do in Busan today?",
    todaySubtitle: "Start from a travel intent instead of scrolling through every place.",
    situationTitle: "Search by situation",
    problemGuideTitle: "Common Busan questions",
    problemGuideSubtitle: "Guides stay connected to verified places.",
    courseTitle: "Recommended courses",
    courseSubtitle: "Save a course and reopen it in Busan.",
    guideReady: "Guide",
    placesReady: "Places",
    preparing: "Preparing",
  },
  ja: {
    heading: "今の釜山旅行で必要な情報から探す。",
    subheading: "食事、初めてのエリア、雨の日、荷物、夜の行き先まで。",
    supporting: "旅行の悩みから入り、関連スポットを見て保存し、現地で釜山リストと地図を開けます。",
    todayTitle: "今日、釜山で何をする？",
    todaySubtitle: "スポット一覧を眺める前に、目的別に探せます。",
    situationTitle: "今の状況で探す",
    problemGuideTitle: "釜山旅行前によく調べること",
    problemGuideSubtitle: "確認済みスポットとつながったガイドです。",
    courseTitle: "おすすめ旅行コース",
    courseSubtitle: "保存しておくと釜山でまた確認できます。",
    guideReady: "ガイド",
    placesReady: "スポット",
    preparing: "準備中",
  },
  ko: {
    heading: "지금 필요한 부산 여행 정보부터 찾으세요.",
    subheading: "맛집, 첫 방문, 비 오는 날, 짐 보관, 늦은 밤 갈 곳까지.",
    supporting: "여행 문제에서 출발해 관련 장소를 보고 저장한 뒤, 부산 현지에서 리스트와 지도로 다시 확인합니다.",
    todayTitle: "오늘 부산에서 뭐 하지?",
    todaySubtitle: "장소 전체를 훑기 전에 여행 의도별로 바로 들어가세요.",
    situationTitle: "상황별로 찾기",
    problemGuideTitle: "부산 여행 전 많이 찾는 정보",
    problemGuideSubtitle: "실제 장소 DB와 연결된 공식 가이드입니다.",
    courseTitle: "추천 여행 코스",
    courseSubtitle: "코스를 저장해두면 부산에서 바로 다시 볼 수 있습니다.",
    guideReady: "가이드",
    placesReady: "장소",
    preparing: "준비 중",
  },
};

function HomeIntentCard({
  item,
  copy,
}: {
  item: ResolvedHomeIntentCard;
  copy: (typeof homeGrowthCopy)[Locale];
}) {
  const status = item.destination === "guide" ? copy.guideReady : item.destination === "places" ? copy.placesReady : copy.preparing;
  const content = (
    <>
      <span className="flex min-w-0 flex-wrap items-start gap-2">
        <span className="min-w-0 flex-1 break-words text-base font-black leading-5">{item.label}</span>
        <span className="max-w-full shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
          {status}
        </span>
      </span>
      <span className="mt-2 block break-words text-sm leading-5 text-slate-500">{item.description}</span>
    </>
  );

  if (!item.href) {
    return (
      <div
        aria-disabled="true"
        className="flex min-h-28 flex-col justify-between rounded-[22px] bg-slate-50 p-4 text-slate-500 shadow-sm ring-1 ring-slate-200"
      >
        <span className="min-w-0">{content}</span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className="group flex min-h-28 flex-col justify-between rounded-[22px] bg-white p-4 text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-teal-50 focus:outline-none focus:ring-4 focus:ring-teal-100 active:scale-[0.99]"
    >
      <span className="min-w-0">{content}</span>
      <span className="mt-3 inline-flex justify-end text-teal-700">
        <ArrowRight size={18} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

function QuickFilterButton({
  filterKey,
  href,
  enabled,
  label,
  unavailableLabel,
  locale,
}: {
  filterKey: HomeQuickFilterKey;
  href: string;
  enabled: boolean;
  label: string;
  unavailableLabel: string;
  locale: Locale;
}) {
  const Icon = quickFilterIcons[filterKey];
  const className =
    "inline-flex min-h-12 items-center gap-2 rounded-2xl px-3 text-left text-sm font-black ring-1 transition focus:outline-none focus:ring-4 focus:ring-teal-100 active:scale-95";

  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        title={unavailableLabel}
        aria-label={`${label} - ${unavailableLabel}`}
        className={`${className} cursor-not-allowed bg-slate-50 text-slate-400 ring-slate-200`}
      >
        <Icon size={17} aria-hidden="true" />
        <span className="min-w-0">{label}</span>
      </button>
    );
  }

  return (
    <Link href={withLocale(href, locale)} className={`${className} bg-white text-slate-800 ring-slate-200 hover:bg-teal-50 hover:text-teal-800 hover:ring-teal-100`}>
      <Icon size={17} aria-hidden="true" />
      <span className="min-w-0">{label}</span>
    </Link>
  );
}
