import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", background: "#f8fafc", color: "#134e4a", padding: 80 }}>
      <div style={{ fontSize: 30, color: "#475569", marginBottom: 28 }}>BUSAN / GWANGALLI</div>
      <div style={{ fontSize: 80, fontWeight: 700 }}>Korea Travel Assistant</div>
    </div>,
    { width: 1200, height: 630 },
  );
}
