import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  CloudRain,
  Languages,
  Luggage,
  MapPin,
  Train,
  UserRound,
  WalletCards,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { HomeSearchForm } from "@/components/HomeSearchForm";
import { PlaceCard } from "@/components/PlaceCard";
import { SectionTitle } from "@/components/SectionTitle";
import { getHomeQuickFilters, type HomeQuickFilterKey } from "@/lib/home-discovery";
import { type Locale, ui, withLocale } from "@/lib/i18n";
import type { PlaceWithRelations } from "@/types/database";

type HomeDiscoveryPageProps = {
  locale: Locale;
  places: PlaceWithRelations[];
};

const quickFilterIcons: Record<HomeQuickFilterKey, LucideIcon> = {
  openNow: Clock3,
  lowWait: Clock3,
  solo: UserRound,
  under10000: WalletCards,
  oceanView: Waves,
  rainyDay: CloudRain,
  luggage: Luggage,
  subwayWalk10: Train,
  chineseMenu: Languages,
};

export function HomeDiscoveryPage({ locale, places }: HomeDiscoveryPageProps) {
  const copy = ui[locale];
  const filters = getHomeQuickFilters(places);
  const recommended = [...places]
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || (b.save_count ?? 0) - (a.save_count ?? 0))
    .slice(0, 4);

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-teal-50 ring-1 ring-white/10">
            <MapPin size={15} aria-hidden="true" />
            {copy.home.area}
          </div>
          <button
            type="button"
            disabled
            title={copy.home.areaNote}
            className="inline-flex h-9 items-center justify-center rounded-full bg-white/10 px-3 text-xs font-black text-slate-300 ring-1 ring-white/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {copy.home.areaAction}
          </button>
        </div>
        <p id="home-region-note" className="mt-3 max-w-md text-xs leading-5 text-teal-100">
          {copy.home.areaNote}
        </p>
        <h1 className="mt-5 max-w-lg text-3xl font-black leading-tight tracking-normal sm:text-4xl">
          {copy.home.heading}
          <span className="mt-2 block text-xl font-semibold leading-snug text-teal-100 sm:text-2xl">{copy.home.subheading}</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">{copy.home.supporting}</p>
        <div className="mt-6">
          <HomeSearchForm locale={locale} />
        </div>
      </section>

      <section className="mt-7 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <SectionTitle title={copy.home.quickFiltersTitle} subtitle={copy.home.quickFiltersSubtitle} />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filters.map((filter) => (
            <QuickFilterButton
              key={filter.key}
              filterKey={filter.key}
              href={filter.href}
              enabled={filter.enabled}
              label={copy.home.quickFilters[filter.key]}
              unavailableLabel={copy.home.quickFilterUnavailable}
              locale={locale}
            />
          ))}
        </div>
      </section>

      <section className="mt-7">
        {recommended.length ? (
          <div className="space-y-4">
            <SectionTitle
              title={copy.home.recommended}
              subtitle={copy.home.recommendedSubtitle}
              action={
                <Link href={withLocale("/places", locale)} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
                  {copy.common.viewAll}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {recommended.map((place, index) => (
                <PlaceCard key={place.id} place={place} priority={index === 0} locale={locale} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title={copy.home.emptyRecommendationTitle} description={copy.home.emptyRecommendationDescription} />
        )}
      </section>

      <section className="mt-7">
        <Link
          href={withLocale("/itinerary", locale)}
          className="group flex min-h-24 w-full flex-wrap items-center gap-4 rounded-[22px] bg-teal-700 px-4 py-4 text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-200 active:scale-[0.99] sm:flex-nowrap"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <CalendarDays size={23} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-black">{copy.home.itineraryTitle}</span>
            <span className="mt-1 block text-sm leading-5 text-teal-50">{copy.home.itineraryDescription}</span>
          </span>
          <span className="inline-flex w-full items-center justify-end gap-1 text-sm font-black sm:w-auto sm:shrink-0">
            {copy.home.itineraryCta}
            <ArrowRight size={18} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      </section>
    </main>
  );
}

function QuickFilterButton({
  filterKey,
  href,
  enabled,
  label,
  unavailableLabel,
  locale,
}: {
  filterKey: HomeQuickFilterKey;
  href: string;
  enabled: boolean;
  label: string;
  unavailableLabel: string;
  locale: Locale;
}) {
  const Icon = quickFilterIcons[filterKey];
  const className =
    "inline-flex min-h-12 items-center gap-2 rounded-2xl px-3 text-left text-sm font-black ring-1 transition focus:outline-none focus:ring-4 focus:ring-teal-100 active:scale-95";

  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        title={unavailableLabel}
        aria-label={`${label} - ${unavailableLabel}`}
        className={`${className} cursor-not-allowed bg-slate-50 text-slate-400 ring-slate-200`}
      >
        <Icon size={17} aria-hidden="true" />
        <span className="min-w-0">{label}</span>
      </button>
    );
  }

  return (
    <Link href={withLocale(href, locale)} className={`${className} bg-white text-slate-800 ring-slate-200 hover:bg-teal-50 hover:text-teal-800 hover:ring-teal-100`}>
      <Icon size={17} aria-hidden="true" />
      <span className="min-w-0">{label}</span>
    </Link>
  );
}
