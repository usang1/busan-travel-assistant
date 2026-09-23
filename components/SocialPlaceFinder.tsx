"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { AlertTriangle, Camera, Check, FileText, ImageUp, Link2, LoaderCircle, MapPin, Search, ShieldCheck } from "lucide-react";
import { AddToTripButton } from "@/components/AddToTripButton";
import { DirectionsButton } from "@/components/DirectionsButton";
import { SaveButton } from "@/components/SaveButton";
import { useAuth } from "@/components/AuthProvider";
import { type Locale, withLocale } from "@/lib/i18n";
import type { SocialDiscoveryCandidate, SocialInputKind } from "@/lib/social-discovery";

type SearchResponse = {
  mappingId: string;
  confirmationToken: string;
  candidates: SocialDiscoveryCandidate[];
  clues: string[];
  platform: string;
  ocrStatus: "not_used" | "completed";
  message?: string;
};

export function SocialPlaceFinder({ locale, imageEnabled, initialText = "" }: { locale: Locale; imageEnabled: boolean; initialText?: string }) {
  const text = copy[locale];
  const { session } = useAuth();
  const [mode, setMode] = useState<SocialInputKind>(initialText ? "direct" : "link");
  const [inputText, setInputText] = useState(initialText.slice(0, 6000));
  const [image, setImage] = useState<File | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmedPlaceId, setConfirmedPlaceId] = useState("");
  const [confirmingPlaceId, setConfirmingPlaceId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function changeMode(nextMode: SocialInputKind) {
    setMode(nextMode);
    setError("");
    setResult(null);
    setConfirmedPlaceId("");
    if (nextMode !== "image") setImage(null);
  }

  function chooseImage(file: File | null) {
    setError("");
    if (!file) {
      setImage(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(text.errors.invalidImage);
      setImage(null);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError(text.errors.imageTooLarge);
      setImage(null);
      return;
    }
    setImage(file);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (mode === "image" && !image) {
      setError(text.errors.imageRequired);
      return;
    }
    if (mode !== "image" && !inputText.trim()) {
      setError(text.errors.textRequired);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setConfirmedPlaceId("");
    const form = new FormData();
    form.set("inputKind", mode);
    form.set("locale", locale);
    form.set("inputText", inputText.trim());
    if (image) form.set("image", image);

    try {
      const response = await fetch("/api/social-discovery/search", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: form,
      });
      const body = await response.json() as SearchResponse;
      if (!response.ok) throw new Error(body.message ?? "search_failed");
      setResult(body);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "search_failed";
      setError(errorMessage(code, locale));
    } finally {
      setLoading(false);
    }
  }

  async function confirm(candidate: SocialDiscoveryCandidate) {
    if (!result || confirmingPlaceId) return;
    setConfirmingPlaceId(candidate.id);
    setError("");
    try {
      const response = await fetch("/api/social-discovery/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ mappingId: result.mappingId, placeId: candidate.id, token: result.confirmationToken }),
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "confirmation_failed");
      setConfirmedPlaceId(candidate.id);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "confirmation_failed";
      setError(errorMessage(code, locale));
    } finally {
      setConfirmingPlaceId("");
    }
  }

  const prefill = buildSubmissionHref(locale, result?.clues ?? []);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={text.inputMethod}>
        {inputModes.map((item) => {
          const Icon = item.icon;
          const disabled = item.id === "image" && !imageEnabled;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              disabled={disabled}
              onClick={() => changeMode(item.id)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-black ring-1 transition focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-45 ${mode === item.id ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200"}`}
            >
              <Icon size={16} aria-hidden="true" />{text.modes[item.id]}
            </button>
          );
        })}
      </div>
      {!imageEnabled ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{text.imageUnavailable}</p> : null}

      <form onSubmit={submit} className="mt-5 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        {mode === "image" ? (
          <div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => chooseImage(event.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-28 w-full items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-black text-slate-700 focus:outline-none focus:ring-4 focus:ring-teal-100">
              <ImageUp size={22} aria-hidden="true" />
              <span className="min-w-0 break-words">{image?.name ?? text.chooseImage}</span>
            </button>
            <label className="mt-4 block">
              <span className="text-sm font-black text-slate-700">{text.optionalContext}</span>
              <textarea value={inputText} onChange={(event) => setInputText(event.target.value)} maxLength={6000} rows={3} placeholder={text.placeHint} className={fieldClass} />
            </label>
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-teal-50 px-3 py-3 text-xs font-semibold leading-5 text-teal-950 ring-1 ring-teal-100">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{text.imagePrivacy}
            </p>
          </div>
        ) : mode === "direct" ? (
          <label className="block">
            <span className="text-sm font-black text-slate-700">{text.directLabel}</span>
            <input value={inputText} onChange={(event) => setInputText(event.target.value)} maxLength={6000} placeholder={text.placeHint} className={`${fieldClass} h-13`} />
          </label>
        ) : (
          <label className="block">
            <span className="text-sm font-black text-slate-700">{mode === "link" ? text.linkLabel : text.textLabel}</span>
            <textarea value={inputText} onChange={(event) => setInputText(event.target.value)} maxLength={6000} rows={mode === "link" ? 3 : 6} placeholder={mode === "link" ? text.linkPlaceholder : text.textPlaceholder} className={fieldClass} />
          </label>
        )}
        <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{text.publicOnly}</p>
        <button type="submit" disabled={loading} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-black text-white transition hover:bg-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-200 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60">
          {loading ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
          {loading ? text.searching : text.search}
        </button>
      </form>

      {error ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-900 ring-1 ring-rose-100"><AlertTriangle size={17} className="mr-2 inline" aria-hidden="true" />{error}</p> : null}

      {result ? (
        <section className="mt-7" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-black text-teal-700">{text.resultEyebrow}</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{result.candidates.length ? text.resultsTitle : text.noResultsTitle}</h2>
            </div>
            {result.clues.length ? <p className="text-xs font-bold text-slate-500">{text.clues}: {result.clues.slice(0, 5).join(" · ")}</p> : null}
          </div>
          {result.candidates.length ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {result.candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  locale={locale}
                  confirmed={confirmedPlaceId === candidate.id}
                  confirming={confirmingPlaceId === candidate.id}
                  onConfirm={() => void confirm(candidate)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-white p-5 ring-1 ring-slate-200">
              <p className="text-sm leading-6 text-slate-600">{text.noResultsDescription}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={prefill} className="inline-flex min-h-11 items-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white">{text.submitPlace}</Link>
                <button type="button" onClick={() => { setResult(null); setInputText(""); setImage(null); }} className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-slate-200">{text.tryAgain}</button>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function CandidateCard({ candidate, locale, confirmed, confirming, onConfirm }: { candidate: SocialDiscoveryCandidate; locale: Locale; confirmed: boolean; confirming: boolean; onConfirm: () => void }) {
  const text = copy[locale];
  const href = withLocale(`/places/${candidate.slug}`, locale);
  const confidence = candidate.confidence >= 80 ? text.high : candidate.confidence >= 55 ? text.medium : text.low;
  const coordinates = candidate.latitude !== null && candidate.longitude !== null ? { latitude: candidate.latitude, longitude: candidate.longitude } : null;

  return (
    <article className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
      <Link href={href} className="block">
        <div className="relative aspect-[16/8] bg-slate-100">
          {candidate.thumbnailUrl ? <Image src={candidate.thumbnailUrl} alt={candidate.name} fill sizes="(max-width: 1024px) 100vw, 480px" className="object-cover" /> : <div className="grid h-full place-items-center text-slate-400"><Camera size={24} aria-hidden="true" /><span className="sr-only">{text.noPhoto}</span></div>}
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-teal-700">{candidate.category} · {candidate.region}</p>
            <h3 className="mt-1 break-words text-lg font-black text-slate-950">{candidate.name}</h3>
            {candidate.secondaryName ? <p className="mt-1 break-words text-sm font-semibold text-slate-500">{candidate.secondaryName}</p> : null}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${candidate.confidence >= 80 ? "bg-teal-50 text-teal-800" : candidate.confidence >= 55 ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
            {confidence} {candidate.confidence}%
          </span>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-sm leading-6 text-slate-600"><MapPin size={15} className="mt-1 shrink-0" aria-hidden="true" /><span>{candidate.address || candidate.koreanAddress}</span></p>
        {candidate.representativeMenu ? <p className="mt-2 text-sm font-bold text-slate-700">{text.menu}: {candidate.representativeMenu}</p> : null}
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-3">
          <p className="text-xs font-black text-slate-500">{text.matched}</p>
          <p className="mt-1 break-words text-sm font-bold leading-6 text-slate-800">{candidate.matchedClues.join(" · ")}</p>
          {candidate.confidence < 55 ? <p className="mt-2 text-xs font-semibold leading-5 text-amber-900">{text.lowWarning}</p> : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={href} className="inline-flex min-h-10 items-center rounded-lg bg-slate-950 px-3 text-xs font-black text-white">{text.details}</Link>
          <SaveButton locale={locale} initialSaveCount={candidate.saveCount} item={{ id: candidate.id, type: "place", titleZh: candidate.name, titleKo: candidate.koreanName, href, imageUrl: candidate.thumbnailUrl, meta: [candidate.category, candidate.region].filter(Boolean).join(" · ") }} className="rounded-lg" />
          <AddToTripButton placeId={candidate.id} locale={locale} />
          <DirectionsButton placeId={candidate.id} name={candidate.koreanName} address={candidate.koreanAddress} coordinates={coordinates} locale={locale} compact />
        </div>
        <button type="button" onClick={onConfirm} disabled={confirmed || confirming} className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:opacity-70 ${confirmed ? "bg-teal-50 text-teal-800 ring-1 ring-teal-100" : "bg-white text-teal-800 ring-1 ring-teal-200"}`}>
          {confirmed ? <Check size={17} aria-hidden="true" /> : confirming ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={17} aria-hidden="true" />}
          {confirmed ? text.confirmed : confirming ? text.confirming : text.thisPlace}
        </button>
        {confirmed ? <p className="mt-2 text-xs font-semibold leading-5 text-teal-800">{text.confirmedHelp}</p> : null}
      </div>
    </article>
  );
}

function buildSubmissionHref(locale: Locale, clues: string[]) {
  const params = new URLSearchParams();
  if (clues[0]) params.set("name", clues[0].slice(0, 120));
  if (clues.length) params.set("location", clues.slice(1, 4).join(" · ").slice(0, 240));
  params.set("reason", copy[locale].submissionReason);
  return `${withLocale("/contact", locale)}?${params.toString()}`;
}

function errorMessage(code: string, locale: Locale) {
  const errors = copy[locale].errors;
  const key = code.replace(/_([a-z])/g, (_, value: string) => value.toUpperCase()) as keyof typeof errors;
  return errors[key] ?? errors.searchFailed;
}

const inputModes = [
  { id: "link", icon: Link2 },
  { id: "text", icon: FileText },
  { id: "direct", icon: Search },
  { id: "image", icon: ImageUp },
] satisfies Array<{ id: SocialInputKind; icon: typeof Link2 }>;

const fieldClass = "mt-2 w-full rounded-lg bg-slate-50 px-3 py-3 text-base text-slate-950 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-teal-100";

const copy = {
  ko: {
    inputMethod: "입력 방식", modes: { link: "공유 링크", text: "게시물 본문", direct: "장소명", image: "캡처" }, imageUnavailable: "캡처 분석은 개인정보 검수와 OCR 환경 설정 후 제공됩니다. 링크·본문·장소명 검색은 지금 사용할 수 있습니다.",
    chooseImage: "JPG, PNG, WebP 캡처 선택 (최대 4MB)", optionalContext: "추가 단서 (선택)", placeHint: "예: 광안리 소금빵 초록 포도", imagePrivacy: "캡처는 단서 추출에만 사용하고 저장하지 않습니다. 사용자명·프로필·얼굴은 매칭에 사용하지 않습니다.",
    directLabel: "중국어 또는 한국어 장소명·설명", linkLabel: "공개 SNS 공유 링크", textLabel: "게시물에서 복사한 본문", linkPlaceholder: "Xiaohongshu, Instagram, TikTok, YouTube 공개 링크", textPlaceholder: "장소명, 지역, 역, 메뉴, 해시태그가 보이도록 붙여넣어 주세요.", publicOnly: "로그인이 필요한 비공개 게시물은 수집하지 않습니다. 입력 원문과 URL은 저장하지 않고 정규화된 해시와 추출 단서만 보관합니다.", search: "부산 장소 후보 찾기", searching: "공개 장소와 대조 중", resultEyebrow: "검수된 부산 장소 대조", resultsTitle: "가능성이 있는 장소", noResultsTitle: "확인된 후보가 없습니다", clues: "찾은 단서", noResultsDescription: "현재 공개·검수된 부산 장소에서는 일치 후보를 찾지 못했습니다. 추출 단서로 제보를 시작하면 관리자가 중복 여부를 확인한 뒤 검수합니다.", submitPlace: "이 단서로 장소 제보", tryAgain: "다시 검색", high: "높은 일치", medium: "중간 일치", low: "낮은 일치", noPhoto: "확인된 사진 없음", menu: "대표 메뉴", matched: "일치한 단서", lowWarning: "단서가 부족해 자동 확정하지 않았습니다. 주소와 한국어 상호를 직접 확인해 주세요.", details: "상세 보기", thisPlace: "이 장소가 맞아요", confirming: "확인 저장 중", confirmed: "이 장소로 확인됨", confirmedHelp: "사용자 확인은 운영자 검수 대기로 저장되며 공개 장소 정보를 자동 변경하지 않습니다.", submissionReason: "SNS에서 본 장소를 찾지 못해 검수를 요청합니다. 아래 단서는 자동 확정된 정보가 아닙니다.",
    errors: { invalidImage: "JPG, PNG, WebP 파일만 사용할 수 있습니다.", imageTooLarge: "이미지는 4MB 이하여야 합니다.", imageRequired: "분석할 캡처를 선택해 주세요.", textRequired: "찾을 링크나 장소 단서를 입력해 주세요.", unsupportedProtocol: "http 또는 https 링크만 사용할 수 있습니다.", urlCredentialsNotAllowed: "계정 정보가 포함된 링크는 사용할 수 없습니다.", privateHostNotAllowed: "내부 네트워크 주소는 사용할 수 없습니다.", unsupportedSocialHost: "지원하는 공개 SNS 링크가 아닙니다.", invalidSocialLink: "공개 SNS 공유 링크를 확인해 주세요.", ocrUnavailable: "캡처 분석이 아직 설정되지 않았습니다. 텍스트 검색을 이용해 주세요.", ocrFailed: "이미지는 업로드됐지만 글자를 읽지 못했습니다. 본문이나 장소명을 붙여넣어 주세요.", rateLimited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", socialDiscoveryNotConfigured: "검색 서버 설정이 아직 완료되지 않았습니다.", socialDiscoveryMigrationRequired: "SNS 장소 검색 DB 설정이 아직 적용되지 않았습니다.", invalidConfirmation: "확인 세션이 만료됐습니다. 다시 검색해 주세요.", confirmationFailed: "장소 확인을 저장하지 못했습니다.", searchFailed: "장소 후보를 찾지 못했습니다. 잠시 후 다시 시도해 주세요." },
  },
  zh: {
    inputMethod: "输入方式", modes: { link: "分享链接", text: "帖子正文", direct: "地点名称", image: "截图" }, imageUnavailable: "截图识别会在隐私审核和 OCR 配置完成后开放。链接、正文和地点名称搜索现在可用。",
    chooseImage: "选择 JPG、PNG、WebP 截图（最大 4MB）", optionalContext: "补充线索（可选）", placeHint: "例如：广安里 盐面包 青葡萄", imagePrivacy: "截图仅用于提取线索，不会保存。用户名、头像和人脸不用于匹配。",
    directLabel: "中文或韩文地点名、描述", linkLabel: "公开 SNS 分享链接", textLabel: "从帖子复制的正文", linkPlaceholder: "小红书、Instagram、TikTok、YouTube 公开链接", textPlaceholder: "请粘贴包含店名、区域、车站、菜单或标签的文字。", publicOnly: "不会抓取需要登录的私密内容。原文和原始 URL 不保存，只保留规范化哈希和提取线索。", search: "查找釜山地点候选", searching: "正在与已审核地点比对", resultEyebrow: "已审核釜山地点比对", resultsTitle: "可能的地点", noResultsTitle: "暂未找到已确认候选", clues: "提取线索", noResultsDescription: "目前公开且已审核的釜山地点中没有找到匹配项。可带着已提取线索提交地点，管理员会先检查重复再审核。", submitPlace: "用这些线索提交地点", tryAgain: "重新搜索", high: "高度匹配", medium: "中度匹配", low: "低度匹配", noPhoto: "暂无已确认照片", menu: "代表菜单", matched: "匹配线索", lowWarning: "线索不足，系统不会自动确认。请核对韩文店名和地址。", details: "查看详情", thisPlace: "就是这个地点", confirming: "正在保存确认", confirmed: "已确认这个地点", confirmedHelp: "你的确认会进入管理员审核队列，不会自动修改公开地点信息。", submissionReason: "未能找到在 SNS 看到的地点，请管理员审核。以下线索并非自动确认的信息。",
    errors: { invalidImage: "只支持 JPG、PNG、WebP 文件。", imageTooLarge: "图片必须小于 4MB。", imageRequired: "请选择需要识别的截图。", textRequired: "请输入链接或地点线索。", unsupportedProtocol: "仅支持 http 或 https 链接。", urlCredentialsNotAllowed: "不能使用包含账号信息的链接。", privateHostNotAllowed: "不能使用内部网络地址。", unsupportedSocialHost: "不是受支持的公开 SNS 链接。", invalidSocialLink: "请检查公开 SNS 分享链接。", ocrUnavailable: "截图识别尚未配置，请使用文字搜索。", ocrFailed: "图片上传成功，但未能识别文字。请粘贴正文或地点名称。", rateLimited: "请求过多，请稍后再试。", socialDiscoveryNotConfigured: "搜索服务器尚未配置完成。", socialDiscoveryMigrationRequired: "SNS 地点搜索数据库尚未配置。", invalidConfirmation: "确认会话已过期，请重新搜索。", confirmationFailed: "无法保存地点确认。", searchFailed: "无法查找地点候选，请稍后再试。" },
  },
  en: {
    inputMethod: "Input method", modes: { link: "Share link", text: "Post text", direct: "Place name", image: "Screenshot" }, imageUnavailable: "Screenshot analysis will open after privacy review and OCR setup. Link, text, and place-name search work now.",
    chooseImage: "Choose a JPG, PNG, or WebP screenshot (max 4MB)", optionalContext: "Extra clue (optional)", placeHint: "Example: Gwangalli salt bread green grape", imagePrivacy: "The screenshot is used only to extract clues and is not stored. Usernames, profiles, and faces are ignored.",
    directLabel: "Chinese or Korean place name or description", linkLabel: "Public social share link", textLabel: "Text copied from the post", linkPlaceholder: "Public Xiaohongshu, Instagram, TikTok, or YouTube link", textPlaceholder: "Paste text containing a name, area, station, menu, or hashtag.", publicOnly: "We do not collect private content that requires sign-in. Raw text and URLs are not stored; only a normalized hash and extracted clues are retained.", search: "Find verified Busan candidates", searching: "Checking verified places", resultEyebrow: "Verified Busan place match", resultsTitle: "Possible places", noResultsTitle: "No verified candidate found", clues: "Clues", noResultsDescription: "No match was found among currently public, reviewed Busan places. Start a submission with the extracted clues and an admin will check duplicates before review.", submitPlace: "Submit with these clues", tryAgain: "Search again", high: "High match", medium: "Medium match", low: "Low match", noPhoto: "No verified photo", menu: "Featured menu", matched: "Matched clues", lowWarning: "There is not enough evidence to confirm this automatically. Check the Korean name and address.", details: "View details", thisPlace: "This is the place", confirming: "Saving confirmation", confirmed: "Place confirmed", confirmedHelp: "Your confirmation enters admin review and does not automatically change public place data.", submissionReason: "I could not find a place seen on social media and request review. These clues are not confirmed facts.",
    errors: { invalidImage: "Use a JPG, PNG, or WebP file.", imageTooLarge: "The image must be 4MB or smaller.", imageRequired: "Choose a screenshot to analyze.", textRequired: "Enter a link or place clue.", unsupportedProtocol: "Only http or https links are supported.", urlCredentialsNotAllowed: "Links containing account credentials are not allowed.", privateHostNotAllowed: "Internal network addresses are not allowed.", unsupportedSocialHost: "This is not a supported public social link.", invalidSocialLink: "Check the public social share link.", ocrUnavailable: "Screenshot analysis is not configured yet. Use text search instead.", ocrFailed: "The image uploaded, but its text could not be read. Paste the post text or place name.", rateLimited: "Too many requests. Try again shortly.", socialDiscoveryNotConfigured: "The search server is not configured yet.", socialDiscoveryMigrationRequired: "The social place database setup has not been applied.", invalidConfirmation: "The confirmation session expired. Search again.", confirmationFailed: "Could not save the place confirmation.", searchFailed: "Could not find place candidates. Try again shortly." },
  },
  ja: {
    inputMethod: "入力方法", modes: { link: "共有リンク", text: "投稿本文", direct: "場所名", image: "スクリーンショット" }, imageUnavailable: "画像解析はプライバシー審査とOCR設定後に公開します。リンク・本文・場所名検索は利用できます。",
    chooseImage: "JPG・PNG・WebP画像を選択（最大4MB）", optionalContext: "追加の手がかり（任意）", placeHint: "例：広安里 塩パン 青ぶどう", imagePrivacy: "画像は手がかり抽出だけに使い、保存しません。ユーザー名・プロフィール・顔は照合に使いません。",
    directLabel: "中国語または韓国語の場所名・説明", linkLabel: "公開SNS共有リンク", textLabel: "投稿からコピーした本文", linkPlaceholder: "小紅書、Instagram、TikTok、YouTubeの公開リンク", textPlaceholder: "店名、地域、駅、メニュー、ハッシュタグを含む文を貼り付けてください。", publicOnly: "ログインが必要な非公開コンテンツは収集しません。原文とURLは保存せず、正規化ハッシュと抽出した手がかりだけを保持します。", search: "釜山の場所候補を探す", searching: "確認済み場所と照合中", resultEyebrow: "確認済み釜山スポット照合", resultsTitle: "候補の場所", noResultsTitle: "確認済み候補がありません", clues: "抽出した手がかり", noResultsDescription: "現在公開・確認済みの釜山スポットには一致候補がありません。抽出した手がかりで投稿すると、管理者が重複確認後に審査します。", submitPlace: "この手がかりで場所を投稿", tryAgain: "再検索", high: "高い一致", medium: "中程度の一致", low: "低い一致", noPhoto: "確認済み写真なし", menu: "代表メニュー", matched: "一致した手がかり", lowWarning: "手がかりが少ないため自動確定しません。韓国語の店名と住所を確認してください。", details: "詳細を見る", thisPlace: "この場所です", confirming: "確認を保存中", confirmed: "この場所で確認済み", confirmedHelp: "ユーザー確認は管理者審査待ちになり、公開情報を自動変更しません。", submissionReason: "SNSで見た場所を見つけられなかったため審査を依頼します。以下は自動確定された情報ではありません。",
    errors: { invalidImage: "JPG・PNG・WebPのみ利用できます。", imageTooLarge: "画像は4MB以下にしてください。", imageRequired: "解析する画像を選択してください。", textRequired: "リンクまたは場所の手がかりを入力してください。", unsupportedProtocol: "httpまたはhttpsリンクのみ利用できます。", urlCredentialsNotAllowed: "アカウント情報を含むリンクは利用できません。", privateHostNotAllowed: "内部ネットワークのアドレスは利用できません。", unsupportedSocialHost: "対応する公開SNSリンクではありません。", invalidSocialLink: "公開SNS共有リンクを確認してください。", ocrUnavailable: "画像解析は未設定です。テキスト検索を利用してください。", ocrFailed: "画像はアップロードされましたが文字を読めませんでした。本文または場所名を貼り付けてください。", rateLimited: "リクエストが多すぎます。しばらくしてから再試行してください。", socialDiscoveryNotConfigured: "検索サーバーの設定が完了していません。", socialDiscoveryMigrationRequired: "SNS場所検索のDB設定が未適用です。", invalidConfirmation: "確認セッションが期限切れです。再検索してください。", confirmationFailed: "場所の確認を保存できませんでした。", searchFailed: "場所候補を検索できませんでした。しばらくしてから再試行してください。" },
  },
} satisfies Record<Locale, Record<string, unknown>>;
