import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, Clock3, MapPin, UserRound, ZoomIn, type LucideIcon } from "lucide-react";
import { SaveButton } from "@/components/SaveButton";
import { PhotoSpotDetailGate } from "@/components/PhotoSpotDetailGate";
import { SectionTitle } from "@/components/SectionTitle";
import { ShareButton } from "@/components/ShareButton";
import { StructuredData } from "@/components/StructuredData";
import { absoluteUrl, siteConfig } from "@/config/site";
import { getPhotoSpotBySlug } from "@/lib/photo-spot-store";
import { defaultLocale, isLocale, localizedCanonical, ui, withLocale } from "@/lib/i18n";
import { photoSpotCopy } from "@/lib/photo-spot-copy";
import { breadcrumbSchema } from "@/lib/public-seo";

type PhotoSpotDetailPageProps = {
  params: Promise<{
    slug: string;
    locale?: string;
  }>;
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PhotoSpotDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { photoSpot } = await getPhotoSpotBySlug(slug);

  const title = photoSpot ? `${photoSpot.name_zh}｜广安里拍照机位` : "拍照地图";
  const description = photoSpot
    ? `${photoSpot.name_zh} 推荐时间 ${photoSpot.best_time}，推荐倍率 ${photoSpot.recommended_zoom}。`
    : "釜山广安里拍照机位详情。";

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/photo-spots/${slug}`) },
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/photo-spots/${slug}`),
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "article",
      images: photoSpot?.thumbnail_url ? [{ url: photoSpot.thumbnail_url }] : undefined,
    },
  };
}

export default async function PhotoSpotDetailPage({ params }: PhotoSpotDetailPageProps) {
  const { slug, locale: routeLocale } = await params;
  const locale = isLocale(routeLocale) ? routeLocale : defaultLocale;
  const copy = photoSpotCopy[locale];
  const { photoSpot, error } = await getPhotoSpotBySlug(slug);

  if (!photoSpot) {
    notFound();
  }
  const name = locale === "zh" ? photoSpot.name_zh || photoSpot.name_ko : photoSpot.name_ko;
  const translated = (value: string) => locale === "zh" || !/\p{Letter}/u.test(value) ? value || ui[locale].common.noInfo : copy.pending;

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-4">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "TouristAttraction",
          name,
          description: locale === "zh" ? photoSpot.portrait_tip_zh : undefined,
          image: photoSpot.thumbnail_url,
          url: localizedCanonical(`/photo-spots/${photoSpot.slug}`, locale),
          geo:
            photoSpot.latitude && photoSpot.longitude
              ? {
                  "@type": "GeoCoordinates",
                  latitude: photoSpot.latitude,
                  longitude: photoSpot.longitude,
                }
              : undefined,
        }}
      />
      <StructuredData data={breadcrumbSchema([{ name: ui[locale].nav.home, url: localizedCanonical("/", locale) }, { name: copy.title, url: localizedCanonical("/photo-spots", locale) }, { name, url: localizedCanonical(`/photo-spots/${photoSpot.slug}`, locale) }])} />
      <Link href={withLocale("/photo-spots", locale)} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600">
        <ArrowLeft size={17} aria-hidden="true" />
        {copy.title}
      </Link>
      {error ? <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{copy.unavailable}</p> : null}
      <h1 className="mb-3 break-words text-3xl font-black">{name}</h1>
      {locale !== "ko" ? <p className="mb-5 text-sm text-slate-600">{copy.original}{locale === "zh" ? ` · ${photoSpot.name_ko}` : ""}</p> : null}

      <PhotoSpotDetailGate photoSpot={photoSpot} locale={locale}>
        <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="relative aspect-[4/3] bg-slate-200">
          <Image
            src={photoSpot.sample_image_url || photoSpot.thumbnail_url}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
            priority
          />
          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm backdrop-blur">
            {photoSpot.free_or_pro === "free" ? copy.free : "Pro"}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <SaveButton
              locale={locale}
              className="size-11 shrink-0"
              item={{
                id: photoSpot.id,
                type: "photo_spot",
                titleZh: photoSpot.name_zh,
                titleKo: photoSpot.name_ko,
                href: withLocale(`/photo-spots/${photoSpot.slug}`, locale),
                imageUrl: photoSpot.thumbnail_url,
                meta: copy.title,
              }}
            />
          </div>
          <div className="mt-4">
            <ShareButton
              locale={locale}
              title={name}
              text={name}
              url={localizedCanonical(`/photo-spots/${photoSpot.slug}`, locale)}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <PhotoInfo icon={Clock3} label={copy.bestTime} value={translated(photoSpot.best_time)} />
            <PhotoInfo icon={ZoomIn} label={copy.zoom} value={translated(photoSpot.recommended_zoom)} />
            <PhotoInfo icon={UserRound} label={copy.subject} value={translated(photoSpot.subject_position)} />
            <PhotoInfo icon={Camera} label={copy.camera} value={translated(photoSpot.camera_position)} />
          </div>
        </div>
        </section>

        <section className="mt-6 space-y-3">
        <SectionTitle title={copy.subject} />
        <div className="relative h-72 overflow-hidden rounded-[28px] bg-sky-50 ring-1 ring-sky-100">
          <div className="absolute inset-x-0 top-0 h-24 bg-sky-200" />
          <div className="absolute inset-x-0 top-16 h-2 bg-white/80" />
          <div className="absolute left-1/2 top-10 h-16 w-40 -translate-x-1/2 rounded-t-full border-4 border-slate-600 border-b-0" />
          <div className="absolute bottom-0 h-28 w-full bg-amber-100" />
          <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 flex-col items-center">
            <div className="grid size-14 place-items-center rounded-full bg-teal-700 text-white shadow-lg">
              <UserRound size={26} aria-hidden="true" />
            </div>
            <p className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">{copy.subject}</p>
          </div>
          <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center">
            <div className="grid size-12 place-items-center rounded-full bg-slate-950 text-white shadow-lg">
              <Camera size={24} aria-hidden="true" />
            </div>
            <p className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">{copy.camera}</p>
          </div>
        </div>
        </section>

        <section className="mt-6 space-y-3">
        <SectionTitle title={copy.tips} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TipPanel icon={UserRound} title={copy.portrait} text={translated(photoSpot.portrait_tip_zh)} />
          <TipPanel icon={Camera} title={copy.lighting} text={translated(photoSpot.lighting_tip_zh)} />
        </div>
        </section>

        <section className="mt-6 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <MapPin size={22} className="text-teal-700" aria-hidden="true" />
        <h2 className="mt-3 font-bold text-slate-950">{copy.location}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {photoSpot.latitude && photoSpot.longitude ? `${photoSpot.latitude}, ${photoSpot.longitude}` : ui[locale].common.noInfo}
        </p>
        </section>
      </PhotoSpotDetailGate>
    </main>
  );
}

function PhotoInfo({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <Icon size={17} className="text-teal-700" aria-hidden="true" />
      <p className="mt-2 text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold leading-5 text-slate-950">{value}</p>
    </div>
  );
}

function TipPanel({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <Icon size={22} className="text-teal-700" aria-hidden="true" />
      <h2 className="mt-3 font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}
