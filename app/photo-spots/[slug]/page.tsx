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
import { demoPhotoSpots } from "@/data/demo-photo-spots";
import { getPhotoSpotBySlug } from "@/lib/photo-spot-store";

type PhotoSpotDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return demoPhotoSpots.map((spot) => ({ slug: spot.slug }));
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
  const { slug } = await params;
  const { photoSpot, source, error } = await getPhotoSpotBySlug(slug);

  if (!photoSpot) {
    notFound();
  }

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-4">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "TouristAttraction",
          name: `${photoSpot.name_zh} / ${photoSpot.name_ko}`,
          description: `${photoSpot.best_time} · ${photoSpot.recommended_zoom}`,
          image: photoSpot.thumbnail_url,
          url: absoluteUrl(`/photo-spots/${photoSpot.slug}`),
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
      <Link href="/photo-spots" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
        <ArrowLeft size={17} aria-hidden="true" />
        返回拍照地图
      </Link>
      {error ? <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}

      <PhotoSpotDetailGate photoSpot={photoSpot}>
        <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="relative aspect-[4/3] bg-slate-200">
          <Image
            src={photoSpot.sample_image_url || photoSpot.thumbnail_url}
            alt={photoSpot.name_zh}
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
            priority
          />
          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm backdrop-blur">
            {source === "demo" ? "Demo" : "Live"} · {photoSpot.free_or_pro === "free" ? "Free" : "Pro"}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black tracking-normal text-slate-950">{photoSpot.name_zh}</h1>
              <p className="mt-1 text-base text-slate-500">{photoSpot.name_ko}</p>
            </div>
            <SaveButton
              className="size-11 shrink-0"
              item={{
                id: photoSpot.id,
                type: "photo_spot",
                titleZh: photoSpot.name_zh,
                titleKo: photoSpot.name_ko,
                href: `/photo-spots/${photoSpot.slug}`,
                imageUrl: photoSpot.thumbnail_url,
                meta: `最佳时间 · ${photoSpot.best_time}`,
              }}
            />
          </div>
          <div className="mt-4">
            <ShareButton
              title={photoSpot.name_zh}
              text={`${photoSpot.name_zh} - ${photoSpot.best_time}, ${photoSpot.recommended_zoom}`}
              url={absoluteUrl(`/photo-spots/${photoSpot.slug}`)}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <PhotoInfo icon={Clock3} label="最佳时间" value={photoSpot.best_time} />
            <PhotoInfo icon={ZoomIn} label="推荐倍率" value={photoSpot.recommended_zoom} />
            <PhotoInfo icon={UserRound} label="站这里" value={photoSpot.subject_position} />
            <PhotoInfo icon={Camera} label="相机放这里" value={photoSpot.camera_position} />
          </div>
        </div>
        </section>

        <section className="mt-6 space-y-3">
        <SectionTitle title="站位示意图" subtitle="간단한 촬영 도식" />
        <div className="relative h-72 overflow-hidden rounded-[28px] bg-sky-50 ring-1 ring-sky-100">
          <div className="absolute inset-x-0 top-0 h-24 bg-sky-200" />
          <div className="absolute inset-x-0 top-16 h-2 bg-white/80" />
          <div className="absolute left-1/2 top-10 h-16 w-40 -translate-x-1/2 rounded-t-full border-4 border-slate-600 border-b-0" />
          <div className="absolute bottom-0 h-28 w-full bg-amber-100" />
          <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 flex-col items-center">
            <div className="grid size-14 place-items-center rounded-full bg-teal-700 text-white shadow-lg">
              <UserRound size={26} aria-hidden="true" />
            </div>
            <p className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">站这里</p>
          </div>
          <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center">
            <div className="grid size-12 place-items-center rounded-full bg-slate-950 text-white shadow-lg">
              <Camera size={24} aria-hidden="true" />
            </div>
            <p className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">相机放这里</p>
          </div>
        </div>
        </section>

        <section className="mt-6 space-y-3">
        <SectionTitle title="拍照提示" subtitle="촬영 팁" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TipPanel icon={UserRound} title="人物" text={photoSpot.portrait_tip_zh} />
          <TipPanel icon={Camera} title="光线" text={photoSpot.lighting_tip_zh} />
        </div>
        </section>

        <section className="mt-6 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <MapPin size={22} className="text-teal-700" aria-hidden="true" />
        <h2 className="mt-3 font-bold text-slate-950">位置</h2>
        <p className="mt-2 text-sm text-slate-600">
          {photoSpot.latitude && photoSpot.longitude ? `${photoSpot.latitude}, ${photoSpot.longitude}` : "坐标未登记"}
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
