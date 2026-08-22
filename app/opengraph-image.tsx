import { ImageResponse } from "next/og";
export const alt = "CarScout — search UK cars and parts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, color: "white", background: "radial-gradient(circle at 15% 0%, #0c4a6e, #07101e 55%)", fontFamily: "sans-serif" }}><div style={{ display: "flex", alignItems: "center", gap: 24 }}><div style={{ width: 82, height: 82, borderRadius: 24, background: "#38bdf8", color: "#07101e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 900 }}>C</div><div style={{ fontSize: 46, fontWeight: 800 }}>CarScout</div></div><div style={{ marginTop: 54, maxWidth: 900, fontSize: 68, lineHeight: 1.05, fontWeight: 800, letterSpacing: -3 }}>Find your next car—or the right part.</div><div style={{ marginTop: 30, fontSize: 28, color: "#94a3b8" }}>One search. More UK marketplaces.</div></div>, size);
}
