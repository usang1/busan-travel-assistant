import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  HelpCircle,
  Languages,
  Luggage,
  MapPin,
  Soup,
  Star,
  UserRound,
  WalletCards,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  buildChinaPlaceSummary,
  minimumOrderLabel,
  ratingHelp,
  tristateLabel,
  waitingLabel,
  type ChinaRatingDisplay,
} from "@/lib/place-china/format";
import type { ChinaMinimumOrderPolicy, ChinaWaitingLevel, PlaceFactTristate, PlaceWithRelations } from "@/types/database";

type PlaceChinaDecisionPanelProps = {
  place: PlaceWithRelations;
  openingText: string;
  priceText: string;
};

type FactTone = "yes" | "no" | "unknown" | "neutral";

const factToneClass: Record<FactTone, string> = {
  yes: "bg-teal-50 text-teal-800 ring-teal-100",
  no: "bg-rose-50 text-rose-800 ring-rose-100",
  unknown: "bg-slate-50 text-slate-700 ring-slate-200",
  neutral: "bg-sky-50 text-sky-800 ring-sky-100",
};

const factIcon: Record<Exclude<FactTone, "neutral">, LucideIcon> = {
  yes: CheckCircle2,
  no: XCircle,
  unknown: HelpCircle,
};

export function PlaceChinaDecisionPanel({ place, openingText, priceText }: PlaceChinaDecisionPanelProps) {
  const info = place.china_info;
  const chinaSummary = buildChinaPlaceSummary(info);
  const recommendation = chinaSummary.ratings.find((rating) => rating.key === "chinese_taste_score");
  const tasteRatings = chinaSummary.ratings.filter((rating) => rating.key !== "chinese_taste_score");
  const walkMinutes = info?.subway_walk_minutes ?? place.walking_minutes;
  const minimumOrder = minimumOrderLabel(info?.minimum_order_policy, info?.minimum_order_note);

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-[28px] bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-teal-100">中国游客决策卡</p>
            <h2 className="mt-2 text-2xl font-black tracking-normal">值得专程去吗？</h2>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
            <p className="text-xs font-bold text-slate-300">中国游客推荐度</p>
            <div className="mt-1 flex items-center gap-2">
              <StarRating value={recommendation?.value ?? null} />
              <span className="text-sm font-black">{recommendation?.zhLabel ?? "暂未确认"}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <TopMetric icon={CircleDollarSign} label="价格" value={priceText} />
          <TopMetric icon={Clock3} label="营业" value={openingText} />
          <TopMetric icon={MapPin} label="最近地铁" value={`${place.nearest_station} ${place.nearest_exit}`} />
          <TopMetric icon={Star} label="收藏" value={`${place.save_count ?? 0}`} />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-300">从地铁站步行约 {walkMinutes} 分钟</p>
      </div>

      <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <Soup size={21} className="text-teal-700" aria-hidden="true" />
          <h2 className="text-xl font-black tracking-normal text-slate-950">中国人口味</h2>
        </div>
        <div className="mt-4 grid gap-3">
          {tasteRatings.map((rating) => (
            <TasteRatingRow key={rating.key} rating={rating} />
          ))}
        </div>
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-base leading-7 text-slate-700">{chinaSummary.summary}</p>
      </div>

      <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <AlertTriangle size={21} className="text-amber-600" aria-hidden="true" />
          <h2 className="text-xl font-black tracking-normal text-slate-950">去之前先看</h2>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <FactPill icon={Languages} label="中文菜单" value={info?.chinese_menu} />
          <FactPill icon={WalletCards} label="海外信用卡" value={info?.foreign_card} />
          <FactPill icon={WalletCards} label="支付宝" value={info?.alipay} />
          <FactPill icon={WalletCards} label="微信支付" value={info?.wechat_pay} />
          <FactPill icon={UserRound} label="一个人" value={info?.solo_friendly} yesText="可以" noText="不太适合" />
          <FactPill icon={Luggage} label="大行李箱" value={info?.luggage_friendly} yesText="方便" noText="不方便" />
          <FactPill icon={MapPin} label="店内厕所" value={info?.toilet_available} yesText="可用" noText="暂无" />
          <FactPill
            icon={Clock3}
            label="预约"
            value={info?.reservation_required}
            yesText="建议预约"
            noText="一般不需要"
            yesTone="no"
            noTone="yes"
          />
          <StaticFact icon={Clock3} label="等位" value={formatWaitingFact(info?.waiting_level)} tone={waitingTone(info?.waiting_level)} />
          <StaticFact icon={UserRound} label="最低点餐" value={minimumOrder} tone={minimumOrderTone(info?.minimum_order_policy)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {chinaSummary.tags.length ? (
            chinaSummary.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                {tag}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">信息确认中</span>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-amber-50 p-4">
          <p className="text-sm font-black text-amber-900">重点提醒</p>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
            {chinaSummary.warnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        </div>

        {chinaSummary.unknownFacts.length ? (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-900">暂未确认</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {chinaSummary.unknownFacts.slice(0, 8).map((fact) => (
                <span key={fact} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                  {fact}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TopMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
      <Icon size={17} className="text-teal-100" aria-hidden="true" />
      <p className="mt-2 text-xs font-bold text-slate-300">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}

function TasteRatingRow({ rating }: { rating: ChinaRatingDisplay }) {
  return (
    <div className="grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[96px_1fr] sm:items-center">
      <p className="text-sm font-black text-slate-950">{rating.label}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarRating value={rating.value} />
        <span className="text-sm font-bold text-slate-700">{rating.zhLabel}</span>
        <span className="text-xs font-semibold text-slate-500">{rating.value ? ratingHelp[rating.key].values[rating.value].ko : "확인 필요"}</span>
      </div>
    </div>
  );
}

function StarRating({ value }: { value: number | null }) {
  return (
    <span className="inline-flex w-[90px] items-center gap-0.5" aria-label={value ? `${value}/5` : "暂未确认"}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = value !== null && index < value;

        return (
          <Star
            key={index}
            size={16}
            className={filled ? "text-amber-400" : "text-slate-300"}
            fill={filled ? "currentColor" : "none"}
            aria-hidden="true"
          />
        );
      })}
    </span>
  );
}

function FactPill({
  icon: Icon,
  label,
  value,
  yesText,
  noText,
  yesTone,
  noTone,
}: {
  icon: LucideIcon;
  label: string;
  value: PlaceFactTristate | null | undefined;
  yesText?: string;
  noText?: string;
  yesTone?: Exclude<FactTone, "neutral">;
  noTone?: Exclude<FactTone, "neutral">;
}) {
  const tone = value === "yes" ? (yesTone ?? "yes") : value === "no" ? (noTone ?? "no") : "unknown";
  const StatusIcon = factIcon[tone];
  const text = value === "yes" ? (yesText ?? tristateLabel(value)) : value === "no" ? (noText ?? tristateLabel(value)) : "暂未确认";

  return (
    <div className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl px-3 py-2 ring-1 ${factToneClass[tone]}`}>
      <div className="flex min-w-0 items-center gap-2">
        <Icon size={17} className="shrink-0" aria-hidden="true" />
        <span className="truncate text-sm font-black">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-sm font-black">
        <StatusIcon size={16} aria-hidden="true" />
        <span>{text}</span>
      </div>
    </div>
  );
}

function StaticFact({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: FactTone }) {
  return (
    <div className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl px-3 py-2 ring-1 ${factToneClass[tone]}`}>
      <div className="flex min-w-0 items-center gap-2">
        <Icon size={17} className="shrink-0" aria-hidden="true" />
        <span className="truncate text-sm font-black">{label}</span>
      </div>
      <span className="shrink-0 text-sm font-black">{value}</span>
    </div>
  );
}

function formatWaitingFact(value: ChinaWaitingLevel | null | undefined) {
  if (!value || value === "unknown") return "暂未确认";
  if (value === "none") return "基本不用等";
  if (value === "varies") return "随时段变化";
  return `约${waitingLabel(value)}`;
}

function waitingTone(value: ChinaWaitingLevel | null | undefined): FactTone {
  if (!value || value === "unknown") return "unknown";
  if (value === "long" || value === "extreme") return "no";
  return "neutral";
}

function minimumOrderTone(value: ChinaMinimumOrderPolicy | null | undefined): FactTone {
  if (!value || value === "unknown") return "unknown";
  if (value === "none") return "yes";
  return "no";
}
