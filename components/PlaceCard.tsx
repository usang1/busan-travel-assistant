import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Camera, Clock3, MapPin, MessageSquarePlus, Soup, UserRound, WalletCards } from "lucide-react";
import { DirectionsButton } from "@/components/DirectionsButton";
import { SaveButton } from "@/components/SaveButton";
import { TagChip } from "@/components/TagChip";
import { hasCoordinates, type Coordinates } from "@/lib/location";
import { getChinaDiscoveryTags } from "@/lib/place-china/discovery";
import {
  distanceFromGwangalli,
  formatPlaceDistance,
  getDistanceWarning,
  getTravelerAdvantage,
} from "@/lib/place-display";
import { defaultLocale, getLocalizedTag, getPlaceContent, type Locale, ui, withLocale } from "@/lib/i18n";
import {
  buildPlaceCardFacts,
  getLastVerifiedLabel,
  getPlacePhotoDisplay,
  getPlaceTrustCopy,
  getPublicPlaceDescription,
  getSourceSummary,
  getTrustedPlaceImageUrl,
  getVerificationStatus,
  getVerificationStatusLabel,
} from "@/lib/place-trust";
import { categoryLabels, type PlaceWithRelations } from "@/types/database";

type PlaceCardProps = {
  place: PlaceWithRelations;
  priority?: boolean;
  locale?: Locale;
  distanceMeters?: number | null;
  compact?: boolean;
};

export function PlaceCard({ place, priority = false, locale = defaultLocale, distanceMeters = null, compact = false }: PlaceCardProps) {
  const content = getPlaceContent(place, locale);
  const copy = ui[locale];
  const trustCopy = getPlaceTrustCopy(locale);
  const placeHref = withLocale(`/places/${place.slug}`, locale);
  const correctionHref = withLocale(`/places/${place.slug}/report`, locale);
  const chinaTags = locale === "zh" ? getChinaDiscoveryTags(place, locale, 4) : [];
  const correctionLabel = { zh: "补充商家信息", en: "Update info", ja: "店舗情報を報告", ko: "영업정보 제보" }[locale];
  const coordinates: Coordinates | null = hasCoordinates(place)
    ? { latitude: place.latitude, longitude: place.longitude }
    : null;
  const displayDistance = distanceMeters ?? distanceFromGwangalli(place);
  const distanceWarning = getDistanceWarning(displayDistance, locale);
  const travelerAdvantage = getPublicPlaceDescription(place, locale) || getTravelerAdvantage(place, locale);
  const publicDescription = getPublicPlaceDescription(place, locale);
  const photo = getPlacePhotoDisplay(place, locale);
  const cardFacts = buildPlaceCardFacts(place, locale);
  const verificationStatus = getVerificationStatus(place);
  const trustedImageUrl = getTrustedPlaceImageUrl(place);

  return (
    <article className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <Link href={placeHref} className="block">
        <div className="relative aspect-[16/10] bg-slate-200">
          {photo.kind === "image" ? (
            <Image
              src={photo.url}
              alt={content.secondaryName ? `${content.name} / ${content.secondaryName}` : content.name}
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              className="object-cover"
              priority={priority}
            />
          ) : (
            <div className="grid h-full place-items-center bg-slate-100 px-4 text-center">
              <div>
                <Camera size={24} className="mx-auto text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-black text-slate-600">{photo.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">{photo.detail}</p>
              </div>
            </div>
          )}
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur">
            {categoryLabels[place.category][locale]}
          </div>
        </div>
      </Link>
      <div className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start justify-between gap-3">
          <Link href={placeHref} className="min-w-0">
            <h3 className={compact ? "truncate text-base font-bold text-slate-950" : "truncate text-lg font-bold text-slate-950"}>{content.name}</h3>
            {content.secondaryName ? <p className="mt-0.5 text-sm text-slate-500">{content.secondaryName}</p> : null}
          </Link>
          <SaveButton
            initialSaveCount={place.save_count ?? 0}
            locale={locale}
            item={{
              id: place.id,
              type: "place",
              titleZh: place.name_zh,
              titleKo: place.name_ko,
              href: placeHref,
              imageUrl: trustedImageUrl,
              meta: [categoryLabels[place.category][locale], formatPlaceDistance(displayDistance, locale)].filter(Boolean).join(" · "),
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
          {cardFacts.facts.map((fact) => (
            <span key={fact.key} className="inline-flex min-h-9 items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2">
              <PlaceFactIcon factKey={fact.key} />
              <span className="min-w-0">
                <span className="mr-1 font-bold text-slate-500">{fact.label}</span>
                <span className="font-black text-slate-950">{fact.value}</span>
              </span>
            </span>
          ))}
          {cardFacts.missingSummary ? (
            <span className="inline-flex min-h-9 items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-900 ring-1 ring-amber-100">
              <Clock3 size={15} aria-hidden="true" />
              {cardFacts.missingSummary}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          {displayDistance !== null ? (
            <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
              <MapPin size={14} aria-hidden="true" />
              {formatPlaceDistance(displayDistance, locale)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <BadgeCheck size={14} aria-hidden="true" />
            {getVerificationStatusLabel(verificationStatus, locale)}
          </span>
          <span>{getLastVerifiedLabel(place, locale)}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <TagChip tone={verificationStatus === "verified" ? "green" : verificationStatus === "needs_review" ? "amber" : "default"}>
            {getSourceSummary(place, locale)}
          </TagChip>
          {distanceWarning ? <TagChip tone="amber">{distanceWarning}</TagChip> : null}
        </div>
        {travelerAdvantage !== copy.common.noInfo ? (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{travelerAdvantage}</p>
        ) : null}
        {publicDescription && publicDescription !== travelerAdvantage ? (
          <p className="mt-2 line-clamp-1 text-xs font-semibold text-slate-500">{publicDescription}</p>
        ) : null}
        {(chinaTags.length || place.tags.length) ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {chinaTags.map((tag) => (
              <TagChip key={tag} tone="blue">
                {tag}
              </TagChip>
            ))}
            {place.tags.slice(0, 3).map((tag) => (
              <TagChip key={tag.slug} tone={place.is_active ? "green" : "amber"}>
                {getLocalizedTag(tag, locale)}
              </TagChip>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Link href={correctionHref} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-slate-50 px-3 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100">
            <MessageSquarePlus size={15} aria-hidden="true" />
            {correctionLabel}
          </Link>
          <DirectionsButton
            placeId={place.id}
            name={content.name}
            address={content.address}
            coordinates={coordinates}
            locale={locale}
            compact
          />
        </div>
      </div>
    </article>
  );
}

function PlaceFactIcon({ factKey }: { factKey: ReturnType<typeof buildPlaceCardFacts>["facts"][number]["key"] }) {
  const Icon = factKey === "menu" ? Soup : factKey === "price" ? WalletCards : factKey === "solo" ? UserRound : Clock3;

  return <Icon size={15} className="mt-0.5 shrink-0 text-teal-700" aria-hidden="true" />;
}
