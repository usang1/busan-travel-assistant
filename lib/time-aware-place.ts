import type { Locale } from "@/lib/i18n";
import type { PlaceOperatingProfileRecord, PlaceWithRelations } from "@/types/database";

export type TimeAwareCode =
  | "unknown"
  | "open_at_arrival"
  | "closes_before_arrival"
  | "last_order_soon"
  | "after_last_order"
  | "opens_later_today"
  | "closed_today"
  | "temporary_closed";

export type TimeAwarePlaceState = {
  hasStructuredData: boolean;
  code: TimeAwareCode;
  arrivalAt: Date;
  travelMinutes: number;
  openNow: boolean | null;
  openAtArrival: boolean | null;
  canVisitWithinHour: boolean | null;
  recommendedAtArrival: boolean | null;
  avoidAtArrival: boolean | null;
  photoTimeAtArrival: boolean | null;
  sunsetPhotoTimeAtArrival: boolean | null;
  minutesUntilPhotoWindowEnd: number | null;
  nightRecommended: boolean | null;
  seasonAvailable: boolean | null;
  seasonNote: string;
  waitMinutesInOneHour: number | null;
  selloutRiskAtArrival: number | null;
  minutesUntilClose: number | null;
  minutesUntilLastOrder: number | null;
  nextOpenTime: string | null;
  temporaryClosureReason: string;
};

type SeoulParts = { year: number; month: number; day: number; weekday: number; hour: number; minute: number; dateKey: string };
type ActiveWindow = { openMinute: number; closeMinute: number; rowOpen: string };

export function getTimeAwarePlaceState(
  place: Pick<PlaceWithRelations, "operating_profile">,
  options: { now?: Date; travelMinutes?: number | null; scheduledAt?: Date } = {},
): TimeAwarePlaceState {
  const now = options.now ?? new Date();
  const travelMinutes = Math.max(0, Math.round(options.travelMinutes ?? 0));
  const arrivalAt = options.scheduledAt ?? new Date(now.getTime() + travelMinutes * 60_000);
  const profile = place.operating_profile;
  const empty = emptyState(arrivalAt, travelMinutes);

  if (!profile || !["verified", "partially_verified"].includes(profile.verification_status) || profile.structured_operating_hours.length === 0) return empty;

  const current = evaluateMoment(profile, now);
  const arrival = evaluateMoment(profile, arrivalAt);
  const withinHour = evaluateMoment(profile, new Date(now.getTime() + 60 * 60_000));
  const arrivalParts = getSeoulParts(arrivalAt);
  const inRecommendedRange = rangeMatch(profile.recommended_time_ranges, arrivalParts);
  const inAvoidRange = rangeMatch(profile.avoid_time_ranges, arrivalParts);
  const inPhotoRange = rangeMatch(profile.photo_time_ranges, arrivalParts);
  const activePhotoRange = matchingRange(profile.photo_time_ranges, arrivalParts);
  const activeSunsetRange = activePhotoRange && /sunset|일몰|日落|夕日/i.test(activePhotoRange.note ?? "") ? activePhotoRange : null;
  const nightRanges = profile.recommended_time_ranges.filter((range) => toMinutes(range.start) >= 18 * 60);
  const season = getSeasonState(profile, arrivalParts.month);
  const waitMinutesInOneHour = hourlyValue(profile.wait_time_by_weekday_hour, getSeoulParts(new Date(arrivalAt.getTime() + 60 * 60_000)));
  const selloutRiskAtArrival = hourlyValue(profile.sellout_risk_by_hour, arrivalParts);
  const minutesUntilLastOrder = arrival.window && profile.last_order_time
    ? minutesUntilTime(profile.last_order_time, arrival.window, arrival.localMinute)
    : null;
  const withinHourLastOrder = withinHour.window && profile.last_order_time
    ? minutesUntilTime(profile.last_order_time, withinHour.window, withinHour.localMinute)
    : null;
  const openForVisit = arrival.open && (minutesUntilLastOrder === null || minutesUntilLastOrder >= 0);

  let code: TimeAwareCode = "closed_today";
  if (arrival.temporaryClosure) code = "temporary_closed";
  else if (current.open && !arrival.open) code = "closes_before_arrival";
  else if (arrival.open && minutesUntilLastOrder !== null && minutesUntilLastOrder < 0) code = "after_last_order";
  else if (arrival.open && minutesUntilLastOrder !== null && minutesUntilLastOrder <= 60) code = "last_order_soon";
  else if (arrival.open) code = "open_at_arrival";
  else if (arrival.nextOpenTime) code = "opens_later_today";

  return {
    hasStructuredData: true,
    code,
    arrivalAt,
    travelMinutes,
    openNow: current.open,
    openAtArrival: openForVisit,
    canVisitWithinHour: withinHour.open && (withinHourLastOrder === null || withinHourLastOrder >= 0),
    recommendedAtArrival: profile.recommended_time_ranges.length ? openForVisit && inRecommendedRange && !inAvoidRange : null,
    avoidAtArrival: profile.avoid_time_ranges.length ? inAvoidRange : null,
    photoTimeAtArrival: profile.photo_time_ranges.length ? inPhotoRange : null,
    sunsetPhotoTimeAtArrival: activeSunsetRange ? true : profile.photo_time_ranges.some((range) => /sunset|일몰|日落|夕日/i.test(range.note ?? "")) ? false : null,
    minutesUntilPhotoWindowEnd: activeSunsetRange ? minutesUntilRangeEnd(activeSunsetRange, arrivalParts) : null,
    nightRecommended: nightRanges.length ? rangeMatch(nightRanges, arrivalParts) : null,
    seasonAvailable: season.available,
    seasonNote: season.note,
    waitMinutesInOneHour,
    selloutRiskAtArrival,
    minutesUntilClose: arrival.window ? arrival.window.closeMinute - arrival.localMinute : null,
    minutesUntilLastOrder,
    nextOpenTime: arrival.nextOpenTime,
    temporaryClosureReason: arrival.temporaryClosure?.reason ?? "",
  };
}

