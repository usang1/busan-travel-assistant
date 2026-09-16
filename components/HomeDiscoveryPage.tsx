import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Clock3,
  CloudRain,
  Languages,
  Luggage,
  MapPin,
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
import { isVerifiedPlace } from "@/lib/place-publication-quality";
import type { PlaceWithRelations } from "@/types/database";
import type { Guide } from "@/types/guide";

type HomeDiscoveryPageProps = {
  locale: Locale;
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

export function HomeDiscoveryPage({ locale }: HomeDiscoveryPageProps) {
  const copy = cityHomeCopy[locale];
  const commonCopy = ui[locale].common;

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <section className="bg-slate-950 px-5 py-7 text-white shadow-xl shadow-teal-900/10 sm:px-6">
        <div className="inline-flex items-center gap-2 text-sm font-bold text-teal-100">
          <MapPin size={16} aria-hidden="true" />
          {copy.area}
        </div>
        <h1 className="mt-5 max-w-lg text-3xl font-black leading-tight tracking-normal sm:text-4xl">{copy.heading}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">{copy.supporting}</p>
        <div className="mt-5">
          <Link
            href={withLocale("/contact", locale)}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-teal-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-200 active:scale-95"
          >
            <Send size={17} aria-hidden="true" />
            {commonCopy.submitPlace}
          </Link>
        </div>
      </section>

      <section className="mt-7">
        <SectionTitle title={copy.cityTitle} subtitle={copy.citySubtitle} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <CityCard locale={locale} city="seoul" label={copy.seoul} enabled={false} preparing={copy.preparing} />
          <CityCard locale={locale} city="jeju" label={copy.jeju} enabled={false} preparing={copy.preparing} />
          <CityCard locale={locale} city="busan" label={copy.busan} enabled preparing={copy.available} />
        </div>
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
        {selectedDistrict ? <div className="mt-6"><HomeSearchForm locale={locale} region={selectedDistrict} /></div> : null}
      </section>

      <section className="mt-7">
        <SectionTitle title={districtCopy[locale].title} subtitle={districtCopy[locale].subtitle} />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {busanDistrictOptions.map((district) => {
            const count = places.filter((place) => getBusanDistrictKey(place) === district.key).length;
            const active = selectedDistrict === district.key;
            return (
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
            );
          })}
        </div>
      </section>

      {selectedDistrict ? <section className="mt-7">
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

      {selectedDistrict ? <section className="mt-7 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
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

      {selectedDistrict && problemGuides.length ? (
        <section className="mt-7">
          <SectionTitle title={homeCopy.problemGuideTitle} subtitle={homeCopy.problemGuideSubtitle} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {problemGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      {selectedDistrict ? <section className="mt-7">
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

      {selectedDistrict && courseGuides.length ? (
        <section className="mt-7">
          <SectionTitle title={homeCopy.courseTitle} subtitle={homeCopy.courseSubtitle} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {courseGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      {selectedDistrict ? <section className="mt-7">
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

type CityKey = "seoul" | "jeju" | "busan";

function CityCard({ locale, city, label, enabled, preparing }: { locale: Locale; city: CityKey; label: string; enabled: boolean; preparing: string }) {
  const content = (
    <>
      <span className="grid size-11 place-items-center rounded-lg bg-slate-100 text-slate-700"><Building2 size={21} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1 text-xl font-black">{label}</span>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{preparing}</span>
    </>
  );

  if (!enabled) {
    return <div aria-disabled="true" className="flex min-h-24 items-center gap-3 rounded-lg bg-slate-50 p-4 text-slate-500 ring-1 ring-slate-200">{content}</div>;
  }

  return (
    <Link href={withLocale(`/${city}`, locale)} className="flex min-h-24 items-center gap-3 rounded-lg bg-white p-4 text-slate-950 shadow-sm ring-1 ring-slate-200 hover:bg-teal-50 focus:outline-none focus:ring-4 focus:ring-teal-100">
      {content}
      <ArrowRight size={18} className="shrink-0 text-teal-700" aria-hidden="true" />
    </Link>
  );
}

const cityHomeCopy: Record<Locale, { area: string; heading: string; supporting: string; cityTitle: string; citySubtitle: string; seoul: string; jeju: string; busan: string; preparing: string; available: string }> = {
  ko: { area: "한국 여행", heading: "어느 도시로 여행하시나요?", supporting: "도시를 선택한 뒤 지역과 여행 상황에 맞는 장소를 찾아보세요.", cityTitle: "도시 선택", citySubtitle: "현재 부산 지역 정보를 먼저 제공합니다.", seoul: "서울", jeju: "제주", busan: "부산", preparing: "준비 중", available: "이용 가능" },
  zh: { area: "韩国旅行", heading: "这次要去哪个城市？", supporting: "选择城市后，再按地区和旅行场景查找地点。", cityTitle: "选择城市", citySubtitle: "目前优先提供釜山地区信息。", seoul: "首尔", jeju: "济州", busan: "釜山", preparing: "准备中", available: "可使用" },
  en: { area: "Korea travel", heading: "Which city are you visiting?", supporting: "Choose a city, then find places by district and travel situation.", cityTitle: "Choose a city", citySubtitle: "Busan district information is available first.", seoul: "Seoul", jeju: "Jeju", busan: "Busan", preparing: "Preparing", available: "Available" },
  ja: { area: "韓国旅行", heading: "どの都市へ旅行しますか？", supporting: "都市を選び、地域と旅行シーンに合うスポットを探せます。", cityTitle: "都市を選択", citySubtitle: "現在は釜山エリアの情報を先に提供しています。", seoul: "ソウル", jeju: "済州", busan: "釜山", preparing: "準備中", available: "利用可能" },
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
