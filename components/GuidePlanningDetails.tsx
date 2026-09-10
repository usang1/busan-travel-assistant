import Link from "next/link";
import { getPlaceContent, localeMeta, ui, withLocale, type Locale } from "@/lib/i18n";
import { guidePlanningCopy } from "@/lib/guide-planning-copy";
import { guideCopy } from "@/lib/guide-copy";
import { getWaitingDisplay } from "@/lib/place-display";
import { formatPriceRange } from "@/lib/place-store";
import { getLastVerifiedLabel, getPlaceCategoryLabel, getPlaceNameDisplay, getPublicOpeningHours, getSourceSummary } from "@/lib/place-trust";
import type { GuideDetail, GuideStop } from "@/types/guide";
import type { PlaceWithRelations } from "@/types/database";

type Props = { guide: GuideDetail; locale: Locale; stops: (GuideStop & { place: PlaceWithRelations })[]; section: "comparison" | "references" };

export function GuidePlanningDetails({ guide, locale, stops, section }: Props) {
  const copy = guidePlanningCopy[locale];
  const base = guideCopy[locale];
  const entry = guide.editorial?.[locale];
  const date = (value: string) => new Intl.DateTimeFormat(localeMeta[locale].languageTag, { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(value));
  if (section === "comparison") return <>
    <section className="space-y-3 border-t border-slate-200 pt-5">
      <h2 className="text-xl font-bold">{copy.avoid}</h2>
      <p className="whitespace-pre-wrap text-sm leading-7">{entry?.not_recommended_for || copy.pending}</p>
    </section>
    <section className="min-w-0 space-y-3 border-t border-slate-200 pt-5">
      <h2 className="text-xl font-bold" id="guide-comparison">{copy.compare}</h2>
      {stops.length ? <div className="max-w-full overflow-x-auto" tabIndex={0} role="region" aria-labelledby="guide-comparison">
        <table className="w-full min-w-[680px] table-fixed border-collapse text-left text-sm">
          <thead><tr>{[copy.place, copy.category, copy.price, copy.address, copy.hours, copy.waiting].map((label) => <th key={label} scope="col" className="border-b border-slate-300 p-3 align-top">{label}</th>)}</tr></thead>
          <tbody>{stops.map(({ place }) => <tr key={place.id} className="border-b border-slate-200">
            <th scope="row" className="break-words p-3 align-top"><Link className="inline-flex min-h-11 items-center text-teal-800 underline" href={withLocale(`/places/${place.slug}`, locale)}>{getPlaceNameDisplay(place, locale).name}</Link></th>
            <td className="break-words p-3 align-top">{getPlaceCategoryLabel(place.category, locale)}</td>
            <td className="break-words p-3 align-top">{formatPriceRange(place, locale)}</td>
            <td className="break-words p-3 align-top">{getPlaceContent(place, locale).address || ui[locale].common.noInfo}</td>
            <td className="break-words p-3 align-top">{getPublicOpeningHours(place, locale) || ui[locale].common.noInfo}</td>
            <td className="break-words p-3 align-top">{getWaitingDisplay(place, locale)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="text-sm">{copy.pending}</p>}
    </section>
  </>;
  const faq = entry?.faq?.length ? entry.faq : [
    ...(guide.estimated_duration !== null ? [{ question: copy.durationQuestion, answer: `${guide.estimated_duration} ${base.minutes}` }] : []),
    { question: copy.weatherQuestion, answer: base.weatherTypes[guide.weather_type] },
  ];
  const tips = [entry?.tips, ...stops.map((stop) => stop.tip[locale])].filter(Boolean);
  return <>
    <section className="space-y-3 border-t border-slate-200 pt-5">
      <h2 className="text-xl font-bold">{copy.tips}</h2>
      {tips.length ? <ul className="list-disc space-y-2 pl-5 text-sm leading-7">{tips.map((tip, index) => <li className="whitespace-pre-wrap" key={index}>{tip}</li>)}</ul> : <p className="text-sm">{copy.pending}</p>}
    </section>
    <section className="space-y-3 border-t border-slate-200 pt-5">
      <h2 className="text-xl font-bold">{copy.faq}</h2>
      {faq.map((item, index) => <details key={index} className="border-b border-slate-200 pb-3"><summary className="min-h-11 cursor-pointer py-3 font-semibold">{item.question}</summary><p className="whitespace-pre-wrap text-sm leading-7">{item.answer}</p></details>)}
    </section>
    <section className="space-y-3 border-t border-slate-200 pt-5">
      <h2 className="text-xl font-bold">{copy.sources}</h2>
      {entry?.last_checked && Number.isFinite(Date.parse(entry.last_checked)) ? <p className="text-sm">{copy.checked}: <time dateTime={entry.last_checked}>{date(entry.last_checked)}</time></p> : <p className="text-sm">{copy.checked}: {copy.pending}</p>}
      {Number.isFinite(Date.parse(guide.updated_at)) ? <p className="text-sm">{copy.updated}: <time dateTime={guide.updated_at}>{date(guide.updated_at)}</time></p> : null}
      <ul className="space-y-3 text-sm">
        {entry?.sources?.filter((source) => safeUrl(source.url)).map((source, index) => <li key={index}><a className="inline-flex min-h-11 items-center break-all text-teal-800 underline" href={source.url} rel="noopener noreferrer">{source.label}</a></li>)}
        {stops.map(({ place }) => <li key={place.id}>
          <Link className="inline-flex min-h-11 items-center text-teal-800 underline" href={withLocale(`/places/${place.slug}`, locale)}>{getPlaceNameDisplay(place, locale).name}</Link>
          <p>{getSourceSummary(place, locale)} · {getLastVerifiedLabel(place, locale)}</p>
          {safeUrl(place.website) ? <a className="inline-flex min-h-11 items-center text-teal-800 underline" href={place.website ?? undefined} rel="noopener noreferrer">{copy.official}</a> : null}
        </li>)}
      </ul>
    </section>
  </>;
}

function safeUrl(value: string | null | undefined) {
  try { return Boolean(value && ["https:", "http:"].includes(new URL(value).protocol)); } catch { return false; }
}
