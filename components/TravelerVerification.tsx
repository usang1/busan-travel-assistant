"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, LocateFixed, MapPinCheck, Send, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { calculateDistanceMeters, type Coordinates } from "@/lib/location";
import { rememberTravelerVisit, wasMapOpenedRecently, wasTravelerVisitSubmitted } from "@/lib/place-visit-memory";
import type { Locale } from "@/lib/i18n";
import type { TravelerFact, TravelerFactType } from "@/lib/traveler-verification";

type TravelerVerificationProps = {
  placeId: string;
  placeName: string;
  locale: Locale;
  coordinates?: Coordinates | null;
  compact?: boolean;
};

type FactOption = {
  id: string;
  fact_type: TravelerFactType;
  fact_value: TravelerFact["fact_value"];
  group?: string;
  secondary?: boolean;
  label: Record<Locale, string>;
};

const options: FactOption[] = [
  option("wait-0", "waiting_minutes", 0, "wait", ["웨이팅 없음", "无需等位", "No wait", "待ち時間なし"]),
  option("wait-10", "waiting_minutes", 10, "wait", ["약 10분", "约10分钟", "About 10 min", "約10分"]),
  option("wait-20", "waiting_minutes", 20, "wait", ["약 20분", "约20分钟", "About 20 min", "約20分"]),
  option("wait-40", "waiting_minutes", 40, "wait", ["약 40분 이상", "约40分钟以上", "40+ min", "約40分以上"]),
  option("foreign-card", "foreign_card", true, undefined, ["해외카드 가능", "可用海外信用卡", "Foreign card works", "海外カード可"]),
  option("alipay", "alipay", true, undefined, ["알리페이 가능", "可用支付宝", "Alipay works", "Alipay可"]),
  option("wechat", "wechat_pay", true, undefined, ["위챗페이 가능", "可用微信支付", "WeChat Pay works", "WeChat Pay可"]),
  option("zh-menu", "chinese_menu", true, undefined, ["중국어 메뉴 있음", "有中文菜单", "Chinese menu", "中国語メニューあり"]),
  option("solo", "solo_friendly", true, undefined, ["혼자 방문 괜찮음", "适合一个人", "Solo friendly", "一人でも利用しやすい"]),
  option("luggage", "luggage_friendly", false, undefined, ["캐리어 불편", "大行李箱不便", "Luggage is difficult", "大型荷物は不便"]),
  option("restroom", "restroom", true, undefined, ["매장 화장실 있음", "店内有洗手间", "Restroom inside", "店内トイレあり"]),
  option("sold-out", "sold_out", true, undefined, ["재료 소진", "食材售罄", "Sold out", "売り切れ"]),
  option("early-close", "early_closed", true, undefined, ["조기 마감", "提前打烊", "Closed early", "早仕舞い"]),
  option("photo", "photo_matches", true, undefined, ["사진과 실제가 비슷함", "与照片相似", "Matches photos", "写真と実物が近い"]),
  option("not-now", "not_recommended_now", true, undefined, ["이 시간에는 비추천", "这个时间不推荐", "Not good at this time", "この時間は非推奨"]),
  option("changed", "information_changed", true, undefined, ["정보가 달라요", "信息有变化", "Info has changed", "情報が違う"]),
  option("closed", "closed", true, undefined, ["휴무·폐점", "休息或停业", "Closed", "休業・閉店"], true),
  option("ordering-failed", "ordering_failed", true, undefined, ["메뉴 주문 실패", "点餐失败", "Could not order", "注文できなかった"], true),
  option("minimum-order", "minimum_order", true, undefined, ["최소 주문 있음", "有最低点餐", "Minimum order", "最低注文あり"], true),
  option("cash-only", "cash_only", true, undefined, ["현금만 가능", "仅收现金", "Cash only", "現金のみ"], true),
  option("no-menu", "no_foreign_menu", true, undefined, ["외국어 메뉴 없음", "没有外语菜单", "No foreign menu", "外国語メニューなし"], true),
  option("restroom-problem", "restroom_problem", true, undefined, ["화장실 문제", "洗手间不便", "Restroom problem", "トイレ問題"], true),
  option("transport", "transport_difficult", true, undefined, ["교통 불편", "交通不便", "Hard to reach", "アクセス不便"], true),
  option("too-spicy", "too_spicy", true, undefined, ["너무 매움", "太辣", "Too spicy", "辛すぎる"], true),
  option("too-oily", "too_oily", true, undefined, ["너무 느끼함", "太油腻", "Too oily", "脂っこすぎる"], true),
  option("portion", "portion_mismatch", true, undefined, ["양이 맞지 않음", "份量不合适", "Portion mismatch", "量が合わない"], true),
];

