"use client";

import { useMemo, useState } from "react";
import { Languages, Volume2, X } from "lucide-react";
import { touristPhrases, translatorCategories, type TouristPhrase, type TranslatorCategory } from "@/data/translator-phrases";

function demoTranslate(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return "번역할 중국어를 입력해 주세요.";
  }

  const matched = touristPhrases.find((phrase) => trimmed.includes(phrase.zh.replace(/[。？]/g, "")) || trimmed.includes(phrase.titleZh));

  if (matched) {
    return matched.ko;
  }

  return `데모 번역: ${trimmed}`;
}

export function TranslatorTool() {
  const [category, setCategory] = useState<TranslatorCategory>("restaurant");
  const [selectedPhrase, setSelectedPhrase] = useState<TouristPhrase | null>(null);
  const [customText, setCustomText] = useState("");
  const [customKorean, setCustomKorean] = useState("");

  const phrases = useMemo(() => touristPhrases.filter((phrase) => phrase.category === category), [category]);

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  const bigText = selectedPhrase?.ko ?? customKorean;
  const smallText = selectedPhrase?.zh ?? customText;

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {translatorCategories.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            className={[
              "shrink-0 rounded-full px-4 py-2 text-sm font-black ring-1 transition active:scale-95",
              category === item.id ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200",
            ].join(" ")}
          >
            {item.zh}
            <span className="ml-1 text-xs opacity-70">{item.ko}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {phrases.map((phrase) => (
          <button
            key={phrase.id}
            type="button"
            onClick={() => setSelectedPhrase(phrase)}
            className="rounded-[24px] bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              <Languages size={14} aria-hidden="true" />
              {phrase.titleZh}
            </div>
            <p className="mt-4 text-lg font-bold text-slate-950">{phrase.zh}</p>
            <p className="mt-2 text-base font-black text-slate-700">{phrase.ko}</p>
          </button>
        ))}
      </div>

      <section className="mt-6 rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-black text-slate-950">中国어 직접 입력</h2>
        <p className="mt-1 text-sm text-slate-500">임시 데모 번역입니다. 실제 AI API는 아직 연결하지 않았습니다.</p>
        <textarea
          value={customText}
          onChange={(event) => setCustomText(event.target.value)}
          placeholder="例如：请问这里可以寄存行李吗？"
          className="mt-4 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        />
        <button
          type="button"
          onClick={() => {
            const translated = demoTranslate(customText);
            setCustomKorean(translated);
            setSelectedPhrase(null);
          }}
          className="mt-3 h-12 w-full rounded-2xl bg-teal-700 px-4 text-base font-black text-white"
        >
          데모 번역 보기
        </button>
        {customKorean ? (
          <button
            type="button"
            onClick={() => setSelectedPhrase(null)}
            className="mt-3 w-full rounded-2xl bg-slate-950 p-4 text-left text-white"
          >
            <p className="text-sm text-slate-300">한국어</p>
            <p className="mt-2 text-2xl font-black">{customKorean}</p>
          </button>
        ) : null}
      </section>

      {bigText ? (
        <div className="fixed inset-0 z-50 bg-slate-950 p-4 text-white" role="dialog" aria-modal="true">
          <div className="absolute right-4 top-4 flex gap-2">
            <button
              type="button"
              onClick={() => speak(bigText)}
              className="grid size-12 place-items-center rounded-full bg-white/10 text-white"
              aria-label="한국어 음성 읽기"
            >
              <Volume2 size={23} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedPhrase(null);
                setCustomKorean("");
              }}
              className="grid size-12 place-items-center rounded-full bg-white/10 text-white"
              aria-label="关闭"
            >
              <X size={24} aria-hidden="true" />
            </button>
          </div>
          <div className="flex min-h-full flex-col items-center justify-center text-center">
            <p className="mb-6 rounded-full bg-teal-400/15 px-4 py-2 text-sm font-bold text-teal-100">请把这个画面给韩国人看</p>
            <p className="max-w-3xl text-[44px] font-black leading-tight tracking-normal sm:text-7xl">{bigText}</p>
            <p className="mt-8 max-w-xl rounded-[24px] bg-white/10 p-5 text-xl font-bold leading-8 text-slate-100">{smallText}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
