import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceCorrectionPageView } from "@/components/PlaceCorrectionPageView";
import { getPlaceBySlug } from "@/lib/place-store";

type PlaceReportPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "补充商家信息",
  description: "提交地点营业时间、菜单、价格等信息供管理员审核。",
  robots: { index: false, follow: false },
};

export default async function PlaceReportPage({ params }: PlaceReportPageProps) {
  const { slug } = await params;
  const { place } = await getPlaceBySlug(slug);
  if (!place) notFound();
  return <PlaceCorrectionPageView place={place} locale="zh" />;
}
