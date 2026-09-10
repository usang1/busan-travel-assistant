import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { StructuredData } from "@/components/StructuredData";
import { GuidePlanningDetails } from "@/components/GuidePlanningDetails";
import { breadcrumbSchema, translatedGuideLocales } from "@/lib/public-seo";
import { guidePlanningCopy, guideQuestion } from "@/lib/guide-planning-copy";
import { GuidePlaceLink } from "@/components/GuidePlaceLink";
import { GuideSaveButton } from "@/components/GuideSaveButton";
import { GuideViewTracker } from "@/components/GuideViewTracker";
import { SaveButton } from "@/components/SaveButton";
import { ShareButton } from "@/components/ShareButton";
import { guideContent, guideCopy } from "@/lib/guide-copy";
import { getPublishedGuide, createPublicGuideClient, getRelatedGuidesForGuide } from "@/lib/guide-store";
import { getPublicPlacesByIds } from "@/lib/place-store";
import { getRepresentativeMenu } from "@/lib/place-display";
import { buildLocalizedMetadata, isLocale, getPlaceContent, withLocale, localizedCanonical, localeMeta, ui } from "@/lib/i18n";
import { getPlaceCategoryLabel, getTrustedPlaceImageUrl } from "@/lib/place-trust";
import { RelatedGuidesSection } from "@/components/RelatedGuidesSection";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; slug: string }> };
const readGuide = cache(getPublishedGuide);
export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const guide = await readGuide(slug);
  if (!guide) notFound();
  const content = guideContent(guide, locale);
  return buildLocalizedMetadata({ locale, title: guide.editorial?.[locale]?.question || guideQuestion(content.title, locale), description: (guide.editorial?.[locale]?.answer || content.description).slice(0, 300), path: `/guides/${slug}`, type: "article", images: guide.cover_image ? [{ url: guide.cover_image }] : undefined, availableLocales: translatedGuideLocales(guide), noIndex: !translatedGuideLocales(guide).includes(locale) });
}
export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const guide = await readGuide(slug);
  if (!guide) notFound();
  if (!translatedGuideLocales(guide).includes(locale)) notFound();
  const content = guideContent(guide, locale);
  const copy = guideCopy[locale];
  const title = guide.editorial?.[locale]?.question || guideQuestion(content.title, locale);
  const answer = guide.editorial?.[locale]?.answer || content.description;
  const client = createPublicGuideClient();
  const places = client ? await getPublicPlacesByIds(guide.guide_places.map((stop) => stop.place_id), client).catch(() => []) : [];
  const stops = guide.guide_places.flatMap((stop) => {
    const place = places.find((place) => place.id === stop.place_id);
    return place ? [{ ...stop, place }] : [];
  });
  const relatedGuides = await getRelatedGuidesForGuide(guide, 4).catch(() => []);
  const incomplete = stops.some((stop, i) => stop.sequence !== i) || stops.length !== guide.guide_places.length;
  return <main className="safe-bottom mx-auto max-w-3xl space-y-6 px-4 pb-6 pt-5">
    <GuideViewTracker guideId={guide.id} guideType={guide.guide_type} area={guide.area} locale={locale} />
    <StructuredData data={{ "@context": "https://schema.org", "@type": "Article", headline: title, description: answer,
      inLanguage: localeMeta[locale].languageTag, mainEntityOfPage: localizedCanonical(`/guides/${slug}`, locale),
      ...(guide.cover_image ? { image: guide.cover_image } : {}), datePublished: guide.published_at || undefined, dateModified: guide.updated_at || undefined,
      mainEntity: { "@type": "ItemList", itemListOrder: "https://schema.org/ItemListOrderAscending", numberOfItems: stops.length, itemListElement: stops.map((stop, i) => ({ "@type": "ListItem", position: i + 1, name: getPlaceContent(stop.place, locale).name, url: localizedCanonical(`/places/${stop.place.slug}`, locale) })) },
    }} />
    <StructuredData data={breadcrumbSchema([
      { name: ui[locale].nav.home, url: localizedCanonical("/", locale) },
      { name: copy.title, url: localizedCanonical("/guides", locale) },
      { name: title, url: localizedCanonical(`/guides/${slug}`, locale) },
    ])} />
    <Link href={withLocale("/guides", locale)} className="inline-flex min-h-11 items-center text-sm font-bold text-teal-700">← {copy.title}</Link>
    <section className="min-w-0 overflow-hidden">
      {guide.cover_image ? <img src={guide.cover_image} alt={content.title} className="aspect-video w-full object-cover" fetchPriority="high" /> : null}
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-sm font-bold text-teal-700">{copy.official} · {copy.types[guide.guide_type]}</p>
        <h1 className="break-words text-2xl font-black text-slate-950 sm:text-3xl">{title}</h1>
        <p className="whitespace-pre-wrap break-words text-base leading-7 text-slate-700">{answer}</p>
        {answer !== content.description ? <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{content.description}</p> : null}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {guide.area ? <div><dt className="text-slate-500">{copy.area}</dt><dd className="font-bold">{guide.area}</dd></div> : null}
          {guide.estimated_duration !== null ? <div><dt className="text-slate-500">{copy.duration}</dt><dd className="font-bold">{guide.estimated_duration} {copy.minutes}</dd></div> : null}
          {guide.recommended_for[locale] ? <div><dt className="text-slate-500">{copy.audience}</dt><dd className="break-words font-bold">{guide.recommended_for[locale]}</dd></div> : null}
          <div><dt className="text-slate-500">{copy.weather}</dt><dd className="font-bold">{copy.weatherTypes[guide.weather_type]}</dd></div>
        </dl>
        <p className="text-sm font-bold">{stops.length} {copy.stops}</p>
        <div className="flex flex-wrap items-center gap-2">
          <GuideSaveButton
            guideId={guide.id}
            guideType={guide.guide_type}
            slug={slug}
            locale={locale}
            titleKo={guide.title_ko}
            titleZh={guide.title_zh}
            imageUrl={guide.cover_image}
            meta={[copy.official, copy.types[guide.guide_type], guide.area].filter(Boolean).join(" · ")}
            area={guide.area}
          />
          <ShareButton
            title={content.title}
            text={content.description}
            url={localizedCanonical(`/guides/${slug}`, locale)}
            locale={locale}
            label={copy.share}
            metadata={{ guide_id: guide.id, guide_type: guide.guide_type, area: guide.area }}
          />
        </div>
        <p className="text-sm font-bold text-teal-800">{copy.saveHint}</p>
      </div>
    </section>
    <GuidePlanningDetails guide={guide} locale={locale} stops={stops} section="comparison" />
    <h2 className="text-xl font-bold">{guidePlanningCopy[locale].route}</h2>
    {incomplete ? <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{copy.unavailableStop}</p> : null}
    <ol className="space-y-5">
      {stops.map((stop, i) => {
        const place = stop.place;
        const placeContent = getPlaceContent(place, locale);
        const menu = getRepresentativeMenu(place, locale);
        const href = withLocale(`/places/${place.slug}`, locale);
        const nextStop = stops[i + 1];
        return <li key={stop.place_id} className="min-w-0">
          <article className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200">
            {getTrustedPlaceImageUrl(place) ? <GuidePlaceLink href={href} guideId={guide.id} guideType={guide.guide_type} area={guide.area} placeId={place.id} locale={locale} position={i + 1}><img src={getTrustedPlaceImageUrl(place)} alt={placeContent.name} loading="lazy" className="aspect-[2/1] w-full object-cover" /></GuidePlaceLink> : null}
            <div className="space-y-3 p-5">
              <p className="text-xs font-bold text-teal-700">{i + 1} · {getPlaceCategoryLabel(place.category, locale)}</p>
              <h2 className="break-words text-xl font-black"><GuidePlaceLink href={href} guideId={guide.id} guideType={guide.guide_type} area={guide.area} placeId={place.id} locale={locale} position={i + 1}>{stop.custom_title[locale] || placeContent.name}</GuidePlaceLink></h2>
              {stop.custom_title[locale] ? <p className="text-sm text-slate-500">{placeContent.name}</p> : null}
              {menu ? <p className="text-sm font-bold">{menu.name}{menu.price ? ` · ${menu.price}` : ""}</p> : null}
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{stop.custom_description[locale] || placeContent.description}</p>
              {stop.stay_minutes !== null ? <p className="text-sm font-bold">{copy.stay}: {stop.stay_minutes} {copy.minutes}</p> : null}
              {stop.tip[locale] ? <p className="whitespace-pre-wrap break-words rounded-2xl bg-teal-50 p-3 text-sm leading-6 text-teal-900">{copy.tip}: {stop.tip[locale]}</p> : null}
              <div className="flex flex-wrap items-center justify-between gap-3"><GuidePlaceLink href={href} className="inline-flex min-h-11 items-center text-sm font-bold text-teal-700" guideId={guide.id} guideType={guide.guide_type} area={guide.area} placeId={place.id} locale={locale} position={i + 1}>{copy.details} →</GuidePlaceLink><SaveButton locale={locale} initialSaveCount={place.save_count ?? 0} label={placeSaveLabel[locale]} item={{ id: place.id, type: "place", titleKo: place.name_ko, titleZh: place.name_zh, href, imageUrl: getTrustedPlaceImageUrl(place), meta: getPlaceCategoryLabel(place.category, locale) }} /></div>
            </div>
          </article>
          {nextStop ? <div className="px-4 pt-5 text-sm text-slate-600"><span aria-hidden="true">↓ </span>{copy.next}{nextStop.sequence === stop.sequence + 1 && stop.transportation_note[locale] ? <p className="mt-1 whitespace-pre-wrap break-words font-bold">{stop.transportation_note[locale]}</p> : null}</div> : null}
        </li>;
      })}
    </ol>
    <GuidePlanningDetails guide={guide} locale={locale} stops={stops} section="references" />
    <RelatedGuidesSection guides={relatedGuides} locale={locale} />
    <section className="rounded-[24px] bg-teal-50 p-5 ring-1 ring-teal-100">
      <p className="text-base font-black text-teal-950">{copy.saveHint}</p>
      <div className="mt-4">
        <GuideSaveButton
          guideId={guide.id}
          guideType={guide.guide_type}
          slug={slug}
          locale={locale}
          titleKo={guide.title_ko}
          titleZh={guide.title_zh}
          imageUrl={guide.cover_image}
          meta={[copy.official, copy.types[guide.guide_type], guide.area].filter(Boolean).join(" · ")}
          area={guide.area}
        />
      </div>
    </section>
  </main>;
}

const placeSaveLabel = {
  zh: "收藏地点",
  en: "Save place",
  ja: "スポットを保存",
  ko: "장소 저장",
};
