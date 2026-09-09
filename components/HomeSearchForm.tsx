"use client";

import { useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { type Locale, ui } from "@/lib/i18n";
import { buildLocalizedPlacesSearchHref } from "@/lib/place-search-url";

type HomeSearchFormProps = {
  locale: Locale;
};

export function HomeSearchForm({ locale }: HomeSearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isComposingRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const copy = ui[locale].home;
  const isNavigating = isSubmitting || isPending;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isComposingRef.current || isSubmittingRef.current) {
      return;
    }

    const href = buildLocalizedPlacesSearchHref(locale, query);

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    startTransition(() => {
      try {
        router.push(href);
      } catch {
        try {
          window.location.assign(href);
        } catch {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        }
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && (event.nativeEvent.isComposing || isComposingRef.current)) {
      event.preventDefault();
    }
  }

  return (
    <form onSubmit={submit} role="search" aria-label={copy.searchLabel} className="flex flex-col gap-2 sm:flex-row">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{copy.searchLabel}</span>
        <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          name="search"
          enterKeyHint="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onKeyDown={handleKeyDown}
          placeholder={copy.searchPlaceholder}
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-[16px] text-slate-900 outline-none shadow-sm transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        />
      </label>
      <button
        type="submit"
        disabled={isNavigating}
        className="inline-flex h-14 min-h-11 w-full shrink-0 items-center justify-center rounded-2xl bg-teal-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-200 active:scale-95 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      >
        {copy.searchButton}
      </button>
    </form>
  );
}