export function formatTimeAwarePrimary(state: TimeAwarePlaceState, locale: Locale) {
  if (!state.hasStructuredData) return { text: unknownCopy[locale], tone: "neutral" as const };
  const arrival = formatSeoulTime(state.arrivalAt, locale);
  const prefix = state.travelMinutes > 0
    ? { ko: `지금 출발하면 ${arrival} 도착`, zh: `现在出发，${arrival}到达`, en: `Leave now · arrive ${arrival}`, ja: `今出発すると${arrival}到着` }[locale]
    : { ko: `${arrival} 기준`, zh: `以${arrival}为准`, en: `At ${arrival}`, ja: `${arrival}時点` }[locale];
  const status = statusCopy[state.code][locale];
  const suffix = state.code === "last_order_soon" && state.minutesUntilLastOrder !== null
    ? { ko: `라스트오더까지 ${state.minutesUntilLastOrder}분`, zh: `距最后点餐${state.minutesUntilLastOrder}分钟`, en: `${state.minutesUntilLastOrder} min to last order`, ja: `ラストオーダーまで${state.minutesUntilLastOrder}分` }[locale]
    : status;
  return { text: `${prefix} · ${suffix}`, tone: toneForCode(state.code) };
}

export function getTimeAwareNotices(state: TimeAwarePlaceState, locale: Locale) {
  if (!state.hasStructuredData) return [];
  const notices: string[] = [];
  if (state.avoidAtArrival) notices.push({ ko: "피해야 할 시간대에 도착합니다.", zh: "到达时间属于建议避开的时段。", en: "Arrival falls in a time best avoided.", ja: "避けた方がよい時間帯に到着します。" }[locale]);
  if (state.waitMinutesInOneHour !== null) notices.push({ ko: `1시간 뒤 예상 대기 ${state.waitMinutesInOneHour}분`, zh: `1小时后预计等位${state.waitMinutesInOneHour}分钟`, en: `Expected wait in 1 hour: ${state.waitMinutesInOneHour} min`, ja: `1時間後の予想待ち時間 ${state.waitMinutesInOneHour}分` }[locale]);
  if ((state.selloutRiskAtArrival ?? 0) >= 4) notices.push({ ko: "도착 시간대에 재료 소진 위험이 높습니다.", zh: "到达时段食材售罄风险较高。", en: "Sellout risk is high around arrival time.", ja: "到着時間帯は売切れリスクが高めです。" }[locale]);
  if (state.photoTimeAtArrival) notices.push({ ko: "사진 촬영 추천 시간대입니다.", zh: "到达时段适合拍照。", en: "Arrival is within a recommended photo window.", ja: "到着時間は写真撮影のおすすめ時間帯です。" }[locale]);
  if (state.sunsetPhotoTimeAtArrival && state.minutesUntilPhotoWindowEnd !== null) notices.push({ ko: `일몰 촬영 추천 시간 종료까지 ${state.minutesUntilPhotoWindowEnd}분 남았습니다.`, zh: `距日落拍摄推荐时段结束还有${state.minutesUntilPhotoWindowEnd}分钟。`, en: `${state.minutesUntilPhotoWindowEnd} min remain in the sunset photo window.`, ja: `日没撮影のおすすめ時間終了まで${state.minutesUntilPhotoWindowEnd}分です。` }[locale]);
  if (state.nightRecommended) notices.push({ ko: "야간 방문 추천 시간대입니다.", zh: "夜间到访更合适。", en: "This is a recommended night-time window.", ja: "夜の訪問におすすめの時間帯です。" }[locale]);
  if (state.seasonAvailable === false) notices.push({ ko: "현재 계절에는 이용이 제한될 수 있습니다.", zh: "当前季节可能无法体验。", en: "This may be unavailable this season.", ja: "現在の季節は利用できない場合があります。" }[locale]);
  if (state.temporaryClosureReason && locale === "ko") notices.push(state.temporaryClosureReason);
  return notices;
}

