"use client";

import { useState } from "react";
import { CalendarCheck2, Copy, MapPin, Navigation, Soup, type LucideIcon } from "lucide-react";
import { DirectionsButton } from "@/components/DirectionsButton";
import { getRepresentativeMenu } from "@/lib/place-display";
import { verificationDateLabel } from "@/lib/traveler-insights";
import { getPlaceContent, type Locale, ui } from "@/lib/i18n";
import type { Coordinates } from "@/lib/location";
import type { PlaceWithRelations } from "@/types/database";

type PlaceVisitToolsProps = {
  place: PlaceWithRelations;
  locale: Locale;
  coordinates: Coordinates | null;
};

const copy: Record<Locale, {
  title: string;
  koreanName: string;
  copyAddress: string;
  copied: string;
  copyFailed: string;
  taxi: string;
  order: string;
  map: string;
  lastChecked: string;
  correction: string;
}> = {
  zh: { title: "到店前使用", koreanName: "韩文店名", copyAddress: "复制地址", copied: "已复制", copyFailed: "无法复制", taxi: "给司机看", order: "点单句子", map: "地图", lastChecked: "最后确认", correction: "提交修改" },
  en: { title: "Before you go", koreanName: "Korean name", copyAddress: "Copy address", copied: "Copied", copyFailed: "Could not copy", taxi: "Show driver", order: "Order phrase", map: "Map", lastChecked: "Last checked", correction: "Report update" },
  ja: { title: "訪問前に使う", koreanName: "韓国語名", copyAddress: "住所コピー", copied: "コピーしました", copyFailed: "コピーできません", taxi: "運転手に見せる", order: "注文文", map: "地図", lastChecked: "最終確認", correction: "修正投稿" },
  ko: { title: "방문 전 확인", koreanName: "한국어 장소명", copyAddress: "주소 복사", copied: "복사했습니다", copyFailed: "복사할 수 없습니다", taxi: "기사님께 보여줄 문장", order: "대표 메뉴 주문 문장", map: "지도", lastChecked: "마지막 확인일", correction: "정보 수정 제보" },
};

export function PlaceVisitTools({ place, locale, coordinates }: PlaceVisitToolsProps) {
  const text = copy[locale];
  const common = ui[locale].common;
  const content = getPlaceContent(place, locale);
  const representativeMenu = getRepresentativeMenu(place, locale);
  const [status, setStatus] = useState("");
  const address = content.address || place.address_ko || place.address_zh || "";
  const taxiSentence = address
    ? `${address} ${place.name_ko}으로 가주세요.`
    : place.name_ko
      ? `${place.name_ko}으로 가주세요.`
      : common.noInfo;
  const orderSentence = representativeMenu?.orderKo || place.recommended_order_ko.trim() || common.noInfo;
  const verified = verificationDateLabel(place.china_info?.verified_at ?? place.last_verified_at, locale) || common.noInfo;

  async function copyAddress() {
    if (!address || !navigator.clipboard) {
      setStatus(text.copyFailed);
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      setStatus(text.copied);
    } catch {
      setStatus(text.copyFailed);
    }
  }

  return (
    <section className="mt-6 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">{text.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{text.koreanName}</p>
        </div>
        <a href="#place-correction" className="inline-flex min-h-10 items-center rounded-full bg-slate-50 px-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">
          {text.correction}
        </a>
      </div>

      <p className="mt-4 break-words rounded-2xl bg-slate-950 px-4 py-5 text-center text-3xl font-black leading-tight text-white">
        {place.name_ko || common.noInfo}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <VisitFact icon={MapPin} label={ui[locale].placeDetail.location} value={address || common.noInfo} />
        <VisitFact icon={Navigation} label={text.taxi} value={taxiSentence} />
        <VisitFact icon={Soup} label={text.order} value={orderSentence} />
        <VisitFact icon={CalendarCheck2} label={text.lastChecked} value={verified} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void copyAddress()}
          disabled={!address}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Copy size={17} aria-hidden="true" />
          {text.copyAddress}
        </button>
        <DirectionsButton
          placeId={place.id}
          name={content.name || place.name_ko}
          address={address}
          coordinates={coordinates}
          locale={locale}
          className="w-full"
        />
      </div>
      {status ? <p role="status" className="mt-3 text-sm font-bold text-teal-700">{status}</p> : null}
    </section>
  );
}

function VisitFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <Icon size={17} className="text-teal-700" aria-hidden="true" />
      <p className="mt-2 text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-black leading-6 text-slate-950">{value}</p>
    </div>
  );
}
