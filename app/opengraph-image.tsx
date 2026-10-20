import { ImageResponse } from "next/og";
export const alt = "Mekivo — find your next car, motorbike or part";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, color: "white", background: "radial-gradient(circle at 15% 0%, #0c4a6e, #07101e 55%)", fontFamily: "sans-serif" }}><div style={{ display: "flex", alignItems: "center", gap: 24 }}><div style={{ width: 82, height: 82, borderRadius: 24, background: "#38bdf8", color: "#07101e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 900 }}>M</div><div style={{ fontSize: 46, fontWeight: 800 }}>Mekivo</div></div><div style={{ marginTop: 54, display: "flex", flexDirection: "column", maxWidth: 900, fontSize: 64, lineHeight: 1.05, fontWeight: 800, letterSpacing: -2 }}><div>Find your next car,</div><div>motorbike or part.</div></div><div style={{ marginTop: 30, fontSize: 28, color: "#94a3b8" }}>mekivo.uk</div></div>, size);
}
