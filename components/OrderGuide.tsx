"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, MessageSquareText, X } from "lucide-react";
import { getLocalizedMenuItem, type Locale } from "@/lib/i18n";
import { koreanMenuName, recommendMenuCombination, type MenuGuidancePreferences } from "@/lib/menu-guidance";
import { formatWon } from "@/lib/place-store";
import type { PlaceWithRelations } from "@/types/database";

type PhraseKey = "order" | "signature" | "notSpicy" | "noCilantro" | "takeout" | "foreignCard" | "queue" | "solo" | "serves";

export function OrderGuide({ place, locale }: { place: PlaceWithRelations; locale: Locale }) {
  const copy = orderGuideCopy[locale];
  const [preferences, setPreferences] = useState<MenuGuidancePreferences>({ people: 2, spicy: "okay", oily: "okay", seafood: "okay", cilantro: "okay", budget: null, mealType: "meal", representativeFirst: true });
  const [selectedPhrase, setSelectedPhrase] = useState<PhraseKey>("order");
  const [showStaffCard, setShowStaffCard] = useState(false);
  const recommendation = useMemo(() => recommendMenuCombination(place.menu_items, preferences, locale), [locale, place.menu_items, preferences]);
  const firstMenuName = recommendation.lines[0] ? koreanMenuName(recommendation.lines[0].item) : copy.signatureMenuKorean;
  const phrases = buildPhrases(recommendation.koreanOrderText, firstMenuName, locale);
  const activePhrase = phrases.find((phrase) => phrase.key === selectedPhrase) ?? phrases[0];
  const patch = (value: Partial<MenuGuidancePreferences>) => setPreferences((current) => ({ ...current, ...value }));

  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-xl font-bold tracking-normal text-slate-950">{copy.title}</h2>
      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <fieldset>
          <legend className="text-sm font-black text-slate-700">{copy.people}</legend>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((value) => <ChoiceButton key={value} active={preferences.people === value} label={value === 4 ? `4${copy.peopleSuffix}+` : `${value}${copy.peopleSuffix}`} onClick={() => patch({ people: value })} />)}
          </div>
        </fieldset>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <BinaryChoice label={copy.spicy} value={preferences.spicy} positive="okay" positiveLabel={copy.okay} negative="avoid" negativeLabel={copy.avoid} onChange={(spicy) => patch({ spicy: spicy as MenuGuidancePreferences["spicy"] })} />
          <BinaryChoice label={copy.oily} value={preferences.oily} positive="okay" positiveLabel={copy.okay} negative="avoid" negativeLabel={copy.avoid} onChange={(oily) => patch({ oily: oily as MenuGuidancePreferences["oily"] })} />
          <BinaryChoice label={copy.seafood} value={preferences.seafood} positive="okay" positiveLabel={copy.okay} negative="avoid" negativeLabel={copy.avoid} onChange={(seafood) => patch({ seafood: seafood as MenuGuidancePreferences["seafood"] })} />
          <BinaryChoice label={copy.cilantro} value={preferences.cilantro} positive="okay" positiveLabel={copy.okay} negative="avoid" negativeLabel={copy.avoid} onChange={(cilantro) => patch({ cilantro: cilantro as MenuGuidancePreferences["cilantro"] })} />
          <BinaryChoice label={copy.mealType} value={preferences.mealType} positive="meal" positiveLabel={copy.meal} negative="snack" negativeLabel={copy.snack} onChange={(mealType) => patch({ mealType: mealType as MenuGuidancePreferences["mealType"] })} />
          <label className="text-sm font-black text-slate-700">{copy.budget}<input type="number" min={0} step={1000} inputMode="numeric" value={preferences.budget ?? ""} onChange={(event) => patch({ budget: event.target.value ? Number(event.target.value) : null })} placeholder={copy.budgetPlaceholder} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-base" /></label>
        </div>
        <label className="mt-4 flex min-h-11 items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={preferences.representativeFirst} onChange={(event) => patch({ representativeFirst: event.target.checked })} />{copy.signatureFirst}</label>

        <div className="mt-5 rounded-lg bg-teal-50 p-4 ring-1 ring-teal-100">
          <p className="text-lg font-black text-slate-950">{preferences.people}{copy.peopleSuffix} {copy.recommendation}</p>
          {recommendation.lines.length ? <div className="mt-3 space-y-2">{recommendation.lines.map((line) => {
            const menu = getLocalizedMenuItem(line.item, locale);
            return <div key={line.item.id} className="rounded-md bg-white px-3 py-3"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{menu.name} × {line.quantity}</p><p className="mt-1 text-xs text-slate-500">{copy.koreanOriginal} · {koreanMenuName(line.item)}</p></div><p className="shrink-0 text-sm font-black text-teal-700">{typeof line.item.price === "number" ? formatWon(line.item.price * line.quantity, locale) : copy.priceUnknown}</p></div>{line.reasons.length ? <p className="mt-2 text-xs font-bold text-teal-800">{line.reasons.join(" · ")}</p> : null}{line.item.ordering_note?.[locale] ? <p className="mt-2 text-xs leading-5 text-slate-600">{line.item.ordering_note[locale]}</p> : null}{line.item.menu_warning?.[locale] ? <p className="mt-1 text-xs font-bold text-amber-900">{line.item.menu_warning[locale]}</p> : null}</div>;
          })}</div> : <p className="mt-3 text-sm text-slate-600">{copy.noMatch}</p>}
          <div className="mt-3 flex items-center justify-between rounded-md bg-slate-950 px-4 py-3 text-white"><span className="text-sm text-slate-300">{copy.expected}</span><span className="text-lg font-black">{recommendation.total === null ? copy.confirmWithStaff : formatWon(recommendation.total, locale)}</span></div>
          {recommendation.warnings.length ? <ul className="mt-3 space-y-1.5 text-xs font-bold leading-5 text-amber-950">{recommendation.warnings.map((warning) => <li key={warning} className="flex items-start gap-1.5"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{warning}</li>)}</ul> : null}
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="text-base font-black text-slate-950">{copy.phrases}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{phrases.map((phrase) => <button key={phrase.key} type="button" onClick={() => setSelectedPhrase(phrase.key)} aria-pressed={selectedPhrase === phrase.key} className={`min-h-11 rounded-md px-3 py-2 text-left text-sm font-bold ring-1 ${selectedPhrase === phrase.key ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-slate-700 ring-slate-200"}`}>{phrase.explanation}</button>)}</div>
          <button type="button" onClick={() => setShowStaffCard(true)} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-base font-black text-white"><MessageSquareText size={20} aria-hidden="true" />{copy.askStaff}</button>
        </div>
      </div>

      {showStaffCard ? <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-4 text-white" role="dialog" aria-modal="true" aria-label={copy.staffCard}><button type="button" onClick={() => setShowStaffCard(false)} className="fixed right-4 top-4 grid size-12 place-items-center rounded-full bg-white/10" aria-label={copy.close}><X size={24} aria-hidden="true" /></button><div className="flex min-h-full flex-col items-center justify-center py-16 text-center"><p className="rounded-md bg-teal-400/15 px-4 py-2 text-sm font-bold text-teal-100">{copy.staffCard}</p><p lang="ko" className="mt-6 max-w-3xl break-keep text-4xl font-black leading-tight sm:text-6xl">{activePhrase.korean}</p><div className="mt-8 max-w-xl border-t border-white/20 pt-5"><p className="text-sm font-bold text-teal-200">{copy.explanation}</p><p className="mt-2 text-lg font-bold leading-7 text-slate-100">{activePhrase.explanation}</p></div></div></div> : null}
    </section>
  );
}

function ChoiceButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} aria-pressed={active} className={`h-11 rounded-md text-sm font-black ${active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</button>; }
function BinaryChoice({ label, value, positive, positiveLabel, negative, negativeLabel, onChange }: { label: string; value: string; positive: string; positiveLabel: string; negative: string; negativeLabel: string; onChange: (value: string) => void }) { return <fieldset><legend className="text-sm font-black text-slate-700">{label}</legend><div className="mt-2 grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1"><ChoiceButton active={value === positive} label={positiveLabel} onClick={() => onChange(positive)} /><ChoiceButton active={value === negative} label={negativeLabel} onClick={() => onChange(negative)} /></div></fieldset>; }

function buildPhrases(orderText: string, menuName: string, locale: Locale): Array<{ key: PhraseKey; korean: string; explanation: string }> {
  const explanations: Record<PhraseKey, Record<Locale, string>> = {
    order: { ko: "선택한 추천 조합 주문", zh: "点所选推荐组合", en: "Order the selected combination", ja: "選んだおすすめセットを注文" }, notSpicy: { ko: "맵지 않게 요청", zh: "请做得不辣", en: "Ask for no spice", ja: "辛くしないよう依頼" },
    signature: { ko: "대표 메뉴 1인분 주문", zh: "点一人份招牌菜单", en: "Order one serving of the signature item", ja: "代表メニューを1人前注文" },
    noCilantro: { ko: "고수 제외 요청", zh: "请不要放香菜", en: "Ask for no cilantro", ja: "パクチー抜きを依頼" }, takeout: { ko: "포장 가능 여부 확인", zh: "询问能否打包", en: "Ask about takeout", ja: "テイクアウト可能か確認" },
    foreignCard: { ko: "해외카드 결제 확인", zh: "询问能否使用海外信用卡", en: "Ask about foreign card payment", ja: "海外カード決済を確認" }, queue: { ko: "웨이팅 등록 방법 확인", zh: "询问如何登记等位", en: "Ask how to join the queue", ja: "順番待ち登録方法を確認" },
    solo: { ko: "1인 주문 가능 여부 확인", zh: "询问一人是否可以点餐", en: "Ask whether solo ordering is allowed", ja: "一人注文が可能か確認" }, serves: { ko: "메뉴 권장 인원 확인", zh: "询问这道菜适合几人", en: "Ask how many people the dish serves", ja: "何人分か確認" },
  };
  return [
    { key: "order", korean: orderText, explanation: explanations.order[locale] }, { key: "notSpicy", korean: "맵지 않게 해주세요.", explanation: explanations.notSpicy[locale] },
    { key: "signature", korean: `${menuName} 1인분 주세요.`, explanation: explanations.signature[locale] },
    { key: "noCilantro", korean: "고수를 빼주세요.", explanation: explanations.noCilantro[locale] }, { key: "takeout", korean: "포장 가능한가요?", explanation: explanations.takeout[locale] },
    { key: "foreignCard", korean: "해외카드로 결제 가능한가요?", explanation: explanations.foreignCard[locale] }, { key: "queue", korean: "웨이팅 등록은 어떻게 하나요?", explanation: explanations.queue[locale] },
    { key: "solo", korean: "1인 방문인데 주문 가능한가요?", explanation: explanations.solo[locale] }, { key: "serves", korean: `${menuName}은 몇 명이 먹을 수 있나요?`, explanation: explanations.serves[locale] },
  ];
}

const orderGuideCopy: Record<Locale, Record<string, string>> = {
  ko: { title: "실패 없는 메뉴 조합", people: "인원", peopleSuffix: "명", spicy: "매운 음식", oily: "기름진 음식", seafood: "해산물", cilantro: "고수·향신료", okay: "괜찮음", avoid: "피하기", mealType: "용도", meal: "식사", snack: "간식", budget: "총예산", budgetPlaceholder: "예: 40000", signatureFirst: "근거가 확인된 대표 메뉴 우선", recommendation: "추천 조합", koreanOriginal: "한국어 원문", expected: "예상 총액", confirmWithStaff: "가격 확인 필요", priceUnknown: "가격 미확인", noMatch: "입력 조건과 명시적으로 맞는 메뉴가 없습니다.", phrases: "직원에게 보여줄 문장", askStaff: "선택 문장 크게 보기", close: "닫기", staffCard: "직원에게 아래 한국어를 보여주세요", explanation: "내 언어로 보는 뜻", signatureMenuKorean: "대표 메뉴" },
  zh: { title: "不踩雷菜单组合", people: "人数", peopleSuffix: "人", spicy: "辣味", oily: "油腻", seafood: "海鲜", cilantro: "香菜与香料", okay: "可以", avoid: "避免", mealType: "用途", meal: "正餐", snack: "小吃", budget: "总预算", budgetPlaceholder: "例如 40000", signatureFirst: "优先有依据的招牌菜单", recommendation: "推荐组合", koreanOriginal: "韩文原名", expected: "预计总额", confirmWithStaff: "价格待确认", priceUnknown: "价格未确认", noMatch: "没有与所选条件明确匹配的菜单。", phrases: "给店员看的句子", askStaff: "放大所选句子", close: "关闭", staffCard: "请把下面的韩语给店员看", explanation: "这句话的意思", signatureMenuKorean: "대표 메뉴" },
  en: { title: "Low-risk menu combination", people: "Party size", peopleSuffix: "", spicy: "Spicy food", oily: "Oily food", seafood: "Seafood", cilantro: "Cilantro and spices", okay: "Okay", avoid: "Avoid", mealType: "Type", meal: "Meal", snack: "Snack", budget: "Total budget", budgetPlaceholder: "e.g. 40000", signatureFirst: "Prioritize evidence-backed signature items", recommendation: "recommended combination", koreanOriginal: "Korean original", expected: "Estimated total", confirmWithStaff: "Price unverified", priceUnknown: "Price unknown", noMatch: "No menu explicitly matches these conditions.", phrases: "Phrases to show staff", askStaff: "Show selected phrase", close: "Close", staffCard: "Show the Korean sentence below to staff", explanation: "Meaning in your language", signatureMenuKorean: "대표 메뉴" },
  ja: { title: "失敗しにくいメニュー組合せ", people: "人数", peopleSuffix: "人", spicy: "辛い料理", oily: "脂っこい料理", seafood: "海鮮", cilantro: "パクチー・香辛料", okay: "大丈夫", avoid: "避ける", mealType: "用途", meal: "食事", snack: "軽食", budget: "総予算", budgetPlaceholder: "例 40000", signatureFirst: "根拠確認済みの代表メニューを優先", recommendation: "おすすめ組合せ", koreanOriginal: "韓国語原文", expected: "予想合計", confirmWithStaff: "価格未確認", priceUnknown: "価格未確認", noMatch: "選択条件に明確に合うメニューがありません。", phrases: "スタッフに見せる文章", askStaff: "選択文を大きく表示", close: "閉じる", staffCard: "下の韓国語をスタッフに見せてください", explanation: "この文の意味", signatureMenuKorean: "대표 메뉴" },
};
