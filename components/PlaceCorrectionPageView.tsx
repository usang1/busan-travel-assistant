import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { PlaceCorrectionForm } from "@/components/PlaceCorrectionForm";
import {
  getLocalizedMenuItem,
  getPlaceContent,
  type Locale,
  withLocale,
} from "@/lib/i18n";
import { formatPriceRange, formatWon } from "@/lib/place-store";
import { categoryLabels, type PlaceWithRelations } from "@/types/database";

export function PlaceCorrectionPageView({ place, locale }: { place: PlaceWithRelations; locale: Locale }) {
  const copy = pageCopy[locale];
  const content = getPlaceContent(place, locale);
  const currentMenuText = place.menu_items.map((item) => {
    const menu = getLocalizedMenuItem(item, locale);
    return [menu.name, item.price === null ? "" : formatWon(item.price, locale)].filter(Boolean).join(" · ");
  }).join("\n");

  return (
    <main className="safe-bottom mx-auto max-w-2xl px-4 pb-8 pt-5">
      <Link href={withLocale(`/places/${place.slug}`, locale)} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-600">
        <ArrowLeft size={17} aria-hidden="true" />{copy.back}
      </Link>

      <header className="mt-3 border-b border-slate-200 pb-5">
        <p className="text-sm font-black text-teal-700">{copy.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{copy.description}</p>
      </header>

      <section className="my-5 flex items-center gap-4 rounded-[20px] bg-slate-50 p-3 ring-1 ring-slate-200">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-slate-200">
          <Image src={place.thumbnail_url} alt={content.name} fill sizes="80px" className="object-cover" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-slate-950">{content.name}</p>
          {content.secondaryName ? <p className="mt-0.5 truncate text-sm text-slate-500">{content.secondaryName}</p> : null}
          <p className="mt-2 text-xs font-bold text-teal-700">{categoryLabels[place.category][locale]}</p>
          {content.address ? <p className="mt-1 flex items-start gap-1 text-xs leading-5 text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0" />{content.address}</p> : null}
        </div>
      </section>

      <PlaceCorrectionForm
        placeId={place.id}
        locale={locale}
        presentation="standalone"
        currentValues={{
          opening_hours: place.opening_hours,
          menu: currentMenuText,
          menu_price: currentMenuText,
          price_range: formatPriceRange(place, locale),
          phone: place.phone ?? "",
          website: place.website ?? "",
          location: content.address,
        }}
      />
    </main>
  );
}

const pageCopy = {
  ko: { back: "장소 상세로 돌아가기", eyebrow: "이 장소의 영업정보", title: "영업정보 제보", description: "확인한 영업시간, 메뉴, 가격, 전화번호 등의 정보를 알려주세요. 관리자 검수 후 장소 정보에 반영됩니다." },
  zh: { back: "返回地点详情", eyebrow: "该地点的商家信息", title: "补充商家信息", description: "请提供已确认的营业时间、菜单、价格或电话号码等信息。管理员审核后才会更新。" },
  en: { back: "Back to place details", eyebrow: "Business information for this place", title: "Update business information", description: "Share verified hours, menu, prices, phone number, or other details. Updates are published only after administrator review." },
  ja: { back: "スポット詳細に戻る", eyebrow: "この店舗の営業情報", title: "店舗情報を報告", description: "確認した営業時間、メニュー、価格、電話番号などをお知らせください。管理者確認後に反映されます。" },
} satisfies Record<Locale, Record<string, string>>;
