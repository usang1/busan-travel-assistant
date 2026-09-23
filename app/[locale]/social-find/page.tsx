import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SocialPlaceFinder } from "@/components/SocialPlaceFinder";
import { buildLocalizedMetadata, isLocale, type Locale } from "@/lib/i18n";
import { canAnalyzeSocialImage } from "@/lib/social-discovery-ocr";

type SocialFindPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ text?: string | string[] }>;
};

async function getLocale(params: SocialFindPageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: SocialFindPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  return buildLocalizedMetadata({
    locale,
    title: metadataCopy[locale].title,
    description: metadataCopy[locale].description,
    path: "/social-find",
  });
}

export default async function SocialFindPage({ params, searchParams }: SocialFindPageProps) {
  const locale = await getLocale(params);
  const query = await searchParams;
  const text = Array.isArray(query.text) ? query.text[0] : query.text;
  const copy = pageCopy[locale];

  return (
    <main className="safe-bottom mx-auto max-w-5xl px-4 pb-8 pt-5">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-black text-teal-700">{copy.eyebrow}</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight tracking-normal text-slate-950 sm:text-4xl">{copy.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">{copy.description}</p>
      </header>
      <section className="py-6">
        <SocialPlaceFinder locale={locale} imageEnabled={canAnalyzeSocialImage()} initialText={text?.slice(0, 6000) ?? ""} />
      </section>
    </main>
  );
}

const metadataCopy = {
  ko: { title: "SNS에서 본 부산 장소 찾기", description: "Xiaohongshu와 SNS에서 본 장소 단서를 검수된 부산 장소와 대조하고 한국어 상호와 주소를 확인하세요." },
  zh: { title: "查找在小红书看到的釜山地点", description: "把小红书和社交平台中的线索与已审核釜山地点比对，确认韩文店名和地址。" },
  en: { title: "Find a Busan place from social media", description: "Match clues from Xiaohongshu and social posts to reviewed Busan places, then verify the Korean name and address." },
  ja: { title: "SNSで見た釜山の場所を探す", description: "小紅書やSNS投稿の手がかりを確認済みの釜山スポットと照合し、韓国語の店名と住所を確認できます。" },
} satisfies Record<Locale, { title: string; description: string }>;

const pageCopy = {
  ko: { eyebrow: "SNS 발견에서 실제 방문까지", title: "SNS에서 본 장소, 부산의 실제 장소와 대조하세요", description: "중국어 별칭, 지역, 역, 메뉴, 간판 글자를 공개·검수된 부산 장소와 비교합니다. 후보는 자동 확정하지 않으며 한국어 상호와 주소를 확인한 뒤 저장하거나 지도앱을 열 수 있습니다." },
  zh: { eyebrow: "从社交发现到实际到访", title: "把社交平台看到的地点对应到真实釜山地点", description: "根据中文别名、区域、车站、菜单和招牌文字，与公开且已审核的釜山地点比对。候选不会自动确认，请核对韩文店名和地址后再收藏或打开地图。" },
  en: { eyebrow: "From social discovery to a real visit", title: "Match a place from social media to a real Busan location", description: "Compare aliases, areas, stations, menus, and sign text with public, reviewed Busan places. Candidates are never auto-confirmed; check the Korean name and address before saving or opening a map." },
  ja: { eyebrow: "SNSでの発見から実際の訪問へ", title: "SNSで見た場所を釜山の実在スポットと照合", description: "別名、地域、駅、メニュー、看板文字を、公開・確認済みの釜山スポットと比較します。候補は自動確定せず、韓国語の店名と住所を確認してから保存・地図を開けます。" },
} satisfies Record<Locale, { eyebrow: string; title: string; description: string }>;
