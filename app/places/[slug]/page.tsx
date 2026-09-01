import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  CreditCard,
  MapPin,
  MessageSquareText,
  Route,
  Soup,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { OrderGuide } from "@/components/OrderGuide";
import { PlaceCorrectionForm } from "@/components/PlaceCorrectionForm";
import { PlaceChinaDecisionPanel } from "@/components/PlaceChinaDecisionPanel";
import { PlaceLocationPanel } from "@/components/PlaceLocationPanel";
import { PlaceViewTracker } from "@/components/PlaceViewTracker";
import { SaveButton } from "@/components/SaveButton";
import { SectionTitle } from "@/components/SectionTitle";
import { ShareButton } from "@/components/ShareButton";
import { StructuredData } from "@/components/StructuredData";
import { TagChip } from "@/components/TagChip";
import { absoluteUrl, siteConfig } from "@/config/site";
import { demoPlaces } from "@/data/demo-places";
import { formatOpeningStatus } from "@/lib/location";
import { buildChinaPlaceSummary } from "@/lib/place-china/format";
import { formatPriceRange, formatWon, getPlaceBySlug } from "@/lib/place-store";
import { categoryLabels } from "@/types/database";

type PlaceDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

const getCachedPlaceBySlug = cache((slug: string) => getPlaceBySlug(slug));

export function generateStaticParams() {
  return demoPlaces.map((place) => ({ slug: place.slug }));
}

export async function generateMetadata({ params }: PlaceDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { place } = await getCachedPlaceBySlug(slug);
  const chinaSummary = buildChinaPlaceSummary(place?.china_info);
  const featureText = chinaSummary.tags.slice(0, 3).join("、");

  const title = place ? `${place.name_zh}｜${place.name_ko}` : "地点详情";
  const description = place
    ? `${place.name_zh}：釜山${categoryLabels[place.category].zh}，${featureText ? `${featureText}。` : ""}${chinaSummary.summary}`
    : "釜山广安里地点详情。";

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/places/${slug}`) },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/places/${slug}`),
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "article",
      images: place?.thumbnail_url ? [{ url: place.thumbnail_url }] : undefined,
    },
  };
}

