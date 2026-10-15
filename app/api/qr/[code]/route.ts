import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { createServerAnonClient } from "@/lib/server-supabase";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!/^[a-z0-9][a-z0-9_-]{5,79}$/iu.test(code)) return NextResponse.json({ message: "QR을 찾을 수 없습니다." }, { status: 404 });
  try {
    const client = createServerAnonClient();
    const { data } = await client.from("qr_campaigns").select("code,status").eq("code", code).eq("status", "active").maybeSingle();
    if (!data) return NextResponse.json({ message: "QR을 찾을 수 없습니다." }, { status: 404 });
    const target = new URL(`/q/${encodeURIComponent(code)}`, request.url).toString();
    const svg = await QRCode.toString(target, { type: "svg", errorCorrectionLevel: "M", margin: 3, width: 960, color: { dark: "#26352c", light: "#ffffff" } });
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        ...(download ? { "Content-Disposition": `attachment; filename="spotzari-${code}.svg"` } : {}),
      },
    });
  } catch {
    return NextResponse.json({ message: "QR 생성 기능을 사용할 수 없습니다." }, { status: 503 });
  }
}