export function TravelerVerification({ placeId, placeName, locale, coordinates, compact = false }: TravelerVerificationProps) {
  const { session } = useAuth();
  const text = copy[locale];
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TravelerFact[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [nearbyConfirmed, setNearbyConfirmed] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mapReturn, setMapReturn] = useState(false);
  const [visited, setVisited] = useState(false);

  useEffect(() => {
    setMapReturn(wasMapOpenedRecently(placeId));
    setVisited(wasTravelerVisitSubmitted(placeId));
  }, [placeId, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const selectedKeys = useMemo(() => new Set(selected.map((fact) => `${fact.fact_type}:${String(fact.fact_value)}`)), [selected]);

  function toggle(optionValue: FactOption) {
    setStatus("");
    setSelected((current) => {
      const key = `${optionValue.fact_type}:${String(optionValue.fact_value)}`;
      if (current.some((fact) => `${fact.fact_type}:${String(fact.fact_value)}` === key)) {
        return current.filter((fact) => `${fact.fact_type}:${String(fact.fact_value)}` !== key);
      }
      const withoutGroup = optionValue.group ? current.filter((fact) => fact.fact_type !== optionValue.fact_type) : current;
      if (withoutGroup.length >= 8) {
        setStatus(text.maxFacts);
        return withoutGroup;
      }
      return [...withoutGroup, { fact_type: optionValue.fact_type, fact_value: optionValue.fact_value }];
    });
  }

  function confirmNearby() {
    if (!coordinates || !navigator.geolocation) {
      setLocationStatus(text.locationUnavailable);
      return;
    }
    setLocationStatus(text.locationChecking);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = calculateDistanceMeters(coordinates, { latitude: position.coords.latitude, longitude: position.coords.longitude });
        if (distance <= 500) {
          setNearbyConfirmed(true);
          setLocationStatus(text.locationConfirmed);
        } else {
          setNearbyConfirmed(false);
          setLocationStatus(text.locationFar);
        }
      },
      () => setLocationStatus(text.locationDenied),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 },
    );
  }

  async function submit() {
    if (!selected.length || submitting) return;
    setSubmitting(true);
    setStatus("");
    try {
      const response = await fetch("/api/traveler-verifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ placeId, locale, nearbyConfirmed, facts: selected }),
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "verification_failed");
      rememberTravelerVisit(placeId);
      window.dispatchEvent(new CustomEvent("place-visit-change", { detail: { placeId } }));
      setVisited(true);
      setSelected([]);
      setStatus(text.success);
    } catch (error) {
      const code = error instanceof Error ? error.message : "verification_failed";
      setStatus(code === "rate_limited" ? text.rateLimited : code === "verification_not_configured" ? text.notConfigured : text.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {compact ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-50 px-3 text-sm font-black text-teal-800 ring-1 ring-teal-100">
          {visited ? <Check size={16} aria-hidden="true" /> : <MapPinCheck size={16} aria-hidden="true" />}
          {visited ? text.completed : text.trigger}
        </button>
      ) : (
        <section className="mt-6 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-teal-700 ring-1 ring-teal-100"><MapPinCheck size={20} aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-teal-700">{mapReturn ? text.mapReturn : text.eyebrow}</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">{text.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{text.description}</p>
              <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-black text-white">
                {visited ? <Check size={17} aria-hidden="true" /> : <MapPinCheck size={17} aria-hidden="true" />}
                {visited ? text.completed : text.trigger}
              </button>
            </div>
          </div>
        </section>
      )}

      {open ? (
        <div className="fixed inset-0 z-[70] bg-slate-950/45 px-3 py-4 backdrop-blur-sm sm:grid sm:place-items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`traveler-check-${placeId}`} className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-teal-700">{placeName}</p>
                <h2 id={`traveler-check-${placeId}`} className="mt-1 text-xl font-black text-slate-950">{text.modalTitle}</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">{text.modalDescription}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700" aria-label={text.close}><X size={20} aria-hidden="true" /></button>
            </header>

            <div className="overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <div className="flex flex-wrap gap-2">
                {options.filter((item) => showMore || !item.secondary).map((item) => {
                  const active = selectedKeys.has(`${item.fact_type}:${String(item.fact_value)}`);
                  return <button key={item.id} type="button" aria-pressed={active} onClick={() => toggle(item)} className={`min-h-11 rounded-full px-3 text-sm font-bold ring-1 transition ${active ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-slate-700 ring-slate-200"}`}>{active ? <Check size={14} className="mr-1 inline" aria-hidden="true" /> : null}{item.label[locale]}</button>;
                })}
              </div>
              <button type="button" onClick={() => setShowMore((current) => !current)} className="mt-3 min-h-11 text-sm font-black text-slate-700 underline underline-offset-4">{showMore ? text.less : text.more}</button>

              <div className="mt-4 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-sm font-black text-slate-900">{text.locationTitle}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{text.locationReason}</p>
                <button type="button" disabled={nearbyConfirmed} onClick={confirmNearby} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 text-sm font-black text-slate-800 ring-1 ring-slate-200 disabled:text-teal-700">
                  {nearbyConfirmed ? <BadgeCheck size={17} aria-hidden="true" /> : <LocateFixed size={17} aria-hidden="true" />}{nearbyConfirmed ? text.locationConfirmed : text.locationButton}
                </button>
                {locationStatus ? <p aria-live="polite" className="mt-2 text-xs font-bold text-slate-600">{locationStatus}</p> : null}
              </div>

              <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><p>{session ? text.authPrivacy : text.guestPrivacy}</p></div>
              {status ? <p aria-live="polite" className={`mt-4 rounded-lg px-3 py-2 text-sm font-bold ${visited && status === text.success ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-900"}`}>{status}</p> : null}
              <button type="button" disabled={!selected.length || submitting} onClick={() => void submit()} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45">
                <Send size={17} aria-hidden="true" />{submitting ? text.submitting : `${text.submit}${selected.length ? ` (${selected.length})` : ""}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function option(id: string, fact_type: TravelerFactType, fact_value: TravelerFact["fact_value"], group: string | undefined, labels: [string, string, string, string], secondary = false): FactOption {
  return { id, fact_type, fact_value, group, secondary, label: { ko: labels[0], zh: labels[1], en: labels[2], ja: labels[3] } };
}

const copy = {
  ko: { eyebrow: "10초 현장 확인", mapReturn: "지도를 연 뒤 돌아오셨나요?", title: "실제로 방문했어요", description: "확인한 것만 골라 알려주세요. 전부 답할 필요가 없습니다.", trigger: "실제로 방문했어요", completed: "방문 확인 완료", modalTitle: "지금 상태 확인", modalDescription: "확인한 항목만 최대 8개 선택하세요.", more: "실패 이유 더 보기", less: "간단 항목만 보기", close: "닫기", maxFacts: "한 번에 최대 8개까지 선택할 수 있습니다.", locationTitle: "장소 근처에서 확인했나요? (선택)", locationReason: "근처 확인의 신뢰도를 높이기 위해 한 번만 위치를 확인합니다. 정확한 위치는 서버에 보내거나 저장하지 않습니다.", locationButton: "현재 위치로 근처 확인", locationChecking: "현재 위치와 장소 사이 거리를 이 기기에서 확인 중입니다.", locationConfirmed: "장소 근처 확인됨", locationFar: "현재 위치가 장소에서 500m보다 멉니다. 위치 확인 없이도 제출할 수 있습니다.", locationDenied: "위치 권한을 사용하지 않았습니다. 일반 제보로 제출할 수 있습니다.", locationUnavailable: "이 기기에서는 위치를 확인할 수 없습니다.", authPrivacy: "계정 제보는 익명 제보와 다른 신뢰 가중치로 검수됩니다. 승인 전 공개 정보에 반영되지 않습니다.", guestPrivacy: "로그인 없이 제출할 수 있습니다. 반복 제출 제한을 위한 무작위 기기 식별값의 해시만 저장하며 정확한 위치는 저장하지 않습니다.", submit: "확인 제출", submitting: "제출 중", success: "접수됐습니다. 내 확인이 관리자 검수 후 다음 여행자의 실패를 줄이는 데 사용됩니다.", rateLimited: "최근 이 장소를 이미 확인했거나 제출 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.", notConfigured: "현장 확인 기능의 서버 설정이 아직 완료되지 않았습니다.", failed: "제출하지 못했습니다. 선택 내용은 화면에 남아 있습니다." },
  zh: { eyebrow: "10秒现场确认", mapReturn: "从地图回来了吗？", title: "我实际去过", description: "只选择你确认过的项目，不需要全部回答。", trigger: "我实际去过", completed: "已提交到访确认", modalTitle: "确认当前情况", modalDescription: "最多选择8项，只选你确认过的内容。", more: "查看更多踩坑原因", less: "只看常用项目", close: "关闭", maxFacts: "一次最多选择8项。", locationTitle: "在店铺附近确认？（可选）", locationReason: "仅在本机计算你与店铺的距离，不会向服务器发送或保存精确位置。", locationButton: "用当前位置确认附近", locationChecking: "正在本机计算与店铺的距离。", locationConfirmed: "已确认在店铺附近", locationFar: "当前位置距离店铺超过500米，仍可作为普通反馈提交。", locationDenied: "未使用定位权限，仍可提交普通反馈。", locationUnavailable: "此设备无法确认位置。", authPrivacy: "账号反馈与匿名反馈使用不同的审核权重，审核通过前不会更新公开信息。", guestPrivacy: "无需登录。仅保存用于限制重复提交的随机设备标识哈希，不保存精确位置。", submit: "提交确认", submitting: "提交中", success: "已提交。管理员审核后，你的确认会帮助下一位旅行者避坑。", rateLimited: "最近已确认过此地点或达到提交上限，请稍后再试。", notConfigured: "现场确认的服务器设置尚未完成。", failed: "提交失败，已选内容仍保留在页面上。" },
  en: { eyebrow: "10-second field check", mapReturn: "Back from the map?", title: "I actually visited", description: "Choose only what you confirmed. You do not need to answer everything.", trigger: "I actually visited", completed: "Visit submitted", modalTitle: "Confirm the current situation", modalDescription: "Select up to eight things you personally confirmed.", more: "More failure reasons", less: "Show common items", close: "Close", maxFacts: "You can select up to eight items at once.", locationTitle: "Confirm near this place? (optional)", locationReason: "Distance is calculated once on this device. Exact coordinates are never sent to or stored on the server.", locationButton: "Check with current location", locationChecking: "Calculating distance on this device.", locationConfirmed: "Nearby visit confirmed", locationFar: "You are more than 500m away. You can still submit a general report.", locationDenied: "Location was not used. You can still submit a general report.", locationUnavailable: "Location is unavailable on this device.", authPrivacy: "Account reports and anonymous reports have different moderation weight. Nothing changes publicly before approval.", guestPrivacy: "No sign-in is required. Only a hash of a random device ID is stored to limit repeats; exact location is not stored.", submit: "Submit confirmation", submitting: "Submitting", success: "Submitted. After moderation, your check can help the next traveler avoid a failed visit.", rateLimited: "You recently checked this place or reached the submission limit. Please try later.", notConfigured: "The field verification server setup is not complete yet.", failed: "Submission failed. Your selections remain on this screen." },
  ja: { eyebrow: "10秒の現地確認", mapReturn: "地図から戻りましたか？", title: "実際に訪問しました", description: "確認できた項目だけ選んでください。すべて回答する必要はありません。", trigger: "実際に訪問しました", completed: "訪問確認を送信済み", modalTitle: "現在の状況を確認", modalDescription: "実際に確認した項目を最大8件選択してください。", more: "失敗理由をもっと見る", less: "よく使う項目のみ", close: "閉じる", maxFacts: "一度に選べるのは最大8件です。", locationTitle: "スポット付近で確認しますか？（任意）", locationReason: "距離は端末内で一度だけ計算します。正確な位置をサーバーへ送信・保存しません。", locationButton: "現在地で付近を確認", locationChecking: "端末内でスポットまでの距離を確認中です。", locationConfirmed: "スポット付近を確認済み", locationFar: "現在地は500m以上離れています。位置確認なしでも投稿できます。", locationDenied: "位置情報は使用しませんでした。通常の投稿は可能です。", locationUnavailable: "この端末では位置を確認できません。", authPrivacy: "アカウント投稿と匿名投稿は異なる重みで審査され、承認前に公開情報へ反映されません。", guestPrivacy: "ログイン不要です。重複投稿を制限するランダムな端末IDのハッシュのみ保存し、正確な位置は保存しません。", submit: "確認を送信", submitting: "送信中", success: "受け付けました。審査後、次の旅行者の失敗を減らすために役立てます。", rateLimited: "最近この場所を確認したか、投稿上限に達しました。時間をおいて再試行してください。", notConfigured: "現地確認機能のサーバー設定がまだ完了していません。", failed: "送信できませんでした。選択内容は画面に残っています。" },
} satisfies Record<Locale, Record<string, string>>;
