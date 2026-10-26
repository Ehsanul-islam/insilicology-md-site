import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };

/** Monochrome social card in the site style: kicker, large title, subtitle. */
export function ogImage({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", color: "#161616", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 2, textTransform: "uppercase", color: "#5e5e5e" }}>{kicker}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: title.length > 48 ? 56 : 72, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>{title}</div>
          {subtitle && <div style={{ display: "flex", marginTop: 24, fontSize: 32, color: "#5e5e5e" }}>{subtitle}</div>}
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>Insilicology</div>
      </div>
    ),
    ogSize,
  );
}
