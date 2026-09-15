"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";

const maxImageBytes = 8 * 1024 * 1024;
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];

type AdminPlaceImageUploadProps = {
  accessToken: string;
  value: string;
  previewUrl?: string;
  previewAttribution?: string;
  onChange: (url: string) => void;
};

export function AdminPlaceImageUpload({
  accessToken,
  value,
  previewUrl = "",
  previewAttribution = "",
  onChange,
}: AdminPlaceImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const displayUrl = value.trim() || previewUrl.trim();

  async function uploadImage(file: File) {
    if (!acceptedImageTypes.includes(file.type)) {
      setMessage("JPG, PNG, WebP, AVIF 이미지만 업로드할 수 있습니다.");
      return;
    }

    if (file.size > maxImageBytes) {
      setMessage("이미지 파일은 8MB 이하여야 합니다.");
      return;
    }

    setUploading(true);
    setMessage("대표이미지를 업로드하는 중입니다.");

    try {
      const body = new FormData();
      body.set("image", file);
      const response = await fetch("/api/admin/place-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
      });
      const result = (await response.json()) as { url?: string; message?: string };

      if (!response.ok || !result.url) {
        throw new Error(result.message ?? "이미지 업로드에 실패했습니다.");
      }

      onChange(result.url);
      setMessage("대표이미지를 업로드했습니다. 장소를 저장하면 최종 반영됩니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
      <div className="relative aspect-[4/3] w-full max-w-[180px] overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
        {displayUrl ? (
          // Admin previews can include provider-only URLs that are intentionally not persisted.
          <img src={displayUrl} alt="대표이미지 미리보기" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-slate-400">
            <ImagePlus size={28} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept={acceptedImageTypes.join(",")}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadImage(file);
          }}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={uploading || !accessToken}
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={17} aria-hidden="true" />
            {uploading ? "업로드 중" : value ? "이미지 교체" : "이미지 업로드"}
          </button>
          {value ? (
            <button
              type="button"
              title="대표이미지 제거"
              aria-label="대표이미지 제거"
              onClick={() => {
                onChange("");
                setMessage("대표이미지를 제거했습니다. 장소를 저장하면 최종 반영됩니다.");
              }}
              className="inline-flex size-11 items-center justify-center rounded-lg bg-white text-rose-700 ring-1 ring-slate-200"
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">JPG, PNG, WebP, AVIF · 최대 8MB</p>
        {!value && previewUrl ? (
          <p className="mt-1 text-xs leading-5 text-amber-700">
            Provider 사진은 미리보기 전용입니다. 저장할 사진을 직접 업로드해 주세요.
            {previewAttribution ? ` 출처: ${previewAttribution}` : ""}
          </p>
        ) : null}
        {message ? <p role="status" className="mt-1 break-words text-xs leading-5 text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}
