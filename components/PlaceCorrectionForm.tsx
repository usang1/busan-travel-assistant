"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { useAuth } from "@/components/AuthProvider";
import { recordPlaceEvent } from "@/lib/place-events";
import { getSupabaseClient } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n";

type PlaceCorrectionFormProps = {
  placeId: string;
  locale: Locale;
  currentValues?: Partial<Record<PlaceCorrectionField, string>>;
};

export type PlaceCorrectionField =
  | "opening_hours"
  | "closed_days"
  | "menu"
  | "menu_price"
  | "price_range"
  | "phone"
  | "website"
  | "address"
  | "parking"
  | "reservation"
  | "closed"
  | "other";

type LocalizedText = Record<Locale, string>;

const fieldOptions: Array<{ value: PlaceCorrectionField; labels: LocalizedText; placeholder: LocalizedText }> = [
  { value: "opening_hours", labels: { zh: "营业时间", en: "Opening hours", ja: "営業時間", ko: "영업시간" }, placeholder: { zh: "例：每天 10:00-22:00", en: "e.g. Daily 10:00-22:00", ja: "例：毎日 10:00-22:00", ko: "예: 매일 10:00-22:00" } },
  { value: "closed_days", labels: { zh: "休息日", en: "Closed days", ja: "定休日", ko: "휴무일" }, placeholder: { zh: "例：每周一休息", en: "e.g. Closed Mondays", ja: "例：毎週月曜休み", ko: "예: 매주 월요일 휴무" } },
  { value: "menu", labels: { zh: "菜单/招牌菜", en: "Menu/signature items", ja: "メニュー・代表料理", ko: "메뉴/대표 메뉴" }, placeholder: { zh: "请填写菜单名称或招牌菜", en: "Enter menu or signature item names", ja: "メニュー名や代表料理を入力", ko: "메뉴명 또는 대표 메뉴를 입력해 주세요" } },
  { value: "menu_price", labels: { zh: "菜单价格", en: "Menu prices", ja: "メニュー価格", ko: "메뉴별 가격" }, placeholder: { zh: "例：美式咖啡 5,000韩元", en: "e.g. Americano KRW 5,000", ja: "例：アメリカーノ 5,000ウォン", ko: "예: 아메리카노 5,000원" } },
  { value: "price_range", labels: { zh: "人均价格", en: "Price per person", ja: "1人あたり価格", ko: "1인 가격대" }, placeholder: { zh: "例：人均约15,000-20,000韩元", en: "e.g. About KRW 15,000-20,000 per person", ja: "例：1人約15,000〜20,000ウォン", ko: "예: 1인 약 15,000~20,000원" } },
  { value: "phone", labels: { zh: "电话号码", en: "Phone number", ja: "電話番号", ko: "전화번호" }, placeholder: { zh: "请填写店铺电话号码", en: "Enter the business phone number", ja: "店舗の電話番号を入力", ko: "가게 전화번호를 입력해 주세요" } },
  { value: "website", labels: { zh: "官网/社交账号", en: "Website/social account", ja: "公式サイト・SNS", ko: "홈페이지/공식 SNS" }, placeholder: { zh: "请填写官方链接", en: "Enter the official URL", ja: "公式URLを入力", ko: "공식 URL을 입력해 주세요" } },
  { value: "address", labels: { zh: "地址", en: "Address", ja: "住所", ko: "주소" }, placeholder: { zh: "请填写正确地址", en: "Enter the correct address", ja: "正しい住所を入力", ko: "정확한 주소를 입력해 주세요" } },
  { value: "parking", labels: { zh: "停车", en: "Parking", ja: "駐車場", ko: "주차 정보" }, placeholder: { zh: "例：不可停车/有免费停车场", en: "e.g. No parking / free parking available", ja: "例：駐車不可・無料駐車場あり", ko: "예: 주차 불가 / 무료 주차장 있음" } },
  { value: "reservation", labels: { zh: "预约", en: "Reservations", ja: "予約", ko: "예약 정보" }, placeholder: { zh: "请填写预约方式或是否可预约", en: "Enter reservation availability or method", ja: "予約可否や方法を入力", ko: "예약 가능 여부나 방법을 입력해 주세요" } },
  { value: "closed", labels: { zh: "已停业/搬迁", en: "Closed/moved", ja: "閉店・移転", ko: "폐업/이전" }, placeholder: { zh: "请填写停业或搬迁信息", en: "Describe the closure or relocation", ja: "閉店または移転情報を入力", ko: "폐업 또는 이전 정보를 입력해 주세요" } },
  { value: "other", labels: { zh: "其他", en: "Other", ja: "その他", ko: "기타" }, placeholder: { zh: "请填写需要修改的信息", en: "Describe the information to update", ja: "修正する情報を入力", ko: "수정할 정보를 입력해 주세요" } },
];