export function getTimeAwareWarningCodes(state: TimeAwarePlaceState) {
  const codes: string[] = [];
  if (["closes_before_arrival", "closed_today", "temporary_closed", "after_last_order"].includes(state.code)) codes.push(state.code);
  if (state.recommendedAtArrival === false) codes.push("outside_recommended_time");
  if (state.seasonAvailable === false) codes.push("season_unavailable");
  return codes;
}

export function formatTimeAwareWarning(code: string, locale: Locale) {
  return warningCopy[code]?.[locale] ?? warningCopy.closed_today[locale];
}

export function seoulDateTimeToDate(dateKey: string, time: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
}

export function addSeoulDays(dateKey: string, days: number) {
  const date = seoulDateTimeToDate(dateKey, "12:00");
  date.setUTCDate(date.getUTCDate() + days);
  return getSeoulParts(date).dateKey;
}

export function getSeoulDateKey(date = new Date()) {
  return getSeoulParts(date).dateKey;
}

export function hasTimeFilterData(place: Pick<PlaceWithRelations, "operating_profile">, filter: "morning" | "sunset" | "night" | "after22" | "lowWait" | "monday") {
  const profile = place.operating_profile;
  if (!profile || !hasReviewedTimeData(place)) return false;
  if (filter === "morning") return profile.recommended_time_ranges.some((range) => toMinutes(range.start) < 12 * 60);
  if (filter === "sunset") return profile.photo_time_ranges.some((range) => /sunset|일몰|日落|夕日/i.test(range.note ?? ""));
  if (filter === "night") return profile.recommended_time_ranges.some((range) => toMinutes(range.start) >= 18 * 60);
  if (filter === "after22") return profile.structured_operating_hours.some((day) => !day.closed && (day.overnight || toMinutes(day.close) >= 22 * 60));
  if (filter === "lowWait") return Object.values(profile.wait_time_by_weekday_hour).some((value) => typeof value === "number" && value <= 10);
  return profile.structured_operating_hours.some((day) => day.weekday === 1 && !day.closed);
}

export function hasReviewedTimeData(place: Pick<PlaceWithRelations, "operating_profile">) {
  const profile = place.operating_profile;
  return Boolean(profile && ["verified", "partially_verified"].includes(profile.verification_status) && profile.structured_operating_hours.length);
}

