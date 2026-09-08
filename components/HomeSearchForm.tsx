"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { type Locale, ui, withLocale } from "@/lib/i18n";

type HomeSearchFormProps = {
  locale: Locale;
};

export function HomeSearchForm({ locale }: HomeSearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const copy = ui[locale].home;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    const params = new URLSearchParams();

    if (trimmed) {
      params.set("q", trimmed);
    }

    const suffix = params.toString();
    router.push(suffix ? `${withLocale("/places", locale)}?${suffix}` : withLocale("/places", locale));
  }

  return (
    <form onSubmit={submit} role="search" aria-label={copy.searchLabel} className="flex gap-2">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{copy.searchLabel}</span>
        <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-[16px] text-slate-900 outline-none shadow-sm transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        />
      </label>
      <button
        type="submit"
        className="inline-flex h-14 shrink-0 items-center justify-center rounded-2xl bg-teal-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-200 active:scale-95"
      >
        {copy.searchButton}
      </button>
    </form>
  );
}
