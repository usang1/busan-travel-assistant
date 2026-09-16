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
        <div className="mt-4 space-y-4">
          {cityRegionGroups.map((city) => (
            <CityRegionGroup key={city.key} locale={locale} city={city} />
          ))}
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

type CityRegion = {
  key: string;
  labels: Record<Locale, string>;
  href: string;
};

type CityRegionGroupItem = {
  key: string;
  labels: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  cityHref?: string;
  regions: CityRegion[];
};

function CityRegionGroup({ locale, city }: { locale: Locale; city: CityRegionGroupItem }) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-lg bg-slate-100 text-slate-700"><Building2 size={21} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black text-slate-950">{city.labels[locale]}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{city.subtitle[locale]}</p>
        </div>
        {city.cityHref ? (
          <Link href={withLocale(city.cityHref, locale)} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-black text-teal-700 hover:bg-teal-50">
            {cityHomeCopy[locale].viewCity}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {city.regions.map((region) => (
          <Link
            key={region.key}
            href={withLocale(region.href, locale)}
            className="flex min-h-14 items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-3 text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-teal-50 hover:text-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-100"
          >
            <span>{region.labels[locale]}</span>
            <ArrowRight size={15} className="shrink-0 text-teal-700" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

const seoulDistricts = [
  region("gangnam-gu", "강남구", "江南区", "Gangnam-gu", "江南区"),
  region("gangdong-gu", "강동구", "江东区", "Gangdong-gu", "江東区"),
  region("gangbuk-gu", "강북구", "江北区", "Gangbuk-gu", "江北区"),
  region("gangseo-gu", "강서구", "江西区", "Gangseo-gu", "江西区"),
  region("gwanak-gu", "관악구", "冠岳区", "Gwanak-gu", "冠岳区"),
  region("gwangjin-gu", "광진구", "广津区", "Gwangjin-gu", "広津区"),
  region("guro-gu", "구로구", "九老区", "Guro-gu", "九老区"),
  region("geumcheon-gu", "금천구", "衿川区", "Geumcheon-gu", "衿川区"),
  region("nowon-gu", "노원구", "芦原区", "Nowon-gu", "蘆原区"),
  region("dobong-gu", "도봉구", "道峰区", "Dobong-gu", "道峰区"),
  region("dongdaemun-gu", "동대문구", "东大门区", "Dongdaemun-gu", "東大門区"),
  region("dongjak-gu", "동작구", "铜雀区", "Dongjak-gu", "銅雀区"),
  region("mapo-gu", "마포구", "麻浦区", "Mapo-gu", "麻浦区"),
  region("seodaemun-gu", "서대문구", "西大门区", "Seodaemun-gu", "西大門区"),
  region("seocho-gu", "서초구", "瑞草区", "Seocho-gu", "瑞草区"),
  region("seongdong-gu", "성동구", "城东区", "Seongdong-gu", "城東区"),
  region("seongbuk-gu", "성북구", "城北区", "Seongbuk-gu", "城北区"),
  region("songpa-gu", "송파구", "松坡区", "Songpa-gu", "松坡区"),
  region("yangcheon-gu", "양천구", "阳川区", "Yangcheon-gu", "陽川区"),
  region("yeongdeungpo-gu", "영등포구", "永登浦区", "Yeongdeungpo-gu", "永登浦区"),
  region("yongsan-gu", "용산구", "龙山区", "Yongsan-gu", "龍山区"),
  region("eunpyeong-gu", "은평구", "恩平区", "Eunpyeong-gu", "恩平区"),
  region("jongno-gu", "종로구", "钟路区", "Jongno-gu", "鐘路区"),
  region("jung-gu", "중구", "中区", "Jung-gu", "中区"),
  region("jungnang-gu", "중랑구", "中浪区", "Jungnang-gu", "中浪区"),
];

const jejuRegions = [
  { key: "jeju-si", labels: { ko: "제주시", zh: "济州市", en: "Jeju City", ja: "済州市" }, searchKo: "제주시" },
  { key: "seogwipo-si", labels: { ko: "서귀포시", zh: "西归浦市", en: "Seogwipo", ja: "西帰浦市" }, searchKo: "서귀포시" },
];

const cityRegionGroups: CityRegionGroupItem[] = [
  {
    key: "seoul",
    labels: { ko: "서울", zh: "首尔", en: "Seoul", ja: "ソウル" },
    subtitle: { ko: "25개 구 중 방문할 지역을 선택하세요.", zh: "从25个区中选择要去的地区。", en: "Choose one of Seoul's 25 districts.", ja: "25区から訪問エリアを選択。" },
    regions: seoulDistricts.map((district) => ({
      key: district.key,
      labels: district.labels,
      href: `/places?search=${encodeURIComponent(`서울 ${district.labels.ko}`)}`,
    })),
  },
  {
    key: "jeju",
    labels: { ko: "제주", zh: "济州", en: "Jeju", ja: "済州" },
    subtitle: { ko: "제주시와 서귀포시로 나눠서 찾아보세요.", zh: "按济州市和西归浦市查找。", en: "Browse by Jeju City or Seogwipo.", ja: "済州市と西帰浦市で探せます。" },
    regions: jejuRegions.map((region) => ({
      key: region.key,
      labels: region.labels,
      href: `/places?search=${encodeURIComponent(region.searchKo)}`,
    })),
  },
  {
    key: "busan",
    labels: { ko: "부산", zh: "釜山", en: "Busan", ja: "釜山" },
    subtitle: { ko: "기존 부산 구·군 카드로 바로 이동합니다.", zh: "直接按釜山区或郡查看。", en: "Open the existing Busan district cards.", ja: "既存の釜山区・郡カードへ移動します。" },
    cityHref: "/busan",
    regions: busanDistrictOptions.map((district) => ({
      key: district.key,
      labels: district.labels,
      href: `/busan?district=${district.key}`,
    })),
  },
];

function region(key: string, ko: string, zh: string, en: string, ja: string): CityRegion {
  return { key, labels: { ko, zh, en, ja }, href: "" };
}

const cityHomeCopy: Record<Locale, { area: string; heading: string; supporting: string; cityTitle: string; citySubtitle: string; viewCity: string }> = {
  ko: { area: "한국 여행", heading: "어느 도시로 여행하시나요?", supporting: "도시를 선택한 뒤 지역과 여행 상황에 맞는 장소를 찾아보세요.", cityTitle: "도시 선택", citySubtitle: "서울·제주·부산을 세부 지역 카드로 선택하세요.", viewCity: "전체" },
  zh: { area: "韩国旅行", heading: "这次要去哪个城市？", supporting: "选择城市后，再按地区和旅行场景查找地点。", cityTitle: "选择城市", citySubtitle: "按首尔、济州、釜山的细分地区选择。", viewCity: "全部" },
  en: { area: "Korea travel", heading: "Which city are you visiting?", supporting: "Choose a city, then find places by district and travel situation.", cityTitle: "Choose a city", citySubtitle: "Pick Seoul, Jeju, or Busan by smaller local area.", viewCity: "All" },
  ja: { area: "韓国旅行", heading: "どの都市へ旅行しますか？", supporting: "都市を選び、地域と旅行シーンに合うスポットを探せます。", cityTitle: "都市を選択", citySubtitle: "ソウル・済州・釜山を細かい地域カードから選べます。", viewCity: "全体" },
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