export default async function PlaceDetailPage({ params }: PlaceDetailPageProps) {
  const { slug } = await params;
  const { place, source, error } = await getCachedPlaceBySlug(slug);

  if (!place) {
    notFound();
  }

  const recommendedMenus = place.menu_items.filter((item) => item.is_recommended);
  const otherMenus = place.menu_items.filter((item) => !item.is_recommended);
  const facilityTags = [
    place.solo_friendly ? "一个人也可以" : null,
    place.luggage_friendly ? "行李OK" : null,
    place.chinese_menu ? "中文菜单" : null,
    place.card_payment ? "可以刷卡" : null,
  ].filter((label): label is string => Boolean(label));
  const opening = formatOpeningStatus(place.opening_hours, "zh");
  const priceText = formatPriceRange(place);
  const currentMenuText = place.menu_items.map((item) => (
    [item.name_zh || item.name_ko, item.price === null ? "" : formatWon(item.price)].filter(Boolean).join(" · ")
  )).join("\n");

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-4">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "TouristAttraction",
          name: `${place.name_zh} / ${place.name_ko}`,
          description: place.short_description_zh,
          image: place.thumbnail_url,
          url: absoluteUrl(`/places/${place.slug}`),
          address: place.address_ko,
          geo:
            place.latitude && place.longitude
              ? {
                  "@type": "GeoCoordinates",
                  latitude: place.latitude,
                  longitude: place.longitude,
                }
              : undefined,
        }}
      />
      <PlaceViewTracker
        locale="zh"
        place={{
          id: place.id,
          slug: place.slug,
          title: place.name_zh,
          subtitle: place.name_ko,
          href: `/places/${place.slug}`,
          imageUrl: place.thumbnail_url,
          category: place.category,
        }}
      />
      <Link href="/places" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
        <ArrowLeft size={17} aria-hidden="true" />
        返回附近推荐
      </Link>

      {error ? <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}

      <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="relative aspect-[4/3] bg-slate-200">
          <Image
            src={place.thumbnail_url}
            alt={`${place.name_zh} / ${place.name_ko}`}
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
            priority
          />
          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm backdrop-blur">
            {categoryLabels[place.category].zh} · {source === "demo" ? "Demo" : "Live"}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <TagChip tone={place.is_active ? "green" : "amber"}>{place.is_active ? "现在可查看" : "暂未开放"}</TagChip>
              <h1 className="mt-3 text-3xl font-black tracking-normal text-slate-950">{place.name_zh}</h1>
              <p className="mt-1 text-base text-slate-500">{place.name_ko}</p>
            </div>
            <SaveButton
              className="h-11 px-3"
              initialSaveCount={place.save_count ?? 0}
              item={{
                id: place.id,
                type: "place",
                titleZh: place.name_zh,
                titleKo: place.name_ko,
                href: `/places/${place.slug}`,
                imageUrl: place.thumbnail_url,
                meta: `${categoryLabels[place.category].zh} · 步行 ${place.walking_minutes}分钟`,
              }}
            />
          </div>
          <div className="mt-4">
            <ShareButton
              title={place.name_zh}
              text={`${place.name_zh} / ${place.name_ko} - ${place.short_description_zh}`}
              url={absoluteUrl(`/places/${place.slug}`)}
              placeId={place.id}
              locale="zh"
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <InfoTile icon={WalletCards} label="价格" value={priceText} />
            <InfoTile icon={Clock3} label="距离" value={`步行 ${place.walking_minutes}分钟`} />
            <InfoTile icon={Route} label="营业" value={place.opening_hours ? opening.text : "未登记"} />
          </div>

          <section className="mt-6">
            <SectionTitle title="推荐理由" subtitle="추천 이유" />
            <p className="mt-3 text-base leading-7 text-slate-700">{place.short_description_zh}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{place.short_description_ko}</p>
          </section>

          <div className="mt-5 flex flex-wrap gap-2">
            {place.tags.map((tag) => (
              <TagChip key={tag.slug}>{tag.label_zh}</TagChip>
            ))}
            {facilityTags.map((label) => (
              <TagChip key={label} tone="blue">
                {label}
              </TagChip>
            ))}
          </div>
        </div>
      </section>

      <PlaceChinaDecisionPanel
        place={place}
        openingText={place.opening_hours ? opening.text : "未登记"}
        priceText={priceText}
      />

      <section className="mt-6 space-y-3">
        <SectionTitle title="推荐菜单" subtitle="추천 메뉴" />
        {place.menu_items.length > 0 ? (
          <div className="space-y-3">
            {[...recommendedMenus, ...otherMenus].map((item) => (
              <div key={item.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-950">{item.name_zh}</h2>
                      {item.is_recommended ? <TagChip tone="green">推荐</TagChip> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{item.name_ko}</p>
                  </div>
                  <span className="shrink-0 font-black text-slate-950">{formatWon(item.price)}</span>
                </div>
                {item.description_zh ? <p className="mt-3 text-sm leading-6 text-slate-600">{item.description_zh}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            등록된 메뉴가 없습니다.
          </div>
        )}
      </section>

      {place.category === "restaurant" ? (
        <OrderGuide place={place} locale="zh" />
      ) : (
        <section className="mt-6 space-y-3">
          <SectionTitle title="怎么说？" subtitle="어떻게 말할까?" />
          <div className="rounded-[24px] bg-teal-700 p-5 text-white shadow-sm">
            <MessageSquareText size={22} aria-hidden="true" />
            <p className="mt-3 text-lg font-bold">{place.recommended_order_zh || "请问可以推荐这里最受欢迎的菜单吗？"}</p>
            <p className="mt-3 rounded-2xl bg-white/12 p-3 text-sm leading-6 text-teal-50">
              {place.recommended_order_ko || "여기에서 가장 인기 있는 메뉴를 추천해주실 수 있나요?"}
            </p>
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <InfoPanel icon={Users} title="等候" subtitle="웨이팅" zh={place.waiting_info_zh} ko={place.waiting_info_ko} />
        <InfoPanel
          icon={MapPin}
          title="怎么去？"
          subtitle="가는 방법"
          zh={`${place.nearest_station} ${place.nearest_exit} · 步行 ${place.walking_minutes}分钟`}
          ko={`${place.address_ko} / ${place.address_zh}`}
        />
      </section>

      <section className="mt-6 space-y-3">
        <SectionTitle title="旅行小贴士" subtitle="여행 팁" />
        <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <Soup size={22} className="text-teal-700" aria-hidden="true" />
          <p className="mt-3 text-base leading-7 text-slate-700">{place.tips_zh}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{place.tips_ko}</p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <InfoTile icon={CreditCard} label="付款" value={place.card_payment ? "可以刷卡" : "现金确认"} />
        <InfoTile icon={MapPin} label="坐标" value={place.latitude && place.longitude ? `${place.latitude}, ${place.longitude}` : "未登记"} />
      </section>

      <section className="mt-6 rounded-[24px] bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        信息可能会发生变化，请出发前再次确认。가격, 영업시간, 대기 정보는 변경될 수 있으니 방문 전 다시 확인하세요.
      </section>

      <PlaceCorrectionForm
        placeId={place.id}
        locale="zh"
        currentValues={{
          opening_hours: place.opening_hours,
          menu: currentMenuText,
          menu_price: currentMenuText,
          price_range: priceText,
          phone: place.phone ?? "",
          website: place.website ?? "",
          address: place.address_zh || place.address_ko || place.address,
        }}
      />
      <PlaceLocationPanel place={place} />
    </main>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <Icon size={17} className="text-teal-700" aria-hidden="true" />
      <p className="mt-2 text-xs text-slate-500">{label}</p>
      <p className="break-words text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  subtitle,
  zh,
  ko,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  zh: string;
  ko: string;
}) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <Icon size={22} className="text-teal-700" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">{zh || "暂无信息"}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{ko || "정보가 아직 없습니다."}</p>
    </div>
  );
}
