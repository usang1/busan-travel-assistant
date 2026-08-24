"use client";

import { useMemo, useState } from "react";
import { MessageSquareText, X } from "lucide-react";
import { formatWon } from "@/lib/place-store";
import type { PlaceMenuItem, PlaceWithRelations } from "@/types/database";

type OrderGuideProps = {
  place: PlaceWithRelations;
};

const partyOptions = [
  { label: "1人", value: 1 },
  { label: "2人", value: 2 },
  { label: "3人", value: 3 },
  { label: "4人+", value: 4 },
];

function buildOrder(menuItems: PlaceMenuItem[], people: number) {
  const sorted = [...menuItems].sort((a, b) => {
    if (a.is_recommended === b.is_recommended) {
      return a.sort_order - b.sort_order;
    }

    return a.is_recommended ? -1 : 1;
  });

  if (sorted.length === 0) {
    return [];
  }

  const primary = sorted[0];
  const secondary = sorted[1];
  const order = [{ item: primary, quantity: people }];

  if (secondary && people >= 2) {
    order.push({ item: secondary, quantity: people >= 4 ? 2 : 1 });
  }

  return order;
}

function koreanQuantity(index: number, quantity: number) {
  if (index === 0) {
    return `${quantity}인분`;
  }

  return quantity === 1 ? "하나" : `${quantity}개`;
}

function chineseQuantity(quantity: number) {
  return quantity === 1 ? "一份" : `${quantity}份`;
}

function joinKorean(parts: string[]) {
  if (parts.length === 0) {
    return "추천 메뉴를 주문하고 싶어요.";
  }

  if (parts.length === 1) {
    return `${parts[0]} 주세요.`;
  }

  return `${parts.slice(0, -1).join(", ")}이랑 ${parts.at(-1)} 주세요.`;
}

function joinChinese(parts: string[]) {
  if (parts.length === 0) {
    return "请推荐这里最受欢迎的菜单。";
  }

  return `请给我们${parts.join("和")}。`;
}

export function OrderGuide({ place }: OrderGuideProps) {
  const [people, setPeople] = useState(2);
  const [showStaffCard, setShowStaffCard] = useState(false);

  const recommendation = useMemo(() => {
    const order = buildOrder(place.menu_items, people);
    const total = order.reduce((sum, line) => sum + (line.item.price ?? 0) * line.quantity, 0);
    const koreanParts = order.map((line, index) => `${line.item.name_ko} ${koreanQuantity(index, line.quantity)}`);
    const chineseParts = order.map((line) => `${chineseQuantity(line.quantity)}${line.item.name_zh}`);

    return {
      order,
      total,
      koreanText: order.length > 0 ? joinKorean(koreanParts) : place.recommended_order_ko,
      chineseText: order.length > 0 ? joinChinese(chineseParts) : place.recommended_order_zh,
    };
  }, [people, place.menu_items, place.recommended_order_ko, place.recommended_order_zh]);

  return (
    <section className="mt-6 space-y-3">
      <div>
        <h2 className="text-xl font-bold tracking-normal text-slate-950">怎么点？</h2>
        <p className="mt-1 text-sm text-slate-500">어떻게 주문하지?</p>
      </div>

      <div className="rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-4 gap-2">
          {partyOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeople(option.value)}
              className={[
                "h-11 rounded-2xl text-sm font-black transition active:scale-95",
                people === option.value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-[22px] bg-teal-50 p-4">
          <p className="text-lg font-black text-slate-950">{people}个人推荐</p>
          <p className="mt-1 text-sm text-slate-500">{people}명 추천</p>

          {recommendation.order.length > 0 ? (
            <div className="mt-4 space-y-3">
              {recommendation.order.map((line) => (
                <div key={line.item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <div>
                    <p className="font-bold text-slate-950">
                      {line.item.name_zh} ×{line.quantity}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {line.item.name_ko} ×{line.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-teal-700">{formatWon((line.item.price ?? 0) * line.quantity)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600">{place.recommended_order_zh}</p>
          )}

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-white">
            <span className="text-sm text-slate-300">预计 / 예상</span>
            <span className="text-xl font-black">{recommendation.total > 0 ? formatWon(recommendation.total) : "직원 확인"}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowStaffCard(true)}
          className="mt-4 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-base font-black text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.98]"
        >
          <MessageSquareText size={20} aria-hidden="true" />
          给店员看
          <span className="text-sm font-semibold text-teal-100">직원에게 보여주기</span>
        </button>
      </div>

      {showStaffCard ? (
        <div className="fixed inset-0 z-50 bg-slate-950 p-4 text-white" role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={() => setShowStaffCard(false)}
            className="absolute right-4 top-4 grid size-12 place-items-center rounded-full bg-white/10 text-white"
            aria-label="关闭"
          >
            <X size={24} aria-hidden="true" />
          </button>
          <div className="flex min-h-full flex-col items-center justify-center text-center">
            <p className="mb-6 rounded-full bg-teal-400/15 px-4 py-2 text-sm font-bold text-teal-100">请把这个画面给店员看</p>
            <p className="max-w-2xl text-[40px] font-black leading-tight tracking-normal sm:text-6xl">{recommendation.koreanText}</p>
            <p className="mt-8 max-w-xl rounded-[24px] bg-white/10 p-5 text-xl font-bold leading-8 text-slate-100">
              {recommendation.chineseText}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