function emptyState(arrivalAt: Date, travelMinutes: number): TimeAwarePlaceState {
  return { hasStructuredData: false, code: "unknown", arrivalAt, travelMinutes, openNow: null, openAtArrival: null, canVisitWithinHour: null, recommendedAtArrival: null, avoidAtArrival: null, photoTimeAtArrival: null, sunsetPhotoTimeAtArrival: null, minutesUntilPhotoWindowEnd: null, nightRecommended: null, seasonAvailable: null, seasonNote: "", waitMinutesInOneHour: null, selloutRiskAtArrival: null, minutesUntilClose: null, minutesUntilLastOrder: null, nextOpenTime: null, temporaryClosureReason: "" };
}

function evaluateMoment(profile: PlaceOperatingProfileRecord, date: Date) {
  const parts = getSeoulParts(date);
  const closure = profile.temporary_closures.find((item) => item.start_date <= parts.dateKey && item.end_date >= parts.dateKey);
  if (closure) return { open: false, window: null, localMinute: parts.hour * 60 + parts.minute, nextOpenTime: null, temporaryClosure: closure };
  const localMinute = parts.hour * 60 + parts.minute;
  const today = profile.structured_operating_hours.find((item) => item.weekday === parts.weekday);
  const previous = profile.structured_operating_hours.find((item) => item.weekday === (parts.weekday + 6) % 7);
  let window: ActiveWindow | null = null;
  if (previous && !previous.closed && previous.overnight && localMinute < toMinutes(previous.close)) {
    window = { openMinute: toMinutes(previous.open) - 1440, closeMinute: toMinutes(previous.close), rowOpen: previous.open };
  } else if (today && !today.closed) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close) + (today.overnight ? 1440 : 0);
    if (localMinute >= open && localMinute < close) window = { openMinute: open, closeMinute: close, rowOpen: today.open };
  }
  const nextOpenTime = !window && today && !today.closed && localMinute < toMinutes(today.open) ? today.open : null;
  return { open: Boolean(window), window, localMinute, nextOpenTime, temporaryClosure: null };
}

function minutesUntilTime(value: string, window: ActiveWindow, currentMinute: number) {
  let target = toMinutes(value);
  if (window.openMinute < 0 && target > window.closeMinute) target -= 1440;
  if (window.closeMinute > 1440 && target < toMinutes(window.rowOpen)) target += 1440;
  return target - currentMinute;
}

function rangeMatch(ranges: PlaceOperatingProfileRecord["recommended_time_ranges"], parts: SeoulParts) {
  return Boolean(matchingRange(ranges, parts));
}

function matchingRange(ranges: PlaceOperatingProfileRecord["recommended_time_ranges"], parts: SeoulParts) {
  const minute = parts.hour * 60 + parts.minute;
  return ranges.find((range) => {
    const start = toMinutes(range.start);
    const end = toMinutes(range.end);
    if (start <= end) return range.weekdays.includes(parts.weekday) && minute >= start && minute <= end;
    return (range.weekdays.includes(parts.weekday) && minute >= start) || (range.weekdays.includes((parts.weekday + 6) % 7) && minute <= end);
  });
}

function minutesUntilRangeEnd(range: PlaceOperatingProfileRecord["photo_time_ranges"][number], parts: SeoulParts) {
  const minute = parts.hour * 60 + parts.minute;
  const start = toMinutes(range.start);
  const end = toMinutes(range.end);
  return Math.max(0, end + (start > end && minute >= start ? 1440 : 0) - minute);
}

function hourlyValue(record: Record<string, number | null>, parts: SeoulParts) {
  const value = record[`${parts.weekday}-${parts.hour}`];
  return typeof value === "number" ? value : null;
}

function getSeasonState(profile: PlaceOperatingProfileRecord, month: number) {
  if (!profile.seasonal_availability.length) return { available: null, note: "" };
  const active = profile.seasonal_availability.find((item) => monthInRange(month, item.start_month, item.end_month));
  return { available: Boolean(active), note: active?.note ?? profile.seasonal_availability.map((item) => item.note).find(Boolean) ?? "" };
}

