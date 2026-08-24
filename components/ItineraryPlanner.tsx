"use client";

import Link from "next/link";
import { CalendarDays, CloudRain, Crown, RefreshCw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useProEntitlement } from "@/components/ProEntitlementProvider";
import { ShareButton } from "@/components/ShareButton";
import { TagChip } from "@/components/TagChip";
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
};

const interestOptions: Array<{ id: ItineraryInterest; zh: string; ko: string }> = [
  { id: "food", zh: "美食", ko: "맛집" },
  { id: "cafe", zh: "咖啡", ko: "카페" },
  { id: "photo", zh: "拍照", ko: "사진" },
  { id: "shopping", zh: "购物", ko: "쇼핑" },
  { id: "sea", zh: "大海", ko: "바다" },
  { id: "nightlife", zh: "夜生活", ko: "야간" },
];

const styleOptions: Array<{ id: TravelStyle; zh: string; ko: string }> = [
  { id: "relaxed", zh: "轻松", ko: "여유" },
  { id: "normal", zh: "普通", ko: "보통" },
  { id: "packed", zh: "充实", ko: "빡빡하게" },
];

function defaultPreferences(): ItineraryPreferences {
  return {
    days: 1,
    lodging: "广安里",
    people: 2,
    budget: "medium",
    interests: ["food", "cafe", "photo", "sea"],
    style: "normal",
    rainyAlternative: false,
  };
}

export function ItineraryPlanner({ places }: ItineraryPlannerProps) {
  const { isPro } = useProEntitlement();
  const [preferences, setPreferences] = useState<ItineraryPreferences>(() => defaultPreferences());
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
      setMessage("2日以上行程和雨天替代路线是 PRO 功能。");
      return;
    }

    if (!canRegenerate) {
      setMessage("重新生成是 PRO 功能。");
      return;
    }

    const next = await generateItineraryFromDb(places, preferences);
    setItinerary(next);
    setGenerationCount((count) => count + 1);
    setMessage(next.source === "rule_based" ? "已使用 DB 规则生成行程。" : "");
  }

  function saveItinerary() {
    if (!itinerary) {
      return;
    }

    if (!isPro) {
      setMessage("保存行程是 PRO 功能。");
      return;
    }

    const nextSaved = [itinerary, ...savedItineraries].slice(0, 10);
    window.localStorage.setItem("busan-travel-assistant-saved-itineraries", JSON.stringify(nextSaved));
    setMessage("行程已保存。");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-teal-100 ring-1 ring-white/10">
          <CalendarDays size={16} aria-hidden="true" />
          AI-ready itinerary
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal">帮你安排广安里行程</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          현재는 Supabase/demo 장소 데이터만 사용하는 rule engine입니다. API key가 없어도 작동합니다.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-bold">
          <Crown size={16} aria-hidden="true" />
          {isPro ? "PRO 已启用" : "FREE · 1日行程"}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="旅行几天？" ko="여행 며칠?">
            <select
              value={preferences.days}
              onChange={(event) => updatePreferences({ days: Number(event.target.value) })}
              className={inputClass}
            >
              {[1, 2, 3].map((day) => (
                <option key={day} value={day}>
                  {day}日
                </option>
              ))}
            </select>
          </Field>
          <Field label="住在哪里？" ko="숙소 어디?">
            <input value={preferences.lodging} onChange={(event) => updatePreferences({ lodging: event.target.value })} className={inputClass} />
          </Field>
          <Field label="几个人？" ko="몇 명?">
            <select
              value={preferences.people}
              onChange={(event) => updatePreferences({ people: Number(event.target.value) })}
              className={inputClass}
            >
              {[1, 2, 3, 4].map((people) => (
                <option key={people} value={people}>
                  {people === 4 ? "4人+" : `${people}人`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="预算？" ko="예산?">
            <select
              value={preferences.budget}
              onChange={(event) => updatePreferences({ budget: event.target.value as ItineraryPreferences["budget"] })}
              className={inputClass}
            >
              <option value="low">节省</option>
              <option value="medium">普通</option>
              <option value="high">宽裕</option>
            </select>
          </Field>
        </div>

        <div className="mt-5">
          <p className="font-black text-slate-950">喜欢什么？</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {interestOptions.map((option) => {
              const active = preferences.interests.includes(option.id);

              return (
                <button key={option.id} type="button" onClick={() => toggleInterest(option.id)} className="active:scale-95">
                  <TagChip tone={active ? "green" : "default"}>
                    {option.zh}
                    <span className="ml-1 text-[11px] opacity-70">{option.ko}</span>
                  </TagChip>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="font-black text-slate-950">旅行 style</p>
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
                {option.zh}
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
          비 오는 날 대체 코스
          <span className="rounded-full bg-teal-100 px-2 py-1 text-[11px] text-teal-800">PRO</span>
        </label>

        {proRequired && !isPro ? (
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            2日以上行程和雨天替代路线需要 PRO。
            <Link href="/pricing" className="ml-2 underline">
              升级
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
            生成行程
          </button>
          <button
            type="button"
            onClick={() => void generate()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition active:scale-95"
          >
            <RefreshCw size={18} aria-hidden="true" />
            再生成
          </button>
        </div>
      </section>

      {message ? <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{message}</p> : null}

      {itinerary ? (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">生成结果</h2>
              <p className="mt-1 text-sm text-slate-500">DB 기반 rule engine</p>
            </div>
            <div className="flex items-start gap-2">
              <ShareButton
                title="釜山广安里行程"
                text={itinerary.days.map((day) => `${day.titleZh}: ${day.stops.map((stop) => `${stop.time} ${stop.titleZh}`).join(" / ")}`).join("\n")}
                className="rounded-2xl"
              />
              <button
                type="button"
                onClick={saveItinerary}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-200"
              >
                <Save size={16} aria-hidden="true" />
                保存
              </button>
            </div>
          </div>

          {itinerary.days.map((day) => (
            <article key={day.day} className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-2xl font-black text-slate-950">{day.titleZh}</h3>
              <p className="mt-1 text-sm text-slate-500">{day.titleKo}</p>
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
                              <Link href={`/places/${stop.placeSlug}`} className="text-lg font-black text-slate-950">
                                {stop.titleZh}
                              </Link>
                            ) : (
                              <p className="text-lg font-black text-slate-950">{stop.titleZh}</p>
                            )}
                            <p className="mt-1 text-sm text-slate-500">{stop.titleKo}</p>
                          </div>
                          <TagChip tone={status.tone}>{status.zh}</TagChip>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{stop.descriptionZh}</p>
                        {stop.walkingFromPreviousMinutes !== null ? (
                          <p className="mt-2 text-xs font-bold text-teal-700">이전 장소에서 도보 약 {stop.walkingFromPreviousMinutes}분</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
          <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h3 className="font-black text-slate-950">生成原则</h3>
            <div className="mt-3 space-y-2">
              {itinerary.notes.map((note) => (
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

function Field({ label, ko, children }: { label: string; ko: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="block text-sm font-black text-slate-950">{label}</span>
      <span className="mb-2 mt-1 block text-xs text-slate-500">{ko}</span>
      {children}
    </label>
  );
}
