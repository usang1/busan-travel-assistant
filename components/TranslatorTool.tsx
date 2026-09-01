"use client";

import { useMemo, useState } from "react";
import { Languages, Volume2, X } from "lucide-react";
import { touristPhrases, translatorCategories, type TouristPhrase, type TranslatorCategory } from "@/data/translator-phrases";

export function TranslatorTool() {
  const [category, setCategory] = useState<TranslatorCategory>("restaurant");
  const [selectedPhrase, setSelectedPhrase] = useState<TouristPhrase | null>(null);
  const [customText, setCustomText] = useState("");
  const [customKorean, setCustomKorean] = useState("");
  const [translationError, setTranslationError] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

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

  async function translateCustomText() {
    const sourceText = customText.trim();

    if (!sourceText) {
      setTranslationError("번역할 외국어 문장을 입력해 주세요.");
      return;
    }

    setIsTranslating(true);
    setTranslationError("");
    setCustomKorean("");

    try {
      const response = await fetch("/api/translate-to-korean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText }),
      });
      const body = (await response.json().catch(() => ({}))) as { translation?: unknown; message?: unknown };

      if (!response.ok) {
        throw new Error(typeof body.message === "string" ? body.message : "한국어 번역에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }

      if (typeof body.translation !== "string" || !body.translation.trim()) {
        throw new Error("번역 결과를 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }

      setSelectedPhrase(null);
      setCustomKorean(body.translation.trim());
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : "한국어 번역 중 오류가 발생했습니다.");
    } finally {
      setIsTranslating(false);
    }
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
        <h2 className="text-lg font-black text-slate-950">외국어 문장 직접 입력</h2>
        <p className="mt-1 text-sm text-slate-500">중국어 등 외국어 문장을 GPT로 자연스러운 한국어로 번역합니다.</p>
        <textarea
          value={customText}
          onChange={(event) => {
            setCustomText(event.target.value);
            setTranslationError("");
          }}
          maxLength={1000}
          placeholder="例如：请问这里可以寄存行李吗？"
          className="mt-4 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        />
        <button
          type="button"
          onClick={() => void translateCustomText()}
          disabled={isTranslating || !customText.trim()}
          className="mt-3 h-12 w-full rounded-2xl bg-teal-700 px-4 text-base font-black text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTranslating ? "GPT 번역 중..." : "한국어로 번역"}
        </button>
        {translationError ? (
          <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-100">
            {translationError}
          </p>
        ) : null}
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