const correctionCopy: Record<Locale, {
  title: string; description: string; loginTitle: string; loginDescription: string; field: string; current: string;
  suggestion: string; source: string; sourceHelp: string; notes: string; notesPlaceholder: string;
  submit: string; submitting: string; success: string; loading: string;
}> = {
  zh: { title: "补充或修改商家信息", description: "可提交菜单、价格、电话和营业信息，管理员确认后更新。", loginTitle: "信息有误吗？", loginDescription: "登录后可提交地点信息修改。", field: "需要修改的信息", current: "当前登记信息", suggestion: "新的信息", source: "来源链接（可选）", sourceHelp: "官方主页、地图、菜单页面等", notes: "补充说明（可选）", notesPlaceholder: "请补充确认日期或其他说明", submit: "提交信息", submitting: "提交中…", success: "已提交，管理员确认后会更新。", loading: "加载中…" },
  en: { title: "Update business information", description: "Submit menu, price, phone, or operating information for admin review.", loginTitle: "Is something incorrect?", loginDescription: "Log in to submit a place information update.", field: "Information to update", current: "Current information", suggestion: "New information", source: "Source URL (optional)", sourceHelp: "Official site, map page, menu page, etc.", notes: "Additional note (optional)", notesPlaceholder: "Add the verification date or context", submit: "Submit update", submitting: "Submitting…", success: "Submitted for administrator review.", loading: "Loading…" },
  ja: { title: "店舗情報を修正・追加", description: "メニュー、価格、電話番号、営業情報を管理者に報告できます。", loginTitle: "情報に誤りがありますか？", loginDescription: "ログイン後、店舗情報の修正を送信できます。", field: "修正する情報", current: "現在の登録情報", suggestion: "新しい情報", source: "出典URL（任意）", sourceHelp: "公式サイト、地図、メニューページなど", notes: "補足（任意）", notesPlaceholder: "確認日や補足情報を入力", submit: "情報を送信", submitting: "送信中…", success: "送信しました。管理者確認後に更新されます。", loading: "読み込み中…" },
  ko: { title: "가게 정보 제보", description: "메뉴, 가격, 전화번호, 영업정보를 제보하면 관리자 확인 후 반영합니다.", loginTitle: "정보가 잘못되었나요?", loginDescription: "로그인 후 장소 정보 수정 요청을 제출할 수 있습니다.", field: "제보할 정보", current: "현재 등록 정보", suggestion: "새로운 정보", source: "출처 URL (선택)", sourceHelp: "공식 홈페이지, 지도, 메뉴 페이지 등", notes: "추가 메모 (선택)", notesPlaceholder: "확인 날짜나 참고사항을 입력해 주세요", submit: "정보 제보", submitting: "접수 중…", success: "제보가 접수되었습니다. 관리자 확인 후 반영합니다.", loading: "불러오는 중…" },
};

export function PlaceCorrectionForm({ placeId, locale, currentValues = {} }: PlaceCorrectionFormProps) {
  const { user, loading } = useAuth();
  const copy = correctionCopy[locale];
  const [fieldName, setFieldName] = useState<PlaceCorrectionField>(fieldOptions[0].value);
  const [suggestedValue, setSuggestedValue] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selectedOption = fieldOptions.find((option) => option.value === fieldName) ?? fieldOptions[0];
  const currentValue = currentValues[fieldName]?.trim() ?? "";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseClient();
    const nextValue = suggestedValue.trim();
    if (!client || !user || !nextValue) return;

    setSubmitting(true);
    setStatus("");
    const { error } = await client.from("place_corrections").insert({
      place_id: placeId,
      user_id: user.id,
      locale,
      field_name: fieldName,
      current_value: currentValue || null,
      suggested_value: nextValue,
      source_url: sourceUrl.trim() || null,
      notes: notes.trim(),
    });
    setSubmitting(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    await recordPlaceEvent({ eventType: "correction_submitted", placeId, locale, userId: user.id, metadata: { field_name: fieldName } });
    setSuggestedValue("");
    setSourceUrl("");
    setNotes("");
    setStatus(copy.success);
  }

  if (loading) {
    return <div id="place-correction" className="scroll-mt-28 rounded-[24px] bg-white p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">{copy.loading}</div>;
  }

  if (!user) {
    return <div id="place-correction" className="scroll-mt-28"><AuthRequiredPanel title={copy.loginTitle} description={copy.loginDescription} locale={locale} /></div>;
  }

  return (
    <section id="place-correction" className="mt-6 scroll-mt-28 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-black text-slate-950">{copy.title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{copy.description}</p>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">{copy.field}</span>
          <select value={fieldName} onChange={(event) => { setFieldName(event.target.value as PlaceCorrectionField); setStatus(""); }} className="mt-2 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base outline-none ring-1 ring-slate-200 focus:ring-teal-300">
            {fieldOptions.map((option) => <option key={option.value} value={option.value}>{option.labels[locale]}</option>)}
          </select>
        </label>
        {currentValue ? <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200"><p className="text-xs font-bold text-slate-500">{copy.current}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{currentValue}</p></div> : null}
        <label className="block">
          <span className="text-sm font-bold text-slate-700">{copy.suggestion}</span>
          <textarea value={suggestedValue} onChange={(event) => setSuggestedValue(event.target.value)} required maxLength={2000} rows={4} placeholder={selectedOption.placeholder[locale]} className="mt-2 w-full rounded-2xl bg-slate-50 px-3 py-3 text-base outline-none ring-1 ring-slate-200 focus:ring-teal-300" />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">{copy.source}</span>
          <input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} maxLength={1000} placeholder="https://" className="mt-2 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base outline-none ring-1 ring-slate-200 focus:ring-teal-300" />
          <span className="mt-1 block text-xs text-slate-400">{copy.sourceHelp}</span>
        </label>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">{copy.notes}</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder={copy.notesPlaceholder} className="mt-2 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base outline-none ring-1 ring-slate-200 focus:ring-teal-300" />
        </label>
        <button type="submit" disabled={submitting || !suggestedValue.trim()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white transition active:scale-95 disabled:opacity-60">
          <Send size={17} aria-hidden="true" />{submitting ? copy.submitting : copy.submit}
        </button>
      </form>
      {status ? <p role="status" className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{status}</p> : null}
    </section>
  );
}
