"use client";

import type {
  PlaceVerificationStatus,
  TravelerInsights,
} from "@/types/database";
import { normalizeTravelerInsights } from "@/lib/traveler-insights";

type TravelerInsightsEditorProps = {
  value: TravelerInsights | null | undefined;
  verificationStatus: PlaceVerificationStatus;
  verifiedAt: string;
  onChange: (value: Required<TravelerInsights>) => void;
  onVerificationStatusChange: (value: PlaceVerificationStatus) => void;
  onVerifiedAtChange: (value: string) => void;
};

const inputClass = "mt-2 h-12 w-full rounded-2xl bg-white px-3 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-teal-300";

export function TravelerInsightsEditor({
  value,
  verificationStatus,
  verifiedAt,
  onChange,
  onVerificationStatusChange,
  onVerifiedAtChange,
}: TravelerInsightsEditorProps) {
  const insights = normalizeTravelerInsights(value);
  const update = <Key extends keyof TravelerInsights>(key: Key, nextValue: Required<TravelerInsights>[Key]) => {
    onChange({ ...insights, [key]: nextValue });
  };

  return (
    <div className="space-y-5 sm:col-span-2">
      <div>
        <h4 className="text-sm font-black text-slate-950">여행자 실용정보</h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">확인된 값만 선택하세요. 확인 필요는 사용자 화면에 표시되지 않으며 AI가 이 값을 변경하지 않습니다.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectFact label="혼밥" value={insights.solo_dining} onChange={(next) => update("solo_dining", next)} options={tristateOptions("가능", "어려움")} />
        <SelectFact label="카드 결제" value={insights.card_payment} onChange={(next) => update("card_payment", next)} options={tristateOptions("가능", "불가")} />
        <SelectFact label="짐 보관" value={insights.luggage_storage} onChange={(next) => update("luggage_storage", next)} options={tristateOptions("가능", "불가")} />
        <SelectFact label="관광객 이용 편의" value={insights.tourist_friendly} onChange={(next) => update("tourist_friendly", next)} options={tristateOptions("편함", "어려움")} />
        <SelectFact label="주문 방식" value={insights.ordering_method} onChange={(next) => update("ordering_method", next)} options={[
          ["unknown", "확인 필요"], ["kiosk", "키오스크"], ["staff", "직원 주문"], ["both", "키오스크/직원 모두"],
        ]} />
        <SelectFact label="예약" value={insights.reservation} onChange={(next) => update("reservation", next)} options={[
          ["unknown", "확인 필요"], ["not_needed", "예약 불필요"], ["recommended", "예약 추천"], ["required", "예약 필수"],
        ]} />
        <SelectFact label="웨이팅" value={insights.waiting} onChange={(next) => update("waiting", next)} options={[
          ["unknown", "확인 필요"], ["none", "거의 없음"], ["some", "있음"], ["high", "많음"],
        ]} />
        <SelectFact label="화장실" value={insights.toilet} onChange={(next) => update("toilet", next)} options={[
          ["unknown", "확인 필요"], ["available", "이용 가능"], ["inside", "매장 내부"], ["none", "없음"],
        ]} />
        <SelectFact label="매운맛" value={insights.spicy} onChange={(next) => update("spicy", next)} options={intensityOptions} />
        <SelectFact label="향신료" value={insights.spice_intensity} onChange={(next) => update("spice_intensity", next)} options={intensityOptions} />
        <SelectFact label="고수" value={insights.cilantro} onChange={(next) => update("cilantro", next)} options={[
          ["unknown", "확인 필요"], ["no", "사용 안 함"], ["possible", "포함 가능"],
        ]} />
        <SelectFact label="양" value={insights.portion} onChange={(next) => update("portion", next)} options={[
          ["unknown", "확인 필요"], ["regular", "보통"], ["large", "많음"],
        ]} />
        <SelectFact label="느끼함" value={insights.greasiness} onChange={(next) => update("greasiness", next)} options={[
          ["unknown", "확인 필요"], ["no", "보통"], ["possible", "느끼할 수 있음"],
        ]} />
      </div>

      <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
        <CheckFact label="현금 필요" checked={insights.cash_required === "yes"} onChange={(checked) => update("cash_required", checked ? "yes" : "unknown")} />
        <CheckFact label="중국어 메뉴 있음" checked={insights.chinese_menu === "yes"} onChange={(checked) => update("chinese_menu", checked ? "yes" : "unknown")} />
        <CheckFact label="영어 메뉴 있음" checked={insights.english_menu === "yes"} onChange={(checked) => update("english_menu", checked ? "yes" : "unknown")} />
      </div>

      <div className="grid gap-4 rounded-2xl bg-teal-50 p-4 sm:grid-cols-2">
        <label className="block text-sm font-black text-slate-800">
          정보 확인 상태
          <select value={verificationStatus} onChange={(event) => onVerificationStatusChange(event.target.value as PlaceVerificationStatus)} className={inputClass}>
            <option value="unverified">미확인</option>
            <option value="pending">확인 중</option>
            <option value="verified">확인 완료</option>
            <option value="needs_review">재확인 필요</option>
          </select>
        </label>
        <label className="block text-sm font-black text-slate-800">
          마지막 정보 확인일
          <input type="date" value={verifiedAt.slice(0, 10)} onChange={(event) => onVerifiedAtChange(event.target.value)} className={inputClass} />
        </label>
      </div>
    </div>
  );
}

function SelectFact<Value extends string>({ label, value, options, onChange }: { label: string; value: Value; options: Array<readonly [Value, string]>; onChange: (value: Value) => void }) {
  return (
    <label className="block text-sm font-black text-slate-800">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as Value)} className={inputClass}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function CheckFact({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-white px-3 text-sm font-black text-slate-800 ring-1 ring-slate-200">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5 accent-teal-700" />
      {label}
    </label>
  );
}

function tristateOptions(yesLabel: string, noLabel: string) {
  return [["unknown", "확인 필요"], ["yes", yesLabel], ["no", noLabel]] as Array<readonly ["unknown" | "yes" | "no", string]>;
}

const intensityOptions = [["unknown", "확인 필요"], ["normal", "보통"], ["strong", "강함"]] as Array<readonly ["unknown" | "normal" | "strong", string]>;
