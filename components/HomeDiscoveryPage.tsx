import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  CloudRain,
  Languages,
  Luggage,
  MapPin,
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
import { getHomeQuickFilters, type HomeQuickFilterKey } from "@/lib/home-discovery";
import { guideContent, guideCopy } from "@/lib/guide-copy";
import { type Locale, ui, withLocale } from "@/lib/i18n";
import { distanceFromGwangalli, isNearGwangalli } from "@/lib/place-display";
import type { PlaceWithRelations } from "@/types/database";
import type { Guide } from "@/types/guide";

type HomeDiscoveryPageProps = {
  locale: Locale;
  places: PlaceWithRelations[];
  guides: Guide[];
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

export function HomeDiscoveryPage({ locale, places, guides }: HomeDiscoveryPageProps) {
  const copy = ui[locale];
  const homeCopy = homeGrowthCopy[locale];
  const guideText = guideCopy[locale];
  const filters = getHomeQuickFilters(places);
  const recommended = [...places]
    .filter(isNearGwangalli)
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
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-teal-50 ring-1 ring-white/10">
            <MapPin size={15} aria-hidden="true" />
            {copy.home.area}
          </div>
          <button
            type="button"
            disabled
            title={copy.home.areaNote}
            className="inline-flex h-9 items-center justify-center rounded-full bg-white/10 px-3 text-xs font-black text-slate-300 ring-1 ring-white/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {copy.home.areaAction}
          </button>
        </div>
        <p id="home-region-note" className="mt-3 max-w-md text-xs leading-5 text-teal-100">
          {copy.home.areaNote}
        </p>
        <h1 className="mt-5 max-w-lg text-3xl font-black leading-tight tracking-normal sm:text-4xl">
          {homeCopy.heading}
          <span className="mt-2 block text-xl font-semibold leading-snug text-teal-100 sm:text-2xl">{homeCopy.subheading}</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">{homeCopy.supporting}</p>
        <div className="mt-6">
          <HomeSearchForm locale={locale} />
        </div>
      </section>

      <section className="mt-7">
        <SectionTitle
          title={homeCopy.todayTitle}
          subtitle={homeCopy.todaySubtitle}
          action={
            <Link href={withLocale("/guides", locale)} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
              {guideText.all}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {homeProblemCards[locale].map((item) => {
            const matchedGuide = findGuideByTerms(guides, locale, item.terms);
            const href = matchedGuide ? `/guides/${matchedGuide.slug}` : `/guides?search=${encodeURIComponent(item.search)}`;

            return (
              <Link
                key={item.label}
                href={withLocale(href, locale)}
                className="flex min-h-20 items-center justify-between gap-3 rounded-[22px] bg-white p-4 text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-teal-50 active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block text-base font-black">{item.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{item.description}</span>
                </span>
                <ArrowRight size={18} className="shrink-0 text-teal-700" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-7 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
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
      </section>

      {problemGuides.length ? (
        <section className="mt-7">
          <SectionTitle title={homeCopy.problemGuideTitle} subtitle={homeCopy.problemGuideSubtitle} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {problemGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-7">
        {recommended.length ? (
          <div className="space-y-4">
            <SectionTitle
              title={copy.home.recommended}
              subtitle={copy.home.recommendedSubtitle}
              action={
                <Link href={withLocale("/places", locale)} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
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
      </section>

      {courseGuides.length ? (
        <section className="mt-7">
          <SectionTitle title={homeCopy.courseTitle} subtitle={homeCopy.courseSubtitle} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {courseGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-7">
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
      </section>
    </main>
  );
}

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
  },
};

const homeProblemCards: Record<Locale, Array<{ label: string; description: string; search: string; terms: string[] }>> = {
  zh: [
    { label: "第一次去广安里怎么玩", description: "海边、晚餐、咖啡和拍照点一起看。", search: "广安里 第一次", terms: ["광안리", "처음", "广安里", "第一次"] },
    { label: "广安里好吃的店", description: "先看适合中国游客的菜单和等待信息。", search: "광안리 맛집", terms: ["광안리", "맛집", "广安里", "美食"] },
    { label: "釜山下雨天去哪", description: "雨天也方便移动的室内路线。", search: "비 오는 날", terms: ["비", "雨", "실내", "室内"] },
    { label: "一个人去釜山安全吗", description: "独自旅行、晚间移动和用餐重点。", search: "여자 혼자 여행", terms: ["혼자", "女", "solo", "一个人"] },
    { label: "晚上10点以后去哪", description: "夜间还能去的区域和地点。", search: "밤 10시", terms: ["밤", "10", "夜", "late"] },
    { label: "行李寄存在哪里", description: "先存行李，再轻松逛海边和商圈。", search: "짐 보관", terms: ["짐", "行李", "luggage"] },
  ],
  en: [
    { label: "First time in Gwangalli", description: "Beach, dinner, cafes, and photo stops.", search: "Gwangalli first time", terms: ["gwangalli", "first", "광안리"] },
    { label: "Gwangalli food", description: "Menus, wait times, and nearby picks.", search: "Gwangalli food", terms: ["food", "맛집", "美食"] },
    { label: "Rainy day in Busan", description: "Indoor-friendly stops and routes.", search: "rainy day", terms: ["rain", "비", "雨"] },
    { label: "Solo Busan travel", description: "Meals and routes that work alone.", search: "solo travel", terms: ["solo", "혼자", "一个人"] },
    { label: "After 10 PM", description: "Late-night options by area.", search: "after 10", terms: ["night", "10", "밤"] },
    { label: "Luggage storage", description: "Store bags before exploring.", search: "luggage", terms: ["luggage", "짐", "行李"] },
  ],
  ja: [
    { label: "初めての広安里", description: "海、夕食、カフェ、写真スポットを確認。", search: "広安里 初めて", terms: ["광안리", "広安里", "처음"] },
    { label: "広安里グルメ", description: "メニューと待ち時間を先に確認。", search: "広安里 グルメ", terms: ["맛집", "グルメ", "food"] },
    { label: "雨の日の釜山", description: "移動しやすい屋内中心の行き先。", search: "雨の日", terms: ["雨", "비", "indoor"] },
    { label: "一人旅の釜山", description: "一人でも使いやすい食事と移動。", search: "一人旅", terms: ["一人", "혼자", "solo"] },
    { label: "夜10時以降", description: "夜に確認したいエリアとスポット。", search: "夜10時", terms: ["夜", "10", "밤"] },
    { label: "荷物預かり", description: "荷物を預けて身軽に動く。", search: "荷物", terms: ["荷物", "짐", "luggage"] },
  ],
  ko: [
    { label: "광안리 처음 가면?", description: "바다, 저녁, 카페, 사진 스팟을 한 번에 확인.", search: "광안리 처음", terms: ["광안리", "처음", "첫"] },
    { label: "광안리 맛집", description: "메뉴, 웨이팅, 중국어 메뉴 여부를 먼저 확인.", search: "광안리 맛집", terms: ["광안리", "맛집", "음식"] },
    { label: "부산 비 오는 날", description: "이동이 편한 실내 중심 코스.", search: "비 오는 날", terms: ["비", "실내", "rain"] },
    { label: "부산 여자 혼자 여행", description: "혼자 먹기와 밤 이동을 고려한 정보.", search: "여자 혼자 여행", terms: ["혼자", "여자", "solo"] },
    { label: "밤 10시 이후 갈 곳", description: "늦은 시간에도 확인할 수 있는 장소.", search: "밤 10시", terms: ["밤", "10", "야간"] },
    { label: "부산 짐 보관", description: "짐을 맡기고 가볍게 움직이는 동선.", search: "짐 보관", terms: ["짐", "보관", "luggage"] },
  ],
};

function getProblemGuides(guides: Guide[], locale: Locale) {
  return [...guides]
    .filter((guide) => guide.guide_type !== "PRACTICAL" || guide.is_featured)
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order)
    .filter((guide) => {
      const text = buildGuideSearchText(guide, locale);
      return homeProblemCards[locale].some((card) => card.terms.some((term) => text.includes(term.toLowerCase())));
    });
}

function findGuideByTerms(guides: Guide[], locale: Locale, terms: string[]) {
  return guides.find((guide) => {
    const text = buildGuideSearchText(guide, locale);
    return terms.some((term) => text.includes(term.toLowerCase()));
  });
}

function buildGuideSearchText(guide: Guide, locale: Locale) {
  const content = guideContent(guide, locale);
  return `${content.title} ${content.description} ${guide.title_ko} ${guide.title_zh} ${guide.area} ${guide.recommended_for[locale] ?? ""}`.toLowerCase();
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