function monthInRange(month: number, start: number, end: number) {
  return start <= end ? month >= start && month <= end : month >= start || month <= end;
}

function getSeoulParts(date: Date): SeoulParts {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const year = Number(values.year); const month = Number(values.month); const day = Number(values.day);
  return { year, month, day, weekday: weekdays[values.weekday] ?? 0, hour: Number(values.hour), minute: Number(values.minute), dateKey: `${values.year}-${values.month}-${values.day}` };
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatSeoulTime(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function toneForCode(code: TimeAwareCode): "positive" | "warning" | "neutral" {
  if (code === "open_at_arrival") return "positive";
  if (["closes_before_arrival", "last_order_soon", "after_last_order", "temporary_closed"].includes(code)) return "warning";
  return "neutral";
}

const unknownCopy: Record<Locale, string> = { ko: "구조화된 영업정보 확인 중", zh: "结构化营业信息确认中", en: "Structured hours not verified", ja: "構造化営業時間を確認中" };
const statusCopy: Record<TimeAwareCode, Record<Locale, string>> = {
  unknown: unknownCopy,
  open_at_arrival: { ko: "도착 시 영업 중", zh: "到达时营业", en: "Open on arrival", ja: "到着時は営業中" },
  closes_before_arrival: { ko: "도착 전에 마감", zh: "到达前关门", en: "Closes before arrival", ja: "到着前に閉店" },
  last_order_soon: { ko: "라스트오더 임박", zh: "最后点餐临近", en: "Last order soon", ja: "ラストオーダー間近" },
  after_last_order: { ko: "라스트오더 이후 도착", zh: "最后点餐后到达", en: "Arrival after last order", ja: "ラストオーダー後に到着" },
  opens_later_today: { ko: "오늘 다시 영업", zh: "今天稍后营业", en: "Opens later today", ja: "本日このあと営業" },
  closed_today: { ko: "오늘 휴무 또는 영업 종료", zh: "今天休息或已结束营业", en: "Closed today or finished", ja: "本日休業または営業終了" },
  temporary_closed: { ko: "임시휴무", zh: "临时休息", en: "Temporarily closed", ja: "臨時休業" },
};

const warningCopy: Record<string, Record<Locale, string>> = {
  closes_before_arrival: { ko: "도착 전에 영업이 끝날 수 있습니다.", zh: "可能会在到达前停止营业。", en: "The place may close before you arrive.", ja: "到着前に営業が終了する可能性があります。" },
  closed_today: { ko: "예정 시각에는 영업하지 않습니다.", zh: "计划到访时间不营业。", en: "The place is not open at the planned time.", ja: "予定時刻は営業していません。" },
  temporary_closed: { ko: "예정일은 임시휴무로 등록되어 있습니다.", zh: "计划到访日期已登记为临时休业。", en: "A temporary closure is registered for this date.", ja: "予定日は臨時休業として登録されています。" },
  after_last_order: { ko: "예정 도착 시각이 라스트오더 이후입니다.", zh: "预计到达时间已过最后点餐时间。", en: "The planned arrival is after last order.", ja: "到着予定時刻はラストオーダー後です。" },
  outside_recommended_time: { ko: "등록된 추천 시간대가 아닙니다.", zh: "不在已登记的推荐时段内。", en: "This is outside the registered recommended time.", ja: "登録済みのおすすめ時間帯ではありません。" },
  season_unavailable: { ko: "등록된 추천 계절과 맞지 않습니다.", zh: "不符合已登记的推荐季节。", en: "This is outside the registered recommended season.", ja: "登録済みのおすすめ季節ではありません。" },
  insufficient_travel_time: { ko: "이전 장소에서 이동할 시간이 부족할 수 있습니다.", zh: "从上一地点移动的时间可能不足。", en: "There may not be enough travel time from the previous stop.", ja: "前の場所からの移動時間が足りない可能性があります。" },
  distant_route: { ko: "앞 장소와 거리가 멀어 동선을 다시 확인해야 합니다.", zh: "与上一地点距离较远，请重新确认路线。", en: "This stop is far from the previous one; review the route.", ja: "前の場所から遠いため、動線を再確認してください。" },
};
