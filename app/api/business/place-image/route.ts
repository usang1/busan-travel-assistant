import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { businessErrorResponse, requireAuthenticatedUser } from "@/lib/business-auth";

const maxImageBytes = 8 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAuthenticatedUser(request);
    const { count, error: accessError } = await client.from("business_applications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved");
    if (accessError || !count) return NextResponse.json({ code: "approved_application_required", message: "승인된 입점 신청이 있어야 이미지를 올릴 수 있습니다." }, { status: 403 });
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) return NextResponse.json({ message: "업로드할 이미지 파일을 선택해 주세요." }, { status: 400 });
    if (!imageTypes.has(image.type)) return NextResponse.json({ message: "JPG, PNG, WebP, AVIF 이미지만 업로드할 수 있습니다." }, { status: 415 });
    if (image.size <= 0 || image.size > maxImageBytes) return NextResponse.json({ message: "이미지 파일은 8MB 이하여야 합니다." }, { status: 413 });
    const bytes = new Uint8Array(await image.arrayBuffer());
    if (!matchesSignature(image.type, bytes)) return NextResponse.json({ message: "파일 내용이 올바른 이미지 형식이 아닙니다." }, { status: 415 });
    const optimized = await sharp(Buffer.from(bytes)).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    const objectPath = `${user.id}/business/${Date.now()}-${randomUUID()}.webp`;
    const { error } = await client.storage.from("place-images").upload(objectPath, optimized, { cacheControl: "31536000", contentType: "image/webp", upsert: false });
    if (error) throw error;
    const { data } = client.storage.from("place-images").getPublicUrl(objectPath);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    const response = businessErrorResponse(error);
    return NextResponse.json({ code: response.code, message: response.message }, { status: response.status });
  }
}

function matchesSignature(type: string, bytes: Uint8Array) {
  const has = (offset: number, expected: number[]) => expected.every((value, index) => bytes[offset + index] === value);
  const ascii = (offset: number, value: string) => has(offset, Array.from(value, (character) => character.charCodeAt(0)));
  if (type === "image/jpeg") return has(0, [0xff, 0xd8, 0xff]);
  if (type === "image/png") return has(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/webp") return ascii(0, "RIFF") && ascii(8, "WEBP");
  return type === "image/avif" && ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"));
}
