"use client";

import Link from "next/link";
import { CalendarDays, CloudRain, Crown, RefreshCw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useProEntitlement } from "@/components/ProEntitlementProvider";
import { ShareButton } from "@/components/ShareButton";
import { TagChip } from "@/components/TagChip";
import type { Locale } from "@/lib/i18n";
import {
  generateItineraryFromDb,
  type GeneratedItinerary,
  type ItineraryInterest,
  type ItineraryPreferences,
  type TravelStyle,
} from "@/lib/ai/itinerary-generator";
import { getOpeningStatusLabel } from "@/lib/location";
import type { PlaceWithRelations } from "@/types/database";

type ItineraryPlannerProps = {
  places: PlaceWithRelations[];
  locale?: Locale;
};

const interestOptions: Array<{ id: ItineraryInterest; label: Record<Locale, string> }> = [
  { id: "food", label: { zh: "美食", en: "Food", ja: "グルメ", ko: "맛집" } },
  { id: "cafe", label: { zh: "咖啡", en: "Cafes", ja: "カフェ", ko: "카페" } },
  { id: "photo", label: { zh: "拍照", en: "Photos", ja: "写真", ko: "사진" } },
  { id: "shopping", label: { zh: "购物", en: "Shopping", ja: "買い物", ko: "쇼핑" } },
  { id: "sea", label: { zh: "大海", en: "Sea", ja: "海", ko: "바다" } },
  { id: "nightlife", label: { zh: "夜生活", en: "Nightlife", ja: "夜", ko: "야간" } },
];

const styleOptions: Array<{ id: TravelStyle; label: Record<Locale, string> }> = [
  { id: "relaxed", label: { zh: "轻松", en: "Relaxed", ja: "ゆったり", ko: "여유" } },
  { id: "normal", label: { zh: "普通", en: "Balanced", ja: "普通", ko: "보통" } },
  { id: "packed", label: { zh: "充实", en: "Packed", ja: "充実", ko: "빡빡하게" } },
];

function defaultPreferences(locale: Locale): ItineraryPreferences {
  return {
    days: 1,
    lodging: locale === "zh" ? "广安里" : "광안리",
    people: 2,
    budget: "medium",
    interests: ["food", "cafe", "photo", "sea"],
    style: "normal",
    rainyAlternative: false,
  };
}

