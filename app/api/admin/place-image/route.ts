import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";

const placeImageBucket = "place-images";
const maxImageBytes = 8 * 1024 * 1024;
const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

function hasBytes(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function hasAscii(bytes: Uint8Array, offset: number, expected: string) {
  return hasBytes(bytes, offset, Array.from(expected, (character) => character.charCodeAt(0)));
}

function matchesImageSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return hasBytes(bytes, 0, [0xff, 0xd8, 0xff]);
  if (type === "image/png") return hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/webp") return hasAscii(bytes, 0, "RIFF") && hasAscii(bytes, 8, "WEBP");
  if (type === "image/avif") {
    return hasAscii(bytes, 4, "ftyp") && (hasAscii(bytes, 8, "avif") || hasAscii(bytes, 8, "avis"));
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAdmin(request);
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ message: "업로드할 이미지 파일을 선택해 주세요." }, { status: 400 });
    }

    const extension = imageExtensions[image.type];
    if (!extension) {
      return NextResponse.json({ message: "JPG, PNG, WebP, AVIF 이미지만 업로드할 수 있습니다." }, { status: 415 });
    }

    if (image.size <= 0 || image.size > maxImageBytes) {
      return NextResponse.json({ message: "이미지 파일은 8MB 이하여야 합니다." }, { status: 413 });
    }

    const objectPath = `${user.id}/${Date.now()}-${randomUUID()}.${extension}`;
    const bytes = await image.arrayBuffer();
    if (!matchesImageSignature(image.type, new Uint8Array(bytes))) {
      return NextResponse.json({ message: "파일 내용이 올바른 이미지 형식이 아닙니다." }, { status: 415 });
    }

    const { error } = await client.storage.from(placeImageBucket).upload(objectPath, bytes, {
      cacheControl: "31536000",
      contentType: image.type,
      upsert: false,
    });

    if (error) {
      return NextResponse.json({ message: `이미지 업로드 실패: ${error.message}` }, { status: 500 });
    }

    const { data } = client.storage.from(placeImageBucket).getPublicUrl(objectPath);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