export function ItineraryPlanner({ places, locale = "zh" }: ItineraryPlannerProps) {
  const copy = itineraryCopy[locale];
  const { isPro } = useProEntitlement();
  const [preferences, setPreferences] = useState<ItineraryPreferences>(() => defaultPreferences(locale));
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [message, setMessage] = useState("");
  const [generationCount, setGenerationCount] = useState(0);

  const proRequired = preferences.days > 1 || preferences.rainyAlternative;
  const canGenerate = !proRequired || isPro;
  const canRegenerate = generationCount === 0 || isPro;

  const savedItineraries = useMemo(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      return JSON.parse(window.localStorage.getItem("busan-travel-assistant-saved-itineraries") ?? "[]") as GeneratedItinerary[];
    } catch {
      return [];
    }
  }, []);

  function updatePreferences(patch: Partial<ItineraryPreferences>) {
    setPreferences((current) => ({ ...current, ...patch }));
  }

  function toggleInterest(interest: ItineraryInterest) {
    setPreferences((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }));
  }

  async function generate() {
    if (!canGenerate) {
      setMessage(copy.proRequired);
      return;
    }

    if (!canRegenerate) {
      setMessage(copy.regeneratePro);
      return;
    }

    const next = await generateItineraryFromDb(places, preferences);
    setItinerary(next);
    setGenerationCount((count) => count + 1);
    setMessage(next.source === "rule_based" ? copy.generatedByRules : "");
  }

  function saveItinerary() {
    if (!itinerary) {
      return;
    }

    if (!isPro) {
      setMessage(copy.savePro);
      return;
    }

    const nextSaved = [itinerary, ...savedItineraries].slice(0, 10);
    window.localStorage.setItem("busan-travel-assistant-saved-itineraries", JSON.stringify(nextSaved));
    setMessage(copy.saved);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-teal-100 ring-1 ring-white/10">
          <CalendarDays size={16} aria-hidden="true" />
          AI-ready itinerary
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal">{copy.hero}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">{copy.description}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-bold">
          <Crown size={16} aria-hidden="true" />
          {isPro ? copy.proEnabled : copy.freePlan}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.days}>
            <select
              value={preferences.days}
              onChange={(event) => updatePreferences({ days: Number(event.target.value) })}
              className={inputClass}
            >
              {[1, 2, 3].map((day) => (
                <option key={day} value={day}>
                  {day}{copy.daySuffix}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.lodging}>
            <input value={preferences.lodging} onChange={(event) => updatePreferences({ lodging: event.target.value })} className={inputClass} />
          </Field>
          <Field label={copy.people}>
            <select
              value={preferences.people}
              onChange={(event) => updatePreferences({ people: Number(event.target.value) })}
              className={inputClass}
            >
              {[1, 2, 3, 4].map((people) => (
                <option key={people} value={people}>
                  {people === 4 ? `4${copy.peopleSuffix}+` : `${people}${copy.peopleSuffix}`}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.budget}>
            <select
              value={preferences.budget}
              onChange={(event) => updatePreferences({ budget: event.target.value as ItineraryPreferences["budget"] })}
              className={inputClass}
            >
              <option value="low">{copy.budgetLow}</option>
              <option value="medium">{copy.budgetMedium}</option>
              <option value="high">{copy.budgetHigh}</option>
            </select>
          </Field>
        </div>

        <div className="mt-5">
          <p className="font-black text-slate-950">{copy.interests}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {interestOptions.map((option) => {
              const active = preferences.interests.includes(option.id);

              return (
                <button key={option.id} type="button" onClick={() => toggleInterest(option.id)} className="active:scale-95">
                  <TagChip tone={active ? "green" : "default"}>
                    {option.label[locale]}
                  </TagChip>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="font-black text-slate-950">{copy.style}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {styleOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => updatePreferences({ style: option.id })}
                className={[
                  "h-12 rounded-2xl text-sm font-black ring-1 transition active:scale-95",
                  preferences.style === option.id ? "bg-slate-950 text-white ring-slate-950" : "bg-slate-50 text-slate-700 ring-slate-200",
                ].join(" ")}
              >
                {option.label[locale]}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={preferences.rainyAlternative}
            onChange={(event) => updatePreferences({ rainyAlternative: event.target.checked })}
            className="size-4 accent-teal-700"
          />
          <CloudRain size={18} aria-hidden="true" />
          {copy.rainy}
          <span className="rounded-full bg-teal-100 px-2 py-1 text-[11px] text-teal-800">PRO</span>
        </label>

        {proRequired && !isPro ? (
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {copy.proRequired}
            <Link href="/pricing" className="ml-2 underline">
              {copy.upgrade}
            </Link>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void generate()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white transition active:scale-95"
          >
            <CalendarDays size={18} aria-hidden="true" />
            {copy.generate}
          </button>
          <button
            type="button"
            onClick={() => void generate()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition active:scale-95"
          >
            <RefreshCw size={18} aria-hidden="true" />
            {copy.regenerate}
          </button>
        </div>
      </section>

      {message ? <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{message}</p> : null}

      {itinerary ? (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">{copy.result}</h2>
              <p className="mt-1 text-sm text-slate-500">{copy.ruleEngine}</p>
            </div>
            <div className="flex items-start gap-2">
              <ShareButton
                title={copy.shareTitle}
                text={itinerary.days.map((day) => `${locale === "zh" ? day.titleZh : day.titleKo}: ${day.stops.map((stop) => `${stop.time} ${locale === "zh" ? stop.titleZh : stop.titleKo}`).join(" / ")}`).join("\n")}
                className="rounded-2xl"
                locale={locale}
              />
              <button
                type="button"
                onClick={saveItinerary}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-200"
              >
                <Save size={16} aria-hidden="true" />
                {copy.save}
              </button>
            </div>
          </div>

          {itinerary.days.map((day) => (
            <article key={day.day} className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-2xl font-black text-slate-950">{locale === "zh" ? day.titleZh : day.titleKo}</h3>
              <div className="mt-5 space-y-3">
                {day.stops.map((stop) => {
                  const status = getOpeningStatusLabel(stop.openingStatus);

                  return (
                    <div key={`${day.day}-${stop.time}-${stop.titleKo}`} className="grid grid-cols-[64px_1fr] gap-3">
                      <div className="pt-4 text-sm font-black text-teal-700">{stop.time}</div>
                      <div className="rounded-[22px] bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            {stop.placeSlug ? (
                              <Link href={`/${locale}/places/${stop.placeSlug}`} className="text-lg font-black text-slate-950">
                                {locale === "zh" ? stop.titleZh : stop.titleKo}
                              </Link>
                            ) : (
                              <p className="text-lg font-black text-slate-950">{locale === "zh" ? stop.titleZh : stop.titleKo}</p>
                            )}
                          </div>
                          <TagChip tone={status.tone}>{locale === "zh" ? status.zh : status.ko}</TagChip>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{locale === "zh" ? stop.descriptionZh : stop.descriptionKo}</p>
                        {stop.walkingFromPreviousMinutes !== null ? (
                          <p className="mt-2 text-xs font-bold text-teal-700">{copy.walkFromPrevious} {stop.walkingFromPreviousMinutes}{copy.minuteSuffix}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
          <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h3 className="font-black text-slate-950">{copy.notes}</h3>
            <div className="mt-3 space-y-2">
              {localizedItineraryNotes[locale].map((note) => (
                <p key={note} className="text-sm text-slate-600">
                  {note}
                </p>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[16px] text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="block text-sm font-black text-slate-950">{label}</span>
      <span className="mb-2 block" />
      {children}
    </label>
  );
}

const itineraryCopy: Record<Locale, {
  hero: string;
  description: string;
  proEnabled: string;
  freePlan: string;
  days: string;
  daySuffix: string;
  lodging: string;
  people: string;
  peopleSuffix: string;
  budget: string;
  budgetLow: string;
  budgetMedium: string;
  budgetHigh: string;
  interests: string;
  style: string;
  rainy: string;
  proRequired: string;
  regeneratePro: string;
  generatedByRules: string;
  savePro: string;
  saved: string;
  upgrade: string;
  generate: string;
  regenerate: string;
  result: string;
  ruleEngine: string;
  shareTitle: string;
  save: string;
  walkFromPrevious: string;
  minuteSuffix: string;
  notes: string;
}> = {
  zh: {
    hero: "帮你安排广安里行程",
    description: "目前使用 Supabase/demo 地点数据的规则引擎生成路线。",
    proEnabled: "PRO 已启用",
    freePlan: "FREE · 1日行程",
    days: "旅行几天？",
    daySuffix: "日",
    lodging: "住在哪里？",
    people: "几个人？",
    peopleSuffix: "人",
    budget: "预算？",
    budgetLow: "节省",
    budgetMedium: "普通",
    budgetHigh: "宽裕",
    interests: "喜欢什么？",
    style: "旅行风格",
    rainy: "雨天替代路线",
    proRequired: "2日以上行程和雨天替代路线需要 PRO。",
    regeneratePro: "重新生成是 PRO 功能。",
    generatedByRules: "已使用 DB 规则生成行程。",
    savePro: "保存行程是 PRO 功能。",
    saved: "行程已保存。",
    upgrade: "升级",
    generate: "生成行程",
    regenerate: "再生成",
    result: "生成结果",
    ruleEngine: "DB 规则引擎",
    shareTitle: "釜山广安里行程",
    save: "保存",
    walkFromPrevious: "从上一地点步行约",
    minuteSuffix: "分钟",
    notes: "生成原则",
  },
  en: {
    hero: "Plan a Gwangalli itinerary",
    description: "Routes are generated from Supabase/demo place data using a rule engine.",
    proEnabled: "PRO enabled",
    freePlan: "FREE · 1-day route",
    days: "Trip length",
    daySuffix: " day",
    lodging: "Where are you staying?",
    people: "People",
    peopleSuffix: " people",
    budget: "Budget",
    budgetLow: "Low",
    budgetMedium: "Medium",
    budgetHigh: "High",
    interests: "Interests",
    style: "Travel style",
    rainy: "Rainy-day alternative",
    proRequired: "Trips over 1 day and rainy-day alternatives require PRO.",
    regeneratePro: "Regeneration requires PRO.",
    generatedByRules: "Generated with DB rules.",
    savePro: "Saving itineraries requires PRO.",
    saved: "Itinerary saved.",
    upgrade: "Upgrade",
    generate: "Generate",
    regenerate: "Regenerate",
    result: "Result",
    ruleEngine: "DB rule engine",
    shareTitle: "Busan Gwangalli itinerary",
    save: "Save",
    walkFromPrevious: "Walk from previous stop about",
    minuteSuffix: " min",
    notes: "Generation rules",
  },
  ja: {
    hero: "広安里の旅程を作成",
    description: "Supabase/demo のスポットデータを使うルールエンジンで生成します。",
    proEnabled: "PRO 有効",
    freePlan: "FREE · 1日旅程",
    days: "旅行日数",
    daySuffix: "日",
    lodging: "宿泊場所",
    people: "人数",
    peopleSuffix: "人",
    budget: "予算",
    budgetLow: "節約",
    budgetMedium: "普通",
    budgetHigh: "余裕あり",
    interests: "興味",
    style: "旅行スタイル",
    rainy: "雨の日の代替ルート",
    proRequired: "2日以上の旅程と雨の日代替ルートは PRO が必要です。",
    regeneratePro: "再生成は PRO 機能です。",
    generatedByRules: "DB ルールで旅程を生成しました。",
    savePro: "旅程保存は PRO 機能です。",
    saved: "旅程を保存しました。",
    upgrade: "アップグレード",
    generate: "生成",
    regenerate: "再生成",
    result: "生成結果",
    ruleEngine: "DB ルールエンジン",
    shareTitle: "釜山・広安里の旅程",
    save: "保存",
    walkFromPrevious: "前の場所から徒歩約",
    minuteSuffix: "分",
    notes: "生成ルール",
  },
  ko: {
    hero: "광안리 일정 짜기",
    description: "Supabase/demo 장소 데이터만 사용하는 규칙 기반 일정 생성기입니다.",
    proEnabled: "PRO 활성화",
    freePlan: "FREE · 1일 일정",
    days: "여행 일수",
    daySuffix: "일",
    lodging: "숙소 위치",
    people: "인원",
    peopleSuffix: "명",
    budget: "예산",
    budgetLow: "절약",
    budgetMedium: "보통",
    budgetHigh: "넉넉",
    interests: "관심사",
    style: "여행 스타일",
    rainy: "비 오는 날 대체 코스",
    proRequired: "2일 이상 일정과 비 오는 날 대체 코스는 PRO 기능입니다.",
    regeneratePro: "다시 생성은 PRO 기능입니다.",
    generatedByRules: "DB 규칙으로 일정을 생성했습니다.",
    savePro: "일정 저장은 PRO 기능입니다.",
    saved: "일정을 저장했습니다.",
    upgrade: "업그레이드",
    generate: "일정 생성",
    regenerate: "다시 생성",
    result: "생성 결과",
    ruleEngine: "DB 규칙 엔진",
    shareTitle: "부산 광안리 일정",
    save: "저장",
    walkFromPrevious: "이전 장소에서 도보 약",
    minuteSuffix: "분",
    notes: "생성 원칙",
  },
};

const localizedItineraryNotes: Record<Locale, string[]> = {
  zh: ["路线只使用 Supabase/demo 中已登记的地点。", "不会推荐数据库中不存在的商家。"],
  en: ["Routes only use places registered in Supabase/demo data.", "Businesses that are not in the database are not recommended."],
  ja: ["旅程は Supabase/demo に登録済みのスポットだけで構成します。", "DB にない店舗名はおすすめしません。"],
  ko: ["일정은 Supabase/demo 장소 데이터 안에서만 구성했습니다.", "DB에 없는 업체명은 추천하지 않습니다."],
};
